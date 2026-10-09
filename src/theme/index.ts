/**
 * MediClaro — Theme central
 *
 * colors · spacing · radius · typography · shadow · layout · touchTargets
 *
 * Ningún componente debe definir colores, tamaños o sombras "a mano":
 * todo sale de aquí. Los tamaños de texto se escalan con la preferencia
 * del usuario (normal / grande / muy grande) mediante `useAppTheme()`.
 */
import { Platform, type TextStyle, type ViewStyle } from 'react-native';
import { lightColors, highContrastColors, palette, type ColorScheme } from './colors';

export { palette, lightColors, highContrastColors };
export type { ColorScheme };

// ─── Espaciado ────────────────────────────────────────────────────────────────

export const spacing = {
  xxs: 4,
  xs: 8,
  sm: 12,
  md: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
  xxxl: 40,
} as const;

// ─── Radios ───────────────────────────────────────────────────────────────────

export const radius = {
  xs: 8,
  sm: 12,
  md: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
  pill: 999,
} as const;

// ─── Layout ───────────────────────────────────────────────────────────────────

export const layout = {
  /** Ancho máximo del contenido (tablets / web escritorio): columna centrada. */
  maxContentWidth: 560,
  /** Margen horizontal de pantalla. */
  screenPaddingH: 20,
  /** Altura de la cabecera de pantalla (sin safe area). */
  headerHeight: 56,
  /** Altura de la barra inferior (sin safe area). */
  tabBarHeight: 60,
  /** Separación entre tarjetas / filas de acción. */
  stackGap: 12,
} as const;

// ─── Áreas táctiles ───────────────────────────────────────────────────────────
// WCAG 2.5.5 recomienda 44×44; para personas mayores usamos 48 como mínimo
// absoluto y 56–64 en acciones principales.

export const touchTargets = {
  min: 48,
  comfortable: 56,
  large: 64,
  easyMode: 72,
} as const;

// ─── Sombras ──────────────────────────────────────────────────────────────────

function makeShadow(opacity: number, radiusPx: number, offsetY: number, elevation: number, color = '#1B2B5A'): ViewStyle {
  return Platform.select<ViewStyle>({
    ios: {
      shadowColor: color,
      shadowOpacity: opacity,
      shadowRadius: radiusPx,
      shadowOffset: { width: 0, height: offsetY },
    },
    android: { elevation },
    default: {
      // react-native-web entiende boxShadow
      boxShadow: `0px ${offsetY}px ${radiusPx * 2}px rgba(27, 43, 90, ${opacity})`,
    } as ViewStyle,
  }) as ViewStyle;
}

export const shadow = {
  none: {} as ViewStyle,
  /** Tarjetas: sombra muy discreta. */
  card: makeShadow(0.06, 10, 3, 2),
  /** Elementos flotantes (barra inferior, cabecera fija). */
  soft: makeShadow(0.08, 14, 4, 3),
  /** Botones principales. */
  button: makeShadow(0.18, 10, 5, 3, '#2563EB'),
  /** Botón de emergencia. */
  danger: makeShadow(0.22, 12, 6, 4, '#DC2626'),
} as const;

// ─── Tipografía ───────────────────────────────────────────────────────────────

export type FontSizePreference = 'normal' | 'grande' | 'muy_grande';

/** Factor de escala por preferencia del usuario. */
export const fontScale: Record<FontSizePreference, number> = {
  normal: 1,
  grande: 1.15,
  muy_grande: 1.3,
};

export const FONT_SIZE_LABELS: Record<FontSizePreference, string> = {
  normal: 'Normal',
  grande: 'Grande',
  muy_grande: 'Muy grande',
};

export type TypographyVariant =
  | 'display'
  | 'title'
  | 'heading'
  | 'subheading'
  | 'body'
  | 'bodyStrong'
  | 'label'
  | 'caption'
  | 'captionStrong'
  | 'small'
  | 'button'
  | 'price';

