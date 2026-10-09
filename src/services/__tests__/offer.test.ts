import { composeOffer } from '../offer';
import { decoratePlans } from '../planCatalog';
import { FALLBACK_PLANS } from '../../config/plans';
import type { StoreProductInfo } from '../billing/types';
import type { Plan, PlansCatalog } from '../../types';

function catalog(overrides: Partial<PlansCatalog> = {}, plans: Plan[] = FALLBACK_PLANS): PlansCatalog {
  return {
    plans: decoratePlans(plans.map((p) => ({ ...p, monthlyEquivalentCents: Math.round(p.priceCents / (p.period === 'annual' ? 12 : p.period === 'quarterly' ? 3 : 1)) }))),
    benefits: [],
    freeLimits: null,
    premiumLimits: null,
    paymentProviderLabel: 'Stripe',
    checkoutAcceptsPlanId: false,
    storeVerification: true,
    bizumPayments: false,
    familyPayments: false,
    sepaPayments: false,
    paypalPayments: false,
    ...overrides,
  };
}

function products(entries: [string, number, string][]): Map<string, StoreProductInfo> {
  return new Map(
    entries.map(([planId, cents, display]) => [planId, { planId, productId: `p.${planId}`, displayPrice: display, priceCents: cents, currency: 'EUR' }]),
  );
}

const ALL = products([
  ['premium_monthly', 499, '4,99 €'],
  ['premium_quarterly', 1299, '12,99 €'],
  ['premium_annual', 3999, '39,99 €'],
]);

describe('composeOffer — Bizum y «que pague mi familiar»', () => {
  it('Bizum: cualquier plan (pago único); familiar: los mismos planes que la tarjeta', () => {
    const o = composeOffer({ catalog: catalog({ bizumPayments: true, familyPayments: true }), platform: null, products: new Map(), cardProvider: 'Stripe' });
    expect(o.plans.map((p) => p.channels)).toEqual([['card', 'bizum', 'family'], ['bizum'], ['bizum']]);
    expect(o.bizum).toEqual({ provider: 'Stripe' });
    expect(o.family).toEqual({ provider: 'Stripe' });
  });

  it('sin permiso para pagar fuera de la tienda (tienda de publicación): ni Bizum ni familiar', () => {
    const o = composeOffer({ catalog: catalog({ bizumPayments: true, familyPayments: true }), platform: 'apple', products: ALL, cardProvider: null });
    expect(o.plans.every((p) => !p.channels.includes('bizum') && !p.channels.includes('family'))).toBe(true);
    expect(o.bizum).toBeNull();
    expect(o.family).toBeNull();
  });

  it('el servidor aún no los admite: no se ofrecen', () => {
    const o = composeOffer({ catalog: catalog({ checkoutAcceptsPlanId: true }), platform: null, products: new Map(), cardProvider: 'Stripe' });
    expect(o.plans.map((p) => p.channels)).toEqual([['card'], ['card'], ['card']]);
    expect([o.bizum, o.family]).toEqual([null, null]);
  });
});

describe('composeOffer — domiciliación bancaria y PayPal', () => {
  it('solo los planes que se pueden suscribir con tarjeta y solo si el servidor los admite', () => {
    const o = composeOffer({ catalog: catalog({ sepaPayments: true, paypalPayments: true }), platform: null, products: new Map(), cardProvider: 'Stripe' });
    expect(o.plans.map((p) => p.channels)).toEqual([['card', 'sepa', 'paypal'], [], []]);
    expect(o.sepa).toEqual({ provider: 'Stripe' });
    expect(o.paypal).toEqual({ provider: 'Stripe' });
  });

  it('con planId en el servidor, también trimestral y anual', () => {
    const o = composeOffer({ catalog: catalog({ sepaPayments: true, paypalPayments: true, checkoutAcceptsPlanId: true }), platform: null, products: new Map(), cardProvider: 'Stripe' });
    expect(o.plans.every((p) => p.channels.includes('sepa') && p.channels.includes('paypal'))).toBe(true);
  });

  it('sin pago fuera de la tienda (o sin activarlos): no se ofrecen', () => {
    const store = composeOffer({ catalog: catalog({ sepaPayments: true, paypalPayments: true }), platform: 'apple', products: ALL, cardProvider: null });
    expect([store.sepa, store.paypal]).toEqual([null, null]);
    const off = composeOffer({ catalog: catalog(), platform: null, products: new Map(), cardProvider: 'Stripe' });
    expect([off.sepa, off.paypal]).toEqual([null, null]);
  });
});

