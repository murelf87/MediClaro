/**
 * Botones de emergencia.
 *
 * - EmergencyCallButton (ROJO): número oficial (112). Siempre visible y
 *   SIEMPRE una pulsación explícita del usuario. Nunca se activa solo.
 * - AssistanceCallButton (AZUL): servicio privado de asistencia del usuario.
 *   Es independiente del 112 y visualmente distinto.
 */
import { View, StyleSheet } from 'react-native';
import { PrimaryButton, SecondaryButton } from './Buttons';
import { AppText } from './AppText';
import { useAppTheme } from '../providers/PreferencesProvider';

export function EmergencyCallButton({
  number = '112',
  onPress,
  label,
  variant = 'solid',
  size = 'lg',
  loading,
}: {
  number?: string;
  onPress: () => void;
  label?: string;
  variant?: 'solid' | 'soft';
  size?: 'md' | 'lg';
  loading?: boolean;
}) {
  const text = label ?? `Llamar al ${number}`;
  if (variant === 'soft') {
    return (
      <SecondaryButton
        label={text}
        onPress={onPress}
        icon="call"
        variant="dangerTonal"
        size={size}
        loading={loading}
        accessibilityHint={`Abre el teléfono para llamar al ${number}, el número oficial de emergencias`}
      />
    );
  }
  return (
    <PrimaryButton
      label={text}
      onPress={onPress}
      icon="call"
      tone="danger"
      size={size}
      loading={loading}
      accessibilityHint={`Abre el teléfono para llamar al ${number}, el número oficial de emergencias`}
    />
  );
}

export function AssistanceCallButton({
  name,
  onPress,
  loading,
  variant = 'solid',
  label: customLabel,
}: {
  name: string;
  onPress: () => void;
  loading?: boolean;
  variant?: 'solid' | 'outline';
  /** Texto propio (por defecto "Llamar a {name}"). */
  label?: string;
}) {
  const label = customLabel ?? `Llamar a ${name}`;
  const hint = `Llama a tu servicio privado de asistencia. Es distinto del 112.`;
  return variant === 'outline' ? (
    <SecondaryButton label={label} onPress={onPress} icon="headset" variant="outline" size="lg" loading={loading} accessibilityHint={hint} />
  ) : (
    <PrimaryButton label={label} onPress={onPress} icon="headset" size="lg" loading={loading} accessibilityHint={hint} />
  );
}

/** Nota fija que recuerda que el 112 es independiente del servicio privado. */
export function OfficialEmergencyNote({ number = '112' }: { number?: string }) {
  const theme = useAppTheme();
  return (
    <View style={[styles.note, { borderColor: theme.colors.border, borderRadius: theme.radius.md }]}>
      <AppText variant="caption" color="textSecondary" align="center">
        {`El ${number} es el servicio oficial de emergencias. Es independiente de tu servicio privado de asistencia y nunca se llama sin que tú lo pulses.`}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  note: { borderWidth: 1, padding: 12 },
});
