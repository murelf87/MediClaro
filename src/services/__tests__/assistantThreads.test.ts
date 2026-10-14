/**
 * Conversaciones del asistente: abrir una nueva sin perder las anteriores, volver a una anterior y recordar cuál estaba
 * abierta al reabrir la app.
 */
const mockStore = new Map<string, unknown>();
jest.mock('../../api/storage', () => ({
  localStore: {
    getJSON: async (k: string, fallback: unknown) => (mockStore.has(k) ? mockStore.get(k) : fallback),
    setJSON: async (k: string, v: unknown) => void mockStore.set(k, v),
    remove: async (k: string) => void mockStore.delete(k),
  },
}));
import { AssistantThreads, MAIN_THREAD_KEY } from '../AssistantThreads';
import { AssistantService } from '../AssistantService';

beforeEach(() => {
  mockStore.clear();
  AssistantThreads.__reset();
});

test('al principio solo existe la conversación de siempre', () => {
  expect(AssistantThreads.activeKey()).toBe(MAIN_THREAD_KEY);
  expect(AssistantThreads.list()).toEqual([]);
  expect(AssistantService.conversationKey()).toBe('general');
  expect(AssistantService.conversationKey({ medicationId: '123' })).toBe('med:123');
});

test('una conversación nueva tiene su propia clave y las anteriores se conservan', () => {
  AssistantThreads.touch('general', '¿Para qué sirve el paracetamol?', 1000);
  const fresh = AssistantThreads.start(2000);
  expect(fresh).toMatch(/^chat-[a-z0-9]+$/);
  expect(AssistantThreads.activeKey()).toBe(fresh);
  expect(AssistantService.conversationKey()).toBe(fresh);
  AssistantThreads.touch(fresh, 'Tengo una duda sobre mi tensión', 3000);
  const list = AssistantThreads.list();
  expect(list.map((t) => t.title)).toEqual(['Tengo una duda sobre mi tensión', '¿Para qué sirve el paracetamol?']);
  expect(list.map((t) => t.key)).toEqual([fresh, 'general']);
});

test('se puede volver a una conversación anterior; una clave rara se rechaza', () => {
  const fresh = AssistantThreads.start(5000);
  expect(AssistantThreads.select('general')).toBe(true);
  expect(AssistantThreads.activeKey()).toBe('general');
  expect(AssistantThreads.select(fresh)).toBe(true);
  expect(AssistantThreads.select('med:1')).toBe(false);
  expect(AssistantThreads.select('../otra')).toBe(false);
  expect(AssistantThreads.activeKey()).toBe(fresh);
});

test('la primera pregunta da título al hilo y preguntar más no lo cambia; solo sube al principio de la lista', () => {
  AssistantThreads.touch('general', 'Primera   pregunta\ncon saltos', 1000);
  AssistantThreads.touch('general', 'Otra pregunta distinta', 2000);
  expect(AssistantThreads.list()).toHaveLength(1);
  expect(AssistantThreads.list()[0].title).toBe('Primera pregunta con saltos');
  AssistantThreads.touch('general', 'x'.repeat(200), 3000);
  const a = AssistantThreads.start(4000);
  AssistantThreads.touch(a, 'y'.repeat(200), 5000);
  expect(AssistantThreads.list()[0].title.length).toBeLessThanOrEqual(60);
  AssistantThreads.touch('general', 'z', 6000);
  expect(AssistantThreads.list()[0].key).toBe('general');
});

test('las conversaciones de un medicamento no entran en la lista', () => {
  AssistantThreads.touch('med:123', 'pregunta', 1000);
  expect(AssistantThreads.list()).toEqual([]);
});

test('al reabrir la app se recuerda la lista y la conversación abierta', async () => {
  const fresh = AssistantThreads.start(7000);
  AssistantThreads.touch(fresh, 'Mi pregunta', 8000);
  await new Promise((r) => setImmediate(r));
  AssistantThreads.__reset();
  expect(AssistantThreads.activeKey()).toBe('general');
  await AssistantThreads.load();
  expect(AssistantThreads.activeKey()).toBe(fresh);
  expect(AssistantThreads.list().map((t) => t.title)).toEqual(['Mi pregunta']);
});

test('datos guardados dañados se ignoran', async () => {
  mockStore.set('mediclaro_assistant_threads_v1', [{ key: '<script>', title: 'x', updatedAt: 'y' }, { key: 'chat-abc', title: 'Bien', updatedAt: '2026-10-11T10:00:00.000Z' }, 5]);
  mockStore.set('mediclaro_assistant_active_v1', 'otra cosa');
  await AssistantThreads.load();
  expect(AssistantThreads.list().map((t) => t.key)).toEqual(['chat-abc']);
  expect(AssistantThreads.activeKey()).toBe('general');
});

test('borrar el historial desde Privacidad vacía la lista y vuelve a la conversación de siempre', () => {
  AssistantThreads.touch('general', 'hola', 1000);
  AssistantThreads.start(2000);
  AssistantThreads.clearAll();
  expect(AssistantThreads.list()).toEqual([]);
  expect(AssistantThreads.activeKey()).toBe('general');
});

test('olvidar la conversación abierta vuelve a la de siempre', () => {
  const fresh = AssistantThreads.start(2000);
  AssistantThreads.touch(fresh, 'hola', 3000);
  AssistantThreads.forget(fresh);
  expect(AssistantThreads.activeKey()).toBe('general');
  expect(AssistantThreads.list()).toEqual([]);
});
