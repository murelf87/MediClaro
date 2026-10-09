/**
 * EmergencyService — perfil de emergencia, permisos, servicio privado de
 * asistencia y preparación de la información para una emergencia.
 *
 * REGLAS:
 *  1. El 112 SIEMPRE está disponible y es una opción distinta y visible.
 *  2. El contacto designado se intenta antes de la escalada al 112 cuando existe.
 *  3. El 112 solo se abre por una acción explícita del usuario.
 *     Una cuenta atrás nunca inicia una llamada oficial.
 *  4. La IA no diagnostica: los mensajes se generan con datos declarados y contexto explícito.
 *
 * Backend usado (sin modificarlo):
 *  - tabla `emergency_profiles` (vía EmergencyProfileService, con caché offline)
 *  - tabla `app_config` key 'emergency' (vía EmergencyConfigService)
 * Solo en este teléfono (no existen columnas en backend → BACKEND_REQUIREMENTS.md):
 *  - número privado de asistencia elegido por el usuario
 *  - médico de cabecera
 */
import { supabase, AppError, toAppError, invokeFunction } from '../api';
import { secureLocalStore } from '../api/storage';
import { ageFromDob, onlyDigits } from '../utils/format';
import { AuthService } from './AuthService';
import { DemoMode } from './DemoMode';
import { CaregiverService } from './CaregiverService';
import {
  clearEmergencyProfileCache,
  deleteEmergencyProfile,
  loadCachedEmergencyProfile,
  loadEmergencyProfile,
  saveEmergencyProfile,
} from './emergency/EmergencyProfileService';
import { localStore } from '../api/storage';
import { emergencyConfigService } from './emergency/EmergencyConfigService';
import { getCurrentLocation } from './emergency/LocationService';
import { buildEmergencyReport, generateVerbalSummary, clearEmergencyContext } from './emergency/EmergencyReportService';
import {
  buildContactMessage,
  callOfficialEmergency as dialOfficial,
  callPrimaryAssistance,
  canNotifyContact,
  notifyEmergencyContact,
} from './emergency/EmergencyContactService';
import { emergencyVoiceService } from './emergency/EmergencyVoiceService';
import { EmergencyMeshService, type EmergencyTransport } from './emergency/EmergencyMeshService';
import type {
  EmergencyLocation,
  EmergencyProfile as RawEmergencyProfile,
  EmergencyReport,
  EmergencyStatement,
  QuickSymptomId,
} from './emergency/types';
import { EMPTY_PROFILE } from './emergency/types';
import type {
  EmergencyProfile,
  EmergencyProfileInput,
  EmergencySharingPermissions,
  PrivateAssistanceService,
} from '../types';

// ─── Datos que solo viven en este teléfono ────────────────────────────────────

interface LocalExtras {
  privateAssistanceName?: string;
  privateAssistancePhone?: string;
  primaryDoctorName?: string;
  primaryDoctorPhone?: string;
}

async function extrasKey(): Promise<string | null> {
  const { data } = await supabase.auth.getSession().catch(() => ({ data: { session: null } }));
  const id = data.session?.user.id;
  return id ? `mediclaro.emergency.local.v1.${id}` : null;
}

async function readExtras(): Promise<LocalExtras> {
  const key = await extrasKey();
  if (!key) return {};
  return secureLocalStore.getJSON<LocalExtras>(key, {});
}

async function writeExtras(patch: LocalExtras): Promise<void> {
  const key = await extrasKey();
  if (!key) throw new AppError('unauthorized');
  const current = await secureLocalStore.getJSON<LocalExtras>(key, {});
  await secureLocalStore.setJSON(key, { ...current, ...patch });
}

// ─── Cambios pendientes de subir (guardados sin conexión) ─────────────────────

async function pendingKey(): Promise<string | null> {
  const { data } = await supabase.auth.getSession().catch(() => ({ data: { session: null } }));
  const id = data.session?.user.id;
  return id ? `mediclaro.emergency.pending.v1.${id}` : null;
}

