/**
 * /emergency/assistant?mode=can_speak|unsure · Asistente de emergencia (referencia e03_assistant).
 * La persona toca lo que le pasa; el asistente prepara la información para quien la atienda.
 *
 * Sin respuesta durante EMERGENCY_INACTIVITY_SECONDS: se pregunta "¿Sigues ahí?", se
 * registra el evento, se prepara ubicación/informe y se inicia la escalada al contacto designado.
 * El paso al 112 respeta siempre la confirmación que exija el sistema del teléfono.
 * La IA no diagnostica: solo marca una posible urgencia y recoge el contexto disponible.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, ScrollView, StyleSheet, View } from 'react-native';
import { useFocusEffect, useIsFocused, useLocalSearchParams, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import {
  AppHeader,
  AppText,
  Card,
  Chip,
  EmergencyCallButton,
  Icon,
  PrimaryButton,
  PulseHalo,
  Screen,
  Waveform,
} from '../../components';
import { useAppTheme, useEmergencySession } from '../../hooks';
import { EmergencyService, EmergencySession, type QuickSymptomId } from '../../services';
import { EMERGENCY_INACTIVITY_SECONDS } from '../../config/app';
import { EMERGENCY_HREF, SYMPTOM_OPTIONS, parseMode, useOfficialCall, useNavigateOnce } from './parts';

const GREETING = 'Estoy contigo. Toca en la pantalla lo que te ocurre.';
const STILL_THERE = 'No detecto respuesta. Voy a preparar tu ubicación y a intentar contactar con tu persona de confianza.';

export default function EmergencyAssistantScreen() {
  const router = useRouter();
  const go = useNavigateOnce();
  const theme = useAppTheme();
  const params = useLocalSearchParams<{ mode?: string; from?: string }>();
  const mode = parseMode(params.mode);
  const openedFromPrepared = params.from === 'prepared';
  const session = useEmergencySession();
  const focused = useIsFocused();
  const { callOfficial, callingOfficial } = useOfficialCall();
  const scrollRef = useRef<ScrollView | null>(null);

  // ─── Voz del asistente ───
  const [speaking, setSpeaking] = useState(false);
  const speakToken = useRef(0);
  const mounted = useRef(true);

  const say = useCallback((text: string) => {
    const my = ++speakToken.current;
    setSpeaking(true);
    EmergencyService.speak(text)
      .catch(() => undefined)
      .finally(() => {
        if (mounted.current && my === speakToken.current) setSpeaking(false);
      });
  }, []);

  const hush = useCallback(() => {
    speakToken.current += 1;
    EmergencyService.stopSpeaking();
    setSpeaking(false);
  }, []);

  // Al entrar: emergencia activa (aunque se abra directamente), escucha y saludo una sola vez.
  useEffect(() => {
    mounted.current = true;
    if (EmergencySession.getSnapshot().state === 'IDLE') EmergencySession.start(mode);
    EmergencySession.listen();
    say(GREETING);
    return () => {
      mounted.current = false;
      speakToken.current += 1;
      EmergencyService.stopSpeaking();
    };
    // Solo al montar la pantalla.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // La voz se calla al salir de la pantalla.
  useFocusEffect(useCallback(() => () => hush(), [hush]));

  // ─── Inactividad: si no hay respuesta, prepara la escalada al contacto de confianza ───
  const [appActive, setAppActive] = useState(AppState.currentState !== 'background');
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => setAppActive(s === 'active'));
    return () => sub.remove();
  }, []);

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clearTimer = useCallback(() => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  }, []);

  // Solo se vigila con la pantalla visible y la app en primer plano (nunca durante una llamada).
  const watching = focused && appActive && !session.noResponseDetected;

  const arm = useCallback(() => {
    clearTimer();
    timer.current = setTimeout(() => {
      timer.current = null;
      EmergencySession.markNoResponse();
      say(STILL_THERE);
      void EmergencySession.prepare(true)
        .then((prepared) => {
          const snapshot = EmergencySession.getSnapshot();
          if (!mounted.current || !snapshot.noResponseDetected) return;
          router.replace(`${EMERGENCY_HREF.notify}?auto=1`);
        })
        .catch(() => {
          const snapshot = EmergencySession.getSnapshot();
          if (mounted.current && snapshot.noResponseDetected) router.replace(EMERGENCY_HREF.prepared);
        });
    }, EMERGENCY_INACTIVITY_SECONDS * 1000);
  }, [clearTimer, router, say]);

  useEffect(() => {
    if (!watching) {
      clearTimer();
      return undefined;
    }
    arm();
    return clearTimer;
  }, [watching, arm, clearTimer]);

  // Cualquier toque cuenta como respuesta.
  const onActivity = useCallback(() => {
    if (EmergencySession.getSnapshot().noResponseDetected) {
      EmergencySession.markResponsive();
      return;
    }
    if (watching) arm();
  }, [watching, arm]);

  useEffect(() => {
    if (session.noResponseDetected) scrollRef.current?.scrollTo({ y: 0, animated: true });
  }, [session.noResponseDetected]);

  const toggle = (id: QuickSymptomId) => {
    onActivity();
    EmergencySession.toggleSymptom(id);
  };

  const goPrepared = () => {
    onActivity();
    if (openedFromPrepared && router.canGoBack()) router.back();
    else go(EMERGENCY_HREF.prepared);
  };

  const selectedCount = session.symptoms.length;

  return (
    <View style={styles.flex} onTouchStart={onActivity}>
      <Screen
        scrollRef={scrollRef}
        header={<AppHeader title="Asistente" fallbackHref={EMERGENCY_HREF.confirm} />}
        footer={
          <>
            <PrimaryButton label="Preparar mi información" icon="document-text" onPress={goPrepared} testID="assistant-prepare" />
            <EmergencyCallButton label="Llamar al 112 ahora" onPress={() => void callOfficial()} loading={callingOfficial} />
            <AppText variant="caption" color="textSecondary" align="center">
              Si no respondes, MediClaro intenta avisar a tu cuidador vinculado. El 112 se llama manualmente.
            </AppText>
          </>
        }
      >
        {session.noResponseDetected ? (
          <Card tone="warning" elevated={false} style={{ gap: theme.spacing.sm, marginBottom: theme.spacing.md }} testID="assistant-still-there">
            <View style={styles.row} accessible accessibilityRole="alert" accessibilityLabel="¿Sigues ahí?">
              <Icon name="hand-left" size={34} color={theme.colors.warning} />
              <AppText variant="title" color="warningText">
                ¿Sigues ahí?
              </AppText>
            </View>
            <AppText variant="body" color="text">
              No has tocado la pantalla en un rato. Toca en cualquier sitio o pulsa «Estoy aquí».
            </AppText>
            <AppText variant="caption" color="textSecondary">
              Estamos preparando tu ubicación y tu información para intentar contactar con tu persona de confianza. Puedes pulsar «Estoy aquí» para detener la escalada.
            </AppText>
            <PrimaryButton label="Estoy aquí" icon="hand-left" onPress={() => EmergencySession.markResponsive()} />
          </Card>
        ) : null}

        <View style={[styles.hero, { gap: theme.spacing.sm }]}>
          <AssistantAvatar speaking={speaking} />
          <View style={[styles.statusRow, { gap: theme.spacing.xs }]}>
            <Waveform active={speaking} bars={8} height={30} color={theme.colors.primary} />
            <View
              style={[styles.pill, { backgroundColor: theme.colors.successSoft, borderRadius: theme.radius.pill }]}
              accessible
              accessibilityLabel={speaking ? 'Asistente activo, hablando' : 'Asistente activo'}
            >
              <View style={[styles.dot, { backgroundColor: theme.colors.success }]} />
              <AppText variant="label" color="successText">
                Asistente activo
              </AppText>
            </View>
            <Waveform active={speaking} bars={8} height={30} color={theme.colors.primary} />
          </View>
          <AppText variant="title" align="center" accessibilityRole="header" style={{ marginTop: theme.spacing.xs }}>
            Estoy contigo, cuéntame qué ocurre.
          </AppText>
          <AppText variant="body" color="textSecondary" align="center" style={styles.lead}>
            Toca lo que te pasa. Prepararé tu información para quien te atienda.
          </AppText>
        </View>

        <View style={[styles.chips, { gap: theme.spacing.xs, marginTop: theme.spacing.lg }]}>
          {SYMPTOM_OPTIONS.map((s) => {
            const selected = session.symptoms.includes(s.id);
            return (
              <Chip
                key={s.id}
                label={s.label}
                icon={s.icon}
                selected={selected}
                tone={selected ? 'danger' : 'primary'}
                onPress={() => toggle(s.id)}
              />
            );
          })}
        </View>

        {selectedCount > 0 ? (
          <AppText variant="caption" color="textSecondary" style={{ marginTop: theme.spacing.sm }}>
            {selectedCount === 1 ? 'Has indicado 1 cosa.' : `Has indicado ${selectedCount} cosas.`} Cuando quieras, pulsa «Preparar
            mi información».
          </AppText>
        ) : null}
      </Screen>
    </View>
  );
}

/** Avatar del asistente: círculo azul con auriculares (sin foto). Late mientras habla. */
function AssistantAvatar({ speaking }: { speaking: boolean }) {
  const theme = useAppTheme();
  const circle = (
    <View style={[styles.avatarShadow, theme.shadow.button]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <View style={styles.avatar}>
        <LinearGradient
          colors={['#60A5FA', '#2563EB', '#1D4ED8']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[StyleSheet.absoluteFill, styles.avatarFill]}
        />
        <Icon name="headset" size={58} color={theme.colors.onPrimary} />
      </View>
    </View>
  );
  return (
    <View style={styles.avatarBox}>
      {speaking ? (
        <PulseHalo size={150} color={theme.colors.primary}>
          {circle}
        </PulseHalo>
      ) : (
        circle
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  hero: { alignItems: 'center' },
  lead: { maxWidth: 360 },
  statusRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap' },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 8 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  chips: { alignItems: 'flex-start' },
  avatarBox: { width: 150, height: 150, alignItems: 'center', justifyContent: 'center' },
  avatarShadow: { width: 116, height: 116, borderRadius: 58 },
  avatar: { width: 116, height: 116, borderRadius: 58, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  avatarFill: { borderRadius: 58 },
});
