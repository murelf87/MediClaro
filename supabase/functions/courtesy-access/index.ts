import { admin, cors, fail, getUser, json, rateLimit } from '../_shared/common.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return fail('Método no permitido', 405);

  const user = await getUser(req);
  if (!user) return fail('Sesión requerida', 401);
  if (!user.is_anonymous) return fail('Este acceso requiere una cuenta nueva', 409);
  if (!(await rateLimit(user.id, 'courtesy-access', 5))) {
    return fail('Demasiados intentos. Espera un momento.', 429);
  }

  const body = await req.json().catch(() => ({}));
  const number = String(body?.number ?? '').replace(/\D+/g, '');
  const password = String(body?.password ?? '');
  const expectedNumber = String(Deno.env.get('COURTESY_ACCESS_NUMBER') ?? '').replace(/\D+/g, '');
  const expectedPassword = String(Deno.env.get('COURTESY_ACCESS_PASSWORD') ?? '');

  if (!expectedNumber || !expectedPassword) return fail('Acceso de cortesía no configurado', 503);
  if (number !== expectedNumber || password !== expectedPassword) {
    return fail('Número o contraseña incorrectos', 403);
  }
  const now = new Date();
  const end = new Date('2099-12-31T23:59:59.000Z');
  const { error } = await admin.from('profiles').update({
    plan: 'premium',
    subscription_status: 'active',
    billing_provider: 'stripe',
    subscription_id: `courtesy-${user.id}`,
    current_period_start: now.toISOString(),
    current_period_end: end.toISOString(),
    cancel_at_period_end: false,
    updated_at: now.toISOString(),
  }).eq('id', user.id);

  if (error) {
    console.error('courtesy-access', error);
    return fail('No hemos podido activar Premium de cortesía', 500);
  }

  return json({
    ok: true,
    mode: 'courtesy-premium',
    isPremium: true,
    currentPeriodEnd: end.toISOString(),
  });
});