async function setPending(value: boolean): Promise<void> {
  const key = await pendingKey();
  if (!key) return;
  if (value) await localStore.setJSON(key, true);
  else await localStore.remove(key);
}

async function isPending(): Promise<boolean> {
  const key = await pendingKey();
  return key ? localStore.getJSON<boolean>(key, false) : false;
}

/**
 * Si hay cambios guardados sin conexión, intenta subirlos ANTES de leer del
 * servidor (así una lectura no borra lo que la persona editó sin red).
 * Devuelve la copia local si sigue sin poder subirse.
 */
async function syncPendingProfile(): Promise<RawEmergencyProfile | null> {
  if (!(await isPending())) return null;
  const cached = await loadCachedEmergencyProfile();
  if (!cached) {
    await setPending(false);
    return null;
  }
  const res = await saveEmergencyProfile(cached);
  if (res.ok) {
    await setPending(false);
    return null;
  }
  return cached;
}

/** Espera como mucho `ms`; si no, devuelve `fallback` (nunca bloquea una emergencia). */
function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return new Promise<T>((resolve) => {
    const timer = setTimeout(() => resolve(fallback), ms);
    promise
      .then((v) => resolve(v))
      .catch(() => resolve(fallback))
      .finally(() => clearTimeout(timer));
  });
}

// ─── Mapeos ───────────────────────────────────────────────────────────────────

function permissionsFromRaw(p: RawEmergencyProfile): EmergencySharingPermissions {
  return {
    shareLocation: p.consent_share_location,
    shareAddress: p.consent_share_address,
    shareMedications: p.consent_share_medications,
    shareAllergies: p.consent_share_allergies,
    shareMedicalInfo: p.consent_share_medical_info,
    shareConversation: p.consent_share_conversation,
    notifyContact: p.consent_notify_contact,
  };
}

function toView(raw: RawEmergencyProfile, extras: LocalExtras, phone: string | null, source: EmergencyProfile['source']): EmergencyProfile {
  const caregiver = raw.emergency_contact_name?.trim()
    ? {
        name: raw.emergency_contact_name.trim(),
        relationship: raw.emergency_contact_relationship?.trim() ?? '',
        phone: raw.emergency_contact_phone?.trim() ?? '',
      }
    : null;
  return {
    fullName: raw.full_name ?? '',
    dateOfBirth: raw.date_of_birth ?? '',
    age: ageFromDob(raw.date_of_birth),
    phone: phone ?? '',
    address: raw.address ?? '',
    postalCode: raw.postal_code ?? '',
    city: raw.city ?? '',
    province: raw.province ?? '',
    country: raw.country || 'España',
    bloodType: raw.blood_type ?? '',
    allergies: raw.allergies ?? '',
    medicalConditions: raw.medical_conditions ?? '',
    currentMedications: raw.current_medications ?? '',
    primaryDoctorName: extras.primaryDoctorName ?? '',
    primaryDoctorPhone: extras.primaryDoctorPhone ?? '',
    caregiver,
    permissions: permissionsFromRaw(raw),
    updatedAt: null,
    source,
  };
}

function isEmptyRaw(raw: RawEmergencyProfile): boolean {
  return !raw.full_name?.trim() && !raw.address?.trim() && !raw.allergies?.trim() &&
    !raw.current_medications?.trim() && !raw.emergency_contact_name?.trim();
}

function validPhoneOrEmpty(phone: string): boolean {
  const d = onlyDigits(phone);
  return d.length === 0 || (d.length >= 3 && d.length <= 15);
}

function validDob(dob: string): boolean {
  if (!dob) return true;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dob);
  if (!m) return false;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  if (d.getMonth() !== Number(m[2]) - 1) return false;
  return d.getTime() <= Date.now() && Number(m[1]) >= 1900;
}

// ─── Información preparada ────────────────────────────────────────────────────

