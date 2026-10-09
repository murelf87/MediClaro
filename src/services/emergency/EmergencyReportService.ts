/**
 * MediClaro — EmergencyReportService
 * Construye el EmergencyReport estructurado a partir de todas las fuentes.
 *
 * PRINCIPIO DE SEGURIDAD:
 * - Todos los campos tienen DataProvenance explícito.
 * - Ningún campo puede ser inferido por la IA.
 * - La IA genera texto SOLO a partir de este objeto — nunca inventa hechos.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { secureTextStorage } from '../../lib/secureChunkedStorage';

/** UUID v4 simple (sin dependencia externa) */
function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
import {
  EmergencyReport,
  EmergencyProfile,
  EmergencyLocation,
  EmergencyStatement,
  EmergencyConsent,
  DataProvenance,
  DeclaredItem,
  MedicationReference,
} from './types';
import { calculateAge } from './EmergencyProfileService';

const RECENT_MESSAGES_KEY = 'mediclaro_recent_user_messages';
const CONTEXT_WINDOW_MINUTES = 10;

// ── Almacenamiento cifrado de los mensajes recientes ──────────────────────────
// Son palabras de la persona (pueden contener datos de salud): se guardan
// cifradas en el llavero / Keystore. Una copia antigua en texto plano
// (AsyncStorage) se migra y se elimina.

async function readRecentRaw(): Promise<string | null> {
  const raw = await secureTextStorage.getItem(RECENT_MESSAGES_KEY);
  if (raw) return raw;
  const legacy = await AsyncStorage.getItem(RECENT_MESSAGES_KEY);
  if (!legacy) return null;
  await secureTextStorage.setItem(RECENT_MESSAGES_KEY, legacy).catch(() => undefined);
  await AsyncStorage.removeItem(RECENT_MESSAGES_KEY).catch(() => undefined);
  return legacy;
}

async function writeRecentRaw(value: string): Promise<void> {
  await secureTextStorage.setItem(RECENT_MESSAGES_KEY, value);
}

async function removeRecent(): Promise<void> {
  await secureTextStorage.removeItem(RECENT_MESSAGES_KEY).catch(() => undefined);
  await AsyncStorage.removeItem(RECENT_MESSAGES_KEY).catch(() => undefined);
}

// ── Privacidad: eliminación automática del contexto de emergencia ─────────────
// Section 15: la transcripción se elimina automáticamente salvo consentimiento.

/**
 * Elimina el contexto de conversación reciente almacenado localmente.
 * Llamar siempre al finalizar una sesión de emergencia (IDLE o CALL_TRANSFERRED).
 * Si el usuario tiene consent_share_conversation:false, se llama también al construir el informe.
 */
export async function clearEmergencyContext(): Promise<void> {
  try {
    await removeRecent();
  } catch {
    // Ignorar errores de limpieza — la privacidad no puede fallar silenciosamente
    // pero tampoco debe bloquear el flujo de emergencia.
  }
}

/**
 * Purga los mensajes que superan la ventana temporal configurada.
 * Puede llamarse periódicamente para minimizar el almacenamiento.
 */
export async function purgeExpiredContext(): Promise<void> {
  try {
    const raw = await readRecentRaw();
    if (!raw) return;

    const messages: { text: string; timestamp: string }[] = JSON.parse(raw);
    const cutoff = Date.now() - CONTEXT_WINDOW_MINUTES * 60 * 1000;
    const valid = messages.filter(m => new Date(m.timestamp).getTime() > cutoff);

    if (valid.length === 0) {
      await removeRecent();
    } else if (valid.length < messages.length) {
      await writeRecentRaw(JSON.stringify(valid));
    }
  } catch {
    // Ignorar
  }
}

// ── Recuperar contexto reciente de conversación ───────────────────────────────

interface StoredMessage {
  text: string;
  timestamp: string; // ISO
}

/**
 * Guarda localmente (solo en este teléfono) una pregunta reciente del usuario al
 * asistente, para poder incluirla en una emergencia si el usuario lo permite
 * (consent_share_conversation). Se conserva como máximo CONTEXT_WINDOW_MINUTES.
 */
export async function recordRecentUserMessage(text: string): Promise<void> {
  const clean = text.trim();
  if (!clean) return;
  try {
    const raw = await readRecentRaw();
    const list: StoredMessage[] = raw ? JSON.parse(raw) : [];
    const cutoff = Date.now() - CONTEXT_WINDOW_MINUTES * 60 * 1000;
    const next = [
      ...list.filter(m => new Date(m.timestamp).getTime() > cutoff),
      { text: clean.slice(0, 500), timestamp: new Date().toISOString() },
    ].slice(-10);
    await writeRecentRaw(JSON.stringify(next));
  } catch {
    // Mejor esfuerzo
  }
}

