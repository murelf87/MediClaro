/**
 * Lectura de un medicamento con la voz del teléfono (si el propietario la eligió para toda la app): apartado a
 * apartado, con el progreso aproximado; pausa, continuar y volver a empezar.
 */
import * as Speech from 'expo-speech';
import { createDeviceReader, estimateSeconds } from '../deviceReader';

type Opts = { onDone?: () => void; onError?: () => void };
let spoken: { text: string; opts: Opts }[] = [];
const readers: { stop: () => void }[] = [];

beforeEach(() => {
  spoken = [];
  jest.spyOn(Speech, 'getAvailableVoicesAsync').mockResolvedValue([]);
  jest.spyOn(Speech, 'speak').mockImplementation((text: string, opts?: Opts) => {
    spoken.push({ text, opts: opts ?? {} });
  });
  jest.spyOn(Speech, 'stop').mockImplementation(async () => undefined);
});
afterEach(() => {
  // Cada lectura lleva un temporizador de progreso: se paran todas para que la prueba termine.
  readers.splice(0).forEach((r) => r.stop());
  jest.restoreAllMocks();
});

const flush = () => new Promise((r) => setTimeout(r, 0));

function reader(parts: string[]) {
  const events = { onProgress: jest.fn(), onSpeaking: jest.fn(), onFinished: jest.fn(), onError: jest.fn() };
  const r = createDeviceReader(parts, () => 1, events);
  readers.push(r);
  return { r, events };
}

test('la duración se calcula por la longitud del texto', () => {
  expect(estimateSeconds('a'.repeat(140), 1)).toBeCloseTo(10);
  expect(estimateSeconds('a'.repeat(140), 0.5)).toBeCloseTo(20);
  expect(estimateSeconds('', 1)).toBe(1);
});

test('lee los apartados uno detrás de otro y termina', async () => {
  const { r, events } = reader(['Qué es.', 'Para qué sirve.']);
  r.play();
  await flush();
  expect(spoken.map((s) => s.text)).toEqual(['Qué es.']);
  expect(events.onSpeaking).toHaveBeenCalled();
  spoken[0].opts.onDone?.();
  await flush();
  expect(spoken.map((s) => s.text)).toEqual(['Qué es.', 'Para qué sirve.']);
  spoken[1].opts.onDone?.();
  await flush();
  expect(events.onFinished).toHaveBeenCalledTimes(1);
  expect(events.onProgress).toHaveBeenLastCalledWith(r.total);
});

test('pausa: se detiene; al continuar vuelve a leer el apartado en el que estaba', async () => {
  const { r } = reader(['Uno.', 'Dos.']);
  r.play();
  await flush();
  spoken[0].opts.onDone?.();
  await flush();
  r.pause();
  expect(Speech.stop).toHaveBeenCalled();
  // Un «terminado» que llega tarde (del apartado detenido) no hace avanzar.
  spoken[1].opts.onDone?.();
  await flush();
  expect(spoken).toHaveLength(2);
  r.play();
  await flush();
  expect(spoken[2].text).toBe('Dos.');
});

test('volver a empezar lee desde el primer apartado', async () => {
  const { r, events } = reader(['Uno.', 'Dos.']);
  r.play();
  await flush();
  r.restart();
  await flush();
  expect(spoken.map((s) => s.text)).toEqual(['Uno.', 'Uno.']);
  expect(events.onProgress).toHaveBeenCalledWith(0);
});

test('si la voz del teléfono falla, se avisa', async () => {
  const { r, events } = reader(['Uno.']);
  r.play();
  await flush();
  spoken[0].opts.onError?.();
  expect(events.onError).toHaveBeenCalledTimes(1);
});
