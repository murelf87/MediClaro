/**
 * Voz de la app (la elige el propietario en el panel para todas las personas): natural o la del teléfono.
 */
let mockServer: { data: unknown; error: unknown } = { data: null, error: null };
const mockFrom = jest.fn((_table: string) => ({
  select: () => ({ eq: () => ({ maybeSingle: async () => mockServer }) }),
}));
jest.mock('../../lib/supabase', () => ({ supabase: { from: (t: string) => mockFrom(t) } }));
const mockStore = new Map<string, unknown>();
jest.mock('../../api/storage', () => ({
  localStore: {
    getJSON: async (k: string, fallback: unknown) => (mockStore.has(k) ? mockStore.get(k) : fallback),
    setJSON: async (k: string, v: unknown) => void mockStore.set(k, v),
    remove: async (k: string) => void mockStore.delete(k),
  },
}));
import { VoiceSettings, parseVoiceMode } from '../VoiceSettings';

beforeEach(() => {
  VoiceSettings.__reset();
  mockStore.clear();
  mockFrom.mockClear();
  mockServer = { data: null, error: null };
});

test('solo «device» cambia la voz; cualquier otra cosa es la voz natural (como hasta ahora)', () => {
  expect(parseVoiceMode({ mode: 'device' })).toBe('device');
  expect(parseVoiceMode({ mode: 'natural' })).toBe('natural');
  expect(parseVoiceMode({ mode: 'robot' })).toBe('natural');
  expect(parseVoiceMode(null)).toBe('natural');
  expect(parseVoiceMode('device')).toBe('natural');
});

test('lee la voz del servidor, avisa del cambio y la guarda en el móvil', async () => {
  const changed = jest.fn();
  VoiceSettings.subscribe(changed);
  mockServer = { data: { value: { mode: 'device' } }, error: null };
  expect(await VoiceSettings.refresh(true)).toBe('device');
  expect(VoiceSettings.mode()).toBe('device');
  expect(changed).toHaveBeenCalledTimes(1);
  expect(mockStore.get('mediclaro_voice_mode_v1')).toEqual({ mode: 'device' });
  expect(mockFrom).toHaveBeenCalledWith('app_config');
});

test('sin la fila en el servidor (migración sin aplicar): voz natural', async () => {
  mockServer = { data: null, error: null };
  expect(await VoiceSettings.refresh(true)).toBe('natural');
});

test('sin conexión se queda la última conocida; y no pregunta más de una vez cada 5 minutos', async () => {
  VoiceSettings.apply('device');
  mockServer = { data: null, error: { message: 'Network request failed' } };
  expect(await VoiceSettings.refresh(true)).toBe('device');
  mockFrom.mockClear();
  await VoiceSettings.refresh();
  expect(mockFrom).not.toHaveBeenCalled();
});

test('al abrir la app usa al instante la guardada en el móvil si el servidor no responde', async () => {
  mockStore.set('mediclaro_voice_mode_v1', { mode: 'device' });
  mockServer = { data: null, error: { message: 'offline' } };
  VoiceSettings.start();
  await new Promise((r) => setTimeout(r, 0));
  expect(VoiceSettings.mode()).toBe('device');
});
