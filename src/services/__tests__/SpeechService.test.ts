/**
 * Voz natural: lo que se envía al servidor.
 *  - Lectura y Lucía: texto preparado para la voz (unidades, 112…), nunca recortado a mitad de palabra.
 *  - Previsualizaciones públicas: texto EXACTO (debe coincidir con la lista permitida del servidor).
 *  - Modo demostración: muestra fija de Sulafat (sin cuenta real no se genera audio nuevo).
 */
const mockInvoke = jest.fn();
let mockDemo = false;
jest.mock('../../api', () => ({ invokeFunction: (...a: unknown[]) => mockInvoke(...a) }));
jest.mock('../../lib/supabase', () => ({
  isBackendConfigured: true,
  isDemoClientActive: () => mockDemo,
  SUPABASE_URL: 'https://example.supabase.co',
  SUPABASE_ANON_KEY: 'public-anon-key-for-tests',
}));
// Disco simulado: lo que se escribe queda guardado (para probar las pruebas de voz guardadas en el móvil).
const mockDisk = new Map<string, number>();
jest.mock('expo-file-system', () => ({
  Paths: { cache: 'cache' },
  File: class {
    uri: string;
    constructor(_dir: string, name: string) { this.uri = `file:///cache/${name}`; }
    get exists() { return mockDisk.has(this.uri); }
    get size() { return mockDisk.get(this.uri) ?? null; }
    write(data: string) { mockDisk.set(this.uri, Math.floor((data.length * 3) / 4)); }
    delete() { mockDisk.delete(this.uri); }
  },
}), { virtual: true });

import { DEMO_VOICE_SAMPLE, SpeechService, packContinuousSegments } from '../SpeechService';

const fetchMock = jest.fn();

beforeEach(() => {
  mockDisk.clear();
  mockDemo = false;
  mockInvoke.mockReset().mockResolvedValue({ audioBase64: 'UklGRg==' });
  fetchMock.mockReset().mockResolvedValue({ ok: true, json: async () => ({ audioBase64: 'UklGRg==' }) });
  (globalThis as { fetch?: unknown }).fetch = fetchMock;
});

test('la lectura envía el texto preparado para la voz', async () => {
  await SpeechService.synthesize('Paracetamol 500 mg c/8 h. Si empeoras, llama al 112.', 'Sulafat', 'reading');
  expect(mockInvoke).toHaveBeenCalledWith(
    'tts',
    { text: 'Paracetamol 500 miligramos cada 8 horas. Si empeoras, llama al uno, uno, dos.', voice: 'Sulafat', purpose: 'reading' },
    expect.anything(),
  );
});

test('una respuesta larga de Lucía nunca se recorta: va entera, por frases, como un único audio', async () => {
  const sentence = 'Esta es una frase sencilla para explicar el medicamento con calma. ';
  const long = sentence.repeat(80); // ~5.300 caracteres
  await SpeechService.synthesize(long, 'Aoede', 'assistant');
  const [name, body] = mockInvoke.mock.calls[0];
  expect(name).toBe('tts');
  expect(body.voice).toBe('Aoede');
  expect(body.purpose).toBe('assistant');
  expect(Array.isArray(body.segments)).toBe(true);
  expect(body.segments.length).toBeGreaterThan(1);
  for (const segment of body.segments) {
    expect(segment.length).toBeLessThanOrEqual(3000);
    expect(segment).toMatch(/\.$/); // cada segmento termina en un final de frase
  }
  expect(body.segments.join(' ')).toBe(long.trim());
});

test('las previsualizaciones públicas se envían exactamente igual (sin preparar el texto)', async () => {
  await SpeechService.synthesize(DEMO_VOICE_SAMPLE, 'Achird', 'preview');
  expect(mockInvoke).not.toHaveBeenCalled();
  const [url, init] = fetchMock.mock.calls[0];
  expect(url).toBe('https://example.supabase.co/functions/v1/tts-preview');
  expect(JSON.parse(init.body)).toEqual({ text: DEMO_VOICE_SAMPLE, voice: 'Achird', purpose: 'preview' });
});

