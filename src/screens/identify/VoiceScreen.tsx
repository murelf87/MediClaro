/**
 * /voice?id=<id>&name=<nombre> — Lectura en voz alta (referencia 08_voice).
 * Lee los MISMOS textos que la ficha: Qué es · Para qué se utiliza · Cómo tomarlo · Advertencias.
 * Sin resumen sencillo, lee el prospecto oficial por apartados.
 * La lectura se detiene al salir (lo hace useSectionSpeech).
 */
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import {
  AppHeader,
  AppText,
  Card,
  Icon,
  IconButton,
  InfoBanner,
  MedicationImage,
  Screen,
  SegmentedControl,
  Skeleton,
  Waveform,
  type IconName,
} from '../../components';
import { useAppTheme, useAsync, usePreferences, useSectionSpeech } from '../../hooks';
import { MedicationService } from '../../services';
import {
  SPEED_RATES,
  buildReadingSections,
  buildSpeechPlan,
  firstParam,
  speedFromRate,
  type ReadingTone,
  type SpeedOption,
} from './helpers';
import { FavoriteButton, ScreenError } from './parts';
import { useSavedMedication } from './useSavedMedication';

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
  const plan = useMemo(() => buildSpeechPlan(sections), [sections]);
  const speech = useSectionSpeech(plan.sections, prefs.speechRate);

  const total = sections.length;
  const current = plan.ownerOf[speech.index] ?? 0;
  const playing = speech.status === 'speaking';
  const active = playing || speech.status === 'paused';
  const finished = speech.status === 'finished';

  // Empieza a leer en cuanto la ficha está lista (la persona pulsó "Leer en voz alta").
  const autoStarted = useRef(false);
  const { play } = speech;
  useEffect(() => {
    if (autoStarted.current || plan.sections.length === 0) return;
    autoStarted.current = true;
    play();
  }, [plan.sections.length, play]);

  // Al cambiar la velocidad, la parte actual se vuelve a leer con la nueva velocidad.
  const lastRate = useRef(prefs.speechRate);
  const { restartWithNewRate } = speech;
  useEffect(() => {
    if (lastRate.current === prefs.speechRate) return;
    lastRate.current = prefs.speechRate;
    restartWithNewRate();
  }, [prefs.speechRate, restartWithNewRate]);

  const changeSpeed = (value: SpeedOption) => {
    setSpeechRate(SPEED_RATES[value]).catch(() => undefined);
  };

  const goToSection = useCallback((i: number) => speech.goTo(plan.startOf[i] ?? 0), [speech, plan.startOf]);

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

  const playLabel = playing
    ? 'Pausar la lectura'
    : speech.status === 'paused'
      ? 'Continuar la lectura'
      : finished
        ? 'Volver a escuchar la lectura desde el principio'
        : 'Escuchar la lectura';
  const playIcon: IconName = playing ? 'pause' : finished ? 'refresh' : 'play';

  const statusText =
    speech.status === 'error'
      ? 'No se ha podido leer en voz alta. Sube el volumen y vuelve a pulsar el botón. Si sigue sin sonar, revisa en los ajustes del teléfono que la voz en español esté instalada.'
      : finished
        ? 'Lectura terminada'
        : speech.status === 'paused'
          ? 'En pausa'
          : playing
            ? `Leyendo: ${sections[current]?.title ?? ''}`
            : 'Pulsa el botón para escuchar';

  return (
    <Screen header={header}>
      <AppText variant="title" accessibilityRole="header" style={{ marginTop: theme.spacing.xxs }}>
        Lectura en voz alta
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
          <View style={[styles.player, { marginTop: theme.spacing.xl }]}>
            <View style={styles.wave}>
              <Waveform active={playing} bars={9} height={48} color={c.primary} />
            </View>
            <IconButton
              icon="play-skip-back"
              color={c.primary}
              size={28}
              onPress={() => goToSection(current - 1)}
              disabled={current <= 0}
              accessibilityLabel="Parte anterior"
              testID="voice-prev"
            />
            <Pressable
              onPress={() => (playing ? speech.pause() : speech.play())}
              accessibilityRole="button"
              accessibilityLabel={playLabel}
              testID="voice-play"
              style={({ pressed }) => [
                styles.playButton,
                { backgroundColor: pressed ? c.primaryPressed : c.primary, borderColor: c.primarySoft },
                theme.shadow.button,
              ]}
            >
              <View style={playIcon === 'play' ? styles.playNudge : null}>
                <Icon name={playIcon} size={40} color={c.onPrimary} />
              </View>
            </Pressable>
            <IconButton
              icon="play-skip-forward"
              color={c.primary}
              size={28}
              onPress={() => goToSection(current + 1)}
              disabled={current >= total - 1}
              accessibilityLabel="Parte siguiente"
              testID="voice-next"
            />
            <View style={styles.wave}>
              <Waveform active={playing} bars={9} height={48} color={c.primary} />
            </View>
          </View>

          <View style={{ marginTop: theme.spacing.md, gap: theme.spacing.xs }} accessible accessibilityLabel={`${finished ? 'Lectura terminada' : `Parte ${current + 1} de ${total}`}. ${statusText}`}>
            <View style={styles.progressText}>
              <AppText variant="captionStrong" color="heading">
                {finished ? `Parte ${total} de ${total}` : `Parte ${current + 1} de ${total}`}
              </AppText>
              {speech.status === 'error' ? null : (
                <AppText variant="caption" color="textSecondary" style={styles.statusText} numberOfLines={2}>
                  {statusText}
                </AppText>
              )}
            </View>
            <View style={[styles.segments, { gap: theme.spacing.xxs }]}>
              {sections.map((s, i) => {
                const done = finished || i < current;
                const now = !finished && i === current;
                return (
                  <View
                    key={s.id}
                    style={[
                      styles.segment,
                      { backgroundColor: done ? c.primary : now ? (active ? c.primary : c.primarySoft) : c.surfaceMuted, opacity: now && active && !playing ? 0.6 : 1 },
                    ]}
                  />
                );
              })}
            </View>
          </View>
          {speech.status === 'error' ? (
            <InfoBanner tone="warning" icon="volume-mute" message={statusText} style={{ marginTop: theme.spacing.sm }} />
          ) : null}

          <View style={{ marginTop: theme.spacing.lg }}>
            <SegmentedControl
              options={SPEED_OPTIONS}
              value={speedFromRate(prefs.speechRate)}
              onChange={changeSpeed}
              accessibilityLabel="Velocidad de lectura"
            />
          </View>

          <Card style={{ marginTop: theme.spacing.lg, gap: theme.spacing.xxs }}>
            <AppText variant="heading" accessibilityRole="header" style={{ marginBottom: theme.spacing.xxs }}>
              ¿Qué se está leyendo?
            </AppText>
            {sections.map((s, i) => (
              <SectionRow
                key={s.id}
                index={i}
                title={s.title}
                tone={s.tone}
                current={active && i === current}
                onPress={() => goToSection(i)}
              />
            ))}
          </Card>
        </>
      )}
    </Screen>
  );
}

