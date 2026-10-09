/**
 * MediClaro — Tipos de dominio centralizados (frontend).
 *
 * Estos tipos describen lo que la UI consume. Los servicios (src/services)
 * traducen las respuestas reales del backend a estos tipos; ningún componente
 * visual conoce las formas crudas de Supabase, Stripe, Twilio o CIMA.
 */

// ─── Resultado genérico / errores ─────────────────────────────────────────────

export type AppErrorKind =
  | 'offline'            // Sin conexión
  | 'timeout'            // La petición tardó demasiado
  | 'unauthorized'       // Sesión caducada
  | 'limit_reached'      // Cuota del plan agotada (identificaciones / preguntas)
  | 'rate_limited'       // Demasiadas peticiones seguidas
  | 'provider_down'      // Fuente oficial / IA no disponible temporalmente
  | 'not_found'          // No existe
  | 'conflict'           // Estado incompatible (p. ej. ya suscrito)
  | 'invalid_input'      // Datos no válidos
  | 'not_configured'     // Función aún no activada en el backend
  | 'not_available'      // Función no disponible en este dispositivo / plataforma
  | 'permission_denied'  // Permiso del sistema denegado
  | 'cancelled'          // Cancelado por el usuario
  | 'unknown';

// ─── Usuario / perfil ─────────────────────────────────────────────────────────

export type FontSizePreference = 'normal' | 'grande' | 'muy_grande';

export interface UserSettings {
  displayName: string | null;
  fontSize: FontSizePreference;
  easyMode: boolean;
  /** Velocidad de lectura en voz alta (0.5 – 1.5). */
  speechRate: number;
  locale: string;
  onboarded: boolean;
  country: string;
}

export type ProfileSex = 'female' | 'male' | 'other' | 'prefer_not_to_say';

export interface User {
  id: string;
  phone: string | null;
  email: string | null;
  displayName: string | null;
  sex: ProfileSex | null;
  age: number | null;
  contactPhone: string | null;
  avatarUrl: string | null;
  avatarPath: string | null;
  createdAt: string | null;
  settings: UserSettings;
}

/**
 * verified  = entró con su teléfono y código SMS.
 * anonymous = acceso de prueba sin verificar el móvil (sesión real, sin teléfono).
 * demo      = modo demostración con datos de ejemplo (sin servidor).
 */
export type AccessMode = 'verified' | 'anonymous' | 'demo';

export interface AuthSession {
  userId: string;
  phone: string | null;
  email: string | null;
  mode: AccessMode;
}

// ─── Medicamentos ─────────────────────────────────────────────────────────────

/** Resumen de un medicamento (tal como lo devuelve la identificación). */
export interface Medication {
  /** Nº de registro oficial (AEMPS). Es el identificador en toda la app. */
  id: string;
  /** Nombre corto para mostrar: principio activo o marca + dosis ("Paracetamol 1 g"). */
  name: string;
  /** Nombre oficial completo (CIMA), para comprobarlo con la caja. */
  officialName: string;
  laboratory: string | null;
  activeIngredient: string | null;
  pharmaceuticalForm: string | null;
  imageUrl: string | null;
}

/** Candidato devuelto por la identificación, con su puntuación (35–99). */
export interface MedicationCandidate extends Medication {
  score: number;
}

export type IdentifyResult =
  | { status: 'identified'; scanId: number; best: MedicationCandidate; others: MedicationCandidate[] }
  | { status: 'ambiguous'; scanId: number; reason: 'low_confidence' | 'close_matches'; candidates: MedicationCandidate[] }
  | { status: 'not_found'; reason: 'blurry' | 'multiple_items' | 'no_match'; message: string };

export interface IdentifyInput {
  /** JPEG en base64 SIN prefijo `data:`. */
  imageBase64?: string;
  /** Texto de código de barras (EAN-13 / DataMatrix GS1). */
  barcode?: string;
  /** Código nacional (6 dígitos). */
  nationalCode?: string;
}

export interface DataSource {
  label: string;
  url: string | null;
  fetchedAt: string | null;
}

export interface LeafletSection {
  key: 'indicaciones' | 'antes' | 'posologia' | 'efectos' | 'conservacion';
  title: string;
  text: string;
}

