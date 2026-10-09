/**
 * Configuración pública de la app (sin secretos).
 * Los valores que dependen del propietario se leen de variables EXPO_PUBLIC_*.
 * Si están vacíos, la UI oculta el control correspondiente (nunca botones muertos)
 * y FRONTEND_AUDIT.md lo lista como información necesaria.
 */
import Constants from 'expo-constants';

export const APP_NAME = 'MediClaro';
export const APP_TAGLINE = 'Tu guía de medicamentos de forma sencilla y segura';
export const APP_VERSION: string = Constants.expoConfig?.version ?? '1.0.0';

/** Enlaces de publicación/descarga. El ID numérico de Apple se completa al crear la ficha en App Store Connect. */
export const APP_STORE_ID: string = (process.env.EXPO_PUBLIC_APP_STORE_ID ?? '').trim();
export const GOOGLE_PLAY_PACKAGE: string = Constants.expoConfig?.android?.package ?? 'com.mediclaro.app';
export const APP_STORE_URL: string = APP_STORE_ID ? `https://apps.apple.com/app/id${APP_STORE_ID}` : '';
export const GOOGLE_PLAY_URL: string = `https://play.google.com/store/apps/details?id=${encodeURIComponent(GOOGLE_PLAY_PACKAGE)}`;
/** Landing pública opcional. Si existe, es el enlace preferido para compartir con familiares. */
export const APP_SHARE_URL: string = (process.env.EXPO_PUBLIC_APP_SHARE_URL ?? '').trim();

/** Correo de soporte que verá el usuario en Ayuda. */
export const SUPPORT_EMAIL: string = process.env.EXPO_PUBLIC_SUPPORT_EMAIL ?? '';
/** Teléfono de atención (opcional). Vacío = no se muestra. Nunca se inventa. */
export const SUPPORT_PHONE: string = (process.env.EXPO_PUBLIC_SUPPORT_PHONE ?? '').trim();
/**
 * Sello de confianza al que el titular esté ADHERIDO de verdad (p. ej. «Confianza Online»): nombre y página pública de
 * verificación del sello. Vacío = no se muestra ningún sello externo (mostrarlo sin adhesión sería engañoso).
 */
export const TRUST_SEAL = {
  name: (process.env.EXPO_PUBLIC_TRUST_SEAL_NAME ?? '').trim(),
  url: (process.env.EXPO_PUBLIC_TRUST_SEAL_URL ?? '').trim(),
};

/** URLs públicas de los documentos legales (publicados por el propietario). */
export const LEGAL_URLS = {
  terms: process.env.EXPO_PUBLIC_TERMS_URL ?? '',
  privacy: process.env.EXPO_PUBLIC_PRIVACY_URL ?? '',
  legalNotice: process.env.EXPO_PUBLIC_LEGAL_NOTICE_URL ?? '',
} as const;

/** Datos del titular para el aviso legal (LSSI). */
export const COMPANY_INFO = {
  name: process.env.EXPO_PUBLIC_COMPANY_NAME ?? '',
  taxId: process.env.EXPO_PUBLIC_COMPANY_TAX_ID ?? '',
  address: process.env.EXPO_PUBLIC_COMPANY_ADDRESS ?? '',
} as const;

/**
 * Acceso SIN verificar el móvil (botón "Entrar sin verificar" en el login), pedido por
 * el propietario para poder probar toda la app mientras el SMS no está activo.
 * - Si el servidor está conectado y permite accesos anónimos → sesión real de prueba.
 * - Si no → Modo demostración con datos de ejemplo (siempre señalizado en pantalla).
 * Cuándo aparece:
 *   - EXPO_PUBLIC_DEMO_ACCESS = "on"  → sí (perfiles development y preview de eas.json).
 *   - EXPO_PUBLIC_DEMO_ACCESS = "off" → no (perfil production de eas.json).
 *   - sin definir → solo en desarrollo (`npx expo start`); NUNCA en una compilación
 *     de publicación que no lo active expresamente.
 */
const DEMO_ACCESS_ENV = process.env.EXPO_PUBLIC_DEMO_ACCESS || undefined;
const IS_DEV_BUILD = typeof __DEV__ !== 'undefined' && __DEV__;
export const DEMO_ACCESS_ENABLED: boolean =
  DEMO_ACCESS_ENV === 'on' || (DEMO_ACCESS_ENV === undefined && IS_DEV_BUILD);

/** Token efímero de QA: solo se inyecta en builds internas para probar Premium real sin cobro. */
export const QA_ACCESS_TOKEN: string = DEMO_ACCESS_ENABLED
  ? process.env.EXPO_PUBLIC_QA_ACCESS_TOKEN || ''
  : '';

/**
 * ¿Es una compilación de publicación en tienda? (perfil `production`: sin acceso de prueba).
 * Se usa para aplicar con rigor las normas de pago de Apple y Google (ver PAYMENT_CHANNELS).
 */
export const RELEASE_BUILD: boolean = !DEMO_ACCESS_ENABLED;

