/**
 * Medicamentos: imagen del envase (con sustituto vectorial) y tarjeta de lista.
 */
import { useEffect, useRef, useState } from 'react';
import { Image, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { AppText } from './AppText';
import { Icon } from './Icon';
import { MedicineBoxArt } from './Illustrations';
import { useAppTheme } from '../providers/PreferencesProvider';

/**
 * Foto oficial del envase cuando existe; si no, un envase ilustrado
 * (nunca un cuadrado vacío).
 */
export function MedicationImage({
  uri,
  loadUri,
  imageKey,
  width = 64,
  height = 56,
  radius,
  style,
  accessibilityLabel,
}: {
  uri: string | null | undefined;
  /** Carga perezosa de la imagen si no se conoce (la aporta la pantalla). */
  loadUri?: () => Promise<string | null>;
  /** Identificador estable (p. ej. nº de registro) para recargar al cambiar de medicamento. */
  imageKey?: string;
  width?: number | `${number}%`;
  height?: number;
  radius?: number;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}) {
  const theme = useAppTheme();
  const [src, setSrc] = useState<string | null>(uri ?? null);
  const [failed, setFailed] = useState(false);
  const [measuredWidth, setMeasuredWidth] = useState<number | null>(null);
  // La función de carga puede cambiar en cada render: la guardamos en una ref.
  const loadRef = useRef(loadUri);
  loadRef.current = loadUri;

  useEffect(() => {
    setSrc(uri ?? null);
    setFailed(false);
    const load = loadRef.current;
    if (!uri && load) {
      let cancelled = false;
      load()
        .then((u) => {
          if (!cancelled && u) setSrc(u);
        })
        .catch(() => undefined);
      return () => {
        cancelled = true;
      };
    }
    return undefined;
  }, [uri, imageKey]);

  const boxWidth = typeof width === 'number' ? width : measuredWidth ?? 160;
  const artWidth = boxWidth * 0.82;
  const artHeight = Math.min(height * 0.82, artWidth * 0.75);

  return (
    <View
      onLayout={typeof width === 'number' ? undefined : (e) => setMeasuredWidth(e.nativeEvent.layout.width)}
      style={[
        styles.imageBox,
        { width, height, borderRadius: radius ?? theme.radius.sm, backgroundColor: theme.colors.surfaceAlt },
        style,
      ]}
      accessible={!!accessibilityLabel}
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel}
    >
      {src && !failed ? (
        <Image
          source={{ uri: src }}
          style={styles.image}
          resizeMode="contain"
          onError={() => setFailed(true)}
          accessibilityIgnoresInvertColors
        />
      ) : (
        <MedicineBoxArt width={artWidth} height={artHeight} />
      )}
    </View>
  );
}

export function MedicationCard({
  name,
  subtitle,
  imageUrl,
  imageKey,
  loadImage,
  favorite,
  onPress,
  onToggleFavorite,
  badge,
  testID,
}: {
  name: string;
  subtitle?: string | null;
  imageUrl?: string | null;
  imageKey?: string;
  loadImage?: () => Promise<string | null>;
  favorite?: boolean;
  onPress: () => void;
  onToggleFavorite?: () => void;
  badge?: string;
  testID?: string;
}) {
  const theme = useAppTheme();
  const c = theme.colors;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${name}${subtitle ? `, ${subtitle}` : ''}${favorite ? ', favorito' : ''}`}
      accessibilityHint="Abre el detalle del medicamento"
      testID={testID}
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: pressed ? c.surfaceAlt : c.surface, minHeight: theme.touchTargets.large + 12 },
      ]}
    >
      <MedicationImage uri={imageUrl} loadUri={loadImage} imageKey={imageKey} width={64} height={52} />
      <View style={styles.text}>
        <AppText variant="bodyStrong" color="heading" numberOfLines={2}>
          {name}
        </AppText>
        {subtitle ? (
          <AppText variant="caption" color="textSecondary" numberOfLines={1}>
            {subtitle}
          </AppText>
        ) : null}
        {badge ? (
          <AppText variant="small" color="successText">
            {badge}
          </AppText>
        ) : null}
      </View>
      {onToggleFavorite ? (
        <Pressable
          onPress={onToggleFavorite}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={favorite ? 'Quitar de favoritos' : 'Marcar como favorito'}
          accessibilityState={{ selected: !!favorite }}
          style={({ pressed }) => [styles.star, { opacity: pressed ? 0.6 : 1 }]}
        >
          <Icon name={favorite ? 'star' : 'star-outline'} size={26} color={favorite ? c.favorite : c.textMuted} />
        </Pressable>
      ) : favorite ? (
        <Icon name="star" size={24} color={c.favorite} />
      ) : null}
      <Icon name="chevron-forward" size={22} color={c.textMuted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  imageBox: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  image: { width: '100%', height: '100%' },
  // Espacios contenidos para que el nombre quepa en una línea también en móviles Android de 360 dp
  card: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, paddingHorizontal: 12, borderRadius: 16 },
  text: { flex: 1, gap: 2 },
  star: { width: 40, height: 44, alignItems: 'center', justifyContent: 'center' },
});
