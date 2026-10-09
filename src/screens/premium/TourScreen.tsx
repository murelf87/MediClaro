/**
 * /tour — «Conocer MediClaro», SIN registrarse. También /onboarding (Ayuda → «Ver cómo funciona»).
 *
 * Una presentación continua, no tarjetas: UNA sola voz (Sulafat) cuenta todo de principio a fin en UNA sola toma
 * (sin partes unidas: ni cambios de tono ni cortes) y las imágenes van cambiando mientras habla, cada una en la
 * frase que le toca.
 *  - Abajo, «la voz»: la guía de MediClaro con su onda, y un botón grande para pausar o continuar.
 *  - Arriba, una barra de progreso continua (sin partes).
 *  - Sin voz (altavoz tachado) las imágenes siguen pasando solas al mismo ritmo.
 *  - Ejemplos visuales marcados como «Ejemplo» (sin IA real ni datos reales).
 *  - Al terminar: sin Premium → planes; con Premium → vuelve; sin compras en la app → acceso con teléfono.
 */
import { useCallback, useEffect, useState } from 'react';
import { Animated, AppState, Easing, Platform, Pressable, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { AppText, Icon, PrimaryButton, Screen, TextButton, Waveform } from '../../components';
import { FadeIn, useReduceMotion } from '../../components/Motion';
import { GuideAvatar } from '../../components/Guide';
import { TOUR_CHAPTERS, TOUR_TIMELINE, sceneIndexAt, tourProgress, tourScene } from '../../config/tour';
import { TOUR_TRACK } from '../../config/tourAudio';
import { useAppTheme, useEntitlement, usePreferences, useSession } from '../../hooks';
import { useTourPresentation } from '../../hooks/useTourPresentation';
import { SceneFit, SceneVisual, visualKeyOf, type TourVisualId } from './TourScenes';

const NATIVE = Platform.OS !== 'web';

/** La app está en primer plano (al bloquear el móvil o cambiar de app, la explicación se para). */
function useAppActive(): boolean {
  const [active, setActive] = useState(AppState.currentState !== 'background' && AppState.currentState !== 'inactive');
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => setActive(state === 'active'));
    return () => sub.remove();
  }, []);
  return active;
}

interface Layer {
  n: number;
  key: string;
  visual: TourVisualId;
  anim: Animated.Value;
}

let layerCounter = 0;

/** Escenario: la imagen nueva entra con un fundido suave mientras la anterior se desvanece. */
function Stage({ visual, playing, width, height }: { visual: TourVisualId; playing: boolean; width: number; height: number }) {
  const reduce = useReduceMotion();
  const key = visualKeyOf(visual);
  const [layers, setLayers] = useState<Layer[]>(() => [{ n: (layerCounter += 1), key, visual, anim: new Animated.Value(1) }]);

  useEffect(() => {
    setLayers((prev) => {
      const top = prev[prev.length - 1];
      if (top.key === key) return top.visual === visual ? prev : [...prev.slice(0, -1), { ...top, visual }];
      return [...prev.slice(-1), { n: (layerCounter += 1), key, visual, anim: new Animated.Value(reduce ? 1 : 0) }];
    });
  }, [key, visual, reduce]);

  const top = layers[layers.length - 1];
  useEffect(() => {
    if (layers.length < 2) return undefined;
    const anim = Animated.timing(top.anim, { toValue: 1, duration: reduce ? 0 : 520, easing: Easing.out(Easing.cubic), useNativeDriver: NATIVE });
    anim.start(({ finished }) => {
      if (finished) setLayers((prev) => (prev[prev.length - 1] === top ? [top] : prev));
    });
    return () => anim.stop();
    // Solo cuando entra una capa nueva.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [top.n]);

  return (
    <View style={{ width, height }} pointerEvents="none">
      {layers.map((layer, i) => {
        const next = layers[i + 1];
        const opacity = next ? next.anim.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }) : layer.anim;
        const translateY = next ? 0 : layer.anim.interpolate({ inputRange: [0, 1], outputRange: [16, 0] });
        const scale = next
          ? next.anim.interpolate({ inputRange: [0, 1], outputRange: [1, 0.97] })
          : layer.anim.interpolate({ inputRange: [0, 1], outputRange: [0.97, 1] });
        return (
          <Animated.View key={layer.n} style={[StyleSheet.absoluteFill, styles.layer, { opacity, transform: [{ translateY }, { scale }] }]}>
            <SceneFit width={width} height={height}>
              <SceneVisual id={layer.visual} playing={playing} />
            </SceneFit>
          </Animated.View>
        );
      })}
    </View>
  );
}

