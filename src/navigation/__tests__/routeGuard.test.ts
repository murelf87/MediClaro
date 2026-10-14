import { routeTarget, isPublicRoute, type GuardInput } from '../routeGuard';

const base: GuardInput = {
  status: 'signedIn',
  segments: ['(tabs)'],
  linkingPhone: false,
  paymentAccount: false,
  entitlementReady: true,
  isPremium: false,
  premiumRequired: true,
  postAuth: null,
};
const at = (segments: string[], extra: Partial<GuardInput> = {}) => routeTarget({ ...base, segments, ...extra });

describe('routeGuard — sin cuenta', () => {
  const out = (segments: string[]) => at(segments, { status: 'signedOut' });
  it('la bienvenida, la explicación (y su vídeo), los planes y el pago son públicos (sin registrarse)', () => {
    for (const r of ['welcome', 'tour', 'premium', 'payment', 'payment-card', 'login', 'verify', 'legal', 'help', 'how-it-works']) {
      expect(out([r])).toBeNull();
    }
  });
  it('la pantalla principal de emergencia (112) es SIEMPRE pública', () => {
    expect(out(['emergency'])).toBeNull();
    expect(out(['emergency', 'index'])).toBeNull();
    expect(isPublicRoute(['emergency'])).toBe(true);
  });
  it('lo privado lleva a la bienvenida', () => {
    for (const r of [['(tabs)'], ['scan'], ['assistant'], ['emergency', 'calling'], ['complete-account'], ['premium-success']]) {
      expect(out(r)).toBe('/welcome');
    }
  });
  it('mientras carga la sesión no se redirige', () => {
    expect(at(['scan'], { status: 'loading' })).toBeNull();
  });
});

describe('routeGuard — cuenta sin teléfono creada al pagar', () => {
  const pay = (segments: string[], extra: Partial<GuardInput> = {}) => at(segments, { paymentAccount: true, ...extra });
  it('sin Premium (pago cancelado o pendiente) no ve la app: vuelve a la bienvenida', () => {
    expect(pay(['(tabs)'])).toBe('/welcome');
    expect(pay(['scan'])).toBe('/welcome');
  });
  it('sin Premium sí puede seguir en el pago, la confirmación, «Completa tu cuenta» y las emergencias', () => {
    for (const r of ['premium', 'payment', 'payment-card', 'payment-result', 'premium-success', 'complete-account', 'welcome', 'tour', 'login']) {
      expect(pay([r])).toBeNull();
    }
    expect(pay(['emergency'])).toBeNull();
  });
  it('con Premium usa toda la app; desde la bienvenida va al Inicio', () => {
    expect(pay(['(tabs)'], { isPremium: true })).toBeNull();
    expect(pay(['scan'], { isPremium: true })).toBeNull();
    expect(pay(['welcome'], { isPremium: true })).toBe('/(tabs)');
  });
  it('mientras se comprueba Premium no se redirige (sin parpadeos)', () => {
    expect(pay(['(tabs)'], { entitlementReady: false })).toBeNull();
  });
  it('sin compras en la app (modo gratuito) no se bloquea nada', () => {
    expect(pay(['(tabs)'], { premiumRequired: false })).toBeNull();
  });
  it('puede entrar con su teléfono («Ya soy Premium») sin ser devuelta al Inicio', () => {
    expect(pay(['login'])).toBeNull();
    expect(pay(['verify'])).toBeNull();
  });
});

describe('routeGuard — cuenta con teléfono', () => {
  it('bienvenida, acceso y verificación llevan al Inicio', () => {
    expect(at(['welcome'])).toBe('/(tabs)');
    expect(at(['login'])).toBe('/(tabs)');
    expect(at(['verify'])).toBe('/(tabs)');
  });
  it('después de entrar vuelve al pago si venía de allí', () => {
    expect(at(['verify'], { postAuth: '/premium?plan=premium_annual' })).toBe('/premium?plan=premium_annual');
  });
  it('confirmando el teléfono añadido tras pagar no se redirige', () => {
    expect(at(['verify'], { linkingPhone: true })).toBeNull();
  });
  it('sin Premium ve la app (las funciones reales muestran los planes, no se la expulsa)', () => {
    expect(at(['(tabs)'])).toBeNull();
    expect(at(['scan'])).toBeNull();
  });
});
