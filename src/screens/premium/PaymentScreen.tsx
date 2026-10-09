/**
 * /payment?plan=<planId> — «¿Cómo quieres pagar?» (tablero: pantalla 5), rediseñada el 09/10/2026 para que una
 * persona mayor elija con tranquilidad y confíe en el pago.
 *
 *  Paso 2 de 3 (Plan → Pago → ¡Listo!) con el plan elegido arriba y las formas de pago agrupadas:
 *  1. «Lo más rápido»: Apple / Google Play (hoja oficial de la tienda), tarjeta y Bizum (pago único del periodo).
 *  2. «Sin tarjeta»: domiciliación bancaria (el recibo llega al banco, como la luz) y PayPal.
 *  3. «Con ayuda»: «Que pague mi familiar o cuidador/a» (se le envía un enlace seguro).
 *  Debajo, el panel «Pago 100 % seguro» (solo afirmaciones ciertas) y «¿Te ayudamos a pagar?».
 *
 * Cada vía solo aparece si este teléfono y el servidor pueden cobrarla de verdad (PurchaseService.getOffer). Las vías
 * fuera de la tienda tienen las mismas condiciones que la tarjeta (normas de Apple/Google en la UE). MediClaro nunca ve
 * ni guarda tarjetas, cuentas bancarias ni contraseñas: todo se escribe en la página segura del proveedor.
 */
