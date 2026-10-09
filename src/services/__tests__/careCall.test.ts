/**
 * Llamadas de voz con el cuidador/a (app): señalización con el servidor y errores claros (también si las llamadas aún
 * no están desplegadas). Con el servidor simulado de la demostración (misma forma que care_call_action).
 */
const mockRpc = jest.fn();
const mockInvoke = jest.fn();
jest.mock('../../lib/supabase', () => ({ supabase: { rpc: (...a: unknown[]) => mockRpc(...a) } }));
jest.mock('../../api/functions', () => ({ invokeFunction: (...a: unknown[]) => mockInvoke(...a) }));

import { CareCallService, careCallError, parseCall } from '../CareCallService';
import { createDemoCare } from '../../mocks/demoCare';

const timing = { accept: 10, received: 10, acknowledged: 20, reply: 10, incoming: 30, chatRead: 10, chatReply: 20, callAnswer: 30, callBack: 10, ring: 200 };

beforeEach(() => {
  jest.useFakeTimers();
  mockRpc.mockReset();
  mockInvoke.mockReset();
});
afterEach(() => jest.useRealTimers());

test('llamar, contestar y colgar con el servidor', async () => {
  const care = createDemoCare({ isPremium: () => true, myName: () => 'María García', timing });
  mockRpc.mockImplementation(async (name: string, args: unknown) => care.rpc(name, args));
  const c = await CareCallService.offer('demo-link-javier', 'llamada-1', 'v=0\r\n');
  expect(mockRpc).toHaveBeenLastCalledWith('care_call_action', { p_action: 'offer', p_payload: { linkId: 'demo-link-javier', callId: 'llamada-1', sdp: 'v=0\r\n' } });
  expect(c).toMatchObject({ direction: 'outgoing', state: 'ringing', otherName: 'Javier Martín' });
  jest.advanceTimersByTime(35);
  expect((await CareCallService.snapshot('llamada-1')).state).toBe('answered');
  expect((await CareCallService.end('llamada-1')).outcome).toBe('answered');
  expect(await CareCallService.incoming()).toBeNull();
});

test('errores claros', async () => {
  expect(careCallError({ message: 'CALL_BUSY' }).message).toMatch(/Ya hay una llamada/);
  expect(careCallError({ message: 'PREMIUM_REQUIRED' })).toMatchObject({ kind: 'limit_reached', message: expect.stringMatching(/Premium/) });
  expect(careCallError({ code: 'PGRST202', message: 'Could not find the function public.care_call_action' })).toMatchObject({
    kind: 'not_configured', message: expect.stringMatching(/todavía no están activadas/),
  });
  mockInvoke.mockResolvedValue({ iceServers: [] });
  await expect(CareCallService.rtcConfig('L')).rejects.toMatchObject({ kind: 'provider_down' });
  mockInvoke.mockResolvedValue({ iceServers: [{ urls: ['stun:stun.l.google.com:19302'] }] });
  await expect(CareCallService.rtcConfig('L')).resolves.toMatchObject({ iceServers: [{ urls: ['stun:stun.l.google.com:19302'] }] });
  expect(mockInvoke).toHaveBeenLastCalledWith('caregiver-rtc-config', { linkId: 'L' }, { timeoutMs: 15000 });
});

test('respuestas raras del servidor no rompen la pantalla', () => {
  expect(parseCall(null)).toBeNull();
  expect(parseCall({ id: 'x', state: '???', outcome: 'raro' })).toMatchObject({ state: 'ringing', outcome: null, otherName: 'Tu familiar', offer: null });
});
