/**
 * Compra integrada REAL: Apple (StoreKit 2) en iPhone y Google Play Billing en Android, con `expo-iap`.
 *
 *  - Se carga bajo demanda: en web, en Expo Go o si falta el módulo nativo, `platform()` devuelve null y la
 *    app simplemente no ofrece esta vía (nunca se rompe).
 *  - La compra se identifica con la cuenta de MediClaro: `appAccountToken` (Apple, UUID) y
 *    `obfuscatedAccountId` (Google) = id del usuario. El servidor lo usa para saber de quién es.
 *  - La transacción NO se cierra hasta que el servidor la ha comprobado (`iap-verify`). Si algo falla, la tienda
 *    la vuelve a entregar y se reintenta sola (setBackgroundHandler).
 *  - Pago con tarjeta fuera de la tienda (UE/EEE): antes se muestra el aviso obligatorio del sistema
 *    (Apple: ExternalPurchaseCustomLink; Google Play: programa de ofertas externas).
 */
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { AppError } from '../../api/errors';
import { CARD_PAYMENTS_ENABLED, RELEASE_BUILD } from '../../config/app';
import type { StorePlatform, StoreProductRefs } from '../../types';
import type { StoreBillingAdapter, StoreProductInfo, StorePurchase } from './types';

type ExpoIap = typeof import('expo-iap');
type NativePurchase = import('expo-iap').Purchase;
type NativeError = import('expo-iap').ExpoPurchaseError;
type NativeSubscription = import('expo-iap').ProductSubscription;

let iapModule: ExpoIap | null | undefined;

/** Módulo nativo de compras, o null si este teléfono/compilación no lo tiene. */
function iap(): ExpoIap | null {
  if (iapModule !== undefined) return iapModule;
  if (Platform.OS !== 'ios' && Platform.OS !== 'android') {
    iapModule = null;
    return iapModule;
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    iapModule = require('expo-iap') as ExpoIap;
  } catch {
    iapModule = null;
  }
  return iapModule;
}

const ANDROID_PACKAGE: string = Constants.expoConfig?.android?.package ?? 'com.mediclaro.app';
const PURCHASE_TIMEOUT_MS = 10 * 60_000;

// ─── Conexión y eventos ──────────────────────────────────────────────────────

let connecting: Promise<void> | null = null;
let backgroundHandler: ((purchase: StorePurchase) => void) | null = null;
let pendingRequest: {
  productId: string;
  resolve: (p: StorePurchase) => void;
  reject: (e: AppError) => void;
  timer: ReturnType<typeof setTimeout>;
} | null = null;

function storeOf(): StorePlatform | null {
  if (!iap()) return null;
  return Platform.OS === 'ios' ? 'apple' : Platform.OS === 'android' ? 'google' : null;
}

function toStorePurchase(p: NativePurchase): StorePurchase | null {
  const token = p.purchaseToken ?? null;
  if (!token) return null;
  const transactionId =
    ('transactionId' in p && typeof p.transactionId === 'string' && p.transactionId) || (typeof p.id === 'string' ? p.id : null);
  const account =
    ('appAccountToken' in p && typeof p.appAccountToken === 'string' && p.appAccountToken) ||
    ('obfuscatedAccountIdAndroid' in p && typeof p.obfuscatedAccountIdAndroid === 'string' && p.obfuscatedAccountIdAndroid) ||
    null;
  return {
    platform: Platform.OS === 'ios' ? 'apple' : 'google',
    productId: p.productId,
    transactionId: transactionId || null,
    purchaseToken: token,
    state: p.purchaseState === 'pending' ? 'pending' : 'purchased',
    accountToken: account ? account.toLowerCase() : null,
    native: p,
  };
}

/** Traduce los errores de la tienda a mensajes claros. */
function toStoreError(e: unknown): AppError {
  if (e instanceof AppError) return e;
  const err = (e ?? {}) as Partial<NativeError> & { message?: string };
  const code = String(err.code ?? '');
  switch (code) {
    case 'user-cancelled':
      return new AppError('cancelled', 'Has cancelado la compra. No se ha cobrado nada.');
    case 'deferred-payment':
    case 'pending':
      return new AppError('conflict', 'La compra está pendiente de aprobación.', { code: 'store_pending' });
    case 'already-owned':
      return new AppError('conflict', 'Ya tienes esta suscripción con tu cuenta de la tienda. Pulsa «Restaurar compra».', {
        code: 'already_owned',
      });
    case 'network-error':
    case 'service-timeout':
    case 'service-disconnected':
      return new AppError('offline', 'No hay conexión con la tienda. Compruébala e inténtalo de nuevo.');
    case 'billing-unavailable':
    case 'iap-not-available':
    case 'feature-not-supported':
      return new AppError('not_available', 'Las compras no están disponibles en este teléfono. Revisa los ajustes de la tienda.');
    case 'item-unavailable':
    case 'sku-not-found':
    case 'query-product':
      return new AppError('not_available', 'Este plan no está disponible en la tienda ahora mismo.');
    default:
      return new AppError('unknown', 'La tienda no ha podido completar la compra. Inténtalo de nuevo.', { code: code || undefined });
  }
}

