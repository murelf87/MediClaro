/**
 * AssistantService — mini chat con el asistente IA de MediClaro.
 *
 * Backend usado (sin modificarlo): Edge Function `chat`
 *   request  { messages: {role, content}[], medicineId? }
 *   response { reply, sourceUrl } | { emergency: true, resources: {label, phone}[] }
 *
 * El backend NO guarda el historial: la conversación vive en memoria mientras
 * la app está abierta (se borra al cerrar sesión o al pulsar "Nueva conversación").
 */
import { invokeFunction, requireUserId, toAppError } from '../api';
import { recordRecentUserMessage } from './emergency/EmergencyReportService';
import { AiConsentService } from './AiConsentService';
import type { AssistantContext, AssistantMessage, EmergencyResource } from '../types';

type RawChat =
  | { reply: string; sourceUrl: string | null }
  | { emergency: true; resources: EmergencyResource[] };

type Listener = (messages: AssistantMessage[]) => void;

const MAX_CONTEXT_MESSAGES = 10;
const MAX_MESSAGE_LENGTH = 1000;

const conversations = new Map<string, AssistantMessage[]>();
const listeners = new Map<string, Set<Listener>>();
let idCounter = 0;

function newId(): string {
  idCounter += 1;
  return `m${Date.now().toString(36)}${idCounter}`;
}

function emit(key: string): void {
  const list = conversations.get(key) ?? [];
  listeners.get(key)?.forEach((l) => l([...list]));
}

function update(key: string, fn: (list: AssistantMessage[]) => AssistantMessage[]): void {
  conversations.set(key, fn(conversations.get(key) ?? []));
  emit(key);
}

/** Construye el historial que espera el backend: turnos alternos, empieza y acaba en usuario. */
export function buildPayload(messages: AssistantMessage[]): { role: 'user' | 'assistant'; content: string }[] {
  const usable = messages.filter((m) => m.text.trim() && m.status !== 'error' && !m.emergency);
  const merged: { role: 'user' | 'assistant'; content: string }[] = [];
  for (const m of usable) {
    const content = m.text.trim().slice(0, MAX_MESSAGE_LENGTH);
    const last = merged[merged.length - 1];
    if (last && last.role === m.role) last.content = `${last.content}\n${content}`.slice(0, MAX_MESSAGE_LENGTH);
    else merged.push({ role: m.role, content });
  }
  while (merged.length && merged[0].role === 'assistant') merged.shift();
  return merged.slice(-MAX_CONTEXT_MESSAGES);
}

export const AssistantService = {
  conversationKey(ctx?: AssistantContext): string {
    return ctx?.medicationId ? `med:${ctx.medicationId}` : 'general';
  },

  getConversation(key: string): AssistantMessage[] {
    return [...(conversations.get(key) ?? [])];
  },

  subscribe(key: string, listener: Listener): () => void {
    if (!listeners.has(key)) listeners.set(key, new Set());
    listeners.get(key)!.add(listener);
    return () => listeners.get(key)?.delete(listener);
  },

  clearConversation(key: string): void {
    conversations.delete(key);
    emit(key);
  },

  clearAll(): void {
    const keys = [...conversations.keys()];
    conversations.clear();
    keys.forEach(emit);
  },

  /** Envía una pregunta. Nunca lanza: el error queda reflejado en el mensaje. */
  async sendMessage(key: string, text: string, ctx?: AssistantContext): Promise<void> {
    const clean = text.trim().slice(0, MAX_MESSAGE_LENGTH);
    if (!clean) return;
    const userMsg: AssistantMessage = {
      id: newId(),
      role: 'user',
      text: clean,
      createdAt: new Date().toISOString(),
      status: 'sending',
    };
    update(key, (list) => [...list, userMsg]);
    void recordRecentUserMessage(clean);
    await AssistantService.deliver(key, userMsg.id, ctx);
  },

  /** Reintenta un mensaje que falló. */
  async retryMessage(key: string, messageId: string, ctx?: AssistantContext): Promise<void> {
    update(key, (list) =>
      list.map((m) => (m.id === messageId ? { ...m, status: 'sending', errorKind: undefined, errorCode: undefined, errorMessage: undefined } : m)),
    );
    await AssistantService.deliver(key, messageId, ctx);
  },

  async deliver(key: string, messageId: string, ctx?: AssistantContext): Promise<void> {
    try {
      await requireUserId();
      // Red de seguridad: nada sale hacia la IA sin el permiso explícito de la persona.
      await AiConsentService.assertGranted();
      const list = conversations.get(key) ?? [];
      const idx = list.findIndex((m) => m.id === messageId);
      const history = idx >= 0 ? list.slice(0, idx + 1) : list;
      const payload = buildPayload(history.map((m) => (m.id === messageId ? { ...m, status: 'sent' } : m)));
      const body: Record<string, unknown> = { messages: payload };
      if (ctx?.medicationId && /^[\w-]{1,20}$/.test(ctx.medicationId)) body.medicineId = ctx.medicationId;

      const res = await invokeFunction<RawChat>('chat', body, { timeoutMs: 45_000 });

      const reply: AssistantMessage =
        'emergency' in res && res.emergency
          ? {
              id: newId(),
              role: 'assistant',
              text: 'Lo que describes puede ser una urgencia. Si te encuentras mal, llama ahora al 112.',
              createdAt: new Date().toISOString(),
              emergency: { resources: Array.isArray(res.resources) ? res.resources : [] },
            }
          : {
              id: newId(),
              role: 'assistant',
              text: (res as { reply?: string }).reply?.trim() || 'No he podido responder. ¿Puedes repetir la pregunta?',
              createdAt: new Date().toISOString(),
              sourceUrl: (res as { sourceUrl?: string | null }).sourceUrl ?? null,
            };

      // Si la conversación se borró mientras llegaba la respuesta, se descarta.
      if (!(conversations.get(key) ?? []).some((m) => m.id === messageId)) return;
      update(key, (l) => {
        const next = l.map((m) => (m.id === messageId ? { ...m, status: 'sent' as const } : m));
        const pos = next.findIndex((m) => m.id === messageId);
        next.splice(pos + 1, 0, reply);
        return next;
      });
    } catch (e) {
      const err = toAppError(e);
      if (!(conversations.get(key) ?? []).some((m) => m.id === messageId)) return;
      update(key, (l) =>
        l.map((m) => (m.id === messageId ? { ...m, status: 'error', errorKind: err.kind, errorCode: err.code, errorMessage: err.message } : m)),
      );
    }
  },
};
