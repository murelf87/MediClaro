/**
 * «Mis pastillas» — NÚCLEO COMÚN de la app (React Native) y del servidor (Edge Functions de Supabase, Deno).
 *
 * Un solo archivo SIN dependencias ni APIs de plataforma, para que las dos partes calculen exactamente lo mismo:
 *  - calendario: qué tomas tocan cada día (diaria, días de la semana o cada N días), con fecha de inicio y fin;
 *  - zona horaria: las horas de la pauta son de reloj local («a las 08:00»); el instante real se calcula con la zona
 *    de la persona e incluye los cambios de hora (hueco de primavera → se avisa a la hora válida siguiente;
 *    hora repetida de otoño → la primera). Los registros se guardan en UTC;
 *  - estado de cada toma (verde confirmada, naranja pendiente, gris más tarde, rojo incidencia) SIN marcar nunca
 *    nada como tomado automáticamente;
 *  - aviso de posible doble toma;
 *  - respuestas del asistente a preguntas sobre las tomas, basadas SOLO en la pauta y los registros reales
 *    (nunca en lo que diga la conversación), sin indicar nunca que se tome otra dosis.
 *
 * Lo importan: src/services/MedicationPlanService.ts (app), supabase/functions/chat (servidor) y las pruebas.
 */

// ─── Tipos ────────────────────────────────────────────────────────────────────────────────────────────────

export const DOSE_UNITS = [
  'comprimido',
  'capsula',
  'sobre',
  'ml',
  'gotas',
  'inhalacion',
  'parche',
  'unidad',
  'aplicacion',
  'ampolla',
  'cucharada',
] as const;
export type DoseUnit = (typeof DOSE_UNITS)[number];

export type Frequency = 'daily' | 'weekly' | 'interval';

export interface Treatment {
  id: string;
  /** Nº de registro de CIMA si se añadió desde la foto o desde «Mis medicamentos». */
  medicineId: string | null;
  name: string;
  /** Concentración tal como la escribe la persona («850 mg»). */
  strength: string | null;
  doseAmount: number;
  doseUnit: DoseUnit;
  frequency: Frequency;
  /** Días ISO (1 = lunes … 7 = domingo) para la pauta semanal. */
  daysOfWeek: number[] | null;
  /** Cada cuántos días (pauta «cada N días», contando desde la fecha de inicio). */
  intervalDays: number | null;
  /** Horas de reloj local «HH:MM», ordenadas y sin repetir. */
  times: string[];
  startDate: string;
  endDate: string | null;
  instructions: string | null;
  notes: string | null;
  remindersEnabled: boolean;
  active: boolean;
  /** La persona (o su cuidador/a autorizado) confirma que es la pauta indicada por su médico o farmacéutico. */
  prescriptionConfirmed: boolean;
  version: number;
  /** Zona horaria IANA en la que se guardó la pauta (la usa el servidor para saber qué es «hoy»). */
  timezone: string;
  updatedAt?: string | null;
}

export type DoseKind = 'taken' | 'skipped' | 'extra';
export type RecorderRole = 'patient' | 'caregiver';

export interface DoseEvent {
  /** Identificador creado en el teléfono: repetir el envío nunca duplica la toma (idempotencia). */
  id: string;
  treatmentId: string;
  /** Día y hora PROGRAMADOS (reloj local) de la toma a la que corresponde; null en una toma fuera de pauta. */
  occurrenceDate: string | null;
  scheduledTime: string | null;
  kind: DoseKind;
  /** 'voided': anulada por una corrección (nunca se borra el registro original). */
  status: 'active' | 'voided';
  /** Hora REAL de la toma que se declara (UTC, ISO). */
  takenAt: string | null;
  /** Cuándo se hizo la confirmación en el teléfono (UTC, ISO). */
  clientRecordedAt: string;
  /** Cuándo la recibió el servidor (null mientras no se ha sincronizado). */
  recordedAt?: string | null;
  recordedByRole: RecorderRole;
  recordedByName?: string | null;
  doseAmount: number;
  doseUnit: DoseUnit;
  medicineName: string;
  possibleDuplicate: boolean;
  /** Si este registro sustituye a otro corregido. */
  correctsEventId?: string | null;
  voidReason?: string | null;
  note?: string | null;
  /** Solo en el teléfono: aún sin sincronizar. */
  pending?: boolean;
}

