/**
 * «Mis pastillas» — núcleo común (supabase/functions/_shared/medicationCore.ts): calendario, zonas horarias y
 * cambios de hora, estados de cada toma, doble toma y respuestas del asistente basadas solo en datos reales.
 */
import {
  addDays,
  answerMedicationQuestion,
  classifyNewDose,
  deviceZone,
  detectMedicationIntent,
  doseViews,
  duplicateWarning,
  formatDose,
  frequencyLabel,
  intlZone,
  isIsoDate,
  isLateEntry,
  isScheduledOn,
  isoWeekday,
  nextDose,
  occurrencesBetween,
  occurrencesForDate,
  planContextLines,
  wantsPlanContext,
  type DoseEvent,
  type Treatment,
} from '../../../supabase/functions/_shared/medicationCore';

const MADRID = intlZone('Europe/Madrid');

function treatment(overrides: Partial<Treatment> = {}): Treatment {
  return {
    id: 't-metformina',
    medicineId: '71269',
    name: 'Metformina',
    strength: '850 mg',
    doseAmount: 1,
    doseUnit: 'comprimido',
    frequency: 'daily',
    daysOfWeek: null,
    intervalDays: null,
    times: ['15:45', '21:00'],
    startDate: '2026-10-01',
    endDate: null,
    instructions: 'Con la comida',
    notes: null,
    remindersEnabled: true,
    active: true,
    prescriptionConfirmed: true,
    version: 1,
    timezone: 'Europe/Madrid',
    ...overrides,
  };
}

let seq = 0;
function taken(t: Treatment, date: string, time: string, takenAtIso: string, overrides: Partial<DoseEvent> = {}): DoseEvent {
  seq += 1;
  return {
    id: `e${seq}`,
    treatmentId: t.id,
    occurrenceDate: date,
    scheduledTime: time,
    kind: 'taken',
    status: 'active',
    takenAt: takenAtIso,
    clientRecordedAt: takenAtIso,
    recordedByRole: 'patient',
    doseAmount: t.doseAmount,
    doseUnit: t.doseUnit,
    medicineName: t.name,
    possibleDuplicate: false,
    ...overrides,
  };
}

// 9 de octubre de 2026, 17:00 en Madrid (UTC+2).
const NOW = new Date('2026-10-09T15:00:00Z');

describe('calendario', () => {
  it('fechas válidas, sumas de días y días de la semana', () => {
    expect(isIsoDate('2026-02-29')).toBe(false);
    expect(isIsoDate('2028-02-29')).toBe(true);
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2027-03-01', -1)).toBe('2027-02-28');
    expect(isoWeekday('2026-10-09')).toBe(5); // viernes
    expect(isoWeekday('2026-10-11')).toBe(7); // domingo
  });

  it('pauta diaria, semanal, cada N días, con inicio y fin, y en pausa', () => {
    const daily = treatment();
    expect(isScheduledOn(daily, '2026-09-30')).toBe(false);
    expect(isScheduledOn(daily, '2026-10-01')).toBe(true);
    const weekly = treatment({ frequency: 'weekly', daysOfWeek: [1, 3, 5] });
    expect(['2026-10-05', '2026-10-06', '2026-10-07', '2026-10-09'].map((d) => isScheduledOn(weekly, d))).toEqual([true, false, true, true]);
    const every3 = treatment({ frequency: 'interval', intervalDays: 3 });
    expect(['2026-10-01', '2026-10-02', '2026-10-04', '2026-10-07'].map((d) => isScheduledOn(every3, d))).toEqual([true, false, true, true]);
    const temporary = treatment({ endDate: '2026-10-05' });
    expect(isScheduledOn(temporary, '2026-10-05')).toBe(true);
    expect(isScheduledOn(temporary, '2026-10-06')).toBe(false);
    expect(isScheduledOn(treatment({ active: false }), '2026-10-09')).toBe(false);
    expect(frequencyLabel(weekly)).toBe('lunes, miércoles y viernes');
    expect(frequencyLabel(every3)).toBe('cada 3 días');
  });
});

