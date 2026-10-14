import { admin, fail, getUser, json } from '../_shared/common.ts';

Deno.serve(async (req) => {
  if (req.method !== 'POST') return fail('Método no permitido', 405);
  const expected = Deno.env.get('QA_ACCESS_TOKEN') ?? '';
  const supplied = req.headers.get('x-qa-access') ?? '';
  if (!expected || supplied !== expected) return fail('Acceso QA no autorizado', 403);

  const user = await getUser(req);
  if (!user) return fail('Sesión requerida', 401);
  if (!user.is_anonymous) return fail('Solo disponible para cuentas QA anónimas', 403);

  const now = new Date();
  const end = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const { data, error } = await admin.from('profiles').upsert({
    id: user.id,
    plan: 'premium',
    sub_state: 'ACTIVE',
    subscription_status: 'active',
    billing_provider: 'stripe',
    current_period_start: now.toISOString(),
    current_period_end: end.toISOString(),
    cancel_at_period_end: false,
  }, { onConflict: 'id' }).select('id, plan, subscription_status').single();
  if (error) throw error;
  if (!data || data.plan !== 'premium' || data.subscription_status !== 'active') return fail('No se pudo activar Premium QA', 500);
  return json({ ok: true, mode: 'qa-premium', premium: true });
});