export type ReminderState = 'delivered' | 'opened' | 'snoozed' | 'not_yet';

export interface ReminderEvent {
  id: string;
  treatmentId: string;
  occurrenceDate: string;
  scheduledTime: string;
  state: ReminderState;
  at: string;
}

// ─── Calendario (fechas «YYYY-MM-DD» sin zona) ────────────────────────────────────────────────────────────

const DAY_MS = 86_400_000;

export function isIsoDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d));
  return t.getUTCFullYear() === y && t.getUTCMonth() === m - 1 && t.getUTCDate() === d;
}

export function isValidTime(value: unknown): value is string {
  return typeof value === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

const pad = (n: number) => String(n).padStart(2, '0');

export function isoDate(y: number, m: number, d: number): string {
  return `${String(y).padStart(4, '0')}-${pad(m)}-${pad(d)}`;
}

export function hhmm(h: number, m: number): string {
  return `${pad(h)}:${pad(m)}`;
}

function dateUtcMs(date: string): number {
  const [y, m, d] = date.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
}

export function addDays(date: string, days: number): string {
  const t = new Date(dateUtcMs(date) + days * DAY_MS);
  return isoDate(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate());
}

export function daysBetween(from: string, to: string): number {
  return Math.round((dateUtcMs(to) - dateUtcMs(from)) / DAY_MS);
}

/** 1 = lunes … 7 = domingo. */
export function isoWeekday(date: string): number {
  const day = new Date(dateUtcMs(date)).getUTCDay();
  return day === 0 ? 7 : day;
}

export function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

export function normalizeTimes(times: string[]): string[] {
  return [...new Set(times.filter(isValidTime))].sort();
}

// ─── Zona horaria ─────────────────────────────────────────────────────────────────────────────────────────

export interface LocalParts {
  date: string;
  time: string;
  /** Minutos desde medianoche (local). */
  minutes: number;
  weekday: number;
}

export interface Zone {
  name: string;
  /** Fecha y hora locales de un instante. */
  parts(instant: Date): LocalParts;
  /**
   * Instante (UTC) de una hora de reloj local. Hueco del cambio de primavera → misma hora más el salto (la hora
   * válida siguiente); hora repetida de otoño → la primera vez que ocurre.
   */
  instant(date: string, time: string): Date;
}

/** Zona IANA concreta («Europe/Madrid») con Intl. La usa el servidor (y las pruebas). */
export function intlZone(tz: string): Zone {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const raw = (t: Date) => {
    const out: Record<string, number> = {};
    for (const p of fmt.formatToParts(t)) if (p.type !== 'literal') out[p.type] = Number(p.value);
    return { y: out.year, m: out.month, d: out.day, h: out.hour === 24 ? 0 : out.hour, min: out.minute, s: out.second };
  };
  const offsetMin = (t: Date) => {
    const r = raw(t);
    const whole = Math.floor(t.getTime() / 1000) * 1000;
    return Math.round((Date.UTC(r.y, r.m - 1, r.d, r.h, r.min, r.s) - whole) / 60_000);
  };
  const parts = (t: Date): LocalParts => {
    const r = raw(t);
    const date = isoDate(r.y, r.m, r.d);
    return { date, time: hhmm(r.h, r.min), minutes: r.h * 60 + r.min, weekday: isoWeekday(date) };
  };
  return {
    name: tz,
    parts,
    instant(date, time) {
      const [h, min] = time.split(':').map(Number);
      const guess = dateUtcMs(date) + (h * 60 + min) * 60_000;
      const before = offsetMin(new Date(guess - 26 * 3_600_000));
      const after = offsetMin(new Date(guess + 26 * 3_600_000));
      const matches = [...new Set([before, after])]
        .map((off) => guess - off * 60_000)
        .filter((t) => {
          const p = parts(new Date(t));
          return p.date === date && p.time === time;
        })
        .sort((a, b) => a - b);
      return new Date(matches.length ? matches[0] : guess - before * 60_000);
    },
  };
}

/** Zona del propio teléfono (la que usa la app para los avisos): mismas reglas, con el reloj del sistema. */
export function deviceZone(name?: string): Zone {
  let resolved = name;
  if (!resolved) {
    try {
      resolved = Intl.DateTimeFormat().resolvedOptions().timeZone || 'local';
    } catch {
      resolved = 'local';
    }
  }
  return {
    name: resolved,
    parts(t) {
      const date = isoDate(t.getFullYear(), t.getMonth() + 1, t.getDate());
      return { date, time: hhmm(t.getHours(), t.getMinutes()), minutes: t.getHours() * 60 + t.getMinutes(), weekday: isoWeekday(date) };
    },
    instant(date, time) {
      const [y, m, d] = date.split('-').map(Number);
      const [h, min] = time.split(':').map(Number);
      return new Date(y, m - 1, d, h, min, 0, 0);
    },
  };
}

/** Zona IANA si el motor la admite; si no, la del teléfono. */
export function zoneFor(tz: string | null | undefined): Zone {
  if (tz) {
    try {
      const z = intlZone(tz);
      z.parts(new Date());
      return z;
    } catch {
      // Zona desconocida o Intl sin zonas: se usa la del teléfono.
    }
  }
  return deviceZone();
}

// ─── Tomas programadas ────────────────────────────────────────────────────────────────────────────────────

export interface Occurrence {
  key: string;
  treatmentId: string;
  date: string;
  time: string;
  at: Date;
  treatment: Treatment;
}

export function occurrenceKey(treatmentId: string, date: string, time: string): string {
  return `${treatmentId}|${date}|${time}`;
}

export function isScheduledOn(t: Treatment, date: string): boolean {
  if (!t.active || !isIsoDate(t.startDate) || date < t.startDate) return false;
  if (t.endDate && date > t.endDate) return false;
  if (t.frequency === 'weekly') return (t.daysOfWeek ?? []).includes(isoWeekday(date));
  if (t.frequency === 'interval') {
    const every = Math.max(1, Math.floor(t.intervalDays ?? 1));
    return daysBetween(t.startDate, date) % every === 0;
  }
  return true;
}

function sortOccurrences(list: Occurrence[]): Occurrence[] {
  return list.sort((a, b) => a.at.getTime() - b.at.getTime() || a.treatment.name.localeCompare(b.treatment.name, 'es'));
}

export function occurrencesForDate(treatments: Treatment[], date: string, zone: Zone): Occurrence[] {
  const out: Occurrence[] = [];
  for (const t of treatments) {
    if (!isScheduledOn(t, date)) continue;
    for (const time of normalizeTimes(t.times)) {
      out.push({ key: occurrenceKey(t.id, date, time), treatmentId: t.id, date, time, at: zone.instant(date, time), treatment: t });
    }
  }
  return sortOccurrences(out);
}

/** Tomas cuyo instante cae en [from, to). */
export function occurrencesBetween(treatments: Treatment[], from: Date, to: Date, zone: Zone): Occurrence[] {
  const first = addDays(zone.parts(from).date, -1);
  const last = addDays(zone.parts(to).date, 1);
  const out: Occurrence[] = [];
  for (let d = first; d <= last; d = addDays(d, 1)) {
    for (const o of occurrencesForDate(treatments, d, zone)) {
      if (o.at.getTime() >= from.getTime() && o.at.getTime() < to.getTime()) out.push(o);
    }
  }
  return sortOccurrences(out);
}

// ─── Estado de cada toma ──────────────────────────────────────────────────────────────────────────────────

/** Tras la hora programada, la toma sigue «pendiente» (naranja) este tiempo; después, «sin confirmar» (rojo). */
export const PENDING_WINDOW_MIN = 120;

export type DoseStatus = 'taken' | 'skipped' | 'pending' | 'later' | 'unconfirmed';
export type DoseColor = 'green' | 'orange' | 'grey' | 'red';

export interface DoseView {
  occurrence: Occurrence;
  status: DoseStatus;
  color: DoseColor;
  /** Registro activo que resuelve la toma (tomada u omitida). */
  event: DoseEvent | null;
  /** Tomas adicionales registradas para esta misma toma (posible incidencia). */
  extras: DoseEvent[];
  /** Hay registros anulados por corrección para esta toma. */
  corrected: boolean;
  /** Requiere atención (rojo): sin confirmar, omitida o posible toma doble. */
  incident: boolean;
}

function eventsByOccurrence(events: DoseEvent[]): Map<string, DoseEvent[]> {
  const map = new Map<string, DoseEvent[]>();
  for (const e of events) {
    if (!e.occurrenceDate || !e.scheduledTime) continue;
    const key = occurrenceKey(e.treatmentId, e.occurrenceDate, e.scheduledTime);
    const list = map.get(key);
    if (list) list.push(e);
    else map.set(key, [e]);
  }
  return map;
}

export function doseViews(occurrences: Occurrence[], events: DoseEvent[], now: Date): DoseView[] {
  const byKey = eventsByOccurrence(events);
  return occurrences.map((occurrence) => {
    const list = byKey.get(occurrence.key) ?? [];
    const active = list.filter((e) => e.status === 'active');
    const resolving =
      active
        .filter((e) => e.kind === 'taken' || e.kind === 'skipped')
        .sort((a, b) => a.clientRecordedAt.localeCompare(b.clientRecordedAt))[0] ?? null;
    const extras = active.filter((e) => e.kind === 'extra');
    const corrected = list.some((e) => e.status === 'voided');
    let status: DoseStatus;
    if (resolving?.kind === 'taken') status = 'taken';
    else if (resolving?.kind === 'skipped') status = 'skipped';
    else if (now.getTime() < occurrence.at.getTime()) status = 'later';
    else if (now.getTime() - occurrence.at.getTime() < PENDING_WINDOW_MIN * 60_000) status = 'pending';
    else status = 'unconfirmed';
    const incident = status === 'skipped' || status === 'unconfirmed' || extras.length > 0;
    const color: DoseColor =
      extras.length > 0 ? 'red' : status === 'taken' ? 'green' : status === 'pending' ? 'orange' : status === 'later' ? 'grey' : 'red';
    return { occurrence, status, color, event: resolving, extras, corrected, incident };
  });
}

/** La toma que importa ahora: la pendiente más antigua y, si no hay, la siguiente programada. */
export function nextDose(views: DoseView[]): DoseView | null {
  return views.find((v) => v.status === 'pending') ?? views.find((v) => v.status === 'later') ?? null;
}

// ─── Doble toma ───────────────────────────────────────────────────────────────────────────────────────────

export function confirmedFor(events: DoseEvent[], treatmentId: string, date: string, time: string): DoseEvent | null {
  return (
    events
      .filter(
        (e) =>
          e.status === 'active' &&
          e.kind === 'taken' &&
          e.treatmentId === treatmentId &&
          e.occurrenceDate === date &&
          e.scheduledTime === time,
      )
      .sort((a, b) => a.clientRecordedAt.localeCompare(b.clientRecordedAt))[0] ?? null
  );
}

/**
 * Una nueva confirmación de «tomada» para una toma que ya figura confirmada NO se rechaza (una toma adicional real es
 * información clínica importante): se guarda como toma adicional y posible incidencia.
 */
export function classifyNewDose(
  events: DoseEvent[],
  treatmentId: string,
  date: string | null,
  time: string | null,
  kind: DoseKind,
): { kind: DoseKind; possibleDuplicate: boolean; existing: DoseEvent | null } {
  if (kind === 'skipped' || !date || !time) {
    return { kind, possibleDuplicate: kind === 'extra', existing: null };
  }
  const existing = confirmedFor(events, treatmentId, date, time);
  if (existing) return { kind: 'extra', possibleDuplicate: true, existing };
  return { kind, possibleDuplicate: kind === 'extra', existing: null };
}

export function duplicateWarning(existing: DoseEvent | null, zone: Zone): string | null {
  if (!existing) return null;
  const at = existing.takenAt ?? existing.clientRecordedAt;
  return `Atención: esta toma ya figura confirmada a las ${zone.parts(new Date(at)).time}.`;
}

/** Una toma registrada a posteriori (más de 30 min entre la hora declarada y la confirmación). */
export function isLateEntry(e: DoseEvent): boolean {
  if (!e.takenAt) return false;
  return Date.parse(e.clientRecordedAt) - Date.parse(e.takenAt) > 30 * 60_000;
}

// ─── Textos ───────────────────────────────────────────────────────────────────────────────────────────────

const UNIT_FORMS: Record<DoseUnit, [string, string]> = {
  comprimido: ['comprimido', 'comprimidos'],
  capsula: ['cápsula', 'cápsulas'],
  sobre: ['sobre', 'sobres'],
  ml: ['ml', 'ml'],
  gotas: ['gota', 'gotas'],
  inhalacion: ['inhalación', 'inhalaciones'],
  parche: ['parche', 'parches'],
  unidad: ['unidad', 'unidades'],
  aplicacion: ['aplicación', 'aplicaciones'],
  ampolla: ['ampolla', 'ampollas'],
  cucharada: ['cucharada', 'cucharadas'],
};

const FEMININE = new Set<DoseUnit>(['capsula', 'gotas', 'inhalacion', 'unidad', 'aplicacion', 'ampolla', 'cucharada']);

export function unitLabel(unit: DoseUnit, plural: boolean): string {
  return UNIT_FORMS[unit][plural ? 1 : 0];
}

/** «1 comprimido», «medio comprimido», «1 comprimido y medio», «2 cápsulas», «5 ml», «0,25 ml». */
export function formatDose(amount: number, unit: DoseUnit): string {
  if (unit === 'ml') return `${String(amount).replace('.', ',')} ml`;
  const whole = Math.floor(amount);
  const frac = Math.round((amount - whole) * 100) / 100;
  const half = FEMININE.has(unit) ? 'media' : 'medio';
  if (frac === 0.5) {
    return whole === 0 ? `${half} ${unitLabel(unit, false)}` : `${whole} ${unitLabel(unit, whole !== 1)} y ${half}`;
  }
  if (frac === 0) return `${whole} ${unitLabel(unit, whole !== 1)}`;
  return `${String(amount).replace('.', ',')} ${unitLabel(unit, true)}`;
}

export function medicineLabel(t: Pick<Treatment, 'name' | 'strength'>): string {
  const name = t.name.trim();
  const strength = (t.strength ?? '').trim();
  return strength && !name.toLowerCase().includes(strength.toLowerCase()) ? `${name} ${strength}` : name;
}

/** «Metformina 850 mg, 1 comprimido». */
export function doseLabel(t: Treatment): string {
  return `${medicineLabel(t)}, ${formatDose(t.doseAmount, t.doseUnit)}`;
}

const WEEKDAYS = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];

