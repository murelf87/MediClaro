/**
 * El tiempo máximo de las funciones del servidor se cumple siempre, también si el cliente no atiende la cancelación
 * (nota de la vista previa: el asistente se quedaba «enviando» y no dejaba escribir otra pregunta).
 */
const mockInvoke = jest.fn();
jest.mock('../../lib/supabase', () => ({
  supabase: { functions: { invoke: (...a: unknown[]) => mockInvoke(...a) } },
  isBackendConfigured: () => true,
  isDemoClientActive: () => true,
}));

import { invokeFunction } from '../functions';

beforeEach(() => {
  jest.useFakeTimers();
  mockInvoke.mockReset();
});
afterEach(() => jest.useRealTimers());

test('si la respuesta no llega (y se ignora la cancelación), termina con «tiempo agotado»', async () => {
  mockInvoke.mockImplementation(() => new Promise(() => undefined)); // nunca responde
  const p = invokeFunction('chat', { messages: [] }, { timeoutMs: 5000 });
  const check = expect(p).rejects.toMatchObject({ kind: 'timeout' });
  jest.advanceTimersByTime(5001);
  await check;
});

test('si responde a tiempo, devuelve los datos y no deja temporizadores', async () => {
  mockInvoke.mockResolvedValue({ data: { reply: 'Hola' }, error: null });
  await expect(invokeFunction('chat', { messages: [] }, { timeoutMs: 5000 })).resolves.toEqual({ reply: 'Hola' });
  expect(jest.getTimerCount()).toBe(0);
});
