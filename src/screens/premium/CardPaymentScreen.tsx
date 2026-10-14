/**
 * /payment-card?plan=<planId> — «Pago con tarjeta» (tablero: pantalla 7), procesado por Stripe.
 *
 * Por seguridad (y por las reglas del proyecto: el frontend no programa Stripe ni toca tarjetas), los datos
 * de la tarjeta se escriben en la PÁGINA SEGURA DE STRIPE, que se abre dentro de la app al pulsar «Pagar».
 * MediClaro nunca ve ni guarda la tarjeta. Esta pantalla muestra lo que se va a pagar, cómo se renueva y
 * que la tarjeta queda guardada en Stripe para las renovaciones (las suscripciones lo necesitan).
 * Antes de salir al pago se muestra el aviso obligatorio de Apple/Google cuando corresponde (UE/EEE).
 */
import { type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { AppText, Card, EmptyState, ErrorState, Icon, InfoBanner, PrimaryButton, Screen, TextButton } from '../../components';
import { FadeIn } from '../../components/Motion';
import { FALLBACK_OVERAGE_CENTS } from '../../config/plans';
import { CARD_PAYMENTS_ENABLED } from '../../config/app';
import { useAppTheme, useAsync, useEntitlement } from '../../hooks';
import { DemoMode, PurchaseService } from '../../services';
import { formatPrice } from '../../utils/format';
import { BrandHeader, CardBrands, PlanSummary, PremiumSkeleton, RenewalNote, SecureNote, StatusHero } from './parts';
import { usePurchase } from './usePurchase';

function firstParam(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

export default function CardPaymentRoute() {
  return CARD_PAYMENTS_ENABLED ? <CardPaymentScreen /> : <Redirect href="/premium" />;
}

function CardPaymentScreen() {
  const router = useRouter();
  const theme = useAppTheme();
  const c = theme.colors;
  const params = useLocalSearchParams<{ plan?: string | string[] }>();
  const planId = firstParam(params.plan);
  const offer = useAsync(() => PurchaseService.getOffer(), []);
  const purchase = usePurchase();
  const entitlement = useEntitlement();

  const entry = offer.data?.plans.find((o) => o.plan.id === planId && o.channels.includes('card')) ?? null;
  const provider = offer.data?.card?.provider ?? 'Stripe';
  const premiumLimits = offer.data?.catalog.premiumLimits ?? null;

  let body: ReactNode;
  let footer: ReactNode = null;

  if (entitlement.status === 'ready' && entitlement.isPremium) {
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
        <PrimaryButton label="Ver mi suscripción" icon="card-outline" onPress={() => router.replace('/premium')} testID="card-see-subscription" />
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
        title="No se puede pagar este plan con tarjeta"
        message="Elige otra forma de pago u otro plan."
        action={{ label: 'Ver los planes', onPress: () => router.replace('/premium') }}
      />
    );
  } else {
    const overage =
      entry.plan.period === 'monthly' && premiumLimits?.overageEnabled
        ? `Incluye ${premiumLimits.monthlyScans} identificaciones al mes. Con tarjeta, cada identificación adicional cuesta ${formatPrice(FALLBACK_OVERAGE_CENTS)}${premiumLimits.hardCap ? ` (máximo ${premiumLimits.hardCap} al mes)` : ''}.`
        : null;
    body = (
      <View style={{ gap: theme.spacing.md }}>
        <PlanSummary offer={entry} />
        {DemoMode.isActive() ? <InfoBanner tone="warning" message="Modo demostración: no se realiza ningún cobro real." /> : null}
        {purchase.notice ? (
          <InfoBanner
            tone={purchase.notice.tone}
            title={purchase.notice.title}
            message={purchase.notice.message}
            action={purchase.notice.action}
          />
        ) : null}
        <FadeIn delay={80}>
          <Card>
            <View style={styles.row}>
              <View style={[styles.cardIcon, { backgroundColor: c.primaryTint }]}>
                <Icon name="card" size={26} color={c.primary} />
              </View>
              <View style={[styles.flex, { gap: 4 }]}>
                <AppText variant="bodyStrong" color="heading">
                  Datos de la tarjeta
                </AppText>
                <AppText variant="caption" color="textSecondary">
                  {`Al pulsar «Pagar» se abre la página segura de ${provider} dentro de la app. Allí escribes el número, la caducidad y el CVC. MediClaro nunca ve ni guarda tu tarjeta.`}
                </AppText>
              </View>
            </View>
            <View style={{ marginTop: theme.spacing.sm }}>
              <CardBrands compact />
            </View>
          </Card>
        </FadeIn>
        <FadeIn delay={160}>
          <View style={styles.saveRow} accessible>
            <Icon name="checkmark-circle" size={22} color={c.successStrong} />
            <AppText variant="caption" color="textSecondary" style={styles.flex}>
              {`Tu tarjeta quedará guardada de forma segura en ${provider} para las renovaciones. Puedes cambiarla cuando quieras en «Gestionar suscripción».`}
            </AppText>
          </View>
        </FadeIn>
        {overage ? (
          <AppText variant="caption" color="textSecondary" testID="card-overage">
            {overage}
          </AppText>
        ) : null}
      </View>
    );
    footer = (
      <>
        <PrimaryButton
          label={`Pagar ${entry.displayPrice}`}
          icon="lock-closed"
          onPress={() => void purchase.pay('card', entry.plan.id)}
          loading={purchase.busy === 'card'}
          disabled={!!purchase.busy}
          testID="payment-pay"
        />
        <RenewalNote offer={entry} />
        <SecureNote text={`Powered by ${provider} · Pago seguro y encriptado`} />
      </>
    );
  }

  return (
    <Screen gradient="soft" header={<BrandHeader fallbackHref="/premium" />} footer={footer} testID="card-screen">
      <View style={[styles.head, { gap: theme.spacing.xxs, marginBottom: theme.spacing.lg }]}>
        <AppText variant="title" align="center" accessibilityRole="header">
          Pago con tarjeta
        </AppText>
        <SecureNote text={`Procesado de forma segura por ${provider}.`} />
      </View>
      {body}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  head: { alignItems: 'center' },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  cardIcon: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  saveRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
});