export interface MedicationDetail extends Medication {
  activeIngredients: { name: string; amount: string | null; unit: string | null }[];
  presentations: { nationalCode: string; name: string }[];
  requiresPrescription: boolean;
  isMarketed: boolean;
  /** Resumen en lenguaje sencillo elaborado con IA a partir del prospecto oficial. */
  simple: {
    whatFor: string;
    howToTake: string;
    warnings: string[];
    storage: string;
    generatedFrom: string;
    aiAssisted: boolean;
  } | null;
  leaflet: LeafletSection[];
  leafletUrl: string | null;
  technicalSheetUrl: string | null;
  source: DataSource;
}

export interface SavedMedication extends Medication {
  /** Id de la fila guardada. */
  savedId: string;
  isFavorite: boolean;
  savedAt: string;
}

export type HistoryStatus = 'identified' | 'ambiguous' | 'not_found';
export type HistoryMethod = 'barcode' | 'photo' | 'national_code' | 'unknown';

export interface MedicationHistoryEntry {
  id: number;
  medicationId: string | null;
  medicationName: string | null;
  status: HistoryStatus;
  method: HistoryMethod;
  confidence: 'alta' | 'media' | 'baja' | null;
  createdAt: string;
}

/** Alias solicitado por la especificación. */
export type MedicationHistory = MedicationHistoryEntry[];

// ─── Suscripción ──────────────────────────────────────────────────────────────

export type PlanId = string;
export type BillingPeriod = 'monthly' | 'quarterly' | 'annual';

export interface PlanBenefit {
  id: string;
  label: string;
  /** Detalle verificable (p. ej. "100 al mes · plan gratuito: 5"). */
  detail?: string;
  /**
   * También está disponible SIN Premium (p. ej. emergencias y accesibilidad). Se sigue mostrando entre las
   * ventajas (como en el tablero), pero la pantalla de planes lo aclara para no inducir a error.
   */
  alwaysFree?: boolean;
}

export interface Plan {
  id: PlanId;
  name: string;
  period: BillingPeriod;
  /** Precio en céntimos (IVA incluido). */
  priceCents: number;
  currency: 'EUR';
  /** Equivalente mensual en céntimos (para planes trimestrales y anuales). */
  monthlyEquivalentCents: number;
  /** Ahorro frente al mensual, calculado con los precios del catálogo (p. ej. "Ahorra un 33 % aprox."). */
  savingsLabel: string | null;
  /** Lema corto de la tarjeta («Flexibilidad total», «El mejor precio»…). */
  tagline: string | null;
  /** Etiqueta del plan destacado («Recomendado» por defecto; solo con más de un plan). */
  badge: string | null;
  /** Condiciones que deben mostrarse junto al precio (uso adicional, etc.). */
  terms: string[];
  highlighted: boolean;
  /** Si el backend puede cobrar este plan ahora mismo. */
  purchasable: boolean;
  /** Productos equivalentes en las tiendas (compra integrada de Apple / Google Play). */
  store: StoreProductRefs | null;
}

/** Identificadores del plan en App Store Connect y Google Play Console. */
export interface StoreProductRefs {
  apple?: { productId: string } | null;
  /** En Google Play: suscripción (productId) y su plan base (monthly, quarterly, annual…). */
  google?: { productId: string; basePlanId?: string | null } | null;
}

export interface PlanLimits {
  /** Identificaciones sin límite mientras dure la suscripción (ver UNLIMITED_SCANS_FROM). */
  unlimited: boolean;
  monthlyScans: number;
  chatPerDay: number;
  overageEnabled: boolean;
  hardCap: number | null;
}

