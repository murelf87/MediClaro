/**
 * Tests — EmergencyReportService (Section 21)
 *
 * Escenarios cubiertos:
 * - buildEmergencyReport con perfil completo
 * - noResponseDetected:true / false
 * - perfil vacío
 * - todos los consents = false (no datos médicos en report)
 * - generateVerbalSummary NUNCA dice "inconsciente"
 * - IDs de incidente únicos (reinicio del proceso)
 * - contexto de conversación reciente (ventana 10 min)
 *
 * NOTA: NO usamos jest.resetModules() para que AsyncStorage sea
 * la misma instancia que usa el servicio (vía moduleNameMapper).
 */

import { __reset as resetStorage, __set as setStorage, __get as getStorage } from '../__mocks__/async-storage';
import { __reset as resetSecureStore } from '../__mocks__/expo-secure-store';
import {
  buildEmergencyReport,
  generateVerbalSummary,
  getRecentConversationContext,
  recordRecentUserMessage,
  clearEmergencyContext,
} from '../EmergencyReportService';
import { secureTextStorage } from '../../../lib/secureChunkedStorage';
import type { EmergencyProfile, EmergencyLocation } from '../types';

const RECENT_KEY = 'mediclaro_recent_user_messages';

beforeEach(() => {
  resetStorage();
  resetSecureStore();
  jest.clearAllMocks();
});

// ─── Fixtures ────────────────────────────────────────────────────────────────

const PROFILE_COMPLETO: EmergencyProfile = {
  full_name: 'María García López',
  date_of_birth: '1948-03-15',
  phone: '+34612345678',
  address: 'Calle Mayor 12, 3º B',
  postal_code: '28001',
  city: 'Madrid',
  province: 'Comunidad de Madrid',
  country: 'España',
  blood_type: 'A+',
  allergies: 'Penicilina, Ibuprofeno',
  medical_conditions: 'Hipertensión arterial, Diabetes tipo 2',
  current_medications: 'Enalapril 10mg, Metformina 500mg',
  additional_info: 'Marcapasos implantado 2020',
  emergency_contact_name: 'Pedro García',
  emergency_contact_relationship: 'Hijo',
  emergency_contact_phone: '+34698765432',
  language: 'es-ES',
  voice_preference: 'female',
  consent_share_location: true,
  consent_share_address: true,
  consent_share_medications: true,
  consent_share_allergies: true,
  consent_share_medical_info: true,
  consent_share_conversation: true,
  consent_notify_contact: true,
};

const PROFILE_VACIO: EmergencyProfile = {
  full_name: '',
  date_of_birth: '',
  phone: '',
  address: '',
  postal_code: '',
  city: '',
  province: '',
  country: 'España',
  blood_type: '',
  allergies: '',
  medical_conditions: '',
  current_medications: '',
  additional_info: '',
  emergency_contact_name: '',
  emergency_contact_relationship: '',
  emergency_contact_phone: '',
  language: 'es-ES',
  voice_preference: 'female',
  consent_share_location: true,
  consent_share_address: true,
  consent_share_medications: true,
  consent_share_allergies: true,
  consent_share_medical_info: true,
  consent_share_conversation: true,
  consent_notify_contact: true,
};

const PROFILE_SIN_CONSENT: EmergencyProfile = {
  ...PROFILE_COMPLETO,
  consent_share_location: false,
  consent_share_address: false,
  consent_share_medications: false,
  consent_share_allergies: false,
  consent_share_medical_info: false,
  consent_share_conversation: false,
  consent_notify_contact: false,
};

const LOCATION: EmergencyLocation = {
  latitude: 40.4168,
  longitude: -3.7038,
  accuracy: 15,
  timestamp: new Date().toISOString(),
  resolvedAddress: 'Calle Mayor 12',
  resolvedPostalCode: '28001',
  resolvedCity: 'Madrid',
  resolvedProvince: 'Comunidad de Madrid',
  isApproximate: false,
  ageSeconds: 8,
  provenance: 'DEVICE_LOCATION',
};

// ─── buildEmergencyReport ─────────────────────────────────────────────────────

