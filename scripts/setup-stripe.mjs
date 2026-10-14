// Crea en Stripe (modo test o live, según la clave) todo lo necesario:
// medidor de uso, producto, precio mensual, precio por uso, portal y webhook.
// Uso:  STRIPE_SECRET_KEY=sk_test_... SUPABASE_URL=https://xxx.supabase.co node scripts/setup-stripe.mjs
import Stripe from 'stripe';

const key = process.env.STRIPE_SECRET_KEY;
const supabaseUrl = process.env.SUPABASE_URL;
if (!key || !supabaseUrl) { console.error('Faltan STRIPE_SECRET_KEY o SUPABASE_URL'); process.exit(1); }
const stripe = new Stripe(key);
const EVENT = 'mediclaro_escaneo_extra';

const meters = await stripe.billing.meters.list({ status: 'active' });
const meter = meters.data.find(m => m.event_name === EVENT) ?? await stripe.billing.meters.create({
  display_name: 'Fotos extra MediClaro',
  event_name: EVENT,
  default_aggregation: { formula: 'sum' },
  customer_mapping: { type: 'by_id', event_payload_key: 'stripe_customer_id' },
  value_settings: { event_payload_key: 'value' },
});

const product = await stripe.products.create({
  name: 'MediClaro Premium',
  description: '100 fotos de medicamentos al mes, asistente ilimitada y fotos extra a 0,05 €.',
});

const base = await stripe.prices.create({
  product: product.id, currency: 'eur', unit_amount: 499,
  recurring: { interval: 'month', usage_type: 'licensed' },
  nickname: 'Cuota mensual', tax_behavior: 'inclusive',
});

const metered = await stripe.prices.create({
  product: product.id, currency: 'eur', unit_amount: 5,
  recurring: { interval: 'month', usage_type: 'metered', meter: meter.id },
  nickname: 'Foto extra', tax_behavior: 'inclusive',
});

await stripe.billingPortal.configurations.create({
  business_profile: { headline: 'Gestione su suscripción de MediClaro' },
  features: {
    invoice_history: { enabled: true },
    payment_method_update: { enabled: true },
    customer_update: { enabled: true, allowed_updates: ['email', 'address', 'tax_id'] },
    subscription_cancel: { enabled: true, mode: 'at_period_end', cancellation_reason: { enabled: true, options: ['too_expensive', 'unused', 'other'] } },
  },
  default_return_url: 'https://mediclaro.app',
});

const wh = await stripe.webhookEndpoints.create({
  url: `${supabaseUrl}/functions/v1/stripe-webhook`,
  enabled_events: [
    'checkout.session.completed',
    'customer.subscription.created', 'customer.subscription.updated', 'customer.subscription.deleted',
    'customer.subscription.paused', 'customer.subscription.resumed',
    'invoice.paid', 'invoice.payment_failed',
  ],
});

console.log('\n✅ Stripe configurado. Guarde estos secretos en Supabase:\n');
console.log(`supabase secrets set STRIPE_PRICE_BASE=${base.id} STRIPE_PRICE_METERED=${metered.id} STRIPE_METER_EVENT=${EVENT} STRIPE_WEBHOOK_SECRET=${wh.secret}`);
