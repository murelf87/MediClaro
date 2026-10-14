/**
 * /payment?plan=<planId> — «¿Cómo quieres pagar?» (tablero: pantalla 5).
 *
 *  - «Pagar con Apple» (iPhone) / «Pagar con Google Play» (Android): hoja oficial de la tienda (pantalla 6).
 *  - «Pagar con tarjeta»: pago seguro con Stripe (pantalla 7). Solo aparece donde las tiendas lo permiten y
 *    siempre con la compra de la tienda a la vista y con la misma importancia (normas de Apple en la UE).
 *  - Plan elegido con opción de cambiarlo, marcas de tarjeta, pago seguro, condiciones y «Restaurar compra».
 * MediClaro nunca ve ni guarda los datos de la tarjeta.
 */
import { type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { AppText, EmptyState, ErrorState, InfoBanner, PrimaryButton, Screen, TextButton } from '../../components';
import { FadeIn, stagger } from '../../components/Motion';
import { PURCHASES_ENABLED } from '../../config/app';
import { useAppTheme, useAsync, useEntitlement } from '../../hooks';
import { DemoMode, PurchaseService } from '../../services';
import type { StorePlatform } from '../../types';
import {
  BrandHeader,
  CardBrands,
  LegalLinks,
  MethodCard,
  PlanSummary,
  PremiumPill,
  PremiumSkeleton,
  RenewalNote,
  SecureNote,
  StatusHero,
} from './parts';
import { usePurchase } from './usePurchase';

const STORE_METHOD: Record<StorePlatform, { title: string; subtitle: string; icon: 'logo-apple' | 'logo-google-playstore'; color: string; bg: string }> = {
  apple: { title: 'Pagar con Apple', subtitle: 'Rápido y seguro. Con tu Apple ID.', icon: 'logo-apple', color: '#000000', bg: '#F1F5F9' },
  google: {
    title: 'Pagar con Google Play',
    subtitle: 'Rápido y seguro. Con tu cuenta de Google.',
    icon: 'logo-google-playstore',
    color: '#059669',
    bg: '#ECFDF5',
  },
};

function firstParam(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

export default function PaymentScreenRoute() {
  return PURCHASES_ENABLED ? <PaymentMethodsScreen /> : <Redirect href="/premium" />;
}

function PaymentMethodsScreen() {
  const router = useRouter();
  const theme = useAppTheme();
  const params = useLocalSearchParams<{ plan?: string | string[] }>();
  const planId = firstParam(params.plan);
  const offer = useAsync(() => PurchaseService.getOffer(), []);
  const purchase = usePurchase();
  const entitlement = useEntitlement();

  const entry = offer.data?.plans.find((o) => o.plan.id === planId) ?? null;
  const store = offer.data?.store ?? null;
  const card = offer.data?.card ?? null;

  let body: ReactNode;
  let footer: ReactNode = null;

  if (entitlement.status === 'ready' && entitlement.isPremium) {
    // Nunca se cobra dos veces: con Premium activo no se ofrece pagar.
    body = (
      <StatusHero
        icon="ribbon-outline"
        tone="primary"
        title="Ya tienes una suscripción activa"
        message="Tu MediClaro Premium ya está funcionando. No hace falta que pagues otra vez."
      />
    );
    footer = (
      <>
        <PrimaryButton label="Ver mi suscripción" icon="card-outline" onPress={() => router.replace('/premium')} testID="payment-see-subscription" />
        <TextButton label="Volver al inicio" onPress={() => router.replace('/(tabs)')} />
      </>
    );
  } else if (offer.status === 'loading') {
    body = <PremiumSkeleton />;
  } else if (offer.status === 'error' || !offer.data) {
    body = <ErrorState kind={offer.error?.kind} message={offer.error?.message} onRetry={() => void offer.reload()} />;
  } else if (!entry) {
    body = (
      <EmptyState
        icon="card-outline"
        title="Este plan no está disponible ahora mismo"
        message="Elige otro plan o inténtalo de nuevo más tarde."
        action={{ label: 'Ver los planes', onPress: () => router.replace('/premium') }}
      />
    );
  } else {
    const storeMethod = store && entry.channels.includes('store') ? STORE_METHOD[store.platform] : null;
    const cardAvailable = !!card && entry.channels.includes('card');
    body = (
      <View style={{ gap: theme.spacing.md }}>
        <PlanSummary offer={entry} onChange={() => router.back()} />
        {DemoMode.isActive() ? <InfoBanner tone="warning" message="Modo demostración: no se realiza ningún cobro real." /> : null}
        {purchase.notice ? (
          <InfoBanner
            tone={purchase.notice.tone}
            title={purchase.notice.title}
            message={purchase.notice.message}
            action={purchase.notice.action}
          />
        ) : null}
        <View style={{ gap: theme.spacing.sm }} accessibilityRole="list">
          {storeMethod ? (
            <FadeIn delay={stagger(0, 90, 80)}>
              <MethodCard
                icon={storeMethod.icon}
                iconColor={storeMethod.color}
                iconBg={storeMethod.bg}
                title={storeMethod.title}
                subtitle={storeMethod.subtitle}
                onPress={() => void purchase.pay('store', entry.plan.id)}
                loading={purchase.busy === 'store'}
                disabled={!!purchase.busy && purchase.busy !== 'store'}
                testID="payment-method-store"
              />
            </FadeIn>
          ) : null}
          {cardAvailable ? (
            <FadeIn delay={stagger(1, 90, 80)}>
              <MethodCard
                icon="card"
                iconColor="#FFFFFF"
                iconBg="#2563EB"
                title="Pagar con tarjeta"
                subtitle={`Visa, Mastercard y más. Procesado de forma segura por ${card?.provider ?? 'Stripe'}.`}
                onPress={() => router.push({ pathname: '/payment-card', params: { plan: entry.plan.id } })}
                disabled={!!purchase.busy}
                testID="payment-method-card"
              />
            </FadeIn>
          ) : null}
        </View>
        {cardAvailable ? <CardBrands /> : null}
        <SecureNote text="Tu pago es seguro y encriptado." />
        <LegalLinks onRestore={() => void purchase.restore()} restoring={purchase.busy === 'restore'} />
      </View>
    );
    footer = <RenewalNote offer={entry} />;
  }

  return (
    <Screen gradient="soft" header={<BrandHeader fallbackHref="/premium" />} footer={footer} testID="payment-screen">
      <View style={[styles.head, { gap: theme.spacing.xs, marginBottom: theme.spacing.lg }]}>
        <PremiumPill />
        <AppText variant="title" align="center" accessibilityRole="header" style={{ marginTop: theme.spacing.xs }}>
          ¿Cómo quieres pagar?
        </AppText>
        <AppText variant="body" color="textSecondary" align="center">
          Elige tu método de pago para activar MediClaro Premium.
        </AppText>
      </View>
      {body}
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: { alignItems: 'center' },
});
