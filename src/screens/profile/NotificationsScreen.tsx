/**
 * /notifications — Preferencias de avisos.
 * El backend todavía no envía notificaciones: se guardan las preferencias (en este teléfono,
 * por cuenta) y la pantalla lo dice con claridad. Cambios optimistas y en orden.
 */
import { useRef, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { AppHeader, EmptyState, ErrorState, InfoBanner, ListGroup, Screen, SettingRow, Skeleton } from '../../components';
import { useAppTheme, useAsync } from '../../hooks';
import { NotificationService } from '../../services';
import { showAlert } from '../../utils/dialogs';
import type { NotificationPreference, NotificationPreferenceKey } from '../../types';

export default function NotificationsScreen() {
  const theme = useAppTheme();
  const prefs = useAsync(() => NotificationService.getPreferences(), [], { isEmpty: (list) => list.length === 0 });
  // Los cambios se guardan uno detrás de otro para que no se pisen entre sí.
  const queue = useRef<Promise<unknown>>(Promise.resolve());

  const setEnabled = (key: NotificationPreferenceKey, enabled: boolean) => {
    const apply = (value: boolean) =>
      prefs.setData((prev: NotificationPreference[] | null) => (prev ?? []).map((p) => (p.key === key ? { ...p, enabled: value } : p)));
    apply(enabled);
    queue.current = queue.current
      .then(() => NotificationService.updatePreferences({ [key]: enabled }))
      .catch(async () => {
        apply(!enabled);
        await showAlert('No hemos podido guardar el cambio', 'Inténtalo de nuevo en un momento.');
      });
  };

  let content: ReactNode;
  if (prefs.status === 'loading') {
    content = (
      <View
        style={[styles.skeleton, { borderColor: theme.colors.border, borderRadius: theme.radius.lg, gap: theme.spacing.lg }]}
        accessibilityRole="progressbar"
        accessibilityLabel="Cargando"
      >
        {[0, 1, 2].map((i) => (
          <View key={i} style={styles.skeletonRow}>
            <View style={{ flex: 1, gap: 8 }}>
              <Skeleton width="60%" height={18} />
              <Skeleton width="85%" height={13} />
            </View>
            <Skeleton width={50} height={30} radius={15} />
          </View>
        ))}
      </View>
    );
  } else if (prefs.status === 'error') {
    content = <ErrorState kind={prefs.error?.kind} message={prefs.error?.message} onRetry={() => void prefs.reload()} />;
  } else if (prefs.status === 'empty' || !prefs.data) {
    content = (
      <EmptyState
        icon="notifications-off-outline"
        title="No hay avisos que configurar"
        message="Cuando haya avisos disponibles, podrás elegirlos aquí."
      />
    );
  } else {
    content = (
      <ListGroup>
        {prefs.data.map((p) => (
          <SettingRow
            key={p.key}
            label={p.label}
            description={p.description}
            toggle={{ value: p.enabled, onChange: (v) => setEnabled(p.key, v) }}
            testID={`notification-${p.key}`}
          />
        ))}
      </ListGroup>
    );
  }

  return (
    <Screen header={<AppHeader title="Notificaciones" />}>
      <View style={{ gap: theme.spacing.md, marginTop: theme.spacing.xs }}>
        {!NotificationService.isDeliveryAvailable() ? (
          <InfoBanner
            tone="info"
            icon="notifications-outline"
            message="Todavía no enviamos notificaciones. Guardamos tus preferencias para cuando las activemos."
          />
        ) : null}
        {content}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  skeleton: { borderWidth: 1, padding: 16 },
  skeletonRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
});
