/**
 * /welcome — Pantalla de inicio «Conocer MediClaro» (tablero del propietario, pantalla 1).
 *
 *  - Arriba, el logo de MediClaro (el del corazón) y la frase; debajo, la foto de homenaje a la familia
 *    (src/content/homenaje.ts), fundida con el fondo. Sin fotos, en la versión de las tiendas no sale.
 *  - Después, la guía saludando y lo que hace la app.
 *  - «Conocer MediClaro» → explicación con voz y ejemplos, SIN registrarse.
 *  - «Ya soy Premium» → entrar con el teléfono (SMS). «Restaurar compra» → compras de la tienda de este teléfono.
 *  - Siempre visible: acceso a emergencias (112), que nunca requiere pagar ni registrarse.
 *  - «Aa»: tamaño de letra al momento, antes de tener cuenta (personas mayores).
 * Sin compras en la app (EXPO_PUBLIC_PAYMENTS_MODE=none) se comporta como la bienvenida de la 1.1.
 */
import { Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import {
  AppText,
  Icon,
  InfoBanner,
  MediClaroLogo,
  PrimaryButton,
  Screen,
  SecondaryButton,
  TextButton,
  type IconName,
} from '../../components';
import { FadeIn, Pulse, stagger } from '../../components/Motion';
import { GuideIllustration } from '../../components/Guide';
import { useAppTheme, useEntitlement, usePreferences, useSession } from '../../hooks';
import { FONT_SIZE_LABELS, type FontSizePreference } from '../../theme';
import { BrandSplash } from '../auth/BrandSplash';
import { usePurchase } from './usePurchase';
import { ProfileChoice } from '../../components/ProfileChoice';
import { TributePhoto, hasTributePhoto } from '../../components/TributePhoto';

const FEATURES: { icon: IconName; color: string; bg: string; label: string }[] = [
  { icon: 'camera', color: '#2563EB', bg: '#DBEAFE', label: 'Identifica tus medicamentos' },
  { icon: 'chatbubble-ellipses', color: '#2563EB', bg: '#DBEAFE', label: 'Pregunta al asistente IA' },
  { icon: 'volume-high', color: '#7C3AED', bg: '#EDE9FE', label: 'Lee por voz el prospecto' },
  { icon: 'location', color: '#D97706', bg: '#FEF3C7', label: 'Emergencias y ubicación' },
  { icon: 'people', color: '#D97706', bg: '#FEF3C7', label: 'Pensado para ti y tu familia' },
];

const NEXT_SIZE: Record<FontSizePreference, FontSizePreference> = { normal: 'grande', grande: 'muy_grande', muy_grande: 'normal' };

/** «Aa»: cambia el tamaño de la letra en un toque. */
function FontSizeButton() {
  const theme = useAppTheme();
  const { prefs, setFontSize } = usePreferences();
  const current = prefs.fontSize;
  const c = theme.colors;
  return (
    <Pressable
      onPress={() => void setFontSize(NEXT_SIZE[current])}
      accessibilityRole="button"
      accessibilityLabel={`Tamaño de letra: ${FONT_SIZE_LABELS[current]}. Toca para cambiarlo`}
      testID="welcome-font-size"
      hitSlop={6}
      style={({ pressed }) => [
        styles.aa,
        { borderColor: c.border, backgroundColor: pressed ? c.primaryTint : c.surface, minHeight: theme.touchTargets.min },
      ]}
    >
      <AppText variant="bodyStrong" color="heading" maxFontSizeMultiplier={1.2}>
        Aa
      </AppText>
      <AppText variant="small" color="textSecondary" maxFontSizeMultiplier={1.2}>
        {FONT_SIZE_LABELS[current]}
      </AppText>
    </Pressable>
  );
}

export default function WelcomeScreen() {
  const router = useRouter();
  const theme = useAppTheme();
  const { width, height } = useWindowDimensions();
  const { status } = useSession();
  const { ready } = usePreferences();
  const purchase = usePurchase();
  // «Ya soy Premium» y «Restaurar compra» solo si se puede contratar Premium dentro de la app.
  const sell = useEntitlement().canSell;

  if (status === 'loading' || !ready) return <BrandSplash />;

  const columnWidth = Math.min(width, theme.layout.maxContentWidth) - theme.layout.screenPaddingH * 2;
  const bigText = theme.fontSize === 'muy_grande';
  const photo = hasTributePhoto();
  // La foto con su forma (3:2), sin recortar caras, debajo del logo.
  const photoHeight = Math.round(Math.min(columnWidth / 1.49, height * 0.32, 300));
  // Con la foto, la guía se hace algo más pequeña para no alargar tanto la entrada.
  const guideSize = Math.round(Math.min(columnWidth * 0.62, height * (bigText ? 0.2 : photo ? 0.21 : 0.26), 240));

  return (
    <Screen gradient="premium" testID="welcome-screen">
      <View style={[styles.topBar, { marginTop: theme.spacing.xs }]}>
        <FontSizeButton />
      </View>

      <FadeIn from="top" style={styles.center}>
        <MediClaroLogo variant="horizontal" size="lg" />
        <AppText variant="subheading" color="textSecondary" align="center" weight="500" style={[styles.tagline, { marginTop: theme.spacing.xs }]}>
          Entender tus medicamentos puede ser más sencillo.
        </AppText>
      </FadeIn>

      {photo ? (
        <FadeIn from="scale" delay={80} style={{ marginTop: theme.spacing.sm }}>
          <TributePhoto height={photoHeight} />
        </FadeIn>
      ) : null}

      <View style={{marginTop:theme.spacing.md}}><ProfileChoice review /></View>

      <FadeIn from="scale" delay={120} style={[styles.center, { marginVertical: theme.spacing.sm }]}>
        <GuideIllustration size={guideSize} />
      </FadeIn>

      <View style={[styles.features, { gap: theme.spacing.xs }]}>
        {FEATURES.map((f, i) => (
          <FadeIn key={f.label} delay={stagger(i, 70, 260)} from="left">
            <View style={styles.feature} accessible accessibilityLabel={f.label}>
              <View style={[styles.featureIcon, { backgroundColor: f.bg, borderRadius: theme.radius.sm }]}>
                <Icon name={f.icon} size={20} color={f.color} />
              </View>
              <AppText variant="body" color="text" style={styles.flex}>
                {f.label}
              </AppText>
            </View>
          </FadeIn>
        ))}
      </View>

      <FadeIn delay={650} style={{ marginTop: theme.spacing.lg, gap: theme.spacing.xs }}>
        <Pulse>
          <PrimaryButton
            label="Conocer MediClaro"
            icon="play-circle"
            onPress={() => router.push('/tour')}
            accessibilityHint="Te explicamos cómo funciona, con voz y ejemplos, sin registrarte"
            testID="welcome-discover"
          />
        </Pulse>
        <AppText variant="caption" color="textSecondary" align="center">
          Descubre cómo puede ayudarte, sin registrarte.
        </AppText>
      </FadeIn>

      <View style={{ marginTop: theme.spacing.md, gap: theme.spacing.xs }}>
        <SecondaryButton label="Entrar sin Premium" variant="outline" onPress={() => router.push('/(tabs)')} testID="welcome-free" accessibilityHint="Abre el inicio sin teléfono. La IA y la identificación requieren Premium." />
        {purchase.notice ? (
          <InfoBanner tone={purchase.notice.tone} title={purchase.notice.title} message={purchase.notice.message} action={purchase.notice.action} />
        ) : null}
        <SecondaryButton
          label="Ya tengo cuenta · entrar con mi teléfono"
          variant="outline"
          icon={sell ? 'ribbon-outline' : 'call-outline'}
          onPress={() => router.push('/login')}
          accessibilityHint="Entra con tu número de teléfono"
          testID="welcome-premium"
        />
        {sell ? (
          <TextButton
            label={purchase.busy === 'restore' ? 'Comprobando…' : 'Restaurar compra'}
            onPress={() => void purchase.restore()}
            disabled={purchase.busy === 'restore'}
            testID="welcome-restore"
          />
        ) : null}
        <TextButton
          label="¿Es una urgencia? Pulsa aquí"
          tone="danger"
          icon="call"
          onPress={() => router.push('/emergency')}
          accessibilityHint="Abre la pantalla de emergencia con el 112. No necesitas registrarte ni pagar."
          testID="welcome-emergency"
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { alignItems: 'center' },
  topBar: { flexDirection: 'row', justifyContent: 'flex-end' },
  aa: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderRadius: 999, paddingHorizontal: 14 },
  tagline: { maxWidth: 330 },
  features: { alignSelf: 'center', width: '100%', maxWidth: 380 },
  feature: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 36 },
  featureIcon: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
});
