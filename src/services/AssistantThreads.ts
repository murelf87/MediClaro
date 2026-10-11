/**
 * Conversaciones del asistente: la persona puede abrir una conversación NUEVA sin perder las anteriores y volver a
 * cualquiera de ellas. Cada conversación es un «hilo» con su propia clave; el servidor ya guarda el historial por
 * clave (cualquier clave de letras, números, «:», «_» y «-»), así que no hace falta nada nuevo en el servidor.
 *  - La clave 'general' es la conversación de siempre (la que ya existía).
 *  - Las nuevas son 'chat-<hora>'. La lista de hilos (título = primera pregunta) se guarda en este móvil.
 *  - Las preguntas sobre un medicamento ('med:<id>') siguen siendo su propia conversación y no entran aquí.
 */
import { localStore } from '../api/storage';

export interface AssistantThread {
  key: string;
  /** Primera pregunta de la conversación (recortada). */
  title: string;
  updatedAt: string;
}

const THREADS_KEY = 'mediclaro_assistant_threads_v1';
const ACTIVE_KEY = 'mediclaro_assistant_active_v1';
const MAX_THREADS = 30;
export const MAIN_THREAD_KEY = 'general';
const KEY_PATTERN = /^(general|chat-[a-z0-9]{3,20})$/;

let threads: AssistantThread[] = [];
let active = MAIN_THREAD_KEY;
let loaded: Promise<void> | null = null;
const listeners = new Set<() => void>();

function emit(): void {
  listeners.forEach((l) => l());
}

function save(): void {
  void localStore.setJSON(THREADS_KEY, threads);
  void localStore.setJSON(ACTIVE_KEY, active);
}

function shorten(text: string): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  return clean.length > 60 ? `${clean.slice(0, 57)}…` : clean;
}

export const AssistantThreads = {
  /** Clave de la conversación abierta ahora (sin medicamento). */
  activeKey: (): string => active,
  /** Conversaciones guardadas, la más reciente primero. */
  list: (): AssistantThread[] => [...threads].sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt)),
  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },

  /** Lee del móvil la lista y la conversación abierta (una vez). */
  load(): Promise<void> {
    if (!loaded) {
      loaded = (async () => {
        try {
          const saved = await localStore.getJSON<AssistantThread[] | null>(THREADS_KEY, null);
          const savedActive = await localStore.getJSON<string | null>(ACTIVE_KEY, null);
          if (Array.isArray(saved)) {
            threads = saved
              .filter((t) => t && typeof t.key === 'string' && KEY_PATTERN.test(t.key) && typeof t.title === 'string')
              .slice(0, MAX_THREADS);
          }
          if (typeof savedActive === 'string' && KEY_PATTERN.test(savedActive)) active = savedActive;
        } catch {
          // sin almacenamiento: se sigue con la conversación de siempre
        }
        emit();
      })();
    }
    return loaded;
  },

  /** Abre una conversación nueva y vacía (las anteriores se conservan). */
  start(now: number = Date.now()): string {
    const key = `chat-${now.toString(36)}`;
    active = key;
    save();
    emit();
    return key;
  },

  /** Vuelve a una conversación anterior. */
  select(key: string): boolean {
    if (!KEY_PATTERN.test(key)) return false;
    active = key;
    save();
    emit();
    return true;
  },

  /** Anota una pregunta: crea el hilo si no existe (su título es la primera pregunta) y lo marca como el más reciente. */
  touch(key: string, text: string, now: number = Date.now()): void {
    if (!KEY_PATTERN.test(key)) return;
    const existing = threads.find((t) => t.key === key);
    if (existing) existing.updatedAt = new Date(now).toISOString();
    else threads = [{ key, title: shorten(text), updatedAt: new Date(now).toISOString() }, ...threads].slice(0, MAX_THREADS);
    save();
    emit();
  },

  /** Quita una conversación de la lista de este móvil (el historial guardado se borra desde Privacidad). */
  forget(key: string): void {
    threads = threads.filter((t) => t.key !== key);
    if (active === key) active = MAIN_THREAD_KEY;
    save();
    emit();
  },

  /** Al borrar el historial del asistente desde Privacidad, desaparece también la lista de conversaciones. */
  clearAll(): void {
    threads = [];
    active = MAIN_THREAD_KEY;
    save();
    emit();
  },

  __reset(): void {
    threads = [];
    active = MAIN_THREAD_KEY;
    loaded = null;
    listeners.clear();
  },
};
