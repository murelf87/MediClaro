/**
 * /voice?id=<id>&name=<nombre> — Lectura en voz alta (referencia 08_voice).
 * Lee los MISMOS textos que la ficha: Qué es · Para qué se utiliza · Cómo tomarlo · Advertencias.
 * Sin resumen sencillo, lee el prospecto oficial por apartados (los primeros, hasta unos minutos de audio:
 * el texto completo sigue en la ficha).
 * Toda la explicación es UN único audio continuo con Sulafat (sin cortes entre apartados ni palabras partidas).
 * La lectura se detiene al salir (lo hace useGeminiContinuousSpeech).
 */
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import {
  AppHeader,
  AppText,
  Card,
  Icon,
  InfoBanner,
  MedicationImage,
  Screen,
  SegmentedControl,
  Skeleton,
  Waveform,
  type IconName,
} from '../../components';
import { useAppTheme, useAsync, usePreferences, useGeminiContinuousSpeech } from '../../hooks';
import { DemoMode, MedicationService } from '../../services';
import { endWithPause, limitSpeechParts } from '../../utils/speechText';
import {
  SPEED_RATES,
  buildReadingSections,
  firstParam,
  speedFromRate,
  type SpeedOption,
} from './helpers';
import { FavoriteButton, ScreenError } from './parts';
import { useSavedMedication } from './useSavedMedication';

/** Unos 5-6 minutos de audio: suficiente para la explicación sencilla y para los apartados principales del prospecto. */
const MAX_READING_CHARS = 4500;

const SPEED_OPTIONS: { value: SpeedOption; label: string }[] = [
  { value: 'slow', label: 'Más lento' },
  { value: 'normal', label: 'Velocidad normal' },
  { value: 'fast', label: 'Más rápido' },
];

