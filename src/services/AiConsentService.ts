/**
 * AiConsentService — permiso explícito antes de enviar datos a una IA de terceros.
 *
 * Norma 5.1.2(i) de Apple (nov-2025): hay que explicar con claridad que los datos personales
 * se comparten con una IA de terceros y obtener permiso explícito ANTES de hacerlo.
 * En MediClaro eso ocurre en dos casos: la FOTO de la caja (lectura del envase) y las
 * PREGUNTAS al asistente. El código de barras y el C.N. no usan IA y no necesitan permiso.
 *
 * - El permiso es por cuenta y se guarda en el teléfono (decide al instante, también sin red).
 * - Cada decisión (dar o retirar) se registra en la tabla `consents` del backend existente
 *   (kind = 'ai_processing', version = '<versión del texto>@<fecha ISO>') — un registro con fecha
 *   para poder demostrarla. Si no hay red, se reintenta más tarde.
 * - La pantalla del permiso la muestra <AiConsentHost/> (montado una vez en el layout raíz);
 *   cualquier pantalla pide el permiso con `AiConsentService.ensure()`.
 */
import { useSyncExternalStore } from 'react';
import { supabase } from '../api';
import { AppError } from '../api/errors';
import { localStore } from '../api/storage';
import { DemoMode } from './DemoMode';

/** Versión del texto que ve la persona. Si cambia el texto, cambia la versión (y se vuelve a pedir). */
export const AI_CONSENT_VERSION = 'ia-2026-09';

/** Código del error que lanzan los servicios si se intenta enviar algo a la IA sin permiso. */
export const AI_CONSENT_REQUIRED = 'ai_consent_required';

export type AiConsentStatus = 'granted' | 'denied' | 'unknown';

interface StoredConsent {
  status: 'granted' | 'denied';
  version: string;
  at: string;
}

async function currentUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getSession().catch(() => ({ data: { session: null } }));
  return data.session?.user.id ?? null;
}

function keyFor(userId: string | null): string {
  return `mediclaro.aiconsent.v1.${userId ?? 'device'}`;
}

/** Decisiones pendientes de registrar en el servidor, en orden (cada una queda registrada, no solo la última). */
function queueKeyFor(userId: string | null): string {
  return `mediclaro.aiconsent.queue.v1.${userId ?? 'device'}`;
}

async function readStored(): Promise<StoredConsent | null> {
  const stored = await localStore.getJSON<StoredConsent | null>(keyFor(await currentUserId()), null);
  if (!stored || stored.version !== AI_CONSENT_VERSION) return null;
  return stored;
}

/** Registro con fecha en el backend (tabla `consents`, política «dar consentimiento»). Nunca lanza. */
async function recordOnServer(entry: StoredConsent, userId: string | null): Promise<boolean> {
  if (DemoMode.isActive()) return true; // en la demostración no hay servidor real
  try {
    if (!userId) return false;
    const { error } = await supabase.from('consents').insert({
      user_id: userId,
      kind: 'ai_processing',
      version: `${entry.version}@${entry.at}`,
      granted: entry.status === 'granted',
    });
    // 23505 = ya estaba registrado (misma decisión y fecha): cuenta como hecho.
    return !error || (error as { code?: string }).code === '23505';
  } catch {
    return false;
  }
}

/** Decisión pendiente de registrar (con identificador propio para no confundir dos decisiones seguidas). */
interface QueuedConsent extends StoredConsent {
  id: string;
}

/** Candado sencillo: las lecturas y escrituras de la cola nunca se pisan. */
let queueLock: Promise<unknown> = Promise.resolve();
function withQueueLock<T>(fn: () => Promise<T>): Promise<T> {
  const run = queueLock.then(fn, fn);
  queueLock = run.catch(() => undefined);
  return run;
}

/** Registra en orden todo lo pendiente. Devuelve false si falla la red (se reintenta más tarde). */
async function drainOnce(): Promise<boolean> {
  const userId = await currentUserId();
  const qKey = queueKeyFor(userId);
  for (;;) {
    const next = await withQueueLock(async () => (await localStore.getJSON<QueuedConsent[]>(qKey, []))[0] ?? null);
    if (!next) return true;
    if (!(await recordOnServer(next, userId))) return false;
    await withQueueLock(async () => {
      const queue = await localStore.getJSON<QueuedConsent[]>(qKey, []);
      await localStore.setJSON(qKey, queue.filter((e) => e.id !== next.id));
    });
  }
}

