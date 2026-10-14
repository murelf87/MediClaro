/**
 * Velocidad de lectura del chat de IA: caracol (muy muy lento), tortuga (lento) y conejo (normal).
 */
const mockStore = new Map<string, unknown>();
jest.mock('../../api/storage', () => ({
  localStore: {
    getJSON: async (k: string, fallback: unknown) => (mockStore.has(k) ? mockStore.get(k) : fallback),
    setJSON: async (k: string, v: unknown) => void mockStore.set(k, v),
    remove: async (k: string) => void mockStore.delete(k),
  },
}));
import { ASSISTANT_SPEEDS, AssistantSpeed, assistantRate, parseAssistantSpeed } from '../AssistantSpeed';
import { naturalPlaybackRate } from '../../utils/playbackRate';

beforeEach(() => {
  mockStore.clear();
  AssistantSpeed.__reset();
});

test('tres velocidades, de más despacio a más rápido, cada una con su animal', () => {
  expect(ASSISTANT_SPEEDS.map((s) => s.emoji)).toEqual(['🐌', '🐢', '🐇']);
  expect(ASSISTANT_SPEEDS.map((s) => s.label)).toEqual(['Muy lento', 'Lento', 'Normal']);
  const rates = ASSISTANT_SPEEDS.map((s) => s.rate);
  expect([...rates].sort((a, b) => a - b)).toEqual(rates);
  expect(new Set(rates).size).toBe(3);
});

test('con la voz natural cada velocidad suena distinta (0,75×, 0,9× y 1×) y la lectura de siempre no cambia', () => {
  expect(ASSISTANT_SPEEDS.map((s) => naturalPlaybackRate(s.rate))).toEqual([0.75, 0.9, 1]);
  expect(naturalPlaybackRate(0.7)).toBe(0.9); // «lento» de siempre
  expect(naturalPlaybackRate(0.85)).toBe(1); // «normal» de siempre
  expect(naturalPlaybackRate(1.0)).toBe(1.12); // «rápido» de siempre
});

test('la elección se queda encendida, se avisa a la pantalla y se recuerda al reabrir', async () => {
  const seen: string[] = [];
  AssistantSpeed.subscribe(() => seen.push(AssistantSpeed.get()));
  expect(AssistantSpeed.get()).toBe('normal');
  AssistantSpeed.set('veryslow');
  AssistantSpeed.set('veryslow'); // sin cambios: no avisa dos veces
  AssistantSpeed.set('slow');
  expect(seen).toEqual(['veryslow', 'slow']);
  expect(assistantRate('slow')).toBe(0.7);
  await new Promise((r) => setImmediate(r));
  AssistantSpeed.__reset();
  AssistantSpeed.load();
  await new Promise((r) => setImmediate(r));
  expect(AssistantSpeed.get()).toBe('slow');
});

test('un valor guardado raro se ignora', () => {
  expect(parseAssistantSpeed('turbo')).toBe('normal');
  expect(parseAssistantSpeed(null)).toBe('normal');
  expect(parseAssistantSpeed('veryslow')).toBe('veryslow');
});
