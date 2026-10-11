/**
 * Voz de la app para TODAS las personas, elegida por el propietario en el panel (Configuración › Voz de la app):
 *  - 'natural': la voz natural de Google (Sulafat o Achird). Si no llega (sin internet, límite de Google…), se lee con
 *    la mejor voz en español instalada en cada móvil, sin quedarse nunca en silencio.
 *  - 'device': siempre la voz instalada en cada móvil. Gratis y sin límites; cada móvil suena distinto (cada uno usa
 *    la mejor voz en español que tenga, nunca una fija).
 * Se lee del servidor (app_config 'voice', lectura pública) y se guarda en el móvil para que funcione sin conexión y
 * desde que se abre la app. Si el servidor aún no la tiene, es 'natural' (como hasta ahora).
 */
import { AppState } from 'react-native';
import { supabase } from '../lib/supabase';
import { localStore } from '../api/storage';

export type VoiceMode = 'natural' | 'device';

const KEY = 'mediclaro_voice_mode_v1';
/** Como mucho se pregunta al servidor cada 5 minutos (al abrir la app y al volver a ella). */
const REFRESH_MS = 5 * 60_000;

let mode: VoiceMode = 'natural';
let checkedAt = 0;
let serverKnown = false;
let started = false;
const listeners = new Set<() => void>();

export function parseVoiceMode(value: unknown): VoiceMode {
  const m = value && typeof value === 'object' ? (value as { mode?: unknown }).mode : null;
  return m === 'device' ? 'device' : 'natural';
}

function set(next: VoiceMode, persist: boolean): void {
  if (persist) void localStore.setJSON(KEY, { mode: next });
  if (next === mode) return;
  mode = next;
  listeners.forEach((listener) => listener());
}

export const VoiceSettings = {
  /** La voz que usa ahora la app. */
  mode: (): VoiceMode => mode,

  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },

  /** Tras cambiarla el propietario desde el panel: en su móvil se aplica al momento. */
  apply(next: VoiceMode): void {
    serverKnown = true;
    checkedAt = Date.now();
    set(next, true);
  },

  /** Pregunta al servidor (como mucho cada 5 minutos, salvo `force`). Sin conexión se queda la última conocida. */
  async refresh(force = false): Promise<VoiceMode> {
    if (!force && Date.now() - checkedAt < REFRESH_MS) return mode;
    checkedAt = Date.now();
    try {
      const { data, error } = await supabase.from('app_config').select('value').eq('key', 'voice').maybeSingle();
      if (!error) {
        serverKnown = true;
        set(parseVoiceMode((data as { value?: unknown } | null)?.value), true);
      }
    } catch {
      // Sin conexión: se mantiene la última conocida.
    }
    return mode;
  },

  /** Al abrir la app: la última guardada en el móvil al instante y, después, la del servidor. */
  start(): void {
    if (started) return;
    started = true;
    void localStore.getJSON<{ mode?: unknown } | null>(KEY, null).then((saved) => {
      if (saved && !serverKnown) set(parseVoiceMode(saved), false);
    });
    void VoiceSettings.refresh(true);
    AppState.addEventListener('change', (state) => {
      if (state === 'active') void VoiceSettings.refresh();
    });
  },

  /** Solo para pruebas. */
  __reset(): void {
    mode = 'natural';
    checkedAt = 0;
    serverKnown = false;
    started = false;
    listeners.clear();
  },
};
