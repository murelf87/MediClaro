/**
 * Foto de homenaje de la entrada, con nuestro estilo y sin que destaque demasiado:
 *  - La foto entera, con esquinas redondeadas, un borde blanco fino y una sombra suave (sin marco grueso), justo
 *    debajo del logo y la frase de MediClaro.
 *  - Una foto: fija. Varias: cambian solas cada 6 s con un fundido suave (sin movimiento si el teléfono pide
 *    «Reducir movimiento»).
 *  - Dedicatoria opcional sobre un degradado, abajo a la izquierda.
 *  - Sin fotos todavía: en las pruebas, un marco «Aquí irá vuestra foto»; en la versión de las tiendas, nada.
 * Las fotos y la dedicatoria se configuran en src/content/homenaje.ts.
 */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Animated, Image, Platform, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { AppText } from './AppText';
import { Icon } from './Icon';
import { MediClaroMark } from './MediClaroLogo';
import { useReduceMotion } from './Motion';
import { useAppTheme } from '../providers/PreferencesProvider';
import { HOMENAJE, type HomenajeFoto } from '../content/homenaje';
import { DEMO_ACCESS_ENABLED } from '../config/app';

const ROTATE_MS = 6000;
const FADE_MS = 900;
const NATIVE = Platform.OS !== 'web';

/** ¿Hay algo que mostrar? (fotos, o el marco de prueba fuera de la versión de las tiendas). */
export function hasTributePhoto(fotos: HomenajeFoto[] = HOMENAJE.fotos): boolean {
  return fotos.length > 0 || __DEV__ || DEMO_ACCESS_ENABLED;
}

/** Marco: la sombra va por fuera y el recorte por dentro (en iOS «overflow: hidden» se come la sombra). */
function Frame({ height, children, testID, label }: { height: number; children: ReactNode; testID: string; label: string }) {
  const theme = useAppTheme();
  const radius = theme.radius.xxl;
  return (
    <View style={[styles.shadowBox, theme.shadow.soft, { height, borderRadius: radius }]}>
      <View
        style={[styles.frame, { borderRadius: radius, borderColor: theme.colors.surface, backgroundColor: theme.colors.primaryTint }]}
        testID={testID}
        accessible
        accessibilityLabel={label}
      >
        {children}
      </View>
    </View>
  );
}

export function TributePhoto({
  height,
  fotos = HOMENAJE.fotos,
  dedicatoria = HOMENAJE.dedicatoria,
}: {
  height: number;
  fotos?: HomenajeFoto[];
  dedicatoria?: string | null;
}) {
  const theme = useAppTheme();
  const reduce = useReduceMotion();
  const [index, setIndex] = useState(0);
  const shown = useRef(0);
  const [opacities] = useState(() => fotos.map((_, i) => new Animated.Value(i === 0 ? 1 : 0)));
  const rotate = fotos.length > 1 && opacities.length === fotos.length && !reduce;

  useEffect(() => {
    if (!rotate) return undefined;
    const timer = setInterval(() => {
      const current = shown.current;
      const next = (current + 1) % fotos.length;
      shown.current = next;
      Animated.parallel([
        Animated.timing(opacities[current], { toValue: 0, duration: FADE_MS, useNativeDriver: NATIVE }),
        Animated.timing(opacities[next], { toValue: 1, duration: FADE_MS, useNativeDriver: NATIVE }),
      ]).start();
      setIndex(next);
    }, ROTATE_MS);
    return () => clearInterval(timer);
  }, [rotate, fotos.length, opacities]);

  if (!fotos.length) {
    if (!hasTributePhoto(fotos)) return null;
    return (
      <Frame height={height} testID="tribute-placeholder" label="Aquí irá la foto de homenaje a la familia">
        <LinearGradient colors={['#D9E8FF', '#EDF4FF', '#F8FBFF']} style={StyleSheet.absoluteFill} />
        <View style={[styles.placeholder, { borderRadius: theme.radius.xl, borderColor: theme.colors.primary }]}>
          <View style={[styles.placeholderIcon, { backgroundColor: theme.colors.surface }]}>
            <Icon name="images-outline" size={30} color="primary" />
          </View>
          <AppText variant="heading" color="heading" align="center">Aquí irá vuestra foto</AppText>
          <AppText variant="caption" color="textSecondary" align="center" style={styles.placeholderText}>
            Foto de homenaje a la familia. Este marco solo se ve en las pruebas.
          </AppText>
          <View style={styles.placeholderMark}>
            <MediClaroMark size={26} accessibilityLabel="" />
          </View>
        </View>
      </Frame>
    );
  }

  const current = fotos[Math.min(index, fotos.length - 1)];
  const radius = theme.radius.xxl;
  return (
    <View style={[styles.photoShadow, { height, borderRadius: radius }]}>
      <View
        style={[styles.photoFrame, { borderRadius: radius }]}
        testID="tribute-photo"
        accessible
        accessibilityRole="image"
        accessibilityLabel={current.descripcion}
      >
        {fotos.map((foto, i) => (
          <Animated.View key={i} style={[StyleSheet.absoluteFill, { opacity: opacities[i] ?? (i === 0 ? 1 : 0) }]}>
            <Image source={foto.source} style={styles.image} resizeMode="cover" accessibilityIgnoresInvertColors />
          </Animated.View>
        ))}
        {dedicatoria || fotos.length > 1 ? (
          <LinearGradient colors={['rgba(15,23,42,0)', 'rgba(15,23,42,0.5)']} style={styles.scrim} pointerEvents="none" />
        ) : null}
        {dedicatoria ? (
          <View style={styles.caption} pointerEvents="none">
            <Icon name="heart" size={16} color="#FFFFFF" />
            <AppText variant="bodyStrong" style={styles.captionText} numberOfLines={2}>{dedicatoria}</AppText>
          </View>
        ) : null}
        {fotos.length > 1 ? (
          <View style={styles.dots} pointerEvents="none" importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
            {fotos.map((_, i) => (
              <View key={i} style={[styles.dot, i === index ? styles.dotOn : null]} />
            ))}
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  shadowBox: { width: '100%' },
  frame: { flex: 1, overflow: 'hidden', borderWidth: 4 },
  image: { width: '100%', height: '100%' },
  photoShadow: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    shadowColor: '#1E3A8A',
    shadowOpacity: 0.12,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  photoFrame: { flex: 1, overflow: 'hidden', borderWidth: 2, borderColor: 'rgba(255,255,255,0.9)' },
  scrim: { position: 'absolute', left: 0, right: 0, bottom: 0, height: '45%' },
  caption: { position: 'absolute', left: 16, right: 16, bottom: 16, flexDirection: 'row', alignItems: 'center', gap: 8 },
  captionText: { color: '#FFFFFF', flex: 1 },
  dots: { position: 'absolute', right: 14, bottom: 14, flexDirection: 'row', gap: 6 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.55)' },
  dotOn: { backgroundColor: '#FFFFFF', width: 18 },
  placeholder: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, margin: 12, borderWidth: 1.5, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 16 },
  placeholderIcon: { width: 60, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center' },
  placeholderText: { maxWidth: 280 },
  placeholderMark: { position: 'absolute', top: 12, left: 12, opacity: 0.9 },
});
