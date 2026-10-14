/**
 * Piezas LOCALES del perfil de emergencia (ver, editar, compartir, número privado).
 * No son componentes compartidos: solo las usan las pantallas de esta carpeta.
 */
import { type ReactNode } from 'react';
import { Pressable, StyleSheet, View, type LayoutChangeEvent, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Circle, ClipPath, Defs, G, Path, Rect } from 'react-native-svg';
import { AppText, Card, Icon, Skeleton, type IconName } from '../../components';
import { useAppTheme } from '../../hooks';
import { AppError, isAppError } from '../../services';
import { formatDateShort, onlyDigits } from '../../utils/format';

export function asAppError(e: unknown): AppError {
  return isAppError(e) ? e : new AppError('unknown');
}

// ─── Presentación ────────────────────────────────────────────────────────────

/** Título grande de pantalla (los títulos largos no caben en la cabecera con letra grande). */
export function ScreenTitle({ children, style }: { children: string; style?: StyleProp<ViewStyle> }) {
  const theme = useAppTheme();
  return (
    <View style={[{ marginTop: theme.spacing.xxs }, style]}>
      <AppText variant="title" accessibilityRole="header">
        {children}
      </AppText>
    </View>
  );
}

/** Tarjeta de sección con título navy (Datos personales, Dirección, Información médica…). */
export function SectionCard({
  title,
  children,
  onLayout,
  testID,
}: {
  title: string;
  children: ReactNode;
  onLayout?: (e: LayoutChangeEvent) => void;
  testID?: string;
}) {
  const theme = useAppTheme();
  return (
    <View onLayout={onLayout} testID={testID}>
      <Card padding={theme.spacing.md}>
        <AppText variant="subheading" color="heading" accessibilityRole="header" style={{ marginBottom: theme.spacing.sm }}>
          {title}
        </AppText>
        <View style={{ gap: theme.spacing.sm }}>{children}</View>
      </Card>
    </View>
  );
}

/** Línea con icono y un dato (Datos personales). */
export function IconLine({
  icon,
  iconColor,
  children,
  muted,
  accessibilityLabel,
}: {
  icon: IconName;
  iconColor?: string;
  children: string;
  muted?: boolean;
  accessibilityLabel?: string;
}) {
  const theme = useAppTheme();
  return (
    <View style={styles.iconLine} accessible accessibilityLabel={accessibilityLabel ?? children}>
      <View style={styles.iconCol}>
        <Icon name={icon} size={22} color={iconColor ?? theme.colors.primary} />
      </View>
      <AppText variant="body" color={muted ? 'textMuted' : 'text'} style={styles.flex}>
        {children}
      </AppText>
    </View>
  );
}

/**
 * Fila "Etiqueta ······ valor" (Información médica), como en la referencia: el valor
 * va alineado a la derecha en su propia columna; con letra muy grande o textos
 * largos, etiqueta y valor ocupan varias líneas sin cortarse nunca.
 */
export function InfoRow({
  icon,
  iconColor,
  label,
  value,
  muted,
  right,
  onPress,
  expanded,
  stacked,
  accessibilityHint,
  testID,
}: {
  icon: IconName;
  iconColor?: string;
  label: string;
  value: string;
  muted?: boolean;
  /** Acción a la derecha (p. ej. botón de llamar). Queda fuera del bloque de lectura. */
  right?: ReactNode;
  /** Fila desplegable (lista de medicamentos). */
  onPress?: () => void;
  expanded?: boolean;
  /** Etiqueta arriba y valor debajo (filas de personas con botón de llamar). */
  stacked?: boolean;
  accessibilityHint?: string;
  testID?: string;
}) {
  const theme = useAppTheme();
  const main = (
    <>
      <View style={styles.iconCol}>
        <Icon name={icon} size={22} color={iconColor ?? theme.colors.danger} />
      </View>
      {stacked ? (
        <View style={styles.flex}>
          <AppText variant="body" color="text">
            {label}
          </AppText>
          <AppText variant="bodyStrong" color={muted ? 'textMuted' : 'heading'}>
            {value}
          </AppText>
        </View>
      ) : (
        <View style={styles.infoMain}>
          <AppText variant="body" color="text" style={styles.infoLabel}>
            {label}
          </AppText>
          <AppText variant="body" color={muted ? 'textMuted' : 'heading'} style={styles.infoValue}>
            {value}
          </AppText>
        </View>
      )}
      {onPress ? <Icon name={expanded ? 'chevron-up' : 'chevron-down'} size={22} color={theme.colors.primary} /> : null}
    </>
  );
  return (
    <View style={styles.infoRow}>
      {onPress ? (
        <Pressable
          onPress={onPress}
          accessibilityRole="button"
          accessibilityLabel={`${label}: ${value}`}
          accessibilityState={{ expanded: !!expanded }}
          accessibilityHint={accessibilityHint}
          testID={testID}
          hitSlop={4}
          style={({ pressed }) => [styles.infoPress, { minHeight: theme.touchTargets.min, opacity: pressed ? 0.65 : 1 }]}
        >
          {main}
        </Pressable>
      ) : (
        <View style={[styles.infoPress, { minHeight: 36 }]} accessible accessibilityLabel={`${label}: ${value}`} testID={testID}>
          {main}
        </View>
      )}
      {right}
    </View>
  );
}

