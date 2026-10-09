/**
 * /premium — Planes de MediClaro Premium (tablero: pantalla 4) o, con Premium, la gestión de la suscripción.
 *
 *  - «PREMIUM» · «Más claridad para tu salud» · la guía · planes Mensual / Trimestral / Anual con el ahorro
 *    calculado de los precios reales · ventajas · «Continuar con Premium».
 *  - Se muestran Mensual / Trimestral / Anual; cada plan solo se puede continuar cuando existe una vía de cobro verificada.
 *  - «Continuar con Premium»: si hay dos formas de pago → «¿Cómo quieres pagar?»; si solo la tienda → hoja de
 *    compra de Apple/Google al momento; si solo tarjeta → pago con tarjeta.
 *  - Información obligatoria junto al botón (precio, periodo, renovación automática) y enlaces a
 *    «Condiciones de suscripción» y «Política de privacidad»; «Restaurar compra».
 * Sin compras dentro de la app (EXPO_PUBLIC_PAYMENTS_MODE=none) → PlanScreen (sin precios ni botones de compra).
 */
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import {
  AppText,
  Badge,
  Card,
  ErrorState,
  Icon,
  InfoBanner,
  PrimaryButton,
  Screen,
  TextButton,
} from '../../components';
import { FadeIn } from '../../components/Motion';
import { GuideIllustration } from '../../components/Guide';
import { PURCHASES_ENABLED } from '../../config/app';
import { FALLBACK_OVERAGE_CENTS } from '../../config/plans';
import { useAppTheme, useAsync, useEntitlement, useSession } from '../../hooks';
import { DemoMode, PurchaseService, SubscriptionService } from '../../services';
import { showAlert } from '../../utils/dialogs';
import { formatDateLong, formatPrice } from '../../utils/format';
import type { Subscription } from '../../types';
import { UsageHint, UsageMeter } from '../medications/parts';
import PlanScreen from './PlanScreen';
import {
  BenefitGrid,
  BenefitList,
  BrandHeader,
  LegalLinks,
  PlanPicker,
  PremiumSkeleton,
  RenewalNote,
  defaultOffer,
  errorMessage,
} from './parts';
import { usePurchase } from './usePurchase';

