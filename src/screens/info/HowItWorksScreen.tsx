/**
 * /how-it-works — «Así funciona MediClaro» (pública, como Ayuda).
 * Abre el vídeo en el navegador del sistema vía expo-web-browser (ya instalado).
 * Sin dependencias nativas adicionales.
 */
import { useRouter } from 'expo-router';
import { View, StyleSheet } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { AppHeader, AppText, PrimaryButton, Screen, TextButton } from '../../components';
import { useAppTheme } from '../../hooks';
import { HOW_IT_WORKS_VIDEO_URL } from '../../config/app';
import { useHomeHref } from './parts';

export default function HowItWorksScreen() {
  const router = useRouter();
  const theme = useAppTheme();
  const homeHref = useHomeHref();

  const openVideo = async () => {
    const url = HOW_IT_WORKS_VIDEO_URL || 'https://mediclaro.app';
    await WebBrowser.openBrowserAsync(url);
  };

  return (
    <Screen header={<AppHeader title="Así funciona MediClaro" fallbackHref={homeHref} />} testID="how-it-works">
      <View style={[styles.content, { gap: theme.spacing.md, marginTop: theme.spacing.lg }]}>
        <AppText variant="body" color="textSecondary" align="center">
          Un vídeo explicativo, con voz y subtítulos, que explica la app de principio a fin.
        </AppText>

        <View style={[styles.steps, { gap: theme.spacing.sm, marginTop: theme.spacing.sm }]}>
          {[
            { icon: '📷', text: 'Fotografía la caja del medicamento' },
            { icon: '🔍', text: 'La app lo identifica al instante' },
            { icon: '💊', text: 'Conoce para qué sirve y cómo tomarlo' },
            { icon: '👨‍👩‍👧', text: 'Comparte con tu cuidador/a' },
          ].map(({ icon, text }) => (
            <View key={text} style={[styles.step, { backgroundColor: theme.colors.surfaceSecondary, borderRadius: theme.radius.md, padding: theme.spacing.md }]}>
              <AppText variant="body" style={{ fontSize: 24 }}>{icon}</AppText>
              <AppText variant="body" style={{ flex: 1, marginLeft: theme.spacing.sm }}>{text}</AppText>
            </View>
          ))}
        </View>

        <PrimaryButton
          label="Ver vídeo explicativo"
          icon="play-circle"
          size="lg"
          onPress={openVideo}
          style={{ marginTop: theme.spacing.md }}
          testID="how-it-works-play"
        />

        <TextButton
          label="Prefiero la explicación paso a paso"
          icon="footsteps-outline"
          onPress={() => router.push('/tour')}
          testID="how-it-works-tour"
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { flex: 1, alignItems: 'stretch' },
  steps: {},
  step: { flexDirection: 'row', alignItems: 'center' },
});
