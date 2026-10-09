/**
 * Botones grandes y accesibles.
 *  - PrimaryButton: acción principal (azul; rojo SOLO para urgencias).
 *  - SecondaryButton: acción secundaria (tonal, contorno o neutro).
 *  - TextButton: enlace.
 *  - IconButton: icono con área táctil mínima de 48.
 */
import { ActivityIndicator, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { AppText } from './AppText';
import { Icon, type IconName } from './Icon';
import { useAppTheme } from '../providers/PreferencesProvider';

interface BaseButtonProps {
  label: string;
  onPress: () => void;
  icon?: IconName;
  iconPosition?: 'left' | 'right';
  loading?: boolean;
  disabled?: boolean;
  /** lg = altura de acción principal (64, o 72 en Modo fácil). */
  size?: 'md' | 'lg';
  fullWidth?: boolean;
  accessibilityHint?: string;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export type PrimaryTone = 'primary' | 'danger' | 'success' | 'ai';

export function PrimaryButton({
  label,
  onPress,
  icon,
  iconPosition = 'left',
  loading,
  disabled,
  size = 'lg',
  fullWidth = true,
  tone = 'primary',
  accessibilityHint,
  accessibilityLabel,
  style,
  testID,
}: BaseButtonProps & { tone?: PrimaryTone }) {
  const theme = useAppTheme();
  const c = theme.colors;
  const bg = { primary: c.primary, danger: c.danger, success: c.successText, ai: c.ai }[tone];
  const bgPressed = { primary: c.primaryPressed, danger: c.dangerPressed, success: '#065F46', ai: '#5836C7' }[tone];
  const height = size === 'lg' ? theme.actionHeight : theme.touchTargets.comfortable;
  const inactive = disabled || loading;

  return (
    <Pressable
      onPress={onPress}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: !!inactive, busy: !!loading }}
      testID={testID}
      style={({ pressed }) => [
        styles.base,
        {
          minHeight: height,
          borderRadius: theme.radius.md,
          backgroundColor: pressed ? bgPressed : bg,
          opacity: disabled ? 0.45 : 1,
          alignSelf: fullWidth ? 'stretch' : 'center',
          transform: [{ scale: pressed ? 0.985 : 1 }],
        },
        !disabled && (tone === 'danger' ? theme.shadow.danger : theme.shadow.button),
        style,
      ]}
    >
      {loading ? <ActivityIndicator color={c.onPrimary} style={styles.spinner} /> : null}
      <View style={[styles.content, loading && styles.hidden]} accessibilityElementsHidden={!!loading} importantForAccessibility={loading ? "no-hide-descendants" : "auto"}>
          {icon && iconPosition === 'left' ? <Icon name={icon} size={24} color={c.onPrimary} /> : null}
          <AppText variant="button" style={[styles.label, { color: c.onPrimary }]} align="center">
            {label}
          </AppText>
          {icon && iconPosition === 'right' ? <Icon name={icon} size={22} color={c.onPrimary} /> : null}
      </View>
    </Pressable>
  );
}

export type SecondaryVariant = 'tonal' | 'outline' | 'neutral' | 'dangerTonal' | 'dangerOutline' | 'successTonal';

