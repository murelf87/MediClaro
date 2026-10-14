/**
 * MediClaro — EmergencyProfileService
 * Carga y guarda el perfil de emergencia.
 * Supabase es la fuente primaria; la copia local (cifrada) sirve sin conexión.
 *
 * TODOS los datos médicos están marcados como DATO DECLARADO POR EL USUARIO.
 * Este servicio NUNCA infiere ni completa datos médicos.
 *
 * La copia local contiene datos de salud: se guarda CIFRADA (llavero de iOS /
 * Keystore de Android) y se borra al cerrar sesión.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../../lib/supabase';
import { secureTextStorage } from '../../lib/secureChunkedStorage';
import { EmergencyProfile, EMPTY_PROFILE } from './types';

const CACHE_KEY = 'mediclaro_emergency_profile_v1';

interface CachedProfile {
  profile: EmergencyProfile;
  cachedAt: number;
}

// ── Caché local (cifrada) ────────────────────────────────────────────────────

async function saveToCache(profile: EmergencyProfile): Promise<void> {
  try {
    const entry: CachedProfile = { profile, cachedAt: Date.now() };
    await secureTextStorage.setItem(CACHE_KEY, JSON.stringify(entry));
  } catch {
    // Mejor esfuerzo
  }
}

/**
 * Copia en texto plano de versiones anteriores (AsyncStorage): se pasa al
 * almacenamiento cifrado y se elimina.
 */
async function takeLegacyCache(): Promise<string | null> {
  try {
    const legacy = await AsyncStorage.getItem(CACHE_KEY);
    if (!legacy) return null;
    await secureTextStorage.setItem(CACHE_KEY, legacy).catch(() => undefined);
    await AsyncStorage.removeItem(CACHE_KEY);
    return legacy;
  } catch {
    return null;
  }
}

async function loadFromCache(): Promise<EmergencyProfile | null> {
  try {
    const raw = (await secureTextStorage.getItem(CACHE_KEY)) ?? (await takeLegacyCache());
    if (!raw) return null;
    const entry: CachedProfile = JSON.parse(raw);
    // Devolver caché aunque haya expirado — en emergencia cualquier dato sirve
    return entry.profile;
  } catch {
    return null;
  }
}

// ── Supabase ──────────────────────────────────────────────────────────────────

/** Id del usuario con sesión, sin depender de la red (getSession es local). */
async function currentUserId(): Promise<string | null> {
  const auth = supabase.auth as unknown as {
    getSession?: () => Promise<{ data: { session: { user: { id: string } } | null } }>;
    getUser: () => Promise<{ data: { user: { id: string } | null } }>;
  };
  if (typeof auth.getSession === 'function') {
    const { data } = await auth.getSession();
    if (data.session?.user.id) return data.session.user.id;
  }
  const { data } = await auth.getUser();
  return data.user?.id ?? null;
}

/**
 * Carga el perfil: servidor → caché local → vacío.
 * `unavailable` = no se pudo consultar el servidor y no hay copia local
 * (distinto de `empty`, que significa que la persona aún no lo ha creado).
 */
export async function loadEmergencyProfile(): Promise<{
  profile: EmergencyProfile;
  source: 'supabase' | 'cache' | 'empty' | 'unavailable';
}> {
  let serverFailed = false;

  // 1. Intentar Supabase
  try {
    const userId = await currentUserId();
    if (userId) {
      const { data, error } = await supabase
        .from('emergency_profiles')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (!error && data) {
        const profile = rowToProfile(data);
        await saveToCache(profile);
        return { profile, source: 'supabase' };
      }
      // PGRST116 = no hay fila: la persona aún no ha creado su perfil
      if (error && (error as { code?: string }).code !== 'PGRST116') serverFailed = true;
    }
  } catch {
    serverFailed = true;
  }

  // 2. Caché local (offline)
  const cached = await loadFromCache();
  if (cached) return { profile: cached, source: 'cache' };

  // 3. Perfil vacío
  return { profile: { ...EMPTY_PROFILE }, source: serverFailed ? 'unavailable' : 'empty' };
}

/** Copia local del perfil (sin consultar el servidor). */
export async function loadCachedEmergencyProfile(): Promise<EmergencyProfile | null> {
  return loadFromCache();
}

/** Borra la copia local del perfil (al cerrar sesión: privacidad entre cuentas). */
export async function clearEmergencyProfileCache(): Promise<void> {
  await secureTextStorage.removeItem(CACHE_KEY).catch(() => undefined);
  await AsyncStorage.removeItem(CACHE_KEY).catch(() => undefined);
}

/**
 * Borra el perfil de emergencia (datos de salud) sin eliminar la cuenta: fila del servidor
 * (política «emergency_profiles_owner_delete») y copia cifrada del teléfono.
 */
export async function deleteEmergencyProfile(): Promise<{ ok: boolean; error?: string }> {
  try {
    const userId = await currentUserId();
    if (!userId) return { ok: false, error: 'Sin sesión activa' };
    const { error } = await supabase.from('emergency_profiles').delete().eq('user_id', userId);
    if (error) return { ok: false, error: error.message };
    await clearEmergencyProfileCache();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String((e as { message?: string } | null)?.message ?? 'Error de red') };
  }
}

