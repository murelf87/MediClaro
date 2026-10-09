/**
 * AssistantService — mini chat con el asistente IA de MediClaro.
 *
 * Backend: Edge Function `chat` + historial privado persistente.
 * La conversación se recupera después de cerrar/reabrir la app. El borrado
 * permanente solo se hace mediante la acción explícita de privacidad del usuario.
 */
import { invokeFunction, requireUserId, supabase, toAppError } from '../api';
import { MedicationPlanService } from './MedicationPlanService';
import { answerMedicationQuestion, detectMedicationIntent, deviceZone } from '../domain/medication';

/**
 * Sin conexión, las preguntas sobre SUS tomas («¿me he tomado…?», «¿qué me queda hoy?») se responden con lo guardado
 * en este teléfono (mismas reglas que el servidor) y se dice que es sin conexión. El resto necesita internet.
 */
async function offlineMedicationReply(question: string): Promise<string | null> {
  const state = MedicationPlanService.getState() ?? (await MedicationPlanService.load().catch(() => null));
  if (!state) return null;
  const match = detectMedicationIntent(question, state.treatments);
  if (!match) return null;
  const answer = answerMedicationQuestion(match, { now: new Date(), zone: deviceZone(), treatments: state.treatments, events: state.events });
  return `${answer}\n\n(Sin conexión: respuesta con los datos guardados en este móvil.)`;
}
import { recordRecentUserMessage } from './emergency/EmergencyReportService';
import { AiConsentService } from './AiConsentService';
import { AssistantMemoryService } from './AssistantMemoryService';
import type { AssistantContext, AssistantMessage, EmergencyResource } from '../types';

type RawChat =
  | { reply: string; sourceUrl: string | null; messageId?: string }
  | { emergency: true; resources: EmergencyResource[]; reply?: string; messageId?: string };

type Listener = (messages: AssistantMessage[]) => void;

const MAX_CONTEXT_MESSAGES = 10;
const MAX_MESSAGE_LENGTH = 1000;

const conversations = new Map<string, AssistantMessage[]>();
const listeners = new Map<string, Set<Listener>>();
const loadedKeys = new Set<string>();
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
  const recent = merged.slice(-MAX_CONTEXT_MESSAGES);
  while (recent.length && recent[0].role === 'assistant') recent.shift();
  return recent;
}

/** Only the latest turn may start an emergency flow; old alerts are history. */
export function currentEmergencyMessage(messages: AssistantMessage[]): AssistantMessage | null {
  const latest = messages[messages.length - 1];
  return latest?.role === 'assistant' && latest.emergency ? latest : null;
}

/** Convierte Markdown ligero del modelo a texto limpio para React Native y lectura por voz. */
export function normalizeAssistantText(value: string): string {
  return value
    .replace(/\r\n/g, '\n')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, '$1')
    .replace(/^[ \t]*[-*+][ \t]+/gm, '• ')
    .replace(/\*([^*\n]+)\*/g, '$1')
    .replace(/_([^_\n]+)_/g, '$1')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export const AssistantService = {
  conversationKey(ctx?: AssistantContext): string {
    return ctx?.medicationId ? `med:${ctx.medicationId}` : 'general';
  },

  getConversation(key: string): AssistantMessage[] {
    return [...(conversations.get(key) ?? [])];
  },

  async loadConversation(key: string): Promise<AssistantMessage[]> {
    if (loadedKeys.has(key)) return AssistantService.getConversation(key);
    await requireUserId();
    const { data, error } = await supabase.rpc('my_assistant_history', { p_key: key, p_limit: 180 });
    if (error) throw toAppError(error);
    const rows = Array.isArray(data) ? data : [];
    const restored: AssistantMessage[] = rows.map((row: any) => ({
      id: String(row.client_id),
      role: row.role === 'assistant' ? 'assistant' : 'user',
      text: String(row.content ?? ''),
      createdAt: String(row.created_at ?? new Date().toISOString()),
      sourceUrl: typeof row.source_url === 'string' ? row.source_url : null,
      emergency: row.emergency
        ? { resources: Array.isArray(row.emergency) ? row.emergency : Array.isArray(row.emergency?.resources) ? row.emergency.resources : [] }
        : null,
      status: row.role === 'user' ? 'sent' : undefined,
    }));
    const pending = conversations.get(key) ?? [];
    const byId = new Map<string, AssistantMessage>();
    for (const m of [...restored, ...pending]) byId.set(m.id, m);
    const merged = [...byId.values()].sort((a,b)=>Date.parse(a.createdAt)-Date.parse(b.createdAt));
    conversations.set(key, merged);
    loadedKeys.add(key);
    emit(key);
    return [...merged];
  },

  async deletePersistentHistory(): Promise<void> {
    await requireUserId();
    const { error } = await supabase.rpc('delete_my_assistant_history');
    if (error) throw toAppError(error);
    conversations.clear();
    loadedKeys.clear();
    for (const key of listeners.keys()) emit(key);
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
      const memory = await AssistantMemoryService.get().catch(() => ({ enabled: false }));
      const body: Record<string, unknown> = {
        messages: payload,
        memoryEnabled: memory.enabled,
        conversationKey: key,
        clientMessageId: messageId,
      };
      if (ctx?.medicationId && /^[\w-]{1,20}$/.test(ctx.medicationId)) body.medicineId = ctx.medicationId;

      const res = await invokeFunction<RawChat>('chat', body, { timeoutMs: 65_000 });

      const reply: AssistantMessage =
        'emergency' in res && res.emergency
          ? {
              id: res.messageId ?? newId(),
              role: 'assistant',
              text: normalizeAssistantText(res.reply ?? '') || 'Lo que describes puede ser una urgencia. Puedes avisar a tu cuidador/a o abrir Emergencia.',
              createdAt: new Date().toISOString(),
              emergency: { resources: Array.isArray(res.resources) ? res.resources : [] },
            }
          : {
              id: res.messageId ?? newId(),
              role: 'assistant',
              text: normalizeAssistantText((res as { reply?: string }).reply ?? '') || 'No he podido responder. ¿Puedes repetir la pregunta?',
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
      if (err.kind === 'offline' || err.kind === 'timeout') {
        const question = (conversations.get(key) ?? []).find((m) => m.id === messageId)?.text ?? '';
        const local = await offlineMedicationReply(question).catch(() => null);
        if (local) {
          const reply: AssistantMessage = { id: newId(), role: 'assistant', text: local, createdAt: new Date().toISOString(), sourceUrl: null };
          update(key, (l) => {
            const next = l.map((m) => (m.id === messageId ? { ...m, status: 'sent' as const } : m));
            next.splice(next.findIndex((m) => m.id === messageId) + 1, 0, reply);
            return next;
          });
          return;
        }
      }
      update(key, (l) =>
        l.map((m) => (m.id === messageId ? { ...m, status: 'error', errorKind: err.kind, errorCode: err.code, errorMessage: err.message } : m)),
      );
    }
  },
};
