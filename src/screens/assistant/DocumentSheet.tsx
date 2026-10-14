/**
 * Clip del chat: «Explicar un documento». Dos botones grandes (hacer una foto / elegir de la galería) y un aviso claro
 * de qué pasa con la foto. Letra grande y pocas opciones: pensado para personas mayores.
 *
 * Es una CAPA de la pantalla (se pinta con `Screen.overlay`), NO un `Modal`: al elegir una opción se cierra al instante y la
 * cámara o la galería se abren sobre la pantalla ya libre. Con un `Modal` el iPhone no deja presentar el selector mientras la
 * ventana aún se está cerrando, y no pasaba nada (ni cámara ni galería).
 */
import { useEffect, useRef } from 'react';
import { Animated, BackHandler, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { AppText, Icon, TextButton } from '../../components';
import { useReduceMotion } from '../../components/Motion';
import { useAppTheme } from '../../hooks';

/** Lo que sobresale por encima de la barra de pestañas el botón redondo del centro («Cuidador/a»). */
const TAB_CENTER_BUTTON_OVERHANG = 20;

export function DocumentSheet({
  visible,
  busy,
  bottomInset = 0,
  onCamera,
  onLibrary,
  onClose,
}: {
  visible: boolean;
  busy?: boolean;
  /** Espacio de la barra de gestos del móvil bajo la hoja (0 si ya lo cubre la barra de pestañas). */
  bottomInset?: number;
  onCamera: () => void;
  onLibrary: () => void;
  onClose: () => void;
}) {
  const theme = useAppTheme();
  const c = theme.colors;
  const reduceMotion = useReduceMotion();
  const appear = useRef(new Animated.Value(visible ? 1 : 0)).current;

  // Sube suavemente al abrirse (sin movimiento si la persona lo tiene desactivado). Al cerrarse desaparece al instante.
  useEffect(() => {
    if (!visible) {
      appear.setValue(0);
      return undefined;
    }
    if (reduceMotion) {
      appear.setValue(1);
      return undefined;
    }
    appear.setValue(0);
    const animation = Animated.timing(appear, { toValue: 1, duration: 220, useNativeDriver: Platform.OS !== 'web' });
    animation.start();
    return () => animation.stop();
  }, [visible, reduceMotion, appear]);

  // Atrás de Android cierra la hoja (con un Modal lo hacía `onRequestClose`).
  useEffect(() => {
    if (!visible || Platform.OS !== 'android') return undefined;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      onClose();
      return true;
    });
    return () => subscription.remove();
  }, [visible, onClose]);

  if (!visible) return null;

  const option = (icon: 'camera' | 'images', label: string, hint: string, onPress: () => void, testID: string) => (
    <Pressable
      onPress={onPress}
      disabled={busy}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={hint}
      testID={testID}
      style={({ pressed }) => [styles.option, { backgroundColor: pressed ? c.primaryPressed : c.primary, minHeight: theme.touchTargets.large, opacity: busy ? 0.5 : 1 }]}
    >
      <Icon name={icon} size={28} color={c.onPrimary} />
      <AppText variant="bodyStrong" style={{ color: c.onPrimary }}>
        {label}
      </AppText>
    </Pressable>
  );

  return (
    <View style={styles.root} accessibilityViewIsModal testID="assistant-document-overlay">
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: appear }]}>
        <Pressable style={[StyleSheet.absoluteFill, styles.backdrop]} onPress={onClose} accessibilityLabel="Cerrar" accessibilityRole="button" testID="assistant-document-backdrop" />
      </Animated.View>
      <Animated.View
        style={[
          styles.sheet,
          {
            backgroundColor: c.surface,
            borderColor: c.border,
            paddingBottom: bottomInset,
            opacity: appear,
            transform: [{ translateY: appear.interpolate({ inputRange: [0, 1], outputRange: [60, 0] }) }],
          },
        ]}
        testID="assistant-document-sheet"
      >
        {/* Título y «Cerrar» siempre a la vista, aunque el contenido no quepa. */}
        <View style={[styles.header, { paddingHorizontal: theme.spacing.lg, paddingTop: theme.spacing.md, gap: theme.spacing.sm }]}>
          <AppText variant="subheading" color="heading" accessibilityRole="header" style={styles.title}>
            Explicar un documento
          </AppText>
          <TextButton label="Cerrar" onPress={onClose} align="center" testID="assistant-document-close" />
        </View>
        {/* Con letra muy grande en un móvil bajo el resto puede no caber: se desplaza dentro de la hoja. */}
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={{
            paddingHorizontal: theme.spacing.lg,
            // Con la barra de pestañas debajo (sin margen de gestos), su botón central sobresale por encima: el último texto queda libre.
            paddingBottom: theme.spacing.lg + (bottomInset > 0 ? 0 : TAB_CENTER_BUTTON_OVERHANG),
            gap: theme.spacing.md,
          }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          <AppText variant="body" color="textSecondary">
            Haz una foto a un informe, una receta, una analítica o un prospecto, y te lo explico con palabras sencillas. Puedes enviar hasta 3 fotos.
          </AppText>
          {option('camera', 'Hacer una foto', 'Abre la cámara', onCamera, 'assistant-document-camera')}
          {option('images', 'Elegir de la galería', 'Elige hasta 3 fotos que ya tengas', onLibrary, 'assistant-document-library')}
          <AppText variant="small" color="textSecondary">
            La foto no se guarda en MediClaro: solo se usa para explicártelo. Lo que te explico no sustituye a tu médico ni a tu farmacéutico.
          </AppText>
        </ScrollView>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  // Encima de todo lo demás de la pantalla (también en Android, donde `elevation` manda sobre el orden).
  root: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'flex-end', zIndex: 50, elevation: 50 },
  backdrop: { backgroundColor: 'rgba(15, 23, 42, 0.45)' },
  sheet: {
    width: '100%',
    maxWidth: 640,
    maxHeight: '92%',
    alignSelf: 'center',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    overflow: 'hidden',
  },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { flex: 1 },
  scroll: { flexGrow: 0 },
  option: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, borderRadius: 16, paddingHorizontal: 16, paddingVertical: 12 },
});