/**
 * Cobro de Premium DENTRO de la app: vías de pago activas en esta compilación.
 *  - 'store' → compra integrada: Apple (StoreKit) en iPhone y Google Play en Android. Es la vía que exigen
 *              las tiendas para las suscripciones digitales (Apple 3.1.1; política de pagos de Google Play).
 *              Activa también requiere, en el servidor, la función `iap-verify` (app_config.plans.storeVerification).
 *  - 'card'  → tarjeta en la página segura de Stripe (la app nunca ve la tarjeta). En las versiones de tienda
 *              solo aparece si el titular tiene los permisos de pago alternativo de la UE/EEE: en iPhone se
 *              comprueba el permiso y se muestra la hoja de aviso obligatoria de Apple; en Android, el programa
 *              de ofertas externas de Google Play. Ver COMERCIALIZACION.md.
 * Sin ninguna vía ('none') la app funciona como gratuita con los límites del servidor (sin precios ni
 * botones de compra, como la versión 1.1).
 *
 * EXPO_PUBLIC_PAYMENTS_MODE: lista separada por comas → "store", "stripe", "store,stripe" o "none".
 *   eas.json: development y preview → "store,stripe"; production → "store".
 *   Sin definir → "store,stripe" en desarrollo (`npx expo start`) y "store" en cualquier compilación de publicación.
 */
export type PaymentChannel = 'store' | 'card';

export function parsePaymentChannels(raw: string | undefined, devBuild: boolean): PaymentChannel[] {
  const value = (raw ?? '').trim().toLowerCase();
  if (!value) return devBuild ? ['store', 'card'] : ['store'];
  if (value === 'none') return [];
  const parts = value.split(/[\s,+]+/).filter(Boolean);
  const out: PaymentChannel[] = [];
  if (parts.includes('store')) out.push('store');
  if (parts.includes('stripe') || parts.includes('card')) out.push('card');
  return out;
}

export const PAYMENT_CHANNELS: readonly PaymentChannel[] = parsePaymentChannels(
  process.env.EXPO_PUBLIC_PAYMENTS_MODE || undefined,
  IS_DEV_BUILD,
);
export const STORE_PAYMENTS_ENABLED: boolean = PAYMENT_CHANNELS.includes('store');
export const CARD_PAYMENTS_ENABLED: boolean = PAYMENT_CHANNELS.includes('card');
/** ¿Se puede contratar Premium dentro de la app? (si no, ni precios ni botones de compra). */
export const PURCHASES_ENABLED: boolean = PAYMENT_CHANNELS.length > 0;
/**
 * Las funciones reales (identificar, asistente IA, lectura por voz, Mis medicamentos) son de Premium
 * siempre que se pueda contratar en la app. Las emergencias y el 112 NUNCA se bloquean.
 */
export const PREMIUM_REQUIRED: boolean = PURCHASES_ENABLED;

/**
 * Texto del SMS de verificación, tal como lo verá la persona (con el código tapado).
 * Debe coincidir con la plantilla configurada en el servidor: Supabase → Authentication → SMS template
 *   «MediClaro: tu código es {{ .Code }}. No se lo digas a nadie.»
 * (58 caracteres: cabe en UN solo SMS aunque lleve tildes). Ver BACKEND_REQUIREMENTS.md → R-23.
 */
export const SMS_TEMPLATE_EXAMPLE = 'MediClaro: tu código es ••••••. No se lo digas a nadie.';

/** Login por SMS. */
export const OTP_CONFIG = {
  length: 6,
  /** Segundos de espera antes de poder pedir otro código. */
  resendSeconds: 60,
  /**
   * Validez del código en segundos. Debe coincidir con la configuración
   * de Supabase Auth → SMS OTP expiry (ver BACKEND_REQUIREMENTS.md).
   */
  ttlSeconds: Number(process.env.EXPO_PUBLIC_OTP_TTL_SECONDS) > 0 ? Number(process.env.EXPO_PUBLIC_OTP_TTL_SECONDS) : 300,
} as const;

/** Tiempo de inactividad antes de preguntar "¿Sigues ahí?" en el asistente de emergencia. */
export const EMERGENCY_INACTIVITY_SECONDS = 60;

/** Cuenta atrás antes de marcar al servicio privado (el usuario puede cancelar o llamar ya). */
export const EMERGENCY_DIAL_COUNTDOWN_SECONDS = 5;

/** Tiempo para confirmar que el cuidador/familiar ya está atendiendo antes de preparar la escalada al 112. */
export const EMERGENCY_CAREGIVER_RESPONSE_SECONDS = 60;

/**
 * Recursos sanitarios públicos (España). Son números oficiales y públicos;
 * coinciden con los que devuelve el backend del asistente ante una urgencia.
 */
export const PUBLIC_HEALTH_RESOURCES = {
  emergency: { label: 'Emergencias', phone: '112' },
  toxicology: { label: 'Instituto Nacional de Toxicología', phone: '915620420', display: '91 562 04 20' },
  suicidePrevention: { label: 'Línea de atención a la conducta suicida', phone: '024', display: '024' },
} as const;
