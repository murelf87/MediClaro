/**
 * ProfileService — perfil de la persona y ajustes de accesibilidad.
 *
 * Backend usado (sin modificarlo):
 *  - RPC `get_account_status()`   → ajustes (settings)
 *  - RPC `update_my_settings(p)`  → display_name, font_size, easy_mode, speech_rate, locale, onboarded
 *  - tabla `profiles` (lectura de la fila propia) → created_at
 *  - Edge Function `account`      → { action: 'export' } / { action: 'delete', confirm: 'ELIMINAR' }
 */
import { supabase, invokeFunction, requireUserId, dbError, AppError, toAppError } from '../api';
import type { FontSizePreference, ProfileSex, User, UserSettings } from '../types';
import { AuthService } from './AuthService';
import { DemoMode } from './DemoMode';
import { EmergencyService } from './EmergencyService';
import { NotificationService } from './NotificationService';
import { AiConsentService } from './AiConsentService';
import { PreferencesService } from './PreferencesService';
import { MedicationPlanService, PillReminders } from './MedicationPlanService';
import { MedicinePhotoService } from './MedicinePhotoService';
import { CareChatService } from './CareChatService';
import { OwnerAdminService } from './OwnerAdminService';

const FONT_SIZES: FontSizePreference[] = ['normal', 'grande', 'muy_grande'];

export const DEFAULT_SETTINGS: UserSettings = {
  displayName: null,
  fontSize: 'grande',
  easyMode: false,
  speechRate: 0.85,
  locale: 'es-ES',
  onboarded: false,
  country: 'ES',
};

interface RawSettings {
  display_name?: string | null;
  font_size?: string | null;
  easy_mode?: boolean | null;
  speech_rate?: number | string | null;
  locale?: string | null;
  onboarded?: boolean | null;
  country?: string | null;
}

export function mapSettings(raw: RawSettings | null | undefined): UserSettings {
  if (!raw) return { ...DEFAULT_SETTINGS };
  const font = FONT_SIZES.includes(raw.font_size as FontSizePreference) ? (raw.font_size as FontSizePreference) : DEFAULT_SETTINGS.fontSize;
  const rate = Number(raw.speech_rate);
  return {
    displayName: raw.display_name?.trim() ? raw.display_name.trim() : null,
    fontSize: font,
    easyMode: Boolean(raw.easy_mode),
    speechRate: Number.isFinite(rate) && rate >= 0.5 && rate <= 1.5 ? rate : DEFAULT_SETTINGS.speechRate,
    locale: raw.locale ?? DEFAULT_SETTINGS.locale,
    onboarded: Boolean(raw.onboarded),
    country: raw.country ?? DEFAULT_SETTINGS.country,
  };
}

export interface ProfileUpdate {
  displayName?: string;
  sex?: ProfileSex | null;
  age?: number | null;
  contactPhone?: string | null;
  avatarPath?: string | null;
  fontSize?: FontSizePreference;
  easyMode?: boolean;
  speechRate?: number;
  onboarded?: boolean;
}

/** Exportación de datos (derecho de acceso RGPD). Estructura tal cual la devuelve el backend. */
export type AccountExport = Record<string, unknown> & { exportedAt?: string };

