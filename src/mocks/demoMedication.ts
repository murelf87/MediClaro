/**
 * MODO DEMOSTRACIÓN / VISTA PREVIA — «Mis pastillas» simulado en memoria (datos de ejemplo, personas ficticias).
 *
 * Misma forma de datos y MISMAS reglas que las funciones reales medication_* (supabase/migrations/
 * 20261009120000_medication_plans.sql): idempotencia por identificador, segunda confirmación → toma adicional,
 * omitida y luego tomada → corrección con trazabilidad, correcciones que nunca borran, permisos del cuidador/a.
 * Los medicamentos de ejemplo son REALES de CIMA (con su foto). Nunca se incluye en las compilaciones de tienda
 * (lo importa solo demoBackend.ts).
 */
import { addDays, deviceZone, DOSE_UNITS, isScheduledOn, normalizeTimes, type DoseUnit, type Zone } from '../domain/medication';
import { DEMO_USER_ID } from './demoData';

type Row = Record<string, unknown>;
type Result = { data: unknown; error: { message: string } | null };

export interface DemoLinkView {
  id: string;
  patientId: string;
  caregiverId: string | null;
  patientName: string;
  caregiverName: string | null;
  accepted: boolean;
}

export interface DemoMedicationOptions {
  isPremium: () => boolean;
  /** Vínculos de cuidador/a del módulo de cuidadores (para los permisos). */
  links: () => DemoLinkView[];
  /** 'patient': la cuenta tiene su pauta; 'caregiver': cuida de `patientId`; 'empty': sin datos. */
  seed: 'patient' | 'caregiver' | 'empty';
  patientId?: string;
  now?: () => Date;
  zone?: Zone;
}

const ok = (data: unknown): Result => ({ data: JSON.parse(JSON.stringify(data ?? null)), error: null });
const fail = (code: string): Result => ({ data: null, error: { message: code } });

let seq = 0;
const uid = () => {
  seq += 1;
  const hex = (n: number, len: number) => n.toString(16).padStart(len, '0').slice(-len);
  return `d0d0${hex(Date.now() % 0xffff, 4)}-${hex(seq, 4)}-4${hex(Math.floor(Math.random() * 0xfff), 3)}-8${hex(Math.floor(Math.random() * 0xfff), 3)}-${hex(Math.floor(Math.random() * 0xffffffffffff), 12)}`;
};

interface TreatmentRow {
  id: string;
  userId: string;
  medicineId: string | null;
  name: string;
  strength: string | null;
  doseAmount: number;
  doseUnit: DoseUnit;
  frequency: 'daily' | 'weekly' | 'interval';
  daysOfWeek: number[] | null;
  intervalDays: number | null;
  times: string[];
  startDate: string;
  endDate: string | null;
  instructions: string | null;
  notes: string | null;
  remindersEnabled: boolean;
  active: boolean;
  prescriptionConfirmed: boolean;
  version: number;
  timezone: string;
  source: string;
  updatedAt: string;
  archivedAt: string | null;
  lastMutationId: string | null;
}

interface EventRow {
  id: string;
  userId: string;
  treatmentId: string;
  occurrenceDate: string | null;
  scheduledTime: string | null;
  kind: 'taken' | 'skipped' | 'extra';
  status: 'active' | 'voided';
  takenAt: string | null;
  clientRecordedAt: string;
  recordedAt: string;
  recordedBy: string;
  recordedByRole: 'patient' | 'caregiver';
  recordedByName: string | null;
  doseAmount: number;
  doseUnit: DoseUnit;
  medicineName: string;
  possibleDuplicate: boolean;
  correctsEventId: string | null;
  voidReason: string | null;
  note: string | null;
  source: string;
}

