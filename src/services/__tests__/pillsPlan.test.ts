/**
 * «Mis pastillas» en la app: copia cifrada + cola sin conexión, idempotencia, conflictos entre dos teléfonos,
 * dobles tomas, correcciones, avisos, Premium y cuidador/a. El «servidor» es el simulado de la demostración, que
 * aplica las mismas reglas que las funciones SQL (estas se prueban aparte en PostgreSQL: backend-patches/tests/sql).
 */
import { createPlanService, type PlanDeps, type RpcResult } from '../pills/planStore';
import { createDemoMedication, type DemoLinkView } from '../../mocks/demoMedication';
import { DEMO_USER_ID } from '../../mocks/demoData';
import { intlZone } from '../../domain/medication';

const ZONE = intlZone('Europe/Madrid');
const NOW = new Date('2026-10-09T15:00:00Z'); // 17:00 en Madrid
const TODAY = '2026-10-09';

function memoryStore() {
  const data = new Map<string, string>();
  return {
    data,
    async getJSON<T>(key: string, fallback: T): Promise<T> {
      const raw = data.get(key);
      return raw ? (JSON.parse(raw) as T) : fallback;
    },
    async setJSON(key: string, value: unknown) {
      data.set(key, JSON.stringify(value));
    },
    async remove(key: string) {
      data.delete(key);
    },
  };
}

