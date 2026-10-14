/**
 * Oferta de Premium (función pura, sin red): qué planes se pueden contratar y por qué vías.
 * La usa PurchaseService y se prueba en __tests__/offer.test.ts.
 */
import { formatPrice } from '../utils/format';
import { withEffectivePrices } from './planCatalog';
import type { StoreProductInfo } from './billing/types';
import type { PaymentChannelId, PlanOffer, PlansCatalog, PurchaseOffer, StorePlatform } from '../types';

/**
 * Oferta a partir del catálogo y de lo disponible en este teléfono (función pura, probada en
 * __tests__/offer.test.ts): cada plan solo por las vías que pueden cobrarlo de verdad.
 */
export function composeOffer({
  catalog,
  platform,
  products,
  cardProvider,
}: {
  catalog: PlansCatalog;
  platform: StorePlatform | null;
  products: Map<string, StoreProductInfo>;
  cardProvider: string | null;
}): PurchaseOffer {
  // Los precios que se muestran y comparan son los que se cobrarán (los de la tienda si se paga en ella).
  const prices = new Map<string, number>();
  products.forEach((info, planId) => {
    if (info.priceCents) prices.set(planId, info.priceCents);
  });
  const plans = withEffectivePrices(catalog.plans, prices);

  const offers: PlanOffer[] = [];
  for (const plan of plans) {
    if (!plan.purchasable) continue;
    const product = platform ? products.get(plan.id) : undefined;
    const channels: PaymentChannelId[] = [];
    if (product) channels.push('store');
    if (cardProvider && (plan.period === 'monthly' || catalog.checkoutAcceptsPlanId)) channels.push('card');
    if (!channels.length) continue;
    offers.push({
      plan,
      displayPrice: product?.displayPrice ?? formatPrice(plan.priceCents),
      priceCents: plan.priceCents,
      channels,
    });
  }

  return {
    catalog,
    plans: offers,
    store: platform && offers.some((o) => o.channels.includes('store')) ? { platform } : null,
    card: cardProvider && offers.some((o) => o.channels.includes('card')) ? { provider: cardProvider } : null,
  };
}

