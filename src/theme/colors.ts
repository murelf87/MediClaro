/**
 * MediClaro — Paleta de color
 *
 * Paleta de marca del propietario (tablero «Pantallas Premium y pago»):
 *   Azul principal #2563EB · Celeste #60A5FA · Azul claro #DBEAFE · Naranja #F59E0B
 *   Verde éxito #10B981 · Rojo alerta #EF4444 · Gris texto #6B7280 · Fondo #F8FAFC
 *
 *  - blanco limpio y fondo #F8FAFC; tarjetas blancas
 *  - azul sanitario (principal) y celeste para acentos
 *  - verde para confirmaciones, naranja para Premium
 *  - violeta únicamente para la IA
 *  - rojo exclusivamente para urgencias / alertas
 *
 * Accesibilidad (público mayor): todos los colores de TEXTO cumplen WCAG AA (≥ 4,5:1 sobre blanco y
 * sobre el fondo). Por eso, para texto y botones rellenos se usan tonos algo más oscuros de la misma
 * familia cuando el color de la paleta no llega a 4,5:1:
 *   verde #10B981 → texto #047857 · rojo #EF4444 → texto/botón #DC2626 · naranja #F59E0B → texto #92400E.
 * Los colores de la paleta se usan tal cual en rellenos, iconos, ilustraciones y fondos suaves.
 */

export const palette = {
  white: '#FFFFFF',
  black: '#000000',

  // Azul sanitario (paleta de marca: #2563EB principal · #60A5FA celeste · #DBEAFE azul claro)
  brandBlue: '#2563EB',
  brandBlueDark: '#1D4ED8',
  brandSky: '#60A5FA',
  brandBlueLight: '#DBEAFE',
  brandBlueTint: '#EFF6FF',
  brandOrange: '#F59E0B',
  brandGreen: '#10B981',
  brandRed: '#EF4444',
  brandGray: '#6B7280',
  brandBackground: '#F8FAFC',
  blue25: '#F7FAFF',
  blue50: '#F0F6FE',
  blue100: '#E4EFFD',
  blue200: '#C9DDFA',
  blue400: '#4A92F2',
  blue500: '#1A6BE0',
  blue600: '#1459C2',
  blue700: '#0F4AA3',

  // Navy de titulares y marca
  navy700: '#1E3A8A',
  navy800: '#16307E',
  navy900: '#0F2463',

  // Verde (secundario)
  green50: '#EAF8F0',
  green100: '#D9F2E3',
  green400: '#3DBD74',
  green500: '#1FA45C',
  green600: '#178A4C',
  green700: '#137A42',

  // Violeta (IA)
  purple50: '#F4F0FE',
  purple100: '#E9E2FC',
  purple400: '#8B6CF0',
  purple500: '#6A45E0',
  purple600: '#5836C7',

  // Rojo (urgencias)
  red25: '#FFF7F7',
  red50: '#FEF0F0',
  red100: '#FDE1E0',
  red200: '#F9C3C1',
  red500: '#E5322D',
  red600: '#C9241F',
  red700: '#B01E1A',

  // Ámbar / dorado (premium, favoritos)
  amber50: '#FFF7E8',
  amber100: '#FEEBC8',
  amber500: '#F5A524',
  amber600: '#D98A0B',
  amber800: '#8A5300',

  // Neutros
  slate25: '#FAFBFD',
  slate50: '#F5F7FB',
  slate100: '#EEF2F7',
  slate150: '#E8EDF4',
  slate200: '#DFE5EE',
  slate300: '#C8D0DC',
  slate400: '#98A2B3',
  slate500: '#667085',
  slate600: '#4B5568',
  slate700: '#344054',
  slate900: '#172033',

  // Oscuros (pantalla de llamada)
  ink900: '#0B1220',
  ink800: '#141C2F',
  ink700: '#1E2840',
} as const;

export interface ColorScheme {
  // Marca
  brandMedi: string;
  brandClaro: string;
  logoBlue: string;
  logoBlueLight: string;
  logoGreen: string;
  logoGreenLight: string;

  // Principal
  primary: string;
  primaryPressed: string;
  primarySoft: string;
  primaryTint: string;
  onPrimary: string;
  /** Celeste de marca: acentos, degradados e ilustraciones (no para texto). */
  accent: string;