function onPurchaseUpdated(native: NativePurchase): void {
  const purchase = toStorePurchase(native);
  if (!purchase) return;
  if (pendingRequest && pendingRequest.productId === purchase.productId) {
    const request = pendingRequest;
    pendingRequest = null;
    clearTimeout(request.timer);
    request.resolve(purchase);
    return;
  }
  backgroundHandler?.(purchase);
}

function onPurchaseError(error: NativeError): void {
  if (!pendingRequest) return;
  const request = pendingRequest;
  pendingRequest = null;
  clearTimeout(request.timer);
  request.reject(toStoreError(error));
}

async function connect(): Promise<ExpoIap> {
  const m = iap();
  if (!m) throw new AppError('not_available', 'La compra integrada no está disponible en este teléfono.');
  if (!connecting) {
    const config = Platform.OS === 'android' && CARD_PAYMENTS_ENABLED ? { enableBillingProgramAndroid: 'external-offer' as const } : undefined;
    connecting = m
      .initConnection(config)
      .then((ok) => {
        if (!ok) throw new AppError('not_available', 'No hemos podido conectar con la tienda.');
        m.purchaseUpdatedListener(onPurchaseUpdated);
        m.purchaseErrorListener(onPurchaseError);
      })
      .catch((e: unknown) => {
        connecting = null;
        throw toStoreError(e);
      });
  }
  await connecting;
  return m;
}

// ─── Productos ───────────────────────────────────────────────────────────────

function toCents(price: number | null | undefined, currency: string | null | undefined): number | null {
  if (typeof price !== 'number' || !Number.isFinite(price) || price <= 0) return null;
  if (currency && currency.toUpperCase() !== 'EUR') return null;
  return Math.round(price * 100);
}

function appleInfo(planId: string, product: NativeSubscription): StoreProductInfo {
  return {
    planId,
    productId: product.id,
    displayPrice: product.displayPrice,
    priceCents: toCents(product.price, product.currency),
    currency: product.currency ?? null,
  };
}

function googleInfo(planId: string, product: NativeSubscription, basePlanId: string | null | undefined): StoreProductInfo | null {
  const offers = product.subscriptionOffers ?? [];
  const candidates = basePlanId ? offers.filter((o) => o.basePlanIdAndroid === basePlanId) : offers;
  // El plan base sin promociones: la oferta cuyo id es el del plan base (o sin id), con un solo tramo de precio.
  const base =
    candidates.find((o) => !o.id || o.id === o.basePlanIdAndroid) ??
    [...candidates].sort((a, b) => (a.pricingPhasesAndroid?.pricingPhaseList?.length ?? 1) - (b.pricingPhasesAndroid?.pricingPhaseList?.length ?? 1))[0];
  if (!base?.offerTokenAndroid) return null;
  return {
    planId,
    productId: product.id,
    displayPrice: base.displayPrice,
    priceCents: toCents(base.price, base.currency ?? product.currency),
    currency: base.currency ?? product.currency ?? null,
    offerToken: base.offerTokenAndroid,
  };
}

// ─── Adaptador ───────────────────────────────────────────────────────────────