export interface PreparedEmergency {
  report: EmergencyReport;
  /** Mensaje que se puede leer en voz alta al operador (plantilla determinista). */
  voiceMessage: string;
  /** Texto del SMS para el contacto de emergencia. */
  caregiverMessage: string | null;
  profile: EmergencyProfile;
  location: EmergencyLocation | null;
  locationError: string | null;
  preparedAt: string;
}

export interface PrepareInput {
  symptoms: QuickSymptomId[];
  statements: EmergencyStatement[];
  noResponseDetected: boolean;
  noResponseAt?: string | null;
}

// ─── Servicio ─────────────────────────────────────────────────────────────────

export const EmergencyService = {
  async getEmergencyProfile(): Promise<EmergencyProfile> {
    const [extras, session] = await Promise.all([readExtras(), AuthService.getSession()]);
    const unsynced = await syncPendingProfile();
    if (unsynced) return toView(unsynced, extras, session?.phone ?? null, 'cache');

    const { profile, source } = await loadEmergencyProfile();
    if (source === 'unavailable') {
      throw new AppError('offline', 'No hemos podido cargar tu perfil de emergencia. Comprueba tu conexión.');
    }
    const mappedSource: EmergencyProfile['source'] =
      source === 'supabase' ? 'server' : source === 'cache' ? 'cache' : 'empty';
    const view = toView(profile, extras, session?.phone ?? null, mappedSource);
    return view.source !== 'empty' && isEmptyRaw(profile) ? { ...view, source: 'empty' } : view;
  },

  /**
   * Para «Descargar mis datos»: el perfil de emergencia (servidor o, sin red, la copia del teléfono)
   * y lo que solo vive en este teléfono (servicio privado de asistencia y médico). Nunca lanza.
   */
  async exportForAccount(): Promise<{
    profile: RawEmergencyProfile | null;
    privateAssistance: { name: string; phone: string } | null;
    primaryDoctor: { name: string; phone: string } | null;
  }> {
    const extras = await readExtras().catch((): LocalExtras => ({}));
    let profile: RawEmergencyProfile | null = null;
    try {
      const loaded = await loadEmergencyProfile();
      profile = loaded.source === 'empty' || loaded.source === 'unavailable' || isEmptyRaw(loaded.profile) ? null : loaded.profile;
    } catch {
      profile = (await loadCachedEmergencyProfile().catch(() => null)) ?? null;
    }
    const privatePhone = extras.privateAssistancePhone?.trim() ?? '';
    const doctorName = extras.primaryDoctorName?.trim() ?? '';
    const doctorPhone = extras.primaryDoctorPhone?.trim() ?? '';
    return {
      profile,
      privateAssistance: privatePhone ? { name: extras.privateAssistanceName?.trim() ?? '', phone: privatePhone } : null,
      primaryDoctor: doctorName || doctorPhone ? { name: doctorName, phone: doctorPhone } : null,
    };
  },

  /**
   * Borra el perfil de emergencia (datos de salud declarados) sin eliminar la cuenta: en el servidor
   * y en el teléfono (incluido el médico de cabecera). El número privado de asistencia se conserva:
   * no es un dato de salud y se gestiona en su propia pantalla.
   */
  async deleteEmergencyProfile(): Promise<void> {
    if (!(await AuthService.getSession())) throw new AppError('unauthorized');
    const res = await deleteEmergencyProfile();
    if (!res.ok) {
      throw new AppError('offline', 'No hemos podido borrar tu perfil de emergencia. Comprueba tu conexión e inténtalo de nuevo.');
    }
    await setPending(false);
    await writeExtras({ primaryDoctorName: '', primaryDoctorPhone: '' }).catch(() => undefined);
    await clearEmergencyContext();
  },

  /** ¿Hay cambios del perfil guardados solo en este teléfono, pendientes de subir? */
  async hasPendingChanges(): Promise<boolean> {
    return isPending();
  },

  /** Guarda el perfil. `synced=false` si solo se pudo guardar en el teléfono. */
  async updateEmergencyProfile(input: EmergencyProfileInput): Promise<{ synced: boolean; message?: string }> {
    if (!input.fullName.trim()) throw new AppError('invalid_input', 'Escribe tu nombre y apellidos.');
    if (!validDob(input.dateOfBirth)) throw new AppError('invalid_input', 'Revisa la fecha de nacimiento.');
    if (!validPhoneOrEmpty(input.caregiver.phone)) throw new AppError('invalid_input', 'Revisa el teléfono de tu contacto.');
    if (!validPhoneOrEmpty(input.primaryDoctorPhone)) throw new AppError('invalid_input', 'Revisa el teléfono de tu médico.');

    const { profile: current } = await loadEmergencyProfile();
    const raw: RawEmergencyProfile = {
      ...EMPTY_PROFILE,
      ...current,
      full_name: input.fullName.trim(),
      date_of_birth: input.dateOfBirth,
      address: input.address.trim(),
      postal_code: input.postalCode.trim(),
      city: input.city.trim(),
      province: input.province.trim(),
      country: input.country.trim() || 'España',
      blood_type: input.bloodType.trim(),
      allergies: input.allergies.trim(),
      medical_conditions: input.medicalConditions.trim(),
      current_medications: input.currentMedications.trim(),
      emergency_contact_name: input.caregiver.name.trim(),
      emergency_contact_relationship: input.caregiver.relationship.trim(),
      emergency_contact_phone: input.caregiver.phone.trim(),
      consent_share_location: input.permissions.shareLocation,
      consent_share_address: input.permissions.shareAddress,
      consent_share_medications: input.permissions.shareMedications,
      consent_share_allergies: input.permissions.shareAllergies,
      consent_share_medical_info: input.permissions.shareMedicalInfo,
      consent_share_conversation: input.permissions.shareConversation,
      consent_notify_contact: input.permissions.notifyContact,
    };
    await writeExtras({
      primaryDoctorName: input.primaryDoctorName.trim(),
      primaryDoctorPhone: input.primaryDoctorPhone.trim(),
    });
    const res = await saveEmergencyProfile(raw);
    await setPending(!res.ok);
    return res.ok
      ? { synced: true }
      : { synced: false, message: 'Guardado en este teléfono. Lo subiremos automáticamente la próxima vez que abras tu perfil con conexión.' };
  },

  async getSharingPermissions(): Promise<EmergencySharingPermissions> {
    const unsynced = await syncPendingProfile();
    if (unsynced) return permissionsFromRaw(unsynced);
    const { profile, source } = await loadEmergencyProfile();
    if (source === 'unavailable') {
      throw new AppError('offline', 'No hemos podido cargar tus permisos. Comprueba tu conexión.');
    }
    return permissionsFromRaw(profile);
  },

  async updateSharingPermissions(p: EmergencySharingPermissions): Promise<{ synced: boolean }> {
    const unsynced = await syncPendingProfile();
    const profile = unsynced ?? (await loadEmergencyProfile()).profile;
    const res = await saveEmergencyProfile({
      ...profile,
      consent_share_location: p.shareLocation,
      consent_share_address: p.shareAddress,
      consent_share_medications: p.shareMedications,
      consent_share_allergies: p.shareAllergies,
      consent_share_medical_info: p.shareMedicalInfo,
      consent_share_conversation: p.shareConversation,
      consent_notify_contact: p.notifyContact,
    });
    await setPending(!res.ok);
    if (!p.shareConversation) await clearEmergencyContext();
    return { synced: res.ok };
  },

  /** Número oficial de emergencias (nunca vacío y nunca espera a la red más de 0,8 s). */
  async getOfficialEmergencyNumber(): Promise<string> {
    const config = await withTimeout(emergencyConfigService.getConfig(), 800, null);
    return config?.countryEmergencyNumber?.trim() || '112';
  },

  /**
   * Servicio privado de asistencia: primero el que eligió el usuario en este
   * teléfono; si no hay, la central de MediClaro (si el propietario la configuró).
   */
  async getPrivateAssistanceNumber(): Promise<PrivateAssistanceService | null> {
    const extras = await readExtras();
    if (extras.privateAssistancePhone?.trim()) {
      return {
        name: extras.privateAssistanceName?.trim() || 'Mi servicio de asistencia',
        phone: extras.privateAssistancePhone.trim(),
        source: 'user',
      };
    }
    const config = await withTimeout(emergencyConfigService.getConfig(), 2500, null);
    if (config?.primaryAssistanceNumber?.trim()) {
      return { name: config.primaryAssistanceName, phone: config.primaryAssistanceNumber.trim(), source: 'mediclaro' };
    }
    return null;
  },

  async setPrivateAssistanceService(input: { name: string; phone: string }): Promise<void> {
    const digits = onlyDigits(input.phone);
    if (digits.length < 3 || digits.length > 15) throw new AppError('invalid_input', 'Revisa el número de teléfono.');
    if (['112', '091', '092', '061', '062', '080', '085'].includes(digits)) {
      throw new AppError('invalid_input', 'Este es un número público de emergencias. El 112 ya está siempre disponible por separado.');
    }
    await writeExtras({ privateAssistanceName: input.name.trim() || 'Mi servicio de asistencia', privateAssistancePhone: input.phone.trim() });
  },

  async clearPrivateAssistanceService(): Promise<void> {
    await writeExtras({ privateAssistanceName: '', privateAssistancePhone: '' });
  },

  /** Recopila perfil + ubicación + contexto y construye el informe. Nunca lanza. */
  async prepareEmergencyContext(input: PrepareInput): Promise<PreparedEmergency> {
    // En una emergencia nunca se espera indefinidamente a la red:
    // perfil (máx. 4 s, si no, copia local) y ubicación (máx. 8 s).
    const [cached, pending, extras, session] = await Promise.all([
      loadCachedEmergencyProfile(),
      isPending(),
      readExtras(),
      AuthService.getSession(),
    ]);
    let profile: RawEmergencyProfile;
    if (pending && cached) {
      profile = cached;
    } else {
      const res = await withTimeout(loadEmergencyProfile(), 4000, {
        profile: cached ?? { ...EMPTY_PROFILE },
        source: cached ? ('cache' as const) : ('empty' as const),
      });
      profile = res.profile;
    }
    const rawWithPhone: RawEmergencyProfile = { ...profile, phone: session?.phone ?? profile.phone ?? '' };

    let location: EmergencyLocation | null = null;
    let locationError: string | null = null;
    if (rawWithPhone.consent_share_location) {
      const loc = await withTimeout(getCurrentLocation().catch(() => null), 8000, null);
      if (loc && loc.ok) location = loc.location;
      else locationError = loc && !loc.ok ? loc.message : 'Ubicación no disponible todavía';
    } else {
      locationError = 'No has permitido compartir tu ubicación';
    }

    const report = await buildEmergencyReport({
      profile: rawWithPhone,
      location: location ?? undefined,
      quickSymptoms: input.symptoms,
      sessionStatements: input.statements,
      noResponseDetected: input.noResponseDetected,
      noResponseAt: input.noResponseAt ?? undefined,
    });

    return {
      report,
      voiceMessage: generateVerbalSummary(report),
      caregiverMessage: canNotifyContact(report) ? buildContactMessage(report, report.user.fullName) : null,
      profile: toView(rawWithPhone, extras, session?.phone ?? null, isEmptyRaw(profile) ? 'empty' : 'server'),
      location,
      locationError,
      preparedAt: new Date().toISOString(),
    };
  },

  /** Llama al servicio privado. NUNCA deriva al 112 si falla. */
  async callPrivateAssistance(): Promise<'success' | 'not_configured' | 'failed'> {
    const service = await EmergencyService.getPrivateAssistanceNumber();
    if (!service) return 'not_configured';
    // Modo demostración: se simula la llamada al servicio privado (el número es de ejemplo).
    if (DemoMode.isActive() && service.source === 'mediclaro') return 'success';
    const outcome = await callPrimaryAssistance({
      primaryAssistanceName: service.name,
      primaryAssistanceNumber: service.phone,
      countryEmergencyNumber: '112',
    });
    if (outcome === 'success') return 'success';
    if (outcome === 'not_configured') return 'not_configured';
    return 'failed';
  },

  /** ¿La llamada al servicio privado es simulada? (modo demostración con la central de ejemplo) */
  async isPrivateCallSimulated(): Promise<boolean> {
    if (!DemoMode.isActive()) return false;
    const service = await EmergencyService.getPrivateAssistanceNumber();
    return service?.source === 'mediclaro';
  },

  /** Llama al número oficial de emergencias. Siempre disponible (también en demostración). */
  async callOfficialEmergency(): Promise<boolean> {
    const number = await EmergencyService.getOfficialEmergencyNumber();
    return dialOfficial(number);
  },

  /** Registra un aviso privado para cuidadores vinculados. Requiere conexión. */
  async contactCaregiverAutomatically(prepared: PreparedEmergency): Promise<{ attemptId: string; queued: boolean }> {
    if (DemoMode.isActive()) throw new Error('Modo demostración: no se avisa a personas reales.');
    const statements = prepared.report.recentStatements.filter(s => s.speaker === 'user').slice(-6).map(s => s.transcript);
    const summary = [
      'El paciente ha activado un aviso de malestar.',
      ...statements,
      prepared.report.noResponseDetected ? 'La app no ha detectado respuesta del paciente.' : '',
    ].filter(Boolean).join('\n').slice(0, 2000);
    const result = await CaregiverService.start(prepared.report.incidentId, summary);
    return { attemptId: result.incidentId, queued: result.queued };
  },

  async getCaregiverContactStatus(attemptId: string): Promise<{ acknowledged: boolean; acknowledgedAt: string | null }> {
    const snapshot = await CaregiverService.snapshot();
    const incident = snapshot.incidents.find(i => i.id === attemptId);
    const acknowledgedAt = incident?.members.find(m => m.acknowledgedAt)?.acknowledgedAt ?? null;
    return { acknowledged: !!acknowledgedAt, acknowledgedAt };
  },

  async notifyCaregiver(report: EmergencyReport): Promise<{ ok: boolean; message?: string }> {
    if (DemoMode.isActive()) {
      return { ok: true, message: 'Modo demostración: no se ha enviado ningún SMS real.' };
    }
    try {
      const res = await notifyEmergencyContact(report);
      return { ok: res.ok, message: res.message };
    } catch (e) {
      return { ok: false, message: toAppError(e).message };
    }
  },

  /** Lee un texto en voz alta (lento y claro). */
  async speak(text: string, rate = 0.8): Promise<void> {
    emergencyVoiceService.setSpeed(rate);
    await emergencyVoiceService.speakText(text);
  },

  stopSpeaking(): void {
    emergencyVoiceService.stop();
  },

  /**
   * Antes de cerrar sesión: intenta subir los cambios pendientes (máx. 3 s) y
   * borra las copias locales para que otra cuenta en este teléfono no las vea.
   */
  async beforeSignOut(): Promise<void> {
    await withTimeout(syncPendingProfile(), 3000, null);
    await setPending(false);
    await clearEmergencyProfileCache();
    await clearEmergencyContext();
  },

  /**
   * Al ELIMINAR la cuenta: borra también lo que de esa cuenta solo vivía en este
   * teléfono (servicio privado de asistencia, médico, cambios pendientes).
   */
  async forgetAccountLocalData(userId: string): Promise<void> {
    await secureLocalStore.remove(`mediclaro.emergency.local.v1.${userId}`);
    await localStore.remove(`mediclaro.emergency.pending.v1.${userId}`);
    await clearEmergencyProfileCache();
    await clearEmergencyContext();
  },

  /** Limpieza cuando la sesión termina sin cierre voluntario (caducada). */
  async clearLocalData(): Promise<void> {
    await clearEmergencyProfileCache();
    await clearEmergencyContext();
  },

  /** Borra el contexto temporal de conversación tras una emergencia. */
  async finishSession(): Promise<void> {
    await clearEmergencyContext();
  },
};
