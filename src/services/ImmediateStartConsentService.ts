/**
 * ImmediateStartConsentService — petición expresa de empezar a usar Premium en el momento del pago.
 *
 * Para qué sirve: quien contrata un servicio digital a distancia tiene 14 días naturales para desistir.
 * Si el servicio se le presta desde el primer minuto, solo se puede descontar de la devolución la parte
 * ya disfrutada cuando la persona ha PEDIDO EXPRESAMENTE ese inicio inmediato y se le ha informado de esa
 * consecuencia. Sin ese registro, una reclamación obliga a devolver el importe completo.
 * [VERIFICAR CITA] Régimen de desistimiento en servicios digitales de la normativa de consumidores
 * (texto refundido de la Ley General para la Defensa de los Consumidores y Usuarios) — pendiente de
 * confirmación por el abogado, igual que la decisión de exigir la casilla para poder contratar.
 *
 * Cómo se registra: en la tabla `consents` que ya existe (kind = 'premium_immediate_start'), con la versión
 * del texto, el plan y la fecha. No hace falta ninguna migración: `kind` es texto libre y la política
 * «dar consentimiento» permite a cada persona insertar sus propios registros.
 *
 * Igual que el permiso de la IA: se guarda primero en el teléfono y el registro en el servidor va en
 * segundo plano con reintento, para que un fallo de red NUNCA impida pagar ni deje a la persona esperando.
 * Solo aplica a los pagos a través de Stripe (tarjeta, Bizum y domiciliación): las compras de Apple y de
 * Google Play las reembolsan las tiendas con sus propias condiciones.
 */
import { supabase } from '../api';
import { localStore } from '../api/storage';
import { IMMEDIATE_START_CONSENT, IMMEDIATE_START_VERSION } from '../content/legal';
import type { Subscription } from '../types';
import { DemoMode } from './DemoMode';

/** Formas de pago a las que se aplica (las que cobra MediClaro a través de Stripe). */
export type ImmediateStartChannel = 'card' | 'bizum' | 'sepa' | 'paypal';

/** Días naturales para desistir de la contratación. */
export const WITHDRAWAL_DAYS = 14;

/**
 * ¿Sigue en plazo para desistir? Decisión pura, para poder comprobarla: de ella depende si se ofrece una
 * devolución, así que no debe depender de la red ni del reloj del momento.
 *
 * Solo cuenta para lo que cobra MediClaro a través de Stripe (tarjeta, Bizum y domiciliación): los
 * reembolsos de Apple y de Google Play los deciden las tiendas con sus propias condiciones. Un acceso de
 * propietario, de cortesía o pagado por un familiar no lo contrata esta persona, así que tampoco desiste.
 *
 * `acceptedAt` es la fecha de la petición expresa de inicio inmediato, guardada al pagar. Si no consta,
 * devuelve false: el plazo sigue existiendo y las condiciones explican cómo pedirlo, pero la app no
 * afirma por su cuenta algo que no puede comprobar.
 */
export function withinWithdrawalWindow(
  sub: Subscription | null | undefined,
  acceptedAt: string | null,
  now: number = Date.now(),
): boolean {
  if (!sub?.isPremium || sub.provider !== 'stripe') return false;
  if (sub.ownerAccess || sub.courtesyAccess || sub.paidByFamily) return false;
  if (!acceptedAt) return false;
  const paidAt = Date.parse(acceptedAt);
  if (!Number.isFinite(paidAt)) return false;
  const elapsed = now - paidAt;
  // Una fecha futura (reloj del teléfono mal puesto) no abre un plazo nuevo.
  if (elapsed < 0) return false;
  return elapsed < WITHDRAWAL_DAYS * 24 * 60 * 60 * 1000;
}

interface StoredConsent {
  /** Identificador propio: dos aceptaciones seguidas no se confunden. */
  id: string;
  planId: string;
  channel: ImmediateStartChannel;
  version: string;
  /** Fecha de la aceptación (ISO). Es la que cuenta para los 14 días. */
  at: string;
}

async function currentUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getSession().catch(() => ({ data: { session: null } }));
  return data.session?.user.id ?? null;
}

function queueKeyFor(userId: string | null): string {
  return `mediclaro.immediatestart.queue.v1.${userId ?? 'device'}`;
}

