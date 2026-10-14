/**
 * Conversación del chat con el cuidador/a: días («Hoy», «Ayer», «Lunes 6 de octubre»), horas y grupos de mensajes
 * seguidos de la misma persona (para juntar las burbujas como en cualquier chat).
 * Puro y determinista en iOS, Android y web (sin Intl). Probado en __tests__/chatTimeline.test.ts.
 */
import { formatTime } from './format';

const WEEKDAYS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

export interface TimelineMessage {
  id: string;
  senderId: string;
  createdAt: string;
}

export type ChatRow<M extends TimelineMessage> =
  | { kind: 'day'; key: string; label: string }
  | { kind: 'message'; key: string; message: M; mine: boolean; firstInGroup: boolean; lastInGroup: boolean };

function valid(iso: string): Date | null {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Día local «AAAA-MM-DD» de un instante. */
export function chatDayKey(iso: string): string {
  const d = valid(iso);
  if (!d) return '';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** «Hoy», «Ayer», «Lunes 6 de octubre» (con el año si no es el actual). */
export function chatDayLabel(iso: string, now: Date = new Date()): string {
  const d = valid(iso);
  if (!d) return '';
  const day = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((day(now) - day(d)) / 86_400_000);
  if (diff === 0) return 'Hoy';
  if (diff === 1) return 'Ayer';
  const weekday = WEEKDAYS[d.getDay()];
  const base = `${weekday.charAt(0).toUpperCase()}${weekday.slice(1)} ${d.getDate()} de ${MONTHS[d.getMonth()]}`;
  return d.getFullYear() === now.getFullYear() ? base : `${base} de ${d.getFullYear()}`;
}

/** «14:05» (hora del teléfono). */
export const chatTime = (iso: string): string => formatTime(iso);

/** Del más antiguo al más reciente; con la misma hora, por identificador (orden estable). */
export function sortChat<M extends TimelineMessage>(messages: readonly M[]): M[] {
  return [...messages].sort((a, b) => {
    const t = Date.parse(a.createdAt) - Date.parse(b.createdAt);
    return t !== 0 && Number.isFinite(t) ? t : a.id.localeCompare(b.id);
  });
}

/**
 * Filas de la conversación: un separador por día y cada mensaje marcado como primero/último de su grupo (mensajes
 * seguidos de la misma persona, el mismo día y con menos de `groupMinutes` entre ellos).
 */
export function buildChatRows<M extends TimelineMessage>(
  messages: readonly M[],
  myId: string | null | undefined,
  now: Date = new Date(),
  groupMinutes = 5,
): ChatRow<M>[] {
  const sorted = sortChat(messages);
  const rows: ChatRow<M>[] = [];
  const gap = groupMinutes * 60_000;
  const sameGroup = (a: M | undefined, b: M | undefined) =>
    !!a && !!b && a.senderId === b.senderId && chatDayKey(a.createdAt) === chatDayKey(b.createdAt) &&
    Math.abs(Date.parse(b.createdAt) - Date.parse(a.createdAt)) <= gap;
  let lastDay = '';
  sorted.forEach((m, i) => {
    const day = chatDayKey(m.createdAt);
    if (day !== lastDay) {
      rows.push({ kind: 'day', key: `day-${day}`, label: chatDayLabel(m.createdAt, now) });
      lastDay = day;
    }
    rows.push({
      kind: 'message',
      key: m.id,
      message: m,
      mine: !!myId && m.senderId === myId,
      firstInGroup: !sameGroup(sorted[i - 1], m),
      lastInGroup: !sameGroup(m, sorted[i + 1]),
    });
  });
  return rows;
}

// ─── Mensajes que aún están saliendo de este teléfono ─────────────────────────────────────────────────────

export type ChatItemStatus = 'sending' | 'failed' | 'sent' | 'read';

/** Mensaje tal y como se pinta: los del servidor y los que aún están saliendo de este teléfono. */
export interface ChatItem extends TimelineMessage {
  linkId: string;
  content: string;
  readAt: string | null;
  kind?: 'text' | 'call';
  callOutcome?: 'answered' | 'missed' | 'declined' | 'failed' | null;
  callSeconds?: number | null;
  status: ChatItemStatus;
  /** Solo en los mensajes aún no confirmados por el servidor. */
  clientKey?: string;
  error?: string;
}

type ServerMessage = Omit<ChatItem, 'status' | 'clientKey' | 'error'>;

/**
 * Une lo que dice el servidor con lo que aún está saliendo de este teléfono. Si un mensaje que se dio por fallido sí
 * llegó (se perdió la respuesta), el del servidor sustituye al local: nunca se ven dos iguales.
 */
export function mergeChat(server: readonly ServerMessage[], local: readonly ChatItem[], myId: string | null): ChatItem[] {
  const fromServer: ChatItem[] = server.map((m) => ({ ...m, status: m.senderId === myId && m.readAt ? 'read' : 'sent' }));
  const used = new Set<string>();
  const pending = local.filter((p) => {
    if (p.status !== 'sending' && p.status !== 'failed') return false;
    const twin = fromServer.find(
      (m) => !used.has(m.id) && m.senderId === p.senderId && m.content === p.content &&
        Math.abs(Date.parse(m.createdAt) - Date.parse(p.createdAt)) < 10 * 60_000,
    );
    if (twin && p.status === 'failed') {
      used.add(twin.id);
      return false;
    }
    return true;
  });
  return sortChat([...fromServer, ...pending]);
}

// ─── Registro de llamadas en la conversación ──────────────────────────────────────────────────────────────

/** «45 s», «2 min», «1 h 5 min». */
export function callDuration(seconds: number | null | undefined): string {
  const s = Math.max(0, Math.floor(seconds ?? 0));
  if (s < 60) return `${s} s`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const rest = m % 60;
  return rest ? `${h} h ${rest} min` : `${h} h`;
}

/** Texto de una llamada en el chat, según quién llamó (mine = la llamé yo). */
export function callLogLabel(outcome: ChatItem['callOutcome'], mine: boolean, seconds?: number | null): string {
  switch (outcome) {
    case 'answered':
      return `Llamada de voz · ${callDuration(seconds)}`;
    case 'declined':
      return mine ? 'Llamada rechazada' : 'Rechazaste la llamada';
    case 'failed':
      return 'La llamada no se pudo conectar';
    default:
      return mine ? 'Llamada sin respuesta' : 'Llamada perdida';
  }
}