describe('zona horaria y cambios de hora', () => {
  it('hora normal en Madrid (verano UTC+2, invierno UTC+1) y en Canarias', () => {
    expect(MADRID.instant('2026-10-09', '08:00').toISOString()).toBe('2026-10-09T06:00:00.000Z');
    expect(MADRID.instant('2026-12-09', '08:00').toISOString()).toBe('2026-12-09T07:00:00.000Z');
    expect(intlZone('Atlantic/Canary').instant('2026-10-09', '08:00').toISOString()).toBe('2026-10-09T07:00:00.000Z');
  });

  it('primavera (28/03/2027, de 02:00 a 03:00): la hora que no existe pasa a la hora válida siguiente', () => {
    expect(MADRID.instant('2027-03-28', '01:30').toISOString()).toBe('2027-03-28T00:30:00.000Z');
    const gap = MADRID.instant('2027-03-28', '02:30');
    expect(gap.toISOString()).toBe('2027-03-28T01:30:00.000Z');
    expect(MADRID.parts(gap).time).toBe('03:30');
    expect(MADRID.instant('2027-03-28', '03:00').toISOString()).toBe('2027-03-28T01:00:00.000Z');
  });

  it('otoño (25/10/2026, las 02:00-03:00 se repiten): se avisa la primera vez, una sola vez', () => {
    expect(MADRID.instant('2026-10-25', '02:30').toISOString()).toBe('2026-10-25T00:30:00.000Z');
    expect(MADRID.instant('2026-10-25', '03:00').toISOString()).toBe('2026-10-25T02:00:00.000Z');
    const t = treatment({ times: ['02:30'] });
    const day = occurrencesBetween([t], new Date('2026-10-24T20:00:00Z'), new Date('2026-10-25T20:00:00Z'), MADRID);
    expect(day).toHaveLength(1);
  });

  it('el día del cambio de hora hay exactamente las tomas de la pauta (ni de más ni de menos)', () => {
    const t = treatment({ times: ['01:30', '02:30', '08:00', '21:00'] });
    for (const date of ['2027-03-28', '2026-10-25']) {
      const list = occurrencesForDate([t], date, MADRID);
      expect(list.map((o) => o.time)).toEqual(['01:30', '02:30', '08:00', '21:00']);
      // Siempre en orden y sin instantes repetidos.
      const instants = list.map((o) => o.at.getTime());
      expect(new Set(instants).size).toBe(4);
      expect([...instants].sort((a, b) => a - b)).toEqual(instants);
    }
  });

  it('otros países: Nueva York también salta de 02:00 a 03:00', () => {
    const ny = intlZone('America/New_York');
    expect(ny.instant('2027-03-14', '02:30').toISOString()).toBe('2027-03-14T07:30:00.000Z');
    expect(ny.parts(ny.instant('2027-03-14', '02:30')).time).toBe('03:30');
  });

  it('cambio de zona (viaje Madrid → Canarias): misma hora de reloj, otro instante', () => {
    const t = treatment({ times: ['08:00'] });
    const madrid = occurrencesForDate([t], '2026-10-09', MADRID)[0].at;
    const canary = occurrencesForDate([t], '2026-10-09', intlZone('Atlantic/Canary'))[0].at;
    expect(canary.getTime() - madrid.getTime()).toBe(60 * 60_000);
  });

  it('la zona del teléfono calcula igual que Intl, también en los cambios de hora (se ejecuta además con TZ=Europe/Madrid)', () => {
    const device = deviceZone();
    const reference = intlZone(device.name === 'local' ? 'UTC' : device.name);
    for (const [date, time] of [['2027-03-28', '02:30'], ['2027-03-28', '03:00'], ['2026-10-25', '02:30'], ['2026-10-25', '03:00'], ['2026-10-09', '08:00']]) {
      expect(device.instant(date, time).toISOString()).toBe(reference.instant(date, time).toISOString());
    }
  });

  it('zona del teléfono: ida y vuelta entre hora local e instante', () => {
    const z = deviceZone();
    const at = z.instant('2026-10-09', '15:45');
    expect(z.parts(at).date).toBe('2026-10-09');
    expect(z.parts(at).time).toBe('15:45');
  });
});

