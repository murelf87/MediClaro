/**
 * /premium-success?plan=&status=success|already|restored|pending&reason=
 * «¡Bienvenido a MediClaro Premium!» (tablero: pantalla 8) — confirmación y activación inmediata.
 *
 * La pantalla muestra SIEMPRE lo que dice el servidor: si Premium aún no consta como activo, enseña
 * «Estamos confirmando tu pago…» con «Comprobar de nuevo» (nunca una confirmación falsa).
 * «Continuar» → «Completa tu cuenta» si la cuenta aún no tiene teléfono; si no, al Inicio.
 */
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Platform, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { AppText, Icon, InfoBanner, PrimaryButton, Screen, SecondaryButton } from '../../components';
import { Confetti, FadeIn, useReduceMotion } from '../../components/Motion';
import { useAppTheme, useEntitlement, useSession } from '../../hooks';
import { PurchaseService, SubscriptionService, isAppError, periodName } from '../../services';
import { isBillingPeriod } from '../../services/planCatalog';
import { BrandHeader, CheckList, StatusHero } from './parts';

const NATIVE = Platform.OS !== 'web';

function firstParam(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

function periodFromPlanId(planId: string | undefined): string | null {
  const guess = planId?.replace(/^premium_/, '');
  return guess && isBillingPeriod(guess) ? periodName(guess).toLowerCase() : null;
}

/** Círculo verde con check que aparece con un pequeño rebote y una onda. */
function SuccessBadge() {
  const reduce = useReduceMotion();
  const scale = useRef(new Animated.Value(reduce ? 1 : 0.3)).current;
  const ring = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (reduce) return;
    Animated.parallel([
      Animated.spring(scale, { toValue: 1, friction: 5, tension: 120, useNativeDriver: NATIVE }),
      Animated.timing(ring, { toValue: 1, duration: 1100, delay: 150, easing: Easing.out(Easing.quad), useNativeDriver: NATIVE }),
    ]).start();
  }, [reduce, scale, ring]);
  return (
    <View style={styles.badgeBox} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Animated.View
        style={[
          styles.ring,
          {
            opacity: ring.interpolate({ inputRange: [0, 1], outputRange: [0.45, 0] }),
            transform: [{ scale: ring.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1.6] }) }],
          },
        ]}
      />
      <Animated.View style={[styles.badge, { transform: [{ scale }] }]}>
        <Icon name="checkmark" size={64} color="#FFFFFF" />
      </Animated.View>
    </View>
  );
}

