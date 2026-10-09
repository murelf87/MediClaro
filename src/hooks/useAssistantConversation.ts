/**
 * Conversación con el asistente IA (se conserva al cambiar de pantalla).
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { AssistantService } from '../services/AssistantService';
import type { AssistantContext, AssistantMessage } from '../types';

export function useAssistantConversation(ctx?: AssistantContext) {
  const key = useMemo(() => AssistantService.conversationKey(ctx), [ctx?.medicationId]);
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
