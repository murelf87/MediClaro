/**
 * Estados de pantalla: carga, error (con reintento), vacío y esqueletos.
 * Ninguna pantalla debe quedar en blanco.
 */
import { useEffect, useRef, type ReactNode } from 'react';
import { ActivityIndicator, Animated, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { AppText } from './AppText';
import { Icon, type IconName } from './Icon';
import { PrimaryButton, SecondaryButton } from './Buttons';
import { useAppTheme } from '../providers/PreferencesProvider';
import type { AppErrorKind } from '../types';

export function LoadingState({ message = 'Cargando…', style }: { message?: string; style?: StyleProp<ViewStyle> }) {
  const theme = useAppTheme();
  return (
    <View style={[styles.center, style]} accessibilityRole="progressbar" accessibilityLabel={message}>
      <ActivityIndicator size="large" color={theme.colors.primary} />
      <AppText variant="body" color="textSecondary" align="center" style={{ marginTop: theme.spacing.md }}>
        {message}
      </AppText>
    </View>
  );
}

const ERROR_ICONS: Partial<Record<AppErrorKind, IconName>> = {
  offline: 'cloud-offline-outline',
  timeout: 'time-outline',
  unauthorized: 'lock-closed-outline',
  limit_reached: 'hourglass-outline',
  provider_down: 'construct-outline',
  permission_denied: 'hand-left-outline',
  not_found: 'search-outline',
  not_configured: 'settings-outline',
};

const ERROR_TITLES: Partial<Record<AppErrorKind, string>> = {
  offline: 'Sin conexión',
  timeout: 'Está tardando demasiado',
  unauthorized: 'Tu sesión ha caducado',
  limit_reached: 'Has llegado al límite',
  provider_down: 'Servicio no disponible',
  permission_denied: 'Falta un permiso',
  not_found: 'No lo hemos encontrado',
  not_configured: 'Función no disponible todavía',
  rate_limited: 'Demasiados intentos',
};

export function ErrorState({
  kind = 'unknown',
  title,
  message,
  onRetry,
  retryLabel = 'Reintentar',
  secondaryAction,
  style,
}: {
  kind?: AppErrorKind;
  title?: string;
  message?: string;
  onRetry?: () => void;
  retryLabel?: string;
  secondaryAction?: { label: string; onPress: () => void };
  style?: StyleProp<ViewStyle>;
}) {
  const theme = useAppTheme();
  return (
    <View style={[styles.center, style]} accessibilityRole="alert">
      <View style={[styles.iconCircle, { backgroundColor: kind === 'offline' ? theme.colors.surfaceMuted : theme.colors.dangerSoft }]}>
        <Icon name={ERROR_ICONS[kind] ?? 'alert-circle-outline'} size={36} color={kind === 'offline' ? 'textSecondary' : 'danger'} />
      </View>
      <AppText variant="heading" align="center" style={{ marginTop: theme.spacing.md }}>
        {title ?? ERROR_TITLES[kind] ?? 'Algo no ha ido bien'}
      </AppText>
      {message ? (
        <AppText variant="body" color="textSecondary" align="center" style={{ marginTop: theme.spacing.xs }}>
          {message}
        </AppText>
      ) : null}
      <View style={[styles.actions, { marginTop: theme.spacing.lg }]}>
        {onRetry ? <PrimaryButton label={retryLabel} onPress={onRetry} icon="refresh" size="md" /> : null}
        {secondaryAction ? <SecondaryButton label={secondaryAction.label} onPress={secondaryAction.onPress} variant="neutral" /> : null}
      </View>
    </View>
  );
}

export function EmptyState({
  icon = 'file-tray-outline',
  illustration,
  title,
  message,
  action,
  secondaryAction,
  style,
}: {
  icon?: IconName;
  illustration?: ReactNode;
  title: string;
  message?: string;
  action?: { label: string; onPress: () => void; icon?: IconName };
  secondaryAction?: { label: string; onPress: () => void };
  style?: StyleProp<ViewStyle>;
}) {
  const theme = useAppTheme();
  return (
    <View style={[styles.center, style]}>
      {illustration ?? (
        <View style={[styles.iconCircle, { backgroundColor: theme.colors.primaryTint }]}>
          <Icon name={icon} size={36} color="primary" />
        </View>
      )}
      <AppText variant="heading" align="center" style={{ marginTop: theme.spacing.md }}>
        {title}
      </AppText>
      {message ? (
        <AppText variant="body" color="textSecondary" align="center" style={{ marginTop: theme.spacing.xs }}>
          {message}
        </AppText>
      ) : null}
      {action || secondaryAction ? (
        <View style={[styles.actions, { marginTop: theme.spacing.lg }]}>
          {action ? <PrimaryButton label={action.label} onPress={action.onPress} icon={action.icon} size="md" /> : null}
          {secondaryAction ? <SecondaryButton label={secondaryAction.label} onPress={secondaryAction.onPress} /> : null}
        </View>
      ) : null}
    </View>
  );
}

/** Bloque gris animado mientras carga el contenido real. */
export function Skeleton({ width = '100%', height = 16, radius = 8, style }: {
  width?: number | `${number}%`;
  height?: number;
  radius?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const theme = useAppTheme();
  const opacity = useRef(new Animated.Value(0.55)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.55, duration: 700, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);
  return (
    <Animated.View
      style={[{ width, height, borderRadius: radius, backgroundColor: theme.colors.skeleton, opacity }, style]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    />
  );
}

/** Lista de filas esqueleto (medicamentos, historial...). */
export function SkeletonList({ rows = 4 }: { rows?: number }) {
  const theme = useAppTheme();
  return (
    <View style={{ gap: theme.spacing.sm }} accessibilityLabel="Cargando" accessibilityRole="progressbar">
      {Array.from({ length: rows }).map((_, i) => (
        <View key={i} style={[styles.skeletonRow, { borderColor: theme.colors.border, borderRadius: theme.radius.lg }]}>
          <Skeleton width={56} height={56} radius={12} />
          <View style={{ flex: 1, gap: 8 }}>
            <Skeleton width="70%" height={18} />
            <Skeleton width="45%" height={14} />
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 40, paddingHorizontal: 8 },
  iconCircle: { width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center' },
  actions: { width: '100%', maxWidth: 380, gap: 10 },
  skeletonRow: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 14, borderWidth: 1 },
});