describe('estado de cada toma (nunca se marca nada como tomado solo)', () => {
  const t = treatment({ times: ['08:00', '15:45', '21:00'] });
  const occ = occurrencesForDate([t], '2026-10-09', MADRID);

  it('sin registros: pasada hace más de 2 h → sin confirmar (rojo); reciente → pendiente (naranja); futura → gris', () => {
    const views = doseViews(occ, [], NOW);
    expect(views.map((v) => [v.occurrence.time, v.status, v.color])).toEqual([
      ['08:00', 'unconfirmed', 'red'],
      ['15:45', 'pending', 'orange'],
      ['21:00', 'later', 'grey'],
    ]);
    expect(nextDose(views)?.occurrence.time).toBe('15:45');
  });

  it('confirmada (verde), omitida (rojo), toma adicional (rojo, incidencia) y corrección', () => {
    const events: DoseEvent[] = [
      taken(t, '2026-10-09', '08:00', '2026-10-09T06:10:00Z'),
      taken(t, '2026-10-09', '15:45', '2026-10-09T13:49:00Z'),
      taken(t, '2026-10-09', '15:45', '2026-10-09T14:30:00Z', { kind: 'extra', possibleDuplicate: true }),
      taken(t, '2026-10-09', '21:00', '2026-10-09T13:00:00Z', { status: 'voided', voidReason: 'Me equivoqué de toma' }),
    ];
    const views = doseViews(occ, events, NOW);
    expect(views.map((v) => [v.status, v.color, v.incident, v.corrected])).toEqual([
      ['taken', 'green', false, false],
      ['taken', 'red', true, false],
      ['later', 'grey', false, true],
    ]);
    const skipped = doseViews(occ, [taken(t, '2026-10-09', '08:00', '2026-10-09T06:10:00Z', { kind: 'skipped', takenAt: null })], NOW);
    expect([skipped[0].status, skipped[0].color]).toEqual(['skipped', 'red']);
  });

  it('una toma ya confirmada: la segunda confirmación se guarda como toma adicional con aviso', () => {
    const first = taken(t, '2026-10-09', '15:45', '2026-10-09T13:49:00Z');
    const c = classifyNewDose([first], t.id, '2026-10-09', '15:45', 'taken');
    expect(c).toEqual({ kind: 'extra', possibleDuplicate: true, existing: first });
    expect(duplicateWarning(c.existing, MADRID)).toBe('Atención: esta toma ya figura confirmada a las 15:49.');
    expect(classifyNewDose([first], t.id, '2026-10-09', '21:00', 'taken')).toEqual({ kind: 'taken', possibleDuplicate: false, existing: null });
    // Un registro anulado no cuenta como confirmación.
    expect(classifyNewDose([{ ...first, status: 'voided' }], t.id, '2026-10-09', '15:45', 'taken').kind).toBe('taken');
  });

  it('registro a posteriori: hora declarada distinta de la hora de confirmación', () => {
    const late = taken(t, '2026-10-09', '08:00', '2026-10-09T06:05:00Z', { clientRecordedAt: '2026-10-09T09:00:00Z' });
    expect(isLateEntry(late)).toBe(true);
    expect(isLateEntry(taken(t, '2026-10-09', '08:00', '2026-10-09T06:05:00Z'))).toBe(false);
  });
});

describe('textos de dosis', () => {
  it('formas sencillas y en singular/plural', () => {
    expect(formatDose(1, 'comprimido')).toBe('1 comprimido');
    expect(formatDose(2, 'capsula')).toBe('2 cápsulas');
    expect(formatDose(0.5, 'comprimido')).toBe('medio comprimido');
    expect(formatDose(1.5, 'comprimido')).toBe('1 comprimido y medio');
    expect(formatDose(0.5, 'ampolla')).toBe('media ampolla');
    expect(formatDose(5, 'ml')).toBe('5 ml');
    expect(formatDose(2.5, 'ml')).toBe('2,5 ml');
    expect(formatDose(0.25, 'sobre')).toBe('0,25 sobres');
  });
});

