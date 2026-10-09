/**
 * Gráficos animados: anillo de progreso, onda de voz y halo pulsante.
 */
import { useEffect, useId, useRef, type ReactNode } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg';
import { useAppTheme } from '../providers/PreferencesProvider';

/** Anillo de progreso (0–1) o indeterminado (gira). */
export function ProgressRing({
  size = 180,
  strokeWidth = 12,
  progress,
  color,
  gradient = true,
  children,
}: {
  size?: number;
  strokeWidth?: number;
  /** undefined → indeterminado */
  progress?: number;
  color?: string;
  gradient?: boolean;
  children?: ReactNode;
}) {
  const theme = useAppTheme();
  const main = color ?? theme.colors.primary;
  const r = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * r;
  const indeterminate = progress === undefined;
  const value = indeterminate ? 0.28 : Math.max(0, Math.min(1, progress));
  const spin = useRef(new Animated.Value(0)).current;
  const gradId = `ring${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;

  useEffect(() => {
    if (!indeterminate) return;
    const loop = Animated.loop(
      Animated.timing(spin, { toValue: 1, duration: 1400, easing: Easing.linear, useNativeDriver: true }),
    );
    loop.start();
    return () => loop.stop();
  }, [indeterminate, spin]);

  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View style={[StyleSheet.absoluteFill, indeterminate ? { transform: [{ rotate }] } : null]}>
        <Svg width={size} height={size}>
          <Defs>
            <LinearGradient id={gradId} x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor={main} />
              <Stop offset="1" stopColor={gradient ? '#22B3A6' : main} />
            </LinearGradient>
          </Defs>
          <Circle cx={size / 2} cy={size / 2} r={r} stroke={theme.colors.surfaceMuted} strokeWidth={strokeWidth} fill="none" />
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            stroke={`url(#${gradId})`}
            strokeWidth={strokeWidth}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={`${circumference} ${circumference}`}
            strokeDashoffset={circumference * (1 - value)}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        </Svg>
      </Animated.View>
      {children}
    </View>
  );
}

/** Onda de voz: barras que se animan mientras suena la lectura. */
export function Waveform({
  active,
  bars = 14,
  height = 44,
  color,
}: {
  active: boolean;
  bars?: number;
  height?: number;
  color?: string;
}) {
  const theme = useAppTheme();
  const fill = color ?? theme.colors.primary;
  const values = useRef(Array.from({ length: bars }, () => new Animated.Value(0.3))).current;
  const base = useRef(Array.from({ length: bars }, (_, i) => 0.25 + 0.6 * Math.abs(Math.sin((i + 1) * 1.7)))).current;

  useEffect(() => {
    if (!active) {
      values.forEach((v, i) => v.setValue(base[i] * 0.6));
      return;
    }
    const loops = values.map((v, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.timing(v, { toValue: Math.min(1, base[i] + 0.35), duration: 300 + (i % 4) * 90, useNativeDriver: true }),
          Animated.timing(v, { toValue: Math.max(0.15, base[i] - 0.2), duration: 300 + (i % 3) * 110, useNativeDriver: true }),
        ]),
      ),
    );
    loops.forEach((l) => l.start());
    return () => loops.forEach((l) => l.stop());
  }, [active, values, base]);

  return (
    <View style={[styles.wave, { height }]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {values.map((v, i) => (
        <Animated.View
          key={i}
          style={{
            width: 4,
            height,
            borderRadius: 2,
            backgroundColor: fill,
            opacity: 0.35 + 0.65 * base[i],
            transform: [{ scaleY: v }],
          }}
        />
      ))}
    </View>
  );
}

/** Halo que late detrás de un icono (emergencia, asistente activo). */
export function PulseHalo({ size = 140, color, children }: { size?: number; color?: string; children?: ReactNode }) {
  const theme = useAppTheme();
  const scale = useRef(new Animated.Value(0.85)).current;
  const opacity = useRef(new Animated.Value(0.5)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.parallel([
        Animated.sequence([
          Animated.timing(scale, { toValue: 1.12, duration: 1100, useNativeDriver: true }),
          Animated.timing(scale, { toValue: 0.85, duration: 0, useNativeDriver: true }),
        ]),
        Animated.sequence([
          Animated.timing(opacity, { toValue: 0, duration: 1100, useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 0.5, duration: 0, useNativeDriver: true }),
        ]),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [scale, opacity]);
  const fill = color ?? theme.colors.danger;
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          { borderRadius: size / 2, backgroundColor: fill, opacity, transform: [{ scale }] },
        ]}
      />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  wave: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 },
});
