/**
 * «Mis pastillas» — datos de la app: pauta, tomas, correcciones, avisos y ajustes.
 *
 * El SERVIDOR es la fuente de verdad (funciones medication_* de Supabase). En el teléfono se guarda una copia CIFRADA
 * (llavero / Keystore, vía secureLocalStore) y una COLA de cambios pendientes para funcionar sin internet:
 *  - cada cambio lleva un identificador creado en el teléfono → reenviarlo nunca lo duplica (idempotencia);
 *  - se envían en orden al recuperar la conexión; después se vuelve a leer todo del servidor;
 *  - conflictos: una toma confirmada a la vez desde dos teléfonos se guarda como «toma adicional» (posible
 *    incidencia, nunca se pierde); un tratamiento cambiado desde otro teléfono con una versión anterior NO se pisa:
 *    gana el servidor y la app lo explica; una corrección de un registro ya corregido se descarta y se avisa.
 * Nunca se marca una toma como tomada automáticamente: solo la confirma la persona (o su cuidador/a autorizado).
 *
 * Fábrica sin dependencias de Expo para poder probarla (src/services/__tests__/pillsPlan.test.ts). La instancia real
 * está en src/services/MedicationPlanService.ts.
 */
import { AppError, toAppError } from '../../api/errors';
import {
  classifyNewDose,
  normalizeTimes,
  type DoseEvent,
  type DoseKind,
  type DoseUnit,
  type Frequency,
  type RecorderRole,
  type ReminderEvent,
  type ReminderState,
  type Treatment,
  type Zone,
} from '../../domain/medication';

// ─── Tipos ────────────────────────────────────────────────────────────────────────────────────────────────

export interface ReminderSettings {
  enabled: boolean;
  /** Repetir el aviso si no se confirma (minutos; 0 = no repetir). */
  repeatAfterMinutes: number;
  /** «Recordármelo después» (minutos). */
  snoozeMinutes: number;
  sound: boolean;
  /** Con la app abierta, leer el aviso en voz alta. */
  readAloud: boolean;
  /** Mostrar el nombre del medicamento en la pantalla bloqueada (por defecto no: es información de salud). */
  showMedicineName: boolean;
}

export const DEFAULT_REMINDER_SETTINGS: ReminderSettings = {
  enabled: true,
  repeatAfterMinutes: 30,
  snoozeMinutes: 10,
  sound: true,
  readAloud: true,
  showMedicineName: false,
};

export interface CarePermission {
  linkId: string;
  caregiverName: string | null;
  patientName: string | null;
  canView: boolean;
  canConfirm: boolean;
  missedDoseAlerts: boolean;
  alertAfterMinutes: number;
}

export interface DoseCorrection {
  id: string;
  eventId: string;
  replacementEventId: string | null;
  action: 'void' | 'change_time';
  reason: string;
  byRole: RecorderRole;
  createdAt: string;
}

export type PlanAccess = 'owner' | 'view' | 'confirm';

export interface PlanSnapshot {
  patientId: string;
  access: PlanAccess;
  treatments: Treatment[];
  events: DoseEvent[];
  corrections: DoseCorrection[];
  reminderEvents: ReminderEvent[];
  settings: ReminderSettings;
  permissions: CarePermission[];
  serverTime: string | null;
  fetchedAt: string | null;
}

export interface PlanState extends PlanSnapshot {
  /** La última lectura del servidor falló por falta de conexión: se muestra lo guardado en el teléfono. */
  offline: boolean;
  /** Cambios guardados en el teléfono que aún no han llegado al servidor. */
  pending: number;
  /** Mensaje para la persona (conflicto resuelto, cambio rechazado…). */
  notice: string | null;
}

export interface TreatmentInput {
  id?: string;
  medicineId: string | null;
  name: string;
  strength: string | null;
  doseAmount: number;
  doseUnit: DoseUnit;
  frequency: Frequency;
  daysOfWeek: number[] | null;
  intervalDays: number | null;
  times: string[];
  startDate: string;
  endDate: string | null;
  instructions: string | null;
  notes: string | null;
  remindersEnabled: boolean;
  prescriptionConfirmed: boolean;
  source: 'manual' | 'photo' | 'saved';
}

export interface RecordDoseInput {
  treatmentId: string;
  occurrenceDate: string | null;
  scheduledTime: string | null;
  kind: DoseKind;
  /** Hora real declarada (ISO). Por defecto, ahora. */
  takenAt?: string | null;
  source: 'reminder' | 'app' | 'late' | 'assistant';
  note?: string | null;
}