export function weekdayName(isoDay: number): string {
  return WEEKDAYS[(isoDay - 1 + 7) % 7];
}

/** «todos los días», «lunes, miércoles y viernes», «cada 2 días». */
export function frequencyLabel(t: Pick<Treatment, 'frequency' | 'daysOfWeek' | 'intervalDays'>): string {
  if (t.frequency === 'weekly') {
    const days = [...new Set(t.daysOfWeek ?? [])].sort().map(weekdayName);
    if (days.length === 0) return 'ningún día';
    if (days.length === 7) return 'todos los días';
    return days.length === 1 ? `los ${days[0]}` : `${days.slice(0, -1).join(', ')} y ${days[days.length - 1]}`;
  }
  if (t.frequency === 'interval') {
    const n = Math.max(1, Math.floor(t.intervalDays ?? 1));
    return n === 1 ? 'todos los días' : `cada ${n} días`;
  }
  return 'todos los días';
}

function listJoin(items: string[]): string {
  if (items.length <= 1) return items[0] ?? '';
  return `${items.slice(0, -1).join('; ')}; y ${items[items.length - 1]}`;
}

function dayPhrase(date: string, today: string): string {
  const diff = daysBetween(today, date);
  if (diff === 0) return 'hoy';
  if (diff === 1) return 'mañana';
  const [, m, d] = date.split('-').map(Number);
  const months = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  return `el ${weekdayName(isoWeekday(date))} ${d} de ${months[m - 1]}`;
}

