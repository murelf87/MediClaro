/**
 * PurchaseService — contratar, restaurar y gestionar MediClaro Premium.
 *
 * Las pantallas solo usan este servicio: no conocen StoreKit, Google Play Billing ni Stripe.
 *
 *  - Oferta (getOffer): cada plan se ofrece SOLO por las vías que pueden cobrarlo de verdad:
 *      · tienda (Apple/Google): el producto existe en la tienda y el servidor comprueba compras (`iap-verify`);
 *      · tarjeta (Stripe): permitida en esta compilación/tienda y aceptada por `create-checkout`
 *        (hoy solo el mensual, hasta que acepte `planId`).
 *  - Cuenta: si la persona no tiene cuenta, se crea al pagar SIN pedir el teléfono (AuthService.ensureAccount).
 *    El teléfono se añade después, en «Completa tu cuenta».
 *  - Tienda: hoja oficial de Apple/Google → el servidor comprueba la compra (`iap-verify`) y activa Premium al
 *    momento → se cierra la transacción. Si el servidor no responde, la transacción queda abierta y se
 *    reintenta sola (reconcile) — nunca se pierde un pago.
 *  - Tarjeta: aviso obligatorio de Apple/Google (UE/EEE) → `create-checkout` → página segura de Stripe →
 *    el webhook activa Premium (se espera hasta ~20 s).
 *  - Bizum: igual que la tarjeta, pero `create-checkout` con `method: 'bizum'`: pago ÚNICO del periodo (Stripe no
 *    admite Bizum recurrente); Premium dura hasta el final del periodo pagado y no se renueva solo.
 *  - Familiar: `family-pay` crea un enlace de pago; la persona se lo envía a un familiar, que paga en la página
 *    segura de Stripe. Premium se activa en esta cuenta cuando el familiar paga (el webhook lo aplica).
 */
import { AppError, invokeFunction, toAppError } from '../api';
import { CARD_PAYMENTS_ENABLED, STORE_PAYMENTS_ENABLED } from '../config/app';
import { AuthService } from './AuthService';
import { SubscriptionService } from './SubscriptionService';
import { composeOffer } from './offer';
import { Billing, paymentReturnUrl, type StoreProductInfo, type StorePurchase } from './billing';
import type {
  FamilyInvite,
  HostedPaymentMethod,
  PlansCatalog,
  PurchaseOffer,
  PurchaseOutcome,
  RestoreOutcome,
  StorePlatform,
  Subscription,
} from '../types';

interface LoadedOffer {
  offer: PurchaseOffer;
  products: Map<string, StoreProductInfo>;
}

interface VerifyResponse {
  isPremium?: boolean;
}

// ─── Avisos de cambios de Premium (compras verificadas en segundo plano) ─────

const entitlementListeners = new Set<() => void>();
function notifyEntitlementChanged(): void {
  entitlementListeners.forEach((l) => l());
}

// ─── Oferta ──────────────────────────────────────────────────────────────────

async function loadOffer(): Promise<LoadedOffer> {
  const catalog: PlansCatalog = await SubscriptionService.getPlans();
  const store = Billing.store();

  // 1. Compra integrada: solo si está activada, el servidor comprueba compras y la tienda tiene los productos.
  let platform: StorePlatform | null = null;
  let products = new Map<string, StoreProductInfo>();
  if (STORE_PAYMENTS_ENABLED && catalog.storeVerification) {
    platform = store.platform();
    if (platform) {
      const wanted = catalog.plans
        .filter((p) => p.purchasable && p.store)
        .map((p) => ({ planId: p.id, refs: p.store!, period: p.period, priceCents: p.priceCents }));
      products = await store.loadProducts(wanted).catch(() => new Map<string, StoreProductInfo>());
    }
  }

  // 2. Tarjeta: activada en esta compilación y permitida por la tienda (permiso de pago alternativo en la UE/EEE).
  let cardProvider: string | null = null;
  if (CARD_PAYMENTS_ENABLED && (await store.canOfferExternalPurchase().catch(() => false))) {
    cardProvider = catalog.paymentProviderLabel ?? 'Stripe';
  }

  return { offer: composeOffer({ catalog, platform, products, cardProvider }), products };
}

