/**
 * /account — Datos de cuenta.
 * Nombre (editable), teléfono, plan, fecha de alta y uso del mes.
 * Acciones: descargar mis datos, cerrar sesión y eliminar la cuenta (doble confirmación).
 */
import { useState, type ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import {
  AppHeader,
  AppText,
  Divider,
  ErrorState,
  ListGroup,
  PrimaryButton,
  Screen,
  SectionHeader,
  SettingRow,
  Skeleton,
  TextButton,
  TextField,
} from '../../components';
import { useAppTheme, useAsync, useEntitlement, useRefreshOnFocus, useSession } from '../../hooks';
import { ProfileService, SubscriptionService } from '../../services';
import { formatDateLong, formatPhoneForDisplay } from '../../utils/format';
import { errorMessage } from '../premium/parts';
import { useAccountActions } from './accountActions';
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

  const profile = data.data?.profile ?? null;
  const sub = data.data?.subscription ?? null;
  // El uso solo llega cuando el servidor aplica el mismo plan que se ve (ver SubscriptionService).
  const usage = sub?.usage ?? null;
  const phone = profile?.phone ?? null;
  const noPhone = session?.mode === 'anonymous' || !phone;

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
    details = (
      <View>
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
          value={noPhone ? 'Sin teléfono (acceso de prueba)' : formatPhoneForDisplay(phone)}
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
        {usage ? (
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
});
