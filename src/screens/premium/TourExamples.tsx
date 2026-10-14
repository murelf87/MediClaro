/**
 * Ejemplos visuales de la explicación («Conocer MediClaro»). Son ilustraciones y maquetas de la propia app,
 * marcadas como «Ejemplo»: no son datos de la persona ni respuestas reales de la IA (en el modo gratuito
 * no se usa la IA real). El ejemplo del asistente es la indicación oficial del paracetamol.
 *
 * Solo se animan cuando la página está visible (`active`).
 */
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { Animated, Easing, Platform, Pressable, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import Svg, { Circle, Defs, G, LinearGradient, Path, Rect, Stop, Text as SvgText } from 'react-native-svg';
import { AppText, Icon, Waveform } from '../../components';
import { FadeIn, Pulse, useReduceMotion } from '../../components/Motion';
import { GuideAvatar } from '../../components/Guide';
import { useAppTheme } from '../../hooks';

const NATIVE = Platform.OS !== 'web';

function ExampleTag() {
  const c = useAppTheme().colors;
  return (
    <View style={[styles.tag, { backgroundColor: c.surface, borderColor: c.border }]} accessibilityLabel="Ejemplo">
      <AppText variant="small" color="textSecondary">
        Ejemplo
      </AppText>
    </View>
  );
}

function ExampleCard({ children, height }: { children: ReactNode; height?: number }) {
  const theme = useAppTheme();
  return (
    <View
      style={[
        styles.card,
        { backgroundColor: '#EAF2FF', borderRadius: theme.radius.xl, minHeight: height },
      ]}
    >
      {children}
      <View style={styles.tagAnchor}>
        <ExampleTag />
      </View>
    </View>
  );
}

// ─── 1 · Identificar: carrusel ───────────────────────────────────────────────

function PhoneShotArt({ width }: { width: number }) {
  const gid = `shot${useId().replace(/[^A-Za-z0-9_-]/g, '')}`;
  const h = Math.round(width * 0.84);
  return (
    <Svg width={width} height={h} viewBox="0 0 260 218" accessibilityLabel="Un teléfono fotografía una caja de paracetamol">
      <Defs>
        <LinearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#FFFFFF" />
          <Stop offset="1" stopColor="#EEF3FA" />
        </LinearGradient>
      </Defs>
      {/* caja real al fondo */}
      <G opacity={0.6}>
        <Rect x="14" y="74" width="92" height="112" rx="6" fill="#FFFFFF" stroke="#CBD5E1" />
        <Rect x="14" y="74" width="92" height="18" rx="6" fill="#2563EB" />
        <Rect x="26" y="106" width="56" height="8" rx="4" fill="#172554" />
        <Rect x="26" y="122" width="34" height="6" rx="3" fill="#94A3B8" />
        <Rect x="26" y="136" width="44" height="6" rx="3" fill="#CBD5E1" />
      </G>
      {/* teléfono */}
      <G transform="rotate(-6 150 104)">
        <Rect x="92" y="10" width="126" height="190" rx="20" fill="#172554" />
        <Rect x="99" y="20" width="112" height="172" rx="14" fill="#0B1220" />
        {/* caja en pantalla */}
        <Rect x="111" y="46" width="88" height="112" rx="6" fill={`url(#${gid})`} />
        <Rect x="111" y="46" width="88" height="18" rx="6" fill="#2563EB" />
        <SvgText x="155" y="84" fontSize="13" fontWeight="bold" fill="#172554" textAnchor="middle" fontFamily="sans-serif">
          Paracetamol
        </SvgText>
        <SvgText x="155" y="101" fontSize="11" fill="#334155" textAnchor="middle" fontFamily="sans-serif">
          500 mg
        </SvgText>
        <SvgText x="155" y="115" fontSize="10" fill="#64748B" textAnchor="middle" fontFamily="sans-serif">
          comprimidos
        </SvgText>
        {/* código de barras */}
        {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13].map((i) => (
          <Rect key={i} x={125 + i * 4.3} y={126} width={i % 3 === 0 ? 2.4 : 1.3} height={20} fill="#1F2937" />
        ))}
        {/* recuadro de enfoque */}
        <Path
          d="M107 50 L107 40 L119 40 M191 40 L203 40 L203 50 M203 154 L203 164 L191 164 M119 164 L107 164 L107 154"
          stroke="#60A5FA"
          strokeWidth="3"
          fill="none"
          strokeLinecap="round"
        />
        {/* botón de foto */}
        <Circle cx="155" cy="178" r="11" fill="#2563EB" stroke="#FFFFFF" strokeWidth="3" />
      </G>
    </Svg>
  );
}