export interface PlansCatalog {
  plans: Plan[];
  benefits: PlanBenefit[];
  freeLimits: PlanLimits | null;
  premiumLimits: PlanLimits | null;
  /** Nombre visible del proveedor de pago que gestiona el cobro. */
  paymentProviderLabel: string | null;
  /**
   * El backend ya acepta el plan elegido al crear el pago (`create-checkout` con `planId`).
   * Hasta entonces solo se puede contratar el plan mensual (el backend crea siempre ese).
   */
  checkoutAcceptsPlanId: boolean;
  /**
   * El backend ya comprueba las compras de Apple y Google (función `iap-verify`).
   * Hasta entonces no se ofrece la compra integrada: se cobraría sin poder activar Premium.
   */
  storeVerification: boolean;
  /** El servidor acepta Bizum en `create-checkout` (`method: 'bizum'`) y Bizum está activado en Stripe. */
  bizumPayments: boolean;
  /** El servidor tiene la función `family-pay` (un familiar paga con un enlace). */
  familyPayments: boolean;
  /** `create-checkout` acepta `method: 'sepa'` (domiciliación bancaria SEPA) y está activada en Stripe. */
  sepaPayments: boolean;
  /** `create-checkout` acepta `method: 'paypal'` (PayPal con cobro recurrente) y está activado en Stripe. */
  paypalPayments: boolean;
}

export type SubscriptionStatus =
  | 'none'
  | 'active'
  | 'trialing'
  | 'past_due'
  | 'canceled'
  | 'unpaid'
  | 'incomplete'
  | 'paused'
  | 'unknown';

export interface Subscription {
  /** Entitlement granted by server to verified owner accounts, independent of billing. */
  ownerAccess?: boolean;
  courtesyAccess?: boolean;
  plan: 'free' | 'premium';
  isPremium: boolean;
  status: SubscriptionStatus;
  renewsAt: string | null;
  /** La suscripción se ha cancelado y termina al final del periodo pagado (no se renueva). */
  cancelsAtPeriodEnd: boolean;
  provider: 'stripe' | 'apple' | 'google';
  /** Pagado con Bizum: un periodo de una vez, sin renovación automática (Bizum no admite cobros recurrentes). */
  oneTimePayment?: boolean;
  /** La suscripción la paga un familiar o cuidador/a (lo gestiona esa persona). */
  paidByFamily?: boolean;
  /**
   * Uso del mes. Solo se informa cuando el servidor aplica el mismo plan que ve la persona
   * (con Premium, depende de la corrección R-01 del backend); si no, null.
   */
  usage: {
    scansUsed: number;
    scansIncluded: number;
    scansLeft: number;
    /** Sin límite (Premium mientras dure la suscripción): no se muestran contadores. */
    unlimited: boolean;
  } | null;
}

export type PaymentMethod = 'card' | 'apple_pay' | 'google_pay';

/**
 * Vías de pago: compra integrada de la tienda, tarjeta (página segura de Stripe), Bizum (pago único por periodo, en la
 * página de Stripe) o un familiar/cuidador que paga con un enlace.
 */
export type PaymentChannelId = 'store' | 'card' | 'bizum' | 'family' | 'sepa' | 'paypal';

/** Vías que se pagan en la página segura del proveedor (Stripe). */
export type HostedPaymentMethod = 'card' | 'bizum' | 'sepa' | 'paypal';

/** Invitación para que un familiar pague la suscripción (enlace a la página segura de pago). */
export interface FamilyInvite {
  url: string;
  expiresAt: string | null;
  /** Nombre de pila que verá el familiar («María quiere que pagues…»). */
  beneficiaryName: string | null;
  planId: string;
}
export type StorePlatform = 'apple' | 'google';

/** Un plan tal como se puede contratar ahora mismo en este teléfono. */
export interface PlanOffer {
  plan: Plan;
  /** Precio que se muestra y se cobra («4,99 €»). Si se paga en la tienda, el de la tienda. */
  displayPrice: string;
  /** Precio en céntimos usado para comparar planes (ahorro, equivalente mensual). */
  priceCents: number;
  /** Vías verificadas por las que se puede contratar este plan. Vacío = visible, pero todavía no cobrable. */
  channels: PaymentChannelId[];
}

