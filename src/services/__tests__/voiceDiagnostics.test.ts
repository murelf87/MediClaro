/**
 * Diagnóstico de la voz natural: si no suena en un móvil, queda dicho EN QUÉ PASO falló y cuánto tardó (para el panel
 * «Revisar la app» y, en las compilaciones de prueba, para «Errores notificados»).
 */
const mockSend = jest.fn(async (..._a: unknown[]) => ({ ref: 'E-TEST1' }));
jest.mock('../ProblemReportService', () => ({ ProblemReportService: { send: (...a: unknown[]) => mockSend(...a) } }));
import { DEMO_ACCESS_ENABLED } from '../../config/app';
import { __resetVoiceDiagnostics, clearVoiceFailure, errorText, lastVoiceFailure, startVoiceTrace } from '../VoiceDiagnostics';

beforeEach(async () => {
  mockSend.mockClear();
  __resetVoiceDiagnostics();
  await clearVoiceFailure();
});

test('anota cada paso con su tiempo y el último alcanzado', () => {
  let t = 1_000;
  const trace = startVoiceTrace('prueba de voz', 'Sulafat', () => t);
  t = 1_100;
  trace.step('audio', 'timeout');
  t = 1_600;
  trace.step('servidor');
  expect(trace.last()).toBe('servidor');
  expect(trace.summary()).toBe('inicio 0,0 s → audio (timeout) 0,1 s → servidor 0,6 s');
});

test('un fallo queda guardado en el móvil con el motivo y los pasos, y se puede borrar', async () => {
  let t = 0;
  const trace = startVoiceTrace('asistente', 'Achird', () => t);
  t = 400;
  trace.step('servidor');
  t = 20_400;
  trace.fail('no ha llegado en 20 s');
  trace.fail('otro motivo'); // solo cuenta el primero
  __resetVoiceDiagnostics(); // como al volver a abrir la app: se lee lo guardado
  const failure = await lastVoiceFailure();
  expect(failure?.text).toBe('La voz natural (Achird, asistente) no ha sonado: no ha llegado en 20 s. Pasos: inicio 0,0 s → servidor 0,4 s');
  expect(Number.isNaN(Date.parse(failure!.at))).toBe(false);
  await clearVoiceFailure();
  expect(await lastVoiceFailure()).toBeNull();
});

test('en las compilaciones de prueba se notifica sola (como mucho una vez cada 10 minutos); en la de las tiendas, nunca', () => {
  let t = 1_000_000;
  startVoiceTrace('prueba de voz', 'Sulafat', () => t).fail('HTTP 503');
  t += 60_000;
  startVoiceTrace('prueba de voz', 'Sulafat', () => t).fail('HTTP 503');
  t += 10 * 60_000;
  startVoiceTrace('prueba de voz', 'Sulafat', () => t).fail('HTTP 503');
  if (!DEMO_ACCESS_ENABLED) {
    expect(mockSend).not.toHaveBeenCalled();
    return;
  }
  expect(mockSend).toHaveBeenCalledTimes(2);
  const [message, contact, context] = mockSend.mock.calls[0] as [string, string, { area: string }];
  expect(message.startsWith('[Automático] La voz natural (Sulafat, prueba de voz) no ha sonado: HTTP 503.')).toBe(true);
  expect(contact).toBe('');
  expect(context).toEqual({ area: 'Voz (automático)' });
});

test('el motivo siempre es una frase corta y limpia', () => {
  expect(errorText(new Error('  fallo\n  de red '))).toBe('fallo de red');
  expect(errorText('x'.repeat(500))).toHaveLength(200);
  expect(errorText(undefined)).toBe('error desconocido');
});
