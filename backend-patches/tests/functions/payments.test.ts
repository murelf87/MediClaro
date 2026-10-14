// Pruebas de Bizum (pago único) y «Que pague mi familiar o cuidador/a» con las funciones ACTUALES de
// supabase/functions (el script las copia en ../original). Stripe y la base de datos son dobles en memoria.
// deno-lint-ignore-file no-explicit-any
import assert from 'node:assert/strict';
import { reset, state } from './fakes/state.ts';
import { loadFunction } from './load.ts';

Deno.env.set('SUPABASE_URL', 'https://proyecto.supabase.co');

const checkout = await loadFunction('../original/create-checkout/index.ts');
const webhook = await loadFunction('../original/stripe-webhook/index.ts');
const familyPay = await loadFunction('../original/family-pay/index.ts');

const USER = state.user.id;
const PLANS = {
  key: 'plans',
  value: {
    plans: [
      { id: 'premium_monthly', period: 'monthly', priceCents: 499 },
      { id: 'premium_quarterly', period: 'quarterly', priceCents: 1299 },
      { id: 'premium_annual', period: 'annual', priceCents: 3999 },
    ],
  },
};
const DAY = 86_400_000;

function seed(profile: Record<string, any> = {}) {
  reset();
  state.tables.app_config = [structuredClone(PLANS)];
  state.tables.profiles = [{
    id: USER, plan: 'free', subscription_status: null, subscription_id: null, stripe_customer_id: 'cus_me',
    current_period_start: null, current_period_end: null, cancel_at_period_end: false, display_name: 'María García López',
    ...profile,
  }];
  state.tables.family_pay_invites = [];
}
const profile = () => state.tables.profiles[0];
const post = (body: unknown, auth = true) =>
  new Request('http://localhost/functions/v1/x', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(auth ? { Authorization: 'Bearer token' } : {}) },
    body: JSON.stringify(body),
  });
let seq = 0;
const event = (type: string, object: unknown) => {
  seq += 1;
  return new Request('http://localhost/functions/v1/stripe-webhook', {
    method: 'POST',
    headers: { 'stripe-signature': 'firma-valida' },
    body: JSON.stringify({ id: `evt_pay_${seq}`, type, data: { object } }),
  });
};
const bizumSession = (id: string, overrides: Record<string, any> = {}) => ({
  id, mode: 'payment', payment_status: 'paid', customer: 'cus_me', client_reference_id: USER,
  metadata: { kind: 'bizum', supabase_user_id: USER, plan_id: 'premium_quarterly', period: 'quarterly' },
  ...overrides,
});
const monthsFromNow = (iso: string) => (Date.parse(iso) - Date.now()) / (30.44 * DAY);

// ─── create-checkout con Bizum ─────────────────────────────────────────────────────────────────────────

Deno.test('Bizum: pago único en modo payment, solo Bizum, importe del catálogo del servidor y API 2026-05-27', async () => {
  seed();
  const r = await checkout(post({ returnUrl: 'mediclaro://subscribe', planId: 'premium_quarterly', method: 'bizum', amount: 1 }));
  assert.equal(r.status, 200);
  assert.match((await r.json()).url, /^https:\/\/checkout\.stripe\.com/);
  const s = state.checkoutSessions.at(-1);
  assert.equal(s.params.mode, 'payment');
  assert.deepEqual(s.params.payment_method_types, ['bizum']);
  assert.equal(s.params.line_items[0].price_data.unit_amount, 1299, 'el importe sale del catálogo, nunca del teléfono');
  assert.equal(s.params.line_items[0].price_data.currency, 'eur');
  assert.deepEqual(s.params.metadata, { kind: 'bizum', supabase_user_id: USER, plan_id: 'premium_quarterly', period: 'quarterly' });
  assert.equal(s.options.apiVersion, '2026-05-27.dahlia');
});

Deno.test('Bizum: plan inexistente → 400; con suscripción de tarjeta activa → 409; con Bizum vigente se puede renovar', async () => {
  seed();
  assert.equal((await checkout(post({ planId: 'premium_falso', method: 'bizum' }))).status, 400);
  seed({ plan: 'premium', subscription_status: 'active', subscription_id: 'sub_123' });
  assert.equal((await checkout(post({ planId: 'premium_monthly', method: 'bizum' }))).status, 409);
  seed({ plan: 'premium', subscription_status: 'active', subscription_id: 'bizum-cs_old', current_period_end: new Date(Date.now() + 5 * DAY).toISOString() });
  assert.equal((await checkout(post({ planId: 'premium_monthly', method: 'bizum' }))).status, 200);
  // La tarjeta sigue igual que antes (suscripción).
  seed();
  await checkout(post({ returnUrl: 'mediclaro://subscribe' }));
  assert.equal(state.checkoutSessions.at(-1).params.mode, 'subscription');
});

