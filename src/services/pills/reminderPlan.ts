/**
 * «Mis pastillas» — qué avisos locales deben estar programados en el teléfono (función pura, probada en
 * src/services/__tests__/pillsReminders.test.ts) y cómo sincronizarlos con lo ya programado.
 *
 * Reglas:
 *  - un aviso a la hora de cada toma («MediClaro: son las 15:45. Es la hora de tu medicamento.») y, si se pide, un
 *    segundo aviso pasados N minutos si la toma sigue sin confirmar;
 *  - una toma ya confirmada u omitida no vuelve a avisar (se cancelan sus avisos repetidos);
 *  - «Recordármelo después» sustituye los avisos de esa toma por uno a la hora aplazada;
 *  - pautas diarias, semanales, cada N días y temporales (fecha de fin), con las horas de reloj del teléfono y los
 *    cambios de hora (núcleo común);
 *  - como máximo 60 avisos (iOS admite 64 pendientes por app), los más próximos: al abrir la app se rellenan.
 * Por defecto el aviso NO muestra el nombre del medicamento en la pantalla bloqueada (dato de salud).
 */
import {
  doseLabel,
  doseViews,
  occurrenceKey,
  occurrencesBetween,
  type DoseEvent,
  type Treatment,
  type Zone,
} from '../../domain/medication';
import type { ReminderSettings } from './planStore';

export type ReminderKind = 'main' | 'repeat' | 'snooze';

export interface PlannedReminder {
  /** Identificador estable: el mismo aviso nunca se programa dos veces. */
  id: string;
  at: Date;
  kind: ReminderKind;
  treatmentId: string;
  date: string;
  time: string;
  title: string;
  body: string;
  sound: boolean;
}

export interface Snooze {
  /** occurrenceKey(treatmentId, date, time) */
  key: string;
  until: string;
}

export const MAX_SCHEDULED = 60;
export const HORIZON_DAYS = 7;
export const REMINDER_PREFIX = 'mediclaro-dose|';

export function reminderId(treatmentId: string, date: string, time: string, kind: ReminderKind, extra = ''): string {
  return `${REMINDER_PREFIX}${treatmentId}|${date}|${time}|${kind}${extra ? `|${extra}` : ''}`;
}

export function planReminders(input: {
  treatments: Treatment[];
  events: DoseEvent[];
  settings: ReminderSettings;
  snoozes: Snooze[];
  now: Date;
  zone: Zone;
  horizonDays?: number;
  max?: number;
}): PlannedReminder[] {
  const { settings, now, zone } = input;
  if (!settings.enabled) return [];
  const repeatMs = Math.max(0, settings.repeatAfterMinutes) * 60_000;
  const lookBack = Math.max(repeatMs, 6 * 3_600_000);
  const treatments = input.treatments.filter((t) => t.active && t.remindersEnabled);
  const occurrences = occurrencesBetween(
    treatments,
    new Date(now.getTime() - lookBack),
    new Date(now.getTime() + (input.horizonDays ?? HORIZON_DAYS) * 86_400_000),
    zone,
  );
  const snoozes = new Map(input.snoozes.filter((s) => Date.parse(s.until) > now.getTime()).map((s) => [s.key, s.until]));
  const out: PlannedReminder[] = [];
  for (const view of doseViews(occurrences, input.events, now)) {
    if (view.status === 'taken' || view.status === 'skipped') continue;
    const { treatment, date, time, at } = view.occurrence;
    const base = {
      treatmentId: treatment.id,
      date,
      time,
      title: 'MediClaro',
      sound: settings.sound,
    };
    const named = settings.showMedicineName ? doseLabel(treatment) : null;
    const until = snoozes.get(occurrenceKey(treatment.id, date, time));
    if (until) {
      out.push({
        ...base,
        id: reminderId(treatment.id, date, time, 'snooze', until),
        at: new Date(until),
        kind: 'snooze',
        body: named ? `Te lo recordamos: es la hora de ${named} (toma de las ${time}).` : `Te lo recordamos: es la hora de tu medicamento de las ${time}.`,
      });
      continue;
    }
    if (at.getTime() > now.getTime()) {
      out.push({
        ...base,
        id: reminderId(treatment.id, date, time, 'main'),
        at,
        kind: 'main',
        body: named ? `Son las ${time}. Es la hora de ${named}.` : `Son las ${time}. Es la hora de tu medicamento.`,
      });
    }
    if (repeatMs > 0 && at.getTime() + repeatMs > now.getTime()) {
      out.push({
        ...base,
        id: reminderId(treatment.id, date, time, 'repeat'),
        at: new Date(at.getTime() + repeatMs),
        kind: 'repeat',
        body: named ? `Recordatorio: la toma de las ${time} (${named}) está sin confirmar.` : `Recordatorio: la toma de las ${time} está sin confirmar.`,
      });
    }
  }
  return out.sort((a, b) => a.at.getTime() - b.at.getTime()).slice(0, input.max ?? MAX_SCHEDULED);
}

/** Lo mínimo que hace falta del sistema de avisos (expo-notifications en la app; un doble en las pruebas). */
export interface ReminderAdapter {
  scheduledIds(): Promise<string[]>;
  schedule(reminder: PlannedReminder): Promise<void>;
  cancel(id: string): Promise<void>;
}

/** Deja programados exactamente los avisos del plan (cancela los que sobran y añade los que faltan). */
/**
 * Versión del aviso del teléfono. Cambia cuando cambia cómo suena (p. ej. el 09/10/2026, sonido de alarma y canal
 * nuevo de Android): así los avisos ya programados con el sonido anterior se vuelven a programar.
 */
export const REMINDER_FORMAT = 'alarma-1';

/** Huella corta del contenido del aviso (hora, texto, sonido): si cambia algo, el identificador cambia. */
function signature(r: PlannedReminder): string {
  const text = `${REMINDER_FORMAT}|${r.at.toISOString()}|${r.sound ? 1 : 0}|${r.title}|${r.body}`;
  let h = 5381;
  for (let i = 0; i < text.length; i += 1) h = ((h * 33) ^ text.charCodeAt(i)) >>> 0;
  return h.toString(36);
}

/** Identificador con el que se programa en el teléfono: el de la toma + la huella de su contenido. */
export function scheduledIdOf(r: PlannedReminder): string {
  return `${r.id}#${signature(r)}`;
}

/**
 * Deja programado exactamente el plan: cancela lo que sobra y programa lo que falta. Un aviso cuyo contenido ha
 * cambiado (activar «Mostrar el nombre», quitar el sonido, cambiar la dosis o la repetición) se cancela y se vuelve
 * a programar con el contenido nuevo. Solo toca los avisos de «Mis pastillas».
 */
export async function syncScheduled(adapter: ReminderAdapter, plan: PlannedReminder[]): Promise<{ scheduled: number; cancelled: number }> {
  const existing = (await adapter.scheduledIds()).filter((id) => id.startsWith(REMINDER_PREFIX));
  const wanted = new Map(plan.map((r) => [scheduledIdOf(r), r]));
  let cancelled = 0;
  let scheduled = 0;
  for (const id of existing) {
    if (!wanted.has(id)) {
      await adapter.cancel(id);
      cancelled += 1;
    }
  }
  const have = new Set(existing);
  for (const [id, reminder] of wanted) {
    if (!have.has(id)) {
      await adapter.schedule({ ...reminder, id });
      scheduled += 1;
    }
  }
  return { scheduled, cancelled };
}
