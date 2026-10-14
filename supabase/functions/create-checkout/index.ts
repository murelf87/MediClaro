import { admin, fail, handler, json } from '../_shared/common.ts';
import { stripe, PRICE_BASE, PRICE_METERED } from '../_shared/stripe.ts';

const ALLOWED_RETURN = /^(mediclaro:\/\/|exp:\/\/|https:\/\/)/;

Deno.serve(handler({ bucket: 'checkout', maxPerMinute: 5 }, async (_req, user, body) => {
  const returnUrl = String(body.returnUrl ?? 'mediclaro://subscribe');
  if (!ALLOWED_RETURN.test(returnUrl)) return fail('URL de retorno no válida');

  const { data: prof } = await admin.from('profiles').select('*').eq('id', user.id).single();
  if (prof?.plan === 'premium' && ['active', 'trialing'].includes(prof.subscription_status))
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

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer,
    client_reference_id: user.id,
    line_items: [
      { price: PRICE_BASE, quantity: 1 },  // cuota mensual
      { price: PRICE_METERED },            // pago por uso (fotos extra)
    ],
    subscription_data: { metadata: { supabase_user_id: user.id } },
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
