// Pruebas del webhook de Stripe: ORIGINAL (supabase/functions) frente a PROPUESTA (backend-patches/functions).
// Stripe y la base de datos son dobles en memoria (fakes/): no hay red ni claves.
import assert from 'node:assert/strict';
import { callsTo, reset, state } from './fakes/state.ts';
import { loadFunction } from './load.ts';

const original = await loadFunction('../original/stripe-webhook/index.ts');
const patched = await loadFunction('../patched/stripe-webhook/index.ts');

const USER = '00000000-0000-4000-8000-0000000000aa';
const T0 = 1_790_000_000; // segundos (2026)
const DAY = 86_400;

function seedProfile() {
  state.tables.profiles = [
    { id: USER, plan: 'free', subscription_status: null, sub_state: 'FREE', stripe_customer_id: 'cus_1', cancel_at_period_end: false },
  ];
}

// deno-lint-ignore no-explicit-any
function subscription(overrides: Record<string, any> = {}) {
  return {
    id: 'sub_1',
    status: 'active',
    customer: 'cus_1',
    metadata: { supabase_user_id: USER },
    cancel_at_period_end: false,
    cancel_at: null,
    items: { data: [{ current_period_start: T0, current_period_end: T0 + 30 * DAY }] },
    ...overrides,
  };
}

let seq = 0;
function stripeEvent(type: string, object: unknown, sig = 'firma-valida') {
  seq += 1;
  return new Request('http://localhost/functions/v1/stripe-webhook', {
    method: 'POST',
    headers: { 'stripe-signature': sig },
    body: JSON.stringify({ id: `evt_${seq}`, type, data: { object } }),
  });
}

const profile = () => state.tables.profiles[0];
const iso = (s: number) => new Date(s * 1000).toISOString();

function setup(sub = subscription()) {
  reset();
  seedProfile();
  state.subscriptions[sub.id] = sub;
}

Deno.test('R-01: suscripción activa → plan premium y sub_state ACTIVE (el original deja sub_state en FREE)', async () => {
  setup();
  const r1 = await original(stripeEvent('customer.subscription.updated', { id: 'sub_1' }));
  assert.equal(r1.status, 200);
  assert.equal(profile().plan, 'premium');
  assert.equal(profile().sub_state, 'FREE', 'ORIGINAL: el servidor seguiría aplicando el plan gratuito');

  setup();
  const r2 = await patched(stripeEvent('customer.subscription.updated', { id: 'sub_1' }));
  assert.equal(r2.status, 200);
  assert.equal(profile().plan, 'premium');
  assert.equal(profile().sub_state, 'ACTIVE');
  assert.equal(profile().subscription_status, 'active');
  assert.equal(profile().current_period_start, iso(T0));
  assert.equal(profile().current_period_end, iso(T0 + 30 * DAY));
  assert.equal(profile().cancel_at_period_end, false);
});

Deno.test('R-10: cancelar al final del periodo → cancel_at_period_end = true y sigue Premium (el original no lo escribe)', async () => {
  const sub = subscription({ cancel_at_period_end: true, cancel_at: T0 + 30 * DAY });
  setup(sub);
  await original(stripeEvent('customer.subscription.updated', { id: 'sub_1' }));
  assert.equal(profile().cancel_at_period_end, false, 'ORIGINAL: la app seguiría diciendo «Se renueva el …»');

  setup(sub);
  await patched(stripeEvent('customer.subscription.updated', { id: 'sub_1' }));
  assert.equal(profile().cancel_at_period_end, true);
  assert.equal(profile().plan, 'premium');
  assert.equal(profile().sub_state, 'ACTIVE');
  assert.equal(profile().current_period_end, iso(T0 + 30 * DAY));
});

Deno.test('R-10: cancelación programada ANTES del fin del periodo → se guarda esa fecha como fin', async () => {
  setup(subscription({ cancel_at: T0 + 10 * DAY }));
  await patched(stripeEvent('customer.subscription.updated', { id: 'sub_1' }));
  assert.equal(profile().cancel_at_period_end, true);
  assert.equal(profile().current_period_end, iso(T0 + 10 * DAY));
});

Deno.test('suscripción terminada (deleted / canceled) → plan gratuito, CANCELLED y sin cancelación pendiente', async () => {
  setup(subscription({ status: 'canceled', cancel_at_period_end: true }));
  const r = await patched(stripeEvent('customer.subscription.deleted', { id: 'sub_1' }));
  assert.equal(r.status, 200);
  assert.equal(profile().plan, 'free');
  assert.equal(profile().sub_state, 'CANCELLED');
  assert.equal(profile().cancel_at_period_end, false);
});

