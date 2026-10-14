/**
 * 12 (emergencia) · Qué compartir en una emergencia (referencias: e12_sharing + e13_important).
 * Cada interruptor se guarda al momento (optimista; si falla, vuelve atrás y avisa).
 */
import { useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { AppHeader, AppText, Card, ErrorState, Icon, InfoBanner, Screen, SettingRow, Skeleton, type IconName } from '../../components';
import { useAppTheme, useAsync, useRefreshOnFocus } from '../../hooks';
import { EmergencyService } from '../../services';
import type { EmergencySharingPermissions } from '../../types';
import { ScreenTitle, asAppError } from './parts';

type PermissionKey = keyof EmergencySharingPermissions;

const TOGGLES: { key: PermissionKey; label: string; icon: IconName }[] = [
  { key: 'shareLocation', label: 'Compartir ubicación', icon: 'location-outline' },
  { key: 'shareAddress', label: 'Compartir dirección y datos personales', icon: 'id-card-outline' },
  { key: 'shareMedications', label: 'Compartir medicamentos', icon: 'medkit-outline' },
  { key: 'shareAllergies', label: 'Compartir alergias', icon: 'alert-circle-outline' },
  { key: 'shareMedicalInfo', label: 'Compartir enfermedades y datos médicos', icon: 'fitness-outline' },
  { key: 'shareConversation', label: 'Compartir conversación previa con el asistente', icon: 'chatbubble-ellipses-outline' },
  { key: 'notifyContact', label: 'Avisar a mi contacto de emergencia', icon: 'people-outline' },
];

type SaveState =
  | { kind: 'idle' }
  | { kind: 'saving' }
  | { kind: 'saved' }
  | { kind: 'local' }
  | { kind: 'error'; message: string };

export default function EmergencySharingScreen() {
  const theme = useAppTheme();
  const c = theme.colors;
  const perms = useAsync(() => EmergencyService.getSharingPermissions(), []);
  useRefreshOnFocus(perms.refresh);

  const [saveState, setSaveState] = useState<SaveState>({ kind: 'idle' });
  const latest = useRef<EmergencySharingPermissions | null>(null);
  const queue = useRef<Promise<void>>(Promise.resolve());
  const pending = useRef(0);
  if (perms.data && pending.current === 0) latest.current = perms.data;

  const toggle = (key: PermissionKey, value: boolean) => {
    const current = latest.current;
    if (!current || current[key] === value) return;
    const next = { ...current, [key]: value };
    latest.current = next;
    perms.setData(next);
    setSaveState({ kind: 'saving' });
    pending.current += 1;
    // Guardados en orden: cada uno envía el estado más reciente.
    queue.current = queue.current.then(async () => {
      try {
        const res = await EmergencyService.updateSharingPermissions(latest.current ?? next);
        setSaveState(res.synced ? { kind: 'saved' } : { kind: 'local' });
      } catch (e) {
        // Deshacemos solo este cambio y avisamos
        if (latest.current && latest.current[key] === value) {
          const reverted = { ...latest.current, [key]: !value };
          latest.current = reverted;
          perms.setData(reverted);
        }
        setSaveState({ kind: 'error', message: asAppError(e).message });
      } finally {
        pending.current -= 1;
      }
    });
  };

  const renderList = () => {
    const data = perms.data;
    if (!data) return null;
    return (
      <View style={{ gap: theme.spacing.xs }}>
        {TOGGLES.map((t) => (
          <View key={t.key} style={[styles.toggleRow, { backgroundColor: c.primaryTint, borderRadius: theme.radius.md }]}>
            <SettingRow
              icon={t.icon}
              iconColor={c.heading}
              label={t.label}
              toggle={{ value: data[t.key], onChange: (v) => toggle(t.key, v) }}
              testID={`sharing-${t.key}`}
            />
          </View>
        ))}
      </View>
    );
  };

  return (
    <Screen header={<AppHeader fallbackHref="/emergency-profile" />}>
      <ScreenTitle>Qué compartir en una emergencia</ScreenTitle>
      <AppText variant="body" color="textSecondary" style={{ marginTop: theme.spacing.xs, marginBottom: theme.spacing.md }}>
        Elige qué información se incluirá en el mensaje preparado para el 112, tu servicio de asistencia y tu contacto de emergencia.
      </AppText>

      {perms.status === 'loading' ? (
        <View style={{ gap: theme.spacing.xs }} accessibilityRole="progressbar" accessibilityLabel="Cargando">
          {TOGGLES.map((t) => (
            <View key={t.key} style={[styles.skeletonRow, { backgroundColor: c.primaryTint, borderRadius: theme.radius.md }]}>
              <Skeleton width={24} height={24} radius={12} />
              <Skeleton width="60%" height={16} />
            </View>
          ))}
        </View>
      ) : null}

      {perms.status === 'error' ? (
        <ErrorState kind={perms.error?.kind} message={perms.error?.message} onRetry={() => void perms.reload()} />
      ) : null}

      {perms.status === 'success' ? renderList() : null}

      {saveState.kind === 'error' ? (
        <InfoBanner
          tone="danger"
          title="No hemos podido guardar el cambio"
          message={`${saveState.message} Hemos dejado la opción como estaba.`}
          style={{ marginTop: theme.spacing.md }}
        />
      ) : null}
      {saveState.kind === 'saved' || saveState.kind === 'local' || saveState.kind === 'saving' ? (
        <View style={[styles.status, { marginTop: theme.spacing.sm }]} accessibilityLiveRegion="polite">
          <Icon
            name={saveState.kind === 'local' ? 'phone-portrait-outline' : saveState.kind === 'saving' ? 'sync-outline' : 'checkmark-circle'}
            size={18}
            color={saveState.kind === 'saved' ? c.successStrong : c.textMuted}
          />
          <AppText variant="caption" color={saveState.kind === 'saved' ? 'successText' : 'textMuted'}>
            {saveState.kind === 'saving'
              ? 'Guardando…'
              : saveState.kind === 'local'
                ? 'Guardado en este teléfono'
                : 'Cambios guardados'}
          </AppText>
        </View>
      ) : null}

      <Card tone="primary" style={{ marginTop: theme.spacing.lg }} padding={theme.spacing.lg}>
        <View style={styles.noteRow}>
          <Icon name="shield-checkmark" size={36} color={c.primary} />
          <AppText variant="body" color="heading" style={styles.flex}>
            Tus datos viajan cifrados y solo se usan si activas una emergencia. Puedes cambiar estos permisos cuando quieras.
          </AppText>
        </View>
      </Card>

      <Card tone="danger" style={{ marginTop: theme.spacing.md }} padding={theme.spacing.lg}>
        <View style={styles.importantHeader} accessibilityRole="header">
          <Icon name="shield-checkmark" size={40} color={c.danger} />
          <AppText variant="heading" color="dangerText">
            Importante
          </AppText>
        </View>
        <View style={{ gap: theme.spacing.sm, marginTop: theme.spacing.sm }}>
          <AppText variant="body" color="text">
            Esta función está diseñada para facilitar la comunicación con el 112.
          </AppText>
          <AppText variant="body" color="text">
            La decisión sobre el envío de una ambulancia u otro recurso la toma siempre el servicio de emergencias.
          </AppText>
          <AppText variant="body" color="text">
            MediClaro no sustituye la atención médica profesional.
          </AppText>
        </View>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  toggleRow: { overflow: 'hidden' },
  skeletonRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 16, minHeight: 60 },
  status: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  noteRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  importantHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
});