/** Nota pequeña bajo una fila (p. ej. "Guardado solo en este teléfono"). */
export function RowNote({ icon = 'phone-portrait-outline', children }: { icon?: IconName; children: string }) {
  const theme = useAppTheme();
  return (
    <View style={[styles.rowNote, { marginLeft: 36 }]}>
      <Icon name={icon} size={16} color={theme.colors.textMuted} />
      <AppText variant="caption" color="textMuted" style={styles.flex}>
        {children}
      </AppText>
    </View>
  );
}

/** Mini mapa decorativo (sin servicios externos): calles, parque y punto de posición. */
export function MiniMap({ width = 118, height = 84 }: { width?: number; height?: number }) {
  return (
    <Svg width={width} height={height} viewBox="0 0 118 84">
      <Defs>
        <ClipPath id="mcMiniMapClip">
          <Rect x="0" y="0" width="118" height="84" rx="12" />
        </ClipPath>
      </Defs>
      <G clipPath="url(#mcMiniMapClip)">
        <Rect x="0" y="0" width="118" height="84" fill="#EDF1F6" />
        <Rect x="4" y="4" width="34" height="26" rx="3" fill="#E2E8F0" />
        <Rect x="66" y="4" width="18" height="20" rx="3" fill="#E2E8F0" />
        <Rect x="4" y="46" width="30" height="16" rx="3" fill="#E2E8F0" />
        <Path d="M76 50 L106 46 L112 80 L80 84 Z" fill="#D3EBDB" />
        <Path d="M-6 42 L124 30" stroke="#FFFFFF" strokeWidth="8" />
        <Path d="M44 -6 L60 92" stroke="#FFFFFF" strokeWidth="7" />
        <Path d="M-6 72 L62 64" stroke="#FFFFFF" strokeWidth="4" />
        <Path d="M90 -6 L96 92" stroke="#FFFFFF" strokeWidth="4" />
        <Path d="M60 64 L124 58" stroke="#FFFFFF" strokeWidth="3" />
        <Circle cx="53" cy="37" r="12" fill="#2563EB" opacity="0.16" />
        <Circle cx="53" cy="37" r="7" fill="#FFFFFF" />
        <Circle cx="53" cy="37" r="4.8" fill="#2563EB" />
      </G>
    </Svg>
  );
}

/** Esqueleto con la forma de las tarjetas del perfil mientras carga. */
export function ProfileSkeleton({ cards = 3 }: { cards?: number }) {
  const theme = useAppTheme();
  return (
    <View style={{ gap: theme.spacing.md }} accessibilityRole="progressbar" accessibilityLabel="Cargando tu perfil">
      {Array.from({ length: cards }).map((_, i) => (
        <Card key={i} padding={theme.spacing.md}>
          <Skeleton width="45%" height={20} />
          <View style={{ gap: 14, marginTop: 16 }}>
            {[0, 1, 2].map((r) => (
              <View key={r} style={styles.skeletonRow}>
                <Skeleton width={22} height={22} radius={11} />
                <Skeleton width={r === 1 ? '55%' : '70%'} height={16} />
              </View>
            ))}
          </View>
        </Card>
      ))}
    </View>
  );
}

