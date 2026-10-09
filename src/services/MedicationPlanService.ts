/**
 * «Mis pastillas» — instancias reales del servicio de datos y de los avisos locales.
 *  - MedicationPlanService: pauta, tomas, correcciones, ajustes y permisos (servidor = fuente de verdad; copia
 *    cifrada y cola sin conexión en el teléfono). Ver src/services/pills/planStore.ts.
 *  - PillReminders: deja programados en el teléfono exactamente los avisos que tocan (ver pills/reminderPlan.ts).
 */
import * as Crypto from 'expo-crypto';
import { supabase, requireUserId } from '../api';
import { localStore, secureLocalStore } from '../api/storage';
import { deviceZone, occurrenceKey } from '../domain/medication';
import { createPlanService, type RpcResult } from './pills/planStore';
import { planReminders, syncScheduled, type Snooze } from './pills/reminderPlan';
import {
  dismissDoseNotifications,
  ensureReminderChannels,
  expoReminderAdapter,
  reminderPermission,
  remindersSupported,
} from './pills/notifications';

export const MedicationPlanService = createPlanService({
  rpc: (name, args) => supabase.rpc(name, args) as unknown as PromiseLike<RpcResult>,
  store: secureLocalStore,
  userId: requireUserId,
  now: () => new Date(),
  uuid: () => Crypto.randomUUID(),
  zone: () => deviceZone(),
});

const SNOOZE_KEY = 'mediclaro.pills.snoozes.v1';
const ZONE_KEY = 'mediclaro.pills.zone.v1';
let queue: Promise<unknown> = Promise.resolve();

async function activeSnoozes(): Promise<Snooze[]> {
  const list = await localStore.getJSON<Snooze[]>(SNOOZE_KEY, []);
  return (Array.isArray(list) ? list : []).filter((s) => Date.parse(s.until) > Date.now());
}

export const PillReminders = {
  supported: remindersSupported,

  /**
   * Programa (o cancela) los avisos del teléfono según la pauta y las tomas confirmadas. `enabled` false: cancela
   * todos (p. ej. sin Premium). Se ejecutan de uno en uno para no duplicar avisos.
   */
  reschedule(enabled = true): Promise<{ scheduled: number; cancelled: number } | null> {
    const run = async () => {
      if (!remindersSupported) return null;
      if (!enabled) return syncScheduled(expoReminderAdapter, []);
      const state = MedicationPlanService.getState();
      if (!state || (await reminderPermission()) !== 'granted') return null;
      await ensureReminderChannels();
      const plan = planReminders({
        treatments: state.treatments,
        events: state.events,
        settings: state.settings,
        snoozes: await activeSnoozes(),
        now: new Date(),
        zone: deviceZone(),
      });
      return syncScheduled(expoReminderAdapter, plan);
    };
    const next = queue.then(run, run);
    queue = next.catch(() => undefined);
    return next;
  },

  /** «Recordármelo después»: aplaza los avisos de esa toma. Devuelve la nueva hora. */
  async snooze(treatmentId: string, date: string, time: string, minutes: number): Promise<Date> {
    const until = new Date(Date.now() + minutes * 60_000);
    const key = occurrenceKey(treatmentId, date, time);
    const list = (await activeSnoozes()).filter((s) => s.key !== key);
    await localStore.setJSON(SNOOZE_KEY, [...list, { key, until: until.toISOString() }]);
    await PillReminders.reschedule();
    return until;
  },

  /** Tras confirmar u omitir: fuera el aplazamiento y los avisos que quedaban a la vista. */
  async resolved(treatmentId: string, date: string, time: string): Promise<void> {
    const key = occurrenceKey(treatmentId, date, time);
    await localStore.setJSON(SNOOZE_KEY, (await activeSnoozes()).filter((s) => s.key !== key));
    await dismissDoseNotifications(treatmentId, date, time);
    await PillReminders.reschedule();
  },

  /** ¿Ha cambiado la zona horaria del teléfono desde la última vez? (viajes, cambio manual). */
  async zoneChanged(): Promise<boolean> {
    const current = deviceZone().name;
    const previous = await localStore.getJSON<string>(ZONE_KEY, '');
    if (previous === current) return false;
    await localStore.setJSON(ZONE_KEY, current);
    return previous !== '';
  },
};