import { type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { AppText, EmptyState, ErrorState, Icon, InfoBanner, PrimaryButton, Screen, TextButton, type IconName } from '../../components';
import { FadeIn, stagger } from '../../components/Motion';
import { PURCHASES_ENABLED } from '../../config/app';
import { useAppTheme, useAsync, useEntitlement } from '../../hooks';
import { DemoMode, PurchaseService } from '../../services';
import type { PlanOffer, StorePlatform } from '../../types';
import {
  BrandHeader,
  CardBrands,
  LegalLinks,
  MethodCard,
  periodSpan,
  PlanSummary,
  PremiumPill,
  PremiumSkeleton,
  RenewalNote,
  StatusHero,
} from './parts';
import { PaymentHelp, TrustPanel } from './TrustPanel';
import { usePurchase } from './usePurchase';
import { IS_EXPO_GO } from '../../utils/runtime';

const STORE_METHOD: Record<StorePlatform, { title: string; subtitle: string; icon: 'logo-apple' | 'logo-google-playstore'; color: string; bg: string }> = {
  apple: { title: 'Pagar con Apple', subtitle: 'Con tu Apple ID y Face ID, en un toque.', icon: 'logo-apple', color: '#000000', bg: '#F1F5F9' },
  google: {
    title: 'Pagar con Google Play',
    subtitle: 'Con tu cuenta de Google, en un toque.',
    icon: 'logo-google-playstore',
    color: '#059669',
    bg: '#ECFDF5',
  },
};

const BADGE = {
  recommended: { label: 'Recomendado', color: '#1D4ED8', bg: '#DBEAFE' },
  noCard: { label: 'Sin tarjeta', color: '#0F766E', bg: '#CCFBF1' },
  easiest: { label: 'Lo más fácil', color: '#6D28D9', bg: '#EDE9FE' },
};

function firstParam(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

export default function PaymentScreenRoute() {
  return PURCHASES_ENABLED ? <PaymentMethodsScreen /> : <Redirect href="/premium" />;
}

/** Plan → Pago → ¡Listo!: dónde está la persona dentro de la contratación. */
function Steps() {
  const theme = useAppTheme();
  const c = theme.colors;
  const steps = ['Plan', 'Pago', '¡Listo!'];
  return (
    <View style={styles.steps} accessible accessibilityLabel="Paso 2 de 3: forma de pago" testID="payment-steps">
      {steps.map((label, i) => {
        const done = i === 0;
        const current = i === 1;
        return (
          <View key={label} style={styles.stepItem}>
            {i > 0 ? <View style={[styles.stepLine, { backgroundColor: i === 1 ? c.primary : c.border }]} /> : null}
            <View
              style={[
                styles.stepDot,
                {
                  backgroundColor: done || current ? c.primary : c.surface,
                  borderColor: done || current ? c.primary : c.borderStrong,
                },
              ]}
            >
              {done ? (
                <Icon name="checkmark" size={14} color={c.onPrimary} />
              ) : (
                <AppText variant="small" style={{ color: current ? c.onPrimary : c.textSecondary }}>
                  {String(i + 1)}
                </AppText>
              )}
            </View>
            <AppText variant="small" color={current ? 'heading' : 'textSecondary'}>
              {label}
            </AppText>
          </View>
        );
      })}
    </View>
  );
}

function Group({ icon, title, children, testID }: { icon: IconName; title: string; children: ReactNode; testID?: string }) {
  const theme = useAppTheme();
  return (
    <View style={{ gap: theme.spacing.sm }} testID={testID}>
      <View style={styles.groupTitle} accessibilityRole="header">
        <Icon name={icon} size={18} color={theme.colors.textSecondary} />
        <AppText variant="captionStrong" color="textSecondary" style={styles.upper}>
          {title}
        </AppText>
      </View>
      {children}
    </View>
  );
}

function PaymentMethodsScreen() {
  const router = useRouter();
  const theme = useAppTheme();
  const params = useLocalSearchParams<{ plan?: string | string[] }>();
  const planId = firstParam(params.plan);
  const offer = useAsync(() => PurchaseService.getOffer(), []);
  const purchase = usePurchase();
  const entitlement = useEntitlement();

  const entry: PlanOffer | null = offer.data?.plans.find((o) => o.plan.id === planId) ?? null;
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
    const has = (channel: PlanOffer['channels'][number]) => entry.channels.includes(channel);
    const storeMethod = store && has('store') ? STORE_METHOD[store.platform] : null;
    const cardAvailable = !!card && has('card');
    const bizumAvailable = !!offer.data.bizum && has('bizum');
    const sepaAvailable = !!offer.data.sepa && has('sepa');
    const paypalAvailable = !!offer.data.paypal && has('paypal');
    const familyAvailable = !!offer.data.family && has('family');
    const provider = card?.provider ?? offer.data.bizum?.provider ?? 'Stripe';
    const anyHosted = cardAvailable || bizumAvailable || sepaAvailable || paypalAvailable || familyAvailable;
    const nothing = !storeMethod && !anyHosted;
    const goHosted = (method: 'card' | 'bizum' | 'sepa' | 'paypal') =>
      router.push({ pathname: '/payment-card', params: method === 'card' ? { plan: entry.plan.id } : { plan: entry.plan.id, method } });
    const goFamily = () => router.push({ pathname: '/family-pay', params: { plan: entry.plan.id } });
    let order = 0;
    const next = () => stagger(order++, 70, 60);

    body = (
      <View style={{ gap: theme.spacing.lg }}>
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
        {nothing ? (
          <InfoBanner
            tone="info"
            message={IS_EXPO_GO
              ? 'En la vista previa de Expo Go no se puede pagar: la compra se hace con Apple o Google Play dentro de la app MediClaro instalada.'
              : 'Ahora mismo no hay ninguna forma de pago disponible en este teléfono. Inténtalo de nuevo más tarde.'}
          />
        ) : null}

        {storeMethod || cardAvailable || bizumAvailable ? (
          <Group icon="flash" title="Lo más rápido" testID="payment-group-fast">
            {storeMethod ? (
              <FadeIn delay={next()}>
                <MethodCard
                  icon={storeMethod.icon}
                  iconColor={storeMethod.color}
                  iconBg={storeMethod.bg}
                  title={storeMethod.title}
                  subtitle={storeMethod.subtitle}
                  badge={BADGE.recommended}
                  onPress={() => void purchase.pay('store', entry.plan.id)}
                  loading={purchase.busy === 'store'}
                  disabled={!!purchase.busy && purchase.busy !== 'store'}
                  testID="payment-method-store"
                />
              </FadeIn>
            ) : null}
            {cardAvailable ? (
              <FadeIn delay={next()}>
                <MethodCard
                  icon="card"
                  iconColor="#FFFFFF"
                  iconBg="#2563EB"
                  title="Tarjeta de débito o crédito"
                  subtitle="Escribes la tarjeta en la página segura de pago. Nosotros nunca la vemos."
                  badge={storeMethod ? undefined : BADGE.recommended}
                  extra={<CardBrands compact />}
                  onPress={() => goHosted('card')}
                  disabled={!!purchase.busy}
                  testID="payment-method-card"
                />
              </FadeIn>
            ) : null}
            {bizumAvailable ? (
              <FadeIn delay={next()}>
                <MethodCard
                  icon="phone-portrait"
                  iconColor="#FFFFFF"
                  iconBg="#0E9F9A"
                  title="Bizum"
                  subtitle={`Con tu móvil y la app de tu banco. Pago único por ${periodSpan(entry.plan.period)}: no se renueva solo.`}
                  onPress={() => goHosted('bizum')}
                  disabled={!!purchase.busy}
                  testID="payment-method-bizum"
                />
              </FadeIn>
            ) : null}
          </Group>
        ) : null}

        {sepaAvailable || paypalAvailable ? (
          <Group icon="wallet" title="Sin tarjeta" testID="payment-group-nocard">
            {sepaAvailable ? (
              <FadeIn delay={next()}>
                <MethodCard
                  icon="business"
                  iconColor="#FFFFFF"
                  iconBg="#0F766E"
                  title="Domiciliación bancaria"
                  subtitle="El recibo llega a tu banco cada mes, como el de la luz. Solo necesitas tu IBAN."
                  badge={BADGE.noCard}
                  onPress={() => goHosted('sepa')}
                  disabled={!!purchase.busy}
                  testID="payment-method-sepa"
                />
              </FadeIn>
            ) : null}
            {paypalAvailable ? (
              <FadeIn delay={next()}>
                <MethodCard
                  icon="logo-paypal"
                  iconColor="#FFFFFF"
                  iconBg="#003087"
                  title="PayPal"
                  subtitle="Entras en tu cuenta de PayPal y aceptas. Sin escribir ninguna tarjeta."
                  onPress={() => goHosted('paypal')}
                  disabled={!!purchase.busy}
                  testID="payment-method-paypal"
                />
              </FadeIn>
            ) : null}
          </Group>
        ) : null}

        {familyAvailable ? (
          <Group icon="heart" title="Con ayuda" testID="payment-group-help">
            <FadeIn delay={next()}>
              <MethodCard
                icon="people"
                iconColor="#FFFFFF"
                iconBg="#7C3AED"
                title="Que pague mi familiar o cuidador/a"
                subtitle="Tú disfrutas de Premium y tu familiar paga desde su móvil con un enlace seguro."
                badge={BADGE.easiest}
                onPress={goFamily}
                disabled={!!purchase.busy}
                testID="payment-method-family"
              />
            </FadeIn>
          </Group>
        ) : null}

        {nothing ? null : (
          <FadeIn delay={next()}>
            <TrustPanel provider={provider} />
          </FadeIn>
        )}
        {nothing ? null : <PaymentHelp onFamily={familyAvailable ? goFamily : undefined} />}
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
          Elige la forma que te resulte más cómoda. Todas son seguras.
        </AppText>
        <Steps />
      </View>
      {body}
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: { alignItems: 'center' },
  steps: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'center', marginTop: 10 },
  stepItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  stepLine: { width: 22, height: 2, borderRadius: 1, marginHorizontal: 6 },
  stepDot: { width: 24, height: 24, borderRadius: 12, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  groupTitle: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingLeft: 2 },
  upper: { textTransform: 'uppercase', letterSpacing: 0.6 },
});
