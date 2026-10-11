/**
 * «Conversaciones» del asistente: abrir una conversación NUEVA (las anteriores se conservan) o volver a una anterior.
 * Letra grande y pocas opciones: pensado para personas mayores.
 */
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { AppText, Icon, TextButton } from '../../components';
import { useAppTheme } from '../../hooks';
import type { AssistantThread } from '../../services/AssistantThreads';

export function ConversationsSheet({
  visible,
  threads,
  activeKey,
  canStartNew,
  onNew,
  onSelect,
  onClose,
}: {
  visible: boolean;
  threads: AssistantThread[];
  activeKey: string;
  /** Falso si la conversación abierta aún no tiene ninguna pregunta (ya es «nueva»). */
  canStartNew: boolean;
  onNew: () => void;
  onSelect: (key: string) => void;
  onClose: () => void;
}) {
  const theme = useAppTheme();
  const c = theme.colors;
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} accessibilityViewIsModal>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Cerrar" accessibilityRole="button" />
      <View style={[styles.sheet, { backgroundColor: c.surface, borderColor: c.border, padding: theme.spacing.lg, gap: theme.spacing.md }]}>
        <AppText variant="subheading" color="heading" accessibilityRole="header">
          Conversaciones
        </AppText>

        <Pressable
          onPress={onNew}
          disabled={!canStartNew}
          accessibilityRole="button"
          accessibilityLabel="Nueva conversación"
          accessibilityHint="Abre una conversación vacía. Las anteriores se guardan"
          accessibilityState={{ disabled: !canStartNew }}
          testID="assistant-new-chat"
          style={({ pressed }) => [
            styles.newButton,
            { backgroundColor: pressed ? c.primaryPressed : c.primary, opacity: canStartNew ? 1 : 0.5, minHeight: theme.touchTargets.min },
          ]}
        >
          <Icon name="add-circle-outline" size={26} color={c.onPrimary} />
          <AppText variant="bodyStrong" style={{ color: c.onPrimary }}>
            Nueva conversación
          </AppText>
        </Pressable>

        {threads.length > 0 ? (
          <>
            <AppText variant="captionStrong" color="textSecondary">
              Anteriores
            </AppText>
            <ScrollView style={styles.list} contentContainerStyle={{ gap: theme.spacing.xs }}>
              {threads.map((t) => {
                const selected = t.key === activeKey;
                return (
                  <Pressable
                    key={t.key}
                    onPress={() => onSelect(t.key)}
                    accessibilityRole="button"
                    accessibilityLabel={`${t.title}${selected ? ', conversación abierta' : ''}`}
                    accessibilityState={{ selected }}
                    testID={`assistant-chat-${t.key}`}
                    style={({ pressed }) => [
                      styles.row,
                      {
                        borderColor: selected ? c.primary : c.border,
                        backgroundColor: selected ? c.primaryTint : pressed ? c.surfaceMuted : c.surface,
                        minHeight: theme.touchTargets.min,
                      },
                    ]}
                  >
                    <Icon name={selected ? 'chatbubble-ellipses' : 'chatbubble-outline'} size={22} color={c.primary} />
                    <AppText variant="body" color="text" numberOfLines={2} style={styles.flex}>
                      {t.title}
                    </AppText>
                    <AppText variant="small" color="textSecondary">
                      {new Date(t.updatedAt).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
                    </AppText>
                  </Pressable>
                );
              })}
            </ScrollView>
          </>
        ) : (
          <AppText variant="body" color="textSecondary">
            Aquí aparecerán tus conversaciones anteriores.
          </AppText>
        )}

        <TextButton label="Cerrar" onPress={onClose} align="center" testID="assistant-chats-close" />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.45)' },
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, borderWidth: 1, maxHeight: '75%' },
  newButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, borderRadius: 16, paddingHorizontal: 16, paddingVertical: 12 },
  list: { flexGrow: 0 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1.5, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 8 },
  flex: { flex: 1 },
});
