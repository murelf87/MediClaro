/**
 * Piezas locales de Perfil y ajustes (equipo D). No son componentes compartidos.
 *  - FlatRows: filas planas con separadores finos (como la referencia 13_profile).
 *  - LeadingSlot / AaGlyph: huecos de icono alineados con los iconos de SettingRow.
 *  - InfoRow: dato de cuenta (etiqueta arriba, valor debajo: no se corta con letra muy grande).
 *  - BulletItem, UsageBar, EasyModeIllustration.
 */
import { Children, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Svg, { Circle, Path, Rect, Text as SvgText } from 'react-native-svg';
import { AppText, Divider, Icon, type IconName } from '../../components';
import { useAppTheme } from '../../hooks';

/** Separación que deja SettingRow antes del texto: padding 16 + icono 30 + hueco 14. */
const ROW_TEXT_INSET = 60;

/** Hueco de 30 px (mismo ancho que el icono de SettingRow) para contenido a medida. */
export function LeadingSlot({ children }: { children: ReactNode }) {
  return (
    <View style={styles.leading} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {children}
    </View>
  );
}

/** "Aa" de la fila "Tamaño del texto". */
export function AaGlyph() {
  const theme = useAppTheme();
  return (
    <LeadingSlot>
      <AppText allowFontScaling={false} style={[styles.aa, { color: theme.colors.heading }]}>
        Aa
      </AppText>
    </LeadingSlot>
  );
}

/** Lista plana de filas separadas por líneas finas que empiezan en el texto. */
export function FlatRows({ children }: { children: ReactNode }) {
  const items = Children.toArray(children).filter(Boolean);
  return (
    <View>
      {items.map((child, i) => (
        <View key={i}>
          {i > 0 ? <Divider inset={ROW_TEXT_INSET} /> : null}
          {child}
        </View>
      ))}
    </View>
  );
}

/** Dato de cuenta: icono · etiqueta · valor (debajo) · acción opcional. */
export function InfoRow({
  icon,
  label,
  value,
  valueColor = 'heading',
  children,
  right,
  onPress,
  accessibilityHint,
  testID,
}: {
  icon: IconName;
  label: string;
  value?: string;
  valueColor?: 'heading' | 'textSecondary' | 'textMuted' | 'successText' | 'primary';
  children?: ReactNode;
  right?: ReactNode;
  onPress?: () => void;
  accessibilityHint?: string;
  testID?: string;
}) {
  const theme = useAppTheme();
  const c = theme.colors;
  const content = (
    <View style={[styles.infoRow, { minHeight: theme.touchTargets.comfortable + 8 }]}>
      <View style={styles.leading}>
        <Icon name={icon} size={24} color={c.heading} />
      </View>
      <View style={styles.infoText}>
        <AppText variant="caption" color="textSecondary">
          {label}
        </AppText>
        {value ? (
          <AppText variant="bodyStrong" color={valueColor}>
            {value}
          </AppText>
        ) : null}
        {children}
      </View>
      {right}
      {onPress ? <Icon name="chevron-forward" size={22} color={c.textMuted} /> : null}
    </View>
  );
  if (!onPress) {
    return (
      <View style={styles.infoPad} testID={testID}>
        {content}
      </View>
    );
  }
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={value ? `${label}: ${value}` : label}
      accessibilityHint={accessibilityHint}
      testID={testID}
      style={({ pressed }) => [styles.infoPad, { backgroundColor: pressed ? c.surfaceAlt : 'transparent' }]}
    >
      {content}
    </Pressable>
  );
}

/** Viñeta con icono en círculo (listas "Qué guardamos" / "Qué no guardamos"). */
export function BulletItem({ icon, tone, text }: { icon: IconName; tone: 'primary' | 'neutral'; text: string }) {
  const theme = useAppTheme();
  const c = theme.colors;
  const bg = tone === 'primary' ? c.primarySoft : c.surfaceMuted;
  const fg = tone === 'primary' ? c.primary : c.textSecondary;
  return (
    <View style={styles.bullet} accessible accessibilityLabel={text}>
      <View style={[styles.bulletIcon, { backgroundColor: bg }]}>
        <Icon name={icon} size={16} color={fg} />
      </View>
      <AppText variant="body" color="text" style={styles.flex}>
        {text}
      </AppText>
    </View>
  );
}

/** Barra de uso (identificaciones del mes). */
export function UsageBar({ used, total }: { used: number; total: number }) {
  const theme = useAppTheme();
  const ratio = total > 0 ? Math.max(0, Math.min(1, used / total)) : 0;
  const full = ratio >= 1;
  return (
    <View
      style={[styles.usageTrack, { backgroundColor: theme.colors.surfaceMuted }]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <View
        style={[
          styles.usageFill,
          { width: `${Math.round(ratio * 100)}%`, backgroundColor: full ? theme.colors.warning : theme.colors.primary },
        ]}
      />
    </View>
  );
}

/** Ilustración del Modo fácil: teléfono con letra grande, botones grandes y emergencia a mano. */
export function EasyModeIllustration({ size = 180 }: { size?: number }) {
  const height = Math.round((size * 160) / 200);
  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Svg width={size} height={height} viewBox="0 0 200 160">
        <Circle cx={100} cy={82} r={74} fill="#EEF5FF" />
        <Rect x={62} y={12} width={76} height={138} rx={16} fill="#16307E" />
        <Rect x={67.5} y={20} width={65} height={122} rx={10} fill="#FFFFFF" />
        <Rect x={88} y={15} width={24} height={4} rx={2} fill="#0F2463" />
        <SvgText x={100} y={60} fontSize={30} fontWeight="bold" fontFamily="sans-serif" fill="#16307E" textAnchor="middle">
          Aa
        </SvgText>
        <Rect x={75} y={72} width={50} height={20} rx={7} fill="#2563EB" />
        <Rect x={75} y={97} width={50} height={16} rx={6} fill="#EAF8F0" />
        <Rect x={81} y={103} width={24} height={4} rx={2} fill="#1FA45C" />
        <Rect x={75} y={119} width={50} height={16} rx={8} fill="#EF4444" />
        <Path d="M96 127 L104 127" stroke="#FFFFFF" strokeWidth={3} strokeLinecap="round" />
        <Circle cx={150} cy={40} r={17} fill="#1FA45C" />
        <Path d="M142 40 L148 46 L159 34" stroke="#FFFFFF" strokeWidth={4} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  leading: { width: 30, alignItems: 'center', justifyContent: 'center' },
  aa: { fontSize: 21, lineHeight: 26, fontWeight: '700', letterSpacing: -0.5 },
  infoPad: { paddingHorizontal: 16 },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 10 },
  infoText: { flex: 1, gap: 2 },
  bullet: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 3 },
  bulletIcon: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  usageTrack: { height: 8, borderRadius: 4, overflow: 'hidden', marginTop: 6 },
  usageFill: { height: 8, borderRadius: 4 },
});
