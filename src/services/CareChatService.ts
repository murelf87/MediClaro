/**
 * Chat entre la persona Premium y su cuidador/a (conversación permanente por cada vinculación aceptada).
 *
 * - Todo pasa por la función del servidor `care_chat_action` (migración 20261009150000_care_chat.sql): las pantallas no
 *   conocen Supabase. Solo las dos personas de la vinculación pueden leer o escribir; para escribir, la persona
 *   cuidada debe tener Premium (el cuidador/a sigue siendo gratis).
 * - Envío idempotente: el teléfono crea el `clientKey`; si se pierde la respuesta, reintentar no duplica el mensaje.
 * - Resumen compartido (no leídos por conversación) para el botón central de la barra y la pantalla del cuidador/a.
 * - Si el servidor aún no tiene el chat desplegado, se dice claramente y se deja de consultar en esta sesión.
 */
import { supabase } from '../lib/supabase';
import { AppError, toAppError } from '../api/errors';

export type CareChatRole = 'patient' | 'caregiver';

export type CareCallOutcome = 'answered' | 'missed' | 'declined' | 'failed';

export interface CareChatMessage {
  id: string;
  linkId: string;
  senderId: string;
  content: string;
  createdAt: string;
  readAt: string | null;
  /** 'text': mensaje escrito; 'call': registro de una llamada de voz (lo crea el servidor al terminarla). */
  kind?: 'text' | 'call';
  callOutcome?: CareCallOutcome | null;
  /** Duración de una llamada contestada, en segundos. */
  callSeconds?: number | null;
}

export interface CareConversation {
  linkId: string;
  myRole: CareChatRole;
  otherId: string;
  otherName: string;
  patientName: string;
  /**
   * Se puede escribir ahora mismo (lo decide el servidor): la persona cuidada, siempre que tenga Premium; su
   * cuidador/a, solo mientras la conversación está encendida (ver `openUntil`).
   */
  canSend: boolean;
  /** La persona cuidada tiene Premium (sin Premium, el chat se puede leer pero no escribir). */
  premium: boolean;
  /**
   * La conversación la abre la persona cuidada: desde su último mensaje, su cuidador/a puede responder durante 1 hora.
   * Hasta cuándo está encendida para el cuidador/a; null = apagada (hasta que la persona cuidada vuelva a escribir).
   */
  openUntil: string | null;
  unread: number;
  lastMessage: CareChatMessage | null;
}

/** ¿Está encendido el chat para el cuidador/a en este momento? (en el teléfono, sin esperar al servidor). */
export function chatOpen(c: Pick<CareConversation, 'openUntil'>, now: number = Date.now()): boolean {
  return !!c.openUntil && Date.parse(c.openUntil) > now;
}

/** ¿Puede escribir esta persona ahora mismo? La persona cuidada, con Premium; el cuidador/a, con el chat encendido. */
export function canWriteNow(c: Pick<CareConversation, 'myRole' | 'premium' | 'openUntil'>, now: number = Date.now()): boolean {
  if (!c.premium) return false;
  return c.myRole === 'patient' || chatOpen(c, now);
}

export interface CareChatPage {
  conversation: CareConversation | null;
  messages: CareChatMessage[];
  hasMore: boolean;
}

export const CARE_CHAT_MAX_LENGTH = 1000;
export const CARE_CHAT_NOT_DEPLOYED = 'CARE_CHAT_NOT_DEPLOYED';

// ─── Errores claros ───────────────────────────────────────────────────────────────────────────────────────

const SERVER_CODES: Record<string, { kind: AppError['kind']; message?: string }> = {
  NOT_ALLOWED: { kind: 'permission_denied', message: 'Esta conversación ya no está disponible: la vinculación ha terminado.' },
  PREMIUM_REQUIRED: { kind: 'limit_reached', message: 'El chat está en pausa: la persona cuidada necesita MediClaro Premium activo.' },
  CHAT_CLOSED: { kind: 'permission_denied', message: 'El chat está apagado: se enciende cuando la persona a la que cuidas te escribe, durante 1 hora.' },
  INVALID_CONTENT: { kind: 'invalid_input', message: `Escribe un mensaje de hasta ${CARE_CHAT_MAX_LENGTH} letras.` },
  INVALID_REQUEST: { kind: 'invalid_input', message: 'No se ha podido enviar. Inténtalo de nuevo.' },
  RATE_LIMIT: { kind: 'rate_limited', message: 'Has enviado muchos mensajes seguidos. Espera un momento.' },
  AUTH_REQUIRED: { kind: 'unauthorized' },
};

