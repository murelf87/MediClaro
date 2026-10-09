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
//
// 09/10/2026 · Bizum y «Que pague mi familiar o cuidador/a» (requiere la migración 20261009100000 antes de desplegar):
//   · Bizum (pago único, Stripe no admite Bizum recurrente): checkout.session.completed con metadata.kind = 'bizum'
//     → Premium hasta la fecha pagada (se suma al final si ya tenía Bizum), sin renovación; un cron lo caduca.
//   · Familiar: la suscripción es de la persona mayor (metadata.supabase_user_id) aunque pague otra persona; el
//     cliente de Stripe del familiar NO se guarda en su cuenta y se marca `paid_by_family`.
// ─────────────────────────────────────────────────────────────────────────────────────────────────────
import { admin } from '../_shared/common.ts';
import { stripe, cryptoProvider } from '../_shared/stripe.ts';
import { PERIOD_MONTHS, addMonths, type Period } from '../_shared/plans.ts';
import type Stripe from 'npm:stripe@17';
import { profileUpdateFor, type SubscriptionLike } from './mapping.ts';

const SECRET = Deno.env.get('STRIPE_WEBHOOK_SECRET')!;

const isBizumPass = (subscriptionId: unknown, end: unknown, now = Date.now()) =>
  typeof subscriptionId === 'string' && subscriptionId.startsWith('bizum-') && typeof end === 'string' && Date.parse(end) > now;

async function syncSubscription(subId: string) {
  const sub = await stripe.subscriptions.retrieve(subId);
  const userId = sub.metadata?.supabase_user_id;
  // PARCHE R-01 + R-10: plan, sub_state, estado, periodo y cancelación programada.
  const update = { ...profileUpdateFor(sub as unknown as SubscriptionLike), paid_by_family: sub.metadata?.paid_by === 'family' };
  if (update.plan !== 'premium') {
    // Un aviso tardío de una suscripción antigua no quita un Premium pagado con Bizum que sigue vigente.
    const current = userId
      ? await admin.from('profiles').select('subscription_id, current_period_end').eq('id', userId).maybeSingle()
      : await admin.from('profiles').select('subscription_id, current_period_end').eq('stripe_customer_id', sub.customer as string).maybeSingle();
    if (current.error) throw current.error;
    if (isBizumPass(current.data?.subscription_id, current.data?.current_period_end)) return;
  }
  const q = admin.from('profiles').update(update);
  const { error } = userId ? await q.eq('id', userId) : await q.eq('stripe_customer_id', sub.customer as string);
  if (error) throw error;
}

/** Pago con Bizum completado: Premium hasta el final del periodo pagado (encadenado si ya tenía Bizum). */
async function grantBizum(s: Stripe.Checkout.Session) {
  const userId = s.metadata?.supabase_user_id ?? s.client_reference_id;
  const months = PERIOD_MONTHS[s.metadata?.period as Period];
  if (!userId || !months) throw new Error(`Pago con Bizum sin persona o periodo: ${s.id}`);
  const marker = `bizum-${s.id}`;
  const { data: prof, error } = await admin
    .from('profiles')
    .select('plan, subscription_id, current_period_start, current_period_end, stripe_customer_id')
    .eq('id', userId)
    .single();
  if (error) throw error;
  if (prof.subscription_id === marker) return; // ya aplicado
  const now = new Date();
  const chained = prof.plan === 'premium' && isBizumPass(prof.subscription_id, prof.current_period_end, now.getTime());
  const start = chained ? new Date(prof.current_period_end) : now;
  const { error: upError } = await admin.from('profiles').update({
    plan: 'premium',
    subscription_status: 'active',
    subscription_id: marker,
    billing_provider: 'stripe',
    cancel_at_period_end: true, // no se renueva solo
    current_period_start: chained && prof.current_period_start ? prof.current_period_start : now.toISOString(),
    current_period_end: addMonths(start, months).toISOString(),
    paid_by_family: false,
    updated_at: now.toISOString(),
    ...(s.customer && !prof.stripe_customer_id ? { stripe_customer_id: s.customer as string } : null),
  }).eq('id', userId);
  if (upError) throw upError;
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
      case 'checkout.session.completed':
      case 'checkout.session.async_payment_succeeded': {
        const s = event.data.object as Stripe.Checkout.Session;
        if (s.metadata?.kind === 'bizum') {
          if (s.payment_status === 'paid') await grantBizum(s);
          break;
        }
        const family = s.metadata?.kind === 'family';
        // Si paga un familiar, su cliente de Stripe (tarjeta, facturas) no se guarda en la cuenta de la persona mayor.
        if (!family && s.client_reference_id && s.customer) {
          const { error } = await admin.from('profiles').update({ stripe_customer_id: s.customer as string }).eq('id', s.client_reference_id);
          if (error) throw error; // PARCHE: antes se ignoraba
        }
        if (family && s.metadata?.family_invite) {
          const { error } = await admin.from('family_pay_invites').update({ paid_at: new Date().toISOString() }).eq('id', s.metadata.family_invite);
          if (error) throw error;
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
