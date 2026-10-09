/**
 * Cuidador/a en el Modo demostración: el flujo completo funciona con un solo teléfono y con la misma forma de
 * datos que el servidor real (código de 6 números, solicitud, aceptar, aviso con chat, chat del día a día con
 * «Visto», desvincular).
 */
import { createDemoCare } from '../demoCare';
import { DEMO_USER_ID } from '../demoData';

const timing = { accept: 10, received: 10, acknowledged: 20, reply: 10, incoming: 30, chatRead: 10, chatReply: 20, callAnswer: 30, callBack: 10, ring: 200, patientWrites: 40 };
const call = (care: ReturnType<typeof createDemoCare>, name: string, action: string, payload: Record<string, unknown> = {}) =>
  care.rpc(name, { p_action: action, p_payload: payload }) as { data: any; error: any };

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

test('escenario «cuidador/a»: la cuenta gratuita ya es cuidador/a de la paciente, con la vinculación aceptada', () => {
  const care = createDemoCare({ isPremium: () => false, myName: () => 'Javier Martín', caregiverOf: 'María García', timing });
  const snap = call(care, 'caregiver_action', 'snapshot').data;
  expect(snap.role).toBe('caregiver');
  expect(snap.links).toEqual([expect.objectContaining({ caregiverId: DEMO_USER_ID, patientName: 'María García', caregiverName: 'Javier Martín', accepted: true })]);
  expect(snap.incidents).toEqual([]);
});

test('paciente Premium: su hijo ya es su cuidador, otra persona pide vincularse y avisa con chat', () => {
  const care = createDemoCare({ isPremium: () => true, myName: () => 'María García', timing });
  let snap = call(care, 'caregiver_action', 'snapshot').data;
  expect(snap.links).toHaveLength(2);
  expect(snap.links[0]).toMatchObject({ patientId: DEMO_USER_ID, caregiverName: 'Javier Martín', accepted: true });
  const pending = snap.links.find((l: { accepted: boolean }) => !l.accepted);
  expect(pending).toMatchObject({ patientId: DEMO_USER_ID, caregiverName: 'Ana Ruiz' });
  expect(call(care, 'care_pairing_action', 'my_code').data.code).toMatch(/^\d{6}$/);

  expect(call(care, 'care_pairing_action', 'approve', { linkId: pending.id }).data).toEqual({ accepted: true, caregiverName: 'Ana Ruiz' });
  const started = call(care, 'caregiver_action', 'start', { clientKey: 'k1', summary: 'El paciente comunica: me encuentro mal' }).data;
  expect(started.incidentId).toBeTruthy();

  jest.advanceTimersByTime(25);
  snap = call(care, 'caregiver_action', 'snapshot').data;
  const incident = snap.incidents[0];
  expect(incident.state).toBe('active');
  expect(incident.members[0].receivedAt).toBeTruthy();
  expect(incident.members[0].acknowledgedAt).toBeTruthy();
  expect(incident.messages.at(-1).content).toMatch(/Respuesta de prueba/);

  call(care, 'caregiver_action', 'close', { incidentId: incident.id });
  expect(call(care, 'caregiver_action', 'snapshot').data.incidents[0].state).toBe('closed');
});

test('cuidador/a gratuito: envía la solicitud con el código, la paciente simulada acepta y llega un aviso de prueba', () => {
  const care = createDemoCare({ isPremium: () => false, myName: () => 'Ana', timing });
  expect(call(care, 'care_pairing_action', 'my_code').error.message).toBe('PREMIUM_REQUIRED');
  expect(call(care, 'care_pairing_action', 'request', { code: '12', name: 'Ana' }).error.message).toBe('INVALID_CODE');

  const request = call(care, 'care_pairing_action', 'request', { code: '123456', name: 'Ana' }).data;
  expect(request).toMatchObject({ patientName: 'Carmen López', status: 'pending' });

  jest.advanceTimersByTime(15);
  let snap = call(care, 'caregiver_action', 'snapshot').data;
  expect(snap.role).toBe('caregiver');
  expect(snap.links[0]).toMatchObject({ caregiverId: DEMO_USER_ID, accepted: true });

  jest.advanceTimersByTime(40);
  snap = call(care, 'caregiver_action', 'snapshot').data;
  expect(snap.incidents).toHaveLength(1);
  expect(snap.incidents[0].summary).toMatch(/Aviso de prueba/);

  call(care, 'caregiver_action', 'ack', { incidentId: snap.incidents[0].id });
  expect(call(care, 'caregiver_action', 'snapshot').data.incidents[0].members[0].acknowledgedAt).toBeTruthy();

  // Al dejar la vinculación vuelve a perfil básico.
  call(care, 'care_pairing_action', 'disconnect', { linkId: snap.links[0].id });
  snap = call(care, 'caregiver_action', 'snapshot').data;
  expect(snap.role).toBe('patient');
  expect(snap.links).toHaveLength(0);
});

