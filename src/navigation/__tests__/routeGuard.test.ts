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
  it('la bienvenida, la explicación, los planes y el pago son públicos (sin registrarse)', () => {
    for (const r of ['welcome', 'tour', 'premium', 'payment', 'payment-card', 'family-pay', 'login', 'verify', 'legal', 'help']) {
      expect(out([r])).toBeNull();
    }
  });
  it('la pantalla principal de emergencia (112) es SIEMPRE pública', () => {
    expect(out(['emergency'])).toBeNull();
    expect(out(['emergency', 'index'])).toBeNull();
    expect(isPublicRoute(['emergency'])).toBe(true);
  });
  it('lo privado lleva a la bienvenida', () => {
    for (const r of [['owner-dashboard'], ['emergency', 'calling'], ['complete-account'], ['premium-success']]) {
      expect(out(r)).toBe('/welcome');
    }
  });
  it('mientras carga la sesión no se redirige', () => {
    expect(at(['scan'], { status: 'loading' })).toBeNull();
  });
});

describe('routeGuard — cuenta sin teléfono creada al pagar', () => {
  const pay = (segments: string[], extra: Partial<GuardInput> = {}) => at(segments, { paymentAccount: true, ...extra });
  it('sin Premium entra al inicio y a las pantallas de bloqueo, no a datos privados', () => {
    expect(pay(['(tabs)'])).toBeNull();
    expect(pay(['scan'])).toBeNull();
    expect(pay(['owner-dashboard'])).toBe('/welcome');
  });
  it('sin Premium sí puede seguir en el pago, la confirmación y las emergencias', () => {
    for (const r of ['premium', 'payment', 'payment-card', 'family-pay', 'payment-result', 'premium-success', 'welcome', 'tour', 'login']) {
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
    expect(at(['verify'], { linkingPhone: true, isPremium: true })).toBeNull();
  });
  it('sin Premium ve la app (las funciones reales muestran los planes, no se la expulsa)', () => {
    expect(at(['(tabs)'])).toBeNull();
    expect(at(['scan'])).toBeNull();
  });
});

describe('phone verification only after confirmed Premium', () => {
 it('rejects direct completion and linking before a confirmed entitlement', () => {
  expect(at(['complete-account'], {paymentAccount:true})).toBe('/premium');
  expect(at(['verify'], {paymentAccount:true,linkingPhone:true})).toBe('/premium');
 });
 it('allows both steps once Premium is confirmed', () => {
  expect(at(['complete-account'], {paymentAccount:true,isPremium:true})).toBeNull();
  expect(at(['verify'], {paymentAccount:true,isPremium:true,linkingPhone:true})).toBeNull();
 });
 it('waits for entitlement without redirecting to phone verification', () => {
  expect(at(['complete-account'], {paymentAccount:true,entitlementReady:false})).toBeNull();
 });
});

it('guests can enter without phone; feature gates protect IA and identification', () => {
 for (const route of ['(tabs)','scan','assistant']) {
  expect(at([route],{status:'signedOut'})).toBeNull();
 }
});
