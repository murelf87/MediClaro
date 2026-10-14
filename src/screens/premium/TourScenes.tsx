/**
 * Imágenes de «Conocer MediClaro». Van cambiando mientras habla la voz (no son tarjetas que se pasan):
 * cada una ilustra la frase que se está diciendo. Las maquetas de la app llevan la etiqueta «Ejemplo»
 * (no son datos de la persona ni respuestas reales de la IA).
 *
 * Todas se dibujan en un lienzo fijo de 320 × 260 y se escalan al hueco disponible, así se ven igual en un
 * iPhone SE, en un Pro Max o en una tableta. El texto de las imágenes no crece con el tamaño de letra
 * elegido: lo importante está siempre en el rótulo grande de debajo, que sí crece.
 */
import { memo, useEffect, useId, useRef, type ReactNode } from 'react';
import { Animated, Easing, Platform, StyleSheet, Text, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import Svg, { Circle, ClipPath, Defs, G, Line, LinearGradient, Path, Rect, Stop, Text as SvgText } from 'react-native-svg';
import { Icon, Waveform, type IconName } from '../../components';
import { FadeIn, Pulse, useReduceMotion } from '../../components/Motion';
import { GuideAvatar, GuideIllustration } from '../../components/Guide';
import { EmergencyIllustration, InfoIllustration } from '../../components/Illustrations';
import { MediClaroMark } from '../../components/MediClaroLogo';
import type { TourSceneId } from '../../config/tour';
import { useAppTheme } from '../../hooks';

const NATIVE = Platform.OS !== 'web';
export const SCENE_W = 320;
export const SCENE_H = 260;

// ─── Piezas comunes ──────────────────────────────────────────────────────────

/** Texto de las ilustraciones: tamaño fijo (la información importante está en el rótulo). */
function T({
  size,
  weight = '400',
  color,
  align,
  lines,
  style,
  children,
}: {
  size: number;
  weight?: TextStyle['fontWeight'];
  color?: string;
  align?: TextStyle['textAlign'];
  lines?: number;
  style?: StyleProp<TextStyle>;
  children: ReactNode;
}) {
  const c = useAppTheme().colors;
  return (
    <Text
      allowFontScaling={false}
      numberOfLines={lines}
      style={[{ fontSize: size, lineHeight: Math.round(size * 1.3), fontWeight: weight, color: color ?? c.heading, textAlign: align }, style]}
    >
      {children}
    </Text>
  );
}

function ExampleTag({ style }: { style?: StyleProp<ViewStyle> }) {
  const c = useAppTheme().colors;
  return (
    <View style={[styles.tag, { backgroundColor: c.surface, borderColor: c.border }, style]} accessibilityLabel="Ejemplo">
      <T size={11} weight="600" color={c.textSecondary}>
        Ejemplo
      </T>
    </View>
  );
}

/** Círculo de color con un icono. */
function Bubble({ icon, color, bg, size = 64, iconSize, style }: { icon: IconName; color: string; bg: string; size?: number; iconSize?: number; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[{ width: size, height: size, borderRadius: size / 2, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }, style]}>
      <Icon name={icon} size={iconSize ?? Math.round(size * 0.48)} color={color} />
    </View>
  );
}

