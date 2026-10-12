/**
 * BillingRequestService — registro con fecha de lo que la persona PIDE sobre su suscripción:
 * desistir, cancelar la renovación o eliminar la cuenta. Son tres cosas distintas y cada una deja su
 * propio rastro, para poder atenderlas y para poder demostrar que se atendieron.
 *
 * Por qué hace falta: si alguien desiste dentro de los 14 días, hay que saber qué pidió y cuándo para
 * calcular la devolución; y si elimina su cuenta, el rastro tiene que sobrevivir al borrado o no habría
 * forma de devolverle el dinero ni de acreditar lo ocurrido.
 *
 * Estado de hoy (sin desplegar nada): se registra en la tabla `consents`, que ya existe y permite a cada
 * persona insertar sus propias filas. Tiene una limitación conocida: `consents` se borra en cascada al
 * eliminar la cuenta, así que el rastro de una eliminación NO sobrevive. La solución definitiva es la
 * tabla `billing_requests` de backend-patches/migrations (propuesta R-19), que no se borra en cascada y
 * guarda solo lo necesario: qué se pidió, cuándo, el plan y un identificador interno, nunca datos de salud.
 * Mientras esa migración no se despliegue, el registro de las solicitudes de eliminación hay que
 * consultarlo en el registro de seguridad del servidor (`audit_log`).
 */
import { supabase } from '../api';
import { localStore } from '../api/storage';
import { DemoMode } from './DemoMode';

export type BillingRequestKind = 'withdrawal' | 'cancel_renewal' | 'account_deletion';

/** `kind` que se guarda en `consents` por cada tipo de solicitud. */
const CONSENT_KIND: Record<BillingRequestKind, string> = {
  withdrawal: 'billing_withdrawal_request',
  cancel_renewal: 'billing_cancel_request',
  account_deletion: 'billing_deletion_request',
};

export interface BillingRequestDetails {
  /** Plan contratado, si se conoce. */
  planId?: string | null;
  /** Quién cobra: stripe, apple o google. */
  provider?: string | null;
  /** Para una eliminación: si quedaba una suscripción de tienda que seguirá cobrándose. */
  storeSubscriptionActive?: boolean;
}

interface StoredRequest {
  id: string;
  kind: BillingRequestKind;
  at: string;
  details: BillingRequestDetails;
}

async function currentUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getSession().catch(() => ({ data: { session: null } }));
  return data.session?.user.id ?? null;
}

function queueKeyFor(userId: string | null): string {
  return `mediclaro.billingrequests.queue.v1.${userId ?? 'device'}`;
}

/** Todo lo que define la solicitud, legible dentro del propio registro. */
function versionFor(entry: StoredRequest): string {
  const parts = [
    entry.at,
    entry.details.planId ?? 'sin-plan',
    entry.details.provider ?? 'sin-proveedor',
    entry.details.storeSubscriptionActive ? 'suscripcion-tienda-activa' : '',
  ].filter(Boolean);
  return parts.join('|');
}

async function recordOnServer(entry: StoredRequest, userId: string | null): Promise<boolean> {
  if (DemoMode.isActive()) return true;
  try {
    if (!userId) return false;
    const { error } = await supabase.from('consents').insert({
      user_id: userId,
      kind: CONSENT_KIND[entry.kind],
      version: versionFor(entry),
      granted: true,
    });
    return !error || (error as { code?: string }).code === '23505';
  } catch {
    return false;
  }
}

let queueLock: Promise<unknown> = Promise.resolve();
function withQueueLock<T>(fn: () => Promise<T>): Promise<T> {
  const run = queueLock.then(fn, fn);
  queueLock = run.catch(() => undefined);
  return run;
}

async function drainOnce(): Promise<boolean> {
  const userId = await currentUserId();
  const qKey = queueKeyFor(userId);
  for (;;) {
    const next = await withQueueLock(async () => (await localStore.getJSON<StoredRequest[]>(qKey, []))[0] ?? null);
    if (!next) return true;
    if (!(await recordOnServer(next, userId))) return false;
    await withQueueLock(async () => {
      const queue = await localStore.getJSON<StoredRequest[]>(qKey, []);
      await localStore.setJSON(qKey, queue.filter((e) => e.id !== next.id));
    });
  }
}

export const BillingRequestService = {
  /**
   * Registra una solicitud. Devuelve true si quedó registrada en el servidor; false si solo quedó
   * guardada en el teléfono para reintentarlo (no hay red, por ejemplo). Nunca lanza: una solicitud
   * nunca se pierde por un fallo de registro, y quien la hace no se queda esperando.
   */
  async record(kind: BillingRequestKind, details: BillingRequestDetails = {}): Promise<boolean> {
    try {
      const userId = await currentUserId();
      const entry: StoredRequest = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
        kind,
        at: new Date().toISOString(),
        details,
      };
      if (await recordOnServer(entry, userId)) return true;
      await withQueueLock(async () => {
        const queue = await localStore.getJSON<StoredRequest[]>(queueKeyFor(userId), []);
        await localStore.setJSON(queueKeyFor(userId), [...queue, entry]);
      });
      return false;
    } catch {
      return false;
    }
  },

  /** Reintenta lo que quedara pendiente de registrar. */
  async flush(): Promise<void> {
    await drainOnce().catch(() => undefined);
  },

  async forgetAccountLocalData(userId: string | null): Promise<void> {
    try {
      await localStore.remove(queueKeyFor(userId));
    } catch {
      // nada que hacer
    }
  },
};