/** Barra de progreso de la explicación: una sola, continua (sin partes). */
function ProgressBar({ progress, color }: { progress: number; color: string }) {
  const theme = useAppTheme();
  const pct = Math.round(progress * 100);
  return (
    <View
      style={[styles.track, { backgroundColor: theme.highContrast ? theme.colors.borderStrong : 'rgba(29, 78, 216, 0.16)' }]}
      accessible
      role="progressbar"
      aria-label="Progreso de la explicación"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={pct}
      testID="tour-progress"
    >
      <View style={{ width: `${pct}%`, height: '100%', borderRadius: 4, backgroundColor: color }} />
    </View>
  );
}

export default function TourScreen() {
  const router = useRouter();
  const theme = useAppTheme();
  const c = theme.colors;
  const { prefs, markOnboardingSeen } = usePreferences();
  const { status } = useSession();
  const entitlement = useEntitlement();
  const appActive = useAppActive();
  const [focused, setFocused] = useState(true);
  const [soundOn, setSoundOn] = useState(true);
  const [stage, setStage] = useState({ width: 0, height: 0 });

  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      return () => setFocused(false);
    }, []),
  );

  const timeline = TOUR_TIMELINE;
  const show = useTourPresentation({ source: TOUR_TRACK, rate: prefs.speechRate, active: focused && appActive, soundOn, duration: timeline.duration });

  const chapter = TOUR_CHAPTERS[0];
  const sceneId = timeline.scenes[sceneIndexAt(timeline, show.position)].id;
  const visual: TourVisualId = show.finished ? 'final' : sceneId;

  // Se puede contratar Premium dentro de la app (compras activas y el servidor puede cobrar).
  const sell = entitlement.canSell;
  const hasPremium = status === 'signedIn' && (entitlement.isPremium || !entitlement.required);
  const finishLabel = !sell ? 'Empezar' : hasPremium ? 'Terminar' : 'Ver planes';
  const scene = tourScene(sceneId);
  const caption = show.finished ? 'Ya conoces MediClaro' : scene.caption;
  const detail = show.finished
    ? !sell
      ? 'Cuando quieras, empieza a usarlo.'
      : hasPremium
        ? 'Ya puedes usar todas sus funciones.'
        : 'Mira los planes de MediClaro Premium.'
    : scene.detail;

  const leave = useCallback(() => {
    show.pause();
    void markOnboardingSeen().catch(() => undefined);
  }, [markOnboardingSeen, show.pause]);

  const finish = () => {
    leave();
    if (!sell) {
      if (status === 'signedIn') {
        if (router.canGoBack()) router.back();
        else router.replace('/(tabs)');
      } else {
        router.replace('/login');
      }
      return;
    }
    if (hasPremium) {
      if (router.canGoBack()) router.back();
      else router.replace('/(tabs)');
      return;
    }
    router.push('/premium');
  };

  /** «Saltar la explicación»: con sesión vuelve de donde venía (p. ej. Ayuda); sin sesión, a los planes. */
  const skip = () => {
    leave();
    if (status === 'signedIn') {
      if (router.canGoBack()) router.back();
      else router.replace('/(tabs)');
    } else if (!sell) {
      router.replace('/login');
    } else {
      router.push('/premium');
    }
  };

  const back = () => {
    show.pause();
    if (router.canGoBack()) router.back();
    else router.replace(status === 'signedIn' ? '/(tabs)' : '/welcome');
  };

  const togglePaused = () => (show.paused ? show.resume() : show.pause());

  const onStageLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setStage((s) => (Math.abs(s.width - width) < 1 && Math.abs(s.height - height) < 1 ? s : { width, height }));
  };

  const narratorStatus = show.finished
    ? 'Fin de la explicación'
    : show.paused
      ? 'En pausa'
      : !soundOn
        ? 'Sin voz: las imágenes siguen solas'
        : show.voiceError
          ? 'Voz no disponible'
          : show.loading
            ? 'Preparando la voz…'
            : 'Te lo cuenta la voz de MediClaro';

  const header = (
    <View style={[styles.header, { minHeight: theme.layout.headerHeight, paddingHorizontal: theme.spacing.xs }]}>
      <Pressable
        onPress={back}
        accessibilityRole="button"
        accessibilityLabel="Volver"
        hitSlop={8}
        style={({ pressed }) => [styles.headerBtn, { opacity: pressed ? 0.6 : 1 }]}
        testID="tour-back"
      >
        <Icon name="chevron-back" size={30} color={c.heading} />
      </Pressable>
      <View style={styles.flex}>
        <ProgressBar progress={show.finished ? 1 : tourProgress(timeline, show.position)} color={chapter.color} />
      </View>
      <Pressable
        onPress={() => setSoundOn((v) => !v)}
        accessibilityRole="switch"
        accessibilityState={{ checked: soundOn }}
        accessibilityLabel="Voz de la explicación"
        hitSlop={8}
        style={({ pressed }) => [
          styles.headerBtn,
          styles.round,
          { backgroundColor: soundOn ? c.primaryTint : c.surfaceAlt, opacity: pressed ? 0.7 : 1 },
        ]}
        testID="tour-sound"
      >
        <Icon name={soundOn ? 'volume-high' : 'volume-mute'} size={24} color={soundOn ? c.primary : c.textMuted} />
      </Pressable>
    </View>
  );

  // El pie lleva el mismo margen lateral que el resto de la pantalla (los botones no tocan los bordes).
  const footer = show.finished ? (
    <View style={{ gap: theme.spacing.xs, paddingHorizontal: theme.layout.screenPaddingH }}>
      <PrimaryButton label={finishLabel} icon="arrow-forward" iconPosition="right" onPress={finish} testID="tour-finish" />
      <TextButton label="Ver otra vez" icon="refresh-outline" onPress={show.restart} testID="tour-replay" />
    </View>
  ) : (
    <View style={{ gap: theme.spacing.xxs, paddingHorizontal: theme.layout.screenPaddingH }}>
      <View style={[styles.narrator, { backgroundColor: c.surface, borderRadius: theme.radius.xl }, theme.shadow.card]}>
        <View style={[styles.avatarRing, { borderColor: show.speaking ? chapter.color : 'transparent' }]}>
          <GuideAvatar size={46} />
        </View>
        <View style={styles.narratorText}>
          <AppText variant="captionStrong" color="heading" numberOfLines={2} testID="tour-voice-status">
            {narratorStatus}
          </AppText>
          {soundOn && !show.voiceError ? <Waveform active={show.speaking} bars={16} height={22} color={chapter.color} /> : null}
        </View>
        <Pressable
          onPress={togglePaused}
          accessibilityRole="button"
          accessibilityLabel={show.paused ? 'Continuar la explicación' : 'Pausar la explicación'}
          testID="tour-pause"
          style={({ pressed }) => [styles.playBtn, { backgroundColor: pressed ? c.primaryPressed : c.primary }, theme.shadow.button]}
        >
          <Icon name={show.paused ? 'play' : 'pause'} size={30} color="#FFFFFF" />
        </Pressable>
      </View>
      {show.voiceError && soundOn ? (
        <View style={styles.errorRow}>
          <AppText variant="caption" color="dangerText" align="center">
            No se ha podido reproducir la voz. La explicación sigue con las imágenes.
          </AppText>
          <TextButton label="Reintentar voz" icon="refresh-outline" onPress={show.retryVoice} testID="tour-voice-retry" />
        </View>
      ) : null}
      <View style={styles.actions}>
        <TextButton label="Empezar de nuevo" icon="refresh-outline" onPress={show.restart} testID="tour-replay" />
        <TextButton label="Saltar" tone="muted" onPress={skip} testID="tour-skip" accessibilityHint="Sale de la explicación" />
      </View>
    </View>
  );

  return (
    <Screen scroll={false} padded={false} header={header} footer={footer} gradient="soft" testID="tour-screen">
      <View style={[styles.body, { paddingHorizontal: theme.layout.screenPaddingH }]}>
        <View style={styles.stage} onLayout={onStageLayout} testID="tour-stage">
          {stage.width > 0 ? <Stage visual={visual} playing={show.speaking} width={stage.width} height={stage.height} /> : null}
        </View>
        <View style={styles.captionBox} accessibilityLiveRegion="polite" testID={`tour-scene-${visual}`}>
          <FadeIn key={visual} from="bottom" distance={8} duration={360}>
            <AppText variant="title" align="center" accessibilityRole="header">
              {caption}
            </AppText>
            <AppText variant="body" color="textSecondary" align="center" style={{ marginTop: theme.spacing.xxs }}>
              {detail}
            </AppText>
          </FadeIn>
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerBtn: { minWidth: 48, minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  round: { borderRadius: 24 },
  track: { height: 8, borderRadius: 4, overflow: 'hidden', marginHorizontal: 2 },
  body: { flex: 1 },
  stage: { flex: 1, minHeight: 110, alignItems: 'center', justifyContent: 'center' },
  layer: { alignItems: 'center', justifyContent: 'center' },
  // El texto nunca se recorta: si falta sitio, encoge el dibujo de arriba (flexShrink 0 aquí).
  captionBox: { minHeight: 96, flexShrink: 0, justifyContent: 'center', paddingBottom: 6 },
  narrator: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, paddingLeft: 10, paddingRight: 10 },
  avatarRing: { borderWidth: 3, borderRadius: 30, padding: 2 },
  narratorText: { flex: 1, gap: 4, minWidth: 0 },
  playBtn: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center' },
  errorRow: { alignItems: 'center' },
  actions: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
});
