/**
 * Tarjetas y agrupaciones.
 */
import { type ReactNode } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useAppTheme } from '../providers/PreferencesProvider';
import { AppText } from './AppText';

export type CardTone = 'default' | 'primary' | 'success' | 'ai' | 'danger' | 'warning' | 'muted';

export interface CardProps {
  children: ReactNode;
  tone?: CardTone;
  onPress?: () => void;
  padding?: number;
  bordered?: boolean;
  elevated?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  testID?: string;
}

export function useCardColors(tone: CardTone) {
  const c = useAppTheme().colors;
  return {
    default: { bg: c.surface, border: c.border },
    primary: { bg: c.primaryTint, border: c.primarySoft },
    success: { bg: c.successSoft, border: '#CDEEDB' },
    ai: { bg: c.aiSoft, border: c.aiSoft },
    danger: { bg: c.dangerSoft, border: '#F9D3D1' },
    warning: { bg: c.warningSoft, border: '#FBE3B8' },
    muted: { bg: c.surfaceAlt, border: c.surfaceAlt },
  }[tone];
}

export function Card({
  children,
  tone = 'default',
  onPress,
  padding,
  bordered = true,
  elevated,
  style,
  accessibilityLabel,
  accessibilityHint,
  testID,
}: CardProps) {
  const theme = useAppTheme();
  const colors = useCardColors(tone);
  const shouldElevate = elevated ?? tone === 'default';
  const base: StyleProp<ViewStyle> = [
    styles.card,
    {
      backgroundColor: colors.bg,
      borderColor: bordered ? colors.border : 'transparent',
      borderRadius: theme.radius.lg,
      padding: padding ?? theme.spacing.md,
    },
    shouldElevate ? theme.shadow.card : null,
    style,
  ];
  if (!onPress) {
    return (
      <View style={base} testID={testID} accessibilityLabel={accessibilityLabel}>
        {children}
      </View>
    );
  }
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      testID={testID}
      style={({ pressed }) => [base, { opacity: pressed ? 0.85 : 1, transform: [{ scale: pressed ? 0.99 : 1 }] }]}
    >
      {children}
    </Pressable>
  );
}

/** Grupo de filas dentro de una tarjeta, con separadores finos. */
export function ListGroup({ children, style, title }: { children: ReactNode; style?: StyleProp<ViewStyle>; title?: string }) {
  const theme = useAppTheme();
  const items = (Array.isArray(children) ? children : [children]).filter(Boolean);
  return (
    <View style={style}>
      {title ? <SectionHeader title={title} /> : null}
      <View
        style={[
          styles.group,
          { borderColor: theme.colors.border, borderRadius: theme.radius.lg, backgroundColor: theme.colors.surface },
          theme.shadow.card,
        ]}
      >
        {items.map((child, i) => (
          <View key={i}>
            {i > 0 ? <View style={[styles.divider, { backgroundColor: theme.colors.divider, marginLeft: theme.spacing.md }]} /> : null}
            {child}
          </View>
        ))}
      </View>
    </View>
  );
}

export function Divider({ inset = 0, style }: { inset?: number; style?: StyleProp<ViewStyle> }) {
  const theme = useAppTheme();
  return <View style={[styles.divider, { backgroundColor: theme.colors.divider, marginLeft: inset }, style]} />;
}

export function SectionHeader({ title, action }: { title: string; action?: ReactNode }) {
  const theme = useAppTheme();
  return (
    <View style={[styles.sectionHeader, { marginBottom: theme.spacing.xs, marginTop: theme.spacing.xs }]}>
      <AppText variant="captionStrong" color="textSecondary" accessibilityRole="header" style={styles.sectionTitle}>
        {title}
      </AppText>
      {action}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1 },
  group: { borderWidth: 1, overflow: 'hidden' },
  divider: { height: StyleSheet.hairlineWidth * 2 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 4 },
  sectionTitle: { textTransform: 'uppercase', letterSpacing: 0.6 },
});
