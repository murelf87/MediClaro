/**
 * /accessibility — Tamaño del texto, alto contraste, Modo fácil y velocidad de lectura.
 * Todo se aplica al instante (usePreferences) y se sincroniza con el perfil cuando hay conexión.
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
import { useAppTheme, usePreferences, useSimpleSpeech } from '../../hooks';
import { FONT_SIZE_LABELS, fontScale, typeScale } from '../../theme';
import type { FontSizePreference } from '../../types';
import { RadioMark } from '../premium/parts';

const SIZE_OPTIONS: FontSizePreference[] = ['normal', 'grande', 'muy_grande'];

type RateValue = '0.7' | '0.85' | '1';
const RATE_OPTIONS: { value: RateValue; label: string }[] = [
  { value: '0.7', label: 'Más lento' },
  { value: '0.85', label: 'Normal' },
  { value: '1', label: 'Más rápido' },
];

const VOICE_TEST_ID = 'voice-test';
const VOICE_TEST_TEXT = 'Hola. Así sonará la lectura en voz alta.';

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
  const { prefs, setFontSize, setHighContrast, setSpeechRate } = usePreferences();
  const { speakingId, speak, stop } = useSimpleSpeech();
  const testing = speakingId === VOICE_TEST_ID;

  const onRateChange = (value: RateValue) => {
    const rate = Number(value);
    void setSpeechRate(rate);
    // Si está sonando la prueba, se repite con la nueva velocidad.
    if (testing) speak(VOICE_TEST_ID, VOICE_TEST_TEXT, rate);
  };

  const testVoice = () => {
    if (testing) stop();
    else speak(VOICE_TEST_ID, VOICE_TEST_TEXT, prefs.speechRate);
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

      <View style={{ marginTop: theme.spacing.lg, gap: theme.spacing.sm }}>
        <SectionHeader title="Velocidad de lectura" />
        <SegmentedControl
          options={RATE_OPTIONS}
          value={nearestRate(prefs.speechRate)}
          onChange={onRateChange}
          accessibilityLabel="Velocidad de lectura en voz alta"
        />
        <SecondaryButton
          label={testing ? 'Detener' : 'Probar voz'}
          icon={testing ? 'stop-circle' : 'volume-high'}
          onPress={testVoice}
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