describe('buildEmergencyReport — usuario responde (perfil completo)', () => {

  it('crea un incidentId UUID único', async () => {
    const r1 = await buildEmergencyReport({ profile: PROFILE_COMPLETO });
    const r2 = await buildEmergencyReport({ profile: PROFILE_COMPLETO });
    expect(r1.incidentId).toMatch(/^[0-9a-f-]{36}$/);
    expect(r1.incidentId).not.toBe(r2.incidentId);
  });

  it('incluye el nombre del usuario con provenance USER_DECLARED', async () => {
    const report = await buildEmergencyReport({ profile: PROFILE_COMPLETO, location: LOCATION });
    expect(report.user.fullName).toBe('María García López');
    expect(report.user.provenance).toBe('USER_DECLARED');
  });

  it('incluye la ubicación GPS cuando shareLocation:true', async () => {
    const report = await buildEmergencyReport({ profile: PROFILE_COMPLETO, location: LOCATION });
    expect(report.currentLocation).toBeDefined();
    expect(report.currentLocation?.provenance).toBe('DEVICE_LOCATION');
  });

  it('incluye alergias parseadas cuando shareAllergies:true', async () => {
    const report = await buildEmergencyReport({ profile: PROFILE_COMPLETO });
    expect(report.declaredAllergies.length).toBe(2);
    expect(report.declaredAllergies[0].value).toBe('Penicilina');
    expect(report.declaredAllergies[0].provenance).toBe('USER_DECLARED');
  });

  it('incluye medicamentos cuando shareMedications:true', async () => {
    const report = await buildEmergencyReport({ profile: PROFILE_COMPLETO });
    expect(report.medications.length).toBe(2);
    expect(report.medications[0].name).toContain('Enalapril');
  });

  it('incluye contacto de emergencia cuando notifyEmergencyContact:true', async () => {
    const report = await buildEmergencyReport({ profile: PROFILE_COMPLETO });
    expect(report.emergencyContact?.name).toBe('Pedro García');
    expect(report.emergencyContact?.phone).toBe('+34698765432');
  });

  it('registra síntomas seleccionados (USER_SELECTED — botones rápidos)', async () => {
    const report = await buildEmergencyReport({
      profile: PROFILE_COMPLETO,
      quickSymptoms: ['breathing', 'chest'],
    });
    expect(report.symptomsSelected).toContain('breathing');
    expect(report.symptomsSelected).toContain('chest');
  });
});

describe('buildEmergencyReport — usuario NO responde', () => {

  it('registra noResponseDetected:true con timestamp', async () => {
    const noResponseAt = new Date().toISOString();
    const report = await buildEmergencyReport({
      profile: PROFILE_COMPLETO,
      noResponseDetected: true,
      noResponseAt,
    });
    expect(report.noResponseDetected).toBe(true);
    expect(report.noResponseAt).toBe(noResponseAt);
  });

  it('noResponseDetected:false cuando usuario interactúa (defecto)', async () => {
    const report = await buildEmergencyReport({ profile: PROFILE_COMPLETO });
    expect(report.noResponseDetected).toBe(false);
    expect(report.noResponseAt).toBeUndefined();
  });
});

describe('buildEmergencyReport — sin ficha médica', () => {

  it('genera un report válido con perfil vacío', async () => {
    const report = await buildEmergencyReport({ profile: PROFILE_VACIO });
    expect(report.incidentId).toBeDefined();
    expect(report.declaredAllergies).toEqual([]);
    expect(report.medications).toEqual([]);
    expect(report.emergencyContact).toBeUndefined();
  });
});

describe('buildEmergencyReport — sin consentimiento', () => {

  it('no incluye ubicación cuando shareLocation:false', async () => {
    const report = await buildEmergencyReport({
      profile: PROFILE_SIN_CONSENT,
      location: LOCATION,
    });
    expect(report.currentLocation).toBeUndefined();
  });

  it('no incluye alergias cuando shareAllergies:false', async () => {
    const report = await buildEmergencyReport({ profile: PROFILE_SIN_CONSENT });
    expect(report.declaredAllergies).toEqual([]);
  });

  it('no incluye medicamentos cuando shareMedications:false', async () => {
    const report = await buildEmergencyReport({ profile: PROFILE_SIN_CONSENT });
    expect(report.medications).toEqual([]);
  });

  it('no incluye condiciones médicas cuando shareMedicalInfo:false', async () => {
    const report = await buildEmergencyReport({ profile: PROFILE_SIN_CONSENT });
    expect(report.declaredConditions).toEqual([]);
  });

  it('no incluye contacto de emergencia cuando notifyEmergencyContact:false', async () => {
    const report = await buildEmergencyReport({ profile: PROFILE_SIN_CONSENT });
    expect(report.emergencyContact).toBeUndefined();
  });
});

// ─── generateVerbalSummary — seguridad crítica ────────────────────────────────

