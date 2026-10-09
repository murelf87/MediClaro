/**
 * SubscriptionService — catálogo de planes y estado de la suscripción (sin pagos).
 *
 * Los pagos los hace PurchaseService (compra integrada de Apple/Google o página segura de Stripe).
 * El frontend nunca ve ni guarda datos de tarjeta.
 *
 * Backend usado (sin modificarlo):
 *  - tabla `profiles` (fila propia): plan, subscription_status, current_period_end, billing_provider
 *    ⚠ Se lee `plan` y no `sub_state` porque el webhook nunca escribe `sub_state`
 *      (defecto documentado en BACKEND_REQUIREMENTS.md → P0).
 *  - RPC `get_account_status()` → uso del mes (identificaciones)
 *  - tabla `plan_config` (lectura pública) → límites por plan
 *  - tabla `app_config` key 'plans' (lectura pública, OPCIONAL) → catálogo de precios y productos de tienda
 *  - Edge Function `customer-portal` { returnUrl } → { url } (gestionar una suscripción pagada con tarjeta)
 */
import { Platform } from 'react-native';
import * as Linking from 'expo-linking';
import { paymentReturnUrl } from './billing/returnUrl';
import * as WebBrowser from 'expo-web-browser';
import { supabase, invokeFunction, requireUserId, dbError, AppError, toAppError } from '../api';
import { DEFAULT_STORE_PRODUCTS, FALLBACK_PLANS, FALLBACK_PROVIDER_LABEL, PREMIUM_BENEFITS, isUnlimitedScans } from '../config/plans';
import { PURCHASES_ENABLED } from '../config/app';
import { DemoMode } from './DemoMode';
import { decoratePlans, isBillingPeriod, monthlyEquivalent } from './planCatalog';
import type {
  Plan,
  PlanBenefit,
  PlanLimits,
  PlansCatalog,
  PurchaseOutcome,
  RestoreOutcome,
  StoreProductRefs,
  Subscription,
  SubscriptionStatus,
} from '../types';

const STATUSES: SubscriptionStatus[] = ['active', 'trialing', 'past_due', 'canceled', 'unpaid', 'incomplete', 'paused'];

interface RawProfileBilling {
  plan: 'free' | 'premium' | null;
  subscription_status: string | null;
  current_period_end: string | null;
  billing_provider: 'stripe' | 'apple' | 'google' | null;
  cancel_at_period_end?: boolean | null;
}

interface RawAccountStatus {
  /** Plan que APLICA el servidor a los límites (calculado con `sub_state`). */
  plan?: 'free' | 'premium';
  owner_access?: boolean;
  courtesy_access?: boolean;
  /** 'bizum' (pago único por periodo) o 'subscription'. */
  payment_kind?: string | null;
  paid_by_family?: boolean;
  scans_this_period?: number;
  included_scans?: number;
  free_scans_left?: number;
}

interface RawPlanConfig {
  plan: string;
  monthly_scans: number;
  overage_enabled: boolean;
  hard_cap: number | null;
  chat_per_day: number;
}

interface RemotePlansConfig {
  providerLabel?: string;
  plans?: Partial<Plan>[];
  benefits?: PlanBenefit[];
  /** true cuando `create-checkout` acepte `planId` (plan anual, etc.). */
  checkoutAcceptsPlanId?: boolean;
  /** true cuando exista la función `iap-verify` (compras de Apple y Google). */
  storeVerification?: boolean;
  /** true cuando `create-checkout` acepte `method: 'bizum'` y Bizum esté activado en Stripe. */
  bizum?: boolean;
  /** true cuando esté desplegada la función `family-pay`. */
  familyPay?: boolean;
  /** true cuando `create-checkout` acepte `method: 'sepa'` y la domiciliación SEPA esté activada en Stripe. */
  sepaDebit?: boolean;
  /** true cuando `create-checkout` acepte `method: 'paypal'` y PayPal (con cobros recurrentes) esté activado en Stripe. */
  paypal?: boolean;
}

function mapStatus(raw: string | null): SubscriptionStatus {
  if (!raw) return 'none';
  if (raw === 'incomplete_expired') return 'canceled';
  return (STATUSES as string[]).includes(raw) ? (raw as SubscriptionStatus) : 'unknown';
}

function mapLimits(row: RawPlanConfig | undefined): PlanLimits | null {
  if (!row) return null;
  return {
    unlimited: isUnlimitedScans(Number(row.monthly_scans) || 0) && !row.overage_enabled,
    monthlyScans: Number(row.monthly_scans) || 0,
    chatPerDay: Number(row.chat_per_day) || 0,
    overageEnabled: Boolean(row.overage_enabled),
    hardCap: row.hard_cap === null || row.hard_cap === undefined ? null : Number(row.hard_cap),
  };
}