/** Panel blanco tipo «pantalla de la app». */
function Panel({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const theme = useAppTheme();
  return <View style={[styles.panel, { backgroundColor: theme.colors.surface, borderRadius: theme.radius.lg }, theme.shadow.card, style]}>{children}</View>;
}

function Chip({ icon, label, color, bg }: { icon: IconName; label: string; color: string; bg: string }) {
  return (
    <View style={[styles.chip, { backgroundColor: bg }]}>
      <Icon name={icon} size={15} color={color} />
      <T size={12.5} weight="700" color={color}>
        {label}
      </T>
    </View>
  );
}

/** Aparece al cambiar `id` (cambios dentro de una misma imagen). */
function Appear({ id, children, from = 'scale', style }: { id: string; children: ReactNode; from?: 'scale' | 'bottom' | 'top' | 'left' | 'right'; style?: StyleProp<ViewStyle> }) {
  return (
    <FadeIn key={id} from={from} duration={380} style={style}>
      {children}
    </FadeIn>
  );
}

// ─── Presentación ────────────────────────────────────────────────────────────

function Welcome() {
  return (
    <View style={styles.center}>
      <GuideIllustration size={230} />
    </View>
  );
}

/** Prospecto de letra diminuta y una lupa que agranda una palabra difícil. */
function Problem() {
  const id = useId().replace(/[^A-Za-z0-9_-]/g, '');
  return (
    <View style={styles.center}>
      <Svg width={300} height={250} viewBox="0 0 300 250" accessibilityLabel="Un prospecto con letra muy pequeña y una lupa">
        <Defs>
          <ClipPath id={`lens${id}`}>
            <Circle cx="196" cy="112" r="54" />
          </ClipPath>
        </Defs>
        {/* caja detrás */}
        <G transform="rotate(8 240 170)" opacity={0.9}>
          <Rect x="196" y="150" width="86" height="64" rx="6" fill="#FFFFFF" stroke="#CBD5E1" />
          <Rect x="196" y="150" width="14" height="64" fill="#2563EB" />
          <Rect x="218" y="162" width="50" height="7" rx="3" fill="#16307E" />
          <Rect x="218" y="176" width="30" height="5" rx="2.5" fill="#94A3B8" />
        </G>
        {/* prospecto */}
        <G transform="rotate(-6 110 125)">
          <Rect x="34" y="18" width="150" height="214" rx="8" fill="#FFFFFF" stroke="#D5DEEA" strokeWidth="1.5" />
          <Rect x="48" y="32" width="92" height="7" rx="3" fill="#16307E" />
          {Array.from({ length: 22 }, (_, i) => (
            <Rect key={i} x="48" y={48 + i * 7.6} width={i % 5 === 4 ? 70 : 118 - (i % 3) * 9} height="2.6" rx="1.3" fill="#A9B6C8" />
          ))}
        </G>
        {/* lupa */}
        <Line x1="234" y1="152" x2="270" y2="190" stroke="#1E3A8A" strokeWidth="13" strokeLinecap="round" />
        <Circle cx="196" cy="112" r="54" fill="#FFFFFF" />
        <G clipPath={`url(#lens${id})`}>
          <Rect x="140" y="58" width="112" height="108" fill="#F8FAFF" />
          <SvgText x="196" y="104" fontSize="17" fontWeight="bold" fill="#16307E" textAnchor="middle" fontFamily="sans-serif">
            Posología
          </SvgText>
          <SvgText x="196" y="125" fontSize="10.5" fill="#475569" textAnchor="middle" fontFamily="sans-serif">
            Contraindicaciones
          </SvgText>
          <Rect x="152" y="138" width="88" height="5" rx="2.5" fill="#CBD5E1" />
        </G>
        <Circle cx="196" cy="112" r="54" fill="none" stroke="#2563EB" strokeWidth="8" />
        {/* dudas */}
        <Circle cx="40" cy="40" r="20" fill="#F59E0B" />
        <SvgText x="40" y="48" fontSize="24" fontWeight="bold" fill="#FFFFFF" textAnchor="middle" fontFamily="sans-serif">
          ?
        </SvgText>
      </Svg>
    </View>
  );
}

const FEATURES: { key: TourSceneId; icon: IconName; color: string; bg: string; label: string }[] = [
  { key: 'featurePhoto', icon: 'camera', color: '#059669', bg: '#D1FAE5', label: 'Foto' },
  { key: 'featureAsk', icon: 'chatbubbles', color: '#2563EB', bg: '#DBEAFE', label: 'Preguntar' },
  { key: 'featureListen', icon: 'volume-high', color: '#7C3AED', bg: '#EDE9FE', label: 'Escuchar' },
  { key: 'featureSave', icon: 'heart', color: '#E11D48', bg: '#FFE4E6', label: 'Guardar' },
  { key: 'featureReady', icon: 'location', color: '#D97706', bg: '#FEF3C7', label: 'Emergencia' },
];

/** MediClaro en el centro y sus cuatro ayudas alrededor. */
function Together() {
  const c = useAppTheme().colors;
  const around: { icon: IconName; color: string; bg: string; x: number; y: number }[] = [
    { icon: 'camera', color: '#059669', bg: '#D1FAE5', x: 58, y: 52 },
    { icon: 'chatbubbles', color: '#2563EB', bg: '#DBEAFE', x: 262, y: 52 },
    { icon: 'volume-high', color: '#7C3AED', bg: '#EDE9FE', x: 58, y: 208 },
    { icon: 'location', color: '#D97706', bg: '#FEF3C7', x: 262, y: 208 },
  ];
  return (
    <View style={StyleSheet.absoluteFill}>
      <Svg width={SCENE_W} height={SCENE_H} style={StyleSheet.absoluteFill}>
        {around.map((a) => (
          <Line key={a.icon} x1="160" y1="130" x2={a.x} y2={a.y} stroke="#BFD3F5" strokeWidth="3" strokeDasharray="6 7" strokeLinecap="round" />
        ))}
      </Svg>
      {around.map((a, i) => (
        <FadeIn key={a.icon} delay={120 + i * 110} from="scale" style={[styles.abs, { left: a.x - 32, top: a.y - 32 }]}>
          <Bubble icon={a.icon} color={a.color} bg={a.bg} size={64} />
        </FadeIn>
      ))}
      <View style={[styles.abs, styles.hub, { left: 160 - 56, top: 130 - 56, backgroundColor: c.surface }]}>
        <MediClaroMark size={70} accessibilityLabel="" />
      </View>
    </View>
  );
}

/** Las cinco ayudas: la que se está nombrando se ve en grande y se ilumina en la fila. */
function Features({ focus }: { focus: TourSceneId }) {
  const c = useAppTheme().colors;
  const current = FEATURES.find((f) => f.key === focus) ?? FEATURES[0];
  return (
    <View style={styles.center}>
      <Appear id={current.key}>
        <View style={[styles.featureHalo, { backgroundColor: current.bg }]}>
          <Bubble icon={current.icon} color="#FFFFFF" bg={current.color} size={112} iconSize={56} />
        </View>
      </Appear>
      <View style={styles.featureRow}>
        {FEATURES.map((f) => {
          const on = f.key === current.key;
          return (
            <View key={f.key} style={styles.featureItem}>
              <View
                style={[
                  styles.featureDot,
                  { backgroundColor: on ? f.color : c.surface, borderColor: on ? f.color : c.border, transform: [{ scale: on ? 1.12 : 1 }] },
                ]}
              >
                <Icon name={f.icon} size={20} color={on ? '#FFFFFF' : f.color} />
              </View>
              <T size={11} weight={on ? '800' : '600'} color={on ? c.heading : c.textSecondary} align="center">
                {f.label}
              </T>
            </View>
          );
        })}
      </View>
    </View>
  );
}

function People() {
  const c = useAppTheme().colors;
  const who: { label: string; node: ReactNode }[] = [
    { label: 'Personas mayores', node: <GuideAvatar size={84} /> },
    { label: 'Varios medicamentos', node: <Bubble icon="medkit" color="#059669" bg="#D1FAE5" size={76} /> },
    { label: 'Familia y cuidadores', node: <Bubble icon="people" color="#D97706" bg="#FEF3C7" size={76} /> },
  ];
  return (
    <View style={styles.center}>
      <View style={styles.peopleRow}>
        {who.map((w, i) => (
          <FadeIn key={w.label} delay={i * 160} from="bottom" style={styles.peopleItem}>
            <View style={styles.peopleNode}>{w.node}</View>
            <T size={13} weight="700" align="center" lines={2}>
              {w.label}
            </T>
          </FadeIn>
        ))}
      </View>
      <View style={[styles.heartLine, { backgroundColor: c.surface }]}>
        <Icon name="heart" size={18} color="#E11D48" />
        <T size={13} weight="600" color={c.textSecondary}>
          Para acompañarte en el día a día
        </T>
      </View>
    </View>
  );
}

function Trust() {
  const c = useAppTheme().colors;
  return (
    <View style={styles.center}>
      <Pulse scale={1.04}>
        <Bubble icon="shield-checkmark" color="#FFFFFF" bg={c.successStrong} size={104} iconSize={54} />
      </Pulse>
      <View style={styles.chipsWrap}>
        <Chip icon="medkit" label="Tu médico" color="#1D4ED8" bg="#DBEAFE" />
        <Chip icon="storefront" label="Tu farmacéutico" color="#047857" bg="#D1FAE5" />
        <Chip icon="call" label="Emergencias 112" color="#B91C1C" bg="#FEE2E2" />
      </View>
    </View>
  );
}

function Premium() {
  const c = useAppTheme().colors;
  const gid = `prem${useId().replace(/[^A-Za-z0-9_-]/g, '')}`;
  return (
    <View style={styles.center}>
      <View style={styles.premiumCard}>
        <Svg width={250} height={120} style={StyleSheet.absoluteFill}>
          <Defs>
            <LinearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor="#1D4ED8" />
              <Stop offset="1" stopColor="#7C3AED" />
            </LinearGradient>
          </Defs>
          <Rect x="0" y="0" width="250" height="120" rx="22" fill={`url(#${gid})`} />
          <Circle cx="222" cy="22" r="40" fill="#FFFFFF" opacity={0.08} />
          <Circle cx="28" cy="112" r="34" fill="#FFFFFF" opacity={0.07} />
        </Svg>
        <Icon name="sparkles" size={34} color="#FDE68A" />
        <T size={22} weight="800" color="#FFFFFF">
          MediClaro Premium
        </T>
        <T size={13} weight="600" color="#E0E7FF">
          Funciones inteligentes
        </T>
      </View>
      <Panel style={styles.phoneRow}>
        <Bubble icon="phone-portrait" color={c.primary} bg={c.primarySoft} size={40} />
        <View style={styles.flex}>
          <T size={13} weight="700">Después del pago</T>
          <T size={12.5} color={c.textSecondary}>Completas tu acceso con tu teléfono</T>
        </View>
        <Icon name="checkmark-circle" size={22} color={c.successStrong} />
      </Panel>
    </View>
  );
}

function Steps() {
  const c = useAppTheme().colors;
  const steps: { icon: IconName; color: string; bg: string; label: string }[] = [
    { icon: 'camera', color: '#059669', bg: '#D1FAE5', label: 'Identificar' },
    { icon: 'chatbubbles', color: '#2563EB', bg: '#DBEAFE', label: 'Preguntar' },
    { icon: 'volume-high', color: '#7C3AED', bg: '#EDE9FE', label: 'Escuchar' },
    { icon: 'location', color: '#D97706', bg: '#FEF3C7', label: 'Emergencias' },
  ];
  return (
    <View style={styles.center}>
      <View style={styles.stepsGrid}>
        {steps.map((s, i) => (
          <FadeIn key={s.label} delay={i * 140} from="bottom" style={[styles.stepCell, { backgroundColor: c.surface }]}>
            <View>
              <Bubble icon={s.icon} color={s.color} bg={s.bg} size={50} />
              <View style={[styles.stepNumber, { backgroundColor: s.color, borderColor: c.surface }]}>
                <T size={12} weight="800" color="#FFFFFF">
                  {String(i + 1)}
                </T>
              </View>
            </View>
            <T size={14} weight="700">{s.label}</T>
          </FadeIn>
        ))}
      </View>
    </View>
  );
}

// ─── 1 · Identificar ─────────────────────────────────────────────────────────

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
      <G opacity={0.6}>
        <Rect x="14" y="74" width="92" height="112" rx="6" fill="#FFFFFF" stroke="#CBD5E1" />
        <Rect x="14" y="74" width="92" height="18" rx="6" fill="#2563EB" />
        <Rect x="26" y="106" width="56" height="8" rx="4" fill="#172554" />
        <Rect x="26" y="122" width="34" height="6" rx="3" fill="#94A3B8" />
        <Rect x="26" y="136" width="44" height="6" rx="3" fill="#CBD5E1" />
      </G>
      <G transform="rotate(-6 150 104)">
        <Rect x="92" y="10" width="126" height="190" rx="20" fill="#172554" />
        <Rect x="99" y="20" width="112" height="172" rx="14" fill="#0B1220" />
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
        <Path
          d="M107 50 L107 40 L119 40 M191 40 L203 40 L203 50 M203 154 L203 164 L191 164 M119 164 L107 164 L107 154"
          stroke="#60A5FA"
          strokeWidth="3"
          fill="none"
          strokeLinecap="round"
        />
        <Circle cx="155" cy="178" r="11" fill="#2563EB" stroke="#FFFFFF" strokeWidth="3" />
      </G>
    </Svg>
  );
}

