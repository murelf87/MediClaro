/**
 * /emergency/prepared · Tu información (referencia e04_prepared).
 * Reúne perfil + ubicación + lo que la persona ha indicado. Nada se envía solo:
 * la persona podrá leerlo o reproducirlo a quien la atienda por teléfono.
 */
import { StyleSheet, View } from 'react-native';
import {
  AppHeader,
  AppText,
  AssistanceCallButton,
  Card,
  CheckItem,
  EmergencyCallButton,
  ErrorState,
  Icon,
  InfoBanner,
  ProgressRing,
  Screen,
  SecondaryButton,
  TextButton,
} from '../../components';
import { useAppTheme } from '../../hooks';
import { type PreparedEmergency } from '../../services';
import { emergencyVoiceService } from '../../services/emergency/EmergencyVoiceService';
import { formatLocationForSpeech } from '../../services/emergency/LocationService';
import { openAppSettings } from '../../utils/device';
import { showAlert } from '../../utils/dialogs';
import { capitalize, formatDateShort, formatPhoneForDisplay, formatTime, formatTimeAgo } from '../../utils/format';
import {
  EMERGENCY_HREF,
  IconCircle,
  LineRow,
  SectionCard,
  ValueRow,
  assistantHref,
  firstName,
  openMapsOrExplain,
  symptomLabel,
  useOfficialCall,
  usePreparedEmergency,
  usePrivateAssistance,
  useNavigateOnce,
} from './parts';

/** Pasado este tiempo se vuelve a preparar al entrar (la ubicación puede haber cambiado). */
const PREPARED_MAX_AGE_MS = 5 * 60 * 1000;
const NOT_SHARED = 'No compartido';

