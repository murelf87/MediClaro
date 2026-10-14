/**
 * Pestaña "Perfil y ajustes" (referencia 13_profile).
 * Tarjeta de la persona → /account · filas planas con separadores finos · emergencia ·
 * información legal · cerrar sesión. Los ajustes de accesibilidad se aplican al instante.
 */
import { RefreshControl, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
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
import { ProfileService, TestAccess } from '../../services';
import { FONT_SIZE_LABELS } from '../../theme';
import { APP_VERSION } from '../../config/app';
import { formatPhoneForDisplay } from '../../utils/format';
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
  const entitlement = useEntitlement();
  useRefreshOnFocus(profile.refresh);
  useRefreshOnFocus(entitlement.refresh);

  const mode = session?.mode ?? 'verified';
  const phone = profile.data?.phone ?? session?.phone ?? null;
  // Cuenta creada al pagar que aún no tiene teléfono (no el acceso de prueba).
  const needsPhone = mode === 'anonymous' && !TestAccess.isActive() && !phone;
  const subtitle =
    mode === 'demo'
      ? 'Modo demostración'
      : needsPhone
        ? 'Sin teléfono · completa tu cuenta'
        : mode === 'anonymous'
          ? 'Acceso de prueba'
          : phone
            ? formatPhoneForDisplay(phone)
            : 'Ver datos de cuenta';
  const displayName = profile.data?.displayName ?? null;
  const nameText = profile.status === 'loading' ? null : profile.status === 'error' ? 'Tu cuenta' : displayName ?? 'Añade tu nombre';

  const isPremium = entitlement.isPremium;
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
    void entitlement.refresh();
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

      <Card
        onPress={() => router.push('/account')}
        accessibilityLabel={`${nameText ?? 'Tu cuenta'}. ${subtitle}`}
        accessibilityHint="Abre tus datos de cuenta"
        testID="profile-account"
      >
        <View style={styles.userRow}>
          <Avatar name={displayName} size={64} />
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
          <SettingRow
            icon="timer-outline"
            label="Modo fácil"
            description="Pantallas más simples y letra más grande"
            toggle={{ value: prefs.easyMode, onChange: (v) => void setEasyMode(v) }}
            testID="profile-easy-mode"
          />
          <SettingRow icon="globe-outline" label="Idioma" value="Español" onPress={() => router.push('/language')} />
          <SettingRow icon="notifications-outline" label="Notificaciones" onPress={() => router.push('/notifications')} />
          <SettingRow icon="lock-closed-outline" label="Privacidad y datos" onPress={() => router.push('/privacy')} />
          <SettingRow icon="help-circle-outline" label="Ayuda" onPress={() => router.push('/help')} />
        </FlatRows>
      </View>

      <View style={{ marginTop: theme.spacing.lg }}>
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