export const ProfileService = {
  async getSettings(): Promise<UserSettings> {
    await requireUserId();
    const { data, error } = await supabase.rpc('get_account_status');
    if (error) throw dbError(error);
    const settings = (data as { settings?: RawSettings } | null)?.settings;
    return mapSettings(settings);
  },

  async getProfile(): Promise<User> {
    const userId = await requireUserId();
    const [session, settings, row] = await Promise.all([
      AuthService.getSession(),
      ProfileService.getSettings(),
      supabase.from('profiles').select('created_at,sex,age,contact_phone,avatar_path').eq('id', userId).maybeSingle(),
    ]);
    if (row.error) throw dbError(row.error);
    const raw = row.data as { created_at?: string; sex?: ProfileSex | null; age?: number | null; contact_phone?: string | null; avatar_path?: string | null } | null;
    let avatarUrl: string | null = null;
    if (raw?.avatar_path) {
      const signed = await supabase.storage.from('profile-avatars').createSignedUrl(raw.avatar_path, 60 * 60).catch(() => null);
      avatarUrl = signed?.data?.signedUrl ?? null;
    }
    return {
      id: userId,
      phone: session?.phone ?? null,
      email: session?.email ?? null,
      displayName: settings.displayName,
      sex: raw?.sex ?? null,
      age: typeof raw?.age === 'number' ? raw.age : null,
      contactPhone: raw?.contact_phone ?? null,
      avatarUrl,
      avatarPath: raw?.avatar_path ?? null,
      createdAt: raw?.created_at ?? null,
      settings,
    };
  },

  async updateProfile(patch: ProfileUpdate): Promise<void> {
    await requireUserId();
    const p: Record<string, unknown> = {};
    if (patch.displayName !== undefined) {
      const name = patch.displayName.trim().slice(0, 60);
      if (!name) throw new AppError('invalid_input', 'Escribe tu nombre.');
      p.display_name = name;
    }
    if (patch.sex !== undefined) p.sex = patch.sex;
    if (patch.age !== undefined) {
      if (patch.age !== null && (!Number.isInteger(patch.age) || patch.age < 0 || patch.age > 120)) {
        throw new AppError('invalid_input', 'Escribe una edad válida.');
      }
      p.age = patch.age;
    }
    if (patch.contactPhone !== undefined) {
      const phone = patch.contactPhone?.trim() || '';
      if (phone && phone.replace(/\D/g, '').length < 6) throw new AppError('invalid_input', 'Revisa el teléfono opcional.');
      p.contact_phone = phone || null;
    }
    if (patch.avatarPath !== undefined) p.avatar_path = patch.avatarPath;
    if (patch.fontSize !== undefined) p.font_size = patch.fontSize;
    if (patch.easyMode !== undefined) p.easy_mode = patch.easyMode;
    if (patch.speechRate !== undefined) p.speech_rate = Math.min(1.5, Math.max(0.5, patch.speechRate));
    if (patch.onboarded !== undefined) p.onboarded = patch.onboarded;
    if (Object.keys(p).length === 0) return;
    const { error } = await supabase.rpc('update_my_settings', { p });
    if (error) throw dbError(error);
  },

  async uploadAvatar(uri: string, mimeType = 'image/jpeg'): Promise<string> {
    const userId = await requireUserId();
    const current = await ProfileService.getProfile();
    const ext = mimeType.includes('png') ? 'png' : mimeType.includes('webp') ? 'webp' : 'jpg';
    const path = `${userId}/avatar-${Date.now()}.${ext}`;
    let body: ArrayBuffer;
    try {
      const response = await fetch(uri);
      body = await response.arrayBuffer();
    } catch {
      throw new AppError('invalid_input', 'No hemos podido leer la foto elegida.');
    }
    if (!body.byteLength || body.byteLength > 5 * 1024 * 1024) {
      throw new AppError('invalid_input', 'La foto debe ocupar menos de 5 MB.');
    }
    const uploaded = await supabase.storage.from('profile-avatars').upload(path, body, { contentType: mimeType, upsert: false });
    if (uploaded.error) throw dbError(uploaded.error);
    try {
      await ProfileService.updateProfile({ avatarPath: path });
      if (current.avatarPath && current.avatarPath !== path) {
        await supabase.storage.from('profile-avatars').remove([current.avatarPath]).catch(() => undefined);
      }
      return path;
    } catch (e) {
      await supabase.storage.from('profile-avatars').remove([path]).catch(() => undefined);
      throw e;
    }
  },

  async removeAvatar(): Promise<void> {
    const current = await ProfileService.getProfile();
    if (!current.avatarPath) return;
    await ProfileService.updateProfile({ avatarPath: null });
    await supabase.storage.from('profile-avatars').remove([current.avatarPath]).catch(() => undefined);
  },

  /**
   * Descarga de datos personales (derecho de acceso RGPD, JSON).
   * Parte del servidor (`account` → export) + lo que el servidor aún no incluye (R-06):
   * el perfil de emergencia y los datos que solo viven en este teléfono.
   */
  async exportData(): Promise<AccountExport> {
    await requireUserId();
    const server = await invokeFunction<AccountExport>('account', { action: 'export' }, { timeoutMs: 45_000 });
    const [emergency, notifications, display, aiStatus, aiDate, medication, careChat] = await Promise.all([
      EmergencyService.exportForAccount().catch(() => null),
      NotificationService.getPreferences().catch(() => []),
      PreferencesService.load().catch(() => null),
      AiConsentService.getStatus().catch(() => 'unknown' as const),
      AiConsentService.getDecisionDate().catch(() => null),
      // «Mis pastillas» (si la función está desplegada y la cuenta la usa; si no, no se incluye).
      MedicationPlanService.exportForAccount().catch(() => null),
      // Chat con el cuidador/a (si está desplegado y hay conversaciones).
      CareChatService.exportForAccount().catch(() => null),
    ]);
    return {
      ...server,
      // Si el servidor ya lo incluye (tras R-06), se respeta el suyo.
      emergencyProfile: (server as { emergencyProfile?: unknown }).emergencyProfile ?? emergency?.profile ?? null,
      medicationPlan: medication,
      careChat,
      dataOnThisPhone: {
        privateAssistanceService: emergency?.privateAssistance ?? null,
        primaryDoctor: emergency?.primaryDoctor ?? null,
        notificationPreferences: Object.fromEntries(notifications.map((n) => [n.key, n.enabled])),
        displayPreferences: display
          ? { fontSize: display.fontSize, easyMode: display.easyMode, highContrast: display.highContrast, speechRate: display.speechRate }
          : null,
        aiConsent: { status: aiStatus, decidedAt: aiDate },
      },
      _explicacion: {
        emergencyProfile: 'Tu perfil de emergencia (datos que tú declaraste).',
        medicationPlan: 'Mis pastillas: tus tratamientos, horas, tomas confirmadas, correcciones y ajustes de avisos (últimos 13 meses).',
        careChat: 'Chat con tu cuidador/a o con el familiar al que cuidas: tus conversaciones de los últimos 90 días.',
        dataOnThisPhone: 'Datos que solo están guardados en este teléfono, cifrados.',
      },
    };
  },

  /**
   * Elimina la cuenta y todos los datos. Cancela la suscripción en el backend.
   * Después cierra la sesión local.
   */
  async deleteAccount(): Promise<void> {
    const userId = await requireUserId();
    if (DemoMode.isActive()) {
      throw new AppError('not_available', 'En el modo demostración no hay una cuenta real que eliminar. Pulsa «Cerrar sesión» para salir.');
    }
    try {
      const res = await invokeFunction<{ deleted?: boolean }>('account', { action: 'delete', confirm: 'ELIMINAR' }, { timeoutMs: 45_000 });
      if (!res?.deleted) throw new AppError('unknown', 'No hemos podido eliminar la cuenta. Inténtalo de nuevo.');
    } catch (e) {
      throw toAppError(e);
    }
    // Lo que de esta cuenta solo vivía en el teléfono también se borra.
    await EmergencyService.forgetAccountLocalData(userId).catch(() => undefined);
    await NotificationService.forgetAccountLocalData(userId).catch(() => undefined);
    await AiConsentService.forgetAccountLocalData(userId).catch(() => undefined);
    await PillReminders.reschedule(false).catch(() => undefined);
    await MedicationPlanService.forgetLocal(userId).catch(() => undefined);
    await MedicinePhotoService.forgetAll(userId).catch(() => undefined);
    CareChatService.clear();
    OwnerAdminService.clear();
    await supabase.auth.signOut({ scope: 'local' }).catch(() => undefined);
  },
};
