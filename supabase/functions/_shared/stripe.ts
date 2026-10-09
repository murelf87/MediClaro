import Stripe from 'npm:stripe@17';

export const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
  httpClient: Stripe.createFetchHttpClient(),
});
export const cryptoProvider = Stripe.createSubtleCryptoProvider();

export const PRICE_BASE = Deno.env.get('STRIPE_PRICE_BASE')!;       // 4,99 €/mes (licensed)
export const PRICE_METERED = Deno.env.get('STRIPE_PRICE_METERED') ?? ''; // opcional: 0,05 €/foto extra (Premium es ilimitado)
export const METER_EVENT = Deno.env.get('STRIPE_METER_EVENT') ?? 'mediclaro_escaneo_extra';
