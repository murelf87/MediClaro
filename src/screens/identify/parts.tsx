/**
 * Piezas visuales LOCALES del área "Identificar" (cámara, procesando, resultado, ficha y lectura).
 * Solo usan componentes compartidos y tokens del tema.
 */
import { useCallback, useRef, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import Svg, { Defs, G, LinearGradient, Path, Rect, Stop } from 'react-native-svg';
import {
  AppText,
  Card,
  ErrorState,
  Icon,
  IconButton,
  MedicationImage,
  PrimaryButton,
  Skeleton,
  type IconName,
} from '../../components';
import { useAppTheme, useSession } from '../../hooks';
import type { AppError } from '../../services';
import type { SavedMedicationState } from './useSavedMedication';

// ─── Navegación segura ────────────────────────────────────────────────────────

/** Vuelve atrás; si no hay pantalla anterior, al Inicio. */
export function useGoBack() {
  const router = useRouter();
  return () => {
    if (router.canGoBack()) router.back();
    else router.replace('/(tabs)');
  };
}

/**
 * Evita abrir dos veces la misma pantalla con un doble toque.
 * Se libera al volver a la pantalla (o al poco, si la navegación no llega a ocurrir).
 */
export function useNavLock() {
  const locked = useRef(false);
  useFocusEffect(
    useCallback(() => {
      locked.current = false;
    }, []),
  );
  return useCallback((action: () => void) => {
    if (locked.current) return;
    locked.current = true;
    action();
    setTimeout(() => {
      locked.current = false;
    }, 900);
  }, []);
}

// ─── Corazón de favorito (cabecera) ───────────────────────────────────────────

export function FavoriteButton({ state }: { state: SavedMedicationState }) {
  const theme = useAppTheme();
  const on = state.saved && state.favorite;
  return (
    <IconButton
      icon={on ? 'heart' : 'heart-outline'}
      color={on ? theme.colors.primary : theme.colors.heading}
      size={30}
      onPress={() => void state.toggleFavorite()}
      disabled={!state.known}
      selected={on}
      accessibilityLabel={on ? 'Quitar de favoritos' : 'Marcar como favorito'}
      testID="favorite-toggle"
    />
  );
}

// ─── Círculo de icono ─────────────────────────────────────────────────────────

export type CircleTone = 'success' | 'primary' | 'warning' | 'danger' | 'neutral';

function useToneFill(tone: CircleTone): { bg: string; fg: string } {
  const c = useAppTheme().colors;
  return {
    success: { bg: c.successStrong, fg: c.onPrimary },
    primary: { bg: c.primary, fg: c.onPrimary },
    warning: { bg: c.warning, fg: c.onPrimary },
    danger: { bg: c.danger, fg: c.onPrimary },
    neutral: { bg: c.surfaceMuted, fg: c.textSecondary },
  }[tone];
}

export function IconCircle({ icon, tone, size = 44 }: { icon: IconName; tone: CircleTone; size?: number }) {
  const fill = useToneFill(tone);
  return (
    <View style={[styles.circle, { width: size, height: size, borderRadius: size / 2, backgroundColor: fill.bg }]}>
      <Icon name={icon} size={Math.round(size * 0.52)} color={fill.fg} />
    </View>
  );
}

// ─── Tarjeta de sección (ficha) ───────────────────────────────────────────────

export function SectionCard({
  icon,
  tone,
  title,
  tinted = false,
  solid = false,
  children,
}: {
  icon: IconName;
  tone: CircleTone;
  title: string;
  /** Tarjeta tintada en rojo suave (advertencias). */
  tinted?: boolean;
  /** El icono ya es un círculo relleno (p. ej. "information-circle"): se pinta tal cual. */
  solid?: boolean;
  children: ReactNode;
}) {
  const theme = useAppTheme();
  const fill = useToneFill(tone);
  return (
    <Card tone={tinted ? 'danger' : 'default'} elevated={!tinted} padding={theme.spacing.md}>
      <View style={[styles.sectionHead, { marginBottom: theme.spacing.sm }]}>
        {solid ? (
          <View style={styles.solidIcon}>
            <Icon name={icon} size={52} color={fill.bg} />
          </View>
        ) : (
          <IconCircle icon={icon} tone={tone} size={44} />
        )}
        <AppText variant="heading" color={tinted ? 'dangerText' : 'heading'} style={styles.flex} accessibilityRole="header">
          {title}
        </AppText>
      </View>
      {children}
    </Card>
  );
}

/** Lista con viñetas de color (advertencias). */
export function BulletList({ items, tone = 'danger' }: { items: string[]; tone?: CircleTone }) {
  const theme = useAppTheme();
  const fill = useToneFill(tone);
  const lineHeight = Number(theme.typography.body.lineHeight ?? 24);
  return (
    <View style={{ gap: theme.spacing.xs }}>
      {items.map((item, i) => (
        <View key={`${i}-${item.slice(0, 12)}`} style={styles.bulletRow}>
          <View style={[styles.bulletDot, { backgroundColor: fill.bg, marginTop: (lineHeight - 8) / 2 }]} />
          <AppText variant="body" style={styles.flex}>
            {item}
          </AppText>
        </View>
      ))}
    </View>
  );
}

// ─── Opciones grandes (añadir medicamento) ────────────────────────────────────

export type OptionTone = 'primary' | 'success' | 'neutral';

export function OptionCard({
  icon,
  title,
  subtitle,
  tone,
  onPress,
  expanded,
  testID,
}: {
  icon: IconName;
  title: string;
  subtitle: string;
  tone: OptionTone;
  onPress: () => void;
  /** Si se indica, la tarjeta despliega contenido (flecha arriba/abajo). */
  expanded?: boolean;
  testID?: string;
}) {
  const theme = useAppTheme();
  const c = theme.colors;
  const palette = {
    primary: { bg: c.primaryTint, tile: c.primary, chevron: c.primary },
    success: { bg: c.successSoft, tile: c.successStrong, chevron: c.successStrong },
    neutral: { bg: c.surfaceAlt, tile: c.heading, chevron: c.heading },
  }[tone];
  const isToggle = expanded !== undefined;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${subtitle}`}
      accessibilityState={isToggle ? { expanded } : undefined}
      testID={testID}
      style={({ pressed }) => [
        styles.option,
        {
          minHeight: theme.actionHeight + 16,
          borderRadius: theme.radius.lg,
          backgroundColor: palette.bg,
          opacity: pressed ? 0.88 : 1,
          transform: [{ scale: pressed ? 0.99 : 1 }],
        },
      ]}
    >
      <View style={[styles.optionTile, { backgroundColor: palette.tile, borderRadius: theme.radius.sm }]}>
        <Icon name={icon} size={28} color={c.onPrimary} />
      </View>
      <View style={styles.optionText}>
        <AppText variant="bodyStrong" color="heading">
          {title}
        </AppText>
        <AppText variant="caption" color="textSecondary">
          {subtitle}
        </AppText>
      </View>
      <Icon name={isToggle ? (expanded ? 'chevron-up' : 'chevron-down') : 'chevron-forward'} size={24} color={palette.chevron} />
    </Pressable>
  );
}

// ─── Baldosas de acción (resultado) ───────────────────────────────────────────

export function ActionTile({
  icon,
  iconColor,
  label,
  onPress,
  active = false,
  disabled = false,
  accessibilityLabel,
  accessibilityHint,
  testID,
}: {
  icon: IconName;
  iconColor: string;
  label: string;
  onPress: () => void;
  /** Estado activo (p. ej. "Guardado"): fondo ámbar suave. */
  active?: boolean;
  disabled?: boolean;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  testID?: string;
}) {
  const theme = useAppTheme();
  const c = theme.colors;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled, selected: active }}
      testID={testID}
      style={({ pressed }) => [
        styles.tile,
        {
          minHeight: 104,
          borderRadius: theme.radius.lg,
          backgroundColor: active ? c.warningSoft : pressed ? c.surfaceMuted : c.surfaceAlt,
          borderColor: active ? c.favorite : 'transparent',
          opacity: disabled ? 0.55 : 1,
          transform: [{ scale: pressed ? 0.98 : 1 }],
        },
      ]}
    >
      <Icon name={icon} size={30} color={iconColor} />
      <AppText variant="captionStrong" color="heading" align="center">
        {label}
      </AppText>
    </Pressable>
  );
}

// ─── Imagen grande del envase ─────────────────────────────────────────────────

/** Mide el ancho disponible para que el envase ilustrado (o la foto oficial) se vea grande. */
export function HeroMedicationImage({
  uri,
  loadUri,
  height = 180,
  accessibilityLabel,
}: {
  uri: string | null;
  loadUri?: () => Promise<string | null>;
  height?: number;
  accessibilityLabel?: string;
}) {
  const theme = useAppTheme();
  const [width, setWidth] = useState<number | null>(null);
  return (
    <View
      style={styles.full}
      onLayout={(e) => {
        const w = Math.round(e.nativeEvent.layout.width);
        if (w > 0) setWidth((prev) => (prev === w ? prev : w));
      }}
    >
      <MedicationImage
        uri={uri}
        loadUri={loadUri}
        width={width ?? '100%'}
        height={height}
        radius={theme.radius.lg}
        accessibilityLabel={accessibilityLabel}
      />
    </View>
  );
}

// ─── Estados a pantalla completa ──────────────────────────────────────────────

export type StateTone = 'primary' | 'warning' | 'danger' | 'neutral' | 'success';

/** Icono grande + título + mensaje + acciones (no encontrado, límite, sesión caducada…). */
export function StateBlock({
  icon,
  tone,
  title,
  message,
  children,
  style,
}: {
  icon: IconName;
  tone: StateTone;
  title: string;
  message?: string;
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const theme = useAppTheme();
  const c = theme.colors;
  const palette = {
    primary: { bg: c.primaryTint, fg: c.primary },
    warning: { bg: c.warningSoft, fg: c.warning },
    danger: { bg: c.dangerSoft, fg: c.danger },
    neutral: { bg: c.surfaceMuted, fg: c.textSecondary },
    success: { bg: c.successSoft, fg: c.successStrong },
  }[tone];
  return (
    <View style={[styles.stateBlock, { gap: theme.spacing.sm }, style]}>
      <View style={[styles.stateIcon, { backgroundColor: palette.bg }]}>
        <Icon name={icon} size={44} color={palette.fg} />
      </View>
      <AppText variant="title" align="center" accessibilityRole="header" style={{ marginTop: theme.spacing.xs }}>
        {title}
      </AppText>
      {message ? (
        <AppText variant="body" color="textSecondary" align="center">
          {message}
        </AppText>
      ) : null}
      {children ? <View style={[styles.stateActions, { gap: theme.spacing.sm, marginTop: theme.spacing.md }]}>{children}</View> : null}
    </View>
  );
}

/** Sesión caducada: cierra la sesión local y vuelve a la bienvenida para entrar de nuevo. */
export function SessionExpiredState({ message }: { message?: string }) {
  const router = useRouter();
  const { signOut } = useSession();
  const [leaving, setLeaving] = useState(false);
  const reenter = async () => {
    setLeaving(true);
    try {
      await signOut();
    } catch {
      // La sesión local se cierra igualmente.
    }
    router.replace('/welcome');
  };
  return (
    <StateBlock
      icon="lock-closed-outline"
      tone="primary"
      title="Tu sesión ha caducado"
      message={message ?? 'Vuelve a entrar con tu teléfono para seguir.'}
    >
      <PrimaryButton label="Volver a entrar" icon="log-in-outline" onPress={reenter} loading={leaving} />
    </StateBlock>
  );
}

/** Error de carga con la acción adecuada a cada tipo. */
export function ScreenError({
  error,
  onRetry,
  notFoundTitle,
  notFoundMessage,
}: {
  error: AppError;
  onRetry: () => void;
  notFoundTitle?: string;
  notFoundMessage?: string;
}) {
  const goBack = useGoBack();
  if (error.kind === 'unauthorized') return <SessionExpiredState message={error.message} />;
  if (error.kind === 'not_found' || error.kind === 'invalid_input') {
    return (
      <ErrorState
        kind="not_found"
        title={notFoundTitle}
        message={notFoundMessage ?? error.message}
        secondaryAction={{ label: 'Volver', onPress: goBack }}
      />
    );
  }
  const canRetry = error.kind !== 'not_configured' && error.kind !== 'not_available';
  return (
    <ErrorState
      kind={error.kind}
      message={error.message}
      onRetry={canRetry ? onRetry : undefined}
      secondaryAction={{ label: 'Volver', onPress: goBack }}
    />
  );
}

// ─── Esqueletos ───────────────────────────────────────────────────────────────

export function DetailSkeleton() {
  const theme = useAppTheme();
  return (
    <View style={{ gap: theme.spacing.md }} accessibilityRole="progressbar" accessibilityLabel="Cargando la ficha del medicamento">
      <Skeleton width="85%" height={32} />
      <Skeleton width="55%" height={20} />
      {[0, 1, 2].map((i) => (
        <View key={i} style={[styles.skeletonCard, { borderColor: theme.colors.border, borderRadius: theme.radius.lg }]}>
          <Skeleton width={44} height={44} radius={22} />
          <View style={[styles.flex, { gap: 10 }]}>
            <Skeleton width="50%" height={22} />
            <Skeleton height={16} />
            <Skeleton width="80%" height={16} />
          </View>
        </View>
      ))}
    </View>
  );
}

// ─── Ilustración: cápsula (pantalla "Procesando") ─────────────────────────────

/** Cápsula azul de dos tonos girada, con brillo (decorativa). */
export function CapsuleArt({ size = 96 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Defs>
        <LinearGradient id="mcIdCapTop" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#6BB2FA" />
          <Stop offset="1" stopColor="#3B8CF2" />
        </LinearGradient>
        <LinearGradient id="mcIdCapBottom" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#2A80F4" />
          <Stop offset="1" stopColor="#1459C9" />
        </LinearGradient>
      </Defs>
      <G transform="rotate(45 50 50)">
        <Path d="M32 50 L32 27 A18 18 0 0 1 68 27 L68 50 Z" fill="url(#mcIdCapTop)" />
        <Path d="M32 50 L68 50 L68 73 A18 18 0 0 1 32 73 Z" fill="url(#mcIdCapBottom)" />
        <Rect x="32" y="48.2" width="36" height="3.6" fill="#FFFFFF" opacity={0.95} />
        <Path d="M41 22 L41 41" stroke="#FFFFFF" strokeWidth={4.5} strokeLinecap="round" opacity={0.55} />
        <Path d="M41 58 L41 66" stroke="#FFFFFF" strokeWidth={4.5} strokeLinecap="round" opacity={0.3} />
      </G>
    </Svg>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  full: { width: '100%' },
  circle: { alignItems: 'center', justifyContent: 'center' },
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  solidIcon: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  bulletRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  bulletDot: { width: 8, height: 8, borderRadius: 4 },
  option: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 16, paddingVertical: 14 },
  optionTile: { width: 52, height: 52, alignItems: 'center', justifyContent: 'center' },
  optionText: { flex: 1, gap: 2 },
  tile: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 6, paddingVertical: 12, borderWidth: 1.5 },
  stateBlock: { alignItems: 'center', paddingVertical: 12 },
  stateIcon: { width: 88, height: 88, borderRadius: 44, alignItems: 'center', justifyContent: 'center' },
  stateActions: { alignSelf: 'stretch' },
  skeletonCard: { flexDirection: 'row', gap: 14, padding: 16, borderWidth: 1 },
});