export interface CorrectDoseInput {
  eventId: string;
  action: 'void' | 'change_time';
  newTakenAt?: string | null;
  reason: string;
}

type Payload = Record<string, unknown>;

type Mutation =
  | { type: 'save_treatment'; id: string; at: string; payload: Payload }
  | { type: 'record_dose'; id: string; at: string; payload: Payload }
  | { type: 'correct_dose'; id: string; at: string; payload: Payload }
  | { type: 'log_reminders'; id: string; at: string; payload: Payload[] }
  | { type: 'save_settings'; id: string; at: string; payload: ReminderSettings };

interface Stored {
  snapshot: PlanSnapshot | null;
  outbox: Mutation[];
}

export interface RpcResult {
  data: unknown;
  error: { message?: string; code?: string; status?: number } | null;
}

export interface PlanDeps {
  rpc: (name: string, args: Payload) => PromiseLike<RpcResult>;
  store: {
    getJSON<T>(key: string, fallback: T): Promise<T>;
    setJSON(key: string, value: unknown): Promise<void>;
    remove(key: string): Promise<void>;
  };
  userId: () => Promise<string>;
  now: () => Date;
  uuid: () => string;
  zone: () => Zone;
}

// ─── Errores claros ───────────────────────────────────────────────────────────────────────────────────────

const SERVER_CODES: Record<string, { kind: AppError['kind']; message: string }> = {
  PREMIUM_REQUIRED: { kind: 'limit_reached', message: '«Mis pastillas» es una función de MediClaro Premium.' },
  NOT_ALLOWED: { kind: 'permission_denied', message: 'No tienes permiso para hacer esto.' },
  ALREADY_TAKEN: { kind: 'conflict', message: 'Esta toma ya figura como tomada. Si no es así, corrígela en el historial.' },
  ALREADY_CORRECTED: { kind: 'conflict', message: 'Este registro ya se había corregido.' },
  INVALID_TAKEN_AT: { kind: 'invalid_input', message: 'La hora de la toma no es válida: no puede ser futura ni de hace más de 7 días.' },
  INVALID_OCCURRENCE: { kind: 'invalid_input', message: 'Esa toma no se puede registrar (solo los últimos 7 días).' },
  PRESCRIPTION_NOT_CONFIRMED: { kind: 'invalid_input', message: 'Confirma que es la pauta que te indicó tu médico o farmacéutico.' },
  INVALID_TIMES: { kind: 'invalid_input', message: 'Revisa los horarios: entre 1 y 8 horas distintas.' },
  INVALID_DAYS: { kind: 'invalid_input', message: 'Elige al menos un día de la semana.' },
  INVALID_TIMEZONE: { kind: 'invalid_input', message: 'La zona horaria del teléfono no es válida.' },
  REASON_REQUIRED: { kind: 'invalid_input', message: 'Escribe brevemente el motivo de la corrección.' },
  LINK_NOT_ACTIVE: { kind: 'conflict', message: 'Esta vinculación con tu cuidador/a ya no está activa.' },
  RATE_LIMIT: { kind: 'rate_limited', message: 'Demasiados cambios seguidos. Espera un momento.' },
  NOT_FOUND: { kind: 'not_found', message: 'No hemos encontrado ese medicamento en tu pauta.' },
};

export function planError(error: { message?: string; code?: string; status?: number } | null | undefined): AppError {
  const message = String(error?.message ?? '');
  for (const [code, mapped] of Object.entries(SERVER_CODES)) {
    if (message.includes(code)) return new AppError(mapped.kind, mapped.message, { code });
  }
  if (/fetch|network|Failed to fetch|Network request failed|Load failed/i.test(message)) return new AppError('offline');
  return toAppError(error ?? new Error('unknown'));
}

const isNetwork = (e: AppError) => e.kind === 'offline' || e.kind === 'timeout' || e.kind === 'provider_down';

// ─── Lectura de la respuesta del servidor ─────────────────────────────────────────────────────────────────

function obj(v: unknown): Payload {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Payload) : {};
}
function list(v: unknown): Payload[] {
  return Array.isArray(v) ? v.map(obj) : [];
}
const str = (v: unknown): string | null => (typeof v === 'string' && v.length ? v : null);
const num = (v: unknown, fallback: number): number => (typeof v === 'number' && Number.isFinite(v) ? v : Number(v ?? fallback) || fallback);