describe('generateVerbalSummary — seguridad crítica', () => {

  it('NUNCA incluye la palabra "inconsciente"', async () => {
    const report = await buildEmergencyReport({
      profile: PROFILE_COMPLETO,
      noResponseDetected: true,
    });
    const text = generateVerbalSummary(report);
    expect(text.toLowerCase()).not.toContain('inconsciente');
  });

  it('usa "no se ha detectado respuesta" cuando noResponseDetected:true', async () => {
    const report = await buildEmergencyReport({
      profile: PROFILE_COMPLETO,
      noResponseDetected: true,
    });
    const text = generateVerbalSummary(report);
    expect(text.toLowerCase()).toContain('no se ha detectado respuesta');
  });

  it('incluye el nombre del usuario', async () => {
    const report = await buildEmergencyReport({ profile: PROFILE_COMPLETO });
    const text = generateVerbalSummary(report);
    expect(text).toContain('María García López');
  });

  it('incluye las alergias declaradas', async () => {
    const report = await buildEmergencyReport({ profile: PROFILE_COMPLETO });
    const text = generateVerbalSummary(report);
    expect(text).toContain('Penicilina');
  });

  it('incluye la ubicación GPS (no mezclada con dirección declarada)', async () => {
    const report = await buildEmergencyReport({ profile: PROFILE_COMPLETO, location: LOCATION });
    const text = generateVerbalSummary(report);
    expect(text).toContain('ubicación actual');
    expect(text).not.toMatch(/ubicación actual.*declarada|declarada.*ubicación actual/i);
  });

  it('pronuncia código postal dígito a dígito', async () => {
    const report = await buildEmergencyReport({ profile: PROFILE_COMPLETO, location: LOCATION });
    const text = generateVerbalSummary(report);
    expect(text).toContain('2 8 0 0 1');
  });

  it('no incluye información médica cuando todos los consents son false', async () => {
    const report = await buildEmergencyReport({ profile: PROFILE_SIN_CONSENT });
    const text = generateVerbalSummary(report);
    expect(text).not.toContain('Penicilina');
    expect(text).not.toContain('Enalapril');
  });

  it('menciona que la decisión corresponde al servicio de emergencias', async () => {
    const report = await buildEmergencyReport({ profile: PROFILE_COMPLETO });
    const text = generateVerbalSummary(report);
    expect(text.toLowerCase()).toContain('servicio de emergencias');
  });
});

// ─── getRecentConversationContext ────────────────────────────────────────────

describe('getRecentConversationContext', () => {

  it('devuelve vacío si no hay mensajes guardados', async () => {
    const ctx = await getRecentConversationContext();
    expect(ctx).toEqual([]);
  });

  it('recupera mensajes dentro de la ventana de 10 minutos', async () => {
    const recentMsg = {
      text: 'Me duele el pecho',
      timestamp: new Date().toISOString(),
    };
    setStorage(RECENT_KEY, JSON.stringify([recentMsg]));
    const ctx = await getRecentConversationContext();
    expect(ctx.length).toBe(1);
    expect(ctx[0].transcript).toBe('Me duele el pecho');
    expect(ctx[0].provenance).toBe('RECENT_CONVERSATION');
  });

  it('ignora mensajes de más de 10 minutos', async () => {
    const oldTs = new Date(Date.now() - 12 * 60 * 1000).toISOString();
    setStorage(RECENT_KEY, JSON.stringify([{ text: 'Mensaje antiguo', timestamp: oldTs }]));
    const ctx = await getRecentConversationContext();
    expect(ctx).toEqual([]);
  });
});

// ─── Mensajes recientes — cifrados en el teléfono ────────────────────────────

describe('mensajes recientes — almacenamiento cifrado', () => {

  it('recordRecentUserMessage guarda cifrado y nunca en texto plano', async () => {
    await recordRecentUserMessage('Me he tomado dos pastillas de más');
    expect(getStorage(RECENT_KEY)).toBeUndefined();
    expect(await secureTextStorage.getItem(RECENT_KEY)).toContain('dos pastillas');
    const ctx = await getRecentConversationContext();
    expect(ctx.map((m) => m.transcript)).toEqual(['Me he tomado dos pastillas de más']);
  });

  it('clearEmergencyContext borra los mensajes cifrados y cualquier copia antigua', async () => {
    await recordRecentUserMessage('Hola');
    setStorage(RECENT_KEY, JSON.stringify([{ text: 'antiguo', timestamp: new Date().toISOString() }]));
    await clearEmergencyContext();
    expect(await secureTextStorage.getItem(RECENT_KEY)).toBeNull();
    expect(getStorage(RECENT_KEY)).toBeUndefined();
    expect(await getRecentConversationContext()).toEqual([]);
  });
});