test('en el Modo demostración la lectura usa la muestra fija de Sulafat', async () => {
  mockDemo = true;
  await SpeechService.synthesizeContinuous(['Qué es. Un medicamento de ejemplo.'], 'Sulafat', 'reading');
  expect(mockInvoke).not.toHaveBeenCalled();
  expect(JSON.parse(fetchMock.mock.calls[0][1].body).text).toBe(DEMO_VOICE_SAMPLE);
});

test('los apartados se unen con pausa y sin cortar palabras', () => {
  expect(packContinuousSegments(['Qué es', 'Para qué sirve. Alivia el dolor de 1 g'])).toEqual([
    'Qué es. Para qué sirve. Alivia el dolor de 1 gramo.',
  ]);
});

test('una voz desconocida se sustituye por Sulafat en la petición', async () => {
  await SpeechService.synthesize('Hola.', 'Desconocida' as never, 'reading');
  expect(mockInvoke.mock.calls[0][1].voice).toBe('Sulafat');
});

test('la prueba de voz nunca espera para siempre: a los 30 s se corta la conexión y se explica', async () => {
  jest.useFakeTimers();
  try {
    let signal: AbortSignal | undefined;
    fetchMock.mockImplementation((_url: string, init: { signal?: AbortSignal }) => {
      signal = init.signal;
      return new Promise(() => undefined);
    });
    const pending = SpeechService.synthesize(DEMO_VOICE_SAMPLE, 'Sulafat', 'preview');
    const outcome = expect(pending).rejects.toThrow('el servidor no ha respondido en 30 s');
    await jest.advanceTimersByTimeAsync(30_000);
    await outcome;
    expect(signal?.aborted).toBe(true);
  } finally {
    jest.useRealTimers();
  }
});

test('si el servidor rechaza la prueba de voz, se dice el código (para saber qué falla)', async () => {
  fetchMock.mockResolvedValueOnce({ ok: false, status: 503, json: async () => ({ error: 'Servicio no disponible' }) });
  await expect(SpeechService.synthesize(DEMO_VOICE_SAMPLE, 'Sulafat', 'preview')).rejects.toThrow('Servicio no disponible (HTTP 503)');
});

test('la prueba de voz se guarda en el móvil: «Probar» solo la pide al servidor la primera vez', async () => {
  const wav = 'UklGR' + 'A'.repeat(4000);
  fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => ({ audioBase64: wav }) });
  const first = await SpeechService.synthesize(DEMO_VOICE_SAMPLE, 'Achird', 'preview');
  first.cleanup(); // al terminar de sonar NO se borra la prueba guardada
  const second = await SpeechService.synthesize(DEMO_VOICE_SAMPLE, 'Achird', 'preview');
  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(second.uri).toBe(first.uri);
  // Otra voz es otra grabación.
  await SpeechService.synthesize(DEMO_VOICE_SAMPLE, 'Sulafat', 'preview');
  expect(fetchMock).toHaveBeenCalledTimes(2);
});

test('una prueba guardada incompleta no se usa: se vuelve a pedir', async () => {
  fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => ({ audioBase64: 'UklGRg==' }) });
  await SpeechService.synthesize(DEMO_VOICE_SAMPLE, 'Sulafat', 'preview');
  await SpeechService.synthesize(DEMO_VOICE_SAMPLE, 'Sulafat', 'preview');
  expect(fetchMock).toHaveBeenCalledTimes(2);
});

test('las lecturas y el asistente nunca usan audio guardado (cada texto es distinto)', async () => {
  await SpeechService.synthesize('Paracetamol 500 mg.', 'Sulafat', 'reading');
  await SpeechService.synthesize('Paracetamol 500 mg.', 'Sulafat', 'reading');
  expect(mockInvoke).toHaveBeenCalledTimes(2);
});
