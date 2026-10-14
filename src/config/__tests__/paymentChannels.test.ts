import { parsePaymentChannels } from '../app';

describe('parsePaymentChannels (EXPO_PUBLIC_PAYMENTS_MODE)', () => {
  it('sin definir: tienda + tarjeta en desarrollo; solo tienda en publicación', () => {
    expect(parsePaymentChannels(undefined, true)).toEqual(['store', 'card']);
    expect(parsePaymentChannels(undefined, false)).toEqual(['store']);
    expect(parsePaymentChannels('', false)).toEqual(['store']);
  });
  it('"none": app gratuita sin compras', () => {
    expect(parsePaymentChannels('none', true)).toEqual([]);
  });
  it('valores de eas.json y compatibilidad con "stripe" de la versión 1.1', () => {
    expect(parsePaymentChannels('store,stripe', false)).toEqual(['store', 'card']);
    expect(parsePaymentChannels('store', false)).toEqual(['store']);
    expect(parsePaymentChannels('stripe', false)).toEqual(['card']);
    expect(parsePaymentChannels(' Store + Stripe ', false)).toEqual(['store', 'card']);
  });
});
