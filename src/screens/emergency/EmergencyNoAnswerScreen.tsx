/**
 * /emergency/no-answer · Sin respuesta del servicio PRIVADO de asistencia (referencia e07_noanswer).
 * La persona decide qué hacer: volver a llamar a su servicio, llamar al 112 (opción
 * distinta y explícita), avisar a un familiar o reproducir el mensaje. Nada ocurre solo.
 */
import { useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  AppHeader,
  AppText,
  Card,
  CheckItem,
  EmergencyCallButton,
  OfficialEmergencyNote,
  Screen,
  SecondaryButton,
  TextButton,
} from '../../components';
import { useAppTheme } from '../../hooks';
import { EmergencyService, EmergencySession } from '../../services';
import { confirmAsync, showAlert } from '../../utils/dialogs';
import {
  AssistanceActionButton,
  EMERGENCY_HREF,
  IconCircle,
  buildPreparedChecks,
  firstName,
  inCallHref,
  useEmergencyProfileData,
  useFinishAndGoHome,
  useOfficialCall,
  usePreparedEmergency,
  usePrivateAssistance,
  useNavigateOnce,
} from './parts';

export default function EmergencyNoAnswerScreen() {
  const router = useRouter();
  const go = useNavigateOnce();
  const theme = useAppTheme();
  const params = useLocalSearchParams<{ reason?: string }>();
  const failedToOpen = params.reason === 'failed';
  const assistance = usePrivateAssistance();
  const { prepared, loading, session } = usePreparedEmergency();
  const { profile } = useEmergencyProfileData();
  const { callOfficial, callingOfficial } = useOfficialCall();
  const finishAndGoHome = useFinishAndGoHome();
  const [redialing, setRedialing] = useState(false);
  const redialingRef = useRef(false);

  const name = assistance.service?.name ?? 'Tu servicio de asistencia';
  const caregiver = prepared?.profile.caregiver ?? profile?.caregiver ?? null;
  const checks = buildPreparedChecks(prepared, loading, session.caregiverNotifiedAt);

  const redial = async () => {
    if (redialingRef.current) return;
    redialingRef.current = true;
    setRedialing(true);
    try {
      const outcome = await EmergencyService.callPrivateAssistance().catch(() => 'failed' as const);
      if (outcome === 'success') {
        EmergencySession.callStarted('private');
        router.replace(inCallHref('private'));
        return;
      }
      if (outcome === 'not_configured') {
        router.replace(EMERGENCY_HREF.calling);
        return;
      }
      await showAlert('No se ha podido abrir el teléfono', `Vuelve a intentarlo o marca el número de ${name} desde tu teléfono.`);
    } finally {
      redialingRef.current = false;
      setRedialing(false);
    }
  };

  const finish = async () => {
    const ok = await confirmAsync({
      title: '¿Terminar y volver al inicio?',
      message: 'Se borrará lo que nos has contado. Si lo necesitas, puedes llamar al 112 en cualquier momento.',
      confirmText: 'Terminar',
      cancelText: 'Seguir aquí',
    });
    if (ok) finishAndGoHome();
  };

  return (
    <Screen gradient="emergency" header={<AppHeader title="Sin respuesta" fallbackHref={EMERGENCY_HREF.main} />} testID="emergency-no-answer">
      <View style={[styles.center, { gap: theme.spacing.sm }]}>
        <View style={styles.badgeBox}>
          <IconCircle icon="call" size={88} iconSize={42} background={theme.colors.danger} />
          <View style={[styles.badge, { backgroundColor: theme.colors.surface, borderColor: theme.colors.dangerSoft }]}>
            <IconCircle icon="close" size={30} iconSize={20} background={theme.colors.warning} />
          </View>
        </View>
        <AppText variant="title" color="dangerText" align="center" accessibilityRole="header">
          {failedToOpen ? `No se ha podido llamar a ${name}` : `${name} no ha contestado`}
        </AppText>
        <AppText variant="body" color="text" align="center" style={styles.lead}>
          {failedToOpen
            ? 'No hemos podido abrir la llamada a tu servicio de asistencia. Tú decides qué hacer ahora:'
            : 'No hemos podido hablar con tu servicio de asistencia. Tú decides qué hacer ahora:'}
        </AppText>
      </View>

      <View style={{ gap: theme.spacing.sm, marginTop: theme.spacing.lg }}>
        <AssistanceActionButton label={`Volver a llamar a ${name}`} onPress={() => void redial()} loading={redialing} testID="noanswer-redial" />

        <Card tone="danger" elevated={false} style={{ gap: theme.spacing.sm }}>
          <AppText variant="heading" color="dangerText" accessibilityRole="header">
            ¿Es grave o no mejora?
          </AppText>
          <AppText variant="body" color="text">
            Llama al 112, el servicio oficial de emergencias.
          </AppText>
          <EmergencyCallButton onPress={() => void callOfficial({ navigate: 'replace' })} loading={callingOfficial} />
        </Card>

        {caregiver ? (
          <SecondaryButton
            label={`Avisar a ${firstName(caregiver.name)}`}
            icon="people"
            variant="tonal"
            onPress={() => go(EMERGENCY_HREF.notify)}
          />
        ) : null}
        <SecondaryButton
          label="Escuchar el mensaje para el operador"
          icon="volume-high"
          variant="tonal"
          onPress={() => go(EMERGENCY_HREF.voiceMessage)}
        />
      </View>

      <Card style={{ marginTop: theme.spacing.lg, gap: theme.spacing.xs }}>
        <AppText variant="subheading" color="heading" accessibilityRole="header">
          Tu información sigue preparada
        </AppText>
        {checks.map((c) => (
          <CheckItem key={c.key} label={c.label} state={c.state} detail={c.detail} />
        ))}
        <TextButton label="Ver mi información" icon="document-text-outline" align="flex-start" style={styles.cardAction} onPress={() => go(EMERGENCY_HREF.prepared)} />
      </Card>

      <View style={{ marginTop: theme.spacing.md, gap: theme.spacing.md }}>
        <OfficialEmergencyNote />
        <SecondaryButton label="Terminar y volver al inicio" icon="home-outline" variant="neutral" onPress={() => void finish()} testID="noanswer-finish" />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center' },
  lead: { maxWidth: 360 },
  badgeBox: { width: 100, height: 96, alignItems: 'center', justifyContent: 'center' },
  badge: { position: 'absolute', right: 0, bottom: 0, borderRadius: 20, borderWidth: 3, padding: 2 },
  cardAction: { marginLeft: -8 },
});
