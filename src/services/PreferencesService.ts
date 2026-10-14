/**
 * PreferencesService — preferencias del dispositivo.
 *
 * - Copia local de los ajustes de accesibilidad para aplicarlos al instante
 *   al abrir la app (la fuente de verdad es el perfil en el backend).
 * - Preferencias sin columna en el backend: alto contraste, tutorial visto.
 */
import { localStore } from '../api/storage';
import type { FontSizePreference } from '../types';

export interface LocalPreferences {
  fontSize: FontSizePreference;
  easyMode: boolean;
  highContrast: boolean;
  speechRate: number;
  onboardingSeen: boolean;
}

const KEY = 'mediclaro.prefs.v1';

export const DEFAULT_LOCAL_PREFERENCES: LocalPreferences = {
  fontSize: 'grande',
  easyMode: false,
  highContrast: false,
  speechRate: 0.85,
  onboardingSeen: false,
};

export const PreferencesService = {
  async load(): Promise<LocalPreferences> {
    const stored = await localStore.getJSON<Partial<LocalPreferences>>(KEY, {});
    return { ...DEFAULT_LOCAL_PREFERENCES, ...stored };
  },

  async save(patch: Partial<LocalPreferences>): Promise<LocalPreferences> {
    const current = await PreferencesService.load();
    const next = { ...current, ...patch };
    await localStore.setJSON(KEY, next);
    return next;
  },
};
