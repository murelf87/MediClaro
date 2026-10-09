/**
 * /processing — "Estamos identificando el medicamento…" (referencia 05_processing).
 * Toma la entrada pendiente (foto, código de barras o C.N.) y llama UNA vez a la identificación.
 *  - identificado → /result?id=…   · varios parecidos → /candidates
 *  - no encontrado → consejos y otras formas de intentarlo (en esta pantalla)
 *  - límite del plan → MediClaro Premium · sesión caducada → volver a entrar
 *  - otros errores → reintentar con la misma entrada
 * "Volver" cancela: si la respuesta llega después, se ignora.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import {
  AppHeader,
  AppText,
  Card,
  CheckItem,
  ErrorState,
  Icon,
  InfoBanner,
  PrimaryButton,
  ProgressRing,
  Screen,
  SecondaryButton,
  type IconName,
} from '../../components';
import { useAppTheme, useEntitlement } from '../../hooks';
import { AI_CONSENT_REQUIRED, AiConsentService, AppError, MedicationService, PREMIUM_REQUIRED_CODE, isAppError } from '../../services';
import { PURCHASES_ENABLED } from '../../config/app';
import { nextMonthStartLabel } from '../../utils/format';
import type { AppErrorKind, IdentifyInput } from '../../types';
import { isCodeInput } from './helpers';
import { CapsuleArt, SessionExpiredState, StateBlock } from './parts';

type NotFoundReason = 'blurry' | 'multiple_items' | 'no_match';

type Phase =
  | { kind: 'working' }
  | { kind: 'not_found'; reason: NotFoundReason; message: string }
  | { kind: 'error'; error: AppError };

const NOT_FOUND: Record<NotFoundReason, { icon: IconName; title: string; tips: string[] }> = {
  blurry: {
    icon: 'eye-off-outline',
    title: 'La foto ha salido borrosa',
    tips: [
      'Apoya los codos en la mesa para que el móvil no se mueva.',
      'Busca un sitio con buena luz y sin reflejos sobre la caja.',
      'Acerca la caja hasta que el nombre se lea bien.',
    ],
  },
  multiple_items: {
    icon: 'albums-outline',
    title: 'Hay varios medicamentos en la foto',
    tips: [
      'Pon delante de la cámara una sola caja.',
      'Aparta otros envases, papeles o prospectos.',
      'Deja el nombre del medicamento dentro del recuadro.',
    ],
  },
  no_match: {
    icon: 'search-outline',
    title: 'No hemos encontrado este medicamento',
    tips: [
      'Haz la foto a la cara de la caja donde aparece el nombre.',
      'Con buena luz, sin reflejos y con la caja entera dentro del recuadro.',
      'O escribe el código nacional: 6 cifras junto a «C.N.».',
    ],
  },
};

/** Errores pasajeros: se reintenta con la misma foto o código. */
const RETRYABLE: AppErrorKind[] = ['offline', 'timeout', 'rate_limited', 'provider_down', 'unknown'];

/** Tiempos para ir marcando los pasos (el último solo se completa con la respuesta). */
const STEP_TIMES_MS = [1200, 2800];
/** Pausa breve con todos los pasos completados antes de mostrar el resultado. */
const DONE_PAUSE_MS = 500;

