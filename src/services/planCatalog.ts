/**
 * Catálogo de planes — reglas puras (sin red) para mostrar precios y ventajas de forma veraz.
 *
 *  - Periodos admitidos: mensual, trimestral y anual.
 *  - El ahorro se CALCULA frente al plan mensual del mismo catálogo; nunca se escribe a mano.
 *  - El lema de cada plan («Flexibilidad total», «Ahorra frente al mensual», «El mejor precio») sale de
 *    los propios precios, salvo que el propietario configure otro en `app_config.plans`.
 *  - La etiqueta del plan destacado es «Recomendado» salvo que el propietario configure otra
 *    (p. ej. «Más popular», que solo debe usarse si es cierto).
 */
import type { BillingPeriod, Plan, PlanBenefit } from '../types';

export const PERIOD_MONTHS: Record<BillingPeriod, number> = { monthly: 1, quarterly: 3, annual: 12 };

/** Etiqueta del plan destacado si el propietario no configura otra. */
export const DEFAULT_HIGHLIGHT_BADGE = 'Recomendado';

export function isBillingPeriod(value: unknown): value is BillingPeriod {
  return value === 'monthly' || value === 'quarterly' || value === 'annual';
}

/** «Mensual» · «Trimestral» · «Anual» */
export function periodName(period: BillingPeriod): string {
  return period === 'annual' ? 'Anual' : period === 'quarterly' ? 'Trimestral' : 'Mensual';
}

/** Para frases: «4,99 € al mes» · «12,99 € cada 3 meses» · «39,99 € al año». */
export function perPeriodPhrase(period: BillingPeriod): string {
  return period === 'annual' ? 'al año' : period === 'quarterly' ? 'cada 3 meses' : 'al mes';
}

/** Formato compacto: «/mes» · «/3 meses» · «/año». */
export function perPeriodShort(period: BillingPeriod): string {
  return period === 'annual' ? '/año' : period === 'quarterly' ? '/3 meses' : '/mes';
}

/** Equivalente mensual en céntimos (redondeado). */
export function monthlyEquivalent(priceCents: number, period: BillingPeriod): number {
  return Math.round(priceCents / PERIOD_MONTHS[period]);
}

/**
 * Ahorro (%) frente a pagar el plan mensual durante el mismo tiempo.
 * null si no hay plan mensual con el que comparar o si no hay ahorro real (menos de un 1 %).
 */
export function savingsPercent(plan: Pick<Plan, 'period' | 'priceCents'>, monthly: Pick<Plan, 'priceCents'> | undefined): number | null {
  if (!monthly || plan.period === 'monthly') return null;
  const payingMonthly = monthly.priceCents * PERIOD_MONTHS[plan.period];
  if (payingMonthly <= 0 || plan.priceCents <= 0) return null;
  const pct = Math.round((1 - plan.priceCents / payingMonthly) * 100);
  return pct >= 1 ? pct : null;
}

/** «Ahorra un 33 % aprox.» (con un espacio que no se parte antes del %). */
export function savingsText(pct: number): string {
  return `Ahorra un ${pct} % aprox.`;
}

function cleanText(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

/**
 * Completa cada plan con datos derivados de los precios del catálogo:
 *  - `savingsLabel`: calculado frente al mensual. Si el catálogo no tiene plan mensual, se respeta el configurado.
 *  - `tagline`: el configurado o, si no hay, el que dicen los precios.
 *  - `badge`: solo en el plan destacado y solo si hay más de un plan.
 */
export function decoratePlans(plans: Plan[]): Plan[] {
  const monthly = plans.find((p) => p.period === 'monthly');
  const several = plans.length > 1;
  const lowest = several ? Math.min(...plans.map((p) => p.monthlyEquivalentCents)) : null;
  const lowestIsUnique = lowest !== null && plans.filter((p) => p.monthlyEquivalentCents === lowest).length === 1;

  return plans.map((p) => {
    const pct = savingsPercent(p, monthly);
    const savingsLabel = monthly ? (pct !== null ? savingsText(pct) : null) : cleanText(p.savingsLabel);
    let tagline = cleanText(p.tagline);
    if (!tagline) {
      if (p.period === 'monthly') tagline = 'Flexibilidad total';
      else if (lowestIsUnique && p.monthlyEquivalentCents === lowest) tagline = 'El mejor precio';
      else if (pct !== null) tagline = 'Ahorra frente al mensual';
    }
    const badge = several && p.highlighted ? cleanText(p.badge) ?? DEFAULT_HIGHLIGHT_BADGE : null;
    return { ...p, savingsLabel, tagline, badge };
  });
}

/**
 * Aplica los precios reales de cobro (p. ej. los de la tienda) sin tocar lemas ni etiquetas configurados:
 * recalcula el equivalente mensual y, si hay plan mensual, el ahorro.
 */
export function withEffectivePrices(plans: Plan[], prices: Map<string, number>): Plan[] {
  const effective = plans.map((p) => {
    const price = prices.get(p.id);
    return typeof price === 'number' && price > 0 && price !== p.priceCents
      ? { ...p, priceCents: price, monthlyEquivalentCents: monthlyEquivalent(price, p.period) }
      : p;
  });
  const monthly = effective.find((p) => p.period === 'monthly');
  if (!monthly) return effective;
  return effective.map((p) => {
    if (p.period === 'monthly') return p;
    const pct = savingsPercent(p, monthly);
    return { ...p, savingsLabel: pct !== null ? savingsText(pct) : null };
  });
}

/** «A», «A» y «B», «A», «B» y «C». */
function quotedList(items: string[]): string {
  const q = items.map((i) => `«${i}»`);
  return q.length <= 1 ? q.join('') : `${q.slice(0, -1).join(', ')} y ${q[q.length - 1]}`;
}

/**
 * Aclaración de las ventajas que también son gratis (emergencias, accesibilidad…): se muestran entre las
 * ventajas como en el tablero, pero nunca como si fueran exclusivas de Premium.
 */
export function alwaysFreeNote(benefits: PlanBenefit[]): string | null {
  const free = benefits.filter((b) => b.alwaysFree).map((b) => b.label);
  if (!free.length) return null;
  return `${quotedList(free)} ${free.length > 1 ? 'son' : 'es'} gratis para todos, con o sin Premium.`;
}