// ─── Comprobación de compras de la tienda en el servidor ─────────────────────

async function verifyStorePurchase(purchase: StorePurchase, planId?: string): Promise<PurchaseOutcome> {
  let res: VerifyResponse | null;
  try {
    res = await invokeFunction<VerifyResponse>(
      'iap-verify',
      {
        platform: purchase.platform,
        productId: purchase.productId,
        transactionId: purchase.transactionId,
        purchaseToken: purchase.purchaseToken,
        ...(planId ? { planId } : null),
      },
      { timeoutMs: 45_000 },
    );
  } catch (e) {
    const err = toAppError(e);
    if (err.kind === 'conflict') {
      throw new AppError(
        'conflict',
        'Esta compra ya está vinculada a otra cuenta de MediClaro. Entra con el teléfono de esa cuenta («Ya soy Premium») o escríbenos.',
        { code: 'owned_by_other' },
      );
    }
    if (err.kind === 'invalid_input') {
      throw new AppError('invalid_input', 'La tienda no ha podido confirmar esta compra. No se ha activado Premium.', { code: 'purchase_invalid' });
    }
    // Sin conexión, servidor caído o función aún no desplegada: la transacción queda abierta y se reintenta sola.
    return { status: 'pending', reason: 'confirming' };
  }
  if (res?.isPremium) {
    await Billing.store()
      .finish(purchase)
      .catch(() => undefined);
    notifyEntitlementChanged();
    return { status: 'success' };
  }
  return { status: 'pending', reason: 'confirming' };
}

function isCancel(e: AppError): boolean {
  return e.kind === 'cancelled';
}

/**
 * Pago en la página segura de Stripe (tarjeta o Bizum). Con Bizum es un pago ÚNICO del periodo: el servidor cobra el
 * importe del catálogo y Premium dura hasta el final del periodo pagado, sin renovación automática.
 */
const METHOD_NAME: Record<HostedPaymentMethod, string> = {
  card: 'con tarjeta',
  bizum: 'con Bizum',
  sepa: 'con domiciliación bancaria',
  paypal: 'con PayPal',
};

async function hostedPurchase(planId: string, method: HostedPaymentMethod): Promise<PurchaseOutcome> {
  if (!CARD_PAYMENTS_ENABLED) {
    throw new AppError('not_available', `El pago ${METHOD_NAME[method]} no está disponible en esta versión.`);
  }
  const { offer } = await loadOffer();
  const entry = offer.plans.find((p) => p.plan.id === planId && p.channels.includes(method));
  if (!entry) {
    throw new AppError('not_available', `Este plan no se puede pagar ${METHOD_NAME[method]} ahora mismo.`);
  }
  await AuthService.ensureAccount();

  // Aviso obligatorio de Apple / Google Play antes de pagar fuera de la tienda (UE/EEE).
  const consent = await Billing.store().startExternalPurchase();
  if (!consent.proceed) return { status: 'cancelled' };

  const returnUrl = paymentReturnUrl();
  let url: string;
  try {
    const body: Record<string, unknown> = { returnUrl };
    if (method === 'bizum') {
      body.method = 'bizum';
      body.planId = planId; // con Bizum el servidor siempre cobra el plan elegido (pago único)
    } else {
      // Domiciliación y PayPal: la misma suscripción que con tarjeta, con otra forma de cobro.
      if (method !== 'card') body.method = method;
      if (offer.catalog.checkoutAcceptsPlanId) body.planId = planId;
    }
    // El servidor debe declarar este token a Apple/Google (BACKEND_REQUIREMENTS.md → R-22).
    if (consent.token) body.externalPurchaseToken = consent.token;
    const res = await invokeFunction<{ url?: string }>('create-checkout', body);
    if (!res?.url) throw new AppError('unknown', 'No hemos podido abrir el pago. Inténtalo de nuevo.');
    url = res.url;
  } catch (e) {
    const err = toAppError(e);
    if (err.kind === 'conflict') return { status: 'already_active' };
    throw err;
  }

  if (!(await Billing.store().confirmExternalLink(url))) return { status: 'cancelled' };
  const result = await Billing.checkout().open(url, returnUrl);
  if (result === 'redirected') return { status: 'redirected' };
  if (result === 'cancel') return { status: 'cancelled' };
  const outcome = await SubscriptionService.waitForPremium();
  if (outcome.status === 'success') notifyEntitlementChanged();
  return outcome.status === 'pending' ? { status: 'pending', reason: 'confirming' } : outcome;
}