export const storeBilling: StoreBillingAdapter = {
  platform: storeOf,

  async loadProducts(plans) {
    const out = new Map<string, StoreProductInfo>();
    const platform = storeOf();
    if (!platform) return out;
    const m = await connect();
    const refFor = (refs: StoreProductRefs) => (platform === 'apple' ? refs.apple?.productId : refs.google?.productId);
    const skus = [...new Set(plans.map((p) => refFor(p.refs)).filter((id): id is string => !!id))];
    if (!skus.length) return out;
    let products: NativeSubscription[];
    try {
      products = (await m.fetchProducts({ skus, type: 'subs' })) as NativeSubscription[];
    } catch (e) {
      throw toStoreError(e);
    }
    for (const { planId, refs } of plans) {
      const id = refFor(refs);
      const product = products.find((p) => p.id === id);
      if (!product) continue;
      const info = platform === 'apple' ? appleInfo(planId, product) : googleInfo(planId, product, refs.google?.basePlanId);
      if (info) out.set(planId, info);
    }
    return out;
  },

  async purchase({ product, accountToken }) {
    const platform = storeOf();
    if (!platform) throw new AppError('not_available', 'La compra integrada no está disponible en este teléfono.');
    const m = await connect();
    if (pendingRequest) throw new AppError('conflict', 'Ya hay una compra en curso. Termínala o ciérrala antes.');
    return new Promise<StorePurchase>((resolve, reject) => {
      const timer = setTimeout(() => {
        pendingRequest = null;
        reject(new AppError('timeout', 'La tienda está tardando demasiado. Si se ha cobrado, pulsa «Restaurar compra».'));
      }, PURCHASE_TIMEOUT_MS);
      pendingRequest = { productId: product.productId, resolve, reject, timer };
      const request =
        platform === 'apple'
          ? { apple: { sku: product.productId, appAccountToken: accountToken } }
          : {
              google: {
                skus: [product.productId],
                subscriptionOffers: product.offerToken ? [{ sku: product.productId, offerToken: product.offerToken }] : undefined,
                obfuscatedAccountId: accountToken,
              },
            };
      m.requestPurchase({ request, type: 'subs' }).catch((e: unknown) => {
        if (!pendingRequest) return;
        clearTimeout(timer);
        pendingRequest = null;
        reject(toStoreError(e));
      });
    });
  },

  async finish(purchase) {
    const m = iap();
    if (!m || !purchase.native) return;
    await m.finishTransaction({ purchase: purchase.native as NativePurchase, isConsumable: false });
  },

  async activePurchases() {
    if (!storeOf()) return [];
    const m = await connect();
    try {
      const list = await m.getAvailablePurchases();
      return list.map(toStorePurchase).filter((p): p is StorePurchase => !!p);
    } catch (e) {
      throw toStoreError(e);
    }
  },

  async openManage(productId) {
    const m = iap();
    if (!m) throw new AppError('not_available', 'Abre los ajustes de suscripciones de tu teléfono para gestionarla.');
    await m.deepLinkToSubscriptions({ skuAndroid: productId ?? undefined, packageNameAndroid: ANDROID_PACKAGE });
  },

  async canOfferExternalPurchase() {
    // Compilaciones de prueba: se ofrece siempre para poder probar el pago con tarjeta.
    if (!RELEASE_BUILD) return true;
    const m = iap();
    if (!m) return false;
    try {
      if (Platform.OS === 'ios') return await m.isEligibleForExternalPurchaseCustomLinkIOS();
      if (Platform.OS === 'android') {
        await connect();
        const result = await m.isBillingProgramAvailableAndroid('external-offer');
        return result.isAvailable;
      }
    } catch {
      return false;
    }
    return false;
  },

  async startExternalPurchase() {
    const m = iap();
    const fallback = { proceed: !RELEASE_BUILD, token: null };
    if (!m) return fallback;
    try {
      if (Platform.OS === 'ios') {
        const eligible = await m.isEligibleForExternalPurchaseCustomLinkIOS().catch(() => false);
        if (!eligible) return fallback;
        // Hoja de aviso obligatoria de Apple antes de pagar fuera del App Store.
        const notice = await m.showExternalPurchaseCustomLinkNoticeIOS('browser');
        if (!notice.continued) return { proceed: false, token: null };
        const token = await m.getExternalPurchaseCustomLinkTokenIOS('acquisition').catch(() => null);
        return { proceed: true, token: token?.token ?? null };
      }
      if (Platform.OS === 'android') {
        await connect();
        const available = await m.isBillingProgramAvailableAndroid('external-offer').catch(() => null);
        if (!available?.isAvailable) return fallback;
        const details = await m.createBillingProgramReportingDetailsAndroid('external-offer');
        return { proceed: true, token: details.externalTransactionToken ?? null };
      }
    } catch {
      return fallback;
    }
    return fallback;
  },

  async confirmExternalLink(url) {
    if (Platform.OS !== 'android') return true;
    const m = iap();
    if (!m) return !RELEASE_BUILD;
    try {
      const available = await m.isBillingProgramAvailableAndroid('external-offer').catch(() => null);
      if (!available?.isAvailable) return !RELEASE_BUILD;
      // Diálogo informativo de Google Play; después abrimos nosotros la página segura.
      return await m.launchExternalLinkAndroid({
        billingProgram: 'external-offer',
        launchMode: 'caller-will-launch-link',
        linkType: 'link-to-digital-content-offer',
        linkUri: url,
      });
    } catch {
      return false;
    }
  },

  setBackgroundHandler(handler) {
    backgroundHandler = handler;
  },
};