export default function VoiceScreen() {
  const theme = useAppTheme();
  const c = theme.colors;
  const params = useLocalSearchParams<{ id?: string | string[]; name?: string | string[] }>();
  const id = firstParam(params.id) ?? '';
  const nameParam = firstParam(params.name);
  const { prefs, setSpeechRate } = usePreferences();

  const detail = useAsync(() => MedicationService.getMedication(id), [id]);
  const d = detail.data;
  const saved = useSavedMedication(d);

  const sections = useMemo(() => (d ? buildReadingSections(d) : []), [d]);
  const reading = useMemo(
    () => limitSpeechParts(
      sections.map((s) => `${endWithPause(s.title)} ${s.text}`.replace(/\s+/g, ' ').trim()).filter(Boolean),
      MAX_READING_CHARS,
    ),
    [sections],
  );
  const audioParts = reading.parts;
  const demo = DemoMode.isActive();
  // Toda la explicación se prepara y reproduce como un único audio continuo con Sulafat.
  const speech = useGeminiContinuousSpeech(audioParts, prefs.speechRate, 'Sulafat');

  const playing = speech.status === 'speaking';
  const loading = speech.status === 'loading';
  const finished = speech.status === 'finished';

  // Empieza automáticamente cuando la ficha ya está disponible.
  const autoStarted = useRef(false);
  const { play } = speech;
  useEffect(() => {
    if (autoStarted.current || audioParts.length === 0) return;
    autoStarted.current = true;
    play();
  }, [audioParts.length, play]);

  const changeSpeed = (value: SpeedOption) => {
    setSpeechRate(SPEED_RATES[value]).catch(() => undefined);
  };

  const formatTime = (seconds: number) => {
    const safe = Number.isFinite(seconds) ? Math.max(0, Math.floor(seconds)) : 0;
    const minutes = Math.floor(safe / 60);
    return `${minutes}:${String(safe % 60).padStart(2, '0')}`;
  };

  const loadImage = useCallback(() => MedicationService.getMedicationImage(id), [id]);
  const name = d?.name ?? nameParam ?? 'Medicamento';

  const header = <AppHeader right={d ? <FavoriteButton state={saved} /> : undefined} />;

  if (detail.status === 'error' && detail.error && !d) {
    return (
      <Screen header={header} contentStyle={styles.grow}>
        <ScreenError
          error={detail.error}
          onRetry={detail.reload}
          notFoundTitle="No encontramos este medicamento en la base oficial"
        />
      </Screen>
    );
  }

  const playLabel = loading ? 'Preparando la explicación completa' : playing
    ? 'Pausar la lectura'
    : speech.status === 'paused'
      ? 'Continuar la lectura'
      : finished
        ? 'Volver a escuchar la lectura desde el principio'
        : 'Escuchar la lectura';
  const playIcon: IconName = playing ? 'pause' : finished ? 'refresh' : 'play';

  const errorText = 'No se ha podido preparar la voz Sulafat. Comprueba tu conexión a internet y pulsa reproducir para intentarlo de nuevo.';
  const statusText = loading ? 'Preparando la explicación completa con Sulafat…' :
    speech.status === 'error'
      ? 'Voz no disponible'
      : finished
        ? 'Explicación terminada'
        : speech.status === 'paused'
          ? 'Explicación en pausa'
          : playing
            ? 'Reproduciendo la explicación completa'
            : 'Pulsa reproducir para escuchar toda la explicación';

  return (
    <Screen header={header}>
      <AppText variant="title" accessibilityRole="header" style={{ marginTop: theme.spacing.xxs }}>
        Lectura en voz alta
      </AppText>
      <AppText variant="captionStrong" color="textSecondary">
        Voz natural: Sulafat
      </AppText>

      <View style={[styles.medRow, { marginTop: theme.spacing.md, gap: theme.spacing.md }]}>
        <MedicationImage uri={d?.imageUrl ?? null} loadUri={loadImage} width={88} height={72} radius={theme.radius.md} />
        <View style={styles.flex}>
          <AppText variant="subheading" color="heading" numberOfLines={3}>
            {name}
          </AppText>
          {d ? (
            d.pharmaceuticalForm ? (
              <AppText variant="body" color="textSecondary">
                {d.pharmaceuticalForm}
              </AppText>
            ) : null
          ) : (
            <Skeleton width="60%" height={16} style={{ marginTop: 6 }} />
          )}
        </View>
      </View>

      {!d ? (
        <View style={{ gap: theme.spacing.md, marginTop: theme.spacing.xl }} accessibilityRole="progressbar" accessibilityLabel="Preparando la lectura">
          <Skeleton height={88} radius={44} />
          <Skeleton height={48} radius={theme.radius.md} />
          <Skeleton height={200} radius={theme.radius.lg} />
        </View>
      ) : (
        <>
          <Card style={[styles.audioCard, { marginTop: theme.spacing.xl, gap: theme.spacing.md }]}>
            <View style={styles.waveRow}>
              <Waveform active={playing} bars={17} height={52} color={c.primary} />
            </View>

            <View style={styles.player}>
              <Pressable
                onPress={() => speech.replay()}
                accessibilityRole="button"
                accessibilityLabel="Repetir explicación desde el principio"
                testID="voice-replay"
                style={({ pressed }) => [
                  styles.sideControl,
                  {
                    borderColor: c.primarySoft,
                    backgroundColor: pressed ? c.primaryTint : c.surface,
                  },
                ]}
              >
                <Icon name="refresh" size={26} color={c.primary} />
                <AppText variant="small" color="primary">Repetir</AppText>
              </Pressable>

              <Pressable
                onPress={() => (playing ? speech.pause() : speech.play())}
                disabled={loading}
                accessibilityRole="button"
                accessibilityLabel={playLabel}
                accessibilityState={{ disabled: loading, busy: loading }}
                testID="voice-play"
                style={({ pressed }) => [
                  styles.playButton,
                  {
                    backgroundColor: loading ? c.surfaceMuted : pressed ? c.primaryPressed : c.primary,
                    borderColor: loading ? c.border : c.primarySoft,
                    opacity: loading ? 0.7 : 1,
                  },
                  theme.shadow.button,
                ]}
              >
                <View style={playIcon === 'play' ? styles.playNudge : null}>
                  <Icon name={loading ? 'hourglass-outline' : playIcon} size={42} color={loading ? c.textSecondary : c.onPrimary} />
                </View>
              </Pressable>

              <Pressable
                onPress={() => (playing ? speech.pause() : speech.play())}
                disabled={loading}
                accessibilityRole="button"
                accessibilityLabel={playing ? 'Pausar explicación' : speech.status === 'error' ? 'Reintentar la lectura' : 'Continuar explicación'}
                style={({ pressed }) => [
                  styles.sideControl,
                  {
                    borderColor: c.primarySoft,
                    backgroundColor: pressed ? c.primaryTint : c.surface,
                    opacity: loading ? 0.5 : 1,
                  },
                ]}
              >
                <Icon name={playing ? 'pause-circle-outline' : speech.status === 'error' ? 'refresh-circle-outline' : 'play-circle-outline'} size={26} color={c.primary} />
                <AppText variant="small" color="primary">{playing ? 'Pausar' : speech.status === 'error' ? 'Reintentar' : 'Continuar'}</AppText>
              </Pressable>
            </View>

            <View style={{ gap: theme.spacing.xs }}>
              <View style={styles.progressText}>
                <AppText variant="captionStrong" color="heading">
                  {formatTime(speech.currentTime)}
                </AppText>
                <AppText variant="caption" color="textSecondary" style={styles.statusText}>
                  {statusText}
                </AppText>
                <AppText variant="captionStrong" color="heading">
                  {formatTime(speech.duration)}
                </AppText>
              </View>
              <View style={[styles.progressTrack, { backgroundColor: c.surfaceMuted }]}>
                <View style={[styles.progressFill, { backgroundColor: c.primary, width: `${Math.round(speech.progress * 100)}%` }]} />
              </View>
            </View>
          </Card>

          {speech.status === 'error' ? (
            <InfoBanner tone="warning" icon="volume-mute" message={errorText} style={{ marginTop: theme.spacing.sm }} />
          ) : null}
          {demo ? (
            <InfoBanner
              tone="info"
              message="Modo demostración: escucharás una muestra breve de la voz Sulafat. Con tu cuenta de MediClaro se lee la explicación completa."
              style={{ marginTop: theme.spacing.sm }}
            />
          ) : reading.truncated ? (
            <InfoBanner
              tone="info"
              message="Se leen los primeros apartados del prospecto oficial. El texto completo está en la ficha del medicamento."
              style={{ marginTop: theme.spacing.sm }}
            />
          ) : null}

          <View style={{ marginTop: theme.spacing.lg }}>
            <SegmentedControl
              options={SPEED_OPTIONS}
              value={speedFromRate(prefs.speechRate)}
              onChange={changeSpeed}
              accessibilityLabel="Velocidad de lectura"
            />
          </View>

          <Card style={{ marginTop: theme.spacing.lg, gap: theme.spacing.sm }}>
            <AppText variant="heading" accessibilityRole="header">
              Contenido de la explicación
            </AppText>
            <AppText variant="caption" color="textSecondary">
              Se reproduce seguido, como un único audio, sin cortes entre apartados.
            </AppText>
            {sections.map((s, i) => {
              const included = i < audioParts.length;
              return (
                <View key={s.id} style={styles.contentRow}>
                  <View style={[styles.number, { backgroundColor: included ? c.primary : c.surfaceMuted }]}>
                    <AppText variant="captionStrong" color={included ? 'onPrimary' : 'textSecondary'} allowFontScaling={false}>
                      {String(i + 1)}
                    </AppText>
                  </View>
                  <AppText variant="body" color={included ? 'text' : 'textSecondary'} style={styles.flex}>
                    {s.title}
                  </AppText>
                  <Icon
                    name={included ? 'checkmark-circle-outline' : 'document-text-outline'}
                    size={22}
                    color={included ? c.successStrong : c.textSecondary}
                    accessibilityLabel={included ? 'Incluido en la lectura' : 'Solo en la ficha'}
                  />
                </View>
              );
            })}
          </Card>
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  grow: { flexGrow: 1 },
  medRow: { flexDirection: 'row', alignItems: 'center' },
  audioCard: { overflow: 'hidden' },
  waveRow: { alignItems: 'center', overflow: 'hidden' },
  player: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-evenly', gap: 10 },
  sideControl: { width: 78, minHeight: 66, borderRadius: 18, borderWidth: 1, alignItems: 'center', justifyContent: 'center', gap: 3, paddingHorizontal: 6 },
  playButton: { width: 88, height: 88, borderRadius: 44, alignItems: 'center', justifyContent: 'center', borderWidth: 5 },
  playNudge: { marginLeft: 5 },
  progressText: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  statusText: { flex: 1, textAlign: 'center' },
  progressTrack: { height: 8, borderRadius: 4, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 4 },
  contentRow: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 48, paddingVertical: 4 },
  number: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
});