export function SecondaryButton({
  label,
  onPress,
  icon,
  iconPosition = 'left',
  loading,
  disabled,
  size = 'md',
  fullWidth = true,
  variant = 'tonal',
  accessibilityHint,
  accessibilityLabel,
  style,
  testID,
}: BaseButtonProps & { variant?: SecondaryVariant }) {
  const theme = useAppTheme();
  const c = theme.colors;
  const map: Record<SecondaryVariant, { bg: string; bgPressed: string; fg: string; border?: string }> = {
    tonal: { bg: c.primarySoft, bgPressed: '#C7DBFB', fg: c.primaryPressed },
    outline: { bg: c.surface, bgPressed: c.primaryTint, fg: c.primary, border: c.primary },
    neutral: { bg: c.surfaceMuted, bgPressed: c.border, fg: c.text },
    dangerTonal: { bg: c.dangerSoft, bgPressed: '#FEE2E2', fg: c.dangerText },
    dangerOutline: { bg: c.surface, bgPressed: c.dangerSoft, fg: c.dangerText, border: c.danger },
    successTonal: { bg: c.successSoft, bgPressed: '#D1FAE5', fg: c.successText },
  };
  const s = map[variant];
  const height = size === 'lg' ? theme.actionHeight : theme.touchTargets.comfortable;
  const inactive = disabled || loading;

  return (
    <Pressable
      onPress={onPress}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: !!inactive, busy: !!loading }}
      testID={testID}
      style={({ pressed }) => [
        styles.base,
        {
          minHeight: height,
          borderRadius: theme.radius.md,
          backgroundColor: pressed ? s.bgPressed : s.bg,
          borderWidth: s.border ? 1.5 : 0,
          borderColor: s.border,
          opacity: disabled ? 0.45 : 1,
          alignSelf: fullWidth ? 'stretch' : 'center',
        },
        style,
      ]}
    >
      {loading ? <ActivityIndicator color={s.fg} style={styles.spinner} /> : null}
      <View style={[styles.content, loading && styles.hidden]} accessibilityElementsHidden={!!loading} importantForAccessibility={loading ? "no-hide-descendants" : "auto"}>
          {icon && iconPosition === 'left' ? <Icon name={icon} size={22} color={s.fg} /> : null}
          <AppText variant="button" style={[styles.label, { color: s.fg }]} align="center">
            {label}
          </AppText>
          {icon && iconPosition === 'right' ? <Icon name={icon} size={20} color={s.fg} /> : null}
      </View>
    </Pressable>
  );
}

export function TextButton({
  label,
  onPress,
  icon,
  tone = 'primary',
  disabled,
  align = 'center',
  accessibilityHint,
  style,
  testID,
}: {
  label: string;
  onPress: () => void;
  icon?: IconName;
  tone?: 'primary' | 'danger' | 'muted' | 'inverse';
  disabled?: boolean;
  align?: 'center' | 'flex-start' | 'flex-end';
  accessibilityHint?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}) {
  const theme = useAppTheme();
  const color = {
    primary: theme.colors.link,
    danger: theme.colors.dangerText,
    muted: theme.colors.textSecondary,
    inverse: theme.colors.textInverse,
  }[tone];
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: !!disabled }}
      testID={testID}
      style={({ pressed }) => [
        styles.textBtn,
        { minHeight: theme.touchTargets.min, alignSelf: align, opacity: disabled ? 0.45 : pressed ? 0.6 : 1 },
        style,
      ]}
    >
      {icon ? <Icon name={icon} size={20} color={color} /> : null}
      <AppText variant="label" style={[styles.label, { color }]} align="center">
        {label}
      </AppText>
    </Pressable>
  );
}

export function IconButton({
  icon,
  onPress,
  accessibilityLabel,
  color = 'heading',
  variant = 'plain',
  size = 26,
  disabled,
  selected,
  testID,
}: {
  icon: IconName;
  onPress: () => void;
  accessibilityLabel: string;
  color?: string;
  variant?: 'plain' | 'tonal' | 'solid';
  size?: number;
  disabled?: boolean;
  selected?: boolean;
  testID?: string;
}) {
  const theme = useAppTheme();
  const bg = variant === 'tonal' ? theme.colors.primarySoft : variant === 'solid' ? theme.colors.primary : 'transparent';
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={4}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled: !!disabled, selected: !!selected }}
      testID={testID}
      style={({ pressed }) => [
        styles.iconBtn,
        {
          width: theme.touchTargets.min,
          height: theme.touchTargets.min,
          borderRadius: theme.touchTargets.min / 2,
          backgroundColor: bg,
          opacity: disabled ? 0.4 : pressed ? 0.6 : 1,
        },
      ]}
    >
      <Icon name={icon} size={size} color={variant === 'solid' ? theme.colors.onPrimary : color} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { justifyContent: 'center', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 10, maxWidth: '100%', minWidth: 0 },
  content: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, flexShrink: 1, maxWidth: '100%', minWidth: 0 },
  label: { flexShrink: 1, minWidth: 0 },
  spinner: { position: 'absolute' },
  hidden: { opacity: 0 },
  textBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: 8, paddingVertical: 8, maxWidth: '100%', flexShrink: 1, minWidth: 0 },
  iconBtn: { justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
});
