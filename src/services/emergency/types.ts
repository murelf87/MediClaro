/**
 * MediClaro — Emergency Module
 * Contratos TypeScript completos para el módulo de emergencias.
 * El backend es construido por otro sistema; este archivo define la interfaz.
 *
 * PRINCIPIO: la IA NO toma decisiones médicas autónomas.
 * Todos los datos médicos llevan su origen (DataProvenance).
 */

// ─── Origen de los datos ─────────────────────────────────────────────────────

export type DataProvenance =
  | 'USER_DECLARED'       // El usuario lo introdujo manualmente
  | 'DEVICE_LOCATION'     // GPS del dispositivo
  | 'MEDICATION_DATABASE' // Base de datos AEMPS
  | 'RECENT_CONVERSATION' // Chat previo con MediClaro
  | 'SYSTEM_EVENT'        // Evento del sistema (tiempo sin respuesta)
  | 'USER_SELECTED';      // El usuario pulsó un botón rápido

// ─── Máquina de estados ───────────────────────────────────────────────────────

export type EmergencyState =
  | 'IDLE'               // Sin emergencia activa
  | 'ACTIVATED'          // Se pulsó el botón — pantalla de confirmación
  | 'LISTENING'          // Asistente escuchando / botones rápidos
  | 'COLLECTING_CONTEXT' // Recopilando: ubicación + perfil + conversación
  | 'LOCATION_PENDING'   // Esperando GPS
  | 'LOCATION_READY'     // GPS obtenido
  | 'REPORT_READY'       // EmergencyReport generado
  | 'DIALING'            // Llamando al número de asistencia principal
  | 'CALL_TRANSFERRED'   // Llamada realizada — pantalla post-llamada
  | 'ASSISTANCE_FAILED'  // El número principal no respondió o no está configurado
  | 'NO_RESPONSE'        // 60 s sin interacción detectada
  | 'OFFLINE'            // Sin internet — modo local
  | 'ERROR';             // Error recuperable

// ─── Identidad del usuario ────────────────────────────────────────────────────

export interface EmergencyUserIdentity {
  fullName: string;
  dateOfBirth?: string;  // ISO: 'YYYY-MM-DD'
  age?: number;           // Calculado, no almacenado
  phone?: string;
  provenance: DataProvenance;
}

// ─── Ubicación GPS ────────────────────────────────────────────────────────────

export interface EmergencyLocation {
  latitude: number;
  longitude: number;
  accuracy: number;        // metros
  timestamp: string;       // ISO
  resolvedAddress?: string;
  resolvedPostalCode?: string;
  resolvedCity?: string;
  resolvedProvince?: string;
  isApproximate: boolean;
  ageSeconds: number;      // segundos desde la obtención
  provenance: 'DEVICE_LOCATION';
}

// ─── Dirección declarada ──────────────────────────────────────────────────────

export interface EmergencyAddress {
  street: string;
  postalCode: string;
  city: string;
  province: string;
  country: string;
  provenance: 'USER_DECLARED';
}

// ─── Items médicos declarados ─────────────────────────────────────────────────

export interface DeclaredItem {
  value: string;
  provenance: DataProvenance;
}

export interface MedicationReference {
  name: string;
  nregistro?: string;
  provenance: DataProvenance;
}

// ─── Declaraciones durante la emergencia ──────────────────────────────────────

export interface EmergencyStatement {
  timestamp: string;
  speaker: 'user' | 'assistant';
  transcript: string;
  confidence: number;       // 0.0 – 1.0
  provenance: DataProvenance;
  isQuickButton?: boolean;  // true si fue un botón rápido, no voz
}

// ─── Consentimientos ─────────────────────────────────────────────────────────

export interface EmergencyConsent {
  shareLocation: boolean;
  shareAddress: boolean;
  shareMedications: boolean;
  shareAllergies: boolean;
  shareMedicalInfo: boolean;
  shareRecentConversation: boolean;
  notifyEmergencyContact: boolean;
}

export const DEFAULT_CONSENT: EmergencyConsent = {
  shareLocation: true,
  shareAddress: true,
  shareMedications: true,
  shareAllergies: true,
  shareMedicalInfo: true,
  shareRecentConversation: true,
  notifyEmergencyContact: true,
};

// ─── Contacto de emergencia ───────────────────────────────────────────────────

export interface EmergencyContactInfo {
  name: string;
  relationship: string;
  phone: string;
}

// ─── Informe estructurado de emergencia ───────────────────────────────────────
// TODOS los campos incluyen su origen (dataProvenance).
// La IA genera texto SOLO a partir de este objeto — nunca inventa hechos.

export interface EmergencyReport {
  incidentId: string;
  createdAt: string;              // ISO
  user: EmergencyUserIdentity;
  currentLocation?: EmergencyLocation;
  registeredAddress?: EmergencyAddress;
  declaredAllergies: DeclaredItem[];
  medications: MedicationReference[];
  declaredConditions: DeclaredItem[];
  recentStatements: EmergencyStatement[];
  symptomsSelected: string[];     // botones rápidos pulsados (USER_SELECTED)
  noResponseDetected: boolean;
  noResponseAt?: string;          // ISO
  emergencyContact?: EmergencyContactInfo;
  consent: EmergencyConsent;
  dataProvenance: Record<string, DataProvenance>;
}

