/**
 * Tests — plazo de desistimiento (14 días). De esta decisión depende si la app ofrece devolver dinero,
 * así que se comprueba caso por caso: quién tiene derecho, desde cuándo cuenta y cuándo se agota.
 */
import { WITHDRAWAL_DAYS, withinWithdrawalWindow } from '../ImmediateStartConsentService';
import type { Subscription } from '../../types';

const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.parse('2026-10-12T12:00:00.000Z');
const iso = (msAgo: number) => new Date(NOW - msAgo).toISOString();

function sub(overrides: Partial<Subscription> = {}): Subscription {
  return {
    plan: 'premium',
    isPremium: true,
    status: 'active',
    renewsAt: '2026-11-12T12:00:00.000Z',
    cancelsAtPeriodEnd: false,
    provider: 'stripe',
    usage: null,
    ...overrides,
  };
}

describe('plazo de desistimiento', () => {
  it('son 14 días', () => {
    expect(WITHDRAWAL_DAYS).toBe(14);
  });

  it('dentro del plazo: acaba de pagar, o lleva menos de 14 días', () => {
    expect(withinWithdrawalWindow(sub(), iso(0), NOW)).toBe(true);
    expect(withinWithdrawalWindow(sub(), iso(DAY), NOW)).toBe(true);
    expect(withinWithdrawalWindow(sub(), iso(13 * DAY), NOW)).toBe(true);
    // El último día sigue contando, hasta la misma hora.
    expect(withinWithdrawalWindow(sub(), iso(14 * DAY - 1000), NOW)).toBe(true);
  });

  it('fuera del plazo: a los 14 días justos ya no, ni después', () => {
    expect(withinWithdrawalWindow(sub(), iso(14 * DAY), NOW)).toBe(false);
    expect(withinWithdrawalWindow(sub(), iso(30 * DAY), NOW)).toBe(false);
    expect(withinWithdrawalWindow(sub(), iso(400 * DAY), NOW)).toBe(false);
  });

  it('sin Premium o sin fecha de pago, no se ofrece nada', () => {
    expect(withinWithdrawalWindow(sub({ isPremium: false, plan: 'free' }), iso(DAY), NOW)).toBe(false);
    expect(withinWithdrawalWindow(null, iso(DAY), NOW)).toBe(false);
    expect(withinWithdrawalWindow(undefined, iso(DAY), NOW)).toBe(false);
    // No consta la fecha (se pagó en otro móvil): la app no lo ofrece aquí, pero tampoco niega el derecho.
    expect(withinWithdrawalWindow(sub(), null, NOW)).toBe(false);
  });

  it('las compras de Apple y de Google Play se reembolsan en la tienda, no aquí', () => {
    expect(withinWithdrawalWindow(sub({ provider: 'apple' }), iso(DAY), NOW)).toBe(false);
    expect(withinWithdrawalWindow(sub({ provider: 'google' }), iso(DAY), NOW)).toBe(false);
  });

  it('quien no ha pagado no desiste: propietario, cortesía o lo paga un familiar', () => {
    expect(withinWithdrawalWindow(sub({ ownerAccess: true }), iso(DAY), NOW)).toBe(false);
    expect(withinWithdrawalWindow(sub({ courtesyAccess: true }), iso(DAY), NOW)).toBe(false);
    expect(withinWithdrawalWindow(sub({ paidByFamily: true }), iso(DAY), NOW)).toBe(false);
  });

  it('una fecha imposible no abre un plazo nuevo', () => {
    // Reloj del teléfono mal puesto: fecha futura.
    expect(withinWithdrawalWindow(sub(), new Date(NOW + 5 * DAY).toISOString(), NOW)).toBe(false);
    expect(withinWithdrawalWindow(sub(), 'no es una fecha', NOW)).toBe(false);
    expect(withinWithdrawalWindow(sub(), '', NOW)).toBe(false);
  });

  it('un pago con Bizum (pago único) también da derecho a desistir', () => {
    // Bizum no se renueva, así que `cancelsAtPeriodEnd` viene a true: eso no quita el derecho.
    expect(withinWithdrawalWindow(sub({ oneTimePayment: true, cancelsAtPeriodEnd: true }), iso(2 * DAY), NOW)).toBe(true);
  });
});
