/**
 * Chat con el cuidador/a (app): lo que se envía al servidor, cómo se leen sus respuestas, los «sin leer» compartidos
 * del botón central y los errores claros (también si el servidor aún no tiene el chat desplegado).
 * Con el servidor simulado de la demostración (misma forma de datos que care_chat_action).
 */
const mockRpc = jest.fn();
jest.mock('../../lib/supabase', () => ({ supabase: { rpc: (...a: unknown[]) => mockRpc(...a) } }));

import { CareChatService, canWriteNow, careChatError, chatOpen, parseConversation } from '../CareChatService';
import { createDemoCare } from '../../mocks/demoCare';

const timing = { accept: 10, received: 10, acknowledged: 20, reply: 10, incoming: 30, chatRead: 10, chatReply: 20 };

function useDemoServer(premium = true) {
  const care = createDemoCare({ isPremium: () => premium, myName: () => 'María García', timing });
  mockRpc.mockImplementation(async (name: string, args: unknown) => care.rpc(name, args));
  return care;
}

beforeEach(() => {
  jest.useFakeTimers();
  mockRpc.mockReset();
  CareChatService.clear();
});
afterEach(() => jest.useRealTimers());

test('conversaciones: con quién, no leídos y último mensaje; el botón central se entera', async () => {
  useDemoServer();
  const seen = jest.fn();
  const off = CareChatService.subscribe(seen);
  const list = await CareChatService.list();
  off();
  expect(mockRpc).toHaveBeenCalledWith('care_chat_action', { p_action: 'list', p_payload: {} });
  expect(list).toHaveLength(1);
  expect(list[0]).toMatchObject({ myRole: 'patient', otherName: 'Javier Martín', canSend: true, unread: 1 });
  expect(list[0].lastMessage?.content).toMatch(/pastillas del desayuno/);
  expect(CareChatService.totalUnread()).toBe(1);
  expect(seen).toHaveBeenCalled();
});

test('leer, enviar y «Visto»: el mensaje llega una sola vez aunque se reintente', async () => {
  useDemoServer();
  const [conv] = await CareChatService.list();
  const page = await CareChatService.messages(conv.linkId);
  expect(page.messages.map((m) => m.senderId === conv.otherId)).toEqual([true, false, true, true]);
  expect(await CareChatService.markRead(conv.linkId)).toBe(1);
  expect(CareChatService.totalUnread()).toBe(0);

  const first = await CareChatService.send(conv.linkId, '  Estoy bien 😊  ', 'clave-1');
  expect(first.message.content).toBe('Estoy bien 😊');
  expect(mockRpc).toHaveBeenLastCalledWith('care_chat_action', {
    p_action: 'send',
    p_payload: { linkId: conv.linkId, content: 'Estoy bien 😊', clientKey: 'clave-1' },
  });
  const again = await CareChatService.send(conv.linkId, 'Estoy bien 😊', 'clave-1');
  expect(again).toMatchObject({ replayed: true, message: { id: first.message.id } });

  jest.advanceTimersByTime(25);
  const after = await CareChatService.messages(conv.linkId);
  const mine = after.messages.find((m) => m.id === first.message.id);
  expect(mine?.readAt).toBeTruthy();
  expect(after.messages.at(-1)?.content).toMatch(/Respuesta de prueba/);
  expect(after.messages.filter((m) => m.content === 'Estoy bien 😊')).toHaveLength(1);
});

test('mensaje vacío o demasiado largo: se avisa sin llamar al servidor', async () => {
  useDemoServer();
  await expect(CareChatService.send('demo-link-javier', '   ', 'k')).rejects.toMatchObject({ kind: 'invalid_input' });
  await expect(CareChatService.send('demo-link-javier', 'x'.repeat(1001), 'k')).rejects.toMatchObject({ kind: 'invalid_input' });
  expect(mockRpc).not.toHaveBeenCalled();
});

test('sin Premium de la persona cuidada: se lee pero no se escribe; una vinculación terminada no se ve', async () => {
  let premium = true;
  const care = createDemoCare({ isPremium: () => premium, myName: () => 'María García', timing });
  mockRpc.mockImplementation(async (name: string, args: unknown) => care.rpc(name, args));
  const [conv] = await CareChatService.list();
  premium = false;
  expect((await CareChatService.list())[0].canSend).toBe(false);
  await expect(CareChatService.send(conv.linkId, 'Hola', 'k2')).rejects.toMatchObject({
    kind: 'limit_reached',
    message: expect.stringMatching(/Premium/),
  });
  await expect(CareChatService.messages('demo-link-ana')).rejects.toMatchObject({ kind: 'permission_denied' });
});

test('errores claros; si el servidor aún no tiene el chat, se dice y se deja de consultar', async () => {
  expect(careChatError({ message: 'RATE_LIMIT' })).toMatchObject({ kind: 'rate_limited' });
  expect(careChatError({ message: 'NOT_ALLOWED' }).message).toMatch(/ya no está disponible/);
  expect(careChatError({ message: 'Failed to fetch' })).toMatchObject({ kind: 'offline' });
  mockRpc.mockResolvedValue({ data: null, error: { code: 'PGRST202', message: 'Could not find the function public.care_chat_action(p_action, p_payload) in the schema cache' } });
  await expect(CareChatService.list()).rejects.toMatchObject({ kind: 'not_configured', message: expect.stringMatching(/todavía no está activado/) });
  expect(CareChatService.isAvailable()).toBe(false);
  mockRpc.mockClear();
  await CareChatService.refreshSummary(0);
  expect(mockRpc).not.toHaveBeenCalled();
});

test('respuestas raras del servidor no rompen la pantalla', () => {
  expect(parseConversation(null)).toBeNull();
  expect(parseConversation({ linkId: 'L', unread: -3, myRole: 'caregiver' })).toMatchObject({
    otherName: 'Tu familiar', unread: 0, canSend: false, premium: false, openUntil: null, lastMessage: null,
  });
  // Servidor anterior (sin la ventana del cuidador/a): canSend manda y «premium» se deduce de él.
  expect(parseConversation({ linkId: 'L', myRole: 'caregiver', canSend: true })).toMatchObject({ premium: true, openUntil: null });
  expect(parseConversation({ linkId: 'L', myRole: 'caregiver', canSend: true, premium: true, openUntil: 'no es fecha' }).openUntil).toBeNull();
});

test('la conversación la enciende la persona cuidada: el cuidador/a escribe solo durante la hora siguiente', () => {
  const now = Date.parse('2026-10-09T18:00:00Z');
  const open = { openUntil: '2026-10-09T18:40:00Z', premium: true } as const;
  const closed = { openUntil: '2026-10-09T17:59:00Z', premium: true } as const;
  expect(chatOpen(open, now)).toBe(true);
  expect(chatOpen(closed, now)).toBe(false);
  expect(chatOpen({ openUntil: null }, now)).toBe(false);
  expect(canWriteNow({ myRole: 'caregiver', ...open }, now)).toBe(true);
  expect(canWriteNow({ myRole: 'caregiver', ...closed }, now)).toBe(false);
  expect(canWriteNow({ myRole: 'patient', ...closed }, now)).toBe(true);
  expect(canWriteNow({ myRole: 'patient', premium: false, openUntil: null }, now)).toBe(false);
});

test('al cerrar sesión no queda nada del chat en memoria', async () => {
  useDemoServer();
  await CareChatService.list();
  CareChatService.setActiveConversation('demo-link-javier');
  CareChatService.clear();
  expect(CareChatService.getSummary()).toEqual([]);
  expect(CareChatService.isActiveConversation('demo-link-javier')).toBe(false);
});
