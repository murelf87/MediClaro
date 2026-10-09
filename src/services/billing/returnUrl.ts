/**
 * Dirección a la que vuelve la página segura de pago (Stripe) y lectura del resultado.
 * El backend añade `?ok=1` (pagado) o `?cancel=1` (cancelado) a la dirección que le damos.
 */
import { Platform } from 'react-native';
import * as Linking from 'expo-linking';

export function paymentReturnUrl(): string {
  if (Platform.OS === 'web') {
    const loc = (globalThis as { location?: { origin?: string } }).location;
    return `${loc?.origin ?? ''}/payment-result`;
  }
  return Linking.createURL('payment-result');
}

export function parseReturn(url: string | null | undefined): 'ok' | 'cancel' | 'unknown' {
  if (!url) return 'unknown';
  if (/[?&]ok=1\b/.test(url)) return 'ok';
  if (/[?&]cancel=1\b/.test(url)) return 'cancel';
  return 'unknown';
}
