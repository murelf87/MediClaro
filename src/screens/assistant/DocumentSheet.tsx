/**
 * Clip del chat: «Explicar un documento». Dos botones grandes (hacer una foto / elegir de la galería) y un aviso claro
 * de qué pasa con la foto. Letra grande y pocas opciones: pensado para personas mayores.
 */
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { AppText, Icon, TextButton } from '../../components';
import { useAppTheme } from '../../hooks';

export function DocumentSheet({ visible, busy, onCamera, onLibrary, onClose }: { visible: boolean; busy?: boolean; onCamera: () => void; onLibrary: () => void; onClose: () => void }) {
  const theme = useAppTheme();
  const c = theme.colors;
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
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} accessibilityViewIsModal>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Cerrar" accessibilityRole="button" />
      <View style={[styles.sheet, { backgroundColor: c.surface, borderColor: c.border, padding: theme.spacing.lg, gap: theme.spacing.md }]} testID="assistant-document-sheet">
        <AppText variant="subheading" color="heading" accessibilityRole="header">
          Explicar un documento
        </AppText>
        <AppText variant="body" color="textSecondary">
          Haz una foto a un informe, una receta, una analítica o un prospecto, y te lo explico con palabras sencillas. Puedes enviar hasta 3 fotos.
        </AppText>
        {option('camera', 'Hacer una foto', 'Abre la cámara', onCamera, 'assistant-document-camera')}
        {option('images', 'Elegir de la galería', 'Elige hasta 3 fotos que ya tengas', onLibrary, 'assistant-document-library')}
        <AppText variant="small" color="textSecondary">
          La foto no se guarda en MediClaro: solo se usa para explicártelo. Lo que te explico no sustituye a tu médico ni a tu farmacéutico.
        </AppText>
        <TextButton label="Cerrar" onPress={onClose} align="center" testID="assistant-document-close" />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.45)' },
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, borderWidth: 1 },
  option: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, borderRadius: 16, paddingHorizontal: 16, paddingVertical: 12 },
});
