/**
 * «Mis pastillas» — avisos locales: qué se programa, repeticiones, aplazamientos, confirmaciones que cancelan,
 * pautas temporales y semanales, cambio de hora, límite de iOS y sincronización con lo ya programado.
 */
import { intlZone, type DoseEvent, type Treatment } from '../../domain/medication';
import { DEFAULT_REMINDER_SETTINGS } from '../pills/planStore';
import { MAX_SCHEDULED, planReminders, reminderId, syncScheduled, type ReminderAdapter } from '../pills/reminderPlan';

const ZONE = intlZone('Europe/Madrid');
const NOW = new Date('2026-10-09T15:00:00Z'); // viernes 9, 17:00 en Madrid

function treatment(o: Partial<Treatment> = {}): Treatment {
  return {
    id: 'met', medicineId: '71269', name: 'Metformina', strength: '850 mg', doseAmount: 1, doseUnit: 'comprimido', frequency: 'daily',
    daysOfWeek: null, intervalDays: null, times: ['15:45', '21:00'], startDate: '2026-10-01', endDate: null, instructions: null, notes: null,
    remindersEnabled: true, active: true, prescriptionConfirmed: true, version: 1, timezone: 'Europe/Madrid', ...o,
  };
}

const taken = (date: string, time: string): DoseEvent => ({
  id: `e-${date}-${time}`, treatmentId: 'met', occurrenceDate: date, scheduledTime: time, kind: 'taken', status: 'active',
  takenAt: '2026-10-09T13:49:00Z', clientRecordedAt: '2026-10-09T13:49:00Z', recordedByRole: 'patient', doseAmount: 1,
  doseUnit: 'comprimido', medicineName: 'Metformina 850 mg', possibleDuplicate: false,
});

const plan = (o: Partial<Parameters<typeof planReminders>[0]> = {}) =>
  planReminders({ treatments: [treatment()], events: [], settings: DEFAULT_REMINDER_SETTINGS, snoozes: [], now: NOW, zone: ZONE, ...o });

