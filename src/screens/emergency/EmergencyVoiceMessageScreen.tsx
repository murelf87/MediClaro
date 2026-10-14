/**
 * /emergency/voice-message · Mensaje para el operador (referencia e10_voicemsg).
 * Texto generado con una plantilla fija a partir del perfil y de lo que la persona ha
 * indicado (no es un diagnóstico). Se puede reproducir con el altavoz o leer en voz alta.
 */
import { useCallback } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import {
  AppHeader,
  AppText,
  Card,
  EmergencyCallButton,
  ErrorState,
  Icon,
  InfoBanner,
  LoadingState,
  Screen,
  Waveform,
} from '../../components';
import { useAppTheme, useSimpleSpeech } from '../../hooks';
import { EMERGENCY_HREF, useOfficialCall, usePreparedEmergency } from './parts';

const SPEECH_ID = 'op';

export default function EmergencyVoiceMessageScreen() {
  const theme = useAppTheme();
  const { prepared, error, retry } = usePreparedEmergency();
  const { speakingId, speak, stop } = useSimpleSpeech();
  const { callOfficial, callingOfficial } = useOfficialCall();
  const playing = speakingId === SPEECH_ID;

  // La lectura se detiene al salir de la pantalla.
  useFocusEffect(useCallback(() => () => stop(), [stop]));

  const toggle = () => {
    if (!prepared) return;
    if (playing) stop();
    else speak(SPEECH_ID, prepared.voiceMessage, 0.8);
  };

  const call112 = () => {
    stop();
    void callOfficial();
  };

  let body;
  if (!prepared && error) {
    body = <ErrorState title="No hemos podido preparar el mensaje" message={error} onRetry={() => void retry()} />;
  } else if (!prepared) {
    body = <LoadingState message="Preparando el mensaje…" />;
  } else {
    const paragraphs = prepared.voiceMessage
      .split(/\n\s*\n/)
      .map((p) => p.replace(/\s*\n\s*/g, ' ').trim())
      .filter(Boolean);
    body = (
      <View style={{ gap: theme.spacing.md }}>
        <View style={{ gap: theme.spacing.xxs }}>
          <AppText variant="title" accessibilityRole="header">
            Mensaje para el operador
          </AppText>
          <AppText variant="body" color="textSecondary">
            Lo esencial para quien te atienda por teléfono.
          </AppText>
        </View>
        <Card tone="primary" elevated={false}>
          <View style={styles.player}>
            <Pressable
              onPress={toggle}
              accessibilityRole="button"
              accessibilityLabel={playing ? 'Detener el mensaje' : 'Reproducir el mensaje'}
              accessibilityState={{ selected: playing }}
              testID="voice-toggle"
              style={({ pressed }) => [
                styles.play,
                { backgroundColor: theme.colors.primary, opacity: pressed ? 0.85 : 1 },
                theme.shadow.button,
              ]}
            >
              <Icon name={playing ? 'stop' : 'play'} size={36} color={theme.colors.onPrimary} />
            </Pressable>
            <View style={[styles.flex, { gap: 6 }]}>
              <Waveform active={playing} bars={16} height={40} color={theme.colors.primary} />
              <AppText variant="label" color="heading" align="center">
                {playing ? 'Reproduciendo…' : 'Pulsa para reproducir'}
              </AppText>
            </View>
          </View>
        </Card>

        <Card>
          <View style={{ gap: theme.spacing.sm }} accessible accessibilityLabel={`Mensaje para el operador: ${paragraphs.join(' ')}`}>
            {paragraphs.map((p, i) => (
              <AppText key={i} variant="body" color="text" selectable>
                {`${i === 0 ? '“' : ''}${p}${i === paragraphs.length - 1 ? '”' : ''}`}
              </AppText>
            ))}
          </View>
        </Card>

        <InfoBanner
          tone="info"
          icon="volume-high"
          message="Activa el altavoz de tu teléfono y pulsa reproducir para que el operador lo escuche. También puedes leerlo tú en voz alta."
        />
        <AppText variant="caption" color="textSecondary" align="center" style={styles.note}>
          Este mensaje se ha preparado con los datos de tu perfil y lo que has indicado. No es un diagnóstico.
        </AppText>
      </View>
    );
  }

  return (
    <Screen
      header={<AppHeader title="Mensaje de voz" fallbackHref={EMERGENCY_HREF.main} />}
      footer={<EmergencyCallButton onPress={call112} loading={callingOfficial} />}
      testID="emergency-voice-message"
    >
      {body}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  player: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  play: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center' },
  note: { paddingHorizontal: 8 },
});
