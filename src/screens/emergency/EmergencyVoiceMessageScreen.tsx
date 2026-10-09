/**
 * /emergency/voice-message · Mensaje para el operador (referencia e10_voicemsg).
 * Texto generado con una plantilla fija a partir del perfil y de lo que la persona ha
 * indicado (no es un diagnóstico).
 *
 * Voz: la voz natural elegida en Ajustes para el asistente (Sulafat o Achird); si no está disponible (sin conexión
 * o sin Premium), la del teléfono, para que el mensaje nunca se quede mudo (EmergencyService.speak).
 *
 * Importante (comprobado): durante una llamada de teléfono, iOS y Android NO dejan que una app ponga sonido dentro
 * de la llamada, así que el operador del 112 no oye esta grabación. Por eso la pantalla lo dice claro y propone lo
 * que sí funciona: leerlo en voz alta, que lo lea quien esté contigo o que tu cuidador/a llame al 112 por ti.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
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
  SecondaryButton,
  Waveform,
} from '../../components';
import { useAppTheme } from '../../hooks';
import { EmergencyService } from '../../services';
import { EMERGENCY_HREF, useOfficialCall, usePreparedEmergency } from './parts';

export default function EmergencyVoiceMessageScreen() {
  const theme = useAppTheme();
  const router = useRouter();
  const { prepared, error, retry } = usePreparedEmergency();
  const { callOfficial, callingOfficial } = useOfficialCall();
  const [playing, setPlaying] = useState(false);
  const token = useRef(0);

  const stop = useCallback(() => {
    token.current += 1;
    EmergencyService.stopSpeaking();
    setPlaying(false);
  }, []);

  // La lectura se detiene al salir de la pantalla.
  useFocusEffect(useCallback(() => () => stop(), [stop]));
  useEffect(() => () => {
    token.current += 1;
    EmergencyService.stopSpeaking();
  }, []);

  const toggle = () => {
    if (!prepared) return;
    if (playing) {
      stop();
      return;
    }
    const my = ++token.current;
    setPlaying(true);
    void EmergencyService.speak(prepared.voiceMessage, 0.8)
      .catch(() => undefined)
      .finally(() => {
        if (my === token.current) setPlaying(false);
      });
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

        <InfoBanner
          tone="warning"
          icon="information-circle"
          title="Dentro de la llamada al 112 no se oye"
          message="El teléfono no deja que una app ponga sonido dentro de una llamada. Escúchalo antes de llamar, léelo tú o pide a quien esté contigo que lo lea al operador."
          testID="voice-message-call-limit"
        />

        <Card>
          <View style={{ gap: theme.spacing.sm }} accessible accessibilityLabel={`Mensaje para el operador: ${paragraphs.join(' ')}`}>
            {paragraphs.map((p, i) => (
              <AppText key={i} variant="body" color="text" selectable>
                {`${i === 0 ? '“' : ''}${p}${i === paragraphs.length - 1 ? '”' : ''}`}
              </AppText>
            ))}
          </View>
        </Card>

        <Card style={{ gap: theme.spacing.sm }} testID="voice-message-cant-speak">
          <AppText variant="bodyStrong" color="heading">
            Si no puedes hablar
          </AppText>
          <AppText variant="body" color="textSecondary">
            Avisa a tu cuidador/a: recibe tu aviso con tus datos y tu ubicación (si lo permites), te escribe por el chat y puede
            llamar al 112 por ti y leerles este mensaje.
          </AppText>
          <SecondaryButton
            label="Avisar a mi cuidador/a"
            icon="people"
            onPress={() => {
              stop();
              router.push(EMERGENCY_HREF.notify);
            }}
            testID="voice-message-notify"
          />
          <AppText variant="caption" color="textSecondary">
            Las personas sordas o que no pueden hablar tienen servicios del 112 por mensajes en algunas comunidades (por ejemplo,
            la app «112 Accesible») y la app oficial AlertCops. Infórmate en tu comunidad y déjalos preparados antes de necesitarlos.
          </AppText>
        </Card>
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
