/**
 * /how-it-works — «Así funciona MediClaro»: el vídeo explicativo completo (pública, como Ayuda).
 *
 * El vídeo se reproduce DENTRO de la app en streaming (expo-video) desde la URL que configura el propietario
 * (EXPO_PUBLIC_HOW_IT_WORKS_VIDEO_URL): nunca va dentro del paquete. Sin URL no aparece ningún acceso y esta
 * ruta lleva a Ayuda. Botones grandes propios (reproducir / pausar / desde el principio) además de los controles
 * nativos; la reproducción se detiene al salir de la pantalla.
 */
import { useCallback, useState } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { Redirect, useFocusEffect, useRouter } from 'expo-router';
import { useEvent } from 'expo';
import { VideoView, useVideoPlayer } from 'expo-video';
import { AppHeader, AppText, ErrorState, LoadingState, PrimaryButton, SecondaryButton, Screen, TextButton } from '../../components';
import { useAppTheme } from '../../hooks';
import { HOW_IT_WORKS_VIDEO_URL } from '../../config/app';
import { useHomeHref } from './parts';

const VIDEO_ASPECT = 9 / 16;

export default function HowItWorksScreen() {
  if (!HOW_IT_WORKS_VIDEO_URL) return <Redirect href="/help" />;
  return <HowItWorksPlayer url={HOW_IT_WORKS_VIDEO_URL} />;
}

function HowItWorksPlayer({ url }: { url: string }) {
  const router = useRouter();
  const theme = useAppTheme();
  const homeHref = useHomeHref();
  const { width, height } = useWindowDimensions();
  const [reloadKey, setReloadKey] = useState(0);

  const player = useVideoPlayer({ uri: url }, (p) => {
    p.loop = false;
    p.keepScreenOnWhilePlaying = true;
    p.staysActiveInBackground = false;
  });
  const { status } = useEvent(player, 'statusChange', { status: player.status });
  const { isPlaying } = useEvent(player, 'playingChange', { isPlaying: player.playing });

  // Al salir de la pantalla el vídeo se detiene (no sigue sonando en otra pantalla).
  useFocusEffect(useCallback(() => () => player.pause(), [player]));

  const retry = () => {
    setReloadKey((k) => k + 1);
    void player.replaceAsync({ uri: url });
  };

  // Tamaño: vertical 9:16 sin superar ~62 % del alto de la pantalla, centrado.
  const maxW = Math.min(width - theme.spacing.lg * 2, theme.layout.maxContentWidth);
  const videoH = Math.min(Math.round(height * 0.62), Math.round(maxW / VIDEO_ASPECT));
  const videoW = Math.round(videoH * VIDEO_ASPECT);
  const loading = status === 'loading';

  return (
    <Screen header={<AppHeader title="Así funciona MediClaro" fallbackHref={homeHref} />} testID="how-it-works">
      <AppText variant="body" color="textSecondary" align="center" style={{ marginTop: theme.spacing.xs }}>
        Un vídeo de cuatro minutos, con voz y subtítulos, que explica la app de principio a fin.
      </AppText>

      <View style={[styles.frame, { marginTop: theme.spacing.md, borderRadius: theme.radius.lg, width: videoW, height: videoH }]}>
        <VideoView
          key={reloadKey}
          player={player}
          style={styles.video}
          contentFit="contain"
          nativeControls
          fullscreenOptions={{ enable: true }}
          allowsPictureInPicture={false}
          testID="how-it-works-video"
        />
        {loading ? (
          <View style={styles.overlay} pointerEvents="none">
            <LoadingState message="Cargando el vídeo…" />
          </View>
        ) : null}
      </View>

      {status === 'error' ? (
        <ErrorState
          kind="offline"
          title="No se ha podido cargar el vídeo"
          message="Comprueba tu conexión a internet e inténtalo de nuevo."
          onRetry={retry}
          style={{ marginTop: theme.spacing.md }}
        />
      ) : (
        <View style={{ marginTop: theme.spacing.md, gap: theme.spacing.sm }}>
          <PrimaryButton
            label={isPlaying ? 'Pausar' : status === 'idle' && player.currentTime > 0 ? 'Continuar' : 'Reproducir'}
            icon={isPlaying ? 'pause' : 'play'}
            size="lg"
            onPress={() => (isPlaying ? player.pause() : player.play())}
            disabled={loading}
            testID="how-it-works-play"
          />
          <SecondaryButton
            label="Ver desde el principio"
            icon="refresh"
            variant="neutral"
            onPress={() => {
              player.replay();
            }}
            disabled={loading}
            testID="how-it-works-replay"
          />
        </View>
      )}

      <AppText variant="caption" color="textMuted" align="center" style={{ marginTop: theme.spacing.lg }}>
        El vídeo se reproduce por internet y no ocupa espacio en tu teléfono.
      </AppText>
      <TextButton
        label="Prefiero la explicación paso a paso"
        icon="footsteps-outline"
        onPress={() => router.push('/tour')}
        style={{ marginTop: theme.spacing.xs }}
        testID="how-it-works-tour"
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  frame: { alignSelf: 'center', overflow: 'hidden', backgroundColor: '#0B1220' },
  video: { width: '100%', height: '100%' },
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(11, 18, 32, 0.6)' },
});
