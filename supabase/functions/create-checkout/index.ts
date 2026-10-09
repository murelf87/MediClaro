import { admin, fail, handler, json } from '../_shared/common.ts';
import { stripe, PRICE_BASE, PRICE_METERED } from '../_shared/stripe.ts';
import { PERIOD_LABEL, planById } from '../_shared/plans.ts';
import type Stripe from 'npm:stripe@17';

const ALLOWED_RETURN = /^(mediclaro:\/\/|exp:\/\/|https:\/\/)/;

/** Versión de la API de Stripe que incluye Bizum (changelog 2026-05-27.dahlia). Solo para el pago con Bizum. */
const BIZUM_API_VERSION = '2026-05-27.dahlia';

/**
 * Otras formas de pagar la MISMA suscripción mensual (09/10/2026), pensadas para quien no usa tarjeta:
 *  - 'sepa'   → domiciliación bancaria SEPA (el recibo llega al banco, como la luz). Stripe recoge el IBAN y el mandato.
 *  - 'paypal' → PayPal con cobro recurrente (Stripe puede pedir aprobación de PayPal para cobros recurrentes).
 * Cada una hay que activarla antes en Stripe (Ajustes → Métodos de pago) y anunciarla en app_config.plans
 * (`sepaDebit: true`, `paypal: true`). Sin el precio por uso: Premium ya no tiene fotos extra de pago.
 */
const SUBSCRIPTION_METHODS: Record<string, Stripe.Checkout.SessionCreateParams.PaymentMethodType> = {
  sepa: 'sepa_debit',
  paypal: 'paypal',
};

Deno.serve(handler({ bucket: 'checkout', maxPerMinute: 5 }, async (_req, user, body) => {
  const returnUrl = String(body.returnUrl ?? 'mediclaro://subscribe');
  if (!ALLOWED_RETURN.test(returnUrl)) return fail('URL de retorno no válida');
  const bizum = body.method === 'bizum';
  const method = typeof body.method === 'string' ? body.method : 'card';
  if (!bizum && method !== 'card' && !SUBSCRIPTION_METHODS[method]) return fail('Forma de pago no válida', 400, 'METHOD_NOT_AVAILABLE');
  const alternative = SUBSCRIPTION_METHODS[method] ?? null;

  const { data: prof } = await admin.from('profiles').select('*').eq('id', user.id).single();
  // Con Bizum se puede pagar el periodo siguiente antes de que termine el actual (se suma al final).
  const bizumPass = typeof prof?.subscription_id === 'string' && prof.subscription_id.startsWith('bizum-');
  if (prof?.plan === 'premium' && ['active', 'trialing'].includes(prof.subscription_status) && !(bizum && bizumPass))
    return fail('Ya tiene una suscripción activa.', 409);

  let customer = prof?.stripe_customer_id;
  if (!customer) {
    const c = await stripe.customers.create(
      { email: user.email, metadata: { supabase_user_id: user.id } },
      { idempotencyKey: `customer_${user.id}` },
    );
    customer = c.id;
    await admin.from('profiles').update({ stripe_customer_id: customer }).eq('id', user.id);
  }

  if (bizum) {
    // Bizum NO admite cobros recurrentes en Stripe: se paga el periodo elegido de una vez y no se renueva solo.
    // El importe sale del catálogo del servidor (app_config.plans), nunca del teléfono.
    const plan = await planById(body.planId);
    if (!plan) return fail('Este plan no se puede pagar con Bizum ahora mismo.', 400, 'PLAN_NOT_AVAILABLE');
    const meta = { kind: 'bizum', supabase_user_id: user.id, plan_id: plan.id, period: plan.period };
    // `bizum` aún no está en los tipos del SDK 17 (sí en la API 2026-05-27): se declara el tipo a mano.
    const params = {
      mode: 'payment',
      customer,
      client_reference_id: user.id,
      payment_method_types: ['bizum'],
      line_items: [{
        quantity: 1,
        price_data: {
          currency: 'eur',
          unit_amount: plan.priceCents,
          product_data: { name: `MediClaro Premium · ${PERIOD_LABEL[plan.period]} (pago único, sin renovación automática)` },
        },
      }],
      metadata: meta,
      payment_intent_data: { metadata: meta, description: `MediClaro Premium · ${PERIOD_LABEL[plan.period]}` },
      locale: 'es',
      success_url: `${returnUrl}?ok=1`,
      cancel_url: `${returnUrl}?cancel=1`,
    } as unknown as Stripe.Checkout.SessionCreateParams;
    const session = await stripe.checkout.sessions.create(params, { apiVersion: BIZUM_API_VERSION });
    return json({ url: session.url });
  }

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer,
    client_reference_id: user.id,
    line_items: alternative
      ? [{ price: PRICE_BASE, quantity: 1 }] // domiciliación / PayPal: solo la cuota mensual
      : [
          { price: PRICE_BASE, quantity: 1 },  // cuota mensual
          { price: PRICE_METERED },            // pago por uso (fotos extra)
        ],
    ...(alternative ? { payment_method_types: [alternative] } : {}),
    subscription_data: { metadata: { supabase_user_id: user.id, ...(alternative ? { payment_method: method } : {}) } },
    allow_promotion_codes: true,
    billing_address_collection: 'auto',
    automatic_tax: { enabled: Deno.env.get('STRIPE_AUTOMATIC_TAX') === 'true' },
    customer_update: { address: 'auto' },
    locale: 'es',
    success_url: `${returnUrl}?ok=1`,
    cancel_url: `${returnUrl}?cancel=1`,
  });
  return json({ url: session.url });
}));