function isValidRemotePlan(p: Partial<Plan>): p is Plan {
  return Boolean(
    p && typeof p.id === 'string' && typeof p.name === 'string' &&
    isBillingPeriod(p.period) &&
    typeof p.priceCents === 'number' && p.priceCents > 0,
  );
}

function cleanId(value: unknown): string | null {
  return typeof value === 'string' && /^[A-Za-z0-9._-]{1,120}$/.test(value.trim()) ? value.trim() : null;
}

/** Productos de tienda del plan: los configurados en app_config o, si no hay, los de por defecto. */
function normalizeStore(raw: unknown, period: Plan['period']): StoreProductRefs {
  const fallback = DEFAULT_STORE_PRODUCTS[period];
  if (!raw || typeof raw !== 'object') return fallback;
  const r = raw as { apple?: { productId?: unknown } | null; google?: { productId?: unknown; basePlanId?: unknown } | null };
  const appleId = cleanId(r.apple?.productId);
  const googleId = cleanId(r.google?.productId);
  return {
    apple: r.apple === null ? null : appleId ? { productId: appleId } : fallback.apple ?? null,
    google:
      r.google === null
        ? null
        : googleId
          ? { productId: googleId, basePlanId: cleanId(r.google?.basePlanId) }
          : fallback.google ?? null,
  };
}

