/**
 * Página segura de pago con tarjeta (Stripe Checkout) — implementación REAL.
 * La tarjeta se escribe en la página de Stripe (en una ventana segura dentro de la app); MediClaro nunca
 * la ve ni la guarda. Al terminar, Stripe vuelve a `payment-result?ok=1` o `?cancel=1`.
 */
import { Platform } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { parseReturn } from './returnUrl';
import type { HostedCheckoutAdapter } from './types';

export const hostedCheckout: HostedCheckoutAdapter = {
  async open(url, returnUrl) {
    if (Platform.OS === 'web') {
      // Web (solo pruebas): la página se abre en esta misma ventana y el resultado llega a /payment-result.
      (globalThis as { location?: { assign?: (u: string) => void } }).location?.assign?.(url);
      return 'redirected';
    }
    const result = await WebBrowser.openAuthSessionAsync(url, returnUrl);
    return result.type === 'success' ? parseReturn(result.url) : 'cancel';
  },
};
