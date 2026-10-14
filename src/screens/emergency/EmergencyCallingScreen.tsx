/**
 * /emergency/calling · Llamada al servicio PRIVADO de asistencia (referencia e05_countdown, en AZUL:
 * el rojo es solo para el 112).
 * Cuenta atrás corta para poder cancelar; al terminar (o con «Llamar ya») se abre el teléfono
 * con el número del servicio privado. El 112 es una opción aparte que solo se llama si se pulsa.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import {
  AppHeader,
  AppText,
  CheckItem,
  EmergencyCallButton,
  Icon,
  InfoBanner,
  LoadingState,
  OfficialEmergencyNote,
  PrimaryButton,
  ProgressRing,
  Screen,
  SecondaryButton,
} from '../../components';
import { useAppTheme, useCountdown } from '../../hooks';
import { EmergencyService, EmergencySession } from '../../services';
import { EMERGENCY_DIAL_COUNTDOWN_SECONDS } from '../../config/app';
import {
  DemoNotice,
  EMERGENCY_HREF,
  IconCircle,
  inCallHref,
  noAnswerHref,
  useOfficialCall,
  usePreparedEmergency,
  usePrivateAssistance,
  useNavigateOnce,
} from './parts';

type Phase = 'counting' | 'paused' | 'dialing';

export default function EmergencyCallingScreen() {
  const router = useRouter();
  const go = useNavigateOnce();
  const theme = useAppTheme();
  const assistance = usePrivateAssistance();
  const { prepared, loading: preparing } = usePreparedEmergency();
  const { callOfficial, callingOfficial } = useOfficialCall();
  const [phase, setPhase] = useState<Phase>('counting');
  const dialingRef = useRef(false);
  const startedRef = useRef(false);
  const countStartedRef = useRef(false);
  const hadNoServiceRef = useRef(false);
  const dialRef = useRef<() => void>(() => undefined);

  const countdown = useCountdown(EMERGENCY_DIAL_COUNTDOWN_SECONDS, { autoStart: false, onDone: () => dialRef.current() });
  const { start: startCountdown, stop: stopCountdown } = countdown;
  const service = assistance.service;
  const reloadService = assistance.reload;

  const dial = useCallback(async () => {
    if (dialingRef.current) return;
    dialingRef.current = true;
    stopCountdown();
    setPhase('dialing');
    let outcome: 'success' | 'not_configured' | 'failed';
    try {
      outcome = await EmergencyService.callPrivateAssistance();
    } catch {
      outcome = 'failed';
    }
    if (outcome === 'success') {
      EmergencySession.callStarted('private');
      router.replace(inCallHref('private'));
      return;
    }
    if (outcome === 'failed') {
      // No se pudo abrir la llamada: la persona decide qué hacer (nunca se llama al 112 solo).
      EmergencySession.callStarted('private');
      EmergencySession.callNotAnswered();
      router.replace(noAnswerHref(true));
      return;
    }
    // Ya no hay servicio configurado: se muestra la opción de configurarlo.
    dialingRef.current = false;
    hadNoServiceRef.current = true;
    setPhase('paused');
    void reloadService();
  }, [router, stopCountdown, reloadService]);

  useEffect(() => {
    dialRef.current = () => void dial();
  }, [dial]);

  // La cuenta atrás empieza cuando sabemos a quién llamar (y solo una vez).
  useEffect(() => {
    if (assistance.loading) return;
    if (!service) {
      hadNoServiceRef.current = true;
      return;
    }
    if (startedRef.current) return;
    startedRef.current = true;
    // Si se acaba de configurar el servicio, o la app no está en primer plano, se espera a «Llamar ya».
    if (hadNoServiceRef.current || AppState.currentState === 'background') {
      setPhase('paused');
      return;
    }
    setPhase('counting');
    countStartedRef.current = true;
    startCountdown();
  }, [assistance.loading, service, startCountdown]);

  // Si la app pasa a segundo plano durante la cuenta atrás, se detiene (no se llama al volver).
  const countingRef = useRef(false);
  countingRef.current = phase === 'counting' && countdown.running;
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'background' && countingRef.current) {
        stopCountdown();
        setPhase('paused');
      }
    });
    return () => sub.remove();
  }, [stopCountdown]);

  const cancel = () => {
    dialingRef.current = true;
    stopCountdown();
    if (router.canGoBack()) router.back();
    else router.replace(EMERGENCY_HREF.main);
  };

  const preferOfficial = async () => {
    dialingRef.current = true;
    stopCountdown();
    setPhase('paused');
    const opened = await callOfficial({ navigate: 'replace' });
    if (!opened) dialingRef.current = false;
  };

  const officialButton = (variant: 'solid' | 'soft', label?: string) => (
    <EmergencyCallButton variant={variant} label={label} onPress={() => void preferOfficial()} loading={callingOfficial} />
  );

  if (assistance.loading) {
    return (
      <Screen header={<AppHeader title="Asistencia" fallbackHref={EMERGENCY_HREF.main} />} footer={officialButton('solid')}>
        <LoadingState message="Preparando la llamada…" />
      </Screen>
    );
  }

  if (!service) {
    return (
      <Screen header={<AppHeader title="Asistencia" fallbackHref={EMERGENCY_HREF.main} />} footer={officialButton('solid')}>
        <View style={[styles.center, { gap: theme.spacing.md, paddingTop: theme.spacing.xl }]} testID="calling-no-service">
          <IconCircle icon="headset" size={88} iconSize={44} background={theme.colors.primarySoft} iconColor={theme.colors.primary} />
          <AppText variant="title" align="center" accessibilityRole="header">
            No tienes un número privado de asistencia
          </AppText>
          <AppText variant="body" color="textSecondary" align="center" style={styles.lead}>
            Añade el teléfono de tu servicio de teleasistencia o de un familiar para poder llamarle desde aquí.
          </AppText>
          <PrimaryButton label="Configurarlo" icon="settings-outline" onPress={() => go(EMERGENCY_HREF.privateAssistance)} />
          <OfficialEmergencyNote />
        </View>
      </Screen>
    );
  }

  const seconds = phase === 'dialing' ? 0 : countStartedRef.current ? countdown.remaining : EMERGENCY_DIAL_COUNTDOWN_SECONDS;
  const progress = Math.max(0, Math.min(1, seconds / EMERGENCY_DIAL_COUNTDOWN_SECONDS));
  const caregiverOk = !!prepared?.caregiverMessage;
  const checks: { label: string; state: 'done' | 'pending' | 'todo'; detail?: string }[] = [
    { label: 'Tu información está preparada', state: prepared ? 'done' : preparing ? 'pending' : 'todo' },
    {
      label: 'Ubicación obtenida',
      state: prepared?.location ? 'done' : prepared ? 'todo' : 'pending',
      detail: prepared && !prepared.location ? (prepared.report.registeredAddress ? 'Se usará la dirección de tu perfil' : 'No disponible ahora') : undefined,
    },
    { label: 'Mensaje para el operador listo', state: prepared ? 'done' : 'pending' },
    {
      label: 'Podrás avisar a tu contacto después',
      state: caregiverOk ? 'done' : prepared ? 'todo' : 'pending',
      detail: prepared && !caregiverOk ? 'No tienes un contacto con el aviso activado' : undefined,
    },
  ];

  const title = phase === 'paused' ? `Llamar a ${service.name}` : `Llamando a ${service.name}…`;
  const caption =
    phase === 'counting'
      ? 'Al terminar la cuenta atrás se abrirá la llamada en tu teléfono.'
      : phase === 'paused'
        ? 'Cuenta atrás detenida. Pulsa «Llamar ya» cuando quieras.'
        : 'Abriendo el teléfono…';

  return (
    <Screen
      header={<AppHeader title={phase === 'paused' ? 'Llamada' : 'Llamando'} fallbackHref={EMERGENCY_HREF.main} />}
      footer={
        <>
          <PrimaryButton label="Llamar ya" icon="call" onPress={() => void dial()} loading={phase === 'dialing'} testID="calling-now" />
          <SecondaryButton label="Cancelar" variant="neutral" onPress={cancel} testID="calling-cancel" />
          {officialButton('soft', 'Prefiero llamar al 112')}
        </>
      }
      testID="emergency-calling"
    >
      <View style={[styles.center, { gap: theme.spacing.sm }]}>
        <View
          accessible
          accessibilityRole="timer"
          accessibilityLabel={phase === 'dialing' ? 'Abriendo el teléfono' : `${seconds} segundos para abrir la llamada`}
          style={{ marginTop: theme.spacing.xs }}
        >
          <ProgressRing size={188} strokeWidth={14} progress={progress} color={theme.colors.primary} gradient={false}>
            {phase === 'dialing' ? (
              <Icon name="call" size={56} color={theme.colors.primary} />
            ) : (
              <View style={styles.center}>
                <AppText style={[styles.bigNumber, { color: theme.colors.primary }]} allowFontScaling={false}>
                  {String(seconds)}
                </AppText>
                <AppText variant="label" color="heading">
                  segundos
                </AppText>
              </View>
            )}
          </ProgressRing>
        </View>
        <AppText variant="title" align="center" accessibilityRole="header">
          {title}
        </AppText>
        <AppText variant="subheading" color="textSecondary" align="center">
          Estamos contigo.
        </AppText>
        <AppText variant="caption" color="textSecondary" align="center" style={styles.lead}>
          {caption}
        </AppText>
      </View>

      {assistance.simulated ? (
        <DemoNotice message="Modo demostración: la llamada a la central de ejemplo es simulada." style={{ marginTop: theme.spacing.md }} />
      ) : null}

      <View style={[styles.checks, { gap: theme.spacing.xxs, marginTop: theme.spacing.lg }]}>
        {checks.map((c) => (
          <CheckItem key={c.label} label={c.label} state={c.state} detail={c.detail} />
        ))}
      </View>

      <InfoBanner
        tone="info"
        icon="volume-high"
        title="Mantén el teléfono cerca y activa el altavoz si puedes."
        style={{ marginTop: theme.spacing.md }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center' },
  lead: { maxWidth: 340 },
  checks: { width: '100%' },
  bigNumber: { fontSize: 64, lineHeight: 72, fontWeight: '800' },
});