export default function EmergencyPreparedScreen() {
  const go = useNavigateOnce();
  const theme = useAppTheme();
  const { prepared, refreshing, error, retry, session } = usePreparedEmergency({ refreshIfOlderThanMs: PREPARED_MAX_AGE_MS });
  const assistance = usePrivateAssistance();
  const { callOfficial, callingOfficial } = useOfficialCall();

  const footer = (
    <>
      {assistance.service ? (
        <AssistanceCallButton name={assistance.service.name} onPress={() => go(EMERGENCY_HREF.calling)} />
      ) : null}
      <EmergencyCallButton onPress={() => void callOfficial()} loading={callingOfficial} />
    </>
  );

  let body;
  if (!prepared && error) {
    body = <ErrorState title="No hemos podido preparar tu información" message={error} onRetry={() => void retry()} />;
  } else if (!prepared) {
    body = <PreparingView />;
  } else {
    const told = prepared.report.symptomsSelected;
    const mode = session.mode === 'can_speak' ? 'can_speak' : 'unsure';
    body = (
      <View style={{ gap: theme.spacing.md }}>
        <Card tone="success" elevated={false} style={[styles.center, { gap: theme.spacing.xs, paddingVertical: theme.spacing.lg }]}>
          <IconCircle icon="checkmark" size={64} iconSize={38} background={theme.colors.successStrong} />
          <AppText variant="heading" color="successText" align="center" accessibilityRole="header" style={{ marginTop: theme.spacing.xs }}>
            Tu información está lista
          </AppText>
          <AppText variant="body" color="textSecondary" align="center" style={styles.lead}>
            Podrás leerla o reproducirla a quien te atienda por teléfono.
          </AppText>
          <View style={styles.inline}>
            <AppText variant="caption" color="textSecondary">
              {`Preparada a las ${formatTime(prepared.preparedAt)}`}
            </AppText>
            <TextButton
              label={refreshing ? 'Actualizando…' : 'Actualizar'}
              icon="refresh"
              onPress={() => void retry()}
              disabled={refreshing}
              accessibilityHint="Vuelve a reunir tus datos y tu ubicación"
            />
          </View>
        </Card>

        {error ? <InfoBanner tone="danger" title="No hemos podido actualizar tu información" message={error} /> : null}

        {prepared.profile.source === 'empty' ? (
          <InfoBanner
            tone="warning"
            title="Tu perfil de emergencia está vacío"
            message="Complétalo para que quien te atienda sepa quién eres, qué tomas y a qué eres alérgico/a."
          >
            <TextButton
              label="Completar mi perfil"
              align="flex-start"
              style={styles.bannerAction}
              onPress={() => go(EMERGENCY_HREF.profileEdit)}
            />
          </InfoBanner>
        ) : null}

        <UserCard prepared={prepared} />
        <LocationCard
          prepared={prepared}
          refreshing={refreshing}
          onRetry={() => void retry()}
          onSharing={() => go(EMERGENCY_HREF.sharing)}
        />
        <MedicalCard
          prepared={prepared}
          told={told}
          onSharing={() => go(EMERGENCY_HREF.sharing)}
          onTell={() => go(assistantHref(mode, true))}
        />

        {!assistance.loading && !assistance.service ? (
          <InfoBanner
            tone="info"
            icon="headset"
            title="No tienes un número privado de asistencia"
            message="Puedes añadir el teléfono de tu teleasistencia o de un familiar. El 112 siempre está disponible."
          >
            <TextButton
              label="Configurarlo"
              align="flex-start"
              style={styles.bannerAction}
              onPress={() => go(EMERGENCY_HREF.privateAssistance)}
            />
          </InfoBanner>
        ) : null}

        <View style={{ gap: theme.spacing.sm }}>
          <SecondaryButton
            label="Escuchar el mensaje para el operador"
            icon="volume-high"
            variant="tonal"
            onPress={() => go(EMERGENCY_HREF.voiceMessage)}
          />
          {prepared.caregiverMessage && prepared.profile.caregiver ? (
            <SecondaryButton
              label={`Avisar a ${firstName(prepared.profile.caregiver.name)}`}
              icon="people"
              variant="tonal"
              onPress={() => go(EMERGENCY_HREF.notify)}
            />
          ) : null}
        </View>

        <InfoBanner tone="info" message="Si llamas, podrás leer o reproducir esta información al operador." />
      </View>
    );
  }

  return (
    <Screen header={<AppHeader title="Tu información" fallbackHref={EMERGENCY_HREF.main} />} footer={footer} testID="emergency-prepared">
      {body}
    </Screen>
  );
}

function PreparingView() {
  const theme = useAppTheme();
  return (
    <View style={[styles.center, { gap: theme.spacing.md, paddingVertical: theme.spacing.xl }]}>
      <View accessible accessibilityRole="progressbar" accessibilityLabel="Preparando tu información">
        <ProgressRing size={132} strokeWidth={10}>
          <Icon name="document-text" size={44} color={theme.colors.primary} />
        </ProgressRing>
      </View>
      <AppText variant="heading" align="center">
        Preparando tu información…
      </AppText>
      <View style={[styles.checks, { gap: theme.spacing.xxs }]}>
        <CheckItem label="Tus datos" state="pending" />
        <CheckItem label="Tu ubicación" state="pending" />
        <CheckItem label="Lo que nos has contado" state="pending" />
      </View>
      <AppText variant="caption" color="textSecondary" align="center">
        Puedes llamar al 112 en cualquier momento.
      </AppText>
    </View>
  );
}

function UserCard({ prepared }: { prepared: PreparedEmergency }) {
  const theme = useAppTheme();
  const p = prepared.profile;
  const name = p.fullName.trim();
  const dob = p.dateOfBirth ? formatDateShort(p.dateOfBirth) : '';
  const ageText = p.age !== null && dob ? `${p.age} años (${dob})` : dob ? `Nacimiento: ${dob}` : 'Fecha de nacimiento no indicada';
  const phone = p.phone ? formatPhoneForDisplay(p.phone) : '';
  return (
    <SectionCard title="Datos del usuario">
      <LineRow icon="person" iconColor={theme.colors.primary} text={name || 'Sin nombre en tu perfil'} muted={!name} />
      <LineRow icon="calendar" iconColor={theme.colors.primary} text={ageText} muted={!dob} />
      <LineRow icon="call" iconColor={theme.colors.primary} text={phone || 'Teléfono no disponible'} muted={!phone} />
    </SectionCard>
  );
}