function IdentifyPhoto() {
  return (
    <View style={styles.center}>
      <PhoneShotArt width={290} />
    </View>
  );
}

function IdentifyResult() {
  const c = useAppTheme().colors;
  return (
    <View style={styles.center}>
      <Panel style={styles.mock}>
        <ExampleTag style={styles.tagAnchor} />
        <View style={styles.row}>
          <Bubble icon="medkit" color="#059669" bg="#D1FAE5" size={46} />
          <View style={styles.flex}>
            <T size={18} weight="800">Paracetamol 500 mg</T>
            <T size={13} color={c.textSecondary}>Comprimidos</T>
          </View>
        </View>
        <View style={[styles.answerBox, { backgroundColor: c.primaryTint }]}>
          <T size={13} weight="700" color={c.primary}>¿Para qué sirve?</T>
          <T size={15} weight="600">Para el dolor leve o moderado y para bajar la fiebre.</T>
        </View>
      </Panel>
    </View>
  );
}

function IdentifyOfficial() {
  const c = useAppTheme().colors;
  return (
    <View style={styles.center}>
      <InfoIllustration size={190} />
      <View style={[styles.sourceChip, { backgroundColor: c.successSoft }]}>
        <Icon name="shield-checkmark" size={18} color={c.successStrong} />
        <T size={13.5} weight="700" color={c.successText}>Fuente oficial: CIMA · AEMPS</T>
      </View>
    </View>
  );
}

