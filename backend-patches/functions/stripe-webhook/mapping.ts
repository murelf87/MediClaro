// PROPUESTA (NO APLICADA) · Traducción PURA de una suscripción de Stripe a la fila de `profiles`.
// Sin red ni base de datos, para poder probarla aparte (backend-patches/tests/functions).

export type SubState = 'FREE' | 'TRIAL' | 'ACTIVE' | 'PAST_DUE' | 'CANCELLED' | 'EXPIRED';

/** Estados de Stripe con los que la persona tiene Premium (igual que el webhook original). */
export const PREMIUM_STATUSES: readonly string[] = ['active', 'trialing', 'past_due'];

/** Mismo criterio que el trigger `profiles_sync_sub_state` (migración R-01). */
export function subStateFor(status: string | null | undefined): SubState {
  switch (status) {
    case 'trialing':
      return 'TRIAL';
    case 'active':
      return 'ACTIVE';
    case 'past_due':
      return 'PAST_DUE';
    case 'canceled':
      return 'CANCELLED';
    case 'unpaid':
    case 'incomplete_expired':
      return 'EXPIRED';
    default:
      return 'FREE';
  }
}

interface PeriodLike {
  current_period_start?: number | null;
  current_period_end?: number | null;
}

/** Lo que se usa de `Stripe.Subscription` (el periodo está en la suscripción o, en APIs recientes, en cada línea). */
export interface SubscriptionLike extends PeriodLike {
  id: string;
  status: string;
  cancel_at_period_end?: boolean | null;
  cancel_at?: number | null;
  items?: { data?: PeriodLike[] };
}

export interface ProfileBillingUpdate {
  plan: 'free' | 'premium';
  sub_state: SubState;
  subscription_id: string;
  subscription_status: string;
  cancel_at_period_end: boolean;
  current_period_start: string | null;
  current_period_end: string | null;
  updated_at: string;
}

function iso(seconds: number | null | undefined): string | null {
  return typeof seconds === 'number' && seconds > 0 ? new Date(seconds * 1000).toISOString() : null;
}

export function profileUpdateFor(sub: SubscriptionLike, now: Date = new Date()): ProfileBillingUpdate {
  const premium = PREMIUM_STATUSES.includes(sub.status);
  const item = sub.items?.data?.[0];
  const start = item?.current_period_start ?? sub.current_period_start ?? null;
  const periodEnd = item?.current_period_end ?? sub.current_period_end ?? null;

  // Cancelación programada: «al final del periodo» o en una fecha concreta (`cancel_at`).
  const cancelAt = typeof sub.cancel_at === 'number' && sub.cancel_at > 0 ? sub.cancel_at : null;
  const cancels = premium && (sub.cancel_at_period_end === true || cancelAt !== null);
  // Si la cancelación es ANTES del final del periodo, Premium termina en esa fecha (es la que verá la persona).
  const end = cancels && cancelAt !== null && periodEnd !== null ? Math.min(cancelAt, periodEnd) : periodEnd;

  return {
    plan: premium ? 'premium' : 'free',
    sub_state: subStateFor(sub.status),
    subscription_id: sub.id,
    subscription_status: sub.status,
    cancel_at_period_end: cancels,
    current_period_start: iso(start),
    current_period_end: iso(end),
    updated_at: now.toISOString(),
  };
}
