/**
 * /account — Datos de cuenta.
 * Foto de perfil: foto grande con un botón de cámara; al tocarla se abren tres opciones claras (elegir de mis fotos,
 * hacer una foto o quitarla). Nombre (editable), teléfono, plan, fecha de alta y uso del mes.
 * Acciones: descargar mis datos, cerrar sesión y eliminar la cuenta (doble confirmación).
 */
import { useState, type ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import {
  AppHeader,
  AppText,
  Avatar,
  Divider,
  ErrorState,
  Icon,
  InfoBanner,
  ListGroup,
  PrimaryButton,
  Screen,
  SectionHeader,
  SettingRow,
  Skeleton,
  TextButton,
  TextField,
} from '../../components';
import { confirmAsync } from '../../utils/dialogs';
import { pickProfilePhoto, type PhotoSource } from './profilePhoto';
import { useAppTheme, useAsync, useEntitlement, useRefreshOnFocus, useSession } from '../../hooks';
import { ProfileService, SubscriptionService } from '../../services';
import { formatDateLong, formatPhoneForDisplay } from '../../utils/format';
import { errorMessage } from '../premium/parts';
import { useAccountActions } from './accountActions';
import { FadeIn } from '../../components/Motion';
import { InfoRow, UsageBar } from './parts';

const NAME_MAX = 60;

function validateName(raw: string): string | null {
  const name = raw.trim();
  if (!name) return 'Escribe tu nombre.';
  if (name.length < 2) return 'El nombre es demasiado corto.';
  if (name.length > NAME_MAX) return `El nombre puede tener como máximo ${NAME_MAX} letras.`;
  return null;
}

export default function AccountScreen() {
  const router = useRouter();
  const theme = useAppTheme();
  const c = theme.colors;
  const { session } = useSession();
  const entitlement = useEntitlement();
  const { exporting, deleting, signingOut, downloadMyData, deleteMyAccount, confirmSignOut } = useAccountActions();

  const data = useAsync(async () => {
    const [profile, subscription] = await Promise.all([
      ProfileService.getProfile(),
      SubscriptionService.getSubscription().catch(() => null),
    ]);
    return { profile, subscription };
  }, []);
  useRefreshOnFocus(data.refresh);

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [nameError, setNameError] = useState<string | null>(null);
  const [savingName, setSavingName] = useState(false);
  const [photoBusy, setPhotoBusy] = useState<PhotoSource | 'remove' | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [photoMenu, setPhotoMenu] = useState(false);

  const profile = data.data?.profile ?? null;
  const sub = data.data?.subscription ?? null;
  // El uso solo llega cuando el servidor aplica el mismo plan que se ve (ver SubscriptionService).
  const usage = sub?.usage ?? null;
  const phone = profile?.phone ?? null;
  const noPhone = !phone;

  const startEdit = () => {
    setDraft(profile?.displayName ?? '');
    setNameError(null);
    setEditing(true);
  };

  const cancelEdit = () => {
    setEditing(false);
    setNameError(null);
  };

  const saveName = async () => {
    if (savingName) return;
    const problem = validateName(draft);
    if (problem) {
      setNameError(problem);
      return;
    }
    const name = draft.trim().replace(/\s+/g, ' ');
    setSavingName(true);
    try {
      await ProfileService.updateProfile({ displayName: name });
      const current = data.data;
      if (current) {
        data.setData({
          ...current,
          profile: { ...current.profile, displayName: name, settings: { ...current.profile.settings, displayName: name } },
        });
      }
      setEditing(false);
    } catch (e) {
      setNameError(errorMessage(e));
    } finally {
      setSavingName(false);
    }
  };

  /** Añadir o cambiar la foto de perfil (galería o cámara). */
  const changePhoto = async (source: PhotoSource) => {
    if (photoBusy) return;
    setPhotoError(null);
    setPhotoMenu(false);
    try {
      const photo = await pickProfilePhoto(source);
      if (!photo) return;
      setPhotoBusy(source);
      await ProfileService.uploadAvatar(photo.uri, photo.mimeType);
      await data.refresh();
    } catch (e) {
      setPhotoError(errorMessage(e));
    } finally {
      setPhotoBusy(null);
    }
  };

  const removePhoto = async () => {
    if (photoBusy) return;
    const ok = await confirmAsync({
      title: 'Quitar la foto',
      message: '¿Quieres quitar tu foto de perfil? Se verán tus iniciales.',
      confirmText: 'Quitar foto',
      cancelText: 'Cancelar',
      destructive: true,
    });
    if (!ok) return;
    setPhotoError(null);
    setPhotoMenu(false);
    setPhotoBusy('remove');
    try {
      await ProfileService.removeAvatar();
      await data.refresh();
    } catch (e) {
      setPhotoError(errorMessage(e));
    } finally {
      setPhotoBusy(null);
    }
  };

  let details: ReactNode;
  if (data.status === 'loading') {
    details = (
      <View style={{ padding: theme.spacing.md, gap: theme.spacing.md }} accessibilityRole="progressbar" accessibilityLabel="Cargando">
        {[0, 1, 2, 3].map((i) => (
          <View key={i} style={styles.skeletonRow}>
            <Skeleton width={28} height={28} radius={14} />
            <View style={{ flex: 1, gap: 6 }}>
              <Skeleton width="35%" height={12} />
              <Skeleton width="60%" height={18} />
            </View>
          </View>
        ))}
      </View>
    );
  } else if (data.status === 'error' || !profile) {
    details = <ErrorState kind={data.error?.kind} message={data.error?.message} onRetry={() => void data.reload()} />;
  } else {
    const hasPhoto = !!profile.avatarUrl;
    details = (
      <View>
        <View style={[styles.photoBlock, { paddingHorizontal: theme.spacing.md, paddingTop: theme.spacing.lg, paddingBottom: theme.spacing.md }]} testID="account-photo">
          <Pressable
            onPress={() => setPhotoMenu((open) => !open)}
            disabled={!!photoBusy}
            accessibilityRole="button"
            accessibilityLabel={hasPhoto ? 'Tu foto de perfil. Toca para cambiarla' : 'Añadir una foto de perfil'}
            accessibilityState={{ expanded: photoMenu, busy: !!photoBusy }}
            hitSlop={8}
            testID="account-photo-edit"
            style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}
          >
            <View style={[styles.avatarRing, { borderColor: hasPhoto ? c.primarySoft : c.border }]}>
              <Avatar name={profile.displayName} uri={profile.avatarUrl} size={112} />
              {photoBusy ? (
                <View style={styles.avatarBusy}>
                  <ActivityIndicator color="#FFFFFF" size="large" />
                </View>
              ) : null}
            </View>
            <View style={[styles.cameraBadge, { backgroundColor: c.primary, borderColor: c.surface }]}>
              <Icon name="camera" size={20} color="#FFFFFF" />
            </View>
          </Pressable>
          <AppText variant="heading" color="heading" align="center" style={{ marginTop: theme.spacing.sm }}>
            {profile.displayName ?? 'Tu cuenta'}
          </AppText>
          <TextButton
            label={photoBusy ? 'Guardando la foto…' : hasPhoto ? 'Cambiar foto' : 'Añadir foto'}
            icon={hasPhoto ? 'camera-outline' : 'add-circle-outline'}
            onPress={() => setPhotoMenu((open) => !open)}
            disabled={!!photoBusy}
            testID="account-photo-toggle"
          />
          {photoMenu ? (
            <FadeIn style={styles.photoMenu}>
              <View style={[styles.photoMenuBox, { borderColor: c.border, borderRadius: theme.radius.md, backgroundColor: c.surface }]}>
                <SettingRow
                  icon="images-outline"
                  iconColor={c.primary}
                  label="Elegir de mis fotos"
                  onPress={() => void changePhoto('library')}
                  accessibilityHint="Abre la galería de fotos del teléfono"
                  testID="account-photo-pick"
                />
                <Divider inset={60} />
                <SettingRow
                  icon="camera-outline"
                  iconColor={c.primary}
                  label="Hacer una foto ahora"
                  onPress={() => void changePhoto('camera')}
                  accessibilityHint="Abre la cámara delantera"
                  testID="account-photo-camera"
                />
                {hasPhoto ? (
                  <>
                    <Divider inset={60} />
                    <SettingRow
                      icon="trash-outline"
                      label="Quitar la foto"
                      destructive
                      showChevron={false}
                      onPress={() => void removePhoto()}
                      testID="account-photo-remove"
                    />
                  </>
                ) : null}
              </View>
              <TextButton label="Cancelar" tone="muted" onPress={() => setPhotoMenu(false)} testID="account-photo-cancel" />
            </FadeIn>
          ) : null}
          {photoError ? <InfoBanner tone="danger" message={photoError} style={{ alignSelf: 'stretch' }} /> : null}
        </View>
        <Divider inset={0} />
        {editing ? (
          <View style={{ padding: theme.spacing.md, gap: theme.spacing.sm }}>
            <TextField
              label="Tu nombre"
              value={draft}
              onChangeText={(t) => {
                setDraft(t);
                if (nameError) setNameError(null);
              }}
              error={nameError}
              hint="Así te saludaremos en la app."
              autoFocus
              maxLength={NAME_MAX}
              autoCapitalize="words"
              autoComplete="name"
              textContentType="name"
              returnKeyType="done"
              onSubmitEditing={() => void saveName()}
            />
            <PrimaryButton label="Guardar" icon="checkmark" size="md" onPress={() => void saveName()} loading={savingName} />
            <TextButton label="Cancelar" tone="muted" onPress={cancelEdit} disabled={savingName} />
          </View>
        ) : (
          <InfoRow
            icon="person-outline"
            label="Nombre"
            value={profile.displayName ?? 'Sin nombre'}
            valueColor={profile.displayName ? 'heading' : 'textMuted'}
            right={<TextButton label="Editar" icon="create-outline" onPress={startEdit} testID="account-edit-name" />}
          />
        )}
        <Divider inset={60} />
        <InfoRow
          icon="call-outline"
          label="Teléfono"
          value={noPhone ? (entitlement.isPremium ? 'Pendiente de añadir' : 'No añadido · opcional') : formatPhoneForDisplay(phone)}
          valueColor={noPhone ? 'textMuted' : 'heading'}
        />
        <Divider inset={60} />
        <InfoRow
          icon="ribbon-outline"
          label="Plan"
          value={sub ? (sub.isPremium ? 'Premium' : 'Gratuito') : 'Consultar'}
          valueColor={sub?.isPremium ? 'successText' : 'heading'}
          onPress={() => router.push('/premium')}
          accessibilityHint={entitlement.canSell ? 'Abre MediClaro Premium' : 'Abre los detalles de tu plan'}
          testID="account-plan"
        />
        {profile.createdAt ? (
          <>
            <Divider inset={60} />
            <InfoRow icon="calendar-outline" label="Miembro desde" value={formatDateLong(profile.createdAt)} />
          </>
        ) : null}
        {usage?.unlimited ? (
          <>
            <Divider inset={60} />
            <InfoRow icon="scan-outline" label="Identificaciones" value="Ilimitadas" testID="account-usage-unlimited">
              <AppText variant="caption" color="textSecondary" style={{ marginTop: 4 }}>
                Mientras dure tu suscripción Premium.
              </AppText>
            </InfoRow>
          </>
        ) : usage ? (
          <>
            <Divider inset={60} />
            <InfoRow icon="scan-outline" label="Identificaciones este mes" value={`${usage.scansUsed} de ${usage.scansIncluded}`}>
              <UsageBar used={usage.scansUsed} total={usage.scansIncluded} />
              <AppText variant="caption" color="textSecondary" style={{ marginTop: 4 }}>
                {sub?.isPremium
                  ? usage.scansLeft === 1
                    ? 'Te queda 1 incluida este mes.'
                    : `Te quedan ${usage.scansLeft} incluidas este mes.`
                  : usage.scansLeft === 1
                    ? 'Te queda 1 este mes.'
                    : `Te quedan ${usage.scansLeft} este mes.`}
              </AppText>
            </InfoRow>
          </>
        ) : null}
      </View>
    );
  }

  return (
    <Screen header={<AppHeader title="Datos de cuenta" />} keyboard>
      <View
        style={[
          styles.card,
          { borderColor: c.border, borderRadius: theme.radius.lg, backgroundColor: c.surface, marginTop: theme.spacing.xs },
          theme.shadow.card,
        ]}
      >
        {details}
      </View>

      <View style={{ marginTop: theme.spacing.lg }}>
        <SectionHeader title="Tus datos" />
        <ListGroup>
          <SettingRow
            icon="download-outline"
            label="Descargar mis datos"
            description="Recibe una copia de tus datos en un archivo."
            onPress={() => void downloadMyData()}
            right={exporting ? <ActivityIndicator color={c.primary} /> : undefined}
            showChevron={!exporting}
            testID="account-export"
          />
          <SettingRow
            icon="log-out-outline"
            label="Cerrar sesión"
            onPress={() => void confirmSignOut()}
            right={signingOut ? <ActivityIndicator color={c.primary} /> : undefined}
            showChevron={false}
            testID="account-sign-out"
          />
        </ListGroup>
      </View>

      <View style={{ marginTop: theme.spacing.lg }}>
        <ListGroup>
          <SettingRow
            icon="trash-outline"
            label="Eliminar mi cuenta"
            description="Se borrarán tus datos y se cancelará tu suscripción."
            destructive
            onPress={() => void deleteMyAccount()}
            right={deleting ? <ActivityIndicator color={c.danger} /> : undefined}
            showChevron={false}
            testID="account-delete"
          />
        </ListGroup>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, overflow: 'hidden' },
  skeletonRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  photoBlock: { alignItems: 'center', gap: 2 },
  avatarRing: { borderWidth: 3, borderRadius: 62, padding: 3 },
  avatarBusy: {
    position: 'absolute',
    top: 3,
    left: 3,
    width: 112,
    height: 112,
    borderRadius: 56,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cameraBadge: {
    position: 'absolute',
    right: 0,
    bottom: 2,
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoMenu: { alignSelf: 'stretch', marginTop: 4, gap: 4 },
  photoMenuBox: { borderWidth: 1, overflow: 'hidden' },
});