export async function getRecentConversationContext(): Promise<EmergencyStatement[]> {
  try {
    const raw = await readRecentRaw();
    if (!raw) return [];

    const messages: StoredMessage[] = JSON.parse(raw);
    const cutoff = Date.now() - CONTEXT_WINDOW_MINUTES * 60 * 1000;

    return messages
      .filter(m => new Date(m.timestamp).getTime() > cutoff)
      .map(m => ({
        timestamp: m.timestamp,
        speaker: 'user' as const,
        transcript: m.text,
        confidence: 1.0,
        provenance: 'RECENT_CONVERSATION' as DataProvenance,
        isQuickButton: false,
      }));
  } catch {
    return [];
  }
}

// ── Parsear alergias / medicamentos del perfil ────────────────────────────────

function parseDeclaredItems(text: string): DeclaredItem[] {
  if (!text.trim()) return [];
  return text
    .split(/[,;\n]+/)
    .map(s => s.trim())
    .filter(Boolean)
    .map(value => ({ value, provenance: 'USER_DECLARED' as DataProvenance }));
}

function parseMedications(text: string): MedicationReference[] {
  if (!text.trim()) return [];
  return text
    .split(/[,;\n]+/)
    .map(s => s.trim())
    .filter(Boolean)
    .map(name => ({ name, provenance: 'USER_DECLARED' as DataProvenance }));
}

// ── Construir EmergencyReport ─────────────────────────────────────────────────

export interface BuildReportParams {
  profile: EmergencyProfile;
  location?: EmergencyLocation;
  quickSymptoms?: string[];       // IDs de botones rápidos pulsados
  sessionStatements?: EmergencyStatement[]; // Capturados durante la emergencia
  noResponseDetected?: boolean;
  noResponseAt?: string;
}

export async function buildEmergencyReport(params: BuildReportParams): Promise<EmergencyReport> {
  const {
    profile,
    location,
    quickSymptoms = [],
    sessionStatements = [],
    noResponseDetected = false,
    noResponseAt,
  } = params;

  // Contexto de conversación reciente (sólo si hay consentimiento)
  const recentFromChat = profile.consent_share_conversation
    ? await getRecentConversationContext()
    : [];

  const allStatements: EmergencyStatement[] = [
    ...recentFromChat,
    ...sessionStatements,
  ].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  // Construir consentimiento desde perfil
  const consent: EmergencyConsent = {
    shareLocation:           profile.consent_share_location,
    shareAddress:            profile.consent_share_address,
    shareMedications:        profile.consent_share_medications,
    shareAllergies:          profile.consent_share_allergies,
    shareMedicalInfo:        profile.consent_share_medical_info,
    shareRecentConversation: profile.consent_share_conversation,
    notifyEmergencyContact:  profile.consent_notify_contact,
  };

  // Dirección declarada
  const registeredAddress = (
    profile.address && profile.city && profile.consent_share_address
  ) ? {
    street:      profile.address,
    postalCode:  profile.postal_code,
    city:        profile.city,
    province:    profile.province,
    country:     profile.country,
    provenance:  'USER_DECLARED' as const,
  } : undefined;

  // Datos de provenance
  const dataProvenance: Record<string, DataProvenance> = {
    user:                    'USER_DECLARED',
    location:                'DEVICE_LOCATION',
    registeredAddress:       'USER_DECLARED',
    allergies:               'USER_DECLARED',
    medications:             'USER_DECLARED',
    conditions:              'USER_DECLARED',
    recentStatements:        'RECENT_CONVERSATION',
    noResponseDetected:      'SYSTEM_EVENT',
    symptomsSelected:        'USER_SELECTED',
  };

  const age = calculateAge(profile.date_of_birth);

  const report: EmergencyReport = {
    incidentId:         generateUUID(),
    createdAt:          new Date().toISOString(),

    user: {
      fullName:     profile.full_name,
      dateOfBirth:  profile.date_of_birth || undefined,
      age,
      phone:        profile.phone || undefined,
      provenance:   'USER_DECLARED',
    },

    currentLocation:    (location && consent.shareLocation) ? location : undefined,
    registeredAddress,

    declaredAllergies:  consent.shareAllergies
      ? parseDeclaredItems(profile.allergies)
      : [],

    medications:        consent.shareMedications
      ? parseMedications(profile.current_medications)
      : [],

    declaredConditions: consent.shareMedicalInfo
      ? parseDeclaredItems(profile.medical_conditions)
      : [],

    recentStatements:   consent.shareRecentConversation ? allStatements : [],

    symptomsSelected:   quickSymptoms,

    noResponseDetected,
    noResponseAt:       noResponseDetected ? (noResponseAt ?? new Date().toISOString()) : undefined,

    emergencyContact: (
      profile.emergency_contact_name && consent.notifyEmergencyContact
    ) ? {
      name:         profile.emergency_contact_name,
      relationship: profile.emergency_contact_relationship,
      phone:        profile.emergency_contact_phone,
    } : undefined,

    consent,
    dataProvenance,
  };

  return report;
}

