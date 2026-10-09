/**
 * /emergency/in-call?target=private|official · Llamada abierta (referencia e06_incall, oscura).
 * La llamada la muestra el teléfono en su propia pantalla: aquí la persona vuelve para
 * reproducir el mensaje, ver su información, avisar a un familiar o decir cómo ha ido.
 * Si el servicio privado no contesta, la persona decide (el 112 nunca se llama solo).
 */
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { AppHeader, AppText, EmergencyCallButton, Icon, PrimaryButton, Screen, SecondaryButton } from '../../components';
import { useAppTheme, useElapsedSeconds, useEmergencySession } from '../../hooks';
import { EmergencyService, EmergencySession } from '../../services';
import { showAlert } from '../../utils/dialogs';
import {
  DemoNotice,
  EMERGENCY_HREF,
  RoundAction,
  callDoneHref,
  formatClock,
  parseTarget,
  useEmergencyProfileData,
  useOfficialCall,
  usePrivateAssistance,
  useNavigateOnce,
} from './parts';

export default function EmergencyInCallScreen() {
  const router = useRouter();
  const go = useNavigateOnce();
  const theme = useAppTheme();
  const params = useLocalSearchParams<{ target?: string }>();
  const session = useEmergencySession();
  const target = parseTarget(params.target, session.callTarget);
  const official = target === 'official';
  const assistance = usePrivateAssistance(!official);
  const { profile } = useEmergencyProfileData();
  const { callOfficial, callingOfficial } = useOfficialCall();
  const [officialNoAnswer, setOfficialNoAnswer] = useState(false);
  const [redialing, setRedialing] = useState(false);
  const redialingRef = useRef(false);

  // Abierta directamente: la emergencia queda activa igualmente.
  useEffect(() => {
    EmergencySession.ensureStarted();
  }, []);

  const callRegistered = session.callStartedAt !== null && session.callTarget === target;
  const elapsed = useElapsedSeconds(callRegistered ? session.callStartedAt : null);
  const privateName = assistance.service?.name ?? 'Tu servicio de asistencia';
  const displayName = official ? '112 · Emergencias' : privateName;
  const caregiver = session.prepared?.profile.caregiver ?? profile?.caregiver ?? null;

  const redialPrivate = async () => {
    if (redialingRef.current) return;
    redialingRef.current = true;
    setRedialing(true);
    try {
      const outcome = await EmergencyService.callPrivateAssistance().catch(() => 'failed' as const);
      if (outcome === 'success') EmergencySession.callStarted('private');
      else if (outcome === 'not_configured') router.replace(EMERGENCY_HREF.calling);
      else await showAlert('No se ha podido abrir el teléfono', `Vuelve a intentarlo o marca el número de ${privateName} desde tu teléfono.`);
    } finally {
      redialingRef.current = false;
      setRedialing(false);
    }
  };

  const redialOfficial = async () => {
    const opened = await callOfficial({ navigate: 'none' });
    if (opened) setOfficialNoAnswer(false);
  };

  const answered = () => {
    EmergencySession.callAnswered();
    go(callDoneHref(target), 'replace');
  };

  const notAnswered = () => {
    if (official) {
      setOfficialNoAnswer(true);
      return;
    }
    EmergencySession.callNotAnswered();
    go(EMERGENCY_HREF.noAnswer, 'replace');
  };

  const footer = officialNoAnswer ? (
    <>
      <AppText variant="heading" color="callText" align="center" accessibilityRole="header">
        Vuelve a intentarlo
      </AppText>
      <AppText variant="caption" color="callTextMuted" align="center">
        A veces tarda unos segundos en contestar. Si no te atienden, vuelve a llamar.
      </AppText>
      <EmergencyCallButton label="Volver a llamar al 112" onPress={() => void redialOfficial()} loading={callingOfficial} />
      <SecondaryButton label="Sí, me han atendido" icon="checkmark-circle" variant="neutral" onPress={answered} />
    </>
  ) : (
    <>
      <AppText variant="heading" color="callText" align="center" accessibilityRole="header">
        {official ? '¿Has podido hablar con el 112?' : `¿Has podido hablar con ${privateName}?`}
      </AppText>
      <PrimaryButton label="Sí, me han atendido" icon="checkmark-circle" tone="success" onPress={answered} testID="incall-answered" />
      <SecondaryButton label="No contestan" icon="close-circle" variant="neutral" onPress={notAnswered} testID="incall-no-answer" />
    </>
  );

  return (
    <Screen
      background="callBackground"
      statusBar="light"
      header={<AppHeader tone="inverse" fallbackHref={EMERGENCY_HREF.main} />}
      footer={footer}
      testID="emergency-in-call"
    >
      <View style={[styles.center, { gap: theme.spacing.xxs }]}>
        <AppText variant="bodyStrong" color="callTextMuted" align="center">
          {callRegistered ? 'Llamada iniciada' : 'Llamada'}
        </AppText>
        <AppText variant="display" color="callText" align="center" accessibilityRole="header">
          {displayName}
        </AppText>
        {callRegistered ? (
          <View style={styles.center} accessible accessibilityLabel={`${formatClock(elapsed)} desde que abriste la llamada`}>
            <AppText variant="title" color="callText" align="center" style={styles.clock}>
              {formatClock(elapsed)}
            </AppText>
            <AppText variant="caption" color="callTextMuted" align="center">
              desde que abriste la llamada
            </AppText>
          </View>
        ) : null}
        <View style={[styles.note, { marginTop: theme.spacing.xs }]}>
          <Icon name="phone-portrait-outline" size={20} color={theme.colors.callTextMuted} />
          <AppText variant="caption" color="callTextMuted" style={styles.noteText}>
            Tu teléfono muestra la llamada en su propia pantalla. Vuelve aquí cuando termines.
          </AppText>
        </View>
      </View>

      {!official && assistance.simulated ? (
        <DemoNotice message="Modo demostración: esta llamada es simulada." style={{ marginTop: theme.spacing.md }} />
      ) : null}

      {!official ? (
        <View style={{ marginTop: theme.spacing.md, gap: theme.spacing.xxs }}>
          <EmergencyCallButton onPress={() => void callOfficial({ navigate: 'replace' })} loading={callingOfficial} />
          <AppText variant="caption" color="callTextMuted" align="center">
            El 112 es distinto de tu servicio de asistencia. Solo se llama si tú lo pulsas.
          </AppText>
        </View>
      ) : null}

      <View style={[styles.grid, { marginTop: theme.spacing.lg, rowGap: theme.spacing.md }]}>
        <View style={styles.cell}>
          <RoundAction
            icon="volume-high"
            label="Mensaje"
            accessibilityLabel="Mensaje para el operador"
            onPress={() => go(EMERGENCY_HREF.voiceMessage)}
          />
        </View>
        <View style={styles.cell}>
          <RoundAction icon="document-text" label="Mi información" onPress={() => go(EMERGENCY_HREF.prepared)} />
        </View>
        {caregiver ? (
          <View style={styles.cell}>
            <RoundAction
              icon="people"
              label="Avisar familiar"
              accessibilityLabel={`Avisar a ${caregiver.name}`}
              onPress={() => go(EMERGENCY_HREF.notify)}
            />
          </View>
        ) : null}
        <View style={styles.cell}>
          <RoundAction
            icon="call"
            label="Volver a llamar"
            tone={official ? 'danger' : 'primary'}
            accessibilityLabel={official ? 'Volver a llamar al 112' : `Volver a llamar a ${privateName}`}
            disabled={redialing || callingOfficial}
            onPress={() => void (official ? redialOfficial() : redialPrivate())}
            testID="incall-redial"
          />
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center' },
  clock: { fontVariant: ['tabular-nums'], marginTop: 6 },
  note: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 8, maxWidth: 380 },
  noteText: { flexShrink: 1 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center' },
  cell: { width: '50%', alignItems: 'center' },
});