export default function ProcessingScreen() {
  const router = useRouter();
  const theme = useAppTheme();
  const entitlement = useEntitlement();
  const [phase, setPhase] = useState<Phase>({ kind: 'working' });
  const [completed, setCompleted] = useState(0);
  const [attempt, setAttempt] = useState(0);
  const [codeMode, setCodeMode] = useState(() => isCodeInput(MedicationService.getPendingIdentification()));

  const inputRef = useRef<IdentifyInput | null>(null);
  const startedRef = useRef(false);
  const mountedRef = useRef(false);
  const cancelledRef = useRef(false);
  const navTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Montado/desmontado (compatible con el doble montaje de React en modo estricto).
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (navTimer.current) clearTimeout(navTimer.current);
    };
  }, []);

  const alive = () => mountedRef.current && !cancelledRef.current;

  const run = useCallback(
    async (input: IdentifyInput) => {
      setPhase({ kind: 'working' });
      setCompleted(0);
      setAttempt((a) => a + 1);
      try {
        const result = await MedicationService.identifyMedication(input);
        if (!alive()) return;
        if (result.status === 'not_found' || (result.status === 'ambiguous' && result.candidates.length === 0)) {
          MedicationService.clearPendingIdentification();
          setPhase(
            result.status === 'not_found'
              ? { kind: 'not_found', reason: result.reason, message: result.message }
              : { kind: 'not_found', reason: 'no_match', message: 'No hemos encontrado ningún medicamento parecido.' },
          );
          return;
        }
        MedicationService.clearPendingIdentification();
        setCompleted(3);
        navTimer.current = setTimeout(() => {
          if (!alive()) return;
          if (result.status === 'identified') router.replace({ pathname: '/result', params: { id: result.best.id } });
          else router.replace('/candidates');
        }, DONE_PAUSE_MS);
      } catch (e) {
        if (!alive()) return;
        setPhase({ kind: 'error', error: isAppError(e) ? e : new AppError('unknown') });
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [router],
  );

  // Una sola llamada por entrada (la referencia sobrevive al doble efecto del modo estricto).
  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    const input = MedicationService.getPendingIdentification();
    if (!input) {
      router.replace('/scan');
      return;
    }
    inputRef.current = input;
    setCodeMode(isCodeInput(input));
    void run(input);
  }, [router, run]);

  // Avance de los pasos mientras se espera la respuesta.
  useEffect(() => {
    if (phase.kind !== 'working') return undefined;
    const timers = STEP_TIMES_MS.map((ms, i) => setTimeout(() => setCompleted((c) => Math.max(c, i + 1)), ms));
    return () => timers.forEach(clearTimeout);
  }, [phase.kind, attempt]);

  const cancel = () => {
    cancelledRef.current = true;
    if (navTimer.current) clearTimeout(navTimer.current);
    MedicationService.clearPendingIdentification();
    if (router.canGoBack()) router.back();
    else router.replace('/(tabs)');
  };

  const retry = () => {
    const input = inputRef.current ?? MedicationService.getPendingIdentification();
    if (!input) {
      router.replace('/scan');
      return;
    }
    inputRef.current = input;
    void run(input);
  };

  const goHome = () => router.replace('/(tabs)');

  const header = <AppHeader onBack={cancel} />;

  if (phase.kind === 'not_found') {
    const info = NOT_FOUND[phase.reason] ?? NOT_FOUND.no_match;
    return (
      <Screen header={header}>
        <StateBlock icon={info.icon} tone="primary" title={info.title} message={phase.message} style={{ marginTop: theme.spacing.sm }} />
        <Card tone="muted" bordered={false} style={{ marginTop: theme.spacing.lg, gap: theme.spacing.sm }}>
          <AppText variant="bodyStrong" color="heading" accessibilityRole="header">
            Consejos para conseguirlo
          </AppText>
          {info.tips.map((tip) => (
            <View key={tip} style={styles.tip}>
              <Icon name="bulb-outline" size={22} color={theme.colors.primary} />
              <AppText variant="body" style={styles.flex}>
                {tip}
              </AppText>
            </View>
          ))}
        </Card>
        <View style={{ gap: theme.spacing.sm, marginTop: theme.spacing.lg }}>
          <PrimaryButton label="Hacer otra foto" icon="camera" onPress={() => router.replace('/scan')} />
          <SecondaryButton label="Escribir el código nacional" icon="keypad-outline" size="lg" onPress={() => router.replace('/add-medication?form=cn')} />
        </View>
      </Screen>
    );
  }

  if (phase.kind === 'error') {
    const { error } = phase;
    if (error.kind === 'unauthorized') {
      return (
        <Screen header={header} contentStyle={styles.grow}>
          <View style={styles.centerFill}>
            <SessionExpiredState message={error.message} />
          </View>
        </Screen>
      );
    }
    if (error.kind === 'limit_reached' && error.code === PREMIUM_REQUIRED_CODE && entitlement.isPremium) {
      // La app ya ve Premium pero el servidor aún no (confirmación del pago en curso): se reintenta, sin anuncios.
      return (
        <Screen header={header} contentStyle={styles.grow}>
          <View style={styles.centerFill}>
            <StateBlock
              icon="sync-outline"
              tone="primary"
              title="Estamos confirmando tu suscripción"
              message="Tu MediClaro Premium está activo, pero el servidor aún no lo ha confirmado. Inténtalo de nuevo en unos minutos."
            >
              <PrimaryButton label="Intentar de nuevo" icon="refresh" onPress={retry} testID="processing-retry" />
              <SecondaryButton label="Volver al inicio" icon="home-outline" size="lg" variant="neutral" onPress={goHome} />
            </StateBlock>
          </View>
        </Screen>
      );
    }
    if (error.kind === 'limit_reached') {
      // Premium solo se ofrece a quien no lo tiene y puede contratarlo en la app. Quien ya es Premium (o no
      // puede comprar dentro de la app) ve cuándo se renuevan sus identificaciones, nunca un anuncio.
      const offerPremium = entitlement.canSell && !entitlement.isPremium;
      // El servidor puede indicar que identificar es solo de Premium (R-24), p. ej. si el estado local no estaba al día.
      const premiumOnly = error.code === PREMIUM_REQUIRED_CODE && !entitlement.isPremium;
      const renewal = entitlement.isPremium
        ? 'Tus identificaciones incluidas se renuevan cada mes.'
        : `Se renuevan el ${nextMonthStartLabel()}.`;
      const title = premiumOnly
        ? 'Identificar medicamentos es de MediClaro Premium'
        : entitlement.isPremium
          ? 'Has usado las identificaciones incluidas este mes'
          : 'Has usado tus identificaciones de este mes';
      const message = premiumOnly
        ? offerPremium
          ? 'Con MediClaro Premium puedes identificar tus medicamentos con una foto o con el código de la caja.'
          : 'Esta función no está incluida en tu plan.'
        : offerPremium
          ? 'Con MediClaro Premium puedes seguir identificando medicamentos sin esperar al mes que viene.'
          : `${renewal} Las búsquedas que no encuentran el medicamento no cuentan.`;
      return (
        <Screen header={header} contentStyle={styles.grow}>
          <View style={styles.centerFill}>
            <StateBlock icon={premiumOnly ? 'lock-closed-outline' : 'hourglass-outline'} tone="warning" title={title} message={message}>
              {offerPremium ? (
                <PrimaryButton label="Ver MediClaro Premium" icon="star" onPress={() => router.push('/premium')} testID="limit-premium" />
              ) : null}
              <SecondaryButton
                label="Volver al inicio"
                icon="home-outline"
                size="lg"
                variant={offerPremium ? 'neutral' : 'tonal'}
                onPress={goHome}
              />
              {entitlement.isPremium && PURCHASES_ENABLED ? (
                <SecondaryButton
                  label="Ver mi suscripción"
                  icon="ribbon-outline"
                  size="lg"
                  variant="neutral"
                  onPress={() => router.push('/premium')}
                  testID="limit-subscription"
                />
              ) : null}
            </StateBlock>
            <InfoBanner
              tone="neutral"
              icon="medkit-outline"
              message="Tus medicamentos guardados siguen disponibles en «Mis medicamentos»."
              style={{ marginTop: theme.spacing.lg }}
            />
          </View>
        </Screen>
      );
    }
    if (error.code === AI_CONSENT_REQUIRED) {
      // La foto necesita el permiso para la IA; sin él, se ofrece el código de la caja (no usa IA).
      return (
        <Screen header={header} contentStyle={styles.grow}>
          <ErrorState
            kind="permission_denied"
            title="Necesitamos tu permiso"
            message="Para leer la foto usamos la inteligencia artificial de Google, y antes necesitamos tu permiso. También puedes usar el código de la caja."
            onRetry={() => {
              void AiConsentService.ensure().then((ok) => {
                if (ok) retry();
              });
            }}
            retryLabel="Dar permiso y continuar"
            secondaryAction={{ label: 'Usar el código de la caja', onPress: () => router.replace('/add-medication') }}
          />
        </Screen>
      );
    }
    // Reintentar solo tiene sentido si el fallo es pasajero; si no, se ofrece otra forma de identificarlo.
    const transient = RETRYABLE.includes(error.kind);
    const otherWay = !transient && error.kind !== 'not_configured';
    return (
      <Screen header={header} contentStyle={styles.grow}>
        <ErrorState
          kind={error.kind}
          message={error.message}
          onRetry={transient ? retry : otherWay ? () => router.replace('/add-medication') : undefined}
          retryLabel={transient ? 'Reintentar' : 'Intentarlo de otra forma'}
          secondaryAction={{ label: 'Volver al inicio', onPress: goHome }}
        />
      </Screen>
    );
  }

  const steps = [codeMode ? 'Leyendo el código' : 'Analizando la imagen', 'Verificando en la base de datos oficial', 'Preparando la información'];

  return (
    <Screen header={header} contentStyle={styles.grow}>
      <View
        style={[styles.ringWrap, { marginTop: theme.spacing.xs }]}
        accessible
        accessibilityRole="progressbar"
        accessibilityLabel="Identificando el medicamento"
        accessibilityState={{ busy: true }}
      >
        <ProgressRing size={212} strokeWidth={16} color={theme.colors.successStrong}>
          <CapsuleArt size={112} />
        </ProgressRing>
      </View>

      <AppText variant="title" align="center" accessibilityRole="header" style={{ marginTop: theme.spacing.lg }}>
        Estamos identificando el medicamento…
      </AppText>
      <AppText variant="body" color="textSecondary" align="center" style={{ marginTop: theme.spacing.xs }}>
        {codeMode
          ? 'Buscamos el código en la base oficial para ofrecerte información fiable.'
          : 'Analizamos la imagen para ofrecerte información oficial y fiable.'}
      </AppText>

      <View style={[styles.steps, { marginTop: theme.spacing.lg, gap: theme.spacing.xs }]} accessibilityLiveRegion="polite">
        {steps.map((label, i) => (
          <CheckItem key={label} label={label} state={i < completed ? 'done' : i === completed ? 'pending' : 'todo'} />
        ))}
      </View>

      {/* Empuja el aviso de privacidad al pie cuando sobra espacio. */}
      <View style={[styles.spacer, { minHeight: theme.spacing.xl }]} />
      <InfoBanner
        tone="info"
        icon="lock-closed"
        title="Tu privacidad está protegida."
        message={
          codeMode
            ? 'MediClaro solo usa el código para buscar el medicamento en la base oficial.'
            : 'MediClaro no guarda la foto: solo se usa para identificar el medicamento.'
        }
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  grow: { flexGrow: 1 },
  ringWrap: { alignItems: 'center' },
  steps: { alignSelf: 'center', width: '100%', maxWidth: 380, paddingHorizontal: 8 },
  spacer: { flexGrow: 1 },
  tip: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  centerFill: { flexGrow: 1, justifyContent: 'center' },
});
