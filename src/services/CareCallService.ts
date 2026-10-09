/**
 * Llamadas de voz por internet entre la persona Premium y su cuidador/a (como en WhatsApp), desde el chat.
 *
 * - Señalización por la función del servidor `care_call_action` (migración 20261009150000_care_chat_and_calls.sql):
 *   llamar, contestar, rechazar, colgar y «¿me están llamando?». El audio va de móvil a móvil (WebRTC, cifrado) y
 *   nunca pasa por la base de datos. Las pantallas no conocen Supabase: solo usan este servicio.
 * - Una llamada sin contestar suena 45 s y queda «Llamada perdida» en el chat.
 * - Para llamar, la persona cuidada debe tener Premium (el cuidador/a sigue siendo gratis).
 */
import { supabase } from '../lib/supabase';
import { invokeFunction } from '../api/functions';
import { AppError, toAppError } from '../api/errors';
import type { CareCallOutcome } from './CareChatService';

export interface CareCall {
  id: string;
  linkId: string;
  direction: 'outgoing' | 'incoming';
  callerId: string;
  recipientId: string;
  otherName: string;
  state: 'ringing' | 'answered' | 'ended';
  outcome: CareCallOutcome | null;
  /** Solo para quien recibe la llamada mientras suena. */
  offer: string | null;
  /** Solo para quien llama, una vez contestada. */
  answer: string | null;
  createdAt: string;
  answeredAt: string | null;
  endedAt: string | null;
  expiresAt: string;
}

export interface RtcConfig {
  iceServers: Array<{ urls: string | string[]; username?: string; credential?: string }>;
  relayMode?: string;
}

export const CARE_CALL_NOT_DEPLOYED = 'CARE_CALL_NOT_DEPLOYED';

const SERVER_CODES: Record<string, { kind: AppError['kind']; message: string }> = {
  CALL_BUSY: { kind: 'conflict', message: 'Ya hay una llamada en curso. Inténtalo dentro de un momento.' },
  CALL_ENDED: { kind: 'conflict', message: 'Esta llamada ya ha terminado.' },
  PREMIUM_REQUIRED: { kind: 'limit_reached', message: 'Las llamadas necesitan que la persona cuidada tenga MediClaro Premium activo.' },
  NOT_ALLOWED: { kind: 'permission_denied', message: 'Esta llamada ya no está disponible.' },
  INVALID_SDP: { kind: 'invalid_input', message: 'No se ha podido preparar el audio de la llamada.' },
  INVALID_REQUEST: { kind: 'invalid_input', message: 'No se ha podido llamar. Inténtalo de nuevo.' },
  RATE_LIMIT: { kind: 'rate_limited', message: 'Demasiados intentos seguidos. Espera un momento.' },
  AUTH_REQUIRED: { kind: 'unauthorized', message: '' },
};

export function careCallError(error: { message?: string; code?: string } | null | undefined): AppError {
  const message = String(error?.message ?? '');
  for (const [code, mapped] of Object.entries(SERVER_CODES)) {
    if (message.includes(code)) return new AppError(mapped.kind, mapped.message || undefined, { code });
  }
  if (error?.code === 'PGRST202' || error?.code === '42883' || /care_call_action/.test(message)) {
    return new AppError('not_configured', 'Las llamadas todavía no están activadas en el servidor de MediClaro.', { code: CARE_CALL_NOT_DEPLOYED });
  }
  return toAppError(error ?? new Error('unknown'));
}

type Payload = Record<string, unknown>;
const obj = (v: unknown): Payload => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Payload) : {});
const str = (v: unknown): string => (typeof v === 'string' ? v : '');
const strOrNull = (v: unknown): string | null => (typeof v === 'string' && v ? v : null);

export function parseCall(v: unknown): CareCall | null {
  const c = obj(v);
  const id = str(c.id);
  if (!id) return null;
  const state = c.state === 'answered' || c.state === 'ended' ? c.state : 'ringing';
  const outcome = str(c.outcome);
  return {
    id,
    linkId: str(c.linkId),
    direction: c.direction === 'incoming' ? 'incoming' : 'outgoing',
    callerId: str(c.callerId),
    recipientId: str(c.recipientId),
    otherName: str(c.otherName).trim() || 'Tu familiar',
    state,
    outcome: ['answered', 'missed', 'declined', 'failed'].includes(outcome) ? (outcome as CareCallOutcome) : null,
    offer: strOrNull(c.offer),
    answer: strOrNull(c.answer),
    createdAt: str(c.createdAt),
    answeredAt: strOrNull(c.answeredAt),
    endedAt: strOrNull(c.endedAt),
    expiresAt: str(c.expiresAt),
  };
}

async function call(action: string, payload: Payload = {}): Promise<CareCall | null> {
  const { data, error } = await supabase.rpc('care_call_action', { p_action: action, p_payload: payload });
  if (error) throw careCallError(error);
  return parseCall(data);
}

async function must(action: string, payload: Payload): Promise<CareCall> {
  const c = await call(action, payload);
  if (!c) throw new AppError('unknown', 'No se ha podido completar la llamada.');
  return c;
}

let screenOpen = false;
const checkListeners = new Set<() => void>();

export const CareCallService = {
  /** La llamada que está sonando para la persona (o null). */
  incoming: (): Promise<CareCall | null> => call('incoming'),
  offer: (linkId: string, callId: string, sdp: string) => must('offer', { linkId, callId, sdp }),
  snapshot: (callId: string) => must('snapshot', { callId }),
  answer: (callId: string, sdp: string) => must('answer', { callId, sdp }),
  decline: (callId: string) => must('decline', { callId }),
  end: (callId: string) => must('end', { callId }),
  fail: (callId: string) => must('fail', { callId }),

  /** Servidores para conectar el audio (credenciales temporales, comprobadas con la sesión de quien llama). */
  async rtcConfig(linkId: string): Promise<RtcConfig> {
    const config = await invokeFunction<RtcConfig>('caregiver-rtc-config', { linkId }, { timeoutMs: 15_000 });
    if (!config?.iceServers?.length) {
      throw new AppError('provider_down', 'La conexión para llamadas todavía no está disponible.');
    }
    return config;
  },

  // ── Pantalla de llamada abierta (para no abrir otra encima al detectar una entrante) ──
  setScreenOpen(open: boolean): void {
    screenOpen = open;
  },
  isScreenOpen(): boolean {
    return screenOpen;
  },
  /** Pide comprobar ya si hay una llamada entrante (p. ej. al llegar el aviso «X te está llamando»). */
  requestIncomingCheck(): void {
    checkListeners.forEach((l) => l());
  },
  onIncomingCheck(listener: () => void): () => void {
    checkListeners.add(listener);
    return () => {
      checkListeners.delete(listener);
    };
  },
};