// ─── Datos ───────────────────────────────────────────────────────────────────

/** Separa una lista escrita a mano ("A, B; C") igual que el informe de emergencia. */
export function splitList(text: string): string[] {
  return text
    .split(/[,;\n]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Fecha mientras se escribe: solo cifras y barras automáticas → "12/03/1948". */
export function formatDobTyping(text: string): string {
  const d = onlyDigits(text).slice(0, 8);
  if (d.length <= 2) return d;
  if (d.length <= 4) return `${d.slice(0, 2)}/${d.slice(2)}`;
  return `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`;
}

/** 'YYYY-MM-DD' → 'DD/MM/AAAA' para el campo del formulario. */
export function dobToInput(iso: string): string {
  return formatDateShort(iso);
}

export type DobParse = { ok: true; iso: string } | { ok: false; message: string };

/** 'DD/MM/AAAA' → 'YYYY-MM-DD' ('' si está vacío), validando que la fecha exista. */
export function parseDobInput(text: string): DobParse {
  const d = onlyDigits(text);
  if (!d) return { ok: true, iso: '' };
  if (d.length !== 8) return { ok: false, message: 'Escribe la fecha completa: día, mes y año (DD/MM/AAAA).' };
  const day = Number(d.slice(0, 2));
  const month = Number(d.slice(2, 4));
  const year = Number(d.slice(4));
  const date = new Date(year, month - 1, day);
  if (month < 1 || month > 12 || date.getMonth() !== month - 1 || date.getDate() !== day || year < 1900) {
    return { ok: false, message: 'Esa fecha no existe. Revísala (DD/MM/AAAA).' };
  }
  if (date.getTime() > Date.now()) return { ok: false, message: 'La fecha de nacimiento no puede ser posterior a hoy.' };
  return { ok: true, iso: `${d.slice(4)}-${d.slice(2, 4)}-${d.slice(0, 2)}` };
}

/** Grupos sanguíneos (se guardan con "-" ASCII; se muestran con el signo menos tipográfico). */
export const BLOOD_TYPES: { value: string; label: string }[] = [
  { value: 'A+', label: 'A+' },
  { value: 'A-', label: 'A−' },
  { value: 'B+', label: 'B+' },
  { value: 'B-', label: 'B−' },
  { value: 'AB+', label: 'AB+' },
  { value: 'AB-', label: 'AB−' },
  { value: '0+', label: '0+' },
  { value: '0-', label: '0−' },
];

/** "o-", "O −", "0-" → "0-" (para reconocer el valor guardado). */
export function normalizeBloodType(value: string): string {
  return value
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '')
    .replace(/[−–—]/g, '-')
    .replace(/^O/, '0');
}

/** Valor legible del grupo sanguíneo guardado ('' si no hay). */
export function displayBloodType(value: string): string {
  const known = BLOOD_TYPES.find((b) => b.value === normalizeBloodType(value));
  return known ? known.label : value.trim();
}

export const RELATIONSHIPS = ['Hija', 'Hijo', 'Pareja', 'Hermana', 'Hermano', 'Amistad'] as const;
export const OTHER_RELATIONSHIP = 'Otra';

/** Relación guardada → chip seleccionado + texto libre (si es "Otra"). */
export function splitRelationship(value: string): { chip: string; other: string } {
  const v = value.trim();
  if (!v) return { chip: '', other: '' };
  const match = RELATIONSHIPS.find((r) => r.toLowerCase() === v.toLowerCase());
  return match ? { chip: match, other: '' } : { chip: OTHER_RELATIONSHIP, other: v };
}

/** Número de teléfono con un número de cifras razonable (o vacío). */
export function isPlausiblePhone(value: string): boolean {
  const digits = onlyDigits(value);
  return digits.length === 0 || (digits.length >= 3 && digits.length <= 15);
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  iconLine: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 32 },
  iconCol: { width: 24, alignItems: 'center' },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  infoPress: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  infoMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  infoLabel: { flex: 1 },
  infoValue: { maxWidth: '52%', textAlign: 'right' },
  rowNote: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: -4 },
  skeletonRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
});
