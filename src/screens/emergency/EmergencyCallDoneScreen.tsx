/**
 * /emergency/call-done?target=private|official · Llamada realizada (referencia e08_calldone).
 * La persona ha indicado que la han atendido. Sin afirmar que "se ha enviado" nada:
 * la información sigue preparada por si la necesita.
 */
import { StyleSheet, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import {
  AppHeader,
  AppText,
  Card,
  CheckItem,
  EmergencyCallButton,
  PrimaryButton,
  Screen,
  SecondaryButton,
  TextButton,
} from '../../components';
import { useAppTheme, useEmergencySession } from '../../hooks';
import { confirmAsync } from '../../utils/dialogs';
import {
  EMERGENCY_HREF,
  IconCircle,
  buildPreparedChecks,
  parseTarget,
  useEmergencyProfileData,
  useFinishAndGoHome,
  useOfficialCall,
  usePreparedEmergency,
  usePrivateAssistance,
  useNavigateOnce,
} from './parts';

export default function EmergencyCallDoneScreen() {
  const go = useNavigateOnce();
  const theme = useAppTheme();
  const params = useLocalSearchParams<{ target?: string }>();
  const session = useEmergencySession();
  const target = parseTarget(params.target, session.callTarget);
  const official = target === 'official';
  const assistance = usePrivateAssistance(!official);
  const { prepared, loading } = usePreparedEmergency();
  const { profile } = useEmergencyProfileData();
  const { callOfficial, callingOfficial } = useOfficialCall();
  const finishAndGoHome = useFinishAndGoHome();

  const name = assistance.service?.name ?? 'tu servicio de asistencia';
  const caregiver = prepared?.profile.caregiver ?? profile?.caregiver ?? null;
  const checks = buildPreparedChecks(prepared, loading, session.caregiverNotifiedAt);

  const confirmLeave = async () => {
    const ok = await confirmAsync({
      title: '¿Volver al inicio?',
      message: 'Terminaremos la emergencia y se borrará lo que nos has contado.',
      confirmText: 'Volver al inicio',
      cancelText: 'Seguir aquí',
    });
    if (ok) finishAndGoHome();
  };

  return (
    <Screen header={<AppHeader title="Llamada realizada" onBack={() => void confirmLeave()} />} testID="emergency-call-done">
      <Card tone="success" elevated={false} style={[styles.center, { gap: theme.spacing.xs, paddingVertical: theme.spacing.lg }]}>
        <IconCircle icon="checkmark" size={72} iconSize={44} background={theme.colors.successStrong} />
        <AppText variant="title" color="successText" align="center" accessibilityRole="header" style={{ marginTop: theme.spacing.xs }}>
          {official ? 'Has llamado al 112' : `Has hablado con ${name}`}
        </AppText>
        <AppText variant="body" color="text" align="center" style={styles.lead}>
          Sigue sus indicaciones. Si la situación empeora, llama al 112.
        </AppText>
      </Card>

      <Card style={{ marginTop: theme.spacing.md, gap: theme.spacing.xs }}>
        <AppText variant="subheading" color="heading" accessibilityRole="header">
          Información preparada
        </AppText>
        {checks.map((c) => (
          <CheckItem key={c.key} label={c.label} state={c.state} detail={c.detail} />
        ))}
        <TextButton
          label="Ver mi información"
          icon="document-text-outline"
          align="flex-start"
          style={styles.cardAction}
          onPress={() => go(EMERGENCY_HREF.prepared)}
        />
      </Card>

      <View style={{ gap: theme.spacing.sm, marginTop: theme.spacing.lg }}>
        {caregiver ? (
          <PrimaryButton label="Avisar a familiar" icon="people" onPress={() => go(EMERGENCY_HREF.notify)} testID="calldone-notify" />
        ) : null}
        <EmergencyCallButton
          variant="soft"
          label={official ? 'Volver a llamar al 112' : 'Llamar al 112'}
          onPress={() => void callOfficial({ navigate: 'replace' })}
          loading={callingOfficial}
        />
        <SecondaryButton label="Volver al inicio" icon="home-outline" variant="tonal" onPress={finishAndGoHome} testID="calldone-home" />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center' },
  lead: { maxWidth: 340 },
  cardAction: { marginLeft: -8 },
});
