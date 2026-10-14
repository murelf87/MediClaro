/**
 * Piezas LOCALES de las pantallas informativas (Ayuda, Información legal, Idioma).
 */
import { useEffect, useRef, type ReactNode } from 'react';
import { Animated, Pressable, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import type { Href } from 'expo-router';
import { AppText, Icon, SettingRow, type IconName } from '../../components';
import { useAppTheme, useSession } from '../../hooks';
import { openExternalUrl } from '../../utils/device';
import { showAlert } from '../../utils/dialogs';

/** Destino de "Volver" si no hay historial: Inicio con sesión, bienvenida sin ella. */
export function useHomeHref(): Href {
  const { status } = useSession();
  return status === 'signedIn' ? '/(tabs)' : '/';
}

/** Tarjeta desplegable (pregunta frecuente o apartado legal) con flecha que gira. */
export function AccordionItem({
  title,
  icon,
  iconColor,
  expanded,
  onToggle,
  children,
  onLayout,
  testID,
}: {
  title: string;
  icon?: IconName;
  iconColor?: string;
  expanded: boolean;
  onToggle: () => void;
  children: ReactNode;
  onLayout?: (e: LayoutChangeEvent) => void;
  testID?: string;
}) {
  const theme = useAppTheme();
  const c = theme.colors;
  const rotation = useRef(new Animated.Value(expanded ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(rotation, { toValue: expanded ? 1 : 0, duration: 200, useNativeDriver: true }).start();
  }, [expanded, rotation]);

  const rotate = rotation.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '180deg'] });

  return (
    <View
      onLayout={onLayout}
      style={[
        styles.item,
        {
          backgroundColor: c.surface,
          borderColor: expanded ? c.primarySoft : c.border,
          borderRadius: theme.radius.lg,
        },
        theme.shadow.card,
      ]}
    >
      <Pressable
        onPress={onToggle}
        accessibilityRole="button"
        accessibilityLabel={title}
        accessibilityState={{ expanded }}
        accessibilityHint={expanded ? 'Toca para ocultar' : 'Toca para leer'}
        testID={testID}
        style={({ pressed }) => [
          styles.header,
          { minHeight: theme.touchTargets.comfortable + 4, backgroundColor: pressed ? c.surfaceAlt : 'transparent' },
        ]}
      >
        {icon ? (
          <View style={[styles.iconTile, { backgroundColor: c.primaryTint, borderRadius: theme.radius.sm }]}>
            <Icon name={icon} size={22} color={iconColor ?? c.primary} />
          </View>
        ) : null}
        <AppText variant="bodyStrong" color="heading" style={styles.title}>
          {title}
        </AppText>
        <Animated.View style={{ transform: [{ rotate }] }}>
          <Icon name="chevron-down" size={24} color={c.primary} />
        </Animated.View>
      </Pressable>
      {expanded ? <View style={[styles.body, { paddingHorizontal: theme.spacing.md, paddingBottom: theme.spacing.md, gap: theme.spacing.sm }]}>{children}</View> : null}
    </View>
  );
}

/** Párrafo de respuesta. */
export function Paragraph({ children }: { children: ReactNode }) {
  return (
    <AppText variant="body" color="textSecondary">
      {children}
    </AppText>
  );
}

/** Lista con viñetas (pasos o consejos). */
export function Bullets({ items }: { items: string[] }) {
  const theme = useAppTheme();
  return (
    <View style={{ gap: theme.spacing.xs }}>
      {items.map((item) => (
        <View key={item} style={styles.bullet}>
          <View style={[styles.bulletDot, { backgroundColor: theme.colors.primary }]} />
          <AppText variant="body" color="textSecondary" style={styles.bulletText}>
            {item}
          </AppText>
        </View>
      ))}
    </View>
  );
}

/**
 * Enlace a un documento legal publicado por el propietario.
 * Sin URL publicada → fila NO pulsable "Pendiente de publicación" (nunca un botón muerto).
 */
export function DocumentRow({ url, label, icon = 'document-text-outline' }: { url: string; label: string; icon?: IconName }) {
  const theme = useAppTheme();
  const open = async () => {
    const ok = await openExternalUrl(url);
    if (!ok) await showAlert('No se ha podido abrir el enlace', `Puedes consultarlo en ${url}`);
  };
  return (
    <View style={[styles.docBox, { borderColor: theme.colors.border, borderRadius: theme.radius.md }]}>
      {url ? (
        <SettingRow icon="open-outline" iconColor={theme.colors.primary} label={label} onPress={open} accessibilityHint="Se abre en el navegador" />
      ) : (
        // Fila informativa, no pulsable y sin flecha (el texto puede ocupar dos líneas con letra grande).
        <View
          style={[styles.pendingRow, { minHeight: theme.touchTargets.comfortable + 4 }]}
          accessible
          accessibilityLabel="Documento completo: pendiente de publicación"
        >
          <View style={styles.pendingIcon}>
            <Icon name={icon} size={24} color={theme.colors.textMuted} />
          </View>
          <View style={styles.pendingText}>
            <AppText variant="label" color="heading">
              Documento completo
            </AppText>
            <AppText variant="label" color="textMuted">
              Pendiente de publicación
            </AppText>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  item: { borderWidth: 1, overflow: 'hidden' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 10 },
  iconTile: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1 },
  body: {},
  bullet: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  bulletDot: { width: 7, height: 7, borderRadius: 4, marginTop: 10 },
  bulletText: { flex: 1 },
  docBox: { borderWidth: 1, overflow: 'hidden' },
  pendingRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 16, paddingVertical: 10 },
  pendingIcon: { width: 30, alignItems: 'center' },
  pendingText: { flex: 1, gap: 2 },
});
