/**
 * Protección de rutas (función pura, probada en __tests__/routeGuard.test.ts).
 *
 *  - Sin cuenta: bienvenida, explicación, planes y pago (sin registrarse), acceso, legales, ayuda y la pantalla
 *    principal de emergencia (112), que SIEMPRE es pública.
 *  - Invitados y cuentas sin teléfono pueden entrar al inicio; IA e identificación están protegidas por PremiumGate.
 *    Completar/verificar el teléfono solo tras confirmar Premium. Nunca es un requisito previo del pago.
 *  - Con teléfono: toda la app; las funciones reales muestran los planes si no hay Premium (PremiumGate).
 */

/** Rutas accesibles sin sesión. La pantalla principal de emergencia SIEMPRE es pública. */
export const PUBLIC_ROUTES = new Set([
  'welcome',
  'choose-profile',
  'caregiver',
  '(tabs)',
  'scan',
  'assistant',
  'tour',
  'onboarding',
  'login',
  'verify',
  'legal',
  'help',
  'premium',
  'payment',
  'payment-card',
  'family-pay',
  '+not-found',
]);

/** Con sesión (con teléfono), estas pantallas llevan al Inicio (el tutorial se puede ver desde Ayuda). */
export const AUTH_FLOW = new Set(['welcome', 'login', 'verify']);

/** Lo que puede ver una cuenta sin teléfono que aún no tiene Premium (pago en curso o pendiente). */
export const PAYMENT_FLOW = new Set([
  'premium',
  'payment',
  'payment-card',
  'family-pay',
  'payment-result',
  'premium-success',
  'complete-account',
  'subscribe',
]);

export function isPublicRoute(segments: string[]): boolean {
  const first = segments[0] ?? '';
  if (first === 'emergency') return segments.length === 1 || segments[1] === 'index';
  return PUBLIC_ROUTES.has(first);
}

export interface GuardInput {
  status: 'loading' | 'signedIn' | 'signedOut';
  segments: string[];
  /** /verify?purpose=link (añadir el teléfono después de pagar). */
  linkingPhone: boolean;
  /** Cuenta sin teléfono creada al pagar (no el acceso de prueba «Entrar sin verificar»). */
  paymentAccount: boolean;
  entitlementReady: boolean;
  isPremium: boolean;
  premiumRequired: boolean;
  /** Destino pendiente tras entrar con el teléfono (p. ej. volver al pago). */
  postAuth: string | null;
}

/** Ruta a la que hay que llevar a la persona, o null si puede quedarse donde está. */
export function routeTarget(i: GuardInput): string | null {
  const first = i.segments[0] ?? '';
  if (i.status === 'loading') return null;
  if (i.status === 'signedOut') return isPublicRoute(i.segments) ? null : '/welcome';
  // Completing/linking the phone is strictly post-entitlement, never a purchase prerequisite.
  if (first === 'complete-account' || i.linkingPhone) {
    if (!i.entitlementReady) return null;
    return i.isPremium ? null : '/premium';
  }
  if (i.paymentAccount) {
    if (first === 'welcome' && i.entitlementReady && i.isPremium) return '/(tabs)';
    if (
      i.premiumRequired &&
      i.entitlementReady &&
      !i.isPremium &&
      !isPublicRoute(i.segments) &&
      !PAYMENT_FLOW.has(first)
    ) {
      return '/welcome';
    }
    return null;
  }
  if (AUTH_FLOW.has(first)) return i.postAuth ?? '/(tabs)';
  return null;
}
