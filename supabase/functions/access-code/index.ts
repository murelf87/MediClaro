/**
 * «Ya soy Premium» — código MediClaro personal (11/10/2026).
 *
 *  - action 'status' (con sesión): ¿tiene ya un código?
 *  - action 'issue'  (con sesión, teléfono verificado y Premium en vigor; los propietarios también): crea un código
 *    nuevo (el anterior deja de valer) y lo devuelve UNA vez. Solo se guarda su huella.
 *  - action 'login'  (sin sesión): con el código correcto y el Premium en vigor, devuelve un token de un solo uso
 *    con el que la app abre la sesión de esa persona (sin SMS). Intentos limitados por origen.
 * Si olvida el código: entra con su teléfono (SMS) y crea uno nuevo en Perfil → Cuenta.
 * Requisitos: el proveedor «Email» de Supabase Auth activado (no se envía ningún correo). Opcional:
 * ACCESS_CODE_PEPPER (secreto) para reforzar la huella.
 */
import { admin, cors, fail, getUser, HttpError, json, rateLimit } from '../_shared/common.ts';
import { entitlementFor, requirePremium } from '../_shared/entitlements.ts';
import { newCode, normalizeCode, pretty } from './code.ts';

const PEPPER = Deno.env.get('ACCESS_CODE_PEPPER') ?? '';
const ACTIVE = new Set(['ACTIVE', 'TRIAL', 'PAST_DUE']);
async function hashCode(code: string): Promise<string> {
  const data = new TextEncoder().encode(`mediclaro-access:${PEPPER}:${code}`);
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', data));
  return Array.from(digest, (b) => b.toString(16).padStart(2, '0')).join('');
}

function clientKey(req: Request): string {
  const fwd = req.headers.get('x-forwarded-for') ?? '';
  return `ip:${fwd.split(',')[0].trim() || 'unknown'}`;
}

async function login(req: Request, body: any): Promise<Response> {
  const { data: allowed } = await admin.rpc('hit_access_code_limit', { p_key: clientKey(req), p_max: 10 });
  if (allowed !== true) return fail('Demasiados intentos. Espera unos minutos y vuelve a probar.', 429, 'RATE_LIMITED');

  const code = normalizeCode(body?.code);
  if (!code) return fail('Ese código no es correcto. Revísalo: es como MC-4K7P-9X2Q.', 400, 'CODE_INVALID');
  const { data: row, error } = await admin.from('premium_access_codes')
    .select('user_id').eq('code_hash', await hashCode(code)).maybeSingle();
  if (error) throw error;
  if (!row) return fail('Ese código no es correcto. Revísalo: es como MC-4K7P-9X2Q.', 400, 'CODE_INVALID');

  const ent = await entitlementFor(row.user_id);
  if (ent.plan !== 'premium' || !ACTIVE.has(ent.subState)) {
    return fail('Tu Premium no está en vigor. Entra con tu teléfono para comprobarlo o renovarlo.', 402, 'PREMIUM_INACTIVE');
  }

  const { data: found, error: userError } = await admin.auth.admin.getUserById(row.user_id);
  if (userError || !found?.user) return fail('Ese código no es correcto.', 400, 'CODE_INVALID');
  let email = found.user.email ?? '';
  if (!email) {
    // Dirección interna (nunca recibe correos) solo para poder abrir la sesión con un enlace de un solo uso.
    email = `u-${row.user_id}@acceso.mediclaro.app`;
    const { error: upd } = await admin.auth.admin.updateUserById(row.user_id, { email, email_confirm: true });
    if (upd) throw upd;
  }
  const { data: link, error: linkError } = await admin.auth.admin.generateLink({ type: 'magiclink', email });
  const tokenHash = link?.properties?.hashed_token;
  if (linkError || !tokenHash) throw linkError ?? new Error('no token');
  await admin.from('premium_access_codes').update({ last_used_at: new Date().toISOString() }).eq('user_id', row.user_id);
  return json({ tokenHash });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return fail('Método no permitido', 405);
  if (Number(req.headers.get('content-length') ?? 0) > 4_000) return fail('Petición demasiado grande', 413);
  try {
    const body = await req.json().catch(() => ({}));
    if (body?.action === 'login') return await login(req, body);

    const user = await getUser(req);
    if (!user) return fail('Sesión caducada. Vuelve a entrar.', 401);
    if (!(await rateLimit(user.id, 'access-code', 6))) return fail('Demasiadas peticiones. Espera un momento.', 429);

    if (body?.action === 'status') {
      const { data } = await admin.from('premium_access_codes').select('created_at').eq('user_id', user.id).maybeSingle();
      return json({ hasCode: !!data, createdAt: data?.created_at ?? null });
    }
    if (body?.action === 'issue') {
      if (!user.phone || user.is_anonymous) {
        return fail('Primero confirma tu teléfono para crear tu código.', 403, 'PHONE_REQUIRED');
      }
      await requirePremium(user.id);
      const code = newCode();
      const { error } = await admin.from('premium_access_codes').upsert(
        { user_id: user.id, code_hash: await hashCode(code), created_at: new Date().toISOString(), last_used_at: null },
        { onConflict: 'user_id' },
      );
      if (error) throw error;
      return json({ code: pretty(code) });
    }
    return fail('Acción no válida');
  } catch (e) {
    if (e instanceof HttpError) return fail(e.message, e.status, e.code);
    console.error('access-code', e);
    return fail('Ha ocurrido un error. Inténtalo de nuevo.', 500);
  }
});
