/**
 * Selección de los adaptadores de pago.
 *  - Real: compra integrada con expo-iap y página segura de Stripe.
 *  - Simulado: SOLO en el Modo demostración (compilaciones de desarrollo/preview) y en la QA web.
 *    Vive en src/mocks/demoPayments.tsx y en las compilaciones de tienda se sustituye por un módulo vacío
 *    (metro.config.js), así que nunca llega a producción.
 */
import { DemoMode } from '../DemoMode';
import { demoHostedCheckout, demoStoreBilling } from '../../mocks/demoPayments';
import { hostedCheckout } from './hostedCheckout';
import { storeBilling } from './storeBilling';
import type { HostedCheckoutAdapter, StoreBillingAdapter } from './types';

export type { HostedCheckoutAdapter, HostedCheckoutResult, StoreBillingAdapter, StoreProductInfo, StorePurchase } from './types';
export { paymentReturnUrl, parseReturn } from './returnUrl';

// @qa-billing-start
function simulated(): boolean {
  return DemoMode.isActive();
}
// @qa-billing-end

export const Billing = {
  store(): StoreBillingAdapter {
    return simulated() ? demoStoreBilling : storeBilling;
  },
  checkout(): HostedCheckoutAdapter {
    return simulated() ? demoHostedCheckout : hostedCheckout;
  },
};