function parseSettings(v: unknown): ReminderSettings {
  const s = obj(v);
  if (!Object.keys(s).length) return { ...DEFAULT_REMINDER_SETTINGS };
  return {
    enabled: s.enabled !== false,
    repeatAfterMinutes: num(s.repeat_after_minutes ?? s.repeatAfterMinutes, 30),
    snoozeMinutes: num(s.snooze_minutes ?? s.snoozeMinutes, 10),
    sound: s.sound !== false,
    readAloud: (s.read_aloud ?? s.readAloud) !== false,
    showMedicineName: (s.show_medicine_name ?? s.showMedicineName) === true,
  };
}

export function parseTreatment(v: unknown): Treatment {
  const t = obj(v);
  return {
    id: String(t.id),
    medicineId: str(t.medicineId),
    name: String(t.name ?? ''),
    strength: str(t.strength),
    doseAmount: num(t.doseAmount, 1),
    doseUnit: (str(t.doseUnit) ?? 'unidad') as DoseUnit,
    frequency: (t.frequency === 'weekly' || t.frequency === 'interval' ? t.frequency : 'daily') as Frequency,
    daysOfWeek: Array.isArray(t.daysOfWeek) ? t.daysOfWeek.map(Number) : null,
    intervalDays: t.intervalDays == null ? null : Number(t.intervalDays),
    times: normalizeTimes(Array.isArray(t.times) ? t.times.map(String) : []),
    startDate: String(t.startDate ?? ''),
    endDate: str(t.endDate),
    instructions: str(t.instructions),
    notes: str(t.notes),
    remindersEnabled: t.remindersEnabled !== false,
    active: t.active !== false,
    prescriptionConfirmed: t.prescriptionConfirmed === true,
    version: num(t.version, 1),
    timezone: str(t.timezone) ?? 'Europe/Madrid',
    updatedAt: str(t.updatedAt),
  };
}

export function parseEvent(v: unknown): DoseEvent {
  const e = obj(v);
  return {
    id: String(e.id),
    treatmentId: String(e.treatmentId),
    occurrenceDate: str(e.occurrenceDate),
    scheduledTime: str(e.scheduledTime)?.slice(0, 5) ?? null,
    kind: (e.kind === 'skipped' || e.kind === 'extra' ? e.kind : 'taken') as DoseKind,
    status: e.status === 'voided' ? 'voided' : 'active',
    takenAt: str(e.takenAt),
    clientRecordedAt: String(e.clientRecordedAt ?? e.recordedAt ?? new Date(0).toISOString()),
    recordedAt: str(e.recordedAt),
    recordedByRole: e.recordedByRole === 'caregiver' ? 'caregiver' : 'patient',
    recordedByName: str(e.recordedByName),
    doseAmount: num(e.doseAmount, 1),
    doseUnit: (str(e.doseUnit) ?? 'unidad') as DoseUnit,
    medicineName: String(e.medicineName ?? ''),
    possibleDuplicate: e.possibleDuplicate === true,
    correctsEventId: str(e.correctsEventId),
    voidReason: str(e.voidReason),
    note: str(e.note),
  };
}

export function parsePlan(v: unknown, fetchedAt: string): PlanSnapshot {
  const p = obj(v);
  const access = p.access === 'view' || p.access === 'confirm' ? p.access : 'owner';
  return {
    patientId: String(p.patientId ?? ''),
    access,
    treatments: list(p.treatments).map(parseTreatment),
    events: list(p.events).map(parseEvent),
    corrections: list(p.corrections).map((c) => ({
      id: String(c.id),
      eventId: String(c.eventId),
      replacementEventId: str(c.replacementEventId),
      action: c.action === 'change_time' ? 'change_time' : 'void',
      reason: String(c.reason ?? ''),
      byRole: c.byRole === 'caregiver' ? 'caregiver' : 'patient',
      createdAt: String(c.createdAt ?? fetchedAt),
    })),
    reminderEvents: list(p.reminderEvents).map((r) => ({
      id: String(r.id),
      treatmentId: String(r.treatmentId),
      occurrenceDate: String(r.occurrenceDate),
      scheduledTime: String(r.scheduledTime).slice(0, 5),
      state: (['delivered', 'opened', 'snoozed', 'not_yet'].includes(String(r.state)) ? r.state : 'opened') as ReminderState,
      at: String(r.at ?? fetchedAt),
    })),
    settings: parseSettings(p.settings),
    permissions: list(p.permissions).map((m) => ({
      linkId: String(m.linkId),
      caregiverName: str(m.caregiverName),
      patientName: str(m.patientName),
      canView: m.canView === true,
      canConfirm: m.canConfirm === true,
      missedDoseAlerts: m.missedDoseAlerts === true,
      alertAfterMinutes: num(m.alertAfterMinutes, 60),
    })),
    serverTime: str(p.serverTime),
    fetchedAt,
  };
}