test('sin cuidador/a aceptado no se puede avisar a nadie', () => {
  const care = createDemoCare({ isPremium: () => true, myName: () => 'María', empty: true, timing });
  expect(call(care, 'caregiver_action', 'start', { clientKey: 'k1', summary: 'Me encuentro mal' }).error.message).toBe('NO_LINKED_CAREGIVER');
  expect(call(care, 'care_chat_action', 'list').data.conversations).toEqual([]);
});

test('los datos devueltos son copias: la pantalla no puede alterar el estado simulado', () => {
  const care = createDemoCare({ isPremium: () => true, myName: () => 'María', timing });
  const snap = call(care, 'caregiver_action', 'snapshot').data;
  const index = snap.links.findIndex((l: { accepted: boolean }) => !l.accepted);
  snap.links[index].accepted = true;
  expect(call(care, 'caregiver_action', 'snapshot').data.links[index].accepted).toBe(false);
  const conv = call(care, 'care_chat_action', 'list').data.conversations[0];
  conv.lastMessage.content = 'cambiado';
  expect(call(care, 'care_chat_action', 'list').data.conversations[0].lastMessage.content).not.toBe('cambiado');
});

test('chat del día a día (paciente): ve lo que le escribe su hijo, contesta y él lo ve («Visto») y responde', () => {
  const care = createDemoCare({ isPremium: () => true, myName: () => 'María García', timing });
  const [conv] = call(care, 'care_chat_action', 'list').data.conversations;
  expect(conv).toMatchObject({ myRole: 'patient', otherName: 'Javier Martín', canSend: true, unread: 1 });
  const page = call(care, 'care_chat_action', 'messages', { linkId: conv.linkId }).data;
  expect(page.messages).toHaveLength(4);
  expect(page.messages.map((m: { createdAt: string }) => m.createdAt)).toEqual([...page.messages.map((m: { createdAt: string }) => m.createdAt)].sort());
  expect(call(care, 'care_chat_action', 'read', { linkId: conv.linkId }).data).toEqual({ read: 1 });

  const sent = call(care, 'care_chat_action', 'send', { linkId: conv.linkId, content: ' ¿Puedes llamarme? ', clientKey: 'k-1' }).data;
  expect(sent).toMatchObject({ replayed: false, message: { content: '¿Puedes llamarme?', senderId: DEMO_USER_ID, readAt: null } });
  expect(call(care, 'care_chat_action', 'send', { linkId: conv.linkId, content: '¿Puedes llamarme?', clientKey: 'k-1' }).data.replayed).toBe(true);
  jest.advanceTimersByTime(15);
  let messages = call(care, 'care_chat_action', 'messages', { linkId: conv.linkId }).data.messages;
  expect(messages.find((m: { id: string }) => m.id === sent.message.id).readAt).toBeTruthy();
  jest.advanceTimersByTime(10);
  messages = call(care, 'care_chat_action', 'messages', { linkId: conv.linkId }).data.messages;
  expect(messages.at(-1).content).toMatch(/^Ahora te llamo.*\(Respuesta de prueba\)$/);
  expect(call(care, 'care_chat_action', 'list').data.conversations[0].unread).toBe(1);

  expect(call(care, 'care_chat_action', 'send', { linkId: conv.linkId, content: '  ', clientKey: 'k-2' }).error.message).toBe('INVALID_CONTENT');
  expect(call(care, 'care_chat_action', 'messages', { linkId: 'demo-link-ana' }).error.message).toBe('NOT_ALLOWED');
});

test('chat del día a día (cuidador/a gratis): apagado hasta que su familiar escribe; después contesta', () => {
  const care = createDemoCare({ isPremium: () => false, myName: () => 'Javier Martín', caregiverOf: 'María García', timing });
  let [conv] = call(care, 'care_chat_action', 'list').data.conversations;
  // Hace más de una hora que María no escribe: el chat está apagado para el cuidador.
  expect(conv).toMatchObject({ myRole: 'caregiver', otherName: 'María García', premium: true, canSend: false, openUntil: null, unread: 0 });
  expect(conv.lastMessage.content).toMatch(/pastillas del desayuno/);
  expect(call(care, 'care_chat_action', 'send', { linkId: conv.linkId, content: 'Hola', clientKey: 'c-0' }).error.message).toBe('CHAT_CLOSED');
  // María escribe: se enciende durante una hora.
  jest.advanceTimersByTime(timing.patientWrites + 1);
  [conv] = call(care, 'care_chat_action', 'list').data.conversations;
  expect(conv).toMatchObject({ canSend: true, unread: 1 });
  expect(Date.parse(conv.openUntil) - Date.now()).toBeGreaterThan(59 * 60_000);
  expect(conv.lastMessage.content).toMatch(/Quería contarte una cosa/);
  const sent = call(care, 'care_chat_action', 'send', { linkId: conv.linkId, content: '¿Te has tomado las pastillas?', clientKey: 'c-1' }).data;
  expect(sent.message.senderId).toBe(DEMO_USER_ID);
  jest.advanceTimersByTime(25);
  const messages = call(care, 'care_chat_action', 'messages', { linkId: conv.linkId }).data.messages;
  expect(messages.at(-1).content).toMatch(/ya me las he tomado/);

  // Al dejar la vinculación, la conversación desaparece.
  call(care, 'care_pairing_action', 'disconnect', { linkId: conv.linkId });
  expect(call(care, 'care_chat_action', 'list').data.conversations).toEqual([]);
  expect(call(care, 'care_chat_action', 'messages', { linkId: conv.linkId }).error.message).toBe('NOT_ALLOWED');
});

