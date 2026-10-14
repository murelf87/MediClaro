/**
 * «Probar la emergencia completa»: el simulacro recorre el aviso entero con la otra persona simulada, sin red.
 */
import { isDrillIncident, startCareDrill } from '../careDrill';

const ME = 'user-1';
const timing = { received: 100, acknowledged: 300, reply: 200 };

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

test('como paciente: tu cuidador/a simulado abre el aviso, lo atiende, te escribe y contesta', () => {
  const drill = startCareDrill({ role: 'patient', me: ME, otherName: 'Javier', timing });
  const changes = jest.fn();
  drill.subscribe(changes);
  const incident = drill.incident();
  expect(isDrillIncident(incident.id)).toBe(true);
  expect(incident.patient_id).toBe(ME);
  expect(incident.state).toBe('active');
  // Nunca se comparte una ubicación en un simulacro.
  expect([incident.latitude, incident.longitude, incident.shareLocation]).toEqual([null, null, false]);

  jest.advanceTimersByTime(100);
  expect(drill.incident().members[0].receivedAt).not.toBeNull();
  expect(drill.incident().members[0].acknowledgedAt).toBeNull();

  jest.advanceTimersByTime(200);
  expect(drill.incident().members[0].acknowledgedAt).not.toBeNull();
  expect(drill.incident().messages.at(-1)?.content).toMatch(/^Soy Javier\. He visto tu aviso/);

  drill.message('Estoy mareada');
  expect(drill.incident().messages.at(-1)).toMatchObject({ sender_id: ME, content: 'Estoy mareada', response_due_at: null });
  jest.advanceTimersByTime(200);
  expect(drill.incident().messages.at(-1)?.content).toMatch(/voy para allá/);
  expect(changes).toHaveBeenCalled();
});

test('como cuidador/a: llega el aviso de tu familiar, lo atiendes y pides respuesta en 1 minuto', () => {
  const drill = startCareDrill({ role: 'caregiver', me: ME, otherName: 'María', timing });
  const incident = drill.incident();
  expect(incident.patient_id).not.toBe(ME);
  expect(incident.summary).toMatch(/María comunica/);
  expect(incident.messages).toHaveLength(1);

  drill.received();
  expect(drill.incident().members[0].receivedAt).not.toBeNull();
  drill.acknowledge();
  expect(drill.incident().members[0].acknowledgedAt).not.toBeNull();
  jest.advanceTimersByTime(200);
  expect(drill.incident().messages.at(-1)?.content).toMatch(/Gracias por atenderme/);

  drill.message('¿Puedes levantarte?', true);
  const asked = drill.incident().messages.at(-1)!;
  expect(asked.response_due_at).not.toBeNull();
  jest.advanceTimersByTime(200);
  const answered = drill.incident().messages.find((m) => m.id === asked.id)!;
  expect(answered.responded_at).not.toBeNull();
  expect(drill.incident().messages.at(-1)?.content).toMatch(/Ya estoy mejor/);
});

test('terminar el simulacro cancela lo pendiente y lo cierra', () => {
  const drill = startCareDrill({ role: 'patient', me: ME, otherName: 'Javier', timing });
  drill.stop();
  jest.advanceTimersByTime(1000);
  expect(drill.incident().state).toBe('closed');
  expect(drill.incident().messages).toHaveLength(0);
  drill.message('hola');
  expect(drill.incident().messages).toHaveLength(0);
});
