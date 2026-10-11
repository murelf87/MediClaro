/**
 * Velocidad de lectura del chat de IA: tres animales — caracol (muy muy lento), tortuga (lento) y conejo (normal).
 * La elección se recuerda y se usa también para leer solas las respuestas nuevas.
 * Las velocidades usan la misma escala que el resto de lecturas (0,7 = lento, 0,85 = normal).
 */
import { localStore } from '../api/storage';

export type AssistantSpeedKey = 'veryslow' | 'slow' | 'normal';

export const ASSISTANT_SPEEDS: { key: AssistantSpeedKey; emoji: string; label: string; spoken: string; rate: number }[] = [
  { key: 'veryslow', emoji: '🐌', label: 'Muy lento', spoken: 'Leer muy muy lento', rate: 0.55 },
  { key: 'slow', emoji: '🐢', label: 'Lento', spoken: 'Leer lento', rate: 0.7 },
  { key: 'normal', emoji: '🐇', label: 'Normal', spoken: 'Leer a velocidad normal', rate: 0.85 },
];

const KEY = 'mediclaro_assistant_speed_v1';
let current: AssistantSpeedKey = 'normal';
let started = false;
const listeners = new Set<() => void>();

export function parseAssistantSpeed(value: unknown): AssistantSpeedKey {
  return value === 'veryslow' || value === 'slow' || value === 'normal' ? value : 'normal';
}

export function assistantRate(speed: AssistantSpeedKey): number {
  return (ASSISTANT_SPEEDS.find((s) => s.key === speed) ?? ASSISTANT_SPEEDS[2]).rate;
}

export const AssistantSpeed = {
  get: (): AssistantSpeedKey => current,
  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  set(next: AssistantSpeedKey): void {
    void localStore.setJSON(KEY, next);
    if (next === current) return;
    current = next;
    listeners.forEach((l) => l());
  },
  /** Recupera la velocidad que eligió la persona (una vez). */
  load(): void {
    if (started) return;
    started = true;
    void localStore
      .getJSON<string | null>(KEY, null)
      .then((saved) => {
        const next = parseAssistantSpeed(saved);
        if (saved && next !== current) {
          current = next;
          listeners.forEach((l) => l());
        }
      })
      .catch(() => undefined);
  },
  __reset(): void {
    current = 'normal';
    started = false;
    listeners.clear();
  },
};
