// Catálogo de planes en el servidor: el MISMO que ve la app (tabla app_config, clave 'plans').
// Los importes que se cobran salen SIEMPRE de aquí, nunca de lo que envía el teléfono.
import { admin } from './common.ts';

export type Period = 'monthly' | 'quarterly' | 'annual';
export const PERIOD_MONTHS: Record<Period, number> = { monthly: 1, quarterly: 3, annual: 12 };
export const PERIOD_LABEL: Record<Period, string> = { monthly: '1 mes', quarterly: '3 meses', annual: '1 año' };

export interface ServerPlan {
  id: string;
  period: Period;
  priceCents: number;
}

function isPeriod(v: unknown): v is Period {
  return typeof v === 'string' && v in PERIOD_MONTHS;
}

/** Plan contratable por su id (`premium_monthly`, …) o null si no existe o no se vende. */
export async function planById(planId: unknown): Promise<ServerPlan | null> {
  if (typeof planId !== 'string' || !/^[\w-]{1,60}$/.test(planId)) return null;
  const { data, error } = await admin.from('app_config').select('value').eq('key', 'plans').maybeSingle();
  if (error) throw error;
  const plans = (data?.value as { plans?: unknown[] } | null)?.plans ?? [];
  for (const raw of plans) {
    const p = raw as { id?: unknown; period?: unknown; priceCents?: unknown; purchasable?: unknown };
    if (p?.id !== planId || p.purchasable === false || !isPeriod(p.period)) continue;
    const cents = Number(p.priceCents);
    // Bizum (Stripe): de 0,50 € a 5.000 € por pago.
    if (!Number.isInteger(cents) || cents < 50 || cents > 500_000) return null;
    return { id: planId, period: p.period, priceCents: cents };
  }
  return null;
}

/** Suma meses a una fecha (fin de mes incluido: 31 ene + 1 mes = 28/29 feb). */
export function addMonths(from: Date, months: number): Date {
  const d = new Date(from.getTime());
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + months);
  const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, last));
  return d;
}