export function careChatError(error: { message?: string; code?: string; status?: number } | null | undefined): AppError {
  const message = String(error?.message ?? '');
  for (const [code, mapped] of Object.entries(SERVER_CODES)) {
    if (message.includes(code)) return new AppError(mapped.kind, mapped.message, { code });
  }
  // Función aún no desplegada en el servidor (PostgREST: PGRST202; PostgreSQL: 42883).
  if (error?.code === 'PGRST202' || error?.code === '42883' || /care_chat_action/.test(message)) {
    return new AppError('not_configured', 'El chat con tu cuidador/a todavía no está activado en el servidor de MediClaro.', {
      code: CARE_CHAT_NOT_DEPLOYED,
    });
  }
  return toAppError(error ?? new Error('unknown'));
}

// ─── Lectura de la respuesta del servidor ─────────────────────────────────────────────────────────────────

type Payload = Record<string, unknown>;
const obj = (v: unknown): Payload => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Payload) : {});
const str = (v: unknown): string => (typeof v === 'string' ? v : v === null || v === undefined ? '' : String(v));

export function parseCareMessage(v: unknown): CareChatMessage | null {
  const m = obj(v);
  const id = str(m.id);
  const createdAt = str(m.createdAt ?? m.created_at);
  if (!id || !createdAt || Number.isNaN(Date.parse(createdAt))) return null;
  const readAt = str(m.readAt ?? m.read_at);
  const kind = m.kind === 'call' ? 'call' : 'text';
  const outcome = str(m.callOutcome ?? m.call_outcome);
  const seconds = Number(m.callSeconds ?? m.call_seconds);
  return {
    id,
    linkId: str(m.linkId ?? m.link_id),
    senderId: str(m.senderId ?? m.sender_id),
    content: str(m.content),
    createdAt,
    readAt: readAt && !Number.isNaN(Date.parse(readAt)) ? readAt : null,
    kind,
    callOutcome: kind === 'call' && ['answered', 'missed', 'declined', 'failed'].includes(outcome) ? (outcome as CareCallOutcome) : null,
    callSeconds: kind === 'call' && Number.isFinite(seconds) && seconds >= 0 ? Math.floor(seconds) : null,
  };
}

export function parseConversation(v: unknown): CareConversation | null {
  const c = obj(v);
  const linkId = str(c.linkId);
  if (!linkId) return null;
  const unread = Number(c.unread);
  const myRole = c.myRole === 'caregiver' ? 'caregiver' : 'patient';
  const openUntil = str(c.openUntil);
  // Servidor anterior (sin ventana): «premium» no viene y canSend ya dice si se puede escribir.
  const premium = typeof c.premium === 'boolean' ? c.premium : c.canSend === true;
  return {
    linkId,
    myRole,
    otherId: str(c.otherId),
    otherName: str(c.otherName).trim() || (myRole === 'caregiver' ? 'Tu familiar' : 'Tu cuidador/a'),
    patientName: str(c.patientName),
    canSend: c.canSend === true,
    premium,
    openUntil: openUntil && !Number.isNaN(Date.parse(openUntil)) ? openUntil : null,
    unread: Number.isFinite(unread) && unread > 0 ? Math.floor(unread) : 0,
    lastMessage: c.lastMessage ? parseCareMessage(c.lastMessage) : null,
  };
}

const list = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);

async function call(action: string, payload: Payload = {}): Promise<Payload> {
  const { data, error } = await supabase.rpc('care_chat_action', { p_action: action, p_payload: payload });
  if (error) {
    const e = careChatError(error);
    if (e.code === CARE_CHAT_NOT_DEPLOYED && !notDeployed) {
      notDeployed = true;
      // Nueva referencia: las pantallas que dependen de «¿está el chat?» se vuelven a pintar.
      summary = [...summary];
      emit();
    }
    throw e;
  }
  return obj(data);
}

