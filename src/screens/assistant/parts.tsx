/**
 * Piezas locales del Asistente de MediClaro (equipo C).
 *  - AssistantHeader: cabecera con "Volver" (misma lógica que AppHeader) y título
 *    largo que cabe entero ("Asistente de MediClaro" no cabe en AppHeader).
 *  - AssistantAvatar: la guía de MediClaro con la etiqueta «IA».
 *  - SuggestionChip: sugerencia en píldora azul con contorno.
 *  - TypingIndicator: "está escribiendo" con tres puntos animados.
 *  - useKeyboardVisible: teclado visible (iOS: will*, Android: did*).
 *  - shortMedicationName: "Paracetamol Kern Pharma 1 g Comprimidos EFG" → "Paracetamol".
 */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Animated, Easing, Keyboard, Platform, Pressable, StyleSheet, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { AppText, Icon } from '../../components';
import { GuideAvatar } from '../../components/Guide';
import { useAppTheme } from '../../hooks';

// ─── Cabecera ─────────────────────────────────────────────────────────────────

export function AssistantHeader({
  title,
  showBack,
  right,
  fallbackHref = '/(tabs)',
}: {
  title: string;
  showBack: boolean;
  right?: ReactNode;
  fallbackHref?: Href;
}) {
  const theme = useAppTheme();
  const router = useRouter();
  const slot = theme.touchTargets.min + theme.spacing.xxs;

  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace(fallbackHref);
  };

  return (
    <View style={[styles.bar, { minHeight: theme.layout.headerHeight, paddingHorizontal: theme.spacing.xs }]}>
      <View style={[styles.side, { width: slot }]}>
        {showBack ? (
          <Pressable
            onPress={goBack}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Volver"
            style={({ pressed }) => [
              styles.back,
              { minHeight: theme.touchTargets.min, minWidth: theme.touchTargets.min, opacity: pressed ? 0.6 : 1 },
            ]}
          >
            <Icon name="chevron-back" size={30} color={theme.colors.heading} />
          </Pressable>
        ) : null}
      </View>
      <View style={styles.center} accessible accessibilityRole="header">
        <AppText variant="subheading" color="heading" align="center" numberOfLines={2}>
          {title}
        </AppText>
      </View>
      <View style={[styles.side, styles.right, { width: slot }]}>{right}</View>
    </View>
  );
}

// ─── Avatar del asistente ─────────────────────────────────────────────────────

/**
 * La guía de MediClaro (el personaje de toda la app) con la etiqueta «IA»: siempre se ve que responde una IA.
 */
export function AssistantAvatar({ size = 52 }: { size?: number }) {
  return <GuideAvatar size={size} ai />;
}

// ─── Sugerencias ──────────────────────────────────────────────────────────────

export function SuggestionChip({ label, onPress, disabled }: { label: string; onPress: () => void; disabled?: boolean }) {
  const theme = useAppTheme();
  const c = theme.colors;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint="Envía esta pregunta al asistente"
      accessibilityState={{ disabled: !!disabled }}
      style={({ pressed }) => [
        styles.chip,
        {
          minHeight: theme.touchTargets.comfortable,
          borderRadius: theme.radius.pill,
          borderColor: c.primarySoft,
          backgroundColor: pressed ? c.primaryTint : c.surface,
          opacity: disabled ? 0.5 : 1,
        },
      ]}
    >
      <AppText variant="label" align="center" style={{ color: c.primary }}>
        {label}
      </AppText>
    </Pressable>
  );
}

// ─── "Está escribiendo" ───────────────────────────────────────────────────────