/** Lo que la persona puede contratar en este teléfono. */
export interface PurchaseOffer {
  catalog: PlansCatalog;
  /** Todos los planes comerciales visibles; `channels` indica cuáles se pueden cobrar ahora en este dispositivo. */
  plans: PlanOffer[];
  /** Tienda disponible para pagar (null si no hay compra integrada). */
  store: { platform: StorePlatform } | null;
  /** Pago con tarjeta disponible (null si no). */
  card: { provider: string } | null;
  /** Pago con Bizum disponible (pago único por periodo, procesado por el mismo proveedor que la tarjeta). */
  bizum: { provider: string } | null;
  /** Que pague un familiar con un enlace (null si no). */
  family: { provider: string } | null;
  /** Domiciliación bancaria SEPA (suscripción que se cobra en la cuenta del banco). */
  sepa: { provider: string } | null;
  /** PayPal (suscripción con la cuenta de PayPal). */
  paypal: { provider: string } | null;
}

export type PurchaseOutcome =
  | { status: 'success' }
  /**
   * El pago se completó (o espera aprobación, p. ej. «Pedir la compra» de En familia) pero el backend
   * aún no ha confirmado la suscripción.
   */
  | { status: 'pending'; reason?: 'confirming' | 'approval' }
  | { status: 'cancelled' }
  | { status: 'already_active' }
  /** En web la página se redirige al pago: el resultado llega al volver. */
  | { status: 'redirected' };

export type RestoreOutcome = { status: 'restored'; subscription: Subscription } | { status: 'nothing_to_restore' };

// ─── Asistente IA ─────────────────────────────────────────────────────────────

export type AssistantRole = 'user' | 'assistant';

export interface EmergencyResource {
  label: string;
  phone: string;
}

export interface AssistantMessage {
  id: string;
  role: AssistantRole;
  text: string;
  createdAt: string;
  /** Enlace al prospecto oficial usado como contexto. */
  sourceUrl?: string | null;
  /** Si el asistente detectó una posible urgencia. */
  emergency?: { resources: EmergencyResource[] } | null;
  /** Estado de envío (solo mensajes del usuario). */
  status?: 'sending' | 'sent' | 'error';
  errorKind?: AppErrorKind;
  /** Código del servidor (p. ej. CHAT_LIMIT o PREMIUM_REQUIRED). */
  errorCode?: string;
  errorMessage?: string;
}

export interface AssistantContext {
  medicationId?: string;
  medicationName?: string;
}

// ─── Notificaciones ───────────────────────────────────────────────────────────

export type NotificationPreferenceKey = 'accountAlerts' | 'safetyAlerts' | 'tips';

export interface NotificationPreference {
  key: NotificationPreferenceKey;
  label: string;
  description: string;
  enabled: boolean;
}

// ─── Emergencia ───────────────────────────────────────────────────────────────

export interface Caregiver {
  name: string;
  relationship: string;
  phone: string;
}

export interface PrivateAssistanceService {
  name: string;
  phone: string;
  /** 'user' = configurado por el usuario en este teléfono; 'mediclaro' = central de MediClaro. */
  source: 'user' | 'mediclaro';
}

export interface EmergencySharingPermissions {
  shareLocation: boolean;
  shareAddress: boolean;
  shareMedications: boolean;
  shareAllergies: boolean;
  shareMedicalInfo: boolean;
  shareConversation: boolean;
  notifyContact: boolean;
}

export interface EmergencyProfile {
  fullName: string;
  dateOfBirth: string;   // 'YYYY-MM-DD' o ''
  age: number | null;
  /** Teléfono de la cuenta (login por SMS). */
  phone: string;
  address: string;
  postalCode: string;
  city: string;
  province: string;
  country: string;
  bloodType: string;
  allergies: string;
  medicalConditions: string;
  currentMedications: string;
  /** Médico de cabecera (guardado solo en este teléfono — ver BACKEND_REQUIREMENTS). */
  primaryDoctorName: string;
  primaryDoctorPhone: string;
  caregiver: Caregiver | null;
  permissions: EmergencySharingPermissions;
  updatedAt: string | null;
  /** Origen de los datos cargados. */
  source: 'server' | 'cache' | 'empty';
}

export type EmergencyProfileInput = Omit<EmergencyProfile, 'age' | 'phone' | 'updatedAt' | 'source' | 'caregiver'> & {
  caregiver: Caregiver;
};

// ─── Utilidades de estado de pantalla ─────────────────────────────────────────

export type LoadStatus = 'idle' | 'loading' | 'success' | 'empty' | 'error';