const SDP = 'v=0\r\n';
test('llamada de voz (paciente → cuidador): suena, contesta, se cuelga y queda en el chat', () => {
  const care = createDemoCare({ isPremium: () => true, myName: () => 'María García', timing });
  const [conv] = call(care, 'care_chat_action', 'list').data.conversations;
  expect(call(care, 'care_call_action', 'offer', { linkId: conv.linkId, callId: 'c-1', sdp: 'hola' }).error.message).toBe('INVALID_SDP');
  const ringing = call(care, 'care_call_action', 'offer', { linkId: conv.linkId, callId: 'c-1', sdp: SDP }).data;
  expect(ringing).toMatchObject({ id: 'c-1', direction: 'outgoing', state: 'ringing', otherName: 'Javier Martín', offer: null });
  expect(call(care, 'care_call_action', 'offer', { linkId: conv.linkId, callId: 'c-2', sdp: SDP }).error.message).toBe('CALL_BUSY');
  jest.advanceTimersByTime(35);
  const answered = call(care, 'care_call_action', 'snapshot', { callId: 'c-1' }).data;
  expect(answered).toMatchObject({ state: 'answered', answer: expect.stringMatching(/^v=0/) });
  jest.advanceTimersByTime(65_000);
  expect(call(care, 'care_call_action', 'end', { callId: 'c-1' }).data).toMatchObject({ state: 'ended', outcome: 'answered' });
  const log = call(care, 'care_chat_action', 'messages', { linkId: conv.linkId }).data.messages.at(-1);
  expect(log).toMatchObject({ kind: 'call', callOutcome: 'answered', senderId: DEMO_USER_ID });
  expect(log.callSeconds).toBeGreaterThanOrEqual(65);
  expect(log.readAt).toBeTruthy();
});

test('«¿Puedes llamarme?»: el cuidador simulado llama; si no se contesta, queda «Llamada perdida»', () => {
  const care = createDemoCare({ isPremium: () => true, myName: () => 'María García', timing });
  const [conv] = call(care, 'care_chat_action', 'list').data.conversations;
  call(care, 'care_chat_action', 'send', { linkId: conv.linkId, content: '¿Puedes llamarme?', clientKey: 'k-call' });
  expect(call(care, 'care_call_action', 'incoming').data).toBeNull();
  jest.advanceTimersByTime(35);
  const incoming = call(care, 'care_call_action', 'incoming').data;
  expect(incoming).toMatchObject({ direction: 'incoming', state: 'ringing', otherName: 'Javier Martín', offer: expect.stringMatching(/^v=0/) });
  jest.advanceTimersByTime(250);
  expect(call(care, 'care_call_action', 'incoming').data).toBeNull();
  expect(call(care, 'care_call_action', 'answer', { callId: incoming.id, sdp: SDP }).error.message).toBe('CALL_ENDED');
  const list = call(care, 'care_chat_action', 'list').data.conversations[0];
  expect(list.lastMessage).toMatchObject({ kind: 'call', callOutcome: 'missed' });
  expect(list.unread).toBeGreaterThanOrEqual(1);
});

test('llamada entrante contestada y rechazada; sin Premium de la persona cuidada no hay llamadas', () => {
  let premium = true;
  const care = createDemoCare({ isPremium: () => premium, myName: () => 'María García', timing });
  const [conv] = call(care, 'care_chat_action', 'list').data.conversations;
  call(care, 'care_chat_action', 'send', { linkId: conv.linkId, content: 'Llámame cuando puedas', clientKey: 'k-1' });
  jest.advanceTimersByTime(35);
  let incoming = call(care, 'care_call_action', 'incoming').data;
  expect(call(care, 'care_call_action', 'answer', { callId: incoming.id, sdp: SDP }).data.state).toBe('answered');
  call(care, 'care_call_action', 'end', { callId: incoming.id });
  call(care, 'care_chat_action', 'send', { linkId: conv.linkId, content: '¿Me llamas otra vez?', clientKey: 'k-2' });
  jest.advanceTimersByTime(35);
  incoming = call(care, 'care_call_action', 'incoming').data;
  expect(call(care, 'care_call_action', 'decline', { callId: incoming.id }).data.outcome).toBe('declined');
  premium = false;
  expect(call(care, 'care_call_action', 'offer', { linkId: conv.linkId, callId: 'c-x', sdp: SDP }).error.message).toBe('PREMIUM_REQUIRED');
  expect(call(care, 'care_call_action', 'snapshot', { callId: 'no-existe' }).error.message).toBe('NOT_ALLOWED');
});
