// Webhook de Stripe: única fuente de verdad del plan del usuario.
// Desplegar con --no-verify-jwt (Stripe no envía JWT; se verifica la FIRMA).
import { admin } from '../_shared/common.ts';
import { stripe, cryptoProvider } from '../_shared/stripe.ts';
import type Stripe from 'npm:stripe@17';

const SECRET = Deno.env.get('STRIPE_WEBHOOK_SECRET')!;

async function syncSubscription(subId: string) {
  const sub = await stripe.subscriptions.retrieve(subId);
  const userId = sub.metadata?.supabase_user_id;
  const active = ['active', 'trialing', 'past_due'].includes(sub.status);
  const item = sub.items.data[0] as any;
  const start = item?.current_period_start ?? (sub as any).current_period_start;
  const end = item?.current_period_end ?? (sub as any).current_period_end;
  const update = {
    plan: active ? 'premium' : 'free',
    subscription_id: sub.id,
    subscription_status: sub.status,
    current_period_start: start ? new Date(start * 1000).toISOString() : null,
    current_period_end: end ? new Date(end * 1000).toISOString() : null,
    updated_at: new Date().toISOString(),
  };
  const q = admin.from('profiles').update(update);
  const { error } = userId ? await q.eq('id', userId) : await q.eq('stripe_customer_id', sub.customer as string);
  if (error) throw error;
}

Deno.serve(async (req) => {
  const sig = req.headers.get('stripe-signature');
  if (!sig) return new Response('Sin firma', { status: 400 });
  const raw = await req.text();

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(raw, sig, SECRET, undefined, cryptoProvider);
  } catch {
    return new Response('Firma no válida', { status: 400 });
  }

  // Idempotencia: si ya lo procesamos, respondemos OK
  const { error: dup } = await admin.from('stripe_events').insert({ id: event.id, type: event.type });
  if (dup) return new Response('ok (duplicado)', { status: 200 });

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const s = event.data.object as Stripe.Checkout.Session;
        if (s.client_reference_id && s.customer)
          await admin.from('profiles').update({ stripe_customer_id: s.customer as string }).eq('id', s.client_reference_id);
        if (s.subscription) await syncSubscription(s.subscription as string);
        break;
      }
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted':
      case 'customer.subscription.paused':
      case 'customer.subscription.resumed':
        await syncSubscription((event.data.object as Stripe.Subscription).id);
        break;
      case 'invoice.paid':
      case 'invoice.payment_failed': {
        const inv = event.data.object as any;
        const subId = inv.subscription ?? inv.parent?.subscription_details?.subscription;
        if (subId) await syncSubscription(subId);
        break;
      }
    }
  } catch (e) {
    console.error('webhook', event.type, e);
    // Borramos la marca para que Stripe reintente
    await admin.from('stripe_events').delete().eq('id', event.id);
    return new Response('error', { status: 500 });
  }
  return new Response('ok', { status: 200 });
});