// ─── Servicio ────────────────────────────────────────────────────────────────

export const PurchaseService = {
  /** Qué se puede contratar ahora mismo en este teléfono. */
  async getOffer(): Promise<PurchaseOffer> {
    return (await loadOffer()).offer;
  },

  /** Compra integrada (Apple / Google Play). */
  async purchaseWithStore(planId: string): Promise<PurchaseOutcome> {
    if (!STORE_PAYMENTS_ENABLED) throw new AppError('not_available', 'La compra con la tienda no está disponible en esta versión.');
    const { offer, products } = await loadOffer();
    const entry = offer.plans.find((p) => p.plan.id === planId && p.channels.includes('store'));
    const product = products.get(planId);
    if (!entry || !product || !entry.plan.store) {
      throw new AppError('not_available', 'Este plan no se puede contratar ahora mismo con la tienda.');
    }
    const account = await AuthService.ensureAccount();
    const current = await SubscriptionService.getSubscription().catch(() => null);
    if (current?.isPremium) return { status: 'already_active' };

    let purchase: StorePurchase;
    try {
      purchase = await Billing.store().purchase({
        planId,
        period: entry.plan.period,
        refs: entry.plan.store,
        product,
        accountToken: account.userId,
      });
    } catch (e) {
      const err = toAppError(e);
      if (isCancel(err)) return { status: 'cancelled' };
      if (err.code === 'store_pending') return { status: 'pending', reason: 'approval' };
      if (err.code === 'already_owned') {
        // La cuenta de la tienda ya tiene la suscripción: la vinculamos a esta cuenta.
        const restored = await PurchaseService.restore().catch(() => null);
        if (restored?.status === 'restored') return { status: 'success' };
      }
      throw err;
    }
    if (purchase.state === 'pending') return { status: 'pending', reason: 'approval' };
    return verifyStorePurchase(purchase, planId);
  },

  /** Tarjeta en la página segura de Stripe. */
  async purchaseWithCard(planId: string): Promise<PurchaseOutcome> {
    return hostedPurchase(planId, 'card');
  },

  /** Bizum en la página segura de Stripe: pago único del periodo elegido, sin renovación automática. */
  async purchaseWithBizum(planId: string): Promise<PurchaseOutcome> {
    return hostedPurchase(planId, 'bizum');
  },

  /** Cualquier vía de la página segura (tarjeta, Bizum, domiciliación bancaria o PayPal). */
  async purchaseHosted(planId: string, method: HostedPaymentMethod): Promise<PurchaseOutcome> {
    return hostedPurchase(planId, method);
  },

  /**
   * «Que pague mi familiar o cuidador/a»: crea el enlace de pago para enviárselo. No cobra nada a esta persona;
   * Premium se activa cuando el familiar paga.
   */
  async createFamilyInvite(planId: string): Promise<FamilyInvite> {
    if (!CARD_PAYMENTS_ENABLED) throw new AppError('not_available', 'Esta forma de pago no está disponible en esta versión.');
    const { offer } = await loadOffer();
    const entry = offer.plans.find((p) => p.plan.id === planId && p.channels.includes('family'));
    if (!entry) throw new AppError('not_available', 'Este plan no lo puede pagar un familiar ahora mismo.');
    await AuthService.ensureAccount();
    // El pago se hace fuera de la tienda: mismo aviso obligatorio de Apple / Google Play que con tarjeta.
    const consent = await Billing.store().startExternalPurchase();
    if (!consent.proceed) throw new AppError('cancelled', 'No se ha preparado la invitación.');
    try {
      const res = await invokeFunction<{ url?: string; expiresAt?: string | null; beneficiaryName?: string | null }>('family-pay', {
        action: 'create',
        planId,
        ...(consent.token ? { externalPurchaseToken: consent.token } : null),
      });
      if (!res?.url || !/^https:\/\//.test(res.url)) throw new AppError('unknown', 'No hemos podido preparar la invitación. Inténtalo de nuevo.');
      return { url: res.url, expiresAt: res.expiresAt ?? null, beneficiaryName: res.beneficiaryName ?? null, planId };
    } catch (e) {
      const err = toAppError(e);
      if (err.kind === 'conflict') throw new AppError('conflict', 'Ya tienes MediClaro Premium activo. No hace falta que nadie pague.');
      throw err;
    }
  },

  /**
   * «Restaurar compra»:
   *  1) compras de la tienda de este teléfono (Apple ID / cuenta de Google) → se comprueban y vinculan;
   *  2) después, lo que diga el servidor de esta cuenta (p. ej. pagada con tarjeta).
   */
  async restore(): Promise<RestoreOutcome> {
    const store = Billing.store();
    if (STORE_PAYMENTS_ENABLED && store.platform()) {
      const catalog = await SubscriptionService.getPlans().catch(() => null);
      if (catalog?.storeVerification) {
        const purchases = (await store.activePurchases()).filter((p) => p.state === 'purchased');
        if (purchases.length) {
          await AuthService.ensureAccount();
          for (const purchase of purchases) {
            const outcome = await verifyStorePurchase(purchase);
            if (outcome.status === 'success') break;
          }
        }
      }
    }
    if (!(await AuthService.getSession())) return { status: 'nothing_to_restore' };
    const outcome = await SubscriptionService.restorePurchase();
    if (outcome.status === 'restored') notifyEntitlementChanged();
    return outcome;
  },

  /** Gestionar la suscripción donde se contrató (tienda o portal seguro de Stripe). */
  async manage(subscription: Subscription | null): Promise<void> {
    if (subscription?.paidByFamily) {
      throw new AppError(
        'not_available',
        'Tu suscripción la paga un familiar. Para cambiar la tarjeta o cancelarla, tu familiar puede usar el enlace del correo de Stripe que recibió al pagar.',
      );
    }
    const provider = subscription?.provider ?? 'stripe';
    if (provider === 'apple' || provider === 'google') {
      const store = Billing.store();
      if (store.platform() === provider) return store.openManage(null);
      throw new AppError(
        'not_available',
        provider === 'apple'
          ? 'Tu suscripción se contrató con Apple: gestiónala en un iPhone, en Ajustes › tu nombre › Suscripciones.'
          : 'Tu suscripción se contrató con Google Play: gestiónala en Google Play › Pagos y suscripciones.',
      );
    }
    return SubscriptionService.openManageSubscription();
  },

  /**
   * Compras de la tienda pendientes de comprobar (p. ej. el servidor no respondió, la app se cerró a mitad
   * o una renovación). Solo las de ESTA cuenta. Devuelve true si se ha activado Premium.
   */
  async reconcile(userId: string): Promise<boolean> {
    if (!STORE_PAYMENTS_ENABLED) return false;
    const store = Billing.store();
    if (!store.platform()) return false;
    const catalog = await SubscriptionService.getPlans().catch(() => null);
    if (!catalog?.storeVerification) return false;
    const mine = (p: StorePurchase) => p.state === 'purchased' && p.accountToken === userId.toLowerCase();
    store.setBackgroundHandler((purchase) => {
      if (mine(purchase)) void verifyStorePurchase(purchase).catch(() => undefined);
    });
    const purchases = (await store.activePurchases().catch(() => [] as StorePurchase[])).filter(mine);
    let activated = false;
    for (const purchase of purchases) {
      const outcome = await verifyStorePurchase(purchase).catch(() => null);
      if (outcome?.status === 'success') activated = true;
    }
    return activated;
  },

  /** Aviso cuando una compra comprobada activa Premium (para refrescar la interfaz). */
  onEntitlementChange(listener: () => void): () => void {
    entitlementListeners.add(listener);
    return () => {
      entitlementListeners.delete(listener);
    };
  },
};
