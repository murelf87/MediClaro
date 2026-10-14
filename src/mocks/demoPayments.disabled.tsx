/**
 * Sustituto de `demoPayments` en las compilaciones de tienda (ver metro.config.js).
 * Allí el Modo demostración está desactivado, así que estos adaptadores nunca se eligen
 * (src/services/billing/index.ts); si se usaran, fallan de forma explícita. La hoja simulada no existe.
 */
import type { HostedCheckoutAdapter, StoreBillingAdapter } from '../services/billing/types';

function unavailable(): never {
  throw new Error('Los pagos simulados no están incluidos en esta compilación.');
}

export const demoStoreBilling: StoreBillingAdapter = {
  platform: () => null,
  loadProducts: async () => unavailable(),
  purchase: async () => unavailable(),
  finish: async () => unavailable(),
  activePurchases: async () => unavailable(),
  openManage: async () => unavailable(),
  canOfferExternalPurchase: async () => false,
  startExternalPurchase: async () => unavailable(),
  confirmExternalLink: async () => false,
  setBackgroundHandler: () => undefined,
};

export const demoHostedCheckout: HostedCheckoutAdapter = {
  open: async () => unavailable(),
};

export function DemoPaymentSheetsHost(): null {
  return null;
}
