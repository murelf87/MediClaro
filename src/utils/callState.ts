/**
 * Estados y textos de una llamada de voz con el cuidador/a (puros, probados en __tests__/callState.test.ts).
 */
import type { CareCall } from '../services/CareCallService';

export type CallPhase = 'starting' | 'calling' | 'incoming' | 'connecting' | 'connected' | 'ended';
export type CallEndReason =
  | 'hangup' // colgué yo
  | 'cancelled' // colgué yo antes de que contestara
  | 'other_hangup' // colgó la otra persona
  | 'declined' // la otra persona no pudo atender (rechazó)
  | 'declined_by_me'
  | 'no_answer' // no contestó a tiempo
  | 'missed' // me llamaron y no contesté a tiempo (o colgaron antes)
  | 'failed'
  | 'busy'
  | 'unavailable';

/** Por qué terminó una llamada según el servidor, visto desde este teléfono. */
export function endReasonFrom(call: Pick<CareCall, 'direction' | 'outcome'>, mine: 'hangup' | 'decline' | null): CallEndReason {
  switch (call.outcome) {
    case 'answered':
      return mine === 'hangup' ? 'hangup' : 'other_hangup';
    case 'declined':
      return call.direction === 'incoming' ? 'declined_by_me' : 'declined';
    case 'failed':
      return 'failed';
    default:
      if (mine === 'hangup' && call.direction === 'outgoing') return 'cancelled';
      return call.direction === 'outgoing' ? 'no_answer' : 'missed';
  }
}

/** Texto grande de la pantalla al terminar. */
export function endTitle(reason: CallEndReason, otherFirst: string): string {
  switch (reason) {
    case 'hangup':
    case 'other_hangup':
      return 'Llamada finalizada';
    case 'cancelled':
      return 'Llamada cancelada';
    case 'declined':
      return `${otherFirst} no puede atender ahora`;
    case 'declined_by_me':
      return 'Has rechazado la llamada';
    case 'no_answer':
      return `${otherFirst} no contesta`;
    case 'missed':
      return 'Llamada perdida';
    case 'busy':
      return 'Ya hay una llamada en curso';
    case 'unavailable':
      return 'La llamada no está disponible';
    default:
      return 'No se ha podido conectar la llamada';
  }
}

/** «02:15» o «1:02:15». */
export function callClock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const hh = Math.floor(s / 3600);
  const mm = String(Math.floor((s % 3600) / 60)).padStart(2, '0');
  const ss = String(s % 60).padStart(2, '0');
  return hh ? `${hh}:${mm}:${ss}` : `${mm}:${ss}`;
}

