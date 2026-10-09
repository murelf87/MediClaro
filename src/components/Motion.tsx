/**
 * Movimiento suave y respetuoso.
 *  - Si la persona activa «Reducir movimiento» en su teléfono, todo aparece al instante y sin bucles.
 *  - Duraciones cortas y curvas suaves: el movimiento guía la vista, nunca distrae ni marea.
 *
 * FadeIn · Float · Pulse · Shimmer · AnimatedProgressBar · Confetti · Stagger (retrasos escalonados).
 */
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AccessibilityInfo, Animated, Easing, Platform, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useAppTheme } from '../providers/PreferencesProvider';

/** En web (solo QA) no hay «driver» nativo: se anima en JS. */
const NATIVE = Platform.OS !== 'web';

let reduceMotionCache = false;

/** ¿Pide la persona reducir el movimiento? (ajuste de accesibilidad del sistema). */
export function useReduceMotion(): boolean {
  const [reduce, setReduce] = useState(reduceMotionCache);
  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((v) => {
        reduceMotionCache = v;
        if (mounted) setReduce(v);
      })
      .catch(() => undefined);
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', (v: boolean) => {
      reduceMotionCache = v;
      setReduce(v);
    });
    return () => {
      mounted = false;
      sub?.remove?.();
    };
  }, []);
  return reduce;
}

export type FadeFrom = 'bottom' | 'top' | 'left' | 'right' | 'scale' | 'none';

/** Aparece con un fundido y un pequeño desplazamiento. */
export function FadeIn({
  children,
  delay = 0,
  duration = 420,
  from = 'bottom',
  distance = 14,
  style,
}: {
  children: ReactNode;
  delay?: number;
  duration?: number;
  from?: FadeFrom;
  distance?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const reduce = useReduceMotion();
  const progress = useRef(new Animated.Value(reduce ? 1 : 0)).current;
  useEffect(() => {
    if (reduce) {
      progress.setValue(1);
      return undefined;
    }
    const anim = Animated.timing(progress, {
      toValue: 1,
      duration,
      delay,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: NATIVE,
    });
    anim.start();
    return () => anim.stop();
  }, [reduce, delay, duration, progress]);

  const transform = useMemo(() => {
    const offset = progress.interpolate({ inputRange: [0, 1], outputRange: [distance, 0] });
    const negative = progress.interpolate({ inputRange: [0, 1], outputRange: [-distance, 0] });
    switch (from) {
      case 'bottom':
        return [{ translateY: offset }];
      case 'top':
        return [{ translateY: negative }];
      case 'left':
        return [{ translateX: negative }];
      case 'right':
        return [{ translateX: offset }];
      case 'scale':
        return [{ scale: progress.interpolate({ inputRange: [0, 1], outputRange: [0.86, 1] }) }];
      default:
        return [];
    }
  }, [from, distance, progress]);

  return <Animated.View style={[style, { opacity: progress, transform }]}>{children}</Animated.View>;
}

/** Retraso escalonado para listas: stagger(i) → i × paso (+ inicio). */
export function stagger(index: number, step = 70, start = 0): number {
  return start + index * step;
}

/** Flota suavemente arriba y abajo (personaje, ilustraciones). */
export function Float({
  children,
  amplitude = 5,
  duration = 3200,
  style,
}: {
  children: ReactNode;
  amplitude?: number;
  duration?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const reduce = useReduceMotion();
  const t = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (reduce) {
      t.setValue(0);
      return undefined;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(t, { toValue: 1, duration: duration / 2, easing: Easing.inOut(Easing.sin), useNativeDriver: NATIVE }),
        Animated.timing(t, { toValue: 0, duration: duration / 2, easing: Easing.inOut(Easing.sin), useNativeDriver: NATIVE }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [reduce, duration, t]);
  const translateY = t.interpolate({ inputRange: [0, 1], outputRange: [0, -amplitude] });
  return <Animated.View style={[style, { transform: [{ translateY }] }]}>{children}</Animated.View>;
}

/** Late suavemente para invitar a pulsar (botón principal, 112). */
export function Pulse({
  children,
  active = true,
  scale = 1.03,
  duration = 1600,
  style,
}: {
  children: ReactNode;
  active?: boolean;
  scale?: number;
  duration?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const reduce = useReduceMotion();
  const t = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (reduce || !active) {
      t.setValue(0);
      return undefined;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(t, { toValue: 1, duration: duration / 2, easing: Easing.inOut(Easing.quad), useNativeDriver: NATIVE }),
        Animated.timing(t, { toValue: 0, duration: duration / 2, easing: Easing.inOut(Easing.quad), useNativeDriver: NATIVE }),
        Animated.delay(900),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [reduce, active, duration, t]);
  const s = t.interpolate({ inputRange: [0, 1], outputRange: [1, scale] });
  return <Animated.View style={[style, { transform: [{ scale: s }] }]}>{children}</Animated.View>;
}

/** Brillo que cruza una etiqueta (cinta «Recomendado»). */
export function Shimmer({ width, height, radius = 8 }: { width: number; height: number; radius?: number }) {
  const reduce = useReduceMotion();
  const t = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (reduce) return undefined;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(1800),
        Animated.timing(t, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.quad), useNativeDriver: NATIVE }),
        Animated.timing(t, { toValue: 0, duration: 0, useNativeDriver: NATIVE }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [reduce, t]);
  if (reduce) return null;
  const translateX = t.interpolate({ inputRange: [0, 1], outputRange: [-width, width] });
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { overflow: 'hidden', borderRadius: radius }]}>
      <Animated.View
        style={{
          width: Math.max(18, width * 0.28),
          height,
          backgroundColor: 'rgba(255,255,255,0.35)',
          transform: [{ translateX }, { skewX: '-20deg' }],
        }}
      />
    </View>
  );
}