function SectionRow({
  index,
  title,
  tone,
  current,
  onPress,
}: {
  index: number;
  title: string;
  tone: ReadingTone;
  current: boolean;
  onPress: () => void;
}) {
  const theme = useAppTheme();
  const c = theme.colors;
  const fill = { success: c.successStrong, primary: c.primary, warning: c.warning, danger: c.danger }[tone];
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Parte ${index + 1}: ${title}`}
      accessibilityHint="Lee esta parte"
      accessibilityState={{ selected: current }}
      style={({ pressed }) => [
        styles.row,
        {
          minHeight: theme.touchTargets.min + 4,
          borderRadius: theme.radius.sm,
          backgroundColor: current ? c.primaryTint : pressed ? c.surfaceAlt : 'transparent',
        },
      ]}
    >
      <View style={[styles.number, { backgroundColor: fill }]}>
        <AppText variant="captionStrong" color="onPrimary" allowFontScaling={false}>
          {String(index + 1)}
        </AppText>
      </View>
      <AppText variant={current ? 'bodyStrong' : 'body'} color={current ? 'primary' : 'text'} style={styles.flex}>
        {title}
      </AppText>
      {current ? <Icon name="volume-high" size={22} color={c.primary} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  grow: { flexGrow: 1 },
  medRow: { flexDirection: 'row', alignItems: 'center' },
  player: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 },
  wave: { flexShrink: 1, overflow: 'hidden', alignItems: 'center' },
  playButton: { width: 84, height: 84, borderRadius: 42, alignItems: 'center', justifyContent: 'center', borderWidth: 5 },
  playNudge: { marginLeft: 5 },
  progressText: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  statusText: { flexShrink: 1, textAlign: 'right' },
  segments: { flexDirection: 'row' },
  segment: { flex: 1, height: 8, borderRadius: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 8, paddingVertical: 6 },
  number: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
});