function ResultMini() {
  const theme = useAppTheme();
  const c = theme.colors;
  return (
    <View style={[styles.mini, { backgroundColor: c.surface, borderRadius: theme.radius.lg }]}>
      <View style={styles.miniHead}>
        <View style={[styles.miniIcon, { backgroundColor: '#D1FAE5' }]}>
          <Icon name="medkit" size={22} color="#059669" />
        </View>
        <View style={styles.flex}>
          <AppText variant="bodyStrong" color="heading">
            Paracetamol 500 mg
          </AppText>
          <AppText variant="caption" color="textSecondary">
            Comprimidos
          </AppText>
        </View>
      </View>
      <AppText variant="captionStrong" color="heading" style={{ marginTop: 8 }}>
        ¿Para qué sirve?
      </AppText>
      <AppText variant="caption" color="textSecondary">
        Para el dolor leve o moderado y para bajar la fiebre.
      </AppText>
      <View style={[styles.source, { backgroundColor: c.successSoft }]}>
        <Icon name="shield-checkmark" size={14} color={c.successStrong} />
        <AppText variant="small" style={{ color: c.successText }}>
          Fuente oficial: CIMA · AEMPS
        </AppText>
      </View>
    </View>
  );
}

function SavedMini() {
  const theme = useAppTheme();
  const c = theme.colors;
  const rows = [
    { name: 'Paracetamol 500 mg', note: 'Guardado hoy' },
    { name: 'Omeprazol 20 mg', note: 'Guardado ayer' },
  ];
  return (
    <View style={[styles.mini, { backgroundColor: c.surface, borderRadius: theme.radius.lg, gap: 10 }]}>
      <AppText variant="bodyStrong" color="heading">
        Mis medicamentos
      </AppText>
      {rows.map((r) => (
        <View key={r.name} style={styles.savedRow}>
          <View style={[styles.miniIcon, { backgroundColor: '#FEE2E2', width: 36, height: 36 }]}>
            <Icon name="heart" size={18} color="#EF4444" />
          </View>
          <View style={styles.flex}>
            <AppText variant="captionStrong" color="heading">
              {r.name}
            </AppText>
            <AppText variant="small" color="textSecondary">
              {r.note}
            </AppText>
          </View>
          <Icon name="chevron-forward" size={18} color={c.textMuted} />
        </View>
      ))}
    </View>
  );
}

const IDENTIFY_SLIDES = [
  { key: 'photo', caption: '1 · Haz una foto de la caja' },
  { key: 'result', caption: '2 · Te decimos qué es y para qué sirve' },
  { key: 'saved', caption: '3 · Guárdalo en Mis medicamentos' },
] as const;

