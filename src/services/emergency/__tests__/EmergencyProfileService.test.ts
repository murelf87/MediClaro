/**
 * Tests — EmergencyProfileService (Section 21)
 *
 * Escenarios cubiertos:
 * - calculateAge (fechas de nacimiento)
 * - carga desde caché (sin Internet)
 * - backend caído (modo local) → EMPTY_PROFILE
 * - sin ficha médica (perfil vacío)
 *
 * NOTA: NO usamos jest.resetModules() para que el módulo AsyncStorage
 * sea el mismo que ve el servicio (ambos importados a través del moduleNameMapper).
 * Supabase está mapeado en jest.config.js → __mocks__/supabaseClient.ts.
 */

import { __reset as resetStorage, __set as setStorage, __get as getStorage } from '../__mocks__/async-storage';
import { __reset as resetSecureStore } from '../__mocks__/expo-secure-store';
import { __reset as resetSupabase, __setMode } from '../__mocks__/supabaseClient';
import {
  loadEmergencyProfile,
  calculateAge,
  clearEmergencyProfileCache,
  deleteEmergencyProfile,
  saveEmergencyProfile,
} from '../EmergencyProfileService';
import { secureTextStorage } from '../../../lib/secureChunkedStorage';
import { EMPTY_PROFILE } from '../types';

const CACHE_KEY = 'mediclaro_emergency_profile_v1';

beforeEach(() => {
  resetStorage();
  resetSecureStore();
  resetSupabase();
  jest.clearAllMocks();
});

// ─── calculateAge ─────────────────────────────────────────────────────────────

describe('calculateAge', () => {

  it('calcula la edad correctamente para una fecha conocida', () => {
    // Persona nacida el 1 de enero de 1950 — en 2026 tiene 76 años
    const age = calculateAge('1950-01-01');
    expect(age).toBeGreaterThanOrEqual(76);
    expect(age).toBeLessThanOrEqual(77);
  });

  it('devuelve undefined para fecha vacía', () => {
    expect(calculateAge('')).toBeUndefined();
    expect(calculateAge(null as unknown as string)).toBeUndefined();
  });

  it('devuelve undefined para fecha inválida', () => {
    expect(calculateAge('not-a-date')).toBeUndefined();
  });

  it('nunca devuelve edades negativas', () => {
    const age = calculateAge('2099-12-31');
    expect(age === undefined || (typeof age === 'number' && age >= 0)).toBe(true);
  });
});

// ─── loadEmergencyProfile — sin Internet ─────────────────────────────────────