// ─── Resumen compartido (botón central y pantalla del cuidador/a) ──────────────────────────────────────────

let summary: CareConversation[] = [];
let summaryAt = 0;
let inFlight: Promise<CareConversation[]> | null = null;
let notDeployed = false;
let activeLinkId: string | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

function setSummary(next: CareConversation[]): void {
  summary = next;
  summaryAt = Date.now();
  emit();
}

function patchSummary(linkId: string, patch: (c: CareConversation) => CareConversation): void {
  if (!summary.some((c) => c.linkId === linkId)) return;
  summary = summary.map((c) => (c.linkId === linkId ? patch(c) : c));
  emit();
}

export const CareChatService = {
  /** Conversaciones de la persona (con no leídos y el último mensaje). */
  async list(): Promise<CareConversation[]> {
    const data = await call('list');
    const conversations = list(data.conversations).map(parseConversation).filter((c): c is CareConversation => !!c);
    setSummary(conversations);
    return conversations;
  },

  /** Mensajes de una conversación (los más recientes; `before` para cargar los anteriores). */
  async messages(linkId: string, opts: { limit?: number; before?: string } = {}): Promise<CareChatPage> {
    const data = await call('messages', { linkId, limit: opts.limit ?? 80, ...(opts.before ? { before: opts.before } : null) });
    const conversation = parseConversation(data.conversation);
    if (conversation) patchSummary(linkId, () => conversation);
    return {
      conversation,
      messages: list(data.messages).map(parseCareMessage).filter((m): m is CareChatMessage => !!m),
      hasMore: data.hasMore === true,
    };
  },

  async send(linkId: string, content: string, clientKey: string): Promise<{ message: CareChatMessage; replayed: boolean }> {
    const text = content.trim();
    if (!text || text.length > CARE_CHAT_MAX_LENGTH) throw careChatError({ message: 'INVALID_CONTENT' });
    const data = await call('send', { linkId, content: text, clientKey });
    const message = parseCareMessage(data.message);
    if (!message) throw new AppError('unknown');
    patchSummary(linkId, (c) => ({ ...c, lastMessage: message }));
    return { message, replayed: data.replayed === true };
  },

  /** Marca como leídos los mensajes de la otra persona (la otra persona verá «Visto»). */
  async markRead(linkId: string): Promise<number> {
    patchSummary(linkId, (c) => ({ ...c, unread: 0 }));
    const data = await call('read', { linkId });
    return Number(data.read) || 0;
  },

  /** Para «Descargar mis datos» (portabilidad): todas las conversaciones con sus mensajes. */
  async exportForAccount(): Promise<unknown> {
    const data = await call('export');
    return list(data.conversations);
  },

  // ── Resumen compartido ──
  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
  getSummary(): CareConversation[] {
    return summary;
  },
  totalUnread(): number {
    return summary.reduce((n, c) => n + c.unread, 0);
  },
  isAvailable(): boolean {
    return !notDeployed;
  },
  /** Ya se sabe si hay conversaciones (se ha consultado al menos una vez, o el servidor no tiene el chat). */
  isSummaryLoaded(): boolean {
    return summaryAt > 0 || notDeployed;
  },
  /** Vuelve a leer el resumen si tiene más de `maxAgeMs` (una sola consulta a la vez). Nunca lanza. */
  async refreshSummary(maxAgeMs = 15_000): Promise<CareConversation[]> {
    if (notDeployed) return summary;
    if (inFlight) return inFlight;
    if (Date.now() - summaryAt < maxAgeMs) return summary;
    inFlight = CareChatService.list()
      .catch(() => summary)
      .finally(() => {
        inFlight = null;
      });
    return inFlight;
  },

  // ── Conversación abierta (para no avisar de un mensaje que la persona ya está viendo) ──
  setActiveConversation(linkId: string | null): void {
    activeLinkId = linkId;
  },
  isActiveConversation(linkId: unknown): boolean {
    return !!activeLinkId && linkId === activeLinkId;
  },

  /** Al cerrar sesión: nada de la conversación queda en memoria. */
  clear(): void {
    summary = [];
    summaryAt = 0;
    inFlight = null;
    notDeployed = false;
    activeLinkId = null;
    emit();
  },
};