export default function PremiumSuccessScreen() {
  const router = useRouter();
  const theme = useAppTheme();
  const { width } = useWindowDimensions();
  const { session } = useSession();
  const entitlement = useEntitlement();
  const params = useLocalSearchParams<{ plan?: string | string[]; status?: string | string[]; reason?: string | string[] }>();
  const status = firstParam(params.status) ?? 'success';
  const reason = firstParam(params.reason);
  const period = periodFromPlanId(firstParam(params.plan));

  const [checking, setChecking] = useState(false);
  const [stillPending, setStillPending] = useState(false);
  const [checkError, setCheckError] = useState<string | null>(null);

  // Al llegar se confirma con el servidor (la pantalla nunca se fía solo de la navegación).
  useEffect(() => {
    void entitlement.refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isPremium = entitlement.isPremium;
  const verifying = !isPremium && entitlement.status === 'loading';

  const recheck = async () => {
    if (checking) return;
    setChecking(true);
    setStillPending(false);
    setCheckError(null);
    try {
      if (session) await PurchaseService.reconcile(session.userId).catch(() => false);
      await SubscriptionService.waitForPremium(10_000);
      const sub = await entitlement.refresh();
      if (!sub?.isPremium) setStillPending(true);
    } catch (e) {
      setCheckError(isAppError(e) ? e.message : 'No hemos podido comprobarlo. Inténtalo de nuevo.');
    } finally {
      setChecking(false);
    }
  };

  const goOn = () => {
    if (session && !session.phone) router.replace('/complete-account');
    else router.replace('/(tabs)');
  };

  if (isPremium) {
    const subtitle =
      status === 'restored'
        ? 'Hemos recuperado tu suscripción. Ya está activa en este teléfono.'
        : status === 'family'
          ? 'Tu familiar ha pagado tu suscripción. Ya puedes usar todas las funciones de Premium.'
          : entitlement.subscription?.oneTimePayment && entitlement.subscription.renewsAt
            ? `Pagado con Bizum hasta el ${new Date(entitlement.subscription.renewsAt).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}. No se renueva solo.`
        : status === 'already'
          ? 'Tu suscripción ya estaba activa. No se ha cobrado nada más.'
          : period
            ? `Tu suscripción ${period} ya está activa.`
            : 'Tu suscripción ya está activa.';
    return (
      <Screen
        gradient="success"
        header={<BrandHeader showBack={false} />}
        footer={<PrimaryButton label="Continuar" icon="arrow-forward" iconPosition="right" onPress={goOn} testID="success-continue" />}
        testID="premium-success"
      >
        <Confetti width={Math.min(width, theme.layout.maxContentWidth)} height={360} />
        <View style={[styles.center, { gap: theme.spacing.sm, paddingTop: theme.spacing.lg }]} accessibilityLiveRegion="polite">
          <SuccessBadge />
          <FadeIn delay={250}>
            <AppText variant="title" align="center" accessibilityRole="header" style={{ marginTop: theme.spacing.sm }}>
              ¡Bienvenido a MediClaro Premium!
            </AppText>
          </FadeIn>
          <FadeIn delay={350}>
            <AppText variant="body" color="textSecondary" align="center">
              {subtitle}
            </AppText>
          </FadeIn>
        </View>
        <View style={[styles.list, { marginTop: theme.spacing.xl }]}>
          <CheckList
            items={[
              'Asistente IA activado',
              'Identificación de medicamentos',
              'Lectura por voz',
              'Emergencias y ubicación',
              'Todas las funciones Premium',
            ]}
          />
        </View>
      </Screen>
    );
  }

  // Aún no consta como activo: confirmando (o pendiente de aprobación).
  const approval = reason === 'approval';
  return (
    <Screen
      header={<BrandHeader showBack={false} />}
      footer={
        <>
          <PrimaryButton label="Comprobar de nuevo" icon="refresh" onPress={recheck} loading={checking || verifying} testID="success-recheck" />
          <SecondaryButton label="Seguir más tarde" variant="neutral" onPress={() => router.replace('/(tabs)')} testID="success-later" />
        </>
      }
      testID="premium-pending"
    >
      <View style={{ paddingTop: theme.spacing.lg, gap: theme.spacing.md }}>
        <StatusHero
          icon={approval ? 'people-outline' : 'hourglass-outline'}
          tone="primary"
          spinning={!approval}
          title={approval ? 'Tu compra está pendiente de aprobación' : 'Estamos confirmando tu pago…'}
          message={
            approval
              ? 'Cuando se apruebe (por ejemplo, «Pedir la compra» de En familia), Premium se activará solo. No hace falta que pagues otra vez.'
              : 'Tu pago se ha hecho y lo estamos confirmando. Premium se activará en cuanto llegue la confirmación. No hace falta que pagues otra vez.'
          }
        />
        {stillPending ? (
          <InfoBanner tone="neutral" message="Todavía no hemos recibido la confirmación. Vuelve a comprobarlo en unos minutos." />
        ) : null}
        {checkError ? <InfoBanner tone="danger" message={checkError} /> : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center' },
  list: { alignSelf: 'center', width: '100%', maxWidth: 380 },
  badgeBox: { width: 132, height: 132, alignItems: 'center', justifyContent: 'center' },
  ring: { position: 'absolute', width: 132, height: 132, borderRadius: 66, backgroundColor: '#10B981' },
  badge: {
    width: 112,
    height: 112,
    borderRadius: 56,
    backgroundColor: '#059669',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 6,
    borderColor: '#D1FAE5',
  },
});
