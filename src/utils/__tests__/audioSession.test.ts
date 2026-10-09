/**
 * «Hablar con Lucía» en iPhone: expo-audio rechaza la grabación si antes no se activa en la sesión de audio.
 * Después de grabar, la voz debe volver a sonar por el ALTAVOZ (no por el auricular) y con el modo silencio activado.
 */
const mockSetAudioMode = jest.fn(async (_mode: Record<string, unknown>) => undefined);
jest.mock('expo-audio', () => ({ setAudioModeAsync: (mode: Record<string, unknown>) => mockSetAudioMode(mode) }), { virtual: true });
import { configureAudioForRecording, configureAudioForSpeech } from '../audio';

beforeEach(() => mockSetAudioMode.mockClear());

test('antes de grabar se permite la grabación (si no, iOS lanza RecordingDisabledException)', async () => {
  await configureAudioForRecording();
  expect(mockSetAudioMode).toHaveBeenCalledWith(expect.objectContaining({
    allowsRecording: true,
    playsInSilentMode: true,
    shouldRouteThroughEarpiece: false,
  }));
});

test('la lectura en voz alta suena con el interruptor de silencio y por el altavoz', async () => {
  await configureAudioForSpeech();
  expect(mockSetAudioMode).toHaveBeenCalledWith(expect.objectContaining({
    allowsRecording: false,
    playsInSilentMode: true,
    shouldRouteThroughEarpiece: false,
  }));
});

test('si el sistema no deja grabar, se informa (no se ignora en silencio)', async () => {
  mockSetAudioMode.mockRejectedValueOnce(new Error('denied'));
  await expect(configureAudioForRecording()).rejects.toThrow('denied');
});

test('la pantalla de Lucía activa la grabación ANTES de preparar el micrófono (regresión)', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const fs = require('fs') as typeof import('fs');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const path = require('path') as typeof import('path');
  const source = fs.readFileSync(path.resolve(__dirname, '../../screens/assistant/AssistantScreen.tsx'), 'utf8');
  const begin = source.indexOf('const beginVoiceMessage');
  const end = source.indexOf('const finishVoiceMessage');
  const body = source.slice(begin, end);
  expect(begin).toBeGreaterThan(0);
  expect(body.indexOf('configureAudioForRecording()')).toBeGreaterThan(0);
  expect(body.indexOf('configureAudioForRecording()')).toBeLessThan(body.indexOf('prepareToRecordAsync()'));
});