describe('loadEmergencyProfile — sin Internet (backend caído, modo local)', () => {

  it('devuelve perfil desde caché cuando existe', async () => {
    const cachedProfile = {
      full_name: 'Ana Martín',
      date_of_birth: '1945-06-20',
      phone: '+34600111222',
      address: 'Calle Luz 5',
      postal_code: '41001',
      city: 'Sevilla',
      province: 'Andalucía',
      country: 'España',
      blood_type: 'B+',
      allergies: 'Látex',
      medical_conditions: 'Asma',
      current_medications: 'Salbutamol',
      additional_info: '',
      emergency_contact_name: 'Luis Martín',
      emergency_contact_relationship: 'Sobrino',
      emergency_contact_phone: '+34611222333',
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

    setStorage(CACHE_KEY, JSON.stringify({ profile: cachedProfile, cachedAt: Date.now() }));

    const { profile } = await loadEmergencyProfile();
    expect(profile.full_name).toBe('Ana Martín');
    expect(profile.allergies).toBe('Látex');
  });

  it('devuelve EMPTY_PROFILE cuando no hay caché y el backend falla', async () => {
    // No hay caché — Supabase devuelve error (modo 'backend_error')
    __setMode('backend_error');
    const { profile } = await loadEmergencyProfile();

    expect(profile).toBeDefined();
    expect(typeof profile.full_name).toBe('string');
    expect(typeof profile.consent_share_location).toBe('boolean');
  });
});

// ─── loadEmergencyProfile — sin ficha médica ──────────────────────────────────

describe('loadEmergencyProfile — sin ficha médica', () => {

  it('devuelve campos médicos como cadenas vacías', async () => {
    __setMode('backend_error');
    const { profile } = await loadEmergencyProfile();

    expect(profile.allergies).toBe('');
    expect(profile.current_medications).toBe('');
    expect(profile.medical_conditions).toBe('');
  });

  it('los consentimientos tienen valor booleano por defecto', async () => {
    __setMode('backend_error');
    const { profile } = await loadEmergencyProfile();
    expect(typeof profile.consent_share_location).toBe('boolean');
    expect(typeof profile.consent_share_medications).toBe('boolean');
  });
});

// ─── Copia local cifrada (datos de salud) ─────────────────────────────────────

describe('copia local del perfil — cifrada', () => {

  it('guarda la copia local en el almacenamiento cifrado, nunca en texto plano', async () => {
    __setMode('success');
    await saveEmergencyProfile({ ...EMPTY_PROFILE, full_name: 'Rosa Díaz', allergies: 'Penicilina' });
    expect(getStorage(CACHE_KEY)).toBeUndefined();
    expect(await secureTextStorage.getItem(CACHE_KEY)).toContain('Penicilina');
  });

  it('migra una copia antigua en texto plano al almacenamiento cifrado y la borra', async () => {
    __setMode('backend_error');
    setStorage(CACHE_KEY, JSON.stringify({ profile: { ...EMPTY_PROFILE, full_name: 'Ana' }, cachedAt: Date.now() }));
    const { profile, source } = await loadEmergencyProfile();
    expect(profile.full_name).toBe('Ana');
    expect(source).toBe('cache');
    expect(getStorage(CACHE_KEY)).toBeUndefined();
    expect(await secureTextStorage.getItem(CACHE_KEY)).toContain('Ana');
  });

  it('clearEmergencyProfileCache borra la copia cifrada y cualquier copia antigua', async () => {
    await secureTextStorage.setItem(CACHE_KEY, JSON.stringify({ profile: EMPTY_PROFILE, cachedAt: Date.now() }));
    setStorage(CACHE_KEY, 'antiguo');
    await clearEmergencyProfileCache();
    expect(await secureTextStorage.getItem(CACHE_KEY)).toBeNull();
    expect(getStorage(CACHE_KEY)).toBeUndefined();
  });

  it('sin sesión ni copia local devuelve "empty" (no "unavailable")', async () => {
    const { source } = await loadEmergencyProfile();
    expect(source).toBe('empty');
  });

  it('con el servidor caído y sin copia local devuelve "unavailable"', async () => {
    __setMode('backend_error');
    const { source } = await loadEmergencyProfile();
    expect(source).toBe('unavailable');
  });
});

// ─── Borrar el perfil sin eliminar la cuenta (derecho de supresión) ───────────

describe('deleteEmergencyProfile', () => {
  it('borra la fila del servidor y la copia cifrada del teléfono', async () => {
    __setMode('success');
    await saveEmergencyProfile({ ...EMPTY_PROFILE, full_name: 'Rosa', allergies: 'Penicilina' });
    expect(await secureTextStorage.getItem(CACHE_KEY)).toContain('Penicilina');
    const res = await deleteEmergencyProfile();
    expect(res.ok).toBe(true);
    expect(await secureTextStorage.getItem(CACHE_KEY)).toBeNull();
  });

  it('si el servidor falla, no borra la copia local y avisa del error', async () => {
    __setMode('success');
    await saveEmergencyProfile({ ...EMPTY_PROFILE, full_name: 'Rosa' });
    __setMode('backend_error');
    const res = await deleteEmergencyProfile();
    expect(res.ok).toBe(false);
    expect(await secureTextStorage.getItem(CACHE_KEY)).toContain('Rosa');
  });

  it('sin sesión no hace nada', async () => {
    const res = await deleteEmergencyProfile();
    expect(res.ok).toBe(false);
  });
});