describe('Mis pastillas · avisos', () => {
  it('aviso a la hora y repetición si sigue sin confirmar; textos del aviso sin el nombre del medicamento', () => {
    const list = plan({ horizonDays: 1 });
    expect(list.slice(0, 4).map((r) => [r.kind, ZONE.parts(r.at).date, ZONE.parts(r.at).time])).toEqual([
      ['main', '2026-10-09', '21:00'],
      ['repeat', '2026-10-09', '21:30'],
      ['main', '2026-10-10', '15:45'],
      ['repeat', '2026-10-10', '16:15'],
    ]);
    expect(list[0]).toMatchObject({ title: 'MediClaro', body: 'Son las 21:00. Es la hora de tu medicamento.', sound: true });
    expect(list[1].body).toBe('Recordatorio: la toma de las 21:00 está sin confirmar.');
    expect(list[0].id).toBe(reminderId('met', '2026-10-09', '21:00', 'main'));
  });

  it('una toma pasada hace poco y sin confirmar conserva su repetición; una confirmada no avisa más', () => {
    const at1615 = new Date('2026-10-09T14:00:00Z'); // 16:00: la de las 15:45 repite a las 16:15
    expect(plan({ now: at1615, horizonDays: 0.3 }).map((r) => [r.kind, r.time])).toEqual([
      ['repeat', '15:45'],
      ['main', '21:00'],
      ['repeat', '21:00'],
    ]);
    expect(plan({ now: at1615, horizonDays: 0.3, events: [taken('2026-10-09', '15:45')] }).map((r) => r.time)).toEqual(['21:00', '21:00']);
  });

  it('«Recordármelo después» sustituye los avisos de esa toma por uno a la hora aplazada', () => {
    const list = plan({ horizonDays: 0.3, snoozes: [{ key: 'met|2026-10-09|21:00', until: '2026-10-09T19:10:00Z' }] });
    expect(list.map((r) => [r.kind, ZONE.parts(r.at).time])).toEqual([['snooze', '21:10']]);
    expect(list[0].body).toBe('Te lo recordamos: es la hora de tu medicamento de las 21:00.');
  });

  it('con el nombre en la pantalla bloqueada solo si se activa; sin sonido si se quita; nada si están desactivados', () => {
    expect(plan({ settings: { ...DEFAULT_REMINDER_SETTINGS, showMedicineName: true } })[0].body).toBe('Son las 21:00. Es la hora de Metformina 850 mg, 1 comprimido.');
    expect(plan({ settings: { ...DEFAULT_REMINDER_SETTINGS, sound: false } })[0].sound).toBe(false);
    expect(plan({ settings: { ...DEFAULT_REMINDER_SETTINGS, repeatAfterMinutes: 0 } }).every((r) => r.kind === 'main')).toBe(true);
    expect(plan({ settings: { ...DEFAULT_REMINDER_SETTINGS, enabled: false } })).toEqual([]);
    expect(plan({ treatments: [treatment({ remindersEnabled: false })] })).toEqual([]);
    expect(plan({ treatments: [treatment({ active: false })] })).toEqual([]);
  });

  it('tratamientos temporales y pautas semanales', () => {
    const temporary = plan({ treatments: [treatment({ endDate: '2026-10-10' })] });
    expect(new Set(temporary.map((r) => r.date))).toEqual(new Set(['2026-10-09', '2026-10-10']));
    const weekly = plan({ treatments: [treatment({ frequency: 'weekly', daysOfWeek: [1], times: ['09:00'] })], settings: { ...DEFAULT_REMINDER_SETTINGS, repeatAfterMinutes: 0 } });
    expect(weekly.map((r) => r.date)).toEqual(['2026-10-12']); // solo el lunes siguiente
  });

  it('cambio de hora: el aviso de las 02:30 del 28/03/2027 suena una vez, a las 03:30 (hora válida)', () => {
    const list = plan({
      treatments: [treatment({ times: ['02:30'] })],
      now: new Date('2027-03-27T12:00:00Z'),
      horizonDays: 1,
      settings: { ...DEFAULT_REMINDER_SETTINGS, repeatAfterMinutes: 0 },
    });
    expect(list).toHaveLength(1);
    expect(list[0].at.toISOString()).toBe('2027-03-28T01:30:00.000Z');
  });

  it('como mucho 60 avisos (iOS admite 64), los más próximos', () => {
    const many = plan({ treatments: [treatment({ times: ['06:00', '08:00', '10:00', '12:00', '14:00', '16:00', '18:00', '20:00'] })] });
    expect(many).toHaveLength(MAX_SCHEDULED);
    expect(many.every((r, i) => i === 0 || r.at.getTime() >= many[i - 1].at.getTime())).toBe(true);
  });

  it('sincronizar: programa lo que falta, cancela lo que sobra y no toca otros avisos de la app', async () => {
    const scheduled = new Set<string>(['otro-aviso-de-cuidador']);
    const adapter: ReminderAdapter = {
      scheduledIds: async () => [...scheduled],
      schedule: async (r) => void scheduled.add(r.id),
      cancel: async (id) => void scheduled.delete(id),
    };
    const first = plan({ horizonDays: 1 });
    expect(await syncScheduled(adapter, first)).toEqual({ scheduled: first.length, cancelled: 0 });
    expect(await syncScheduled(adapter, first)).toEqual({ scheduled: 0, cancelled: 0 });
    // Se confirma la de las 21:00: se cancelan su aviso y su repetición.
    const after = plan({ horizonDays: 1, events: [taken('2026-10-09', '21:00')] });
    expect(await syncScheduled(adapter, after)).toEqual({ scheduled: 0, cancelled: 2 });
    expect(scheduled.has('otro-aviso-de-cuidador')).toBe(true);
    expect([...scheduled].some((id) => id.startsWith(`${reminderId('met', '2026-10-09', '21:00', 'main')}#`))).toBe(false);
  });

  it('si cambia cómo es el aviso (nombre, sonido, repetición), los ya programados se vuelven a programar', async () => {
    const scheduled = new Map<string, { body: string; sound: boolean; at: string }>();
    const adapter: ReminderAdapter = {
      scheduledIds: async () => [...scheduled.keys()],
      schedule: async (r) => void scheduled.set(r.id, { body: r.body, sound: r.sound, at: r.at.toISOString() }),
      cancel: async (id) => void scheduled.delete(id),
    };
    // Avisos de la versión anterior (sin huella): se cancelan y se programan con la alarma nueva.
    scheduled.set(reminderId('met', '2026-10-09', '21:00', 'main'), { body: 'antiguo', sound: true, at: '' });
    const base = plan({ horizonDays: 1 });
    const first = await syncScheduled(adapter, base);
    expect(first).toEqual({ scheduled: base.length, cancelled: 1 });
    expect([...scheduled.values()].every((r) => r.body !== 'antiguo')).toBe(true);

    // «Mostrar el nombre del medicamento»: todos cambian de texto.
    const named = plan({ horizonDays: 1, settings: { ...DEFAULT_REMINDER_SETTINGS, showMedicineName: true } });
    expect(await syncScheduled(adapter, named)).toEqual({ scheduled: named.length, cancelled: base.length });
    expect([...scheduled.values()].every((r) => r.body.includes('Metformina'))).toBe(true);

    // Sin sonido: se reprograman sin sonido.
    const silent = plan({ horizonDays: 1, settings: { ...DEFAULT_REMINDER_SETTINGS, showMedicineName: true, sound: false } });
    await syncScheduled(adapter, silent);
    expect([...scheduled.values()].every((r) => r.sound === false)).toBe(true);

    // Repetición a los 15 min en lugar de 30: la repetición cambia de hora.
    const quick = plan({ horizonDays: 1, settings: { ...DEFAULT_REMINDER_SETTINGS, repeatAfterMinutes: 15 } });
    await syncScheduled(adapter, quick);
    const repeat = [...scheduled.entries()].find(([id]) => id.startsWith(`${reminderId('met', '2026-10-09', '21:00', 'repeat')}#`));
    expect(repeat && ZONE.parts(new Date(repeat[1].at)).time).toBe('21:15');
    // Nada cambia → nada se toca.
    expect(await syncScheduled(adapter, quick)).toEqual({ scheduled: 0, cancelled: 0 });
  });
});