Deno.test('Domiciliación bancaria y PayPal: la misma suscripción mensual, solo con esa forma de pago y sin precio por uso', async () => {
  for (const [method, type] of [['sepa', 'sepa_debit'], ['paypal', 'paypal']] as const) {
    seed();
    const r = await checkout(post({ returnUrl: 'mediclaro://subscribe', method }));
    assert.equal(r.status, 200);
    const s = state.checkoutSessions.at(-1);
    assert.equal(s.params.mode, 'subscription');
    assert.deepEqual(s.params.payment_method_types, [type]);
    assert.equal(s.params.line_items.length, 1, 'solo la cuota mensual');
    assert.equal(s.params.subscription_data.metadata.supabase_user_id, USER);
    assert.equal(s.params.subscription_data.metadata.payment_method, method);
  }
  // Tarjeta: sin cambios (Stripe decide los métodos; incluye el precio por uso).
  seed();
  await checkout(post({ returnUrl: 'mediclaro://subscribe' }));
  assert.equal(state.checkoutSessions.at(-1).params.payment_method_types, undefined);
  assert.equal(state.checkoutSessions.at(-1).params.line_items.length, 2);
  // Formas de pago desconocidas: se rechazan antes de llamar a Stripe.
  seed();
  const before = state.checkoutSessions.length;
  assert.equal((await checkout(post({ method: 'cheque' }))).status, 400);
  assert.equal(state.checkoutSessions.length, before);
});

// ─── Webhook: Bizum ────────────────────────────────────────────────────────────────────────────────────

Deno.test('Webhook Bizum: Premium hasta el final del periodo pagado, sin renovación; un reintento no suma dos veces', async () => {
  seed();
  assert.equal((await webhook(event('checkout.session.completed', bizumSession('cs_b1')))).status, 200);
  assert.equal(profile().plan, 'premium');
  assert.equal(profile().subscription_status, 'active');
  assert.equal(profile().subscription_id, 'bizum-cs_b1');
  assert.equal(profile().cancel_at_period_end, true);
  assert.equal(profile().paid_by_family, false);
  const end = profile().current_period_end;
  assert.ok(Math.abs(monthsFromNow(end) - 3) < 0.15, `3 meses (${monthsFromNow(end).toFixed(2)})`);
  // Otro evento de la misma sesión (p. ej. async_payment_succeeded): no se vuelve a sumar.
  await webhook(event('checkout.session.async_payment_succeeded', bizumSession('cs_b1')));
  assert.equal(profile().current_period_end, end);
});

Deno.test('Webhook Bizum: pagar otra vez con Bizum vigente suma el periodo al final', async () => {
  seed();
  await webhook(event('checkout.session.completed', bizumSession('cs_b1')));
  const first = profile().current_period_end;
  await webhook(event('checkout.session.completed', bizumSession('cs_b2', { metadata: { kind: 'bizum', supabase_user_id: USER, plan_id: 'premium_monthly', period: 'monthly' } })));
  assert.equal(profile().subscription_id, 'bizum-cs_b2');
  assert.ok(Math.abs(monthsFromNow(profile().current_period_end) - 4) < 0.15, 'tres meses + uno');
  assert.ok(Date.parse(profile().current_period_end) > Date.parse(first));
});

Deno.test('Webhook Bizum: sin pagar todavía no activa nada; al confirmarse el pago, sí', async () => {
  seed();
  await webhook(event('checkout.session.completed', bizumSession('cs_b3', { payment_status: 'unpaid' })));
  assert.equal(profile().plan, 'free');
  await webhook(event('checkout.session.async_payment_succeeded', bizumSession('cs_b3')));
  assert.equal(profile().plan, 'premium');
});

Deno.test('Webhook: un aviso tardío de una suscripción antigua no quita un Premium de Bizum vigente', async () => {
  seed({ plan: 'premium', subscription_status: 'active', subscription_id: 'bizum-cs_x', current_period_end: new Date(Date.now() + 20 * DAY).toISOString() });
  state.subscriptions.sub_old = { id: 'sub_old', status: 'canceled', customer: 'cus_me', metadata: { supabase_user_id: USER }, items: { data: [{}] } };
  assert.equal((await webhook(event('customer.subscription.deleted', { id: 'sub_old' }))).status, 200);
  assert.equal(profile().plan, 'premium');
  assert.equal(profile().subscription_id, 'bizum-cs_x');
});

// ─── «Que pague mi familiar o cuidador/a» ──────────────────────────────────────────────────────────────

async function createInvite() {
  const r = await familyPay(post({ action: 'create', planId: 'premium_monthly' }));
  assert.equal(r.status, 200);
  return await r.json();
}
const open = (url: string) => familyPay(new Request(url, { method: 'GET' }));

