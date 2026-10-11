/**
 * «Ya soy Premium» — código MediClaro personal (MC-XXXX-XXXX), 11/10/2026.
 *
 * Tras pagar y confirmar el teléfono, la persona crea su código en Perfil → Cuenta (también los propietarios).
 * En otro móvil entra con ese código, sin SMS. Si lo olvida: entra con su teléfono (SMS) y crea uno nuevo.
 * El servidor (Edge Function `access-code`) solo guarda la huella del código y comprueba que el Premium siga en vigor.
 */
import { supabase, invokeFunction, AppError, assertBackendConfigured, toAppError } from '../api';
import { SUPABASE_ANON_KEY, SUPABASE_URL } from '../lib/supabase';

const ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
const LENGTH = 8;

/** Lo escrito → «4K7P9X2Q» (sin «MC», guiones ni espacios); null si no tiene la forma de un código. */
export function normalizeAccessCode(raw: string): string | null {
  let s = raw.toUpperCase().replace(/[^0-9A-Z]/g, '');
  if (s.startsWith('MC') && s.length === LENGTH + 2) s = s.slice(2);
  if (s.length !== LENGTH) return null;
  for (const ch of s) if (!ALPHABET.includes(ch)) return null;
  return s;
}

/** Mientras se escribe: mayúsculas y guiones en su sitio («mc4k7p» → «MC-4K7P»). */
export function formatAccessCodeInput(raw: string): string {
  let s = raw.toUpperCase().replace(/[^0-9A-Z]/g, '');
  if (s.startsWith('MC')) s = s.slice(2);
  s = s.slice(0, LENGTH);
  if (!s) return raw.toUpperCase().startsWith('M') ? raw.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 2) : '';
  return `MC-${s.slice(0, 4)}${s.length > 4 ? `-${s.slice(4)}` : ''}`;
}

const INVALID = 'Ese código no es correcto. Revísalo: es como MC-4K7P-9X2Q.';

export const AccessCodeService = {
  /** ¿Tiene ya un código? (con sesión). */
  async status(): Promise<{ hasCode: boolean; createdAt: string | null }> {
    const r = await invokeFunction<{ hasCode?: boolean; createdAt?: string | null }>('access-code', { action: 'status' });
    return { hasCode: r?.hasCode === true, createdAt: r?.createdAt ?? null };
  },

  /** Crea un código nuevo (el anterior deja de valer). Se muestra una sola vez. */
  async issue(): Promise<string> {
    const r = await invokeFunction<{ code?: string }>('access-code', { action: 'issue' });
    if (!r?.code) throw new AppError('unknown', 'No se ha podido crear tu código. Inténtalo de nuevo.');
    return r.code;
  },

  /** Entra con el código: abre la sesión de esa persona sin SMS. */
  async login(raw: string): Promise<void> {
    assertBackendConfigured();
    const code = normalizeAccessCode(raw);
    if (!code) throw new AppError('invalid_input', INVALID);
    let r: Response;
    try {
      r = await fetch(`${SUPABASE_URL}/functions/v1/access-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: SUPABASE_ANON_KEY },
        body: JSON.stringify({ action: 'login', code }),
      });
    } catch (e) {
      throw toAppError(e, 'offline');
    }
    const data = (await r.json().catch(() => ({}))) as { tokenHash?: string; error?: string; code?: string };
    if (!r.ok || !data.tokenHash) {
      if (r.status === 404) throw new AppError('not_configured', 'El acceso con código todavía no está activado.');
      if (r.status === 429) throw new AppError('rate_limited', data.error || 'Demasiados intentos. Espera unos minutos.');
      if (data.code === 'PREMIUM_INACTIVE') throw new AppError('conflict', data.error || 'Tu Premium no está en vigor.', { code: data.code });
      if (data.code === 'CODE_INVALID') throw new AppError('invalid_input', INVALID, { code: data.code });
      throw new AppError('unknown', 'No hemos podido entrar. Inténtalo de nuevo.');
    }
    const { error } = await supabase.auth.verifyOtp({ token_hash: data.tokenHash, type: 'magiclink' });
    if (error) throw new AppError('unknown', 'No hemos podido abrir tu sesión. Inténtalo de nuevo.');
  },
};