function setup(opts: { premium?: boolean; links?: DemoLinkView[]; seed?: 'patient' | 'caregiver' | 'empty' } = {}) {
  const net = { online: true, loseNextResponse: false, calls: [] as string[] };
  let premium = opts.premium ?? true;
  const server = createDemoMedication({
    isPremium: () => premium,
    links: () => opts.links ?? [],
    seed: opts.seed ?? 'patient',
    patientId: 'patient-maria',
    now: () => NOW,
    zone: ZONE,
  });
  let n = 0;
  const makeDeps = (store = memoryStore()): PlanDeps & { store: ReturnType<typeof memoryStore> } => ({
    rpc: async (name, args): Promise<RpcResult> => {
      net.calls.push(name);
      if (!net.online) throw new TypeError('Network request failed');
      const result = server.rpc(name, args) as RpcResult;
      if (net.loseNextResponse) {
        net.loseNextResponse = false;
        throw new TypeError('Network request failed'); // el servidor lo guardó, pero la respuesta se perdió
      }
      return result;
    },
    store,
    userId: async () => DEMO_USER_ID,
    now: () => NOW,
    uuid: () => {
      n += 1;
      return `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
    },
    zone: () => ZONE,
  });
  return { net, server, makeDeps, setPremium: (v: boolean) => (premium = v) };
}

const serverEvents = async (server: ReturnType<typeof setup>['server']) =>
  ((server.rpc('medication_get_plan', {}).data as { events: unknown[] }).events ?? []).length;

describe('Mis pastillas · datos en el teléfono y en el servidor', () => {
  it('sin conexión: la toma se ve al momento, sobrevive a reiniciar la app y se envía una sola vez al volver', async () => {
    const { net, server, makeDeps } = setup();
    const deps = makeDeps();
    const service = createPlanService(deps);
    const initial = await service.refresh();
    const metformina = initial.treatments.find((t) => t.name === 'Metformina Sandoz')!;
    const before = await serverEvents(server);

    net.online = false;
    const event = await service.recordDose({ treatmentId: metformina.id, occurrenceDate: TODAY, scheduledTime: '09:00', kind: 'taken', source: 'reminder' });
    expect(event.pending).toBe(true);
    let state = service.getState()!;
    expect(state.pending).toBe(1);
    await new Promise((r) => setTimeout(r, 0));
    expect(service.getState()!.offline).toBe(true);

    // Se cierra la app: otra instancia con el mismo almacenamiento cifrado.
    const restarted = createPlanService({ ...deps });
    state = await restarted.load();
    expect(state.pending).toBe(1);
    expect(state.events.some((e) => e.id === event.id)).toBe(true);

    net.online = true;
    await restarted.sync();
    expect(restarted.getState()!.pending).toBe(0);
    expect(await serverEvents(server)).toBe(before + 1);
    await restarted.sync();
    expect(await serverEvents(server)).toBe(before + 1);
  });

  it('si se pierde la respuesta, reenviar no duplica la toma (idempotencia)', async () => {
    const { net, server, makeDeps } = setup();
    const service = createPlanService(makeDeps());
    const plan = await service.refresh();
    const omeprazol = plan.treatments.find((t) => t.name === 'Omeprazol Normon')!;
    const before = await serverEvents(server);
    net.loseNextResponse = true;
    await service.recordDose({ treatmentId: omeprazol.id, occurrenceDate: TODAY, scheduledTime: '08:30', kind: 'taken', source: 'app' });
    await new Promise((r) => setTimeout(r, 0));
    await service.sync();
    expect(await serverEvents(server)).toBe(before + 1);
  });

  it('doble toma: la segunda confirmación de la misma toma queda como toma adicional (posible incidencia)', async () => {
    const { makeDeps } = setup();
    const service = createPlanService(makeDeps());
    const plan = await service.refresh();
    const metformina = plan.treatments.find((t) => t.name === 'Metformina Sandoz')!;
    // La de las 09:00 de hoy ya está confirmada en la semilla (hace más de una hora).
    expect(service.confirmedFor(metformina.id, TODAY, '09:00')).not.toBeNull();
    const second = await service.recordDose({ treatmentId: metformina.id, occurrenceDate: TODAY, scheduledTime: '09:00', kind: 'taken', source: 'app' });
    expect(second.kind).toBe('extra');
    expect(second.possibleDuplicate).toBe(true);
    await service.sync();
    const saved = service.getState()!.events.find((e) => e.id === second.id)!;
    expect([saved.kind, saved.possibleDuplicate, saved.pending ?? false]).toEqual(['extra', true, false]);
  });

  it('dos teléfonos editan la misma pauta: el cambio con versión antigua no pisa el otro y se explica', async () => {
    const { makeDeps } = setup();
    const phoneA = createPlanService(makeDeps());
    const phoneB = createPlanService(makeDeps());
    const a = await phoneA.refresh();
    await phoneB.refresh();
    const t = a.treatments[0];
    const input = { ...t, prescriptionConfirmed: true, source: 'manual' as const };
    await phoneA.saveTreatment({ ...input, notes: 'Cambio del teléfono A' });
    await phoneA.sync();
    await phoneB.saveTreatment({ ...input, notes: 'Cambio del teléfono B' });
    await phoneB.sync();
    const b = phoneB.getState()!;
    expect(b.treatments.find((x) => x.id === t.id)!.notes).toBe('Cambio del teléfono A');
    expect(b.notice).toContain('se había cambiado desde otro dispositivo');
  });

  it('corregir nunca borra: el original queda anulado con su motivo y la nueva hora se registra aparte', async () => {
    const { makeDeps } = setup();
    const service = createPlanService(makeDeps());
    const plan = await service.refresh();
    const target = plan.events.find((e) => e.status === 'active' && e.kind === 'taken' && e.occurrenceDate === TODAY)!;
    await service.correctDose({ eventId: target.id, action: 'change_time', newTakenAt: '2026-10-09T06:40:00Z', reason: 'Me la tomé antes' });
    await service.sync();
    const state = service.getState()!;
    expect(state.events.find((e) => e.id === target.id)).toMatchObject({ status: 'voided', voidReason: 'Me la tomé antes' });
    expect(state.events.find((e) => e.correctsEventId === target.id)).toMatchObject({ status: 'active', takenAt: '2026-10-09T06:40:00Z' });
    expect(state.corrections.some((c) => c.eventId === target.id && c.reason === 'Me la tomé antes')).toBe(true);
    await expect(service.correctDose({ eventId: target.id, action: 'void', reason: 'Otra vez' })).rejects.toThrow('ya se había corregido');
  });

  it('omitida y luego tomada: la omisión se anula con trazabilidad (no hay dos resultados para la misma toma)', async () => {
    const { makeDeps } = setup();
    const service = createPlanService(makeDeps());
    const plan = await service.refresh();
    const metformina = plan.treatments.find((t) => t.name === 'Metformina Sandoz')!;
    const skipped = await service.recordDose({ treatmentId: metformina.id, occurrenceDate: TODAY, scheduledTime: '21:00', kind: 'skipped', source: 'app' });
    await service.recordDose({ treatmentId: metformina.id, occurrenceDate: TODAY, scheduledTime: '21:00', kind: 'taken', source: 'app' });
    await service.sync();
    const state = service.getState()!;
    expect(state.events.find((e) => e.id === skipped.id)!.status).toBe('voided');
    const active = state.events.filter((e) => e.status === 'active' && e.occurrenceDate === TODAY && e.scheduledTime === '21:00' && e.treatmentId === metformina.id);
    expect(active.map((e) => e.kind)).toEqual(['taken']);
  });

  it('avisos y ajustes: el estado del aviso se guarda (no es una toma) y los ajustes se sincronizan', async () => {
    const { makeDeps } = setup();
    const service = createPlanService(makeDeps());
    const plan = await service.refresh();
    const takenBefore = plan.events.length;
    await service.logReminder({ treatmentId: plan.treatments[0].id, occurrenceDate: TODAY, scheduledTime: '08:30', state: 'opened' });
    await service.saveSettings({ repeatAfterMinutes: 15, showMedicineName: true });
    await service.sync();
    const state = service.getState()!;
    expect(state.reminderEvents.map((r) => r.state)).toEqual(['opened']);
    expect(state.events.length).toBe(takenBefore);
    expect(state.settings).toMatchObject({ repeatAfterMinutes: 15, showMedicineName: true, snoozeMinutes: 10 });
  });

  it('sin Premium: el servidor rechaza la pauta y la app lo explica (no se queda un cambio fantasma)', async () => {
    const { makeDeps, setPremium } = setup({ seed: 'empty' });
    setPremium(false);
    const service = createPlanService(makeDeps());
    await service.refresh();
    await service.saveTreatment({
      medicineId: null, name: 'Atorvastatina', strength: '20 mg', doseAmount: 1, doseUnit: 'comprimido', frequency: 'daily', daysOfWeek: null,
      intervalDays: null, times: ['22:00'], startDate: TODAY, endDate: null, instructions: null, notes: null, remindersEnabled: true,
      prescriptionConfirmed: true, source: 'manual',
    });
    await service.sync();
    const state = service.getState()!;
    expect(state.treatments).toHaveLength(0);
    expect(state.notice).toBe('«Mis pastillas» es una función de MediClaro Premium.');
  });

  it('la pauta exige confirmar que la indicó un profesional', async () => {
    const { makeDeps } = setup({ seed: 'empty' });
    const service = createPlanService(makeDeps());
    await service.refresh();
    await expect(
      service.saveTreatment({
        medicineId: '71269', name: 'Metformina', strength: '850 mg', doseAmount: 1, doseUnit: 'comprimido', frequency: 'daily', daysOfWeek: null,
        intervalDays: null, times: ['09:00'], startDate: TODAY, endDate: null, instructions: null, notes: null, remindersEnabled: true,
        prescriptionConfirmed: false, source: 'photo',
      }),
    ).rejects.toThrow('Confirma que es la pauta');
  });

  it('cuidador/a: ve y confirma solo con permiso del paciente, y queda registrado quién confirmó', async () => {
    const links: DemoLinkView[] = [{ id: 'link-1', patientId: 'patient-maria', caregiverId: DEMO_USER_ID, patientName: 'María', caregiverName: 'Javier', accepted: true }];
    const { makeDeps } = setup({ seed: 'caregiver', links });
    const service = createPlanService(makeDeps());
    const plan = await service.loadPatient('patient-maria');
    expect(plan.access).toBe('confirm');
    expect(plan.treatments).toHaveLength(3);
    const metformina = plan.treatments.find((t) => t.name === 'Metformina Sandoz')!;
    const r = await service.recordDoseForPatient({ treatmentId: metformina.id, occurrenceDate: TODAY, scheduledTime: '21:00', kind: 'taken', source: 'app' });
    expect(r.event).toMatchObject({ recordedByRole: 'caregiver', recordedByName: 'Javier', kind: 'taken' });
    await expect(service.loadPatient('otra-persona')).rejects.toThrow('No tienes permiso');
  });

  it('al cerrar sesión no queda nada de salud en el teléfono', async () => {
    const { makeDeps } = setup();
    const deps = makeDeps();
    const service = createPlanService(deps);
    await service.refresh();
    expect(deps.store.data.size).toBe(1);
    await service.forgetLocal(DEMO_USER_ID);
    expect(deps.store.data.size).toBe(0);
  });

  it('«Descargar mis datos» incluye la medicación de la cuenta (portabilidad), con un periodo que el servidor acepta', async () => {
    const { net, makeDeps } = setup();
    const deps = makeDeps();
    const calls: Array<Record<string, unknown>> = [];
    const rpc = deps.rpc;
    deps.rpc = async (name, args) => {
      if (name === 'medication_get_plan') calls.push(args as Record<string, unknown>);
      return rpc(name, args);
    };
    const service = createPlanService(deps);
    const exported = (await service.exportForAccount()) as { treatments: Array<{ name: string }>; events: unknown[] };
    expect(exported.treatments.map((t) => t.name)).toContain('Metformina Sandoz');
    expect(exported.events.length).toBeGreaterThan(0);
    const { p_from: from, p_to: to } = calls[0] as { p_from: string; p_to: string };
    const days = (Date.parse(to) - Date.parse(from)) / 86_400_000;
    expect(days).toBeLessThanOrEqual(400); // límite de medication_get_plan
    expect(days).toBeGreaterThan(365);
    net.online = false;
    await expect(service.exportForAccount()).rejects.toBeTruthy();
  });
});