// ─── Perfil almacenado (Supabase) ─────────────────────────────────────────────

export interface EmergencyProfile {
  // Identidad
  full_name: string;
  date_of_birth: string;      // 'YYYY-MM-DD'
  phone: string;
  // Dirección
  address: string;
  postal_code: string;
  city: string;
  province: string;
  country: string;
  // Médico — DATO DECLARADO POR EL USUARIO
  blood_type: string;
  allergies: string;
  medical_conditions: string;
  current_medications: string;
  additional_info: string;
  // Contacto de emergencia
  emergency_contact_name: string;
  emergency_contact_relationship: string;
  emergency_contact_phone: string;
  // Preferencias
  language: string;
  voice_preference: string;
  // Consentimientos
  consent_share_location: boolean;
  consent_share_address: boolean;
  consent_share_medications: boolean;
  consent_share_allergies: boolean;
  consent_share_medical_info: boolean;
  consent_share_conversation: boolean;
  consent_notify_contact: boolean;
}

export const EMPTY_PROFILE: EmergencyProfile = {
  full_name: '', date_of_birth: '', phone: '',
  address: '', postal_code: '', city: '', province: '', country: 'España',
  blood_type: '', allergies: '', medical_conditions: '',
  current_medications: '', additional_info: '',
  emergency_contact_name: '', emergency_contact_relationship: '', emergency_contact_phone: '',
  language: 'es-ES', voice_preference: 'female',
  consent_share_location: true,
  consent_share_address: true,
  consent_share_medications: true,
  consent_share_allergies: true,
  consent_share_medical_info: true,
  consent_share_conversation: true,
  consent_notify_contact: true,
};

// ─── Proveedor de voz (interfaz abstracta) ────────────────────────────────────

export interface EmergencyVoiceProvider {
  speakEmergencyReport(report: EmergencyReport): Promise<void>;
  speakText(text: string): Promise<void>;
  stop(): void;
  pause(): void;
  resume(): void;
  setLanguage(lang: string): void;
  setSpeed(rate: number): void;
}

// ─── Botones rápidos ──────────────────────────────────────────────────────────

export const QUICK_SYMPTOMS = [
  { id: 'breathing', label: 'NO PUEDO\nRESPIRAR BIEN', emoji: '😮‍💨', urgent: true },
  { id: 'chest', label: 'ME DUELE\nEL PECHO', emoji: '💔', urgent: true },
  { id: 'overdose', label: 'HE TOMADO\nMEDICACIÓN DE MÁS', emoji: '💊', urgent: true },
  { id: 'wrong_med', label: 'HE TOMADO EL\nMEDICAMENTO EQUIVOCADO', emoji: '⚠️', urgent: true },
  { id: 'unwell', label: 'ME ENCUENTRO\nMUY MAL', emoji: '🤒', urgent: false },
  { id: 'cant_speak', label: 'NO PUEDO\nHABLAR', emoji: '🤫', urgent: false },
  { id: 'other', label: 'OTRO', emoji: '❓', urgent: false },
] as const;

export type QuickSymptomId = typeof QUICK_SYMPTOMS[number]['id'];

// ─── Configuración de asistencia de emergencia ────────────────────────────────
// Obtenida remotamente desde app_config en Supabase.
// El propietario de MediClaro la modifica desde el dashboard sin recompilar.

export interface EmergencyConfig {
  /** Nombre visible del servicio de asistencia principal (ej: "Central MediClaro") */
  primaryAssistanceName: string;
  /** Número al que se llama al pulsar el botón principal. Vacío = no configurado. */
  primaryAssistanceNumber: string;
  /** Número oficial de emergencias del país (ej: "112"). NUNCA vacío. */
  countryEmergencyNumber: string;
  /**
   * Arquitectura futura: anulaciones por región, idioma, suscripción, horario.
   * Ejemplo: { "PT": { primaryAssistanceName: "Central MediClaro Portugal", ... } }
   */
  regionOverrides?: Record<string, Partial<EmergencyConfig>>;
}

export const DEFAULT_EMERGENCY_CONFIG: EmergencyConfig = {
  primaryAssistanceName:  'Central MediClaro',
  primaryAssistanceNumber: '',       // Sin configurar hasta que el propietario lo establezca
  countryEmergencyNumber: '112',
};

/** Resultado de intentar llamar al número de asistencia principal */
export type AssistanceCallOutcome =
  | 'success'         // La llamada se abrió correctamente
  | 'not_configured'  // primaryAssistanceNumber está vacío
  | 'failed'          // canOpenURL devolvió false
  | 'error';          // Excepción inesperada

// ─── Modo de activación del asistente ────────────────────────────────────────

export type ActivationMode = 'can_speak' | 'cannot_speak' | 'unsure';

// ─── Contexto de conversación reciente ───────────────────────────────────────

export interface EmergencyConversationContext {
  statements: EmergencyStatement[];
  windowMinutes: number;      // por defecto 10
  retrievedAt: string;        // ISO
}