function emptySnapshot(userId: string): PlanSnapshot {
  return {
    patientId: userId,
    access: 'owner',
    treatments: [],
    events: [],
    corrections: [],
    reminderEvents: [],
    settings: { ...DEFAULT_REMINDER_SETTINGS },
    permissions: [],
    serverTime: null,
    fetchedAt: null,
  };
}

// ─── Cambios optimistas (los mismos que hará el servidor) ─────────────────────────────────────────────────

function applyMutation(s: PlanSnapshot, m: Mutation): PlanSnapshot {
  switch (m.type) {
    case 'save_treatment': {
      const p = m.payload;
      const prev = s.treatments.find((t) => t.id === p.id);
      const next = parseTreatment({ ...p, active: p.archived !== true, version: (prev?.version ?? 0) + 1, updatedAt: m.at });
      return { ...s, treatments: prev ? s.treatments.map((t) => (t.id === next.id ? next : t)) : [...s.treatments, next] };
    }
    case 'record_dose': {
      const p = m.payload;
      if (s.events.some((e) => e.id === p.id)) return s;
      const treatmentId = String(p.treatmentId);
      const date = str(p.occurrenceDate);
      const time = str(p.scheduledTime);
      let events = s.events;
      let kind = p.kind as DoseKind;
      const resolved = date && time ? events.find((e) => e.status === 'active' && e.treatmentId === treatmentId && e.occurrenceDate === date && e.scheduledTime === time && (e.kind === 'taken' || e.kind === 'skipped')) : undefined;
      if (resolved?.kind === 'skipped' && kind === 'taken') {
        // Igual que el servidor: la omisión se anula con trazabilidad.
        events = events.map((e) => (e.id === resolved.id ? { ...e, status: 'voided', voidReason: 'Se confirmó la toma después de marcarla como no tomada' } : e));
      } else if (resolved?.kind === 'skipped' && kind === 'skipped') {
        return s;
      }
      const c = classifyNewDose(events, treatmentId, date, time, kind);
      kind = c.kind;
      const t = s.treatments.find((x) => x.id === treatmentId);
      const event: DoseEvent = {
        id: String(p.id),
        treatmentId,
        occurrenceDate: date,
        scheduledTime: time,
        kind,
        status: 'active',
        takenAt: kind === 'skipped' ? null : str(p.takenAt),
        clientRecordedAt: String(p.clientRecordedAt ?? m.at),
        recordedAt: null,
        recordedByRole: 'patient',
        recordedByName: null,
        doseAmount: t?.doseAmount ?? 1,
        doseUnit: t?.doseUnit ?? 'unidad',
        medicineName: t ? `${t.name}${t.strength ? ` ${t.strength}` : ''}` : '',
        possibleDuplicate: c.possibleDuplicate,
        note: str(p.note),
        pending: true,
      };
      return { ...s, events: [...events, event] };
    }
    case 'correct_dose': {
      const p = m.payload;
      const target = s.events.find((e) => e.id === p.eventId);
      if (!target || target.status !== 'active') return s;
      const events = s.events.map((e) => (e.id === target.id ? { ...e, status: 'voided' as const, voidReason: String(p.reason ?? '') } : e));
      if (p.action === 'change_time' && str(p.newTakenAt)) {
        events.push({ ...target, id: String(p.replacementId), status: 'active', takenAt: str(p.newTakenAt), clientRecordedAt: m.at, correctsEventId: target.id, pending: true });
      }
      return { ...s, events };
    }
    case 'log_reminders': {
      const known = new Set(s.reminderEvents.map((r) => r.id));
      const added = m.payload
        .filter((r) => !known.has(String(r.id)))
        .map((r) => ({
          id: String(r.id),
          treatmentId: String(r.treatmentId),
          occurrenceDate: String(r.occurrenceDate),
          scheduledTime: String(r.scheduledTime),
          state: r.state as ReminderState,
          at: String(r.at),
        }));
      return { ...s, reminderEvents: [...s.reminderEvents, ...added] };
    }
    case 'save_settings':
      return { ...s, settings: { ...m.payload } };
  }
}

