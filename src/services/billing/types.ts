/**
 * Contratos de los adaptadores de pago. Las pantallas nunca los usan directamente: solo PurchaseService.
 *  - StoreBillingAdapter: compra integrada (Apple StoreKit / Google Play Billing) y avisos obligatorios de
 *    Apple/Google antes de pagar fuera de la tienda.
 *  - HostedCheckoutAdapter: abre la página segura de pago con tarjeta (Stripe) y devuelve el resultado.
 * Implementaciones reales: storeBilling.ts y hostedCheckout.ts. Simuladas (solo desarrollo, pruebas y
 * Modo demostración): src/mocks/demoPayments.tsx.
 */
import type { BillingPeriod, FamilyInvite, StorePlatform, StoreProductRefs } from '../../types';

/** Producto de la tienda correspondiente a un plan. */
export interface StoreProductInfo {
  planId: string;
  productId: string;
  /** Precio con formato de la tienda («4,99 €»): es lo que se cobra. */
  displayPrice: string;
  /** Precio numérico en céntimos, si la tienda lo da en euros. */
  priceCents: number | null;
  currency: string | null;
  /** Android: token de la oferta del plan base elegido. */
  offerToken?: string | null;
}

/** Compra devuelta por la tienda, lista para comprobarla en el servidor. */
export interface StorePurchase {
  platform: StorePlatform;
  productId: string;
  transactionId: string | null;
  /** iOS: JWS firmado de la transacción (StoreKit 2). Android: purchaseToken. */
  purchaseToken: string;
  /** 'pending': pago pendiente o a la espera de aprobación («Pedir la compra»). */
  state: 'purchased' | 'pending';
  /** Cuenta de MediClaro con la que se hizo (appAccountToken / obfuscatedAccountId), si la tienda la da. */
  accountToken: string | null;
  /** Objeto nativo necesario para cerrar la transacción. */
  native: unknown;
}

export interface ExternalPurchaseStart {
  /** false → la persona no ha aceptado el aviso o no está permitido en esta compilación. */
  proceed: boolean;
  /** Token que el servidor debe declarar a Apple/Google (pago fuera de la tienda en la UE/EEE). */
  token: string | null;
}

export interface StoreBillingAdapter {
  /** Tienda de este teléfono, o null si no hay compra integrada (web, Expo Go…). */
  platform(): StorePlatform | null;
  /** Productos de la tienda por plan (solo los que existen). `priceCents` = precio del catálogo (referencia). */
  loadProducts(plans: { planId: string; refs: StoreProductRefs; period: BillingPeriod; priceCents: number }[]): Promise<Map<string, StoreProductInfo>>;
  /** Abre la hoja de compra de la tienda. Lanza AppError('cancelled') si la persona la cierra. */
  purchase(args: {
    planId: string;
    period: BillingPeriod;
    refs: StoreProductRefs;
    product: StoreProductInfo;
    accountToken: string;
  }): Promise<StorePurchase>;
  /** Cierra la transacción (solo después de que el servidor la haya comprobado). */
  finish(purchase: StorePurchase): Promise<void>;
  /** Compras activas o sin cerrar de este usuario de la tienda (restaurar / reintentar). */
  activePurchases(): Promise<StorePurchase[]>;
  /** Abre la gestión de suscripciones de la tienda. */
  openManage(productId: string | null): Promise<void>;
  /** ¿Se puede ofrecer el pago con tarjeta fuera de la tienda en este teléfono? */
  canOfferExternalPurchase(): Promise<boolean>;
  /** Aviso obligatorio de Apple/Google antes de pagar fuera de la tienda. */
  startExternalPurchase(): Promise<ExternalPurchaseStart>;
  /** Android: diálogo informativo de Google Play antes de abrir el enlace de pago. */
  confirmExternalLink(url: string): Promise<boolean>;
  /** Compras que llegan sin haberlas pedido ahora (renovaciones, compras interrumpidas). */
  setBackgroundHandler(handler: ((purchase: StorePurchase) => void) | null): void;
}

export type HostedCheckoutResult = 'ok' | 'cancel' | 'unknown' | 'redirected';

export interface HostedCheckoutAdapter {
  open(url: string, returnUrl: string): Promise<HostedCheckoutResult>;
  /**
   * SOLO Modo demostración: enseña cómo verá el familiar su invitación y su página de pago, y simula que paga.
   * La implementación real no lo tiene (el familiar paga en su propio móvil con el enlace).
   */
  previewFamilyPayment?(invite: FamilyInvite & { period: BillingPeriod; priceCents: number }): Promise<'paid' | 'cancel'>;
}
