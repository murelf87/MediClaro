/**
 * «Cómo funciona» de Cuidador y avisos: siete pasos con dibujo (los mismos de «Conocer MediClaro») y la voz de
 * MediClaro (Sulafat) contándolos, grabada e incluida en la app: sin servidor, sin red y sin la voz del teléfono.
 * La grabación (assets/audio/tour-emergency-sulafat.wav) dice exactamente el texto de cada paso, y las imágenes
 * cambian con la voz. Sin voz, se pueden pasar los pasos a mano.
 */
import { useCallback, useEffect, useState } from 'react';
import { AppState, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { AppText, Card, Icon, PrimaryButton, TextButton, Waveform } from '../../components';
import { GuideAvatar } from '../../components/Guide';
import { useAppTheme, usePreferences } from '../../hooks';
import { useTourPresentation } from '../../hooks/useTourPresentation';
import { CARE_EXPLAIN_TRACK } from '../../config/tourAudio';
import { SceneFit, SceneVisual } from '../premium/TourScenes';
import { CARE_EXPLAIN_DURATION, CARE_STEPS, careStepAt } from './careSteps';

export { CARE_STEPS, careStepAt } from './careSteps';

function useAppActive(): boolean {
  const [active, setActive] = useState(AppState.currentState !== 'background' && AppState.currentState !== 'inactive');
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => setActive(state === 'active'));
    return () => sub.remove();
  }, []);
  return active;
}

export function CareHowItWorks({ caregiverSide, testID = 'caregiver-how' }: { caregiverSide: boolean; testID?: string }) {
  const theme = useAppTheme();
  const c = theme.colors;
  const { prefs } = usePreferences();
  const appActive = useAppActive();
  const [focused, setFocused] = useState(true);
  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      return () => setFocused(false);
    }, []),
  );
  const [listening, setListening] = useState(false);
  const [manual, setManual] = useState(0);
  const [stage, setStage] = useState({ width: 0, height: 0 });
  const show = useTourPresentation({ source: CARE_EXPLAIN_TRACK, rate: prefs.speechRate, active: listening && focused && appActive, soundOn: true, duration: CARE_EXPLAIN_DURATION });

  // Con la voz, el paso lo marca la grabación; si no, el que se haya elegido a mano.
  const index = listening && !show.finished ? careStepAt(show.position) : manual;
  const step = CARE_STEPS[Math.min(index, CARE_STEPS.length - 1)];
  useEffect(() => {
    if (listening && !show.finished) setManual(careStepAt(show.position));
  }, [listening, show.finished, show.position]);

  const listen = () => {
    if (!listening) {
      setListening(true);
      show.seek(CARE_STEPS[manual].at);
      return;
    }
    if (show.finished) {
      setManual(0);
      show.restart();
      return;
    }
    if (show.paused) show.resume();
    else show.pause();
  };
  const go = (delta: number) => {
    const next = Math.max(0, Math.min(CARE_STEPS.length - 1, index + delta));
    setManual(next);
    if (listening) show.seek(CARE_STEPS[next].at);
  };

  const playing = listening && !show.paused && !show.finished;
  const buttonLabel = !listening ? 'Escuchar cómo funciona' : show.finished ? 'Escuchar otra vez' : show.loading ? 'Preparando la voz…' : show.paused ? 'Seguir escuchando' : 'Pausar';
  const buttonIcon = !listening || show.finished ? 'volume-high' : show.paused ? 'play' : 'pause';
  const voiceStatus = show.voiceError
    ? 'La voz no se ha podido reproducir: pasa los pasos a mano.'
    : playing
      ? 'Te lo cuenta la voz de MediClaro'
      : listening && show.paused
        ? 'En pausa'
        : caregiverSide
          ? 'La voz se lo explica a la persona a la que cuidas: tú recibes esos avisos.'
          : 'Con la voz de MediClaro o pasando los pasos a mano.';

  return (
    <Card style={styles.card} testID={testID}>
      <View style={styles.head}>
        <View style={[styles.headIcon, { backgroundColor: c.primaryTint }]}>
          <Icon name="help-circle" size={26} color={c.primary} />
        </View>
        <View style={styles.flex}>
          <AppText variant="subheading" color="heading" accessibilityRole="header">Cómo funciona</AppText>
          <AppText variant="caption" color="textSecondary">{voiceStatus}</AppText>
        </View>
      </View>

      <View
        style={[styles.stage, { backgroundColor: c.primaryTint, borderRadius: theme.radius.lg }]}
        onLayout={(e: LayoutChangeEvent) => setStage({ width: Math.round(e.nativeEvent.layout.width), height: Math.round(e.nativeEvent.layout.height) })}
        accessible
        accessibilityRole="image"
        accessibilityLabel={`Dibujo del paso ${index + 1}: ${step.title}`}
        testID={`${testID}-stage`}
      >
        {stage.width > 0 ? (
          <SceneFit width={stage.width - 8} height={stage.height - 8}>
            <SceneVisual id={step.id} playing={playing} />
          </SceneFit>
        ) : null}
      </View>

      <View style={styles.caption} accessibilityLiveRegion="polite">
        <AppText variant="captionStrong" color="primary" style={styles.upper}>{`Paso ${index + 1} de ${CARE_STEPS.length}`}</AppText>
        <AppText variant="subheading" color="heading" testID={`${testID}-title`}>{step.title}</AppText>
        <AppText variant="body" color="textSecondary">{step.text}</AppText>
      </View>

      <View style={styles.dots} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        {CARE_STEPS.map((s, i) => (
          <View key={s.id} style={[styles.dot, { backgroundColor: i === index ? c.primary : c.primarySoft }, i === index ? styles.dotOn : null]} />
        ))}
      </View>

      <View style={styles.voiceRow}>
        <GuideAvatar size={40} />
        <View style={styles.flex}>
          <Waveform active={playing} bars={18} height={22} color={c.primary} />
        </View>
      </View>
      <PrimaryButton label={buttonLabel} icon={buttonIcon} onPress={listen} disabled={show.voiceError && !listening} testID={`${testID}-listen`} />
      <View style={styles.nav}>
        <TextButton label="Anterior" icon="chevron-back" onPress={() => go(-1)} disabled={index === 0} testID={`${testID}-prev`} />
        <TextButton label="Siguiente" icon="chevron-forward" onPress={() => go(1)} disabled={index === CARE_STEPS.length - 1} testID={`${testID}-next`} />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  card: { gap: 12 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headIcon: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  stage: { height: 200, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  caption: { gap: 4 },
  upper: { textTransform: 'uppercase', letterSpacing: 0.6 },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  dotOn: { width: 22 },
  voiceRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  nav: { flexDirection: 'row', justifyContent: 'space-between' },
});
