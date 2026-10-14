// «Mis pastillas» en el servidor: lee la pauta y los registros REALES de la persona (tablas medication_*, con el
// cliente de servicio y SIEMPRE filtrado por su id) y responde con el núcleo común (medicationCore.ts).
// Minimización: solo se consulta cuando la pregunta trata de sus tomas o de «mis pastillas», y solo los 3 últimos días.
// deno-lint-ignore-file no-explicit-any
import {
  answerMedicationQuestion,
  detectMedicationIntent,
  DOSE_UNITS,
  planContextLines,
  wantsPlanContext,
  zoneFor,
  type DoseEvent,
  type DoseUnit,
  type Treatment,
} from './medicationCore.ts';

export interface MedicationSnapshot {
  treatments: Treatment[];
  events: DoseEvent[];
  timezone: string;
}

const hm = (value: unknown) => (typeof value === 'string' ? value.slice(0, 5) : null);
const unit = (value: unknown): DoseUnit => ((DOSE_UNITS as readonly string[]).includes(String(value)) ? (value as DoseUnit) : 'unidad');

export function mapTreatment(row: any, times: string[]): Treatment {
  return {
    id: String(row.id),
    medicineId: row.medicine_id ?? null,
    name: String(row.name ?? ''),
    strength: row.strength ?? null,
    doseAmount: Number(row.dose_amount ?? 1),
    doseUnit: unit(row.dose_unit),
    frequency: row.frequency === 'weekly' || row.frequency === 'interval' ? row.frequency : 'daily',
    daysOfWeek: Array.isArray(row.days_of_week) ? row.days_of_week.map(Number) : null,
    intervalDays: row.interval_days == null ? null : Number(row.interval_days),
    times: [...times].sort(),
    startDate: String(row.start_date),
    endDate: row.end_date ?? null,
    instructions: row.instructions ?? null,
    notes: row.notes ?? null,
    remindersEnabled: row.reminders_enabled !== false,
    active: row.active !== false && !row.archived_at,
    prescriptionConfirmed: row.prescription_confirmed === true,
    version: Number(row.version ?? 1),
    timezone: String(row.timezone || 'Europe/Madrid'),
    updatedAt: row.updated_at ?? null,
  };
}

export function mapEvent(row: any): DoseEvent {
  return {
    id: String(row.id),
    treatmentId: String(row.treatment_id),
    occurrenceDate: row.occurrence_date ?? null,
    scheduledTime: hm(row.scheduled_time),
    kind: row.kind === 'skipped' || row.kind === 'extra' ? row.kind : 'taken',
    status: row.status === 'voided' ? 'voided' : 'active',
    takenAt: row.taken_at ?? null,
    clientRecordedAt: String(row.client_recorded_at),
    recordedAt: row.recorded_at ?? null,
    recordedByRole: row.recorded_by_role === 'caregiver' ? 'caregiver' : 'patient',
    recordedByName: row.recorded_by_name ?? null,
    doseAmount: Number(row.dose_amount ?? 1),
    doseUnit: unit(row.dose_unit),
    medicineName: String(row.medicine_name ?? ''),
    possibleDuplicate: row.possible_duplicate === true,
    correctsEventId: row.corrects_event_id ?? null,
    voidReason: row.void_reason ?? null,
    note: row.note ?? null,
  };
}

/** Pauta + tomas de los últimos 3 días. null si las tablas aún no existen o falla la lectura (nunca se inventa). */
export async function loadMedicationSnapshot(client: any, userId: string, now = new Date()): Promise<MedicationSnapshot | null> {
  const since = new Date(now.getTime() - 3 * 86_400_000).toISOString();
  const [treatments, times, events] = await Promise.all([
    client.from('medication_treatments').select('*').eq('user_id', userId),
    client.from('medication_schedule_times').select('treatment_id,local_time').eq('user_id', userId),
    client.from('medication_dose_events').select('*').eq('user_id', userId).gte('client_recorded_at', since),
  ]);
  if (treatments.error || times.error || events.error) return null;
  const byTreatment = new Map<string, string[]>();
  for (const t of times.data ?? []) {
    const list = byTreatment.get(String(t.treatment_id)) ?? [];
    const value = hm(t.local_time);
    if (value) list.push(value);
    byTreatment.set(String(t.treatment_id), list);
  }
  const plan = (treatments.data ?? []).map((row: any) => mapTreatment(row, byTreatment.get(String(row.id)) ?? []));
  const latest = plan
    .filter((t: Treatment) => t.active)
    .sort((a: Treatment, b: Treatment) => String(b.updatedAt ?? '').localeCompare(String(a.updatedAt ?? '')))[0];
  return { treatments: plan, events: (events.data ?? []).map(mapEvent), timezone: latest?.timezone ?? 'Europe/Madrid' };
}

/**
 * Respuesta exacta si la persona pregunta por SUS tomas («¿me he tomado…?», «¿qué me queda hoy?», «¿cuándo me
 * toca?», «no recuerdo si…»). null si no es una pregunta de ese tipo (la contesta la IA como siempre).
 */
export async function medicationReply(client: any, userId: string, text: string, now = new Date()): Promise<string | null> {
  const quick = detectMedicationIntent(text, []);
  // Sin intención clara ni el verbo «tomar», no se lee nada de la base de datos.
  if (!quick && !/\btom(e|é|o|ó|ado|aste|amos)\b/i.test(text)) return null;
  const snapshot = await loadMedicationSnapshot(client, userId, now);
  if (!snapshot) return null;
  const match = detectMedicationIntent(text, snapshot.treatments);
  if (!match) return null;
  return answerMedicationQuestion(match, {
    now,
    zone: zoneFor(snapshot.timezone),
    treatments: snapshot.treatments,
    events: snapshot.events,
  });
}

/** Contexto breve de la pauta (sin registros) cuando la pregunta habla de «mis pastillas»; '' si no procede. */
export async function medicationPlanContext(client: any, userId: string, text: string): Promise<string> {
  if (!wantsPlanContext(text)) return '';
  const snapshot = await loadMedicationSnapshot(client, userId).catch(() => null);
  if (!snapshot || !snapshot.treatments.some((t) => t.active)) return '';
  return (
    '\n\nPAUTA REGISTRADA EN «MIS PASTILLAS» (la confirmó la propia persona según lo que le indicó su médico o farmacéutico; ' +
    'úsala solo como referencia, no inventes otros datos y no propongas cambiarla):\n' +
    planContextLines(snapshot.treatments).join('\n')
  );
}