Deno.test('Familiar: crear el enlace guarda solo su huella, anula el anterior y da el nombre de pila', async () => {
  seed();
  const first = await createInvite();
  const second = await createInvite();
  assert.match(second.url, /^https:\/\/proyecto\.supabase\.co\/functions\/v1\/family-pay\?t=[A-Za-z0-9_-]{30,}$/);
  assert.equal(second.beneficiaryName, 'María');
  const token = new URL(second.url).searchParams.get('t')!;
  const rows = state.tables.family_pay_invites;
  assert.equal(rows.length, 2);
  assert.ok(rows.every((r: any) => /^[0-9a-f]{64}$/.test(r.token_hash) && r.token_hash !== token), 'nunca se guarda el enlace');
  assert.ok(rows[0].revoked_at, 'la invitación anterior queda anulada');
  assert.equal(rows[1].revoked_at ?? null, null);
  assert.equal((await open(first.url)).status, 410, 'el enlace anterior ya no sirve');
});

Deno.test('Familiar: sin sesión → 401; con Premium activo → 409', async () => {
  seed();
  assert.equal((await familyPay(post({ action: 'create', planId: 'premium_monthly' }, false))).status, 401);
  seed({ plan: 'premium', subscription_status: 'active' });
  assert.equal((await familyPay(post({ action: 'create', planId: 'premium_monthly' }))).status, 409);
});

Deno.test('Familiar: abrir el enlace lleva a Stripe (suscripción de la persona mayor) y reutiliza la página abierta', async () => {
  seed();
  const invite = await createInvite();
  const r = await open(invite.url);
  assert.equal(r.status, 303);
  const s = state.checkoutSessions.at(-1);
  assert.equal(r.headers.get('Location'), s.url);
  assert.equal(s.params.mode, 'subscription');
  assert.equal(s.params.client_reference_id, USER);
  assert.equal(s.params.subscription_data.metadata.supabase_user_id, USER);
  assert.equal(s.params.subscription_data.metadata.paid_by, 'family');
  assert.equal(s.params.metadata.kind, 'family');
  assert.equal(s.params.customer, undefined, 'el cliente de Stripe será el familiar, no la persona mayor');
  assert.match(s.params.custom_text.submit.message, /de María\. María disfrutará.*No verás sus conversaciones ni su información médica/);
  assert.match(s.params.success_url, /&done=1$/);
  const again = await open(invite.url);
  assert.equal(again.status, 303);
  assert.equal(state.checkoutSessions.length, 1, 'no se crea otra página de pago');
  const done = await open(`${invite.url}&done=1`);
  assert.equal(done.status, 200);
  assert.match(await done.text(), /Gracias.*María/s);
});

Deno.test('Familiar: enlace caducado, inválido o persona que ya tiene Premium → aviso claro sin pago', async () => {
  seed();
  const invite = await createInvite();
  state.tables.family_pay_invites[0].expires_at = new Date(Date.now() - DAY).toISOString();
  assert.equal((await open(invite.url)).status, 410);
  assert.equal((await open('https://proyecto.supabase.co/functions/v1/family-pay?t=corto')).status, 400);
  seed();
  const ok = await createInvite();
  profile().plan = 'premium';
  profile().subscription_status = 'active';
  const r = await open(ok.url);
  assert.equal(r.status, 200);
  assert.match(await r.text(), /ya tiene MediClaro Premium/);
  assert.equal(state.checkoutSessions.length, 0);
});

Deno.test('Webhook familiar: Premium en la cuenta de la persona mayor, marca «lo paga un familiar» y no guarda el cliente del familiar', async () => {
  seed({ stripe_customer_id: null });
  const invite = await createInvite();
  const inviteId = state.tables.family_pay_invites[0].id;
  state.subscriptions.sub_fam = {
    id: 'sub_fam', status: 'active', customer: 'cus_familiar',
    metadata: { supabase_user_id: USER, paid_by: 'family', family_invite: inviteId },
    items: { data: [{ current_period_start: Math.floor(Date.now() / 1000), current_period_end: Math.floor(Date.now() / 1000) + 30 * 86_400 }] },
  };
  const r = await webhook(event('checkout.session.completed', {
    id: 'cs_fam', mode: 'subscription', customer: 'cus_familiar', client_reference_id: USER, subscription: 'sub_fam',
    metadata: { kind: 'family', family_invite: inviteId, supabase_user_id: USER },
  }));
  assert.equal(r.status, 200);
  assert.equal(profile().plan, 'premium');
  assert.equal(profile().paid_by_family, true);
  assert.equal(profile().stripe_customer_id, null, 'la tarjeta y las facturas del familiar no quedan en la cuenta');
  assert.ok(state.tables.family_pay_invites[0].paid_at, 'invitación marcada como pagada');
  assert.ok(invite.url);
});
