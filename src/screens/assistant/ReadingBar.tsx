/**
 * Barra de lectura de cada respuesta del chat. Va DEBAJO del globo (no dentro): el globo se queda solo con el texto.
 *  - «Repetir explicación» (mientras suena, «Detener»): vuelve a leer la respuesta en voz alta.
 *  - Velocidad con tres animales pequeños: caracol (muy muy lento), tortuga (lento) y conejo (normal). El elegido se queda
 *    encendido y cada animal lleva su nombre escrito, para quien no conozca los dibujos.
 * Todo es discreto a la vista pero cómodo de tocar: la zona táctil de cada pieza llega a 48 puntos de alto.
 */
import { Pressable, StyleSheet, View } from 'react-native';
import { AppText, Icon } from '../../components';
import { useAppTheme } from '../../hooks';
import { ASSISTANT_SPEEDS, type AssistantSpeedKey } from '../../services/AssistantSpeed';

/** Amplía la zona táctil por arriba y por abajo sin cambiar lo que se ve. */
const TOUCH_SLOP = { top: 4, bottom: 4 } as const;

export function ReadingBar({
  speaking,
  speed,
  onToggleSpeak,
  onSelectSpeed,
}: {
  /** La respuesta se está leyendo (o preparando la voz) ahora mismo. */
  speaking: boolean;
  speed: AssistantSpeedKey;
  onToggleSpeak: () => void;
  onSelectSpeed: (speed: AssistantSpeedKey) => void;
}) {
  const theme = useAppTheme();
  const c = theme.colors;
  const compactHeight = theme.easyMode ? 52 : 44;
  return (
    <View style={styles.bar} testID="assistant-reading-bar">
      {/* Mientras suena es «Detener» (relleno, se ve que está activo); cuando acaba, «Repetir explicación». */}
      <Pressable
        onPress={onToggleSpeak}
        hitSlop={TOUCH_SLOP}
        accessibilityRole="button"
        accessibilityLabel={speaking ? 'Detener' : 'Repetir explicación'}
        accessibilityHint={speaking ? undefined : 'Vuelve a leer esta respuesta en voz alta, a la velocidad elegida'}
        testID={speaking ? 'assistant-stop' : 'assistant-repeat'}
        style={({ pressed }) => [
          styles.action,
          {
            minHeight: compactHeight,
            borderColor: c.primary,
            backgroundColor: speaking ? (pressed ? c.primaryPressed : c.primary) : pressed ? c.primaryTint : c.surface,
          },
        ]}
      >
        <Icon name={speaking ? 'stop' : 'volume-high'} size={20} color={speaking ? c.onPrimary : c.primary} />
        <AppText variant="label" style={{ color: speaking ? c.onPrimary : c.primary }} accessible={false}>
          {speaking ? 'Detener' : 'Repetir explicación'}
        </AppText>
      </Pressable>

      <View
        style={[styles.track, { backgroundColor: c.primaryTint, borderColor: c.primarySoft }]}
        accessibilityRole="radiogroup"
        accessibilityLabel="Velocidad de lectura"
      >
        {ASSISTANT_SPEEDS.map((option) => {
          const on = option.key === speed;
          return (
            <Pressable
              key={option.key}
              onPress={() => onSelectSpeed(option.key)}
              hitSlop={TOUCH_SLOP}
              accessibilityRole="radio"
              accessibilityLabel={option.spoken}
              accessibilityState={{ selected: on }}
              testID={`assistant-speed-${option.key}`}
              style={({ pressed }) => [
                styles.segment,
                { backgroundColor: on ? (pressed ? c.primaryPressed : c.primary) : pressed ? c.primarySoft : 'transparent' },
              ]}
            >
              <AppText style={styles.emoji} accessible={false}>
                {option.emoji}
              </AppText>
              <AppText variant="small" style={{ color: on ? c.onPrimary : c.textSecondary }} accessible={false}>
                {option.label}
              </AppText>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // Si no caben en una línea (móvil estrecho o letra muy grande), la velocidad pasa debajo de «Repetir explicación».
  bar: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: 10, rowGap: 8, marginTop: 8 },
  action: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1.5, borderRadius: 999, paddingHorizontal: 16, paddingVertical: 6 },
  track: { flexDirection: 'row', alignItems: 'center', gap: 2, borderWidth: 1, borderRadius: 999, padding: 3 },
  segment: { alignItems: 'center', justifyContent: 'center', minWidth: 68, borderRadius: 999, paddingVertical: 3, paddingHorizontal: 8 },
  emoji: { fontSize: 21, lineHeight: 25 },
});
