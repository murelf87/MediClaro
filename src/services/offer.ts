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
    const cardPlan = !!cardProvider && (plan.period === 'monthly' || catalog.checkoutAcceptsPlanId);
    if (cardPlan) channels.push('card');
    // Bizum: pago único del periodo con el importe del catálogo del servidor (cualquier plan). Mismas condiciones de
    // tienda que la tarjeta (pago fuera de la tienda) y solo si el servidor lo admite.
    if (cardProvider && catalog.bizumPayments) channels.push('bizum');
    // Un familiar paga con un enlace la misma suscripción que con tarjeta.
    if (cardPlan && catalog.familyPayments) channels.push('family');
    // Domiciliación bancaria y PayPal: la misma suscripción que con tarjeta, cobrada por otra vía en la página segura.
    if (cardPlan && catalog.sepaPayments) channels.push('sepa');
    if (cardPlan && catalog.paypalPayments) channels.push('paypal');
    // El plan comercial se mantiene visible aunque todavía no exista una vía de cobro
    // verificada en este dispositivo. La UI lo muestra, pero impide continuar hasta que
    // Apple/Google/Stripe confirme al menos un canal real.
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
    bizum: cardProvider && offers.some((o) => o.channels.includes('bizum')) ? { provider: cardProvider } : null,
    family: cardProvider && offers.some((o) => o.channels.includes('family')) ? { provider: cardProvider } : null,
    sepa: cardProvider && offers.some((o) => o.channels.includes('sepa')) ? { provider: cardProvider } : null,
    paypal: cardProvider && offers.some((o) => o.channels.includes('paypal')) ? { provider: cardProvider } : null,
  };
}

