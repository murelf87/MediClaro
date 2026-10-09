/**
 * Catálogo de planes — RESPALDO LOCAL.
 *
 * Fuente preferente: Supabase `app_config` (key = 'plans'), editable por el propietario sin publicar una
 * versión nueva (ver BACKEND_REQUIREMENTS.md → R-12). Si esa fila no existe, se usa este respaldo con los
 * precios decididos por el propietario (IVA incluido):
 *   - Mensual:    4,99 € / mes
 *   - Trimestral: 12,99 € / 3 meses
 *   - Anual:      39,99 € / año (plan destacado)
 *
 * NUNCA se muestra un plan que no se pueda cobrar: PurchaseService solo ofrece cada plan por las vías que
 * pueden cobrarlo de verdad (tienda con sus productos creados y comprobación en el servidor; tarjeta solo
 * para el mensual mientras `create-checkout` no acepte otros planes). Si ninguna vía puede, el plan no aparece.
 */
import type { BillingPeriod, Plan, PlanBenefit, StoreProductRefs } from '../types';

export const FALLBACK_PROVIDER_LABEL = 'Stripe';

/**
 * Identificadores de producto en las tiendas si `app_config.plans` no indica otros.
 * El propietario debe crear EXACTAMENTE estos productos (o configurar los suyos en app_config):
 *  - App Store Connect: 3 suscripciones auto-renovables en un mismo grupo.
 *  - Google Play Console: 1 suscripción `mediclaro_premium` con 3 planes base.
 */
export const DEFAULT_STORE_PRODUCTS: Record<BillingPeriod, StoreProductRefs> = {
  monthly: {
    apple: { productId: 'com.mediclaro.app.premium.monthly' },
    google: { productId: 'mediclaro_premium', basePlanId: 'monthly' },
  },
  quarterly: {
    apple: { productId: 'com.mediclaro.app.premium.quarterly' },
    google: { productId: 'mediclaro_premium', basePlanId: 'quarterly' },
  },
  annual: {
    apple: { productId: 'com.mediclaro.app.premium.annual' },
    google: { productId: 'mediclaro_premium', basePlanId: 'annual' },
  },
};

function plan(id: string, period: BillingPeriod, priceCents: number, highlighted: boolean): Plan {
  return {
    id,
    name: 'MediClaro Premium',
    period,
    priceCents,
    currency: 'EUR',
    monthlyEquivalentCents: priceCents,
    savingsLabel: null,
    tagline: null,
    badge: null,
    terms: ['IVA incluido.'],
    highlighted,
    purchasable: true,
    store: DEFAULT_STORE_PRODUCTS[period],
  };
}

export const FALLBACK_PLANS: Plan[] = [
  plan('premium_monthly', 'monthly', 499, false),
  plan('premium_quarterly', 'quarterly', 1299, false),
  plan('premium_annual', 'annual', 3999, true),
];

/**
 * Identificaciones ILIMITADAS con Premium mientras dure la suscripción (decisión del propietario, 08/10/2026).
 * Lo decide el servidor (`plan_config`): a partir de este número de identificaciones incluidas al mes el plan se
 * trata como ilimitado y la app deja de mostrar contadores. El cambio del servidor está en
 * supabase/migrations/20261008200000_premium_unlimited_scans.sql (1.000.000 al mes y sin pago por uso).
 * Mientras no se aplique, la app sigue enseñando el uso real que cobra el servidor: nunca oculta un cargo.
 */
export const UNLIMITED_SCANS_FROM = 100_000;

export function isUnlimitedScans(included: number | null | undefined): boolean {
  return typeof included === 'number' && included >= UNLIMITED_SCANS_FROM;
}

/** Precio del uso adicional por identificación (céntimos). Refleja scripts/setup-stripe.mjs (solo pago con tarjeta). */
export const FALLBACK_OVERAGE_CENTS = 5;

/**
 * Ventajas de Premium (tablero del propietario, con sus mismos textos). Todas existen en la app.
 * Las emergencias (y el 112) y la accesibilidad NUNCA se bloquean: se marcan `alwaysFree` y la pantalla de
 * planes lo dice expresamente («gratis para todos, con o sin Premium»), para que la oferta no induzca a error.
 */
export const PREMIUM_BENEFITS: PlanBenefit[] = [
  { id: 'assistant', label: 'Asistente IA', detail: 'Haz tus preguntas y recibe explicaciones sencillas.' },
  { id: 'medicines', label: 'Tus medicamentos', detail: 'Guárdalos y organízalos fácilmente.' },
  { id: 'identify', label: 'Identificación de medicamentos', detail: 'Fotografía una caja y obtén su información.' },
  { id: 'emergency', label: 'Emergencias y ubicación', detail: 'Muestra tu ubicación actual cuando la necesites.', alwaysFree: true },
  { id: 'voice', label: 'Lectura por voz', detail: 'Escucha la información en lugar de leerla.' },
  { id: 'accessibility', label: 'Funciones de accesibilidad', detail: 'Texto grande, modo sencillo y más opciones.', alwaysFree: true },
];
