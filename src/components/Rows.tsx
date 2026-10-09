/**
 * Filas de acción y de ajustes.
 *  - ActionRow: acciones del Inicio (tarjeta principal azul y filas tintadas).
 *  - SettingRow: filas de Perfil/Ajustes (icono, texto, valor, flecha o interruptor).
 */
import { type ReactNode } from 'react';
import { Pressable, StyleSheet, Switch, View, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { AppText } from './AppText';
import { FitText } from './FitText';
import { Icon, type IconName } from './Icon';
import { useAppTheme } from '../providers/PreferencesProvider';

export type ActionTone = 'primary' | 'success' | 'ai' | 'info' | 'danger';

export function ActionRow({
  icon,
  label,
  sublabel,
  tone,
  onPress,
  hero = false,
  locked = false,
  testID,
}: {
  icon: IconName;
  label: string;
  sublabel?: string;
  tone: ActionTone;
  onPress: () => void;
  /** Tarjeta principal (azul degradado con icono en recuadro blanco). */
  hero?: boolean;
  /** Función de Premium sin activar: muestra un candado con «Premium». */
  locked?: boolean;
  testID?: string;
}) {
  const theme = useAppTheme();
  const c = theme.colors;
  const palette = {
    primary: { bg: c.primaryTint, tile: c.primary, fg: c.heading, chevron: c.primary },
    success: { bg: c.successSoft, tile: c.successStrong, fg: c.heading, chevron: c.successStrong },
    ai: { bg: c.aiSoft, tile: c.ai, fg: c.aiText, chevron: c.ai },
    info: { bg: '#EAF2FD', tile: '#2F80ED', fg: c.heading, chevron: '#2F80ED' },
    danger: { bg: c.dangerSoft, tile: c.danger, fg: c.dangerText, chevron: c.danger },
  }[tone];

  const minHeight = hero ? Math.max(92, theme.actionHeight + 24) : theme.actionHeight;
  // Móviles estrechos (iPhone SE, 320-360 px): recuadros y márgenes algo menores para que el texto quepa entero.
  const { width } = useWindowDimensions();
  const compact = width < 380;
  const tileSize = hero ? (compact ? 48 : 56) : compact ? 40 : 44;

  const inner = (
    <View style={[styles.actionInner, compact ? styles.actionInnerCompact : null]}>
      <View
        style={[
          styles.tile,
          { width: tileSize, height: tileSize },
          { backgroundColor: hero ? '#FFFFFF' : palette.tile, borderRadius: hero ? 16 : 12 },
        ]}
      >
        <Icon name={icon} size={hero ? (compact ? 26 : 30) : compact ? 20 : 22} color={hero ? c.primary : '#FFFFFF'} />
      </View>
      <View style={styles.actionText}>
        {/* Nunca se parte una palabra: la principal puede ir en dos líneas; las demás, en una (todas al mismo tamaño
            dentro de un FitGroup). */}
        <FitText
          variant={hero ? 'heading' : 'bodyStrong'}
          fit={hero ? 'words' : 'line'}
          minScale={hero ? 0.7 : 0.75}
          style={{ color: hero ? '#FFFFFF' : palette.fg }}
        >
          {label}
        </FitText>
        {sublabel ? (
          <AppText variant="caption" style={{ color: hero ? 'rgba(255,255,255,0.9)' : c.textSecondary }}>
            {sublabel}
          </AppText>
        ) : null}
      </View>
      {/* Función de Premium sin activar: un candado pequeño en lugar de la flecha (así la letra de todas las filas se
          mantiene igual y nada se parte en móviles estrechos; el nombre de la función lo dice la etiqueta accesible). */}
      {locked ? (
        <View style={[styles.lock, { backgroundColor: hero ? 'rgba(255,255,255,0.22)' : c.premiumSoft }]}>
          <Icon name="lock-closed" size={15} color={hero ? '#FFFFFF' : c.premiumText} />
        </View>
      ) : (
        <Icon name="chevron-forward" size={compact ? 20 : 24} color={hero ? '#FFFFFF' : palette.chevron} />
      )}
    </View>
  );

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${sublabel ? `${label}. ${sublabel}` : label}${locked ? '. Función de MediClaro Premium' : ''}`}
      testID={testID}
      style={({ pressed }) => [
        styles.action,
        { minHeight, borderRadius: theme.radius.lg, backgroundColor: hero ? c.primary : palette.bg },
        hero ? theme.shadow.button : null,
        { opacity: pressed ? 0.88 : 1, transform: [{ scale: pressed ? 0.99 : 1 }] },
      ]}
    >
      {hero ? (
        <LinearGradient
          colors={['#3B82F6', '#2563EB', '#1D4ED8']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[StyleSheet.absoluteFill, { borderRadius: theme.radius.lg }]}
        />
      ) : null}
      {inner}
    </Pressable>
  );
}

export interface SettingRowProps {
  icon?: IconName;
  iconColor?: string;
  /** Contenido a medida en lugar del icono (p. ej. "Aa"). */
  leading?: ReactNode;
  label: string;
  description?: string;
  value?: string;
  valueTone?: 'primary' | 'success' | 'muted';
  onPress?: () => void;
  /** Muestra un interruptor en lugar de la flecha. */
  toggle?: { value: boolean; onChange: (v: boolean) => void; disabled?: boolean };
  destructive?: boolean;
  right?: ReactNode;
  showChevron?: boolean;
  /** Fila informativa seleccionada (p. ej. idioma actual). */
  selected?: boolean;
  accessibilityHint?: string;
  testID?: string;
}

export function SettingRow({
  icon,
  iconColor,
  leading,
  label,
  description,
  value,
  valueTone = 'primary',
  onPress,
  toggle,
  destructive,
  right,
  showChevron,
  selected,
  accessibilityHint,
  testID,
}: SettingRowProps) {
  const theme = useAppTheme();
  const c = theme.colors;
  const labelColor = destructive ? c.dangerText : c.heading;
  const valueColor = valueTone === 'success' ? c.successText : valueTone === 'muted' ? c.textSecondary : c.primary;
  const chevron = showChevron ?? (!!onPress && !toggle);

  const content = (
    <View style={[styles.settingInner, { minHeight: theme.touchTargets.comfortable + 4 }]}>
      {leading ?? (icon ? (
        <View style={styles.settingIcon}>
          <Icon name={icon} size={24} color={iconColor ?? (destructive ? c.danger : c.heading)} />
        </View>
      ) : null)}
      <View style={styles.settingText}>
        <AppText variant="label" style={{ color: labelColor }}>
          {label}
        </AppText>
        {description ? (
          <AppText variant="caption" color="textSecondary">
            {description}
          </AppText>
        ) : null}
      </View>
      {value ? (
        <AppText variant="label" style={[{ color: valueColor }, styles.value]} numberOfLines={2} align="right">
          {value}
        </AppText>
      ) : null}
      {right}
      {toggle ? (
        <Switch
          value={toggle.value}
          onValueChange={toggle.onChange}
          disabled={toggle.disabled}
          trackColor={{ true: c.primary, false: c.borderStrong }}
          thumbColor="#FFFFFF"
          ios_backgroundColor={c.borderStrong}
          accessibilityLabel={label}
        />
      ) : null}
      {chevron ? <Icon name="chevron-forward" size={22} color={c.textMuted} /> : null}
    </View>
  );

  if (toggle && !onPress) {
    return (
      <Pressable
        onPress={() => !toggle.disabled && toggle.onChange(!toggle.value)}
        accessibilityRole="switch"
        accessibilityLabel={label}
        accessibilityHint={description}
        accessibilityState={{ checked: toggle.value, disabled: !!toggle.disabled }}
        testID={testID}
        style={({ pressed }) => [styles.setting, { opacity: pressed ? 0.8 : 1 }]}
      >
        {content}
      </Pressable>
    );
  }
  if (!onPress) {
    const parts = [label, value, description].filter(Boolean).join('. ');
    return (
      <View
        style={styles.setting}
        testID={testID}
        accessible
        accessibilityLabel={parts}
        accessibilityState={selected !== undefined ? { selected } : undefined}
      >
        {content}
      </View>
    );
  }
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={value ? `${label}: ${value}` : label}
      accessibilityHint={accessibilityHint}
      testID={testID}
      style={({ pressed }) => [styles.setting, { backgroundColor: pressed ? c.surfaceAlt : 'transparent' }]}
    >
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  lock: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  action: { overflow: 'hidden', justifyContent: 'center' },
  actionInner: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, gap: 14 },
  actionInnerCompact: { paddingHorizontal: 12, gap: 10 },
  tile: { alignItems: 'center', justifyContent: 'center' },
  actionText: { flex: 1, gap: 2 },
  setting: { paddingHorizontal: 16 },
  settingInner: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 10 },
  settingIcon: { width: 30, alignItems: 'center' },
  // El valor de la derecha nunca pasa del 45 % del ancho: el texto de la fila no se queda en una columna estrecha.
  settingText: { flex: 1, gap: 2 },
  value: { flexShrink: 1, maxWidth: '45%' },
});
