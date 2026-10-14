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
import type { FontSizePreference, User, UserSettings } from '../types';
import { AuthService } from './AuthService';
import { DemoMode } from './DemoMode';
import { EmergencyService } from './EmergencyService';
import { NotificationService } from './NotificationService';
import { AiConsentService } from './AiConsentService';
import { PreferencesService } from './PreferencesService';

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
      supabase.from('profiles').select('created_at').eq('id', userId).maybeSingle(),
    ]);
    return {
      id: userId,
      phone: session?.phone ?? null,
      email: session?.email ?? null,
      displayName: settings.displayName,
      createdAt: (row.data as { created_at?: string } | null)?.created_at ?? null,
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
    if (patch.fontSize !== undefined) p.font_size = patch.fontSize;
    if (patch.easyMode !== undefined) p.easy_mode = patch.easyMode;
    if (patch.speechRate !== undefined) p.speech_rate = Math.min(1.5, Math.max(0.5, patch.speechRate));
    if (patch.onboarded !== undefined) p.onboarded = patch.onboarded;
    if (Object.keys(p).length === 0) return;
    const { error } = await supabase.rpc('update_my_settings', { p });
    if (error) throw dbError(error);
  },

  /**
   * Descarga de datos personales (derecho de acceso RGPD, JSON).
   * Parte del servidor (`account` → export) + lo que el servidor aún no incluye (R-06):
   * el perfil de emergencia y los datos que solo viven en este teléfono.
   */
  async exportData(): Promise<AccountExport> {
    await requireUserId();
    const server = await invokeFunction<AccountExport>('account', { action: 'export' }, { timeoutMs: 45_000 });
    const [emergency, notifications, display, aiStatus, aiDate] = await Promise.all([
      EmergencyService.exportForAccount().catch(() => null),
      NotificationService.getPreferences().catch(() => []),
      PreferencesService.load().catch(() => null),
      AiConsentService.getStatus().catch(() => 'unknown' as const),
      AiConsentService.getDecisionDate().catch(() => null),
    ]);
    return {
      ...server,
      // Si el servidor ya lo incluye (tras R-06), se respeta el suyo.
      emergencyProfile: (server as { emergencyProfile?: unknown }).emergencyProfile ?? emergency?.profile ?? null,
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
    await supabase.auth.signOut({ scope: 'local' }).catch(() => undefined);
  },
};
