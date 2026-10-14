/**
 * Logo oficial de MediClaro: corazón azul (dos lóbulos superpuestos) sostenido
 * por dos formas verdes. NO es una píldora ni un emoji.
 */
import { useId } from 'react';
import { Text, View, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Defs, G, Line, LinearGradient, Path, Stop } from 'react-native-svg';
import { AppText } from './AppText';
import { useAppTheme } from '../providers/PreferencesProvider';

// Geometría (viewBox 6 4 88 84): dos lóbulos (semicápsulas) girados ±45° sobre el vértice (50,68)
// y dos cápsulas verdes paralelas a los bordes inferiores del corazón.
const W = 32.5; // ancho de cada lóbulo
const H = 63.3; // largo de cada lóbulo
const R = W / 2;
const LOBE = `M0 ${R} A${R} ${R} 0 0 1 ${W} ${R} L${W} ${H} L0 ${H} Z`;

export function MediClaroMark({ size = 48, accessibilityLabel = 'MediClaro' }: { size?: number; accessibilityLabel?: string }) {
  const height = (size * 84) / 88;
  // Ids únicos por instancia (varios logos en pantalla no comparten degradados)
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const L = `mcL${uid}`;
  const R2 = `mcR${uid}`;
  const GL = `mcGL${uid}`;
  const GR = `mcGR${uid}`;
  return (
    <Svg width={size} height={height} viewBox="6 4 88 84" accessibilityLabel={accessibilityLabel} accessibilityRole="image">
      <Defs>
        <LinearGradient id={L} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#1A62E6" />
          <Stop offset="1" stopColor="#2F7FF0" />
        </LinearGradient>
        <LinearGradient id={R2} x1="1" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#5AA8F8" />
          <Stop offset="1" stopColor="#3B8CF2" />
        </LinearGradient>
        <LinearGradient id={GL} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#1C9B57" />
          <Stop offset="1" stopColor="#27AE64" />
        </LinearGradient>
        <LinearGradient id={GR} x1="1" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#45C47C" />
          <Stop offset="1" stopColor="#30B36B" />
        </LinearGradient>
      </Defs>
      {/* Formas verdes (manos que sostienen) */}
      <Line x1={18.9} y1={56.7} x2={37.3} y2={75.1} stroke={`url(#${GL})`} strokeWidth={20} strokeLinecap="round" />
      <Line x1={81.1} y1={56.7} x2={62.7} y2={75.1} stroke={`url(#${GR})`} strokeWidth={20} strokeLinecap="round" />
      {/* Corazón: dos lóbulos superpuestos */}
      <G transform={`translate(50 68) rotate(-45) translate(0 ${-H})`}>
        <Path d={LOBE} fill={`url(#${L})`} />
      </G>
      <G transform={`translate(50 68) rotate(45) translate(${-W} ${-H})`} opacity={0.9}>
        <Path d={LOBE} fill={`url(#${R2})`} />
      </G>
    </Svg>
  );
}

export function MediClaroWordmark({ size = 28 }: { size?: number }) {
  const { colors } = useAppTheme();
  return (
    <AppText
      style={[styles.wordmark, { fontSize: size, lineHeight: Math.round(size * 1.2) }]}
      allowFontScaling={false}
      accessibilityRole="header"
      accessibilityLabel="MediClaro"
    >
      <Text style={{ color: colors.brandMedi }}>Medi</Text>
      <Text style={{ color: colors.brandClaro }}>Claro</Text>
    </AppText>
  );
}

interface LogoProps {
  /** horizontal: símbolo + nombre en línea (cabecera). stacked: símbolo encima (splash). mark: solo símbolo. */
  variant?: 'horizontal' | 'stacked' | 'mark';
  size?: 'sm' | 'md' | 'lg' | 'xl';
  style?: StyleProp<ViewStyle>;
}

const SIZES = {
  sm: { mark: 28, text: 22, gap: 8 },
  md: { mark: 36, text: 26, gap: 10 },
  lg: { mark: 84, text: 38, gap: 12 },
  xl: { mark: 116, text: 46, gap: 16 },
} as const;

export function MediClaroLogo({ variant = 'horizontal', size = 'md', style }: LogoProps) {
  const s = SIZES[size];
  if (variant === 'mark') {
    return (
      <View style={style}>
        <MediClaroMark size={s.mark} />
      </View>
    );
  }
  return (
    <View
      style={[variant === 'horizontal' ? styles.row : styles.column, { gap: s.gap }, style]}
      accessible
      accessibilityLabel="MediClaro"
    >
      <MediClaroMark size={s.mark} accessibilityLabel="" />
      <MediClaroWordmark size={s.text} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  column: { alignItems: 'center' },
  wordmark: { fontWeight: '800', letterSpacing: -0.6 },
});
