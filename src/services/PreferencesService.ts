/**
 * PreferencesService — preferencias del dispositivo.
 *
 * - Copia local de los ajustes de accesibilidad para aplicarlos al instante
 *   al abrir la app (la fuente de verdad es el perfil en el backend).
 * - Preferencias sin columna en el backend: alto contraste, tutorial visto.
 */
import { localStore } from '../api/storage';
import type { FontSizePreference } from '../types';

export type GeminiVoice = 'Sulafat' | 'Achird' | 'Aoede';
/** Voces con las que está grabada la explicación inicial «Cómo funciona». */
export type TourVoice = 'Sulafat' | 'Achird';

export interface LocalPreferences {
  fontSize: FontSizePreference;
  easyMode: boolean;
  highContrast: boolean;
  speechRate: number;
  /**
   * Antes: voz elegida para la explicación «Cómo funciona». Desde el 09/10/2026 la explicación tiene UNA sola voz
   * (Sulafat, ver config/tourAudio.ts) y la lectura de medicamentos usa SIEMPRE Sulafat: se conserva solo para no
   * perder lo guardado en los teléfonos.
   */
  readingVoice: GeminiVoice;
  /** Voz Gemini del asistente (respuestas del Asistente IA): Sulafat o Achird. */
  assistantVoice: GeminiVoice;
  onboardingSeen: boolean;
}

const KEY = 'mediclaro.prefs.v1';

export const DEFAULT_LOCAL_PREFERENCES: LocalPreferences = {
  fontSize: 'grande',
  easyMode: false,
  highContrast: false,
  speechRate: 0.85,
  readingVoice: 'Sulafat',
  // Dos voces claramente distintas (09/10/2026): Sulafat (femenina, cálida) y Achird (masculina, cercana).
  assistantVoice: 'Sulafat',
  onboardingSeen: false,
};

export const PreferencesService = {
  async load(): Promise<LocalPreferences> {
    const stored = await localStore.getJSON<Partial<LocalPreferences>>(KEY, {});
    const merged = { ...DEFAULT_LOCAL_PREFERENCES, ...stored };
    // La explicación inicial solo está grabada con Sulafat y Achird: nunca se muestra otra voz elegida que no suena.
    // Aoede se retiró de la lista porque sonaba casi igual que Sulafat: quien la tenía elegida pasa a Sulafat.
    return { ...merged, readingVoice: tourVoiceOf(merged.readingVoice), assistantVoice: tourVoiceOf(merged.assistantVoice) };
  },

  async save(patch: Partial<LocalPreferences>): Promise<LocalPreferences> {
    const current = await PreferencesService.load();
    const next = { ...current, ...patch };
    await localStore.setJSON(KEY, next);
    return next;
  },
};

/** Voz real con la que suena la explicación inicial para una preferencia dada. */
export function tourVoiceOf(voice: GeminiVoice | undefined): TourVoice {
  return voice === 'Achird' ? 'Achird' : 'Sulafat';
}
