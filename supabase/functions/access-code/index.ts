/**
 * «Ya soy Premium» — código MediClaro personal (11/10/2026).
 *
 *  - action 'status' (con sesión): ¿tiene ya un código?
 *  - action 'issue'  (con sesión, teléfono verificado y Premium en vigor; los propietarios también): crea un código
 *    nuevo (el anterior deja de valer) y lo devuelve UNA vez. Solo se guarda su huella.
 *  - action 'login'  (sin sesión): con el código correcto devuelve una clave de un solo uso con la que la app abre la
 *    sesión de esa persona (sin SMS ni correo), y si su Premium está en vigor. Si no lo está, la app le lleva a
 *    las suscripciones para renovarlo. Intentos limitados por origen.
 * Si olvida el código: entra con su teléfono (SMS) y se le da uno nuevo (si su Premium no está en vigor, va a renovarlo).
 * Sin correo electrónico: la sesión se abre con el teléfono de la cuenta y una clave aleatoria de un solo uso.
 * Opcional: ACCESS_CODE_PEPPER (secreto) para reforzar la huella.
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

  // Si el Premium ya no está en vigor, entra igualmente en SU cuenta y la app le lleva a renovarlo (suscripciones).
  const ent = await entitlementFor(row.user_id);
  const premium = ent.plan === 'premium' && ACTIVE.has(ent.subState);

  const { data: found, error: userError } = await admin.auth.admin.getUserById(row.user_id);
  if (userError || !found?.user?.phone) return fail('Ese código no es correcto.', 400, 'CODE_INVALID');
  // Sin correo: se pone una clave aleatoria de un solo uso a la cuenta (teléfono + clave) y la app abre la sesión con
  // ella. Nadie la conoce y cambia en cada entrada con código.
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  const password = btoa(String.fromCharCode(...bytes)).replace(/[^A-Za-z0-9]/g, '').slice(0, 40) + 'Mc9!';
  const { error: upd } = await admin.auth.admin.updateUserById(row.user_id, { password });
  if (upd) throw upd;
  await admin.from('premium_access_codes').update({ last_used_at: new Date().toISOString() }).eq('user_id', row.user_id);
  const phone = found.user.phone.startsWith('+') ? found.user.phone : `+${found.user.phone}`;
  return json({ phone, password, premium });
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