// ─── Servicio ─────────────────────────────────────────────────────────────────────────────────────────────

export function createPlanService(deps: PlanDeps) {
  const key = (user: string) => `mediclaro.pills.v1.${user}`;
  let currentUser: string | null = null;
  let stored: Stored = { snapshot: null, outbox: [] };
  let state: PlanState | null = null;
  let flushing: Promise<boolean> | null = null;
  const listeners = new Set<(s: PlanState | null) => void>();

  const emit = () => listeners.forEach((l) => l(state));
  const persist = () => (currentUser ? deps.store.setJSON(key(currentUser), stored) : Promise.resolve());

  function rebuild(offline: boolean, notice: string | null = state?.notice ?? null): PlanState {
    const base = stored.snapshot ?? emptySnapshot(currentUser ?? '');
    const view = stored.outbox.reduce(applyMutation, base);
    state = { ...view, offline, pending: stored.outbox.length, notice };
    emit();
    return state;
  }

  async function ensureUser(): Promise<string> {
    const user = await deps.userId();
    if (user !== currentUser) {
      currentUser = user;
      stored = await deps.store.getJSON<Stored>(key(user), { snapshot: null, outbox: [] });
      if (!Array.isArray(stored.outbox)) stored = { snapshot: stored.snapshot ?? null, outbox: [] };
      state = null;
    }
    return user;
  }

  async function call(name: string, args: Payload): Promise<unknown> {
    let result: RpcResult;
    try {
      result = await deps.rpc(name, args);
    } catch (e) {
      throw planError({ message: e instanceof Error ? e.message : String(e) });
    }
    if (result.error) throw planError(result.error);
    return result.data;
  }

  function rpcFor(m: Mutation): { name: string; args: Payload } {
    switch (m.type) {
      case 'save_treatment':
        return { name: 'medication_save_treatment', args: { p: m.payload } };
      case 'record_dose':
        return { name: 'medication_record_dose', args: { p: m.payload } };
      case 'correct_dose':
        return { name: 'medication_correct_dose', args: { p: m.payload } };
      case 'log_reminders':
        return { name: 'medication_log_reminders', args: { p: m.payload } };
      case 'save_settings':
        return { name: 'medication_save_settings', args: { p: m.payload } };
    }
  }

  /** Envía la cola en orden. true = todo enviado; false = sin conexión (lo pendiente sigue guardado). */
  async function flushOutbox(): Promise<boolean> {
    if (flushing) return flushing;
    flushing = (async () => {
      let notice: string | null = null;
      while (stored.outbox.length) {
        const m = stored.outbox[0];
        const { name, args } = rpcFor(m);
        try {
          const data = obj(await call(name, args));
          if (m.type === 'save_treatment' && data.conflict === true) {
            const server = parseTreatment(data.treatment);
            notice = `«${server.name}» se había cambiado desde otro dispositivo: se ha guardado esa versión. Revísala si hace falta.`;
          }
        } catch (e) {
          const err = e instanceof AppError ? e : toAppError(e);
          if (isNetwork(err) || err.kind === 'rate_limited') {
            await persist();
            rebuild(true, notice ?? state?.notice ?? null);
            return false;
          }
          // Rechazado por el servidor (no por la red): se descarta y se explica; los datos del servidor mandan.
          notice = err.message;
        }
        stored.outbox.shift();
        await persist();
      }
      // Un aviso anterior sigue a la vista hasta que la persona lo cierra (clearNotice).
      rebuild(false, notice ?? state?.notice ?? null);
      return true;
    })().finally(() => {
      flushing = null;
    });
    return flushing;
  }

  async function enqueue(m: Mutation): Promise<void> {
    await ensureUser();
    stored.outbox.push(m);
    await persist();
    rebuild(state?.offline ?? false);
    // Se envía ya; si no hay conexión queda en la cola (la pantalla ya muestra el cambio).
    void flushOutbox().then((sent) => (sent ? refresh().catch(() => undefined) : undefined));
  }

  async function refresh(): Promise<PlanState> {
    await ensureUser();
    const sent = await flushOutbox();
    if (!sent) return rebuild(true);
    try {
      const now = deps.now();
      const from = new Date(now.getTime() - 35 * 86_400_000).toISOString().slice(0, 10);
      const to = new Date(now.getTime() + 2 * 86_400_000).toISOString().slice(0, 10);
      const data = await call('medication_get_plan', { p_patient: null, p_from: from, p_to: to });
      stored.snapshot = parsePlan(data, now.toISOString());
      await persist();
      return rebuild(false);
    } catch (e) {
      const err = e instanceof AppError ? e : toAppError(e);
      if (isNetwork(err)) return rebuild(true);
      throw err;
    }
  }

  return {
    /** Último estado conocido (null antes de cargar). */
    getState(): PlanState | null {
      return state;
    },

    subscribe(listener: (s: PlanState | null) => void): () => void {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },

    /** Lo guardado en este teléfono (al instante, también sin conexión). */
    async load(): Promise<PlanState> {
      await ensureUser();
      return state ?? rebuild(false);
    },

    /** Envía lo pendiente y vuelve a leer del servidor (fuente de verdad). */
    refresh,

    /** Intenta enviar lo pendiente (al volver la conexión o al abrir la app). */
    async sync(): Promise<boolean> {
      await ensureUser();
      const sent = await flushOutbox();
      if (sent) await refresh().catch(() => undefined);
      return sent;
    },

    clearNotice(): void {
      if (state) {
        state = { ...state, notice: null };
        emit();
      }
    },

    async saveTreatment(input: TreatmentInput): Promise<Treatment> {
      await ensureUser();
      const current = state?.treatments.find((t) => t.id === input.id);
      const id = input.id ?? deps.uuid();
      const payload: Payload = {
        ...input,
        id,
        name: input.name.trim(),
        strength: input.strength?.trim() || null,
        times: normalizeTimes(input.times),
        daysOfWeek: input.frequency === 'weekly' ? [...new Set(input.daysOfWeek ?? [])].sort() : null,
        intervalDays: input.frequency === 'interval' ? input.intervalDays : null,
        timezone: deps.zone().name,
        mutationId: deps.uuid(),
        expectedVersion: current ? current.version : null,
      };
      if (!input.prescriptionConfirmed) throw planError({ message: 'PRESCRIPTION_NOT_CONFIRMED' });
      if (!payload.name || (payload.times as string[]).length === 0) throw planError({ message: 'INVALID_TIMES' });
      await enqueue({ type: 'save_treatment', id: String(payload.mutationId), at: deps.now().toISOString(), payload });
      const saved = state?.treatments.find((t) => t.id === id);
      if (!saved) throw new AppError('unknown');
      return saved;
    },

    /** «Dejar de tomarlo»: se archiva (el historial se conserva) y deja de avisar. */
    async archiveTreatment(id: string): Promise<void> {
      await ensureUser();
      const t = state?.treatments.find((x) => x.id === id);
      if (!t) throw planError({ message: 'NOT_FOUND' });
      const payload: Payload = { ...t, archived: true, prescriptionConfirmed: true, source: 'manual', mutationId: deps.uuid(), expectedVersion: t.version };
      await enqueue({ type: 'save_treatment', id: String(payload.mutationId), at: deps.now().toISOString(), payload });
    },

    /** ¿Esa toma ya figura confirmada? (para avisar antes de registrar otra). */
    confirmedFor(treatmentId: string, date: string, time: string): DoseEvent | null {
      return classifyNewDose(state?.events ?? [], treatmentId, date, time, 'taken').existing;
    },

    async recordDose(input: RecordDoseInput): Promise<DoseEvent> {
      await ensureUser();
      const id = deps.uuid();
      const now = deps.now().toISOString();
      const payload: Payload = {
        id,
        treatmentId: input.treatmentId,
        occurrenceDate: input.occurrenceDate,
        scheduledTime: input.scheduledTime,
        kind: input.kind,
        takenAt: input.kind === 'skipped' ? null : input.takenAt ?? now,
        clientRecordedAt: now,
        source: input.source,
        note: input.note ?? null,
        timezone: deps.zone().name,
      };
      await enqueue({ type: 'record_dose', id, at: now, payload });
      const event = state?.events.find((e) => e.id === id);
      if (!event) throw new AppError('unknown');
      return event;
    },

    async correctDose(input: CorrectDoseInput): Promise<void> {
      await ensureUser();
      const target = state?.events.find((e) => e.id === input.eventId);
      if (!target || target.status !== 'active') throw planError({ message: 'ALREADY_CORRECTED' });
      if (input.reason.trim().length < 3) throw planError({ message: 'REASON_REQUIRED' });
      const id = deps.uuid();
      const payload: Payload = {
        id,
        eventId: input.eventId,
        action: input.action,
        newTakenAt: input.newTakenAt ?? null,
        reason: input.reason.trim(),
        replacementId: input.action === 'change_time' ? deps.uuid() : null,
      };
      await enqueue({ type: 'correct_dose', id, at: deps.now().toISOString(), payload });
    },

    /** Entregado / abierto / aplazado / «todavía no»: nunca cuenta como toma. */
    async logReminder(entry: { treatmentId: string; occurrenceDate: string; scheduledTime: string; state: ReminderState }): Promise<void> {
      const id = deps.uuid();
      await enqueue({ type: 'log_reminders', id, at: deps.now().toISOString(), payload: [{ id, ...entry, at: deps.now().toISOString() }] });
    },

    async saveSettings(patch: Partial<ReminderSettings>): Promise<ReminderSettings> {
      await ensureUser();
      const next = { ...(state?.settings ?? DEFAULT_REMINDER_SETTINGS), ...patch };
      await enqueue({ type: 'save_settings', id: deps.uuid(), at: deps.now().toISOString(), payload: next });
      return next;
    },

    /** Lo decide el paciente (requiere conexión). */
    async setCarePermissions(linkId: string, perms: Pick<CarePermission, 'canView' | 'canConfirm' | 'missedDoseAlerts' | 'alertAfterMinutes'>): Promise<void> {
      await ensureUser();
      await call('medication_set_care_permissions', { p_link: linkId, p: perms });
      await refresh();
    },

    /** Derecho de supresión: borra toda la medicación de la cuenta (requiere conexión). */
    async deleteAll(): Promise<void> {
      const user = await ensureUser();
      await call('medication_delete_all', {});
      stored = { snapshot: emptySnapshot(user), outbox: [] };
      await persist();
      rebuild(false, null);
    },

    /**
     * Portabilidad (RGPD): la medicación de la cuenta tal como la guarda el servidor (últimos 13 meses: el máximo
     * que devuelve medication_get_plan). Para «Descargar mis datos». Requiere conexión.
     */
    async exportForAccount(): Promise<unknown> {
      await ensureUser();
      const now = deps.now();
      const from = new Date(now.getTime() - 398 * 86_400_000).toISOString().slice(0, 10);
      const to = new Date(now.getTime() + 2 * 86_400_000).toISOString().slice(0, 10);
      return call('medication_get_plan', { p_from: from, p_to: to });
    },

    /** Al cerrar sesión o eliminar la cuenta: nada de salud se queda en el teléfono. */
    async forgetLocal(userId: string): Promise<void> {
      await deps.store.remove(key(userId));
      if (currentUser === userId) {
        currentUser = null;
        stored = { snapshot: null, outbox: [] };
        state = null;
        emit();
      }
    },

    // ── Cuidador/a autorizado (siempre con conexión: nada del familiar se guarda en este teléfono) ──

    async loadPatient(patientId: string): Promise<PlanSnapshot> {
      const now = deps.now();
      const from = new Date(now.getTime() - 14 * 86_400_000).toISOString().slice(0, 10);
      const to = new Date(now.getTime() + 2 * 86_400_000).toISOString().slice(0, 10);
      return parsePlan(await call('medication_get_plan', { p_patient: patientId, p_from: from, p_to: to }), now.toISOString());
    },

    async recordDoseForPatient(input: RecordDoseInput): Promise<{ event: DoseEvent; possibleDuplicate: boolean }> {
      const now = deps.now().toISOString();
      const data = obj(
        await call('medication_record_dose', {
          p: {
            id: deps.uuid(),
            treatmentId: input.treatmentId,
            occurrenceDate: input.occurrenceDate,
            scheduledTime: input.scheduledTime,
            kind: input.kind,
            takenAt: input.kind === 'skipped' ? null : input.takenAt ?? now,
            clientRecordedAt: now,
            source: 'caregiver',
            note: input.note ?? null,
            timezone: deps.zone().name,
          },
        }),
      );
      return { event: parseEvent(data.event), possibleDuplicate: data.possibleDuplicate === true };
    },
  };
}

export type PlanService = ReturnType<typeof createPlanService>;