function LocationCard({
  prepared,
  refreshing,
  onRetry,
  onSharing,
}: {
  prepared: PreparedEmergency;
  refreshing: boolean;
  onRetry: () => void;
  onSharing: () => void;
}) {
  const theme = useAppTheme();
  const loc = prepared.location;
  const perms = prepared.profile.permissions;
  const declared = prepared.report.registeredAddress;

  const activateLocation = async () => {
    const ok = await openAppSettings();
    if (!ok) {
      await showAlert(
        'No se han podido abrir los ajustes',
        'Abre los Ajustes de tu teléfono y permite que MediClaro use tu ubicación. Después pulsa «Reintentar».',
      );
    }
  };

  const declaredRow = declared ? (
    <LineRow
      icon="home"
      iconColor={theme.colors.primary}
      text={declared.street}
      secondary={`${[declared.postalCode, declared.city].filter(Boolean).join(' ')} · Dirección de tu perfil`}
    />
  ) : !perms.shareAddress && prepared.profile.address.trim() ? (
    <LineRow icon="home-outline" iconColor={theme.colors.textMuted} text={`Dirección de tu perfil: ${NOT_SHARED}`} muted />
  ) : null;

  if (loc) {
    const place = loc.resolvedAddress?.trim() ?? '';
    const cityLine = [loc.resolvedPostalCode, loc.resolvedCity].filter(Boolean).join(' ');
    const coords = `${loc.latitude.toFixed(5)}, ${loc.longitude.toFixed(5)}`;
    const precision = `Precisión: ± ${Math.round(loc.accuracy)} m${loc.isApproximate ? ' (aproximada)' : ''}`;
    const updated = `Actualizada a las ${formatTime(loc.timestamp)} · ${formatTimeAgo(loc.timestamp)}`;
    const speakLocation = async () => {
      try {
        await emergencyVoiceService.speakText(formatLocationForSpeech(loc));
      } catch {
        await showAlert('No se ha podido leer la ubicación', 'La dirección, las coordenadas y la precisión siguen visibles en pantalla.');
      }
    };
    return (
      <SectionCard title="Ubicación actual">
        <LineRow
          icon="location"
          iconColor={theme.colors.danger}
          text={place || cityLine || 'Ubicación del teléfono'}
          secondary={place && cityLine ? cityLine : undefined}
        />
        <AppText variant="body" style={styles.rowCaption}>
          {`Coordenadas: ${coords}`}
        </AppText>
        <AppText variant="caption" color="textSecondary" style={styles.rowCaption}>
          {precision}
        </AppText>
        <AppText variant="caption" color="textSecondary" style={styles.rowCaption}>
          {updated}
        </AppText>
        <TextButton
          label="Leer ubicación en voz alta"
          icon="volume-high"
          align="flex-start"
          style={styles.cardAction}
          onPress={() => void speakLocation()}
        />
        <TextButton
          label="Ver en el mapa"
          icon="map-outline"
          align="flex-start"
          style={styles.cardAction}
          onPress={() => void openMapsOrExplain(loc.latitude, loc.longitude)}
        />
        {/* Sin calle (p. ej. sin conexión para traducir las coordenadas): también la dirección del perfil. */}
        {place ? null : declaredRow}
      </SectionCard>
    );
  }

  return (
    <SectionCard title="Ubicación actual">
      {perms.shareLocation ? (
        <>
          <LineRow
            icon="location-outline"
            iconColor={theme.colors.textMuted}
            text={`Ubicación no disponible: ${prepared.locationError ?? 'sin datos del teléfono'}`}
          />
          <View style={styles.actionsRow}>
            <TextButton label="Activar ubicación" icon="settings-outline" onPress={() => void activateLocation()} />
            <TextButton label={refreshing ? 'Buscando…' : 'Reintentar'} icon="refresh" onPress={onRetry} disabled={refreshing} />
          </View>
        </>
      ) : (
        <>
          <LineRow icon="location-outline" iconColor={theme.colors.textMuted} text={`Ubicación del teléfono: ${NOT_SHARED}`} muted />
          <TextButton label="Cambiar qué se comparte" icon="options-outline" align="flex-start" style={styles.cardAction} onPress={onSharing} />
        </>
      )}
      {declaredRow}
    </SectionCard>
  );
}

