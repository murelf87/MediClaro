/**
 * Imagen principal de bienvenida.
 * Si el propietario añade la fotografía de marca (src/config/brandAssets.ts),
 * se muestra; si no, una composición vectorial de marca (nunca un hueco vacío).
 */
import { Image, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BRAND_HERO_IMAGE } from '../config/brandAssets';
import { PhotoIllustration } from './Illustrations';
import { useAppTheme } from '../providers/PreferencesProvider';

export function BrandHero({ height = 220 }: { height?: number }) {
  const theme = useAppTheme();
  if (BRAND_HERO_IMAGE) {
    return (
      <View style={[styles.wrap, { height, borderRadius: theme.radius.xl }]}>
        <Image
          source={BRAND_HERO_IMAGE}
          style={StyleSheet.absoluteFill}
          resizeMode="cover"
          accessibilityLabel="Pareja de personas mayores sonriendo"
        />
        <LinearGradient
          colors={['rgba(255,255,255,0)', 'rgba(255,255,255,0.0)', 'rgba(255,255,255,0.95)']}
          locations={[0, 0.7, 1]}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
      </View>
    );
  }
  return (
    <View style={[styles.wrap, styles.center, { height }]}>
      <PhotoIllustration size={Math.min(height, 260)} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: '100%', overflow: 'hidden' },
  center: { alignItems: 'center', justifyContent: 'center' },
});
