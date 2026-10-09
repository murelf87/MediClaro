/**
 * /emergency/confirm · ¿Es una emergencia? (referencia e02_confirm).
 * Tres caminos (puedo hablar · no puedo hablar · no estoy seguro) y el 112 siempre
 * disponible como opción distinta, que solo se llama si la persona lo pulsa.
 */
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { AppHeader, AppText, Card, EmergencyCallButton, Screen, SecondaryButton } from '../../components';
import { useAppTheme } from '../../hooks';
import { EmergencySession, type ActivationMode } from '../../services';
import { EMERGENCY_HREF, IconCircle, OptionCard, assistantHref, useOfficialCall, useNavigateOnce } from './parts';

export default function EmergencyConfirmScreen() {
  const router = useRouter();
  const go = useNavigateOnce();
  const theme = useAppTheme();
  const { callOfficial, callingOfficial } = useOfficialCall();

  const choose = (mode: ActivationMode) => {
    EmergencySession.start(mode);
    go(mode === 'cannot_speak' ? EMERGENCY_HREF.prepared : assistantHref(mode));
  };

  const cancel = () => {
    void EmergencySession.finish();
    if (router.canGoBack()) router.back();
    else router.replace(EMERGENCY_HREF.main);
  };

  return (
    <Screen
      gradient="emergency"
      header={<AppHeader title="Emergencia" fallbackHref={EMERGENCY_HREF.main} />}
      footer={
        <>
          <EmergencyCallButton label="Llamar al 112 ahora" onPress={() => void callOfficial()} loading={callingOfficial} />
          <SecondaryButton label="Cancelar" variant="neutral" onPress={cancel} testID="emergency-confirm-cancel" />
        </>
      }
    >
      <Card tone="danger" elevated={false} style={[styles.intro, { gap: theme.spacing.sm, paddingVertical: theme.spacing.lg }]}>
        <IconCircle icon="alert" size={72} iconSize={42} background={theme.colors.danger} />
        <AppText variant="title" color="dangerText" align="center" accessibilityRole="header">
          ¿Es una emergencia?
        </AppText>
        <AppText variant="body" color="textSecondary" align="center" style={styles.lead}>
          Si te encuentras mal o has tomado un medicamento incorrecto, elige una opción.
        </AppText>
      </Card>

      <View style={{ gap: theme.layout.stackGap, marginTop: theme.spacing.md }}>
        <OptionCard
          icon="chatbubbles"
          color={theme.colors.successStrong}
          title="Sí, puedo hablar"
          subtitle="El asistente te ayudará a preparar tu información"
          onPress={() => choose('can_speak')}
          testID="emergency-option-can-speak"
        />
        <OptionCard
          icon="mic-off"
          color={theme.colors.warning}
          title="No puedo hablar"
          subtitle="Prepararemos tu información para que la vea o escuche quien te atienda"
          onPress={() => choose('cannot_speak')}
          testID="emergency-option-cannot-speak"
        />
        <OptionCard
          icon="help"
          color={theme.colors.primary}
          title="No estoy seguro"
          subtitle="Te haremos unas preguntas rápidas"
          onPress={() => choose('unsure')}
          testID="emergency-option-unsure"
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  intro: { alignItems: 'center' },
  lead: { maxWidth: 340 },
});