/** Barra de progreso animada (explicación paso a paso). */
export function AnimatedProgressBar({
  progress,
  height = 6,
  color,
  track,
  accessibilityLabel,
}: {
  /** 0–1 */
  progress: number;
  height?: number;
  color?: string;
  track?: string;
  accessibilityLabel?: string;
}) {
  const theme = useAppTheme();
  const reduce = useReduceMotion();
  const value = Math.max(0, Math.min(1, progress));
  const width = useRef(new Animated.Value(value)).current;
  useEffect(() => {
    if (reduce) {
      width.setValue(value);
      return undefined;
    }
    const anim = Animated.timing(width, { toValue: value, duration: 480, easing: Easing.out(Easing.cubic), useNativeDriver: false });
    anim.start();
    return () => anim.stop();
  }, [value, reduce, width]);
  return (
    <View
      style={[styles.track, { height, borderRadius: height / 2, backgroundColor: track ?? theme.colors.primarySoft }]}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(value * 100) }}
    >
      <Animated.View
        style={{
          height,
          borderRadius: height / 2,
          backgroundColor: color ?? theme.colors.primary,
          width: width.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
        }}
      />
    </View>
  );
}

// ─── Confeti ─────────────────────────────────────────────────────────────────

const CONFETTI_COLORS = ['#2563EB', '#60A5FA', '#F59E0B', '#10B981', '#EF4444', '#A78BFA'];

interface Piece {
  x: number;
  delay: number;
  duration: number;
  size: number;
  color: string;
  drift: number;
  spin: number;
  round: boolean;
}

/** Confeti de celebración (una sola vez). Decorativo: invisible para lectores de pantalla. */
export function Confetti({ count = 26, height = 320, width = 360 }: { count?: number; height?: number; width?: number }) {
  const reduce = useReduceMotion();
  const pieces = useMemo<Piece[]>(() => {
    // Pseudoaleatorio determinista (mismo confeti en cada ejecución: capturas estables).
    let seed = 7;
    const rnd = () => {
      seed = (seed * 9301 + 49297) % 233280;
      return seed / 233280;
    };
    return Array.from({ length: count }, (_, i) => ({
      x: rnd() * width,
      delay: rnd() * 450,
      duration: 1500 + rnd() * 1300,
      size: 6 + rnd() * 6,
      color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
      drift: (rnd() - 0.5) * 70,
      spin: (rnd() - 0.5) * 720,
      round: rnd() > 0.65,
    }));
  }, [count, width]);
  const progress = useRef(pieces.map(() => new Animated.Value(0))).current;

  useEffect(() => {
    if (reduce) return undefined;
    const anims = progress.map((v, i) =>
      Animated.timing(v, {
        toValue: 1,
        duration: pieces[i].duration,
        delay: pieces[i].delay,
        easing: Easing.out(Easing.quad),
        useNativeDriver: NATIVE,
      }),
    );
    Animated.parallel(anims).start();
    return () => anims.forEach((a) => a.stop());
  }, [reduce, progress, pieces]);

  if (reduce) return null;
  return (
    <View
      pointerEvents="none"
      style={[styles.confetti, { height, width }]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {pieces.map((p, i) => {
        const v = progress[i];
        return (
          <Animated.View
            key={i}
            style={{
              position: 'absolute',
              left: p.x,
              top: -12,
              width: p.size,
              height: p.round ? p.size : p.size * 0.45,
              borderRadius: p.round ? p.size / 2 : 2,
              backgroundColor: p.color,
              opacity: v.interpolate({ inputRange: [0, 0.1, 0.8, 1], outputRange: [0, 1, 1, 0] }),
              transform: [
                { translateY: v.interpolate({ inputRange: [0, 1], outputRange: [0, height] }) },
                { translateX: v.interpolate({ inputRange: [0, 1], outputRange: [0, p.drift] }) },
                { rotate: v.interpolate({ inputRange: [0, 1], outputRange: ['0deg', `${p.spin}deg`] }) },
              ],
            }}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: { width: '100%', overflow: 'hidden' },
  confetti: { position: 'absolute', top: 0, alignSelf: 'center', overflow: 'hidden' },
});
