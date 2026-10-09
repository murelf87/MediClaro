/**
 * Pestaña "Perfil y ajustes" (referencia 13_profile).
 * Tarjeta de la persona → /account · filas planas con separadores finos · emergencia (solo Premium) ·
 * información legal · cerrar sesión. Los ajustes de accesibilidad se aplican al instante.
 * Con perfil de cuidador/a se avisa arriba de que el perfil es de cuidador/a; sin Premium no elige voces.
 */
import { RefreshControl, StyleSheet, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import {
  AppText,
  Avatar,
  Card,
  Divider,
  Icon,
  InfoBanner,
  Screen,
  SectionHeader,
  SettingRow,
  Skeleton,
} from '../../components';
import { useAppTheme, useAsync, useEntitlement, usePreferences, useRefreshOnFocus, useSession } from '../../hooks';
import { AssistantMemoryService, ProfileService, TestAccess } from '../../services';
import { CaregiverService } from '../../services/CaregiverService';
import { OwnerService } from '../../services/OwnerService';
import { FONT_SIZE_LABELS } from '../../theme';
import { APP_VERSION } from '../../config/app';
import { formatPhoneForDisplay } from '../../utils/format';
import { rateMediClaro, shareMediClaro } from '../../utils/device';
import { showAlert } from '../../utils/dialogs';
import { CrownIcon } from '../premium/parts';
import { useAccountActions } from './accountActions';
import { AaGlyph, FlatRows, LeadingSlot } from './parts';

export default function ProfileScreen() {
  const router = useRouter();
  const theme = useAppTheme();
  const c = theme.colors;
  const { prefs, setEasyMode, syncError } = usePreferences();
  const { session } = useSession();
  const { confirmSignOut } = useAccountActions();

  const profile = useAsync(() => ProfileService.getProfile(), []);
  const careState = useAsync(() => CaregiverService.snapshot(), [session?.userId]);
  const entitlement = useEntitlement();
  const ownerAccess = useAsync(() => OwnerService.access(), [session?.userId]);
  // Memoria del asistente: se activa o desactiva aquí (en el chat solo se ofrece mientras está desactivada).
  const memory = useAsync(() => AssistantMemoryService.get(), [session?.userId]);
  useRefreshOnFocus(ownerAccess.refresh);
  useRefreshOnFocus(profile.refresh);
  useRefreshOnFocus(careState.refresh);
  useRefreshOnFocus(entitlement.refresh);

  const mode = session?.mode ?? 'verified';
  const phone = profile.data?.phone ?? session?.phone ?? null;
  const caregiverProfile = careState.data?.role === 'caregiver';
  const isPremium = entitlement.isPremium;
  // Perfil de emergencia, número privado y qué compartir: funciones de Premium (el 112 sigue siempre en Emergencia).
  const emergencyExtras = entitlement.unlocked;
  const caredFor = (careState.data?.links ?? [])
    .filter((l) => l.accepted && !!session?.userId && l.caregiverId === session.userId && l.patientId !== session.userId)
    .map((l) => l.patientName)
    .filter(Boolean);
  const caredForText = caredFor.length ? caredFor.join(', ') : 'la persona vinculada';
  // El teléfono solo se solicita después de tener Premium. Un perfil Básico o
  // Cuidador/a gratuito no necesita teléfono ni verificación SMS.
  const needsPhone = mode === 'anonymous' && !TestAccess.isActive() && !phone && isPremium;
  const subtitle =
    mode === 'demo'
      ? 'Modo demostración'
      : needsPhone
        ? 'Premium · completa tu teléfono'
        : caregiverProfile
          ? isPremium ? 'Cuidador/a + Premium' : 'Perfil Cuidador/a'
          : isPremium
            ? phone ? formatPhoneForDisplay(phone) : 'Perfil Premium'
            : mode === 'anonymous'
              ? 'Perfil Básico'
              : phone
                ? formatPhoneForDisplay(phone)
                : 'Perfil Básico';
  const displayName = profile.data?.displayName ?? null;
  const profileIncomplete = profile.status === 'success' && !!profile.data && (!profile.data.displayName || !profile.data.sex || profile.data.age === null);
  const nameText = profile.status === 'loading' ? null : profile.status === 'error' ? 'Tu cuenta' : displayName ?? 'Completa tu perfil';
  // Sin forma de contratar Premium en la app, la fila muestra el plan, sin «Mejorar».
  const sell = entitlement.canSell;
  const premiumValue =
    entitlement.status === 'ready'
      ? sell
        ? isPremium
          ? 'Activo'
          : 'Mejorar'
        : isPremium
          ? 'Premium'
          : 'Gratuito'
      : undefined;

  const refreshAll = () => {
    void profile.refresh();
    void careState.refresh();
    void entitlement.refresh();
  };

  const shareApp = async () => {
    if (!(await shareMediClaro())) {
      await showAlert('Compartir MediClaro', 'No se ha podido abrir el menú para compartir. Inténtalo de nuevo desde tu teléfono.');
    }
  };

  const rateApp = async () => {
    if (!(await rateMediClaro())) {
      await showAlert('Valorar MediClaro', 'La valoración se habilitará en esta tienda cuando la ficha pública de MediClaro esté disponible.');
    }
  };

  return (
    <Screen
      edges={['top']}
      refreshControl={
        <RefreshControl
          refreshing={profile.refreshing}
          onRefresh={refreshAll}
          tintColor={c.primary}
          colors={[c.primary]}
        />
      }
    >
      <AppText variant="title" accessibilityRole="header" style={{ marginTop: theme.spacing.md, marginBottom: theme.spacing.md }}>
        Perfil y ajustes
      </AppText>

      {syncError ? <InfoBanner tone="warning" message={syncError} style={{ marginBottom: theme.spacing.md }} /> : null}

      {caregiverProfile ? (
        <InfoBanner
          tone="success"
          icon="people-outline"
          title={isPremium ? 'Tu perfil es de cuidador/a + Premium' : 'Tu perfil es de cuidador/a'}
          message={isPremium
            ? `Recibes los avisos y el chat de emergencia de ${caredForText}, y tienes Premium para tu propio uso.`
            : `Recibes gratis los avisos y el chat de emergencia de ${caredForText}. La IA, la identificación y las voces son de Premium: solo las tendrás si lo contratas para ti.`}
          action={{ label: 'Ver avisos y chat', onPress: () => router.push('/caregiver') }}
          style={{ marginBottom: theme.spacing.md }}
        />
      ) : null}

      {needsPhone ? (
        <InfoBanner
          tone="info"
          icon="shield-checkmark"
          title="Completa tu cuenta"
          message="Añade tu teléfono para no perder tu Premium si cambias de móvil."
          action={{ label: 'Añadir mi teléfono', onPress: () => router.push('/complete-account') }}
          style={{ marginBottom: theme.spacing.md }}
        />
      ) : null}

      {profileIncomplete ? (
        <InfoBanner
          tone="info"
          icon="person-circle-outline"
          title="Completa tu perfil"
          message="Añade tu nombre, sexo, edad y, si quieres, teléfono y foto."
          action={{ label: 'Completar perfil', onPress: () => router.push({ pathname: '/profile-setup', params: { next: '/account' } }) }}
          style={{ marginBottom: theme.spacing.md }}
        />
      ) : null}

      <Card
        onPress={() => profileIncomplete ? router.push({ pathname: '/profile-setup', params: { next: '/account' } }) : router.push('/account')}
        accessibilityLabel={`${nameText ?? 'Tu cuenta'}. ${subtitle}`}
        accessibilityHint="Abre tus datos de cuenta"
        testID="profile-account"
      >
        <View style={styles.userRow}>
          <Avatar name={displayName} uri={profile.data?.avatarUrl} size={64} />
          <View style={styles.userText}>
            {nameText ? (
              <AppText variant="heading" color={displayName || profile.status === 'error' ? 'heading' : 'primary'}>
                {nameText}
              </AppText>
            ) : (
              <Skeleton width="70%" height={22} />
            )}
            <AppText variant="caption" color="textSecondary">
              {subtitle}
            </AppText>
          </View>
          <Icon name="chevron-forward" size={24} color={c.textMuted} />
        </View>
      </Card>

      <View style={{ marginTop: theme.spacing.sm }}>
        <FlatRows>
          <SettingRow
            leading={
              <LeadingSlot>
                <CrownIcon size={28} />
              </LeadingSlot>
            }
            label={sell ? 'MediClaro Premium' : 'Tu plan'}
            value={premiumValue}
            valueTone={isPremium ? 'success' : sell ? 'primary' : 'muted'}
            showChevron={!premiumValue}
            onPress={() => router.push('/premium')}
            testID="profile-premium"
          />
          <SettingRow
            leading={<AaGlyph />}
            label="Tamaño del texto"
            value={FONT_SIZE_LABELS[prefs.fontSize]}
            onPress={() => router.push('/accessibility')}
            testID="profile-text-size"
          />
          {caregiverProfile && !isPremium ? null : <SettingRow
            icon={isPremium ? "volume-high-outline" : "lock-closed-outline"}
            label="Voces de MediClaro"
            value={isPremium ? prefs.assistantVoice : undefined}
            description={isPremium ? "La voz con la que te habla el asistente" : "Disponible con MediClaro Premium"}
            right={!isPremium ? <View style={{flexDirection:'row',alignItems:'center',gap:4,flexShrink:0}}><Icon name="lock-closed" size={14} color={c.premiumText}/><AppText variant="small" style={{color:c.premiumText}}>Premium</AppText></View> : undefined}
            onPress={() => router.push(isPremium ? '/accessibility' : '/premium')}
            testID="profile-voices"
          />}
          {isPremium ? (
            <SettingRow
              icon="sparkles-outline"
              label="Memoria del asistente"
              description="Recuerda gustos y rutinas que le cuentes, nunca datos médicos"
              toggle={{
                value: memory.data?.enabled === true,
                onChange: (v) => void AssistantMemoryService.setEnabled(v).then(() => memory.refresh()),
              }}
              testID="profile-assistant-memory"
            />
          ) : null}
          <SettingRow
            icon="timer-outline"
            label="Modo fácil"
            description="Pantallas más simples y letra más grande"
            toggle={{ value: prefs.easyMode, onChange: (v) => void setEasyMode(v) }}
            testID="profile-easy-mode"
          />
          {ownerAccess.status === 'success' && !ownerAccess.error && ownerAccess.data ? <SettingRow icon="shield-checkmark-outline" label="Panel de propietario" description="Usuarios, bonos, suscripciones y estadísticas · con código" onPress={() => router.push('/owner' as Href)} testID="profile-owner-dashboard" /> : null}
          <SettingRow icon="globe-outline" label="Idioma" value="Español" description="Español de España" onPress={() => router.push('/language')} testID="profile-language" />
          <SettingRow
            icon="people-outline"
            label={caregiverProfile ? 'Cuidador/a y vinculaciones' : isPremium ? 'Mi cuidador/a' : '¿Quieres ser cuidador/a?'}
            description={caregiverProfile ? 'Gestiona pacientes vinculados y avisos' : isPremium ? 'Código de 6 números o QR opcional' : 'Es gratis. Vincúlate con un paciente Premium'}
            value={caregiverProfile ? 'Cuidador/a' : undefined}
            valueTone={caregiverProfile ? 'success' : 'muted'}
            onPress={() => profileIncomplete ? router.push({ pathname: '/profile-setup', params: { next: '/caregiver', mode: 'caregiver' } }) : router.push('/caregiver')}
            testID="profile-caregiver"
          />
          <SettingRow icon="notifications-outline" label="Notificaciones" onPress={() => router.push('/notifications')} />
          <SettingRow icon="lock-closed-outline" label="Privacidad y datos" onPress={() => router.push('/privacy')} />
          <SettingRow icon="help-circle-outline" label="Ayuda" onPress={() => router.push('/help')} />
          <SettingRow
            icon="share-social-outline"
            label="Compartir MediClaro"
            description="Envía el enlace de descarga a familiares"
            onPress={() => void shareApp()}
            testID="profile-share-app"
          />
          <SettingRow
            icon="star-outline"
            label="Valorar MediClaro"
            description="Cuéntanos si la app te resulta útil"
            onPress={() => void rateApp()}
            testID="profile-rate-app"
          />
        </FlatRows>
      </View>

      {emergencyExtras ? (
        <View style={{ marginTop: theme.spacing.lg }} testID="profile-emergency-section">
          <SectionHeader title="Emergencia" />
          <FlatRows>
            <SettingRow icon="medkit-outline" label="Mi perfil de emergencia" onPress={() => router.push('/emergency-profile')} />
            <SettingRow icon="headset-outline" label="Número privado de asistencia" onPress={() => router.push('/private-assistance')} />
            <SettingRow
              icon="shield-checkmark-outline"
              label="Qué compartir en una emergencia"
              onPress={() => router.push('/emergency-sharing')}
            />
          </FlatRows>
        </View>
      ) : null}

      <Divider style={{ marginTop: theme.spacing.md }} />
      <FlatRows>
        <SettingRow icon="document-text-outline" label="Información legal" onPress={() => router.push('/legal')} />
        <SettingRow
          icon="log-out-outline"
          label="Cerrar sesión"
          destructive
          showChevron={false}
          onPress={() => void confirmSignOut()}
          testID="profile-sign-out"
        />
      </FlatRows>

      <AppText variant="caption" color="textMuted" align="center" style={{ marginTop: theme.spacing.lg }}>
        {`MediClaro ${APP_VERSION} · Información oficial AEMPS`}
      </AppText>
    </Screen>
  );
}

const styles = StyleSheet.create({
  userRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  userText: { flex: 1, gap: 2 },
});