function lastKeyFor(userId: string | null): string {
  return `mediclaro.immediatestart.last.v1.${userId ?? 'device'}`;
}

/**
 * Lo que se guarda en `version` queda legible en el propio registro: versión del texto, plan, forma de
 * pago y fecha. La clave primaria de `consents` es (user_id, kind, version), así que cada aceptación es
 * una fila distinta y ninguna sobrescribe a otra.
 */
function versionFor(entry: StoredConsent): string {
  return `${entry.version}|${entry.planId}|${entry.channel}|${entry.at}`;
}

/** Registra una aceptación en el servidor. Devuelve false si falla (se reintenta más tarde). */
async function recordOnServer(entry: StoredConsent, userId: string | null): Promise<boolean> {
  if (DemoMode.isActive()) return true; // en la demostración no hay servidor real
  try {
    if (!userId) return false;
    const { error } = await supabase.from('consents').insert({
      user_id: userId,
      kind: 'premium_immediate_start',
      version: versionFor(entry),
      granted: true,
    });
    // 23505 = ya estaba registrada (misma aceptación): cuenta como hecha.
    return !error || (error as { code?: string }).code === '23505';
  } catch {
    return false;
  }
}

/** Candado sencillo: las lecturas y escrituras de la cola nunca se pisan. */
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
    const next = await withQueueLock(async () => (await localStore.getJSON<StoredConsent[]>(qKey, []))[0] ?? null);
    if (!next) return true;
    if (!(await recordOnServer(next, userId))) return false;
    await withQueueLock(async () => {
      const queue = await localStore.getJSON<StoredConsent[]>(qKey, []);
      await localStore.setJSON(qKey, queue.filter((e) => e.id !== next.id));
    });
  }
}

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

export const ImmediateStartConsentService = {
  /** Texto exacto que acepta la persona (el mismo que guardan los textos legales). */
  text: IMMEDIATE_START_CONSENT,
  version: IMMEDIATE_START_VERSION,

  /**
   * Guarda la aceptación y la registra en el servidor en segundo plano. Nunca lanza: si falla la red, la
   * aceptación queda en el teléfono y se reintenta. Se llama justo antes de abrir la página de pago.
   */
  async accept(planId: string, channel: ImmediateStartChannel): Promise<void> {
    try {
      const userId = await currentUserId();
      const entry: StoredConsent = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
        planId,
        channel,
        version: IMMEDIATE_START_VERSION,
        at: new Date().toISOString(),
      };
      await localStore.setJSON(lastKeyFor(userId), entry);
      await withQueueLock(async () => {
        const queue = await localStore.getJSON<StoredConsent[]>(queueKeyFor(userId), []);
        await localStore.setJSON(queueKeyFor(userId), [...queue, entry]);
      });
      void drainQueue().catch(() => undefined);
    } catch {
      // Nunca impedimos pagar por un fallo al guardar el registro.
    }
  },

  /** Fecha (ISO) de la última aceptación de esta cuenta, o null. Sirve para contar los 14 días. */
  async lastAcceptedAt(): Promise<string | null> {
    try {
      const stored = await localStore.getJSON<StoredConsent | null>(lastKeyFor(await currentUserId()), null);
      return stored?.at ?? null;
    } catch {
      return null;
    }
  },

  /** Reintenta lo que quedara pendiente de registrar (al abrir la pantalla de Premium, por ejemplo). */
  async flush(): Promise<void> {
    await drainQueue().catch(() => undefined);
  },

  /** Como `withinWithdrawalWindow`, leyendo la fecha guardada en este teléfono. */
  async withinWithdrawalPeriod(sub: Subscription | null | undefined): Promise<boolean> {
    const at = await ImmediateStartConsentService.lastAcceptedAt().catch(() => null);
    return withinWithdrawalWindow(sub, at);
  },

  /** Lo que de esta cuenta solo vivía en el teléfono, al eliminar la cuenta. */
  async forgetAccountLocalData(userId: string | null): Promise<void> {
    try {
      await localStore.remove(queueKeyFor(userId));
      await localStore.remove(lastKeyFor(userId));
    } catch {
      // nada que hacer
    }
  },
};
