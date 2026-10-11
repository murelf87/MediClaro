/**
 * Conversación con el asistente IA (se conserva al cambiar de pantalla).
 */
import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { AssistantThreads } from '../services/AssistantThreads';
import { AssistantService } from '../services/AssistantService';
import type { AssistantContext, AssistantMessage } from '../types';

export function useAssistantConversation(ctx?: AssistantContext) {
  // Sin medicamento, la conversación es la que la persona tenga abierta (puede abrir otra nueva o volver a una anterior).
  const generalKey = useSyncExternalStore(AssistantThreads.subscribe, AssistantThreads.activeKey, AssistantThreads.activeKey);
  const key = ctx?.medicationId ? AssistantService.conversationKey(ctx) : generalKey;
  useEffect(() => { void AssistantThreads.load(); }, []);
  const [messages, setMessages] = useState<AssistantMessage[]>(() => AssistantService.getConversation(key));

  useEffect(() => {
    setMessages(AssistantService.getConversation(key));
    const unsubscribe=AssistantService.subscribe(key, setMessages);
    void AssistantService.loadConversation(key).catch(()=>undefined);
    return unsubscribe;
  }, [key]);

  const sending = messages.some((m) => m.status === 'sending');

  const send = useCallback((text: string) => AssistantService.sendMessage(key, text, ctx), [key, ctx?.medicationId]);
  const retry = useCallback((id: string) => AssistantService.retryMessage(key, id, ctx), [key, ctx?.medicationId]);
  const clear = useCallback(() => AssistantService.clearConversation(key), [key]);

  return { messages, sending, send, retry, clear };
}