export function IdentifyExample({ active, width }: { active: boolean; width: number }) {
  const theme = useAppTheme();
  const c = theme.colors;
  const reduce = useReduceMotion();
  const [slide, setSlide] = useState(0);
  const slideRef = useRef(slide);
  slideRef.current = slide;
  const fade = useRef(new Animated.Value(1)).current;

  const go = (next: number) => {
    const target = (next + IDENTIFY_SLIDES.length) % IDENTIFY_SLIDES.length;
    if (reduce) {
      setSlide(target);
      return;
    }
    Animated.timing(fade, { toValue: 0, duration: 140, useNativeDriver: NATIVE }).start(() => {
      setSlide(target);
      Animated.timing(fade, { toValue: 1, duration: 220, easing: Easing.out(Easing.cubic), useNativeDriver: NATIVE }).start();
    });
  };

  // Pasa solo de ejemplo en ejemplo mientras la página está visible (y no con «reducir movimiento»).
  useEffect(() => {
    if (!active || reduce) return undefined;
    const timer = setInterval(() => go(slideRef.current + 1), 4200);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, reduce]);

  const inner = Math.max(200, width - 32);
  const current = IDENTIFY_SLIDES[slide];

  return (
    <ExampleCard>
      <Animated.View style={[styles.slide, { opacity: fade }]} accessibilityLiveRegion="polite">
        {current.key === 'photo' ? <PhoneShotArt width={Math.min(inner, 300)} /> : null}
        {current.key === 'result' ? <ResultMini /> : null}
        {current.key === 'saved' ? <SavedMini /> : null}
      </Animated.View>
      <View style={styles.slideFooter}>
        <Pressable
          onPress={() => go(slide - 1)}
          accessibilityRole="button"
          accessibilityLabel="Ejemplo anterior"
          style={({ pressed }) => [styles.arrow, { backgroundColor: c.surface, opacity: pressed ? 0.7 : 1 }, theme.shadow.card]}
          testID="tour-example-prev"
        >
          <Icon name="chevron-back" size={22} color={c.primary} />
        </Pressable>
        <AppText variant="captionStrong" color="heading" align="center" style={styles.flex}>
          {current.caption}
        </AppText>
        <Pressable
          onPress={() => go(slide + 1)}
          accessibilityRole="button"
          accessibilityLabel="Ejemplo siguiente"
          style={({ pressed }) => [styles.arrow, { backgroundColor: c.surface, opacity: pressed ? 0.7 : 1 }, theme.shadow.card]}
          testID="tour-example-next"
        >
          <Icon name="chevron-forward" size={22} color={c.primary} />
        </Pressable>
      </View>
    </ExampleCard>
  );
}

// ─── 2 · Asistente: conversación de ejemplo ──────────────────────────────────

function TypingDots() {
  const c = useAppTheme().colors;
  const t = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.timing(t, { toValue: 1, duration: 900, easing: Easing.linear, useNativeDriver: NATIVE }));
    loop.start();
    return () => loop.stop();
  }, [t]);
  return (
    <View style={styles.dots} accessibilityLabel="Escribiendo">
      {[0, 1, 2].map((i) => (
        <Animated.View
          key={i}
          style={[
            styles.dot,
            {
              backgroundColor: c.textMuted,
              opacity: t.interpolate({
                inputRange: [0, 0.33, 0.66, 1],
                outputRange: i === 0 ? [1, 0.3, 0.3, 1] : i === 1 ? [0.3, 1, 0.3, 0.3] : [0.3, 0.3, 1, 0.3],
              }),
            },
          ]}
        />
      ))}
    </View>
  );
}

export function AssistantExample({ active }: { active: boolean }) {
  const theme = useAppTheme();
  const c = theme.colors;
  const reduce = useReduceMotion();
  const [stage, setStage] = useState<0 | 1 | 2>(reduce ? 2 : 0);

  useEffect(() => {
    if (!active) return undefined;
    if (reduce) {
      setStage(2);
      return undefined;
    }
    setStage(0);
    const a = setTimeout(() => setStage(1), 700);
    const b = setTimeout(() => setStage(2), 2100);
    return () => {
      clearTimeout(a);
      clearTimeout(b);
    };
  }, [active, reduce]);

  return (
    <ExampleCard>
      <View style={{ gap: theme.spacing.sm, paddingTop: 6 }}>
        <FadeIn from="right" key={`q-${active}`}>
          <View style={[styles.userBubble, { backgroundColor: c.primarySoft }]}>
            <AppText variant="body" style={{ color: '#172554' }}>
              ¿Para qué sirve este medicamento?
            </AppText>
          </View>
        </FadeIn>
        {stage >= 1 ? (
          <View style={styles.botRow}>
            <GuideAvatar size={40} ai />
            {stage === 1 ? (
              <View style={[styles.botBubble, { backgroundColor: c.surface }]}>
                <TypingDots />
              </View>
            ) : (
              <FadeIn from="left" style={styles.flex}>
                <View style={[styles.botBubble, { backgroundColor: c.surface }]}>
                  <AppText variant="body" color="text">
                    Este medicamento se utiliza para aliviar el dolor leve o moderado y reducir la fiebre. Te explico cómo
                    tomarlo, precauciones y posibles efectos, de forma sencilla.
                  </AppText>
                </View>
              </FadeIn>
            )}
          </View>
        ) : null}
      </View>
    </ExampleCard>
  );
}