export async function saveEmergencyProfile(profile: EmergencyProfile): Promise<{
  ok: boolean;
  error?: string;
}> {
  // Guardar siempre en caché local primero
  await saveToCache(profile);

  // Luego intentar Supabase
  try {
    const userId = await currentUserId();
    if (!userId) return { ok: false, error: 'Sin sesión activa' };

    const row = profileToRow(profile, userId);

    const { error } = await supabase
      .from('emergency_profiles')
      .upsert(row, { onConflict: 'user_id' });

    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String((e as { message?: string } | null)?.message ?? 'Error de red') };
  }
}

// ── Conversión row ↔ perfil ───────────────────────────────────────────────────

/** Fila tal como llega de `emergency_profiles` (columnas opcionales o nulas). */
type EmergencyProfileRow = { [K in keyof EmergencyProfile]?: EmergencyProfile[K] | null };

function rowToProfile(row: EmergencyProfileRow): EmergencyProfile {
  return {
    full_name:                        row.full_name                        ?? '',
    date_of_birth:                    row.date_of_birth                    ?? '',
    phone:                            row.phone                            ?? '',
    address:                          row.address                          ?? '',
    postal_code:                      row.postal_code                      ?? '',
    city:                             row.city                             ?? '',
    province:                         row.province                         ?? '',
    country:                          row.country                          ?? 'España',
    blood_type:                       row.blood_type                       ?? '',
    allergies:                        row.allergies                        ?? '',
    medical_conditions:               row.medical_conditions               ?? '',
    current_medications:              row.current_medications              ?? '',
    additional_info:                  row.additional_info                  ?? '',
    emergency_contact_name:           row.emergency_contact_name           ?? '',
    emergency_contact_relationship:   row.emergency_contact_relationship   ?? '',
    emergency_contact_phone:          row.emergency_contact_phone          ?? '',
    language:                         row.language                         ?? 'es-ES',
    voice_preference:                 row.voice_preference                 ?? 'female',
    consent_share_location:           row.consent_share_location           ?? true,
    consent_share_address:            row.consent_share_address            ?? true,
    consent_share_medications:        row.consent_share_medications        ?? true,
    consent_share_allergies:          row.consent_share_allergies          ?? true,
    consent_share_medical_info:       row.consent_share_medical_info       ?? true,
    consent_share_conversation:       row.consent_share_conversation       ?? true,
    consent_notify_contact:           row.consent_notify_contact           ?? true,
  };
}

/**
 * Fila para `emergency_profiles`.
 * IMPORTANTE: en el esquema efectivo (v3 + ALTER de v4) NO existen las columnas
 * `phone` ni `additional_info`; enviarlas hace fallar el guardado (PGRST204).
 * El teléfono del usuario se toma de su cuenta (login por SMS).
 * Ver BACKEND_REQUIREMENTS.md → "emergency_profiles".
 */
function profileToRow(profile: EmergencyProfile, userId: string): Record<string, unknown> {
  return {
    user_id:                          userId,
    full_name:                        profile.full_name,
    date_of_birth:                    profile.date_of_birth || null,
    address:                          profile.address,
    postal_code:                      profile.postal_code,
    city:                             profile.city,
    province:                         profile.province,
    country:                          profile.country,
    blood_type:                       profile.blood_type,
    allergies:                        profile.allergies,
    medical_conditions:               profile.medical_conditions,
    current_medications:              profile.current_medications,
    emergency_contact_name:           profile.emergency_contact_name,
    emergency_contact_relationship:   profile.emergency_contact_relationship,
    emergency_contact_phone:          profile.emergency_contact_phone,
    language:                         profile.language,
    voice_preference:                 profile.voice_preference,
    consent_share_location:           profile.consent_share_location,
    consent_share_address:            profile.consent_share_address,
    consent_share_medications:        profile.consent_share_medications,
    consent_share_allergies:          profile.consent_share_allergies,
    consent_share_medical_info:       profile.consent_share_medical_info,
    consent_share_conversation:       profile.consent_share_conversation,
    consent_notify_contact:           profile.consent_notify_contact,
    updated_at:                       new Date().toISOString(),
  };
}

/** Calcula edad a partir de fecha de nacimiento ISO */
export function calculateAge(dateOfBirth: string): number | undefined {
  if (!dateOfBirth) return undefined;
  try {
    const dob = new Date(dateOfBirth);
    const today = new Date();
    let age = today.getFullYear() - dob.getFullYear();
    const m = today.getMonth() - dob.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age--;
    return age >= 0 && age < 150 ? age : undefined;
  } catch {
    return undefined;
  }
}

/** ¿Tiene el perfil suficiente información para ser útil en emergencia? */
export function isProfileUsable(profile: EmergencyProfile): boolean {
  return Boolean(profile.full_name.trim());
}