function firstParam(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

export default function PremiumRoute() {
  // Sin forma de pagar en la app (compilación sin compras, o el servidor aún no comprueba compras de la tienda):
  // «Tu plan», sin precios ni botones de compra.
  const { canSell } = useEntitlement();
  return PURCHASES_ENABLED && canSell ? <PremiumScreen /> : <PlanScreen />;
}

function PremiumScreen() {
  const entitlement = useEntitlement();
  if (entitlement.status === 'ready' && entitlement.isPremium && entitlement.subscription) {
    return <ActivePremium subscription={entitlement.subscription} />;
  }
  return <Paywall />;
}

// ─── Planes ──────────────────────────────────────────────────────────────────

function Paywall() {
  const router = useRouter();
  const theme = useAppTheme();
  const { width } = useWindowDimensions();
  const { status, session } = useSession();
  const entitlement = useEntitlement();
  const params = useLocalSearchParams<{ plan?: string | string[] }>();
  const offer = useAsync(() => PurchaseService.getOffer(), []);
  const purchase = usePurchase();
  const [selectedId, setSelectedId] = useState<string | null>(firstParam(params.plan) ?? null);
  const [checkingPremium, setCheckingPremium] = useState(false);
  const [checkNotice, setCheckNotice] = useState<{ tone: 'success' | 'info' | 'danger'; message: string } | null>(null);

  const offers = offer.data?.plans ?? [];
  const selected = offers.find((o) => o.plan.id === selectedId) ?? defaultOffer(offers);
  useEffect(() => {
    if (selected && selected.plan.id !== selectedId) setSelectedId(selected.plan.id);
  }, [selected, selectedId]);

  const contentWidth = Math.min(width, theme.layout.maxContentWidth) - theme.layout.screenPaddingH * 2;
  const guideSize = theme.fontSize === 'muy_grande' ? 112 : Math.round(Math.max(118, Math.min(contentWidth * 0.38, 168)));
  const demo = DemoMode.isActive();

  const checkPremiumAgain = async () => {
    if (checkingPremium) return;
    setCheckingPremium(true);
    setCheckNotice(null);
    try {
      if (session?.userId) await PurchaseService.reconcile(session.userId).catch(() => false);
      const sub = await SubscriptionService.getSubscription();
      await entitlement.refresh();
      setCheckNotice(
        sub?.isPremium
          ? { tone: 'success', message: 'Premium confirmado. Tu acceso ya está actualizado.' }
          : { tone: 'info', message: 'Comprobación completada. No consta una suscripción Premium activa en esta cuenta.' },
      );
    } catch {
      setCheckNotice({ tone: 'danger', message: 'No hemos podido comprobarlo. Revisa tu conexión e inténtalo de nuevo. Si ya pagaste, no vuelvas a pagar.' });
    } finally {
      setCheckingPremium(false);
    }
  };

  const next = () => {
    if (!selected || purchase.busy) return;
    const { channels, plan } = selected;
    if (!channels.length) {
      setCheckNotice({ tone: 'info', message: 'Este plan está disponible en MediClaro, pero todavía no hay una vía de pago verificada en este dispositivo. No se realizará ningún cobro.' });
      return;
    }
    if (channels.length > 1) router.push({ pathname: '/payment', params: { plan: plan.id } });
    else if (channels[0] === 'store') void purchase.pay('store', plan.id);
    else router.push({ pathname: '/payment-card', params: { plan: plan.id } });
  };

  let body: ReactNode;
  if (offer.status === 'loading') {
    body = <PremiumSkeleton />;
  } else if (offer.status === 'error' || !offer.data) {
    body = <ErrorState kind={offer.error?.kind} message={offer.error?.message} onRetry={() => void offer.reload()} />;
  } else if (!offers.length) {
    body = (
      <InfoBanner
        tone="neutral"
        title="Premium no está disponible ahora mismo"
        message="No podemos ofrecer la suscripción en este teléfono en este momento. Inténtalo más tarde."
        action={{ label: 'Intentar de nuevo', onPress: () => void offer.reload() }}
      />
    );
  } else {
    const terms = selected?.plan.terms ?? [];
    body = (
      <View style={{ gap: theme.spacing.md }}>
        <View style={{ paddingTop: theme.spacing.sm }}>
          <PlanPicker offers={offers} selectedId={selected?.plan.id ?? null} onSelect={setSelectedId} />
        </View>
        {terms.length ? (
          <AppText variant="caption" color="textSecondary" align="center" testID="plan-terms">
            {terms.join(' ')}
          </AppText>
        ) : null}
        {purchase.notice ? (
          <InfoBanner
            tone={purchase.notice.tone}
            title={purchase.notice.title}
            message={purchase.notice.message}
            action={purchase.notice.action}
          />
        ) : null}
        <BenefitGrid title="Con MediClaro Premium disfrutarás de:" benefits={offer.data.catalog.benefits} />
      </View>
    );
  }

  const footer =
    selected && offer.status === 'success' ? (
      <>
        <PrimaryButton
          label={selected.channels.length ? 'Continuar con Premium' : 'Pago no disponible todavía'}
          icon={selected.channels.length ? 'lock-closed' : 'time-outline'}
          onPress={next}
          loading={purchase.busy === 'store'}
          disabled={!!purchase.busy || !selected.channels.length}
          testID="premium-continue"
        />
        <RenewalNote offer={selected} />
      </>
    ) : null;

  return (
    <Screen
      gradient="premium"
      header={<BrandHeader pill="inline" fallbackHref={status === 'signedIn' ? '/(tabs)' : '/welcome'} />}
      footer={footer}
      testID="premium-screen"
    >
      <View style={styles.hero}>
        <View style={[styles.flex, { gap: theme.spacing.xs }]}>
          <FadeIn from="left">
            <AppText variant="title" accessibilityRole="header">
              Más claridad para tu salud
            </AppText>
          </FadeIn>
          <FadeIn from="left" delay={80}>
            <AppText variant="body" color="textSecondary">
              Accede a todas las funciones de MediClaro y entiende mejor tus medicamentos.
            </AppText>
          </FadeIn>
        </View>
        <FadeIn from="scale" delay={100}>
          <GuideIllustration size={guideSize} />
        </FadeIn>
      </View>
      {demo ? (
        <InfoBanner tone="warning" message="Modo demostración: no se realiza ningún cobro real." style={{ marginBottom: theme.spacing.sm }} />
      ) : null}
      {status === 'signedIn' && entitlement.status === 'error' ? (
        // Nunca invitar a pagar dos veces a quien quizá ya pagó: se avisa y se ofrece comprobarlo.
        <InfoBanner
          tone="warning"
          title="No hemos podido comprobar si ya tienes Premium."
          message="Si ya pagaste, no vuelvas a pagar: pulsa «Comprobar de nuevo» o «Restaurar compra»."
          action={{ label: checkingPremium ? 'Comprobando…' : 'Comprobar de nuevo', onPress: () => void checkPremiumAgain() }}
          style={{ marginBottom: theme.spacing.sm }}
          testID="premium-check-error"
        />
      ) : null}
      {checkNotice ? (
        <InfoBanner
          tone={checkNotice.tone}
          title={checkNotice.tone === 'success' ? 'Comprobación completada' : 'Estado de Premium'}
          message={checkNotice.message}
          style={{ marginBottom: theme.spacing.sm }}
          testID="premium-check-result"
        />
      ) : null}
      {body}
      <View style={{ marginTop: theme.spacing.lg }}>
        <LegalLinks onRestore={() => void purchase.restore()} restoring={purchase.busy === 'restore'} />
      </View>
    </Screen>
  );
}

// ─── Suscripción activa ──────────────────────────────────────────────────────

function renewalText(sub: Subscription): string | null {
  if (!sub.renewsAt) return null;
  const date = formatDateLong(sub.renewsAt);
  if (!date) return null;
  if (sub.oneTimePayment) return `Pagado con Bizum hasta el ${date}. No se renueva solo.`;
  if (sub.cancelsAtPeriodEnd || sub.status === 'canceled') return `Premium sigue activo hasta el ${date}. No se renovará.`;
  if (sub.status === 'active' || sub.status === 'trialing') return `Se renueva el ${date}`;
  return null;
}

function statusProblem(sub: Subscription): { title: string; message: string } | null {
  if (sub.status === 'past_due' || sub.status === 'unpaid' || sub.status === 'incomplete') {
    return { title: 'Problema con el pago', message: 'Hay un problema con el último pago. Revisa tu método de pago.' };
  }
  if (sub.status === 'paused') {
    return { title: 'Suscripción en pausa', message: 'Tu suscripción está en pausa. Puedes reanudarla desde «Gestionar suscripción».' };
  }
  return null;
}

const PROVIDER_LABEL: Record<Subscription['provider'], string> = {
  apple: 'Contratada con Apple',
  google: 'Contratada con Google Play',
  stripe: 'Pagada con tarjeta (Stripe)',
};

function ActivePremium({ subscription }: { subscription: Subscription }) {
  const router = useRouter();
  const theme = useAppTheme();
  const c = theme.colors;
  const entitlement = useEntitlement();
  const catalog = useAsync(() => PurchaseService.getOffer().then((o) => o.catalog), []);
  const [managing, setManaging] = useState(false);
  const renew = renewalText(subscription);
  const problem = statusProblem(subscription);
  const usage = subscription.usage;
  // Pago por uso: solo en las suscripciones con tarjeta y si el servidor lo tiene activo.
  const overagePrice =
    subscription.provider === 'stripe' && catalog.data?.premiumLimits?.overageEnabled ? formatPrice(FALLBACK_OVERAGE_CENTS) : undefined;

  // El uso del mes cambia con cada identificación: se vuelve a consultar cada vez que se abre la pantalla.
  const refreshEntitlement = entitlement.refresh;
  useFocusEffect(
    useCallback(() => {
      void refreshEntitlement();
    }, [refreshEntitlement]),
  );

  const manage = async () => {
    if (managing) return;
    setManaging(true);
    try {
      await PurchaseService.manage(subscription);
      void entitlement.refresh();
    } catch (e) {
      await showAlert('Gestionar suscripción', errorMessage(e));
    } finally {
      setManaging(false);
    }
  };

  return (
    <Screen
      gradient="premium"
      header={<BrandHeader pill="inline" fallbackHref="/(tabs)" />}
      footer={
        <>
          {subscription.ownerAccess || subscription.courtesyAccess ? (
            <InfoBanner tone="success" message={subscription.ownerAccess ? "Premium de propietario: acceso gratuito, sin renovación ni cobros." : "Premium de cortesía: acceso gratuito concedido por MediClaro. No genera renovaciones ni cobros."} />
          ) : subscription.paidByFamily ? (
            <InfoBanner
              tone="success"
              icon="people-outline"
              message="Tu suscripción la paga un familiar. Para cambiar la tarjeta o cancelarla, tu familiar puede usar el enlace del correo de Stripe que recibió al pagar."
              testID="premium-paid-by-family"
            />
          ) : subscription.oneTimePayment ? (
            <PrimaryButton
              label="Pagar otro mes con Bizum"
              icon="phone-portrait-outline"
              onPress={() => router.push({ pathname: '/payment-card', params: { plan: 'premium_monthly', method: 'bizum' } })}
              testID="premium-bizum-renew"
            />
          ) : (
            <PrimaryButton label="Gestionar suscripción" icon="card-outline" onPress={manage} loading={managing} testID="premium-manage" />
          )}
          <TextButton label="Ayuda" icon="help-circle-outline" onPress={() => router.push('/help')} />
        </>
      }
      testID="premium-active"
    >
      <View style={[styles.center, { gap: theme.spacing.xs }]}>
        <FadeIn from="scale">
          <GuideIllustration size={150} />
        </FadeIn>
        <AppText variant="title" align="center" accessibilityRole="header">
          Tu MediClaro Premium
        </AppText>
        <View style={styles.badgeWrap}>
          <Badge label={subscription.ownerAccess ? "Premium de propietario" : subscription.courtesyAccess ? "Premium de cortesía" : "Suscripción activa"} tone="success" icon="checkmark-circle" />
        </View>
        {renew ? (
          <AppText variant="body" color="textSecondary" align="center">
            {renew}
          </AppText>
        ) : null}
        <AppText variant="caption" color="textMuted" align="center">
          {subscription.ownerAccess
            ? 'Acceso gratuito de propietario'
            : subscription.courtesyAccess
              ? 'Acceso gratuito de cortesía'
              : subscription.paidByFamily
                ? 'La paga un familiar (Stripe)'
                : subscription.oneTimePayment
                  ? 'Pagado con Bizum (Stripe) · pago único'
                  : PROVIDER_LABEL[subscription.provider]}
        </AppText>
      </View>
      <View style={{ gap: theme.spacing.md, marginTop: theme.spacing.lg }}>
        {problem ? <InfoBanner tone="warning" title={problem.title} message={problem.message} /> : null}
        {subscription.oneTimePayment && !problem ? (
          <InfoBanner
            tone="info"
            title="Pago único con Bizum"
            message="Bizum no se renueva solo. Puedes pagar otro periodo cuando quieras: se suma al final del que ya tienes."
          />
        ) : null}
        {subscription.cancelsAtPeriodEnd && !subscription.oneTimePayment && !problem ? (
          <InfoBanner
            tone="info"
            title="Has cancelado la renovación"
            message="Seguirás con Premium hasta el final del periodo. Si cambias de idea, puedes reactivarla en «Gestionar suscripción»."
          />
        ) : null}
        {usage?.unlimited ? (
          <FadeIn delay={80}>
            <Card style={{ gap: theme.spacing.xs }} testID="premium-usage-unlimited">
              <View style={styles.usageTitle}>
                <Icon name="infinite" size={26} color={c.primary} />
                <AppText variant="bodyStrong" color="heading" style={styles.flex}>
                  Identificaciones ilimitadas
                </AppText>
              </View>
              <AppText variant="caption" color="textSecondary">
                Identifica todos los medicamentos que necesites mientras dure tu suscripción.
              </AppText>
            </Card>
          </FadeIn>
        ) : usage && usage.scansIncluded > 0 ? (
          <FadeIn delay={80}>
            <Card style={{ gap: theme.spacing.sm }} testID="premium-usage">
              <View style={styles.usageTitle}>
                <Icon name="scan" size={24} color={c.primary} />
                <AppText variant="bodyStrong" color="heading" style={styles.flex}>
                  {`Este mes: ${usage.scansUsed} de ${usage.scansIncluded} identificaciones incluidas`}
                </AppText>
              </View>
              <UsageMeter used={usage.scansUsed} included={usage.scansIncluded} />
              {subscription.ownerAccess || subscription.courtesyAccess ? <AppText variant="caption" color="textSecondary">Acceso gratuito sujeto a los límites del plan, sin cobros por uso adicional.</AppText> : <UsageHint left={usage.scansLeft} premium overagePrice={overagePrice} />}
            </Card>
          </FadeIn>
        ) : null}
        {catalog.data ? <BenefitList title="Tu plan incluye" benefits={catalog.data.benefits} /> : null}
        <LegalLinks />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { alignItems: 'center' },
  hero: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  badgeWrap: { alignSelf: 'center' },
  usageTitle: { flexDirection: 'row', alignItems: 'center', gap: 10 },
});
