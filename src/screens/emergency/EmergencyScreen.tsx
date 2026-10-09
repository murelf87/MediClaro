/**
 * /emergency · Pantalla principal de emergencia (referencia 14_emergency + e13_important).
 * PÚBLICA: funciona sin sesión (solo 112 y números públicos). Con sesión añade el
 * servicio privado de asistencia (AZUL, independiente del 112), el asistente y los
 * contactos del perfil de emergencia.
 */
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import {
  AppHeader,
  AppText,
  AssistanceCallButton,
  Card,
  EmergencyCallButton,
  Icon,
  PulseHalo,
  Screen,
  SecondaryButton,
  Skeleton,
} from '../../components';
import { useAppTheme, useSession } from '../../hooks';
import { EmergencySession } from '../../services';
import { PUBLIC_HEALTH_RESOURCES } from '../../config/app';
import { formatPhoneForDisplay } from '../../utils/format';
import {
  EMERGENCY_HREF,
  ContactRow,
  ImportantNotice,
  callNumberOrExplain,
  useEmergencyProfileData,
  useOfficialCall,
  usePrivateAssistance,
  useNavigateOnce,
} from './parts';

export default function EmergencyScreen() {
  const go = useNavigateOnce();
  const theme = useAppTheme();
  const { status } = useSession();
  const signedIn = status === 'signedIn';
  const { callOfficial, callingOfficial } = useOfficialCall();
  const assistance = usePrivateAssistance(signedIn);
  const { profile, loading: profileLoading } = useEmergencyProfileData(signedIn);

  // Salir de la pantalla principal termina cualquier emergencia a medias
  // (borra lo contado y evita reutilizar datos antiguos en la siguiente).
  useEffect(() => {
    return () => {
      void EmergencySession.finish();
    };
  }, []);

  const toxicology = PUBLIC_HEALTH_RESOURCES.toxicology;
  const doctorPhone = profile?.primaryDoctorPhone.trim() ?? '';
  const caregiver = profile?.caregiver && profile.caregiver.phone.trim() ? profile.caregiver : null;

  const callPrivate = () => {
    EmergencySession.start('unsure');
    go(EMERGENCY_HREF.calling);
  };

  return (
    <Screen gradient="emergency" header={<AppHeader fallbackHref="/" />} testID="emergency-main">
      <View style={[styles.hero, { gap: theme.spacing.sm }]}>
        <PulseHalo size={148}>
          <View
            style={[styles.heroCircle, { backgroundColor: theme.colors.danger }, theme.shadow.danger]}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
          >
            <Icon name="call" size={52} color={theme.colors.onPrimary} />
          </View>
        </PulseHalo>
        <AppText variant="title" color="dangerText" align="center" accessibilityRole="header">
          ¿Es una urgencia?
        </AppText>
        <AppText variant="body" color="textSecondary" align="center" style={styles.lead}>
          Si has tomado una dosis incorrecta, crees que un medicamento te ha sentado mal o te encuentras muy mal, pide
          ayuda ahora.
        </AppText>
      </View>

      <View style={{ gap: theme.spacing.sm, marginTop: theme.spacing.lg }}>
        {signedIn && assistance.service ? (
          <>
            <AssistanceCallButton name={assistance.service.name} onPress={callPrivate} />
            <AppText variant="caption" color="textSecondary" align="center">
              Tu número de asistencia configurado se muestra primero. El 112 sigue disponible y solo se llama si tú lo pulsas.
            </AppText>
            <EmergencyCallButton onPress={() => void callOfficial({ fresh: true })} loading={callingOfficial} />
          </>
        ) : (
          <EmergencyCallButton onPress={() => void callOfficial({ fresh: true })} loading={callingOfficial} />
        )}
        {signedIn ? (
          <View style={{ gap: theme.spacing.xxs }}>
            <SecondaryButton
              label="Asistente de emergencia"
              icon="chatbubbles"
              variant="tonal"
              size="lg"
              onPress={() => go(EMERGENCY_HREF.confirm)}
              accessibilityHint="Te ayuda a preparar tu información"
              testID="emergency-assistant"
            />
            <AppText variant="caption" color="textSecondary" align="center">
              Te ayuda a preparar tu información
            </AppText>
          </View>
        ) : null}
      </View>

      <Card style={{ marginTop: theme.spacing.lg, gap: theme.spacing.xxs }}>
        <AppText variant="bodyStrong" color="heading" accessibilityRole="header">
          También puedes contactar con:
        </AppText>
        <ContactRow
          icon="flask"
          title={toxicology.label}
          subtitle={toxicology.display}
          accessibilityLabel={`Llamar al ${toxicology.label}, ${toxicology.display}`}
          onPress={() => void callNumberOrExplain(toxicology.phone, toxicology.display)}
          testID="emergency-toxicology"
        />
        {doctorPhone && profile ? (
          <ContactRow
            icon="medkit"
            title="Tu médico de cabecera"
            subtitle={[profile.primaryDoctorName.trim(), formatPhoneForDisplay(doctorPhone)].filter(Boolean).join(' · ')}
            accessibilityLabel={`Llamar a tu médico de cabecera, ${formatPhoneForDisplay(doctorPhone)}`}
            onPress={() => void callNumberOrExplain(doctorPhone, formatPhoneForDisplay(doctorPhone))}
          />
        ) : null}
        {caregiver ? (
          <ContactRow
            icon="people"
            title={caregiver.relationship.trim() ? `${caregiver.name} (${caregiver.relationship.trim().toLowerCase()})` : caregiver.name}
            subtitle={formatPhoneForDisplay(caregiver.phone)}
            accessibilityLabel={`Llamar a ${caregiver.name}, ${formatPhoneForDisplay(caregiver.phone)}`}
            onPress={() => void callNumberOrExplain(caregiver.phone, formatPhoneForDisplay(caregiver.phone))}
            testID="emergency-caregiver"
          />
        ) : null}
        {profile?.source === 'empty' ? (
          <ContactRow
            icon="person-add-outline"
            title="Prepara tu perfil de emergencia"
            subtitle="Así quien te atienda sabrá quién eres y qué tomas"
            trailing="chevron"
            onPress={() => go(EMERGENCY_HREF.profile)}
            testID="emergency-setup-profile"
          />
        ) : null}
        {profileLoading ? (
          <View style={[styles.skeletonRow, { gap: theme.spacing.sm }]}>
            <Skeleton width={40} height={40} radius={12} />
            <Skeleton width="60%" height={18} />
          </View>
        ) : null}
      </Card>

      <ImportantNotice style={{ marginTop: theme.spacing.md }} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', marginTop: 4 },
  heroCircle: { width: 104, height: 104, borderRadius: 52, alignItems: 'center', justifyContent: 'center' },
  lead: { maxWidth: 360 },
  skeletonRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, paddingHorizontal: 4 },
});
