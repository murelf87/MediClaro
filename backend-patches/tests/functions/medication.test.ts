// «Mis pastillas» en el servidor: respuestas del asistente con la pauta y los registros REALES (tablas medication_*),
// sin IA, y aviso al cuidador sin datos de salud en la pantalla bloqueada. Sin red ni claves.
import assert from 'node:assert/strict';
import { admin } from './fakes/common.ts';
import { reset, state } from './fakes/state.ts';
import { medicationPlanContext, medicationReply } from '../original/_shared/medicationData.ts';
import { medicationAlertPushPayload } from '../original/_shared/caregiverPush.ts';

const USER = state.user.id;
const OTHER = '00000000-0000-4000-8000-0000000000ff';
// 9/10/2026 a las 17:00 en Madrid.
const NOW = new Date('2026-10-09T15:00:00Z');

function seed(events: Record<string, unknown>[] = []) {
  reset();
  state.tables.medication_treatments = [
    {
      id: 't1', user_id: USER, medicine_id: '71269', name: 'Metformina', strength: '850 mg', dose_amount: '1.00', dose_unit: 'comprimido',
      frequency: 'daily', days_of_week: null, interval_days: null, start_date: '2026-10-01', end_date: null, instructions: null, notes: null,
      reminders_enabled: true, active: true, prescription_confirmed: true, version: 1, timezone: 'Europe/Madrid',
      updated_at: '2026-10-01T10:00:00Z', archived_at: null,
    },
    // De otra persona: nunca debe aparecer.
    { id: 'tx', user_id: OTHER, name: 'Otro', dose_amount: 1, dose_unit: 'comprimido', frequency: 'daily', start_date: '2026-10-01', active: true, timezone: 'Europe/Madrid' },
  ];
  state.tables.medication_schedule_times = [
    { treatment_id: 't1', user_id: USER, local_time: '15:45:00' },
    { treatment_id: 't1', user_id: USER, local_time: '21:00:00' },
    { treatment_id: 'tx', user_id: OTHER, local_time: '16:00:00' },
  ];
  state.tables.medication_dose_events = events.map((e) => ({
    user_id: USER, treatment_id: 't1', status: 'active', recorded_by_role: 'patient', dose_amount: 1, dose_unit: 'comprimido',
    medicine_name: 'Metformina 850 mg', possible_duplicate: false, ...e,
  }));
}

const confirmed = { id: 'e1', occurrence_date: '2026-10-09', scheduled_time: '15:45:00', kind: 'taken', taken_at: '2026-10-09T13:49:00Z', client_recorded_at: '2026-10-09T13:49:10Z' };

Deno.test('Mis pastillas: las cuatro preguntas del guion, con datos reales', async () => {
  seed([confirmed]);
  assert.equal(await medicationReply(admin, USER, 'Lucía, ¿me he tomado las pastillas de esta tarde?', NOW),
    'Según tu historial, has confirmado que tomaste Metformina 850 mg a las 15:49.');
  assert.equal(await medicationReply(admin, USER, '¿Qué pastillas me quedan hoy?', NOW),
    'Según tu pauta registrada, te queda una toma programada a las 21:00: Metformina 850 mg, 1 comprimido.');
  assert.equal(await medicationReply(admin, USER, '¿Cuándo me toca la próxima?', NOW),
    'Tu próxima toma registrada está programada a las 21:00: Metformina 850 mg, 1 comprimido.');
  seed();
  assert.equal(await medicationReply(admin, USER, 'No recuerdo si me tomé la pastilla', NOW),
    'No tengo una confirmación fiable de esa toma (Metformina 850 mg de las 15:45). Eso no significa que no la hayas tomado. Antes de repetir una dosis, consulta con tu farmacéutico o profesional sanitario.');
});

Deno.test('Mis pastillas: solo lee los datos de la propia persona y solo cuando la pregunta es sobre sus tomas', async () => {
  seed([confirmed]);
  assert.equal(await medicationReply(admin, USER, '¿Para qué sirve la metformina?', NOW), null);
  assert.equal(state.calls.length, 0, 'una duda general no consulta la medicación');
  await medicationReply(admin, USER, '¿Qué pastillas me quedan hoy?', NOW);
  const reads = state.calls.filter((c) => c.table.startsWith('medication_'));
  assert.equal(reads.length, 3);
  assert.ok(reads.every((c) => c.filters.includes(`user_id=${USER}`)), 'siempre filtrado por la persona de la sesión');
  assert.ok(!(await medicationReply(admin, USER, '¿Qué pastillas me quedan hoy?', NOW))!.includes('Otro'));
});

Deno.test('Mis pastillas: confirmada por el cuidador/a y sin tablas desplegadas', async () => {
  seed([{ ...confirmed, recorded_by_role: 'caregiver', recorded_by_name: 'Javier' }]);
  assert.equal(await medicationReply(admin, USER, '¿Me he tomado la metformina esta tarde?', NOW),
    'Según tu historial, Javier confirmó que tomaste Metformina 850 mg a las 15:49.');
  seed();
  state.failNext['medication_treatments:select'] = { code: '42P01', message: 'relation does not exist' };
  assert.equal(await medicationReply(admin, USER, '¿Qué pastillas me quedan hoy?', NOW), null, 'sin datos fiables no se responde nada inventado');
});

Deno.test('Mis pastillas: contexto de la pauta para la IA solo con «mis pastillas» y aviso al cuidador sin el medicamento', async () => {
  seed([confirmed]);
  assert.equal(await medicationPlanContext(admin, USER, '¿Para qué sirve el ibuprofeno?'), '');
  const ctx = await medicationPlanContext(admin, USER, '¿Puedo tomar ibuprofeno con mis pastillas?');
  assert.match(ctx, /PAUTA REGISTRADA/);
  assert.match(ctx, /- Metformina 850 mg, 1 comprimido: todos los días a las 15:45, 21:00/);
  assert.doesNotMatch(ctx, /15:49/, 'el contexto no incluye registros de tomas');
  const push = medicationAlertPushPayload('ExponentPushToken[abcdefghijklmn]', 'María', '15:45');
  assert.equal(push.body, 'María no ha confirmado la toma de las 15:45. Abre MediClaro para verlo.');
  assert.doesNotMatch(JSON.stringify(push), /Metformina/);
});