// ─── Preguntas al asistente sobre las tomas ───────────────────────────────────────────────────────────────

export type MedicationIntent = 'taken_check' | 'unsure_taken' | 'remaining_today' | 'next_dose' | 'today_plan';
export type DayPeriod = 'morning' | 'midday' | 'afternoon' | 'night';

export interface IntentMatch {
  intent: MedicationIntent;
  period: DayPeriod | null;
  /** Medicamentos que nombra la pregunta (null = todos). */
  treatmentIds: string[] | null;
}

/** Franjas del día (minutos locales) para «esta mañana», «a mediodía», «esta tarde», «esta noche». */
const PERIODS: Record<DayPeriod, { ranges: Array<[number, number]>; phrase: string }> = {
  morning: { ranges: [[300, 720]], phrase: 'esta mañana' },
  midday: { ranges: [[720, 960]], phrase: 'a mediodía' },
  afternoon: { ranges: [[840, 1260]], phrase: 'esta tarde' },
  night: { ranges: [[1200, 1440], [0, 300]], phrase: 'esta noche' },
};

export function normalizeQuestion(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[¿?¡!.,;:()"«»]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const PILL_WORDS = /\b(pastilla|pastillas|medicina|medicinas|medicamento|medicamentos|medicacion|toma|tomas|comprimido|comprimidos|capsula|capsulas|dosis|tratamiento|sobre|sobres|gotas|inhalador|parche)\b/;

function periodOf(q: string): DayPeriod | null {
  if (/\b(esta|por la|de la|en la) manana\b|\bdesayuno\b|\bal levantarme\b/.test(q)) return 'morning';
  if (/\bmediodia\b|\b(la )?comida\b|\balmuerzo\b/.test(q)) return 'midday';
  if (/\b(esta|por la|de la|en la) tarde\b|\bmerienda\b/.test(q)) return 'afternoon';
  if (/\b(esta|por la|de la|en la) noche\b|\bcena\b|\bantes de dormir\b|\bal acostarme\b/.test(q)) return 'night';
  return null;
}

function namedTreatments(q: string, treatments: Treatment[]): string[] | null {
  const ids: string[] = [];
  for (const t of treatments) {
    const words = normalizeQuestion(t.name).split(' ').filter((w) => w.length >= 4);
    if (words.length && words.some((w) => new RegExp(`\\b${w}\\b`).test(q))) ids.push(t.id);
  }
  return ids.length ? ids : null;
}

/**
 * ¿Pregunta por SUS tomas? Solo reconoce preguntas claras sobre tomas propias («¿me he tomado…?», «¿qué me queda
 * hoy?», «¿cuándo me toca?», «no recuerdo si me la tomé»). Las dudas generales sobre un medicamento («¿para qué
 * sirve…?») NO entran aquí: las responde el asistente con la información oficial.
 */
export function detectMedicationIntent(text: string, treatments: Treatment[]): IntentMatch | null {
  const q = normalizeQuestion(text);
  if (!q) return null;
  const named = namedTreatments(q, treatments);
  const aboutPills = PILL_WORDS.test(q) || !!named || /\b(me la|me las|me lo|me los)\b/.test(q);
  const period = periodOf(q);
  if (/\b(no (me )?(acuerdo|recuerdo)|no se si (ya )?(me )?(la |las |lo |los )?(he )?tom|dudo si|no estoy segur[oa] de si)\b/.test(q) && (aboutPills || /\btom/.test(q))) {
    return { intent: 'unsure_taken', period, treatmentIds: named };
  }
  if (/\b(cuando me toca|cuando tengo que tomar|a que hora (me toca|tengo que tomar|es la proxima|es la siguiente)|(la |mi )?(proxima|siguiente) (toma|pastilla|dosis|medicina|medicacion)|que hora es la proxima)\b/.test(q)) {
    return { intent: 'next_dose', period: null, treatmentIds: named };
  }
  if (/\b(que (pastillas|medicinas|medicamentos|tomas|me) (me )?quedan?|me queda(n)? (alguna|algo|alguna toma|por tomar|pastillas|tomas)|que me queda por tomar|(tomas|pastillas) pendientes|me falta(n)? (alguna|por tomar|tomar))\b/.test(q)) {
    return { intent: 'remaining_today', period, treatmentIds: named };
  }
  if (/\b((ya )?me (he )?tomado|me (la |las |lo |los )?(he )?tomado|(ya )?me (la |las |lo |los )?tome|he tomado|tome ya|me tome)\b/.test(q) && (aboutPills || period !== null)) {
    return { intent: 'taken_check', period, treatmentIds: named };
  }
  if (/\b(que (pastillas|medicinas|medicamentos|tomas) (tengo|tomo|me tocan) hoy|mis tomas de hoy|(pastillas|medicinas|medicamentos|tomas) de hoy|que tengo que tomar hoy)\b/.test(q)) {
    return { intent: 'today_plan', period, treatmentIds: named };
  }
  return null;
}

export interface AnswerContext {
  now: Date;
  zone: Zone;
  treatments: Treatment[];
  events: DoseEvent[];
}

const NO_CONFIRMATION_TAIL =
  'Eso no significa que no la hayas tomado. Antes de repetir una dosis, consulta con tu farmacéutico o profesional sanitario.';
const NO_PLAN =
  'Todavía no tienes ninguna pauta registrada en «Mis pastillas». Puedes añadirla desde Inicio › Mis pastillas, con la pauta que te indicó tu médico o farmacéutico.';

function inPeriod(o: Occurrence, period: DayPeriod | null, zone: Zone): boolean {
  if (!period) return true;
  const m = zone.parts(o.at).minutes;
  return PERIODS[period].ranges.some(([a, b]) => m >= a && m < b);
}

function recorderPhrase(e: DoseEvent): string {
  return e.recordedByRole === 'caregiver' ? `${e.recordedByName?.trim() || 'tu cuidador/a'} confirmó que tomaste` : 'has confirmado que tomaste';
}

function describeView(v: DoseView, zone: Zone): { text: string; uncertain: boolean } {
  const med = medicineLabel(v.occurrence.treatment);
  const e = v.event;
  if (v.status === 'taken' && e) {
    const at = zone.parts(new Date(e.takenAt ?? e.clientRecordedAt)).time;
    return { text: `${recorderPhrase(e)} ${med} a las ${at}`, uncertain: false };
  }
  if (v.status === 'skipped') {
    return { text: `la toma de ${med} de las ${v.occurrence.time} figura como no tomada`, uncertain: false };
  }
  return { text: `no tengo una confirmación fiable de la toma de ${med} de las ${v.occurrence.time}`, uncertain: true };
}

function extrasNote(views: DoseView[], zone: Zone): string {
  const extras = views.flatMap((v) => v.extras.map((x) => ({ v, x })));
  if (!extras.length) return '';
  const first = extras[0];
  const at = zone.parts(new Date(first.x.takenAt ?? first.x.clientRecordedAt)).time;
  return ` Además, figura una toma adicional de ${medicineLabel(first.v.occurrence.treatment)} a las ${at}: si tienes dudas, coméntalo con tu médico o farmacéutico.`;
}

function correctedNote(views: DoseView[]): string {
  return views.some((v) => v.corrected) ? ' (Alguno de estos registros se corrigió después.)' : '';
}

/**
 * Respuesta en lenguaje sencillo a una pregunta sobre las tomas, construida SOLO con la pauta registrada y los
 * registros confirmados. Distingue: confirmada por la persona, confirmada por su cuidador/a, pendiente, omitida,
 * sin información suficiente y registro corregido. Nunca indica que se tome, repita, cambie o suspenda una dosis.
 */
export function answerMedicationQuestion(match: IntentMatch, ctx: AnswerContext): string {
  const { now, zone } = ctx;
  const treatments = ctx.treatments.filter((t) => t.active && (!match.treatmentIds || match.treatmentIds.includes(t.id)));
  if (!ctx.treatments.some((t) => t.active)) return NO_PLAN;
  if (!treatments.length) return 'No encuentro ese medicamento en tu pauta registrada de «Mis pastillas».';
  const today = zone.parts(now).date;
  const todays = doseViews(occurrencesForDate(treatments, today, zone), ctx.events, now);
  const periodText = match.period ? PERIODS[match.period].phrase : 'hoy';

  switch (match.intent) {
    case 'taken_check': {
      const scope = todays.filter((v) => inPeriod(v.occurrence, match.period, zone));
      if (!scope.length) return `Según tu pauta registrada, no tienes ninguna toma programada ${periodText}.`;
      const past = scope.filter((v) => v.status !== 'later');
      if (!past.length) {
        const first = scope[0];
        return `La toma de ${medicineLabel(first.occurrence.treatment)} de ${periodText === 'hoy' ? 'hoy' : periodText} es a las ${first.occurrence.time} y todavía no ha llegado la hora.`;
      }
      const parts = past.map((v) => describeView(v, zone));
      const uncertain = parts.some((p) => p.uncertain);
      return `Según tu historial, ${listJoin(parts.map((p) => p.text))}.${uncertain ? ` ${NO_CONFIRMATION_TAIL}` : ''}${extrasNote(past, zone)}${correctedNote(past)}`;
    }
    case 'unsure_taken': {
      const scope = todays.filter((v) => inPeriod(v.occurrence, match.period, zone) && v.status !== 'later');
      const latest = scope[scope.length - 1];
      if (!latest) {
        return `Según tu pauta registrada, ${periodText === 'hoy' ? 'hoy' : periodText} todavía no te ha tocado ninguna toma. Si tienes dudas, no repitas ninguna dosis sin consultar a tu farmacéutico.`;
      }
      const d = describeView(latest, zone);
      if (d.uncertain) {
        return `No tengo una confirmación fiable de esa toma (${medicineLabel(latest.occurrence.treatment)} de las ${latest.occurrence.time}). ${NO_CONFIRMATION_TAIL}`;
      }
      return `Según tu historial, ${d.text}. Si aun así tienes dudas, no repitas la dosis sin consultar a tu farmacéutico o profesional sanitario.${extrasNote([latest], zone)}${correctedNote([latest])}`;
    }
    case 'remaining_today': {
      const remaining = todays.filter((v) => (v.status === 'later' || v.status === 'pending') && inPeriod(v.occurrence, match.period, zone));
      const unconfirmed = todays.filter((v) => v.status === 'unconfirmed');
      const tail = unconfirmed.length
        ? ` La toma de ${medicineLabel(unconfirmed[0].occurrence.treatment)} de las ${unconfirmed[0].occurrence.time} no está confirmada.`
        : '';
      if (!remaining.length) return `Según tu pauta registrada, ${periodText === 'hoy' ? 'hoy' : periodText} ya no te queda ninguna toma.${tail}`;
      const item = (v: DoseView) =>
        `a las ${v.occurrence.time}${v.status === 'pending' ? ' (ya es la hora y está sin confirmar)' : ''}: ${doseLabel(v.occurrence.treatment)}`;
      if (remaining.length === 1) return `Según tu pauta registrada, te queda una toma programada ${item(remaining[0])}.${tail}`;
      return `Según tu pauta registrada, te quedan ${remaining.length} tomas ${periodText}: ${listJoin(remaining.map(item))}.${tail}`;
    }
    case 'next_dose': {
      const pendingNow = todays.find((v) => v.status === 'pending');
      const horizon = new Date(now.getTime() + 8 * DAY_MS);
      const upcoming = doseViews(occurrencesBetween(treatments, new Date(now.getTime() + 1), horizon, zone), ctx.events, now).find(
        (v) => v.status === 'later',
      );
      const pendingText = pendingNow
        ? `Ahora tienes pendiente la toma de las ${pendingNow.occurrence.time} (${doseLabel(pendingNow.occurrence.treatment)}), todavía sin confirmar. `
        : '';
      if (!upcoming) return `${pendingText}No tienes ninguna otra toma programada en los próximos días según tu pauta registrada.`.trim();
      const day = dayPhrase(upcoming.occurrence.date, today);
      const when = day === 'hoy' ? `a las ${upcoming.occurrence.time}` : `${day} a las ${upcoming.occurrence.time}`;
      return `${pendingText}Tu ${pendingNow ? 'siguiente' : 'próxima'} toma registrada está programada ${when}: ${doseLabel(upcoming.occurrence.treatment)}.`;
    }
    case 'today_plan': {
      const scope = todays.filter((v) => inPeriod(v.occurrence, match.period, zone));
      if (!scope.length) return `Según tu pauta registrada, no tienes ninguna toma programada ${periodText}.`;
      const word: Record<DoseStatus, string> = {
        taken: 'confirmada',
        skipped: 'no tomada',
        pending: 'pendiente',
        later: 'más tarde',
        unconfirmed: 'sin confirmar',
      };
      const items = scope.map((v) => `a las ${v.occurrence.time}, ${doseLabel(v.occurrence.treatment)} (${word[v.status]})`);
      return `Según tu pauta registrada, ${periodText} tienes ${scope.length === 1 ? 'una toma' : `${scope.length} tomas`}: ${listJoin(items)}.${correctedNote(scope)}`;
    }
  }
}

/** Resumen breve y sin registros de la pauta (para el contexto del asistente cuando se pregunta por «mis pastillas»). */
export function planContextLines(treatments: Treatment[]): string[] {
  return treatments
    .filter((t) => t.active)
    .slice(0, 15)
    .map((t) => `- ${doseLabel(t)}: ${frequencyLabel(t)} a las ${normalizeTimes(t.times).join(', ')}${t.endDate ? ` (hasta el ${t.endDate})` : ''}`);
}

export function wantsPlanContext(text: string): boolean {
  const q = normalizeQuestion(text);
  return /\b(mis (pastillas|medicinas|medicamentos)|mi (medicacion|tratamiento|pauta)|lo que tomo|las que tomo|con (las|lo) que (ya )?tomo)\b/.test(q);
}