describe('preguntas al asistente sobre las tomas', () => {
  const t = treatment();
  const ctx = (events: DoseEvent[], extra: Partial<Parameters<typeof answerMedicationQuestion>[1]> = {}) => ({
    now: NOW,
    zone: MADRID,
    treatments: [t],
    events,
    ...extra,
  });
  const ask = (text: string, events: DoseEvent[] = [], extra = {}) => {
    const match = detectMedicationIntent(text, [t]);
    if (!match) throw new Error(`sin intención: ${text}`);
    return answerMedicationQuestion(match, ctx(events, extra));
  };
  const confirmed = taken(t, '2026-10-09', '15:45', '2026-10-09T13:49:00Z');

  it('reconoce las preguntas sobre sus tomas y deja las dudas generales para la IA', () => {
    const intent = (q: string) => detectMedicationIntent(q, [t])?.intent ?? null;
    expect(intent('Lucía, ¿me he tomado las pastillas de esta tarde?')).toBe('taken_check');
    expect(intent('¿Tomé ya la de la mañana?')).toBe('taken_check');
    expect(intent('¿Qué pastillas me quedan hoy?')).toBe('remaining_today');
    expect(intent('¿Cuándo me toca la próxima?')).toBe('next_dose');
    expect(intent('No recuerdo si me tomé la pastilla')).toBe('unsure_taken');
    expect(intent('¿Qué medicamentos tengo hoy?')).toBe('today_plan');
    expect(intent('¿Para qué sirve la metformina?')).toBeNull();
    expect(intent('¿Me puedo tomar la pastilla con leche?')).toBeNull();
    expect(intent('Hola, ¿qué tal?')).toBeNull();
    expect(detectMedicationIntent('¿Me he tomado la metformina?', [t])?.treatmentIds).toEqual([t.id]);
  });

  it('«¿Me he tomado las pastillas de esta tarde?» → confirmación con la hora real', () => {
    expect(ask('¿Me he tomado las pastillas de esta tarde?', [confirmed])).toBe(
      'Según tu historial, has confirmado que tomaste Metformina 850 mg a las 15:49.',
    );
  });

  it('confirmada por el cuidador/a: lo dice expresamente', () => {
    const byCaregiver = { ...confirmed, recordedByRole: 'caregiver' as const, recordedByName: 'Javier' };
    expect(ask('¿Me he tomado las pastillas de esta tarde?', [byCaregiver])).toBe(
      'Según tu historial, Javier confirmó que tomaste Metformina 850 mg a las 15:49.',
    );
  });

  it('«¿Qué pastillas me quedan hoy?» y «¿Cuándo me toca la próxima?»', () => {
    expect(ask('¿Qué pastillas me quedan hoy?', [confirmed])).toBe(
      'Según tu pauta registrada, te queda una toma programada a las 21:00: Metformina 850 mg, 1 comprimido.',
    );
    expect(ask('¿Cuándo me toca la próxima?', [confirmed])).toBe(
      'Tu próxima toma registrada está programada a las 21:00: Metformina 850 mg, 1 comprimido.',
    );
    // Ya pasadas las 21:00 → mañana.
    const late = ask('¿Cuándo me toca la próxima?', [confirmed, taken(t, '2026-10-09', '21:00', '2026-10-09T19:02:00Z')], {
      now: new Date('2026-10-09T20:00:00Z'),
    });
    expect(late).toBe('Tu próxima toma registrada está programada mañana a las 15:45: Metformina 850 mg, 1 comprimido.');
  });

  it('«No recuerdo si me tomé la pastilla» sin confirmación → prudencia, nunca repetir la dosis', () => {
    expect(ask('No recuerdo si me tomé la pastilla')).toBe(
      'No tengo una confirmación fiable de esa toma (Metformina 850 mg de las 15:45). Eso no significa que no la hayas tomado. Antes de repetir una dosis, consulta con tu farmacéutico o profesional sanitario.',
    );
    expect(ask('No recuerdo si me tomé la pastilla', [confirmed])).toContain('has confirmado que tomaste Metformina 850 mg a las 15:49');
  });

  it('omitida, toma adicional y registro corregido se distinguen', () => {
    const skipped = { ...confirmed, kind: 'skipped' as const, takenAt: null };
    expect(ask('¿Me he tomado las pastillas de esta tarde?', [skipped])).toBe(
      'Según tu historial, la toma de Metformina 850 mg de las 15:45 figura como no tomada.',
    );
    const extra = taken(t, '2026-10-09', '15:45', '2026-10-09T14:20:00Z', { kind: 'extra', possibleDuplicate: true });
    expect(ask('¿Me he tomado las pastillas de esta tarde?', [confirmed, extra])).toContain(
      'Además, figura una toma adicional de Metformina 850 mg a las 16:20',
    );
    const voided = { ...confirmed, id: 'old', status: 'voided' as const };
    const fixed = taken(t, '2026-10-09', '15:45', '2026-10-09T14:00:00Z', { correctsEventId: 'old' });
    expect(ask('¿Me he tomado las pastillas de esta tarde?', [voided, fixed])).toBe(
      'Según tu historial, has confirmado que tomaste Metformina 850 mg a las 16:00. (Alguno de estos registros se corrigió después.)',
    );
  });

  it('información insuficiente o sin pauta: lo dice, sin inventar', () => {
    expect(ask('¿Me he tomado las pastillas de esta mañana?')).toBe('Según tu pauta registrada, no tienes ninguna toma programada esta mañana.');
    const none = answerMedicationQuestion({ intent: 'next_dose', period: null, treatmentIds: null }, { ...ctx([]), treatments: [] });
    expect(none).toContain('Todavía no tienes ninguna pauta registrada');
  });

  it('ninguna respuesta indica tomar, repetir, cambiar o suspender una dosis', () => {
    const answers = [
      ask('¿Me he tomado las pastillas de esta tarde?'),
      ask('No recuerdo si me tomé la pastilla'),
      ask('¿Qué pastillas me quedan hoy?'),
      ask('¿Cuándo me toca la próxima?'),
      ask('¿Qué medicamentos tengo hoy?'),
    ];
    for (const a of answers) expect(a).not.toMatch(/\b(t[oó]mate|t[oó]mala|toma otra|tome otra|repite la dosis|duplica|deja de tomar|suspende)\b/i);
  });

  it('contexto breve de la pauta solo cuando se pregunta por «mis pastillas»', () => {
    expect(wantsPlanContext('¿Puedo tomar ibuprofeno con mis pastillas?')).toBe(true);
    expect(wantsPlanContext('¿Para qué sirve el ibuprofeno?')).toBe(false);
    expect(planContextLines([t])).toEqual(['- Metformina 850 mg, 1 comprimido: todos los días a las 15:45, 21:00']);
  });
});