export function createDemoMedication(opts: DemoMedicationOptions) {
  const now = opts.now ?? (() => new Date());
  const zone = opts.zone ?? deviceZone();
  const me = DEMO_USER_ID;
  const treatments: TreatmentRow[] = [];
  const events: EventRow[] = [];
  const corrections: Row[] = [];
  const reminderEvents: Row[] = [];
  let settings: Row | null = null;
  const permissions = new Map<string, Row>();

  const owner = opts.seed === 'caregiver' ? opts.patientId ?? 'demo-patient' : me;
  const today = zone.parts(now()).date;

  // ─── Semilla: tres medicamentos reales con su foto, una semana de tomas y algún caso para enseñar ───────
  if (opts.seed !== 'empty') {
    const base = (o: Partial<TreatmentRow>): TreatmentRow => ({
      id: uid(), userId: owner, medicineId: null, name: '', strength: null, doseAmount: 1, doseUnit: 'comprimido', frequency: 'daily',
      daysOfWeek: null, intervalDays: null, times: [], startDate: addDays(today, -20), endDate: null, instructions: null, notes: null,
      remindersEnabled: true, active: true, prescriptionConfirmed: true, version: 1, timezone: zone.name, source: 'saved',
      updatedAt: now().toISOString(), archivedAt: null, lastMutationId: null, ...o,
    });
    treatments.push(
      base({ medicineId: '63710', name: 'Omeprazol Normon', strength: '20 mg', doseUnit: 'capsula', times: ['08:30'], instructions: 'En ayunas, antes del desayuno' }),
      base({ medicineId: '71269', name: 'Metformina Sandoz', strength: '850 mg', times: ['09:00', '21:00'], instructions: 'Durante o después de la comida', source: 'photo' }),
      base({ medicineId: '70039', name: 'Ibuprofeno Cinfa', strength: '600 mg', times: ['14:00'], startDate: addDays(today, -4), endDate: addDays(today, 3), instructions: 'Con comida. Tratamiento de una semana' }),
    );
    const at = (date: string, time: string, delayMin: number) => new Date(zone.instant(date, time).getTime() + delayMin * 60_000).toISOString();
    const caregiverName = opts.seed === 'caregiver' ? 'Javier Martín' : 'Javier';
    const push = (t: TreatmentRow, date: string, time: string, o: Partial<EventRow> = {}) => {
      const takenAt = at(date, time, 4 + ((date.charCodeAt(9) + time.charCodeAt(1)) % 9));
      events.push({
        id: uid(), userId: owner, treatmentId: t.id, occurrenceDate: date, scheduledTime: time, kind: 'taken', status: 'active', takenAt,
        clientRecordedAt: takenAt, recordedAt: takenAt, recordedBy: owner, recordedByRole: 'patient', recordedByName: null,
        doseAmount: t.doseAmount, doseUnit: t.doseUnit, medicineName: `${t.name} ${t.strength ?? ''}`.trim(), possibleDuplicate: false,
        correctsEventId: null, voidReason: null, note: null, source: 'reminder', ...o,
      });
    };
    const nowMs = now().getTime();
    for (let d = -6; d <= 0; d += 1) {
      const date = addDays(today, d);
      for (const t of treatments) {
        if (!isScheduledOn(t, date)) continue;
        for (const time of t.times) {
          const scheduled = zone.instant(date, time).getTime();
          // Hoy: solo las tomas de hace más de una hora (las recientes quedan «pendientes» para enseñarlas).
          if (scheduled > nowMs - 60 * 60_000) continue;
          if (d === -1 && t.medicineId === '71269' && time === '21:00') continue; // ayer por la noche: sin confirmar
          if (d === -2 && t.medicineId === '70039') {
            push(t, date, time, { recordedByRole: 'caregiver', recordedByName: caregiverName, recordedBy: 'demo-caregiver', source: 'caregiver' });
            continue;
          }
          push(t, date, time);
        }
      }
    }
    // Hace 3 días: una toma adicional de metformina (posible toma doble → incidencia).
    const metformina = treatments[1];
    const threeDays = addDays(today, -3);
    const confirmedThreeDays = events.find((e) => e.treatmentId === metformina.id && e.occurrenceDate === threeDays && e.scheduledTime === '09:00');
    if (confirmedThreeDays) {
      events.push({
        ...confirmedThreeDays,
        id: uid(), kind: 'extra', possibleDuplicate: true, takenAt: at(threeDays, '09:00', 75), clientRecordedAt: at(threeDays, '09:00', 76),
        note: 'Dudaba si la había tomado',
      });
    }
    // Hace 4 días: una corrección de hora (el registro original se conserva, anulado).
    const omeprazol = treatments[0];
    const fourDays = addDays(today, -4);
    const original = events.find((e) => e.treatmentId === omeprazol.id && e.occurrenceDate === fourDays);
    if (original) {
      original.status = 'voided';
      original.voidReason = 'Me la tomé antes de lo que puse';
      const replacement: EventRow = { ...original, id: uid(), status: 'active', voidReason: null, takenAt: at(fourDays, '08:30', -10), clientRecordedAt: at(fourDays, '10:00', 0), correctsEventId: original.id, source: 'late' };
      events.push(replacement);
      corrections.push({ id: uid(), eventId: original.id, replacementEventId: replacement.id, action: 'change_time', reason: original.voidReason, byRole: 'patient', createdAt: replacement.clientRecordedAt });
    }
    if (opts.seed === 'caregiver') {
      const link = opts.links().find((l) => l.patientId === owner && l.caregiverId === me && l.accepted);
      if (link) permissions.set(link.id, { canView: true, canConfirm: true, missedDoseAlerts: true, alertAfterMinutes: 60 });
    }
  }

  // ─── Ayudas ──────────────────────────────────────────────────────────────────────────────────────────
  const treatmentJson = (t: TreatmentRow) => ({
    id: t.id, medicineId: t.medicineId, name: t.name, strength: t.strength, doseAmount: t.doseAmount, doseUnit: t.doseUnit,
    frequency: t.frequency, daysOfWeek: t.daysOfWeek, intervalDays: t.intervalDays, times: t.times, startDate: t.startDate,
    endDate: t.endDate, instructions: t.instructions, notes: t.notes, remindersEnabled: t.remindersEnabled,
    active: t.active && !t.archivedAt, prescriptionConfirmed: t.prescriptionConfirmed, version: t.version,
    timezone: t.timezone, source: t.source, updatedAt: t.updatedAt, archivedAt: t.archivedAt,
  });
  const eventJson = (e: EventRow) => {
    const { userId: _u, recordedBy: _r, ...rest } = e;
    return rest;
  };
  const activeLink = (patientId: string, caregiverId: string) =>
    opts.links().find((l) => l.patientId === patientId && l.caregiverId === caregiverId && l.accepted) ?? null;
  const access = (patientId: string): 'owner' | 'view' | 'confirm' | null => {
    if (patientId === me) return 'owner';
    const link = activeLink(patientId, me);
    const p = link ? permissions.get(link.id) : undefined;
    if (!link || !p || p.canView !== true) return null;
    return p.canConfirm === true ? 'confirm' : 'view';
  };
  const premiumOf = (patientId: string) => (patientId === me ? opts.isPremium() : true);

  function getPlan(a: Row): Result {
    const target = typeof a.p_patient === 'string' && a.p_patient ? a.p_patient : me;
    const level = access(target);
    if (!level) return fail('NOT_ALLOWED');
    const from = typeof a.p_from === 'string' ? a.p_from : addDays(today, -35);
    const to = typeof a.p_to === 'string' ? a.p_to : addDays(today, 2);
    const mine = target === me;
    const perms = mine
      ? opts.links().filter((l) => l.patientId === me && l.accepted).map((l) => ({ linkId: l.id, caregiverName: l.caregiverName, canView: false, canConfirm: false, missedDoseAlerts: false, alertAfterMinutes: 60, ...permissions.get(l.id) }))
      : (() => {
          const link = activeLink(target, me)!;
          return [{ linkId: link.id, patientName: link.patientName, ...permissions.get(link.id) }];
        })();
    return ok({
      patientId: target,
      access: level,
      serverTime: now().toISOString(),
      treatments: treatments.filter((t) => t.userId === target).map(treatmentJson),
      events: events
        .filter((e) => e.userId === target)
        .filter((e) => {
          const day = e.occurrenceDate ?? (e.takenAt ?? '').slice(0, 10);
          return day >= from && day <= to;
        })
        .sort((x, y) => x.clientRecordedAt.localeCompare(y.clientRecordedAt))
        .map(eventJson),
      corrections: corrections.filter((c) => events.some((e) => e.id === c.eventId && e.userId === target)),
      reminderEvents: mine ? reminderEvents : [],
      settings: mine ? settings : null,
      permissions: perms,
    });
  }

  function saveTreatment(p: Row): Result {
    if (!premiumOf(me)) return fail('PREMIUM_REQUIRED');
    const id = String(p.id ?? '');
    const mutation = String(p.mutationId ?? '');
    if (!id || !mutation) return fail('INVALID_INPUT');
    const current = treatments.find((t) => t.id === id);
    if (current && current.userId !== me) return fail('NOT_ALLOWED');
    if (current && current.lastMutationId === mutation) return ok({ treatment: treatmentJson(current), replayed: true });
    if (current && p.expectedVersion != null && Number(p.expectedVersion) !== current.version) return ok({ conflict: true, treatment: treatmentJson(current) });
    if (p.prescriptionConfirmed !== true) return fail('PRESCRIPTION_NOT_CONFIRMED');
    const times = normalizeTimes(Array.isArray(p.times) ? p.times.map(String) : []);
    if (times.length === 0 || times.length > 8) return fail('INVALID_TIMES');
    const frequency = p.frequency === 'weekly' || p.frequency === 'interval' ? p.frequency : 'daily';
    if (frequency === 'weekly' && (!Array.isArray(p.daysOfWeek) || p.daysOfWeek.length === 0)) return fail('INVALID_DAYS');
    const archived = p.archived === true;
    const row: TreatmentRow = {
      id, userId: me, medicineId: typeof p.medicineId === 'string' ? p.medicineId : null, name: String(p.name ?? '').trim(),
      strength: typeof p.strength === 'string' && p.strength.trim() ? p.strength.trim() : null, doseAmount: Number(p.doseAmount ?? 1),
      doseUnit: (DOSE_UNITS as readonly string[]).includes(String(p.doseUnit)) ? (p.doseUnit as DoseUnit) : 'unidad', frequency, daysOfWeek: frequency === 'weekly' ? (p.daysOfWeek as number[]).map(Number) : null,
      intervalDays: frequency === 'interval' ? Number(p.intervalDays ?? 1) : null, times, startDate: String(p.startDate),
      endDate: typeof p.endDate === 'string' && p.endDate ? p.endDate : null, instructions: typeof p.instructions === 'string' && p.instructions.trim() ? p.instructions.trim() : null,
      notes: typeof p.notes === 'string' && p.notes.trim() ? p.notes.trim() : null, remindersEnabled: p.remindersEnabled !== false, active: !archived,
      prescriptionConfirmed: true, version: (current?.version ?? 0) + 1, timezone: String(p.timezone || zone.name),
      source: typeof p.source === 'string' ? p.source : 'manual', updatedAt: now().toISOString(), archivedAt: archived ? current?.archivedAt ?? now().toISOString() : null,
      lastMutationId: mutation,
    };
    if (current) Object.assign(current, row);
    else treatments.push(row);
    return ok({ treatment: treatmentJson(row) });
  }

  function recordDose(p: Row): Result {
    const id = String(p.id ?? '');
    if (!id) return fail('INVALID_INPUT');
    const existing = events.find((e) => e.id === id);
    if (existing) return ok({ event: eventJson(existing), replayed: true });
    const t = treatments.find((x) => x.id === p.treatmentId);
    if (!t) return fail('NOT_FOUND');
    const level = access(t.userId);
    if (level !== 'owner' && level !== 'confirm') return fail('NOT_ALLOWED');
    if (!premiumOf(t.userId)) return fail('PREMIUM_REQUIRED');
    const kindIn = p.kind === 'skipped' || p.kind === 'extra' ? p.kind : 'taken';
    const date = typeof p.occurrenceDate === 'string' ? p.occurrenceDate : null;
    const time = typeof p.scheduledTime === 'string' ? p.scheduledTime : null;
    const takenAt = typeof p.takenAt === 'string' ? p.takenAt : null;
    if (kindIn !== 'skipped') {
      if (!takenAt) return fail('TAKEN_AT_REQUIRED');
      const ms = Date.parse(takenAt);
      if (ms > now().getTime() + 10 * 60_000 || ms < now().getTime() - 7 * 86_400_000) return fail('INVALID_TAKEN_AT');
    }
    let kind: EventRow['kind'] = kindIn;
    let duplicate = kindIn === 'extra';
    let resolved: EventRow | undefined;
    if (date && time) {
      resolved = events.find((e) => e.treatmentId === t.id && e.occurrenceDate === date && e.scheduledTime === time && e.status === 'active' && (e.kind === 'taken' || e.kind === 'skipped'));
      if (resolved) {
        if (kindIn === 'skipped') return resolved.kind === 'skipped' ? ok({ event: eventJson(resolved), replayed: true }) : fail('ALREADY_TAKEN');
        if (resolved.kind === 'taken') {
          kind = 'extra';
          duplicate = true;
        } else {
          resolved.status = 'voided';
          resolved.voidReason = 'Se confirmó la toma después de marcarla como no tomada';
          corrections.push({ id: uid(), eventId: resolved.id, replacementEventId: id, action: 'void', reason: resolved.voidReason, byRole: level === 'owner' ? 'patient' : 'caregiver', createdAt: now().toISOString() });
        }
      }
    }
    const link = level === 'confirm' ? activeLink(t.userId, me) : null;
    const row: EventRow = {
      id, userId: t.userId, treatmentId: t.id, occurrenceDate: date, scheduledTime: time, kind, status: 'active',
      takenAt: kind === 'skipped' ? null : takenAt, clientRecordedAt: typeof p.clientRecordedAt === 'string' ? p.clientRecordedAt : now().toISOString(),
      recordedAt: now().toISOString(), recordedBy: me, recordedByRole: level === 'owner' ? 'patient' : 'caregiver',
      recordedByName: link?.caregiverName ?? null, doseAmount: t.doseAmount, doseUnit: t.doseUnit,
      medicineName: `${t.name} ${t.strength ?? ''}`.trim(), possibleDuplicate: duplicate, correctsEventId: null, voidReason: null,
      note: typeof p.note === 'string' && p.note.trim() ? p.note.trim() : null, source: level === 'owner' ? String(p.source ?? 'app') : 'caregiver',
    };
    events.push(row);
    return ok({ event: eventJson(row), possibleDuplicate: duplicate, existing: duplicate && resolved ? eventJson(resolved) : null });
  }

  function correctDose(p: Row): Result {
    const cid = String(p.id ?? '');
    if (!cid) return fail('INVALID_INPUT');
    if (corrections.some((c) => c.id === cid)) return ok({ correctionId: cid, replayed: true });
    const reason = String(p.reason ?? '').trim();
    if (reason.length < 3) return fail('REASON_REQUIRED');
    const e = events.find((x) => x.id === p.eventId);
    if (!e) return fail('NOT_FOUND');
    const level = access(e.userId);
    if (level !== 'owner' && level !== 'confirm') return fail('NOT_ALLOWED');
    if (level === 'confirm' && e.recordedBy !== me) return fail('NOT_ALLOWED');
    if (e.status !== 'active') return fail('ALREADY_CORRECTED');
    e.status = 'voided';
    e.voidReason = reason;
    let replacement: EventRow | null = null;
    if (p.action === 'change_time') {
      const newTaken = typeof p.newTakenAt === 'string' ? p.newTakenAt : null;
      if (!newTaken || e.kind === 'skipped') return fail('INVALID_TAKEN_AT');
      replacement = { ...e, id: typeof p.replacementId === 'string' ? p.replacementId : uid(), status: 'active', voidReason: null, takenAt: newTaken, clientRecordedAt: now().toISOString(), correctsEventId: e.id, recordedBy: me, source: 'late' };
      events.push(replacement);
    }
    corrections.push({ id: cid, eventId: e.id, replacementEventId: replacement?.id ?? null, action: p.action === 'change_time' ? 'change_time' : 'void', reason, byRole: level === 'owner' ? 'patient' : 'caregiver', createdAt: now().toISOString() });
    return ok({ correctionId: cid, voided: eventJson(e), replacement: replacement ? eventJson(replacement) : null });
  }

  return {
    rpc(name: string, args: unknown): Result {
      const a = (args ?? {}) as Row;
      const p = (a.p ?? {}) as Row;
      switch (name) {
        case 'medication_get_plan':
          return getPlan(a);
        case 'medication_save_treatment':
          return saveTreatment(p);
        case 'medication_record_dose':
          return recordDose(p);
        case 'medication_correct_dose':
          return correctDose(p);
        case 'medication_log_reminders': {
          const list = Array.isArray(a.p) ? (a.p as Row[]) : [];
          let saved = 0;
          for (const r of list) {
            if (reminderEvents.some((x) => x.id === r.id)) continue;
            if (!treatments.some((t) => t.id === r.treatmentId && t.userId === me)) continue;
            reminderEvents.push({ id: r.id, treatmentId: r.treatmentId, occurrenceDate: r.occurrenceDate, scheduledTime: r.scheduledTime, state: r.state, at: r.at ?? now().toISOString() });
            saved += 1;
          }
          return ok({ saved });
        }
        case 'medication_save_settings':
          settings = { repeat_after_minutes: 30, snooze_minutes: 10, sound: true, read_aloud: true, show_medicine_name: false, enabled: true, ...settings, ...toSnake(p) };
          return ok(settings);
        case 'medication_set_care_permissions': {
          const link = opts.links().find((l) => l.id === a.p_link);
          if (!link || link.patientId !== me) return fail('NOT_ALLOWED');
          if (!link.accepted) return fail('LINK_NOT_ACTIVE');
          const view = p.canView === true;
          const value = { canView: view, canConfirm: view && p.canConfirm === true, missedDoseAlerts: view && p.missedDoseAlerts === true, alertAfterMinutes: Number(p.alertAfterMinutes ?? 60) };
          permissions.set(link.id, value);
          return ok({ linkId: link.id, ...value });
        }
        case 'medication_delete_all': {
          const n = treatments.filter((t) => t.userId === me).length;
          for (let i = treatments.length - 1; i >= 0; i -= 1) if (treatments[i].userId === me) treatments.splice(i, 1);
          for (let i = events.length - 1; i >= 0; i -= 1) if (events[i].userId === me) events.splice(i, 1);
          reminderEvents.length = 0;
          settings = null;
          return ok({ deletedTreatments: n });
        }
        default:
          return fail('unknown rpc');
      }
    },
  };
}

function toSnake(p: Row): Row {
  const map: Record<string, string> = {
    repeatAfterMinutes: 'repeat_after_minutes',
    snoozeMinutes: 'snooze_minutes',
    readAloud: 'read_aloud',
    showMedicineName: 'show_medicine_name',
  };
  return Object.fromEntries(Object.entries(p).map(([k, v]) => [map[k] ?? k, v]));
}

export type DemoMedication = ReturnType<typeof createDemoMedication>;
