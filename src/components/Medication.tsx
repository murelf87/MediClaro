/**
 * Medicamentos: imagen del envase (con sustituto vectorial) y tarjeta de lista.
 */
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Image, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { AppText } from './AppText';
import { Icon } from './Icon';
import { MedicineBoxArt } from './Illustrations';
import { useAppTheme } from '../providers/PreferencesProvider';
import { MedicinePhotoService } from '../services/MedicinePhotoService';

/** ¿La clave es un nº de registro (de CIMA) y no un nombre? */
const isMedicineId = (key: string | undefined): key is string => !!key && /^[0-9A-Za-z-]{1,20}$/.test(key);

/**
 * Foto del envase: la oficial cuando existe; si no, la foto de su caja que la persona eligió guardar (solo en su
 * teléfono); y si tampoco, un envase ilustrado (nunca un cuadrado vacío). Con `preferOwn` (Mis pastillas) se
 * enseña primero la foto propia, porque es SU caja la que tiene que reconocer.
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
  ownPhotoKeys,
  preferOwn = false,
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
  /** Claves de la foto propia (por defecto, `med:<imageKey>` si imageKey es un nº de registro). */
  ownPhotoKeys?: string[];
  /** Enseñar primero la foto propia (Mis pastillas). */
  preferOwn?: boolean;
}) {
  const theme = useAppTheme();
  const [src, setSrc] = useState<string | null>(uri ?? null);
  const [failed, setFailed] = useState(false);
  const [measuredWidth, setMeasuredWidth] = useState<number | null>(null);
  // La función de carga puede cambiar en cada render: la guardamos en una ref.
  const loadRef = useRef(loadUri);
  loadRef.current = loadUri;
  const keys = ownPhotoKeys ?? (isMedicineId(imageKey) ? [`med:${imageKey}`] : []);
  const keysId = keys.join('|');
  const keysRef = useRef(keys);
  keysRef.current = keys;
  // Cambia cuando se guarda o se quita una foto propia: así se ve al momento.
  const photosVersion = useSyncExternalStore(MedicinePhotoService.subscribe, MedicinePhotoService.version, MedicinePhotoService.version);

  useEffect(() => {
    let cancelled = false;
    setSrc(preferOwn ? null : uri ?? null);
    setFailed(false);
    const own = () => (keysRef.current.length ? MedicinePhotoService.get(keysRef.current) : Promise.resolve(null));
    const official = async () => uri ?? (loadRef.current ? await loadRef.current().catch(() => null) : null);
    void (async () => {
      const first = preferOwn ? await own() : await official();
      const found = first ?? (preferOwn ? await official() : await own());
      if (!cancelled) setSrc(found ?? null);
    })();
    return () => {
      cancelled = true;
    };
  }, [uri, imageKey, keysId, preferOwn, photosVersion]);

  // Si la foto oficial no carga (sin conexión, enlace roto), se prueba con la propia antes que con el dibujo.
  useEffect(() => {
    if (!failed || !keysRef.current.length) return undefined;
    let cancelled = false;
    void MedicinePhotoService.get(keysRef.current).then((own) => {
      if (!cancelled && own && own !== src) {
        setSrc(own);
        setFailed(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [failed, src]);

  const boxWidth = typeof width === 'number' ? width : measuredWidth ?? 160;
  const artWidth = boxWidth * 0.82;
  const artHeight = Math.min(height * 0.82, artWidth * 0.75);

  return (
    <View
      onLayout={typeof width === 'number' ? undefined : (e) => setMeasuredWidth(e.nativeEvent.layout.width)}
      style={[
        styles.imageBox,
        // Las fotos oficiales de CIMA tienen fondo blanco: el marco también, para que la caja se vea limpia.
        { width, height, borderRadius: radius ?? theme.radius.sm, backgroundColor: src && !failed ? '#FFFFFF' : theme.colors.surfaceAlt },
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