function normalizePlan(p: Plan): Plan {
  return {
    ...p,
    currency: 'EUR',
    monthlyEquivalentCents:
      typeof p.monthlyEquivalentCents === 'number' ? p.monthlyEquivalentCents : monthlyEquivalent(p.priceCents, p.period),
    savingsLabel: p.savingsLabel ?? null,
    tagline: typeof p.tagline === 'string' ? p.tagline : null,
    badge: typeof p.badge === 'string' ? p.badge : null,
    terms: Array.isArray(p.terms) ? p.terms.filter((t) => typeof t === 'string') : [],
    highlighted: Boolean(p.highlighted),
    purchasable: p.purchasable !== false,
    store: normalizeStore((p as { store?: unknown }).store, p.period),
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export const SubscriptionService = {
  async getSubscription(): Promise<Subscription> {
    const userId = await requireUserId();
    const [profileRes, statusRes] = await Promise.all([
      supabase
        .from('profiles')
        .select('plan, subscription_status, current_period_end, billing_provider, cancel_at_period_end')
        .eq('id', userId)
        .maybeSingle(),
      supabase.rpc('get_account_status'),
    ]);
    if (profileRes.error) throw dbError(profileRes.error);
    const p = (profileRes.data ?? null) as RawProfileBilling | null;
    const s = (statusRes.data ?? null) as RawAccountStatus | null;
    if (statusRes.error) throw dbError(statusRes.error);
    const ownerAccess = s?.owner_access === true;
    const isPremium = s?.plan === 'premium';
    // Keep paid subscription management visible when a grant overlaps an existing purchase.
    const courtesyAccess = s?.courtesy_access === true && p?.plan !== 'premium';
    const included = Number(s?.included_scans ?? 0);
    const used = Number(s?.scans_this_period ?? 0);
    // El recuento solo es fiable si el servidor aplica el mismo plan que ve la persona. Con Premium
    // depende de que el webhook escriba `sub_state` (R-01): hasta entonces el servidor aplica el plan
    // gratuito y el uso no se muestra; en cuanto se corrija, aparece solo, sin cambiar la app.
    const serverPlan = s?.plan ?? (isPremium ? null : 'free');
    const usageReliable = !!s && serverPlan === (isPremium ? 'premium' : 'free') && included > 0;
    return {
      plan: isPremium ? 'premium' : 'free',
      isPremium,
      ownerAccess,
      courtesyAccess,
      status: ownerAccess || courtesyAccess ? 'active' : mapStatus(p?.subscription_status ?? null),
      renewsAt: ownerAccess || courtesyAccess ? null : p?.current_period_end ?? null,
      cancelsAtPeriodEnd: !ownerAccess && p?.cancel_at_period_end === true,
      provider: p?.billing_provider ?? 'stripe',
      oneTimePayment: !ownerAccess && !courtesyAccess && s?.payment_kind === 'bizum',
      paidByFamily: !ownerAccess && !courtesyAccess && s?.paid_by_family === true,
      usage: usageReliable
        ? {
            scansUsed: used,
            scansIncluded: included,
            scansLeft: Math.max(0, Number(s?.free_scans_left ?? included - used)),
            unlimited: isPremium && isUnlimitedScans(included),
          }
        : null,
    };
  },

  async getPlans(): Promise<PlansCatalog> {
    const [limitsRes, remoteRes] = await Promise.all([
      supabase.from('plan_config').select('plan, monthly_scans, overage_enabled, hard_cap, chat_per_day'),
      supabase.from('app_config').select('value').eq('key', 'plans').maybeSingle(),
    ]);
    const rows = (limitsRes.data ?? []) as RawPlanConfig[];
    const freeLimits = mapLimits(rows.find((r) => r.plan === 'free'));
    const premiumLimits = mapLimits(rows.find((r) => r.plan === 'premium'));

    const remote = (remoteRes.data as { value?: RemotePlansConfig } | null)?.value;
    const remotePlans = (remote?.plans ?? []).filter(isValidRemotePlan).map(normalizePlan);
    const usingRemote = remotePlans.length > 0;

    let plans: Plan[] = usingRemote ? remotePlans : FALLBACK_PLANS.map(normalizePlan);
    if (!usingRemote && premiumLimits && premiumLimits.monthlyScans > 0) {
      const included = premiumLimits.unlimited
        ? 'Identificaciones ilimitadas mientras dure la suscripción.'
        : `Incluye ${premiumLimits.monthlyScans} identificaciones al mes.`;
      plans = plans.map((p) => ({ ...p, terms: [...p.terms, included] }));
    }

    const remoteBenefits: PlanBenefit[] = Array.isArray(remote?.benefits)
      ? remote!.benefits!
          .filter((b) => b && typeof b.id === 'string' && typeof b.label === 'string')
          .map((b) => ({
            id: b.id,
            label: b.label,
            ...(typeof b.detail === 'string' ? { detail: b.detail } : null),
            ...(b.alwaysFree === true ? { alwaysFree: true } : null),
          }))
      : [];
    const benefits: PlanBenefit[] = remoteBenefits.length ? remoteBenefits : PREMIUM_BENEFITS.map((b) => ({ ...b }));

    return {
      // Ahorro, lema y etiqueta se calculan con los precios del propio catálogo (nunca a mano).
      plans: decoratePlans(plans),
      benefits,
      freeLimits,
      premiumLimits,
      paymentProviderLabel: remote?.providerLabel ?? FALLBACK_PROVIDER_LABEL,
      checkoutAcceptsPlanId: remote?.checkoutAcceptsPlanId === true,
      storeVerification: remote?.storeVerification === true,
      bizumPayments: remote?.bizum === true,
      familyPayments: remote?.familyPay === true,
      sepaPayments: remote?.sepaDebit === true,
      paypalPayments: remote?.paypal === true,
    };
  },

  /** Espera a que el webhook active Premium (máx. ~20 s). */
  async waitForPremium(timeoutMs = 20_000): Promise<PurchaseOutcome> {
    const started = Date.now();
    while (Date.now() - started < timeoutMs) {
      try {
        const sub = await SubscriptionService.getSubscription();
        if (sub.isPremium) return { status: 'success' };
      } catch {
        // seguimos intentando hasta el límite
      }
      await sleep(2000);
    }
    return { status: 'pending' };
  },

  /** Interpreta la URL de vuelta del pago (deep link / web). */
  parsePaymentReturn(params: { ok?: string; cancel?: string }): 'ok' | 'cancel' | 'unknown' {
    if (params.ok === '1') return 'ok';
    if (params.cancel === '1') return 'cancel';
    return 'unknown';
  },

  /**
   * "Restaurar compra": vuelve a consultar al backend si esta cuenta tiene una
   * suscripción activa (p. ej. tras reinstalar o cambiar de teléfono).
   */
  async restorePurchase(): Promise<RestoreOutcome> {
    await supabase.auth.refreshSession().catch(() => undefined);
    const subscription = await SubscriptionService.getSubscription();
    return subscription.isPremium ? { status: 'restored', subscription } : { status: 'nothing_to_restore' };
  },

  /** Gestión de una suscripción pagada con TARJETA (portal seguro de Stripe: tarjeta, facturas, cancelar). */
  async openManageSubscription(): Promise<void> {
    if (!PURCHASES_ENABLED) {
      throw new AppError('not_available', 'La gestión de la suscripción no está disponible en esta versión de la app.');
    }
    await requireUserId();
    if (DemoMode.isActive()) {
      throw new AppError('not_available', 'En el modo demostración no hay una suscripción real que gestionar.');
    }
    const returnUrl = Platform.OS === 'web' ? paymentReturnUrl().replace('/payment-result', '/premium') : Linking.createURL('premium');
    let url: string;
    try {
      const res = await invokeFunction<{ url?: string }>('customer-portal', { returnUrl });
      if (!res?.url) throw new AppError('unknown');
      url = res.url;
    } catch (e) {
      const err = toAppError(e);
      if (err.kind === 'not_found') throw new AppError('not_found', 'No tienes ninguna suscripción que gestionar.');
      throw err;
    }
    if (Platform.OS === 'web') {
      (globalThis as { location?: { assign?: (u: string) => void } }).location?.assign?.(url);
      return;
    }
    await WebBrowser.openAuthSessionAsync(url, returnUrl);
  },
};