export function TypingIndicator() {
  const theme = useAppTheme();
  const c = theme.colors;
  const dots = useRef([0, 1, 2].map(() => new Animated.Value(0))).current;

  useEffect(() => {
    const loops = dots.map((value, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 160),
          Animated.timing(value, { toValue: 1, duration: 320, easing: Easing.out(Easing.quad), useNativeDriver: true }),
          Animated.timing(value, { toValue: 0, duration: 320, easing: Easing.in(Easing.quad), useNativeDriver: true }),
          Animated.delay((2 - i) * 160 + 220),
        ]),
      ),
    );
    loops.forEach((l) => l.start());
    return () => loops.forEach((l) => l.stop());
  }, [dots]);

  return (
    <View
      style={[
        styles.typing,
        {
          backgroundColor: c.primaryTint,
          borderColor: c.primarySoft,
          borderRadius: theme.radius.lg,
          borderTopLeftRadius: 6,
        },
      ]}
      accessible
      accessibilityLabel="El asistente está escribiendo"
      accessibilityLiveRegion="polite"
    >
      <AppText variant="captionStrong" color="textSecondary">Pensando</AppText>
      {dots.map((value, i) => (
        <Animated.View
          key={i}
          style={[
            styles.dot,
            {
              backgroundColor: c.primary,
              opacity: value.interpolate({ inputRange: [0, 1], outputRange: [0.35, 1] }),
              transform: [{ translateY: value.interpolate({ inputRange: [0, 1], outputRange: [0, -4] }) }],
            },
          ]}
        />
      ))}
    </View>
  );
}

// ─── Teclado ──────────────────────────────────────────────────────────────────

export function useKeyboardVisible(): boolean {
  const [visible, setVisible] = useState(() => Keyboard.isVisible());
  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const shown = Keyboard.addListener(showEvent, () => setVisible(true));
    const hidden = Keyboard.addListener(hideEvent, () => setVisible(false));
    return () => {
      shown.remove();
      hidden.remove();
    };
  }, []);
  return visible;
}

// ─── Nombre corto del medicamento ─────────────────────────────────────────────

/** Formas farmacéuticas: el nombre corto termina antes de ellas. */
const FORM_WORDS = new Set([
  'comprimido', 'comprimidos', 'capsula', 'capsulas', 'cápsula', 'cápsulas', 'sobre', 'sobres', 'jarabe',
  'solucion', 'solución', 'suspension', 'suspensión', 'gotas', 'crema', 'pomada', 'gel', 'polvo', 'granulado',
  'inyectable', 'colirio', 'parche', 'parches', 'supositorio', 'supositorios', 'efervescente', 'efervescentes',
  'bucodispersable', 'bucodispersables', 'spray', 'aerosol', 'inhalador', 'ampollas', 'viales', 'efg',
]);

/** Laboratorios de genéricos habituales en España (se omiten del nombre corto). */
const LAB_WORDS = new Set([
  'cinfa', 'normon', 'kern', 'pharma', 'sandoz', 'teva', 'stada', 'mylan', 'viatris', 'ratiopharm', 'aurobindo',
  'almus', 'tarbis', 'bexal', 'combix', 'qualigen', 'apotex', 'pensa', 'cuvefarma', 'zentiva', 'accord', 'krka',
  'alter', 'davur', 'vir', 'edigen', 'kabi', 'aristo', 'ranbaxy', 'farmalider', 'aphar', 'mabo', 'galenicum',
  'lareq', 'belmac', 'tecnigen', 'glenmark', 'neuraxpharm', 'laboratorios', 'farma', 'grupo', 'sl', 's.l.', 'sa', 's.a.',
]);

export function shortMedicationName(name: string | null | undefined): string | null {
  const clean = (name ?? '').replace(/\s+/g, ' ').trim();
  if (!clean) return null;
  const words: string[] = [];
  for (const token of clean.split(' ')) {
    const bare = token.toLowerCase().replace(/[(),.;:]/g, '');
    if (/\d/.test(token) || FORM_WORDS.has(bare)) break;
    words.push(token);
  }
  while (words.length > 1 && LAB_WORDS.has(words[words.length - 1].toLowerCase().replace(/[(),;:]/g, ''))) {
    words.pop();
  }
  const short = words.slice(0, 3).join(' ').trim();
  if (!short) return clean.length <= 28 ? clean : null;
  return short.length > 32 ? `${short.slice(0, 31).trim()}…` : short;
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'center' },
  side: { flexDirection: 'row', alignItems: 'center' },
  right: { justifyContent: 'flex-end' },
  back: { justifyContent: 'center', alignItems: 'flex-start', paddingHorizontal: 8 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  chip: { borderWidth: 1.5, paddingHorizontal: 20, paddingVertical: 12, justifyContent: 'center', alignSelf: 'flex-start', maxWidth: '100%' },
  typing: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    alignSelf: 'flex-start',
    paddingHorizontal: 18,
    paddingVertical: 16,
    borderWidth: 1,
  },
  dot: { width: 9, height: 9, borderRadius: 4.5 },
});