  // Texto
  heading: string;
  text: string;
  textSecondary: string;
  textMuted: string;
  textInverse: string;
  link: string;

  // Estados
  success: string;
  /** Verde de relleno bajo iconos blancos pequeños (≥ 3:1). */
  successStrong: string;
  successSoft: string;
  successText: string;
  ai: string;
  aiSoft: string;
  aiText: string;
  danger: string;
  dangerPressed: string;
  dangerSoft: string;
  dangerTint: string;
  dangerText: string;
  warning: string;
  warningSoft: string;
  warningText: string;
  premium: string;
  premiumSoft: string;
  premiumText: string;
  favorite: string;
  /** Rojo de la paleta para iconos e ilustraciones (el texto rojo usa dangerText). */
  alert: string;

  // Superficies
  background: string;
  surface: string;
  surfaceAlt: string;
  surfaceMuted: string;
  border: string;
  borderStrong: string;
  divider: string;
  overlay: string;
  skeleton: string;

  // Pantalla de llamada (oscura)
  callBackground: string;
  callSurface: string;
  callText: string;
  callTextMuted: string;

  // Barra de navegación inferior
  tabActive: string;
  tabInactive: string;
}

export const lightColors: ColorScheme = {
  brandMedi: '#15338F',
  brandClaro: '#12958C',
  logoBlue: '#1F6BEB',
  logoBlueLight: '#4A9BF5',
  logoGreen: '#1FA35C',
  logoGreenLight: '#3DBD74',

  primary: palette.brandBlue,
  primaryPressed: palette.brandBlueDark,
  primarySoft: palette.brandBlueLight,
  primaryTint: palette.brandBlueTint,
  onPrimary: palette.white,
  accent: palette.brandSky,

  heading: palette.navy800,
  text: '#1B2542',
  textSecondary: '#4B5563',
  textMuted: palette.brandGray,
  textInverse: palette.white,
  link: palette.brandBlue,

  success: palette.brandGreen,
  successStrong: '#059669',
  successSoft: '#ECFDF5',
  successText: '#047857',
  ai: palette.purple500,
  aiSoft: palette.purple50,
  aiText: palette.purple600,
  danger: '#DC2626',
  dangerPressed: '#B91C1C',
  dangerSoft: '#FEF2F2',
  dangerTint: '#FFF7F7',
  dangerText: '#B91C1C',
  warning: palette.brandOrange,
  warningSoft: '#FEF3C7',
  warningText: '#92400E',
  premium: palette.brandOrange,
  premiumSoft: '#FEF3C7',
  premiumText: '#92400E',
  favorite: palette.brandOrange,
  alert: palette.brandRed,

  background: palette.brandBackground,
  surface: palette.white,
  surfaceAlt: '#F6F8FB',
  surfaceMuted: '#EEF2F7',
  border: '#E2E8F0',
  borderStrong: '#CBD5E1',
  divider: '#EDF1F6',
  overlay: 'rgba(11, 18, 32, 0.55)',
  skeleton: '#EEF2F7',

  callBackground: palette.ink900,
  callSurface: palette.ink700,
  callText: palette.white,
  callTextMuted: '#B4BED0',

  tabActive: palette.brandBlue,
  tabInactive: '#6B7280',
};

/** Alto contraste: textos más oscuros, bordes marcados, azul más profundo. */
export const highContrastColors: ColorScheme = {
  ...lightColors,
  primary: '#1D4ED8',
  primaryPressed: '#1E40AF',
  link: '#1D4ED8',
  heading: palette.navy900,
  text: '#0A0F1A',
  textSecondary: '#252E3F',
  textMuted: '#3A4458',
  successText: '#065F46',
  successStrong: '#047857',
  aiText: '#472AA8',
  dangerText: '#991B1B',
  danger: '#B91C1C',
  warningText: '#78350F',
  premiumText: '#78350F',
  border: palette.slate400,
  borderStrong: palette.slate500,
  divider: palette.slate300,
  tabActive: '#1D4ED8',
  tabInactive: '#4B5568',
  surfaceAlt: '#EEF2F7',
  background: palette.white,
};