Deno.test('pago fallido (past_due) → sigue Premium como PAST_DUE; vale el formato antiguo y el nuevo de la factura', async () => {
  setup(subscription({ status: 'past_due' }));
  await patched(stripeEvent('invoice.payment_failed', { subscription: 'sub_1' }));
  assert.equal(profile().sub_state, 'PAST_DUE');
  assert.equal(profile().plan, 'premium');

  setup(subscription({ status: 'unpaid' }));
  await patched(stripeEvent('invoice.payment_failed', { parent: { subscription_details: { subscription: 'sub_1' } } }));
  assert.equal(profile().sub_state, 'EXPIRED');
  assert.equal(profile().plan, 'free');
});

Deno.test('periodo en la propia suscripción (versiones antiguas de la API) → también se guarda', async () => {
  setup(subscription({ items: { data: [{}] }, current_period_start: T0, current_period_end: T0 + 31 * DAY }));
  await patched(stripeEvent('customer.subscription.created', { id: 'sub_1' }));
  assert.equal(profile().current_period_start, iso(T0));
  assert.equal(profile().current_period_end, iso(T0 + 31 * DAY));
});

Deno.test('sin supabase_user_id en la suscripción → se localiza a la persona por su cliente de Stripe', async () => {
  setup(subscription({ metadata: {} }));
  await patched(stripeEvent('customer.subscription.updated', { id: 'sub_1' }));
  assert.equal(profile().sub_state, 'ACTIVE');
  assert.deepEqual(callsTo('profiles', 'update')[0].filters, ['stripe_customer_id=cus_1']);
});

Deno.test('checkout completado → guarda el cliente de Stripe y activa Premium', async () => {
  setup();
  state.tables.profiles[0].stripe_customer_id = null;
  const r = await patched(
    stripeEvent('checkout.session.completed', { client_reference_id: USER, customer: 'cus_1', subscription: 'sub_1' }),
  );
  assert.equal(r.status, 200);
  assert.equal(profile().stripe_customer_id, 'cus_1');
  assert.equal(profile().sub_state, 'ACTIVE');
});

Deno.test('evento repetido (23505) → 200 sin volver a procesarlo', async () => {
  setup();
  state.failNext['stripe_events:insert'] = { code: '23505', message: 'duplicate key value' };
  const r = await patched(stripeEvent('customer.subscription.updated', { id: 'sub_1' }));
  assert.equal(r.status, 200);
  assert.equal(await r.text(), 'ok (duplicado)');
  assert.equal(callsTo('profiles', 'update').length, 0);
});

Deno.test('si no se puede registrar el evento (no es duplicado) → 500 para que Stripe reintente (el original lo perdía)', async () => {
  setup();
  state.failNext['stripe_events:insert'] = { code: '08006', message: 'connection failure' };
  const r1 = await original(stripeEvent('customer.subscription.updated', { id: 'sub_1' }));
  assert.equal(r1.status, 200, 'ORIGINAL: responde OK y Stripe no reintenta');
  assert.equal(profile().plan, 'free', 'ORIGINAL: el pago no se refleja nunca');

  setup();
  state.failNext['stripe_events:insert'] = { code: '08006', message: 'connection failure' };
  const r2 = await patched(stripeEvent('customer.subscription.updated', { id: 'sub_1' }));
  assert.equal(r2.status, 500);
  // Reintento de Stripe: ya funciona
  const r3 = await patched(stripeEvent('customer.subscription.updated', { id: 'sub_1' }));
  assert.equal(r3.status, 200);
  assert.equal(profile().sub_state, 'ACTIVE');
});

Deno.test('si falla guardar el perfil → 500 y se borra la marca del evento (Stripe reintenta)', async () => {
  setup();
  state.failNext['profiles:update'] = { code: '57014', message: 'timeout' };
  const r = await patched(stripeEvent('customer.subscription.updated', { id: 'sub_1' }));
  assert.equal(r.status, 500);
  assert.equal(callsTo('stripe_events', 'delete').length, 1);
  assert.equal((state.tables.stripe_events ?? []).length, 0);
});

Deno.test('checkout: si falla guardar el cliente de Stripe → 500 (el original lo ignoraba)', async () => {
  setup();
  state.failNext['profiles:update'] = { code: '57014', message: 'timeout' };
  const r1 = await original(stripeEvent('checkout.session.completed', { client_reference_id: USER, customer: 'cus_9' }));
  assert.equal(r1.status, 200, 'ORIGINAL: el cliente de Stripe no queda guardado y no se reintenta');

  setup();
  state.failNext['profiles:update'] = { code: '57014', message: 'timeout' };
  const r2 = await patched(stripeEvent('checkout.session.completed', { client_reference_id: USER, customer: 'cus_9' }));
  assert.equal(r2.status, 500);
});

Deno.test('firma no válida o ausente → 400 sin tocar nada', async () => {
  setup();
  const bad = await patched(stripeEvent('customer.subscription.updated', { id: 'sub_1' }, 'firma-falsa'));
  assert.equal(bad.status, 400);
  const none = await patched(new Request('http://localhost/', { method: 'POST', body: '{}' }));
  assert.equal(none.status, 400);
  assert.equal(state.calls.length, 0);
});
