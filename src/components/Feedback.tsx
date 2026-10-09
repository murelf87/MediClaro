/**
 * Elementos informativos: avisos, insignias, listas con check, avatar, chips.
 */
import { type ReactNode } from 'react';
import { Image, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { AppText } from './AppText';
import { Icon, type IconName } from './Icon';
import { useAppTheme } from '../providers/PreferencesProvider';
import { initials as getInitials } from '../utils/format';

export type NoticeTone = 'info' | 'success' | 'warning' | 'danger' | 'ai' | 'neutral';

function useToneColors(tone: NoticeTone) {
  const c = useAppTheme().colors;
  return {
    info: { bg: c.primaryTint, fg: c.primary, text: c.text, border: c.primarySoft },
    success: { bg: c.successSoft, fg: c.successStrong, text: c.successText, border: '#A7F3D0' },
    warning: { bg: c.warningSoft, fg: c.warning, text: c.warningText, border: '#FBE3B8' },
    danger: { bg: c.dangerSoft, fg: c.danger, text: c.dangerText, border: '#F9D3D1' },
    ai: { bg: c.aiSoft, fg: c.ai, text: c.aiText, border: c.aiSoft },
    neutral: { bg: c.surfaceAlt, fg: c.textSecondary, text: c.text, border: c.border },
  }[tone];
}

/** Aviso con icono (información, privacidad, advertencia...). */
export function InfoBanner({
  tone = 'info',
  icon,
  title,
  message,
  children,
  action,
  style,
  testID,
}: {
  tone?: NoticeTone;
  icon?: IconName;
  title?: string;
  message?: string;
  children?: ReactNode;
  action?: { label: string; onPress: () => void };
  style?: StyleProp<ViewStyle>;
  testID?: string;
}) {
  const theme = useAppTheme();
  const t = useToneColors(tone);
  const defaultIcon: IconName = {
    info: 'information-circle',
    success: 'checkmark-circle',
    warning: 'warning',
    danger: 'alert-circle',
    ai: 'sparkles',
    neutral: 'information-circle-outline',
  }[tone] as IconName;
  return (
    <View
      style={[styles.banner, { backgroundColor: t.bg, borderColor: t.border, borderRadius: theme.radius.md }, style]}
      // Con acción o contenido propio, el aviso no se agrupa: el lector de pantalla debe poder llegar al botón.
      accessible={!action && !children}
      accessibilityRole={tone === 'danger' || tone === 'warning' ? 'alert' : 'text'}
      testID={testID}
    >
      <Icon name={icon ?? defaultIcon} size={24} color={t.fg} />
      <View style={styles.bannerText}>
        {title ? (
          <AppText variant="bodyStrong" style={{ color: tone === 'info' || tone === 'neutral' ? theme.colors.heading : t.text }}>
            {title}
          </AppText>
        ) : null}
        {message ? (
          <AppText variant="caption" style={{ color: theme.colors.textSecondary }}>
            {message}
          </AppText>
        ) : null}
        {children}
        {action ? (
          <Pressable
            onPress={action.onPress}
            accessibilityRole="button"
            accessibilityLabel={action.label}
            hitSlop={8}
            style={({ pressed }) => ({ marginTop: 2, minHeight: 48, justifyContent: 'center', alignSelf: 'flex-start', opacity: pressed ? 0.6 : 1 })}
          >
            <AppText variant="captionStrong" style={{ color: theme.colors.link }}>
              {action.label}
            </AppText>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

/** Insignia de estado (p. ej. "✓ Medicamento identificado"). */
export function Badge({
  label,
  tone = 'success',
  icon,
  size = 'md',
  fullWidth = true,
}: {
  label: string;
  tone?: NoticeTone;
  icon?: IconName;
  size?: 'sm' | 'md';
  /** Ocupa todo el ancho (por defecto) o solo lo que necesita. */
  fullWidth?: boolean;
}) {
  const theme = useAppTheme();
  const t = useToneColors(tone);
  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: t.bg,
          borderRadius: size === 'md' ? theme.radius.md : theme.radius.pill,
          paddingVertical: size === 'md' ? 10 : 4,
          paddingHorizontal: size === 'md' ? 14 : 10,
          alignSelf: fullWidth ? 'stretch' : 'flex-start',
        },
      ]}
      accessible
      accessibilityLabel={label}
    >
      {icon ? <Icon name={icon} size={size === 'md' ? 24 : 16} color={t.fg} /> : null}
      <AppText variant={size === 'md' ? 'label' : 'small'} style={{ color: t.text }}>
        {label}
      </AppText>
    </View>
  );
}

/** Elemento con círculo de check verde (listas de ventajas, pasos completados). */
export function CheckItem({
  label,
  detail,
  state = 'done',
  tone = 'success',
}: {
  label: string;
  detail?: string;
  /** done = check · pending = en curso · todo = por hacer */
  state?: 'done' | 'pending' | 'todo';
  tone?: 'success' | 'primary';
}) {
  const theme = useAppTheme();
  const c = theme.colors;
  const fill = tone === 'primary' ? c.primary : c.successStrong;
  return (
    <View style={styles.check} accessible accessibilityLabel={`${label}${state === 'done' ? ', completado' : state === 'pending' ? ', en curso' : ''}`}>
      <View
        style={[
          styles.checkCircle,
          state === 'done'
            ? { backgroundColor: fill }
            : { borderWidth: 2, borderColor: state === 'pending' ? fill : c.borderStrong, backgroundColor: 'transparent' },
        ]}
      >
        {state === 'done' ? <Icon name="checkmark" size={16} color="#FFFFFF" /> : null}
        {state === 'pending' ? <View style={[styles.pendingDot, { backgroundColor: fill }]} /> : null}
      </View>
      <View style={{ flex: 1 }}>
        <AppText variant="body" color={state === 'todo' ? 'textMuted' : 'heading'}>
          {label}
        </AppText>
        {detail ? (
          <AppText variant="caption" color="textSecondary">
            {detail}
          </AppText>
        ) : null}
      </View>
    </View>
  );
}

/** Avatar circular con foto, iniciales o icono de persona. */
export function Avatar({ name, uri, size = 56, tone = 'primary' }: { name?: string | null; uri?: string | null; size?: number; tone?: 'primary' | 'neutral' }) {
  const theme = useAppTheme();
  const text = getInitials(name);
  const bg = tone === 'primary' ? theme.colors.primarySoft : theme.colors.surfaceMuted;
  const fg = tone === 'primary' ? theme.colors.primaryPressed : '#5B6E94';
  return (
    <View
      style={[styles.avatar, { width: size, height: size, borderRadius: size / 2, backgroundColor: bg, overflow: 'hidden' }]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {uri ? (
        <Image source={{ uri }} resizeMode="cover" style={{ width: size, height: size }} />
      ) : text ? (
        <AppText style={{ color: fg, fontSize: size * 0.38, fontWeight: '800' }} allowFontScaling={false}>
          {text}
        </AppText>
      ) : (
        <Icon name="person" size={size * 0.55} color={fg} />
      )}
    </View>
  );
}

/** Chip seleccionable / sugerencia (contorno azul redondeado). */
export function Chip({
  label,
  onPress,
  selected,
  icon,
  tone = 'primary',
  disabled,
}: {
  label: string;
  onPress: () => void;
  selected?: boolean;
  icon?: IconName;
  tone?: 'primary' | 'danger';
  disabled?: boolean;
}) {
  const theme = useAppTheme();
  const c = theme.colors;
  const accent = tone === 'danger' ? c.danger : c.primary;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: !!selected, disabled: !!disabled }}
      style={({ pressed }) => [
        styles.chip,
        {
          minHeight: theme.touchTargets.min,
          borderRadius: theme.radius.md,
          borderColor: selected ? accent : tone === 'danger' ? '#F3C3C1' : c.primarySoft,
          backgroundColor: selected ? (tone === 'danger' ? c.dangerSoft : c.primaryTint) : pressed ? c.surfaceAlt : c.surface,
          opacity: disabled ? 0.5 : 1,
        },
      ]}
    >
      {icon ? <Icon name={icon} size={20} color={selected ? accent : c.textSecondary} /> : null}
      <AppText variant="label" style={{ color: selected ? (tone === 'danger' ? c.dangerText : c.primary) : c.heading, flexShrink: 1 }}>
        {label}
      </AppText>
      {selected ? <Icon name="checkmark-circle" size={20} color={accent} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  banner: { flexDirection: 'row', gap: 12, padding: 14, borderWidth: 1, alignItems: 'flex-start' },
  bannerText: { flex: 1, gap: 2 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  check: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 4 },
  checkCircle: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  pendingDot: { width: 10, height: 10, borderRadius: 5 },
  avatar: { alignItems: 'center', justifyContent: 'center' },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1.5, paddingHorizontal: 14, paddingVertical: 10 },
});