/** Genera el texto del resumen verbal SOLO a partir de EmergencyReport.
 *  La IA NO interviene — es una plantilla determinista.
 *  NUNCA dice "está inconsciente" — solo "no se ha detectado respuesta".
 */
export function generateVerbalSummary(report: EmergencyReport): string {
  const lines: string[] = [];

  lines.push('Hola. Soy el asistente de emergencia de MediClaro.');
  lines.push('');

  // Identidad
  const name = report.user.fullName || 'la persona registrada';
  const age = report.user.age ? `, de ${report.user.age} años` : '';
  lines.push(`La persona registrada se llama ${name}${age}.`);

  // Ubicación GPS (NUNCA mezclada con dirección declarada)
  if (report.currentLocation) {
    const loc = report.currentLocation;
    const parts: string[] = [];
    if (loc.resolvedAddress) parts.push(loc.resolvedAddress);
    if (loc.resolvedCity) parts.push(loc.resolvedCity);
    if (loc.resolvedProvince) parts.push(loc.resolvedProvince);

    if (parts.length > 0) {
      const approx = loc.isApproximate ? ' aproximadamente' : '';
      lines.push(`La ubicación actual del dispositivo corresponde${approx} a ${parts.join(', ')}.`);
    } else {
      // Sin dirección (p. ej. sin conexión para traducir el GPS): damos las coordenadas.
      const fmt = (n: number) => `${n < 0 ? 'menos ' : ''}${Math.abs(n).toFixed(5).replace('.', ',')}`;
      const precision = Number.isFinite(loc.accuracy) ? `, con una precisión de unos ${Math.round(loc.accuracy)} metros` : '';
      lines.push(`Las coordenadas actuales del dispositivo son: latitud ${fmt(loc.latitude)}, longitud ${fmt(loc.longitude)}${precision}.`);
    }

    if (loc.resolvedPostalCode) {
      const digits = loc.resolvedPostalCode.split('').join(' ');
      lines.push(`Código postal: ${digits}.`);
    }
    if (parts.length === 0 && report.registeredAddress) {
      const addr = report.registeredAddress;
      lines.push(`La dirección declarada por el usuario es: ${addr.street}, ${addr.city}, ${addr.province}.`);
    }
  } else if (report.registeredAddress) {
    const addr = report.registeredAddress;
    lines.push(`La dirección declarada por el usuario es: ${addr.street}, ${addr.city}, ${addr.province}.`);
    if (addr.postalCode) {
      const digits = addr.postalCode.split('').join(' ');
      lines.push(`Código postal declarado: ${digits}.`);
    }
  } else {
    lines.push('La ubicación no está disponible en este momento.');
  }

  // Síntomas seleccionados (botones rápidos — USER_SELECTED)
  if (report.symptomsSelected.length > 0) {
    const labelMap: Record<string, string> = {
      breathing:  'dificultad para respirar',
      chest:      'dolor en el pecho',
      overdose:   'posible sobredosis de medicación',
      wrong_med:  'medicamento equivocado',
      unwell:     'malestar general',
      cant_speak: 'incapacidad para hablar',
      other:      'otra situación',
    };
    const symptoms = report.symptomsSelected
      .map(id => labelMap[id] ?? id)
      .join(', ');
    lines.push(`El usuario ha indicado mediante selección manual: ${symptoms}.`);
    lines.push('Esta información procede de selección directa del usuario, no es un diagnóstico.');
  }

  // Contexto reciente de conversación
  if (report.recentStatements.length > 0) {
    lines.push('');
    lines.push('Contexto de la conversación reciente:');
    report.recentStatements.slice(-4).forEach(s => {
      const minAgo = Math.round(
        (Date.now() - new Date(s.timestamp).getTime()) / 60000,
      );
      const when = minAgo <= 1 ? 'hace un momento' : `hace ${minAgo} minutos`;
      lines.push(`${when}: "${s.transcript}".`);
    });
  }

  // No respuesta — NUNCA usar el término "inconsciente" (Section 22)
  if (report.noResponseDetected) {
    lines.push('');
    lines.push('No se ha detectado respuesta del usuario durante los últimos sesenta segundos.');
    lines.push('Esta observación procede del sistema de detección de actividad, no de un diagnóstico clínico.');
  }

  // Alergias
  if (report.declaredAllergies.length > 0) {
    const allergies = report.declaredAllergies.map(a => a.value).join(', ');
    lines.push('');
    lines.push(`Las alergias declaradas por el usuario son: ${allergies}.`);
    lines.push('Este dato procede del perfil configurado por el usuario.');
  }

  // Medicamentos
  if (report.medications.length > 0) {
    const meds = report.medications.map(m => m.name).join(', ');
    lines.push(`Los medicamentos declarados son: ${meds}.`);
  }

  // Cierre
  lines.push('');
  lines.push('Esta información procede del perfil configurado voluntariamente por el usuario y de la conversación mantenida inmediatamente antes de solicitar ayuda.');
  lines.push('La decisión sobre movilización de recursos corresponde al servicio de emergencias.');

  return lines.join('\n');
}