describe('composeOffer — catálogo visible y cobro solo por canales verificados', () => {
  it('tienda con los 3 productos: 3 planes con los precios del tablero y el anual destacado', () => {
    const o = composeOffer({ catalog: catalog(), platform: 'apple', products: ALL, cardProvider: null });
    expect(o.plans.map((p) => [p.plan.period, p.displayPrice, p.channels.join('+')])).toEqual([
      ['monthly', '4,99 €', 'store'],
      ['quarterly', '12,99 €', 'store'],
      ['annual', '39,99 €', 'store'],
    ]);
    expect(o.plans.map((p) => p.plan.savingsLabel)).toEqual([null, 'Ahorra un 13\u00A0% aprox.', 'Ahorra un 33\u00A0% aprox.']);
    expect(o.plans.find((p) => p.plan.highlighted)?.plan.period).toBe('annual');
    expect(o.store).toEqual({ platform: 'apple' });
    expect(o.card).toBeNull();
  });

  it('solo tarjeta y create-checkout sin planId: muestra los 3 y solo el mensual es cobrable', () => {
    const o = composeOffer({ catalog: catalog(), platform: null, products: new Map(), cardProvider: 'Stripe' });
    expect(o.plans.map((p) => p.plan.period)).toEqual(['monthly', 'quarterly', 'annual']);
    expect(o.plans.map((p) => p.channels)).toEqual([['card'], [], []]);
    expect(o.store).toBeNull();
    expect(o.card).toEqual({ provider: 'Stripe' });
  });

  it('tarjeta con create-checkout que ya acepta planId: los 3 planes con tarjeta', () => {
    const o = composeOffer({ catalog: catalog({ checkoutAcceptsPlanId: true }), platform: null, products: new Map(), cardProvider: 'Stripe' });
    expect(o.plans.map((p) => p.plan.period)).toEqual(['monthly', 'quarterly', 'annual']);
  });

  it('tienda + tarjeta: el mensual por las dos vías; trimestral y anual solo por la tienda', () => {
    const o = composeOffer({ catalog: catalog(), platform: 'google', products: ALL, cardProvider: 'Stripe' });
    expect(o.plans.map((p) => p.channels.join('+'))).toEqual(['store+card', 'store', 'store']);
  });

  it('un producto que falta en la tienda sigue visible, pero no se puede continuar con él', () => {
    const o = composeOffer({
      catalog: catalog(),
      platform: 'apple',
      products: products([['premium_monthly', 499, '4,99 €'], ['premium_annual', 3999, '39,99 €']]),
      cardProvider: null,
    });
    expect(o.plans.map((p) => p.plan.period)).toEqual(['monthly', 'quarterly', 'annual']);
    expect(o.plans.map((p) => p.channels)).toEqual([['store'], [], ['store']]);
  });

  it('sin ninguna vía: los 3 planes siguen visibles, pero ninguno permite cobrar', () => {
    const o = composeOffer({ catalog: catalog(), platform: null, products: new Map(), cardProvider: null });
    expect(o.plans.map((p) => p.plan.period)).toEqual(['monthly', 'quarterly', 'annual']);
    expect(o.plans.every((p) => p.channels.length === 0)).toBe(true);
    expect(o.store).toBeNull();
    expect(o.card).toBeNull();
  });

  it('se muestran y comparan los precios que cobrará la tienda (si difieren del catálogo)', () => {
    const o = composeOffer({
      catalog: catalog(),
      platform: 'apple',
      products: products([
        ['premium_monthly', 599, '5,99 €'],
        ['premium_quarterly', 1299, '12,99 €'],
        ['premium_annual', 3999, '39,99 €'],
      ]),
      cardProvider: null,
    });
    expect(o.plans[0].displayPrice).toBe('5,99 €');
    // 12,99 frente a 3 × 5,99 = 17,97 → 28 %; 39,99 frente a 12 × 5,99 = 71,88 → 44 %.
    expect(o.plans.map((p) => p.plan.savingsLabel)).toEqual([null, 'Ahorra un 28\u00A0% aprox.', 'Ahorra un 44\u00A0% aprox.']);
  });

  it('planes no contratables no aparecen', () => {
    const plans = FALLBACK_PLANS.map((p) => (p.period === 'quarterly' ? { ...p, purchasable: false } : p));
    const o = composeOffer({ catalog: catalog({}, plans), platform: 'apple', products: ALL, cardProvider: null });
    expect(o.plans.map((p) => p.plan.period)).toEqual(['monthly', 'annual']);
  });
});
