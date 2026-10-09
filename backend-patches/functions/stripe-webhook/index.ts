// Webhook de Stripe: única fuente de verdad del plan del usuario.
// Desplegar con --no-verify-jwt (Stripe no envía JWT; se verifica la FIRMA).
//
// ── PROPUESTA (NO APLICADA) ──────────────────────────────────────────────────────────────────────────
// Cambios respecto a supabase/functions/stripe-webhook/index.ts (marcados con «PARCHE»):
//   · R-01: escribe también `sub_state` (el servidor aplica por fin los límites Premium a quien paga).
//   · R-10: escribe `cancel_at_period_end`; si la cancelación es anterior al fin del periodo, guarda esa fecha.
//   · Idempotencia: solo un duplicado real (23505) se da por procesado; cualquier otro error al registrar el
//     evento devuelve 500 para que Stripe lo reintente (antes respondía 200 y el evento se perdía).
//   · checkout.session.completed: si falla guardar el cliente de Stripe, devuelve 500 (antes se ignoraba).
// Pruebas: backend-patches/tests/functions (deno test).
// ─────────────────────────────────────────────────────────────────────────────────────────────────────
import { admin } from '../_shared/common.ts';
import { stripe, cryptoProvider } from '../_shared/stripe.ts';
import type Stripe from 'npm:stripe@17';
import { profileUpdateFor, type SubscriptionLike } from './mapping.ts';

const SECRET = Deno.env.get('STRIPE_WEBHOOK_SECRET')!;

async function syncSubscription(subId: string) {
  const sub = await stripe.subscriptions.retrieve(subId);
  const userId = sub.metadata?.supabase_user_id;
  // PARCHE R-01 + R-10: plan, sub_state, estado, periodo y cancelación programada.
  const update = profileUpdateFor(sub as unknown as SubscriptionLike);
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
  if (dup) {
    // PARCHE: solo un duplicado real significa «ya procesado».
    if (dup.code === '23505') return new Response('ok (duplicado)', { status: 200 });
    console.error('webhook stripe_events', event.type, dup);
    return new Response('error', { status: 500 });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const s = event.data.object as Stripe.Checkout.Session;
        if (s.client_reference_id && s.customer) {
          const { error } = await admin.from('profiles').update({ stripe_customer_id: s.customer as string }).eq('id', s.client_reference_id);
          if (error) throw error; // PARCHE: antes se ignoraba
        }
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
