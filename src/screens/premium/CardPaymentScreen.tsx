/**
 * /payment-card?plan=<planId>[&method=bizum|sepa|paypal] — pago en la PÁGINA SEGURA de Stripe (tablero: pantalla 7).
 *
 *  - tarjeta (sin `method`): suscripción; la tarjeta queda guardada en Stripe para las renovaciones.
 *  - `bizum`: pago ÚNICO del periodo (Stripe no admite Bizum recurrente): no se renueva solo.
 *  - `sepa`: domiciliación bancaria; Stripe pide el IBAN y la orden de domiciliación. Misma suscripción mensual.
 *  - `paypal`: PayPal con cobro recurrente; la persona entra en su cuenta de PayPal. Misma suscripción mensual.
 *
 * Por seguridad (y por las reglas del proyecto: el frontend no programa Stripe ni toca tarjetas ni cuentas), los
 * datos se escriben en la página segura de Stripe, que se abre dentro de la app al pulsar «Pagar». MediClaro
 * nunca ve ni guarda la tarjeta, el IBAN ni la contraseña de PayPal.
 * Antes de salir al pago se muestra el aviso obligatorio de Apple/Google cuando corresponde (UE/EEE).
 */
import { type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { AppText, Card, EmptyState, ErrorState, Icon, InfoBanner, PrimaryButton, Screen, TextButton, type IconName } from '../../components';
import { FadeIn } from '../../components/Motion';
import { FALLBACK_OVERAGE_CENTS } from '../../config/plans';
import { CARD_PAYMENTS_ENABLED } from '../../config/app';
import { useAppTheme, useAsync, useEntitlement } from '../../hooks';
import { DemoMode, PurchaseService } from '../../services';
import { formatPrice } from '../../utils/format';
import type { HostedPaymentMethod, PurchaseOffer } from '../../types';
import { BrandHeader, CardBrands, OneTimeNote, PlanSummary, PremiumSkeleton, RenewalNote, SecureNote, StatusHero, periodSpan } from './parts';
import { usePurchase } from './usePurchase';

function firstParam(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

function methodOf(raw: string | undefined): HostedPaymentMethod {
  return raw === 'bizum' || raw === 'sepa' || raw === 'paypal' ? raw : 'card';
}

/** Textos de cada forma de pago (la pantalla y la página segura son las mismas). */
const METHOD: Record<HostedPaymentMethod, { title: string; noun: string; icon: IconName; color: string; tint: string; payLabel: (price: string) => string }> = {
  card: { title: 'Pago con tarjeta', noun: 'con tarjeta', icon: 'card', color: '#2563EB', tint: '#DBEAFE', payLabel: (p) => `Pagar ${p}` },
  bizum: { title: 'Pago con Bizum', noun: 'con Bizum', icon: 'phone-portrait', color: '#0E9F9A', tint: '#E6F6F5', payLabel: (p) => `Pagar ${p} con Bizum` },
  sepa: { title: 'Domiciliación bancaria', noun: 'por domiciliación bancaria', icon: 'business', color: '#0F766E', tint: '#CCFBF1', payLabel: (p) => `Domiciliar ${p}` },
  paypal: { title: 'Pago con PayPal', noun: 'con PayPal', icon: 'logo-paypal', color: '#003087', tint: '#E0E7FF', payLabel: (p) => `Pagar ${p} con PayPal` },
};

function providerOf(offer: PurchaseOffer | null, method: HostedPaymentMethod): string {
  const entry = offer ? (method === 'card' ? offer.card : offer[method]) : null;
  return entry?.provider ?? 'Stripe';
}

export default function CardPaymentRoute() {
  return CARD_PAYMENTS_ENABLED ? <CardPaymentScreen /> : <Redirect href="/premium" />;
}

function CardPaymentScreen() {
  const router = useRouter();
  const theme = useAppTheme();
  const c = theme.colors;
  const params = useLocalSearchParams<{ plan?: string | string[]; method?: string | string[] }>();
  const planId = firstParam(params.plan);
  const method = methodOf(firstParam(params.method));
  const copy = METHOD[method];
  const offer = useAsync(() => PurchaseService.getOffer(), []);
  const purchase = usePurchase();
  const entitlement = useEntitlement();

  const entry = offer.data?.plans.find((o) => o.plan.id === planId && o.channels.includes(method)) ?? null;
  const provider = providerOf(offer.data ?? null, method);
  const premiumLimits = offer.data?.catalog.premiumLimits ?? null;

  let body: ReactNode;
  let footer: ReactNode = null;

  // Con Bizum se puede pagar el periodo siguiente antes de que termine el que ya está pagado con Bizum.
  const renewingBizum = method === 'bizum' && !!entitlement.subscription?.oneTimePayment;
  if (entitlement.status === 'ready' && entitlement.isPremium && !renewingBizum) {
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
        title={`No se puede pagar este plan ${copy.noun}`}
        message="Elige otra forma de pago u otro plan."
        action={{ label: 'Ver las formas de pago', onPress: () => router.back() }}
      />
    );
  } else {
    const overage =
      method === 'card' && entry.plan.period === 'monthly' && premiumLimits?.overageEnabled
        ? `Incluye ${premiumLimits.monthlyScans} identificaciones al mes. Con tarjeta, cada identificación adicional cuesta ${formatPrice(FALLBACK_OVERAGE_CENTS)}${premiumLimits.hardCap ? ` (máximo ${premiumLimits.hardCap} al mes)` : ''}.`
        : null;
    const howTo: Record<HostedPaymentMethod, { title: string; text: string }> = {
      card: {
        title: 'Datos de la tarjeta',
        text: `Al pulsar «Pagar» se abre la página segura de ${provider} dentro de la app. Allí escribes el número, la caducidad y el CVC. MediClaro nunca ve ni guarda tu tarjeta.`,
      },
      bizum: {
        title: 'Cómo se paga con Bizum',
        text: `1. Al pulsar «Pagar» se abre la página segura de ${provider}.\n2. Escribe el número de móvil que tienes en Bizum.\n3. Acepta el pago en la app de tu banco. Y listo.`,
      },
      sepa: {
        title: 'Cómo se domicilia',
        text: `1. Ten a mano tu IBAN: empieza por ES y lo ves en la libreta o en la app de tu banco.\n2. Al pulsar «Domiciliar» se abre la página segura de ${provider}: escribe el IBAN y el nombre del titular.\n3. Acepta la orden de domiciliación. El recibo llegará a tu banco, como el de la luz.`,
      },
      paypal: {
        title: 'Cómo se paga con PayPal',
        text: `1. Al pulsar «Pagar» se abre la página segura de ${provider}.\n2. Entra en tu cuenta de PayPal (la contraseña la escribes en PayPal, nunca en MediClaro).\n3. Acepta la suscripción. Y listo.`,
      },
    };
    const keepNote: Record<HostedPaymentMethod, string> = {
      card: `Tu tarjeta quedará guardada de forma segura en ${provider} para las renovaciones. Puedes cambiarla cuando quieras en «Gestionar suscripción».`,
      bizum: `Es un pago único por ${periodSpan(entry.plan.period)}: no se renueva solo ni se guarda ninguna tarjeta. Antes de que termine te avisaremos para que lo renueves si quieres.`,
      sepa: 'Se cobra en tu cuenta en cada renovación. El primer cobro puede tardar unos días en confirmarse. Tu banco te permite pedir la devolución de un recibo en las 8 semanas siguientes.',
      paypal: 'Se cobra en tu cuenta de PayPal en cada renovación. Puedes cancelar la suscripción cuando quieras desde MediClaro o desde PayPal.',
    };
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
              <View style={[styles.cardIcon, { backgroundColor: copy.tint }]}>
                <Icon name={copy.icon} size={26} color={copy.color} />
              </View>
              <View style={[styles.flex, { gap: 4 }]}>
                <AppText variant="bodyStrong" color="heading">
                  {howTo[method].title}
                </AppText>
                <AppText variant="caption" color="textSecondary">
                  {howTo[method].text}
                </AppText>
              </View>
            </View>
            {method === 'card' ? (
              <View style={{ marginTop: theme.spacing.sm }}>
                <CardBrands compact />
              </View>
            ) : null}
          </Card>
        </FadeIn>
        <FadeIn delay={160}>
          <View style={styles.saveRow} accessible testID="card-keep-note">
            <Icon name="checkmark-circle" size={22} color={c.successStrong} />
            <AppText variant="caption" color="textSecondary" style={styles.flex}>
              {keepNote[method]}
            </AppText>
          </View>
        </FadeIn>
        {renewingBizum ? (
          <InfoBanner
            tone="info"
            message={`Ya tienes Premium pagado con Bizum. Este pago se suma al final: tendrás ${periodSpan(entry.plan.period)} más.`}
          />
        ) : null}
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
          label={copy.payLabel(entry.displayPrice)}
          icon="lock-closed"
          onPress={() => void purchase.pay(method, entry.plan.id)}
          loading={purchase.busy === method}
          disabled={!!purchase.busy}
          testID="payment-pay"
        />
        {method === 'bizum' ? <OneTimeNote offer={entry} /> : <RenewalNote offer={entry} />}
        <SecureNote text={`Powered by ${provider} · Pago seguro y encriptado`} />
      </>
    );
  }

  return (
    <Screen gradient="soft" header={<BrandHeader fallbackHref="/premium" />} footer={footer} testID="card-screen">
      <View style={[styles.head, { gap: theme.spacing.xxs, marginBottom: theme.spacing.lg }]}>
        <AppText variant="title" align="center" accessibilityRole="header">
          {copy.title}
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