interface TypeSpec {
  size: number;
  lineHeight: number;
  weight: TextStyle['fontWeight'];
  letterSpacing?: number;
}

/** Tamaños base (preferencia "normal"). Pensados para lectura cómoda. */
export const typeScale: Record<TypographyVariant, TypeSpec> = {
  display: { size: 30, lineHeight: 36, weight: '800', letterSpacing: -0.4 },
  title: { size: 26, lineHeight: 32, weight: '800', letterSpacing: -0.3 },
  heading: { size: 20, lineHeight: 26, weight: '700', letterSpacing: -0.2 },
  subheading: { size: 18, lineHeight: 24, weight: '700' },
  body: { size: 17, lineHeight: 24, weight: '400' },
  bodyStrong: { size: 17, lineHeight: 24, weight: '600' },
  label: { size: 16, lineHeight: 22, weight: '600' },
  caption: { size: 14, lineHeight: 20, weight: '400' },
  captionStrong: { size: 14, lineHeight: 20, weight: '600' },
  small: { size: 12, lineHeight: 16, weight: '600' },
  button: { size: 18, lineHeight: 24, weight: '700' },
  price: { size: 28, lineHeight: 34, weight: '800', letterSpacing: -0.4 },
};

/** Variantes que no deben crecer tanto (barra inferior, etiquetas pequeñas). */
const CAPPED_VARIANTS: Partial<Record<TypographyVariant, number>> = {
  small: 1.1,
  display: 1.2,
  price: 1.15,
};

export function buildTypography(pref: FontSizePreference): Record<TypographyVariant, TextStyle> {
  const factor = fontScale[pref];
  const out = {} as Record<TypographyVariant, TextStyle>;
  (Object.keys(typeScale) as TypographyVariant[]).forEach((variant) => {
    const spec = typeScale[variant];
    const cap = CAPPED_VARIANTS[variant];
    const f = cap ? Math.min(factor, cap) : factor;
    out[variant] = {
      fontSize: Math.round(spec.size * f),
      lineHeight: Math.round(spec.lineHeight * f),
      fontWeight: spec.weight,
      ...(spec.letterSpacing !== undefined ? { letterSpacing: spec.letterSpacing } : null),
    };
  });
  return out;
}

/**
 * Límite al escalado del sistema operativo encima de nuestra preferencia,
 * para que la maquetación no se rompa con "texto enorme" + "muy grande".
 */
export const MAX_FONT_SIZE_MULTIPLIER = 1.3;

// ─── Tema completo ────────────────────────────────────────────────────────────

export interface AppTheme {
  colors: ColorScheme;
  typography: Record<TypographyVariant, TextStyle>;
  spacing: typeof spacing;
  radius: typeof radius;
  shadow: typeof shadow;
  layout: typeof layout;
  touchTargets: typeof touchTargets;
  /** Altura mínima recomendada para acciones principales según el modo. */
  actionHeight: number;
  /** Tamaño de icono estándar según el modo. */
  iconSize: number;
  fontSize: FontSizePreference;
  easyMode: boolean;
  highContrast: boolean;
}

export function buildTheme(opts: {
  fontSize: FontSizePreference;
  easyMode: boolean;
  highContrast: boolean;
}): AppTheme {
  const effectiveFont: FontSizePreference = opts.easyMode ? 'muy_grande' : opts.fontSize;
  return {
    colors: opts.highContrast ? highContrastColors : lightColors,
    typography: buildTypography(effectiveFont),
    spacing,
    radius,
    shadow,
    layout,
    touchTargets,
    actionHeight: opts.easyMode ? touchTargets.easyMode : touchTargets.large,
    iconSize: opts.easyMode ? 28 : 24,
    fontSize: effectiveFont,
    easyMode: opts.easyMode,
    highContrast: opts.highContrast,
  };
}

/** Tema por defecto (antes de cargar las preferencias). */
export const defaultTheme = buildTheme({ fontSize: 'grande', easyMode: false, highContrast: false });
