/**
 * /accessibility — Tamaño del texto, alto contraste, Modo fácil, voces y velocidad de lectura.
 * Todo se aplica al instante (usePreferences) y se sincroniza con el perfil cuando hay conexión.
 * Voces: al tocar una voz suena una muestra con esa voz. Elegir voces es parte de Premium (un perfil de
 * cuidador/a gratuito no puede elegirlas: se le explica por qué).
 */
import { Pressable, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import {
  AppHeader,
  AppText,
  Card,
  InfoBanner,
  ListGroup,
  Screen,
  SecondaryButton,
  SectionHeader,
  SegmentedControl,
  SettingRow,
} from '../../components';
import { useAppTheme, useCareSnapshot, useEntitlement, usePreferences, useGeminiSimpleSpeech } from '../../hooks';
import { FONT_SIZE_LABELS, fontScale, typeScale } from '../../theme';
import type { FontSizePreference } from '../../types';
import type { GeminiVoice } from '../../services';
import { TOUR_VOICE } from '../../config/tour';
import { VOICE_PREVIEW_TEXTS } from '../../config/voicePreviews';
import { ASSISTANT_NAME } from '../../config/assistant';
import { RadioMark } from '../premium/parts';

const SIZE_OPTIONS: FontSizePreference[] = ['normal', 'grande', 'muy_grande'];

type RateValue = '0.7' | '0.85' | '1';
const RATE_OPTIONS: { value: RateValue; label: string }[] = [
  { value: '0.7', label: 'Más lento' },
  { value: '0.85', label: 'Normal' },
  { value: '1', label: 'Más rápido' },
];

const READING_TEST_ID = 'voice-test-reading';
const ASSISTANT_TEST_ID = 'voice-test-assistant';
const VOICE_TEST_TEXT = VOICE_PREVIEW_TEXTS.readingTest;
const VOICE_OPTIONS: { value: GeminiVoice; label: string }[] = [
  { value: 'Sulafat', label: 'Sulafat · cálida' },
  { value: 'Achird', label: 'Achird · amigable' },
];

/** La velocidad guardada puede venir del servidor con otro valor: se muestra la opción más cercana. */
function nearestRate(rate: number): RateValue {
  let best: RateValue = '0.85';
  let bestDiff = Number.POSITIVE_INFINITY;
  for (const option of RATE_OPTIONS) {
    const diff = Math.abs(Number(option.value) - rate);
    if (diff < bestDiff) {
      best = option.value;
      bestDiff = diff;
    }
  }
  return best;
}

export default function AccessibilityScreen() {
  const router = useRouter();
  const theme = useAppTheme();
  const c = theme.colors;
  const { prefs, setFontSize, setHighContrast, setSpeechRate, setAssistantVoice } = usePreferences();
  const { speakingId, loadingId, speak, stop } = useGeminiSimpleSpeech();
  const entitlement = useEntitlement();
  const { caregiver } = useCareSnapshot();
  // Mismo criterio que el Inicio: solo se bloquea cuando se sabe que no tiene Premium.
  const voicesLocked = entitlement.required && entitlement.status === 'ready' && !entitlement.isPremium;
  // La explicación de la app y la lectura de los prospectos usan siempre la misma voz (Sulafat).
  const readingVoice = TOUR_VOICE;
  const readingTesting = (speakingId === READING_TEST_ID || loadingId === READING_TEST_ID);
  const assistantTesting = (speakingId === ASSISTANT_TEST_ID || loadingId === ASSISTANT_TEST_ID);

  const onRateChange = (value: RateValue) => {
    const rate = Number(value);
    void setSpeechRate(rate);
    // Si está sonando la prueba de lectura, se repite con la nueva velocidad y la misma voz seleccionada.
    if (readingTesting) {
      speak(
        READING_TEST_ID,
        VOICE_TEST_TEXT,
        rate,
        readingVoice,
        'preview'
      );
    }
  };

  const testReadingVoice = () => {
    if (readingTesting) stop();
    else {
      speak(
        READING_TEST_ID,
        VOICE_TEST_TEXT,
        prefs.speechRate,
        readingVoice,
        'preview'
      );
    }
  };

  return (
    <Screen header={<AppHeader title="Accesibilidad" />}>
      <View style={{ marginTop: theme.spacing.xs }}>
        <SectionHeader title="Tamaño del texto" />
        {prefs.easyMode ? (
          <InfoBanner
            tone="info"
            message="Con el Modo fácil activado, la letra se ve siempre Muy grande."
            action={{ label: 'Ajustar Modo fácil', onPress: () => router.push('/easy-mode') }}
            style={{ marginBottom: theme.spacing.sm }}
          />
        ) : null}
        <View style={{ gap: theme.spacing.sm }} accessibilityRole="radiogroup" accessibilityLabel="Tamaño del texto">
          {SIZE_OPTIONS.map((value) => {
            const checked = prefs.fontSize === value;
            const sample = Math.round(typeScale.title.size * fontScale[value]);
            return (
              <Pressable
                key={value}
                onPress={() => void setFontSize(value)}
                accessibilityRole="radio"
                accessibilityState={{ checked, selected: checked }}
                accessibilityLabel={FONT_SIZE_LABELS[value]}
                testID={`text-size-${value}`}
                style={({ pressed }) => [
                  styles.sizeCard,
                  {
                    minHeight: theme.touchTargets.large + 8,
                    borderRadius: theme.radius.lg,
                    borderColor: checked ? c.primary : c.border,
                    borderWidth: checked ? 2 : 1,
                    paddingHorizontal: checked ? 15 : 16,
                    backgroundColor: checked ? c.primaryTint : pressed ? c.surfaceAlt : c.surface,
                  },
                ]}
              >
                <RadioMark selected={checked} />
                <AppText variant="bodyStrong" color="heading" style={styles.flex}>
                  {FONT_SIZE_LABELS[value]}
                </AppText>
                <AppText
                  allowFontScaling={false}
                  style={[styles.sample, { fontSize: sample, lineHeight: Math.round(sample * 1.2), color: checked ? c.primary : c.heading }]}
                >
                  Aa
                </AppText>
              </Pressable>
            );
          })}
        </View>

        <Card tone="primary" style={{ marginTop: theme.spacing.md }}>
          <AppText variant="captionStrong" color="textSecondary">
            Así se verá el texto
          </AppText>
          <AppText variant="body" color="text" style={{ marginTop: theme.spacing.xxs }}>
            Tu guía de medicamentos de forma sencilla y segura.
          </AppText>
        </Card>
      </View>

      <ListGroup title="Pantalla" style={{ marginTop: theme.spacing.lg }}>
        <SettingRow
          icon="contrast-outline"
          label="Alto contraste"
          description="Textos más oscuros y bordes más marcados"
          toggle={{ value: prefs.highContrast, onChange: (v) => void setHighContrast(v) }}
          testID="accessibility-contrast"
        />
        <SettingRow
          icon="timer-outline"
          label="Modo fácil"
          value={prefs.easyMode ? 'Activado' : 'Desactivado'}
          valueTone={prefs.easyMode ? 'success' : 'muted'}
          onPress={() => router.push('/easy-mode')}
          testID="accessibility-easy-mode"
        />
      </ListGroup>

      {voicesLocked ? (
        <Card style={{ marginTop: theme.spacing.lg, gap: theme.spacing.sm }} testID="accessibility-voices-locked">
          <AppText variant="bodyStrong" color="heading">
            {caregiver ? 'Tu perfil es de cuidador/a' : 'Voces de MediClaro'}
          </AppText>
          <AppText variant="caption" color="textSecondary">
            {caregiver
              ? 'Elegir las voces es una función de MediClaro Premium. Como cuidador/a recibes gratis los avisos y el chat de emergencia de la persona vinculada. Si contratas Premium para ti, podrás elegir las voces.'
              : 'Elegir las voces naturales (Sulafat y Achird) es una función de MediClaro Premium.'}
          </AppText>
          {entitlement.canSell ? (
            <SecondaryButton label="Ver MediClaro Premium" icon="ribbon-outline" onPress={() => router.push('/premium')} testID="accessibility-voices-premium" />
          ) : null}
        </Card>
      ) : (
        <>
          <View style={{ marginTop: theme.spacing.lg, gap: theme.spacing.sm }}>
            <SectionHeader title={`Voz de ${ASSISTANT_NAME}, tu asistente`} />
            <AppText variant="caption" color="textSecondary">
              Sulafat es una voz de mujer, cálida. Achird es una voz de hombre, cercana. Toca una voz para escucharla.
            </AppText>
            <SegmentedControl
              options={VOICE_OPTIONS}
              value={prefs.assistantVoice}
              onChange={(voice) => {
                stop();
                void setAssistantVoice(voice);
                speak(ASSISTANT_TEST_ID, VOICE_PREVIEW_TEXTS.assistantTest, 0.85, voice, 'preview');
              }}
              accessibilityLabel={`Voz de las respuestas de ${ASSISTANT_NAME}`}
            />
            <SecondaryButton
              label={assistantTesting ? 'Detener prueba' : `Probar ${prefs.assistantVoice}`}
              icon={assistantTesting ? 'stop-circle' : 'volume-high'}
              onPress={() => {
                if (assistantTesting) stop();
                else {
                  speak(
                    ASSISTANT_TEST_ID,
                    VOICE_PREVIEW_TEXTS.assistantTest,
                    0.85,
                    prefs.assistantVoice,
                    'preview'
                  );
                }
              }}
              testID="accessibility-assistant-voice-test"
            />
          </View>
        </>
      )}

      <View style={{ marginTop: theme.spacing.lg, gap: theme.spacing.sm }}>
        <SectionHeader title="Velocidad de lectura" />
        <SegmentedControl
          options={RATE_OPTIONS}
          value={nearestRate(prefs.speechRate)}
          onChange={onRateChange}
          accessibilityLabel="Velocidad de lectura en voz alta"
        />
        <AppText variant="caption" color="textSecondary">
          La explicación de la app y la lectura de los prospectos usan siempre la voz Sulafat, la más clara.
        </AppText>
        <SecondaryButton
          label={readingTesting ? 'Detener prueba' : 'Probar la velocidad'}
          icon={readingTesting ? 'stop-circle' : 'volume-high'}
          onPress={testReadingVoice}
          testID="accessibility-voice-test"
        />
      </View>

      <AppText variant="caption" color="textMuted" align="center" style={{ marginTop: theme.spacing.lg }}>
        También se respeta el tamaño de letra de tu teléfono.
      </AppText>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  sizeCard: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 10 },
  sample: { fontWeight: '800' },
});