// ─── 2 · Asistente ───────────────────────────────────────────────────────────

function TypingDots() {
  const c = useAppTheme().colors;
  const t = useRef(new Animated.Value(0)).current;
  const reduce = useReduceMotion();
  useEffect(() => {
    if (reduce) return undefined;
    const loop = Animated.loop(Animated.timing(t, { toValue: 1, duration: 900, easing: Easing.linear, useNativeDriver: NATIVE }));
    loop.start();
    return () => loop.stop();
  }, [t, reduce]);
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

/** La misma conversación avanza: pregunta → «escribiendo» → respuesta. */
function Chat({ answered }: { answered: boolean }) {
  const c = useAppTheme().colors;
  return (
    <View style={styles.chat}>
      <ExampleTag style={styles.tagTop} />
      <FadeIn from="right">
        <View style={[styles.userBubble, { backgroundColor: c.primary }]}>
          <T size={16} weight="600" color="#FFFFFF">¿Para qué sirve este medicamento?</T>
        </View>
      </FadeIn>
      <View style={styles.botRow}>
        <GuideAvatar size={44} ai />
        <Appear id={answered ? 'answer' : 'typing'} from="left" style={styles.flexShrink}>
          <View style={[styles.botBubble, { backgroundColor: c.surface }]}>
            {answered ? (
              <T size={15}>Sirve para aliviar el dolor leve o moderado y para bajar la fiebre. Te explico cómo tomarlo, de forma sencilla.</T>
            ) : (
              <TypingDots />
            )}
          </View>
        </Appear>
      </View>
    </View>
  );
}

function AssistantLimits() {
  const c = useAppTheme().colors;
  return (
    <View style={styles.center}>
      <View style={styles.row}>
        <GuideAvatar size={56} ai />
        <View style={[styles.botBubble, styles.flexShrink, { backgroundColor: c.surface }]}>
          <T size={14.5}>Si tienes dudas, consulta a tu médico o farmacéutico.</T>
        </View>
      </View>
      <View style={styles.prosRow}>
        <View style={styles.pro}>
          <Bubble icon="medkit" color="#1D4ED8" bg="#DBEAFE" size={72} />
          <T size={13.5} weight="700">Tu médico</T>
        </View>
        <View style={styles.pro}>
          <Bubble icon="storefront" color="#047857" bg="#D1FAE5" size={72} />
          <T size={13.5} weight="700">Tu farmacéutico</T>
        </View>
      </View>
    </View>
  );
}

// ─── 3 · Escuchar ────────────────────────────────────────────────────────────

function VoiceRead({ playing }: { playing: boolean }) {
  const c = useAppTheme().colors;
  return (
    <View style={styles.center}>
      <Panel style={styles.mock}>
        <ExampleTag style={styles.tagAnchor} />
        <View style={styles.row}>
          <Bubble icon="document-text" color="#7C3AED" bg="#EDE9FE" size={46} />
          <View style={styles.flex}>
            <T size={18} weight="800">Prospecto</T>
            <T size={13} color={c.textSecondary}>Leyendo: ¿Para qué sirve?</T>
          </View>
        </View>
        {[0.94, 0.8, 0.88, 0.56].map((w, i) => (
          <View key={i} style={[styles.line, { width: `${Math.round(w * 100)}%`, backgroundColor: i === 0 ? '#C4B5FD' : c.surfaceMuted }]} />
        ))}
        <View style={styles.row}>
          <Pulse active={playing}>
            <Bubble icon={playing ? 'pause' : 'play'} color="#FFFFFF" bg="#7C3AED" size={54} iconSize={26} />
          </Pulse>
          <View style={styles.flex}>
            <Waveform active={playing} bars={18} height={36} color="#7C3AED" />
          </View>
        </View>
      </Panel>
    </View>
  );
}

// ─── 4 · Emergencias ─────────────────────────────────────────────────────────

function EmergencyAlert() {
  const c = useAppTheme().colors;
  return (
    <View style={styles.center}>
      <FadeIn from="top" distance={30}>
        <Panel style={styles.notice}>
          <View style={styles.row}>
            <View style={[styles.appIcon, { backgroundColor: c.primarySoft }]}>
              <MediClaroMark size={26} accessibilityLabel="" />
            </View>
            <T size={12} weight="700" color={c.textSecondary} style={styles.flex}>MEDICLARO · ahora</T>
            <ExampleTag />
          </View>
          <T size={16} weight="800">Aviso de malestar</T>
          <T size={14} color={c.textSecondary}>Carmen dice que no se encuentra bien. Abre el chat para comprobar cómo está.</T>
        </Panel>
      </FadeIn>
      <View style={styles.flowRow}>
        <GuideAvatar size={52} />
        <Icon name="arrow-forward" size={24} color={c.textMuted} />
        <Pulse>
          <Bubble icon="notifications" color="#FFFFFF" bg="#D97706" size={52} iconSize={26} />
        </Pulse>
        <Icon name="arrow-forward" size={24} color={c.textMuted} />
        <Bubble icon="people" color="#D97706" bg="#FEF3C7" size={52} />
      </View>
    </View>
  );
}

function EmergencyChat() {
  const c = useAppTheme().colors;
  return (
    <View style={styles.chat}>
      <View style={[styles.chatHead, { backgroundColor: c.dangerSoft }]}>
        <View style={[styles.liveDot, { backgroundColor: c.danger }]} />
        <T size={13} weight="800" color={c.dangerText} style={styles.flex}>Chat del aviso</T>
        <ExampleTag />
      </View>
      <FadeIn from="left" delay={150}>
        <View style={styles.botRow}>
          <Bubble icon="people" color="#D97706" bg="#FEF3C7" size={38} />
          <View style={[styles.botBubble, styles.flexShrink, { backgroundColor: c.surface }]}>
            <T size={15}>Hola, Carmen. ¿Cómo estás? ¿Necesitas ayuda?</T>
          </View>
        </View>
      </FadeIn>
      <FadeIn from="right" delay={900}>
        <View style={[styles.userBubble, { backgroundColor: c.primary }]}>
          <T size={15} weight="600" color="#FFFFFF">Me he mareado un poco, pero ya estoy sentada.</T>
        </View>
      </FadeIn>
    </View>
  );
}

function EmergencyLocation() {
  const c = useAppTheme().colors;
  return (
    <View style={styles.center}>
      <View style={styles.map}>
        <Svg width={280} height={170} viewBox="0 0 280 170">
          <Rect x="0" y="0" width="280" height="170" rx="22" fill="#EAF2E3" />
          <Path d="M0 120 C 60 100, 110 140, 180 112 S 260 92, 280 98 L280 170 L0 170 Z" fill="#DCEBD0" />
          <Rect x="186" y="18" width="70" height="46" rx="12" fill="#C9E4B4" />
          <Line x1="0" y1="62" x2="280" y2="78" stroke="#FFFFFF" strokeWidth="12" />
          <Line x1="96" y1="0" x2="120" y2="170" stroke="#FFFFFF" strokeWidth="10" />
          <Line x1="210" y1="70" x2="232" y2="170" stroke="#FFFFFF" strokeWidth="8" />
          <Line x1="0" y1="140" x2="110" y2="128" stroke="#FFFFFF" strokeWidth="7" />
        </Svg>
        <View style={[styles.abs, styles.pin]}>
          <Pulse scale={1.08}>
            <Bubble icon="location" color="#FFFFFF" bg="#D97706" size={56} iconSize={30} />
          </Pulse>
        </View>
      </View>
      <View style={styles.chipsWrap}>
        <Chip icon="navigate" label="Ubicación compartida" color="#B45309" bg="#FEF3C7" />
        <Chip icon="hand-left" label="Solo con tu permiso" color={c.successText} bg={c.successSoft} />
      </View>
    </View>
  );
}

function EmergencyRepeat() {
  const c = useAppTheme().colors;
  return (
    <View style={styles.center}>
      <View>
        <Pulse scale={1.05}>
          <Bubble icon="notifications" color="#FFFFFF" bg="#D97706" size={92} iconSize={46} />
        </Pulse>
        <View style={[styles.badge, { backgroundColor: c.danger, borderColor: c.surface }]}>
          <T size={15} weight="800" color="#FFFFFF">2</T>
        </View>
      </View>
      <Panel style={styles.timeline}>
        <View style={styles.row}>
          <Icon name="time" size={18} color={c.textMuted} />
          <T size={13.5} color={c.textSecondary} style={styles.flex}>Mensaje de comprobación: sin respuesta</T>
        </View>
        <View style={styles.row}>
          <Icon name="notifications" size={18} color="#D97706" />
          <T size={13.5} weight="700" style={styles.flex}>Se envía otro aviso a tu cuidador</T>
        </View>
      </Panel>
    </View>
  );
}

function Emergency112() {
  const c = useAppTheme().colors;
  return (
    <View style={styles.center}>
      <EmergencyIllustration size={170} />
      <View style={styles.chipsWrap}>
        <Chip icon="hand-left" label="Llamada manual" color="#B91C1C" bg="#FEE2E2" />
        <Chip icon="close-circle" label="Sin llamadas automáticas" color={c.textSecondary} bg={c.surfaceMuted} />
      </View>
    </View>
  );
}

function EmergencyCall() {
  const c = useAppTheme().colors;
  const phone = (label: string, avatar: ReactNode) => (
    <View style={styles.pro}>
      <View style={[styles.phone, { borderColor: '#172554', backgroundColor: c.surface }]}>{avatar}</View>
      <T size={13} weight="700">{label}</T>
    </View>
  );
  return (
    <View style={styles.center}>
      <View style={styles.callRow}>
        {phone('Tú', <GuideAvatar size={44} ring={false} />)}
        <View style={styles.callMiddle}>
          <Icon name="wifi" size={30} color={c.primary} />
          <Pulse>
            <Bubble icon="call" color="#FFFFFF" bg={c.successStrong} size={52} iconSize={26} />
          </Pulse>
        </View>
        {phone('Tu cuidador', <Bubble icon="people" color="#D97706" bg="#FEF3C7" size={44} />)}
      </View>
      <Chip icon="phone-portrait" label="Disponible en los dos teléfonos" color={c.primary} bg={c.primarySoft} />
    </View>
  );
}

function EmergencyLimits() {
  const c = useAppTheme().colors;
  return (
    <View style={styles.center}>
      <Panel style={styles.mock}>
        <View style={styles.row}>
          <Bubble icon="shield-checkmark" color={c.primary} bg={c.primarySoft} size={46} />
          <View style={styles.flex}>
            <T size={16} weight="800">Servicios de emergencia</T>
            <T size={13} color={c.textSecondary}>Ante una urgencia, siempre ellos</T>
          </View>
        </View>
        <View style={[styles.sos, { backgroundColor: c.danger }]}>
          <Icon name="call" size={24} color="#FFFFFF" />
          <T size={20} weight="800" color="#FFFFFF">112</T>
        </View>
      </Panel>
    </View>
  );
}

function Final() {
  return (
    <View style={styles.center}>
      <GuideIllustration size={220} />
    </View>
  );
}

// ─── Selección ───────────────────────────────────────────────────────────────

export type TourVisualId = TourSceneId | 'final';

/**
 * Imágenes que comparten dibujo (las cinco ayudas, la conversación con el asistente): al pasar de una a otra no
 * se cambia toda la imagen, solo se ilumina lo nuevo.
 */
export function visualKeyOf(id: TourVisualId): string {
  if (id.startsWith('feature')) return 'features';
  if (id === 'assistantAsk' || id === 'assistantAnswer') return 'chat';
  return id;
}

export const SceneVisual = memo(function SceneVisual({ id, playing }: { id: TourVisualId; playing: boolean }) {
  switch (id) {
    case 'welcome':
      return <Welcome />;
    case 'problem':
      return <Problem />;
    case 'together':
      return <Together />;
    case 'featurePhoto':
    case 'featureAsk':
    case 'featureListen':
    case 'featureSave':
    case 'featureReady':
      return <Features focus={id} />;
    case 'people':
      return <People />;
    case 'trust':
      return <Trust />;
    case 'premium':
      return <Premium />;
    case 'steps':
      return <Steps />;
    case 'identifyPhoto':
      return <IdentifyPhoto />;
    case 'identifyResult':
      return <IdentifyResult />;
    case 'identifyOfficial':
      return <IdentifyOfficial />;
    case 'assistantAsk':
      return <Chat answered={false} />;
    case 'assistantAnswer':
      return <Chat answered />;
    case 'assistantLimits':
      return <AssistantLimits />;
    case 'voiceRead':
      return <VoiceRead playing={playing} />;
    case 'emergencyAlert':
      return <EmergencyAlert />;
    case 'emergencyChat':
      return <EmergencyChat />;
    case 'emergencyLocation':
      return <EmergencyLocation />;
    case 'emergencyRepeat':
      return <EmergencyRepeat />;
    case 'emergency112':
      return <Emergency112 />;
    case 'emergencyCall':
      return <EmergencyCall />;
    case 'emergencyLimits':
      return <EmergencyLimits />;
    case 'final':
      return <Final />;
    default: {
      // Cada escena del guion necesita su imagen (si falta una, TypeScript avisa aquí).
      const missing: never = id;
      return missing;
    }
  }
});

/** Ajusta el lienzo de 320 × 260 al hueco disponible (sin deformar). */
export function SceneFit({ width, height, children }: { width: number; height: number; children: ReactNode }) {
  const scale = Math.max(0.55, Math.min(width / SCENE_W, height / SCENE_H, 1.4));
  const w = SCENE_W * scale;
  const h = SCENE_H * scale;
  return (
    <View style={{ width: w, height: h }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <View style={[styles.canvas, { left: (w - SCENE_W) / 2, top: (h - SCENE_H) / 2, transform: [{ scale }] }]}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  flexShrink: { flexShrink: 1 },
  canvas: { position: 'absolute', width: SCENE_W, height: SCENE_H },
  center: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', gap: 14 },
  abs: { position: 'absolute' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  tag: { paddingHorizontal: 8, paddingVertical: 1, borderRadius: 999, borderWidth: 1 },
  tagAnchor: { position: 'absolute', top: -11, right: 14, zIndex: 1 },
  tagTop: { alignSelf: 'flex-end' },
  panel: { padding: 14, gap: 10 },
  mock: { width: 292, gap: 12, paddingTop: 16 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999 },
  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8, maxWidth: 310 },
  hub: { width: 112, height: 112, borderRadius: 56, alignItems: 'center', justifyContent: 'center', borderWidth: 4, borderColor: '#DBEAFE' },
  featureHalo: { width: 148, height: 148, borderRadius: 74, alignItems: 'center', justifyContent: 'center' },
  featureRow: { flexDirection: 'row', gap: 6, marginTop: 4 },
  featureItem: { width: 60, alignItems: 'center', gap: 4 },
  featureDot: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', borderWidth: 2 },
  peopleRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  peopleItem: { width: 96, alignItems: 'center', gap: 8 },
  peopleNode: { height: 86, justifyContent: 'center' },
  heartLine: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999 },
  premiumCard: { width: 250, height: 120, borderRadius: 22, alignItems: 'center', justifyContent: 'center', gap: 2, overflow: 'hidden' },
  phoneRow: { width: 270, flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10 },
  stepsGrid: { width: 300, flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'center' },
  stepCell: { width: 140, height: 104, borderRadius: 18, alignItems: 'center', justifyContent: 'center', gap: 6 },
  stepNumber: { position: 'absolute', right: -6, top: -6, width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 2 },
  answerBox: { padding: 12, borderRadius: 14, gap: 4 },
  sourceChip: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999 },
  chat: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, justifyContent: 'center', gap: 12, paddingHorizontal: 6 },
  userBubble: { alignSelf: 'flex-end', maxWidth: '86%', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 18, borderBottomRightRadius: 6 },
  botRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  botBubble: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 18, borderBottomLeftRadius: 6 },
  dots: { flexDirection: 'row', gap: 6, paddingVertical: 8, paddingHorizontal: 4 },
  dot: { width: 9, height: 9, borderRadius: 5 },
  prosRow: { flexDirection: 'row', gap: 36 },
  pro: { alignItems: 'center', gap: 6 },
  line: { height: 10, borderRadius: 5 },
  notice: { width: 296, gap: 4 },
  appIcon: { width: 32, height: 32, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  flowRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  chatHead: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 14 },
  liveDot: { width: 10, height: 10, borderRadius: 5 },
  map: { width: 280, height: 170, borderRadius: 22, overflow: 'hidden' },
  pin: { left: 140 - 28, top: 85 - 40 },
  badge: { position: 'absolute', right: -4, top: -4, width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', borderWidth: 3 },
  timeline: { width: 290, gap: 10 },
  callRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  callMiddle: { alignItems: 'center', gap: 6 },
  phone: { width: 76, height: 124, borderRadius: 18, borderWidth: 5, alignItems: 'center', justifyContent: 'center' },
  sos: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, height: 54, borderRadius: 16 },
});