function MedicalCard({
  prepared,
  told,
  onSharing,
  onTell,
}: {
  prepared: PreparedEmergency;
  told: string[];
  onSharing: () => void;
  onTell: () => void;
}) {
  const theme = useAppTheme();
  const { report } = prepared;
  const perms = prepared.profile.permissions;

  const meds = report.medications.length;
  const medsValue = !perms.shareMedications ? NOT_SHARED : meds > 0 ? String(meds) : 'Ninguno';
  const allergies = report.declaredAllergies.map((a) => a.value);
  const allergiesValue = !perms.shareAllergies ? NOT_SHARED : allergies.length ? allergies.join(', ') : 'Ninguna';
  const conditions = report.declaredConditions.map((c) => c.value);
  const conditionsValue = !perms.shareMedicalInfo ? NOT_SHARED : conditions.length ? conditions.join(', ') : 'Ninguna';
  const conversation = report.recentStatements.filter((s) => s.provenance === 'RECENT_CONVERSATION');
  const lastConversation = conversation.length ? conversation[conversation.length - 1] : null;
  const conversationValue = !perms.shareConversation ? NOT_SHARED : lastConversation ? capitalize(formatTimeAgo(lastConversation.timestamp)) : null;
  const anyNotShared = !perms.shareMedications || !perms.shareAllergies || !perms.shareMedicalInfo || !perms.shareConversation;

  return (
    <SectionCard title="Información médica relevante">
      <ValueRow icon="medkit" label="Medicamentos habituales" value={medsValue} muted={!perms.shareMedications || meds === 0} />
      <ValueRow icon="alert-circle" label="Alergias" value={allergiesValue} muted={!perms.shareAllergies || !allergies.length} />
      <ValueRow icon="fitness" label="Enfermedades" value={conditionsValue} muted={!perms.shareMedicalInfo || !conditions.length} />
      <ValueRow
        icon="chatbubble-ellipses"
        iconColor={theme.colors.primary}
        label="Lo que nos has contado"
        stacked
        value={told.length ? told.map((id) => `• ${symptomLabel(id)}`).join('\n') : 'Nada todavía'}
        muted={!told.length}
      >
        <TextButton
          label={told.length ? 'Cambiar lo que te pasa' : 'Indicar lo que te pasa'}
          align="flex-start"
          style={styles.inRowAction}
          onPress={onTell}
        />
      </ValueRow>
      {conversationValue ? (
        <ValueRow
          icon="time"
          iconColor={theme.colors.primary}
          label="Conversación previa"
          value={conversationValue}
          muted={!perms.shareConversation}
        />
      ) : null}
      {anyNotShared ? (
        <TextButton label="Cambiar qué se comparte" icon="options-outline" align="flex-start" style={styles.cardAction} onPress={onSharing} />
      ) : null}
    </SectionCard>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center' },
  lead: { maxWidth: 340 },
  inline: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'center', gap: 4 },
  checks: { width: '100%', maxWidth: 360 },
  actionsRow: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 8, marginLeft: 32 },
  cardAction: { marginLeft: 32 },
  inRowAction: { marginLeft: -8 },
  rowCaption: { marginLeft: 40 },
  bannerAction: { marginLeft: -8 },
});
