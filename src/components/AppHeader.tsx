/**
 * Cabecera de pantalla: "← Volver", título y acción opcional a la derecha.
 * Nunca deja a la persona atrapada: si no hay historial, vuelve al Inicio.
 */
import { type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { AppText } from './AppText';
import { Icon, type IconName } from './Icon';
import { useAppTheme } from '../providers/PreferencesProvider';

export interface AppHeaderProps {
  title?: string;
  /** Contenido central en lugar del título (p. ej. el logo de MediClaro). */
  center?: ReactNode;
  /** Icono pequeño junto al título (p. ej. candado en "Pago seguro"). */
  titleIcon?: IconName;
  showBack?: boolean;
  onBack?: () => void;
  /** Destino si no hay pantalla anterior. */
  fallbackHref?: Href;
  right?: ReactNode;
  tone?: 'default' | 'inverse' | 'danger';
  /** Texto del botón volver en lugar de la flecha sola (p. ej. "Cancelar"). */
  backLabel?: string;
  backIcon?: IconName;
}

export function AppHeader({
  title,
  center,
  titleIcon,
  showBack = true,
  onBack,
  fallbackHref = '/(tabs)',
  right,
  tone = 'default',
  backLabel,
  backIcon = 'chevron-back',
}: AppHeaderProps) {
  const theme = useAppTheme();
  const router = useRouter();
  const color = tone === 'inverse' ? theme.colors.textInverse : tone === 'danger' ? theme.colors.dangerText : theme.colors.heading;

  const goBack = () => {
    if (onBack) return onBack();
    if (router.canGoBack()) router.back();
    else router.replace(fallbackHref);
  };

  const separateTitle = !!title && !center && (!!right || !!backLabel);
  return (
    <View>
    <View style={[styles.bar, { minHeight: theme.layout.headerHeight, paddingHorizontal: theme.spacing.xs }]}>
      <View style={[styles.side, separateTitle && styles.wideSide]}>
        {showBack ? (
          <Pressable
            onPress={goBack}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={backLabel ?? 'Volver'}
            style={({ pressed }) => [
              styles.back,
              { minHeight: theme.touchTargets.min, minWidth: theme.touchTargets.min, opacity: pressed ? 0.6 : 1 },
            ]}
          >
            {backLabel ? (
              <AppText variant="bodyStrong" style={{ color, flexShrink: 1 }}>
                {backLabel}
              </AppText>
            ) : (
              <Icon name={backIcon} size={30} color={color} />
            )}
          </Pressable>
        ) : null}
      </View>
      {separateTitle ? <View style={styles.center} /> : center ? (
        <View style={styles.center}>{center}</View>
      ) : (
      <View style={styles.center} accessible accessibilityRole="header" accessibilityLabel={title}>
        {titleIcon ? <Icon name={titleIcon} size={20} color={color} /> : null}
        {title ? (
          <AppText
            variant="subheading"
            style={[styles.title, { color }]}
            align="center"
          >
            {title}
          </AppText>
        ) : null}
      </View>
      )}
      <View style={[styles.side, styles.right, separateTitle && styles.wideSide]}>{right}</View>
    </View>
    {separateTitle ? <View style={styles.titleRow} accessibilityRole="header">
      {titleIcon ? <Icon name={titleIcon} size={20} color={color} /> : null}
      <AppText variant="subheading" style={[styles.title, { color }]} align="center">{title}</AppText>
    </View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'center' },
  // Ambos laterales con el mismo ancho mínimo (48 = área táctil) para centrar el título.
  side: { minWidth: 56, maxWidth: '45%', flexShrink: 1, flexDirection: 'row', alignItems: 'center' },
  wideSide: { flex: 1 },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: 16, paddingBottom: 8 },
  title: { flexShrink: 1, minWidth: 0 },
  right: { justifyContent: 'flex-end' },
  back: { justifyContent: 'center', alignItems: 'flex-start', paddingHorizontal: 8 },
  center: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
});
