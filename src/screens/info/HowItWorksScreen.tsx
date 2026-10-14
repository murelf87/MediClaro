/**
 * /how-it-works — «Así funciona MediClaro»: el vídeo explicativo completo (pública, como Ayuda).
 *
 * El vídeo se reproduce dentro de la app vía WebView desde la URL configurada por el propietario
 * (EXPO_PUBLIC_HOW_IT_WORKS_VIDEO_URL). Sin URL redirige a Ayuda.
 * Usa expo-web-view (ya instalado) — sin módulos nativos adicionales.
 */
import { useCallback, useState } from 'react';
import { StyleSheet, View, useWindowDimensions, ActivityIndicator } from 'react-native';
import { Redirect, useFocusEffect, useRouter } from 'expo-router';
import { WebView } from 'react-native-webview';
import { AppHeader, AppText, ErrorState, Screen, TextButton } from '../../components';
import { useAppTheme } from '../../hooks';
import { HOW_IT_WORKS_VIDEO_URL } from '../../config/app';
import { useHomeHref } from './parts';

export default function HowItWorksScreen() {
  if (!HOW_IT_WORKS_VIDEO_URL) return <Redirect href="/help" />;
  return <HowItWorksPlayer url={HOW_IT_WORKS_VIDEO_URL} />;
}

function HowItWorksPlayer({ url }: { url: string }) {
  const router = useRouter();
  const theme = useAppTheme();
  const homeHref = useHomeHref();
  const { width, height } = useWindowDimensions();
  const [loading, setLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  // Al salir de la pantalla reseteamos el estado (el WebView se desmonta y el vídeo se detiene)
  useFocusEffect(useCallback(() => {
    setHasError(false);
    setLoading(true);
  }, []));

  const videoH = Math.min(Math.round(height * 0.55), 420);
  const videoW = Math.min(width - theme.spacing.lg * 2, theme.layout.maxContentWidth ?? 500);

  return (
    <Screen header={<AppHeader title="Así funciona MediClaro" fallbackHref={homeHref} />} testID="how-it-works">
      <AppText variant="body" color="textSecondary" align="center" style={{ marginTop: theme.spacing.xs }}>
        Un vídeo explicativo, con voz y subtítulos, que explica la app de principio a fin.
      </AppText>

      <View style={[styles.frame, { marginTop: theme.spacing.md, borderRadius: theme.radius.lg, width: videoW, height: videoH }]}>
        {hasError ? (
          <ErrorState
            kind="offline"
            title="No se ha podido cargar el vídeo"
            message="Comprueba tu conexión a internet e inténtalo de nuevo."
            onRetry={() => { setHasError(false); setLoading(true); setReloadKey(k => k + 1); }}
            style={{ flex: 1 }}
          />
        ) : (
          <>
            <WebView
              key={reloadKey}
              source={{ uri: url }}
              style={styles.video}
              allowsFullscreenVideo
              mediaPlaybackRequiresUserAction={false}
              onLoadStart={() => setLoading(true)}
              onLoadEnd={() => setLoading(false)}
              onError={() => { setHasError(true); setLoading(false); }}
              testID="how-it-works-video"
            />
            {loading && (
              <View style={styles.overlay} pointerEvents="none">
                <ActivityIndicator size="large" color={theme.colors.primary} />
                <AppText variant="caption" color="textSecondary" style={{ marginTop: theme.spacing.sm }}>
                  Cargando el vídeo…
                </AppText>
              </View>
            )}
          </>
        )}
      </View>

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
  video: { flex: 1, backgroundColor: '#0B1220' },
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(11, 18, 32, 0.7)' },
});
