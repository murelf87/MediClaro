/**
 * Etiqueta flotante de la vista previa del propietario: «Vista: Básico (gratis) · Salir».
 * Un marco ámbar alrededor de la pantalla recuerda que es una vista previa (no es lo que ve el propietario de verdad).
 * «Salir» vuelve a la app real y al panel «Revisar la app».
 */
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, type Href } from 'expo-router';
import { AppText, Icon } from './index';
import { useOwnerPreview } from '../hooks/useOwnerPreview';
import { OwnerPreview, PREVIEW_LABEL } from '../services/OwnerPreview';
import { PostAuthRoute } from '../services/PostAuthRoute';

const AMBER = '#F59E0B';

export function OwnerPreviewBanner() {
  const role = useOwnerPreview();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  if (!role) return null;

  const exit = () => {
    // Desde «Sin cuenta» la app vuelve a tener sesión: la protección de rutas llevará al panel, no al Inicio.
    if (OwnerPreview.get() === 'visitor') PostAuthRoute.set('/owner/review');
    OwnerPreview.clear();
    router.replace('/owner/review' as Href);
  };

  return (
    <View pointerEvents="box-none" style={StyleSheet.absoluteFill} testID="owner-preview-banner">
      <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.frame]} />
      <View pointerEvents="box-none" style={[styles.wrap, { top: insets.top + 2 }]}>
        <View style={styles.pill}>
          <Icon name="eye" size={16} color="#FFFFFF" />
          <AppText style={styles.text} numberOfLines={1} maxFontSizeMultiplier={1.1}>
            {`Vista: ${PREVIEW_LABEL[role]}`}
          </AppText>
          <Pressable
            onPress={exit}
            accessibilityRole="button"
            accessibilityLabel={`Salir de la vista previa como ${PREVIEW_LABEL[role]}`}
            hitSlop={10}
            testID="owner-preview-exit"
            style={({ pressed }) => [styles.exit, { opacity: pressed ? 0.75 : 1 }]}
          >
            <AppText style={styles.exitText} maxFontSizeMultiplier={1.1}>
              Salir
            </AppText>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { borderWidth: 3, borderColor: AMBER },
  wrap: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    maxWidth: '92%',
    paddingLeft: 12,
    paddingRight: 4,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(17,24,39,0.92)',
    borderWidth: 2,
    borderColor: AMBER,
  },
  text: { color: '#FFFFFF', fontSize: 13, lineHeight: 17, fontWeight: '700', flexShrink: 1 },
  exit: { backgroundColor: AMBER, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 5 },
  exitText: { color: '#111827', fontSize: 13, lineHeight: 17, fontWeight: '800' },
});
