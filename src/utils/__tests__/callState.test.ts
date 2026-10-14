/**
 * Llamada de voz con el cuidador/a: por qué terminó (visto desde cada teléfono), qué se dice y el contador.
 */
import { callClock, endReasonFrom, endTitle } from '../callState';
import { callDuration, callLogLabel } from '../chatTimeline';

test('por qué terminó, desde quien llama y desde quien recibe', () => {
  expect(endReasonFrom({ direction: 'outgoing', outcome: 'answered' }, 'hangup')).toBe('hangup');
  expect(endReasonFrom({ direction: 'outgoing', outcome: 'answered' }, null)).toBe('other_hangup');
  expect(endReasonFrom({ direction: 'outgoing', outcome: 'declined' }, null)).toBe('declined');
  expect(endReasonFrom({ direction: 'incoming', outcome: 'declined' }, 'decline')).toBe('declined_by_me');
  expect(endReasonFrom({ direction: 'outgoing', outcome: 'missed' }, null)).toBe('no_answer');
  expect(endReasonFrom({ direction: 'outgoing', outcome: 'missed' }, 'hangup')).toBe('cancelled');
  expect(endReasonFrom({ direction: 'incoming', outcome: 'missed' }, null)).toBe('missed');
  expect(endReasonFrom({ direction: 'incoming', outcome: 'failed' }, null)).toBe('failed');
});

test('textos claros al terminar', () => {
  expect(endTitle('no_answer', 'Javier')).toBe('Javier no contesta');
  expect(endTitle('declined', 'Javier')).toBe('Javier no puede atender ahora');
  expect(endTitle('missed', 'Javier')).toBe('Llamada perdida');
  expect(endTitle('other_hangup', 'Javier')).toBe('Llamada finalizada');
  expect(endTitle('busy', 'Javier')).toBe('Ya hay una llamada en curso');
});

test('contador y duración', () => {
  expect(callClock(0)).toBe('00:00');
  expect(callClock(135)).toBe('02:15');
  expect(callClock(3725)).toBe('1:02:05');
  expect(callDuration(45)).toBe('45 s');
  expect(callDuration(135)).toBe('2 min');
  expect(callDuration(3900)).toBe('1 h 5 min');
});

test('registro de la llamada en el chat, según quién llamó', () => {
  expect(callLogLabel('answered', true, 95)).toBe('Llamada de voz · 2 min');
  expect(callLogLabel('missed', false)).toBe('Llamada perdida');
  expect(callLogLabel('missed', true)).toBe('Llamada sin respuesta');
  expect(callLogLabel('declined', true)).toBe('Llamada rechazada');
  expect(callLogLabel('declined', false)).toBe('Rechazaste la llamada');
  expect(callLogLabel('failed', true)).toBe('La llamada no se pudo conectar');
});