/** Una sola pasada a la vez; si llegan decisiones durante la pasada, se vuelve a pasar. */
let draining: Promise<void> | null = null;
let rerunRequested = false;

function drainQueue(): Promise<void> {
  if (draining) {
    rerunRequested = true;
    return draining;
  }
  draining = (async () => {
    do {
      rerunRequested = false;
      if (!(await drainOnce())) break;
    } while (rerunRequested);
  })().finally(() => {
    draining = null;
  });
  return draining;
}

async function save(status: 'granted' | 'denied'): Promise<void> {
  const userId = await currentUserId();
  const entry: StoredConsent = { status, version: AI_CONSENT_VERSION, at: new Date().toISOString() };
  await localStore.setJSON(keyFor(userId), entry);
  const queued: QueuedConsent = { ...entry, id: `${Date.now()}-${Math.random().toString(36).slice(2, 10)}` };
  await withQueueLock(async () => {
    const queue = await localStore.getJSON<QueuedConsent[]>(queueKeyFor(userId), []);
    await localStore.setJSON(queueKeyFor(userId), [...queue, queued]);
  });
  cachedStatus = status;
  emit();
  // El registro en el servidor va en segundo plano: la persona nunca espera a la red.
  void drainQueue().catch(() => undefined);
}

// ─── Estado observable (para la pantalla del permiso y Privacidad) ───────────

let cachedStatus: AiConsentStatus = 'unknown';
let pendingRequest: ((granted: boolean) => void) | null = null;
const listeners = new Set<() => void>();

function emit(): void {
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export const AiConsentService = {
  /** Estado del permiso para la cuenta actual. Reintenta el registro en el servidor si quedó pendiente. */
  async getStatus(): Promise<AiConsentStatus> {
    const stored = await readStored();
    cachedStatus = stored?.status ?? 'unknown';
    void drainQueue().catch(() => undefined);
    return cachedStatus;
  },

  /** Fecha (ISO) de la última decisión, o null. */
  async getDecisionDate(): Promise<string | null> {
    return (await readStored())?.at ?? null;
  },

  async isGranted(): Promise<boolean> {
    return (await AiConsentService.getStatus()) === 'granted';
  },

  /** Lanza el error de permiso si no está concedido (red de seguridad de los servicios). */
  async assertGranted(): Promise<void> {
    if (!(await AiConsentService.isGranted())) {
      throw new AppError(
        'permission_denied',
        'Para usar la inteligencia artificial necesitamos antes tu permiso.',
        { code: AI_CONSENT_REQUIRED },
      );
    }
  },

  async grant(): Promise<void> {
    await save('granted');
  },

  async revoke(): Promise<void> {
    await save('denied');
  },

  /**
   * Devuelve true si hay permiso; si no, muestra la pantalla del permiso y espera la respuesta.
   * Si ya había una petición abierta, la anterior se da por rechazada.
   */
  async ensure(): Promise<boolean> {
    if (await AiConsentService.isGranted()) return true;
    return new Promise<boolean>((resolve) => {
      pendingRequest?.(false);
      pendingRequest = resolve;
      emit();
    });
  },

  /** La pantalla del permiso responde aquí (Aceptar / Ahora no / cerrar). */
  async answer(granted: boolean): Promise<void> {
    if (granted) await AiConsentService.grant();
    const resolve = pendingRequest;
    pendingRequest = null;
    emit();
    resolve?.(granted);
  },

  /** ¿Hay que mostrar ahora la pantalla del permiso? */
  isRequestOpen(): boolean {
    return pendingRequest !== null;
  },

  /** Al eliminar la cuenta: borra su decisión guardada en este teléfono. */
  async forgetAccountLocalData(userId: string): Promise<void> {
    await localStore.remove(keyFor(userId));
    await localStore.remove(queueKeyFor(userId));
    cachedStatus = 'unknown';
    emit();
  },

  subscribe,

  /** Estado en caché (síncrono) para la interfaz. */
  getCachedStatus(): AiConsentStatus {
    return cachedStatus;
  },
};

/** Hook: ¿está abierta la petición de permiso? (para <AiConsentHost/>). */
export function useAiConsentRequestOpen(): boolean {
  return useSyncExternalStore(subscribe, AiConsentService.isRequestOpen, AiConsentService.isRequestOpen);
}

/** Hook: estado del permiso (se actualiza al darlo o retirarlo). */
export function useAiConsentStatus(): AiConsentStatus {
  return useSyncExternalStore(subscribe, AiConsentService.getCachedStatus, AiConsentService.getCachedStatus);
}