// ─── 3 · Voz: el prospecto en voz alta ───────────────────────────────────────

export function VoiceExample({ active }: { active: boolean }) {
  const theme = useAppTheme();
  const c = theme.colors;
  return (
    <ExampleCard>
      <View style={[styles.mini, { backgroundColor: c.surface, borderRadius: theme.radius.lg, gap: 10 }]}>
        <View style={styles.miniHead}>
          <View style={[styles.miniIcon, { backgroundColor: '#EDE9FE' }]}>
            <Icon name="document-text" size={22} color="#7C3AED" />
          </View>
          <View style={styles.flex}>
            <AppText variant="bodyStrong" color="heading">
              Prospecto
            </AppText>
            <AppText variant="caption" color="textSecondary">
              Leyendo: ¿Para qué sirve?
            </AppText>
          </View>
        </View>
        {[0.92, 0.78, 0.86, 0.55].map((w, i) => (
          <View key={i} style={[styles.line, { width: `${Math.round(w * 100)}%`, backgroundColor: i === 0 ? '#C4B5FD' : c.surfaceMuted }]} />
        ))}
        <View style={styles.voiceRow}>
          <Pulse active={active}>
            <View style={[styles.playBtn, { backgroundColor: '#7C3AED' }]}>
              <Icon name="pause" size={26} color="#FFFFFF" />
            </View>
          </Pulse>
          <View style={styles.flex}>
            <Waveform active={active} bars={18} height={36} color="#7C3AED" />
          </View>
        </View>
        <AppText variant="small" color="textSecondary" align="center">
          Velocidad: normal · Puedes pausar y repetir
        </AppText>
      </View>
    </ExampleCard>
  );
}

// ─── 4 · Emergencias ─────────────────────────────────────────────────────────

export function EmergencyExample({ active }: { active: boolean }) {
  const theme = useAppTheme();
  const c = theme.colors;
  const router = useRouter();
  return (
    <ExampleCard>
      <View style={[styles.mini, { backgroundColor: c.surface, borderRadius: theme.radius.lg, gap: 12 }]}>
        <Pulse active={active} scale={1.04}>
          {/* No es solo un ejemplo: en una urgencia real, este botón abre la pantalla de emergencia (112). */}
          <Pressable
            onPress={() => router.push('/emergency')}
            accessibilityRole="button"
            accessibilityLabel="Llamar al 112. Abre la pantalla de emergencia"
            testID="tour-emergency-112"
            style={({ pressed }) => [styles.sos, { backgroundColor: pressed ? c.dangerPressed : c.danger, borderRadius: theme.radius.lg }]}
          >
            <Icon name="call" size={26} color="#FFFFFF" />
            <AppText variant="heading" style={{ color: '#FFFFFF' }}>
              Llamar al 112
            </AppText>
          </Pressable>
        </Pulse>
        <View style={styles.locRow}>
          <View style={[styles.miniIcon, { backgroundColor: '#FEF3C7', width: 38, height: 38 }]}>
            <Icon name="location" size={20} color="#D97706" />
          </View>
          <View style={styles.flex}>
            <AppText variant="captionStrong" color="heading">
              Tu ubicación ahora
            </AppText>
            <AppText variant="caption" color="textSecondary">
              Calle Mayor 12, Madrid · lista para leérsela al 112
            </AppText>
          </View>
        </View>
      </View>
    </ExampleCard>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  card: { padding: 16, paddingTop: 28, overflow: 'hidden' },
  tagAnchor: { position: 'absolute', top: 8, right: 10 },
  tag: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, borderWidth: 1 },
  slide: { alignItems: 'center', justifyContent: 'center', minHeight: 210 },
  slideFooter: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 },
  arrow: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  mini: { padding: 14, alignSelf: 'stretch' },
  miniHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  miniIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  source: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, marginTop: 10 },
  savedRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  userBubble: { alignSelf: 'flex-end', maxWidth: '86%', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 18, borderBottomRightRadius: 6 },
  botRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  botBubble: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 18, borderBottomLeftRadius: 6, flexShrink: 1 },
  dots: { flexDirection: 'row', gap: 5, paddingVertical: 6 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  line: { height: 10, borderRadius: 5 },
  voiceRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 4 },
  playBtn: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  sos: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, minHeight: 60 },
  locRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
});
