/**
 * Chat con el cuidador/a:
 *  - useCareChat(linkId): una conversación — mensajes, envío al momento (se ve enseguida; si falla, «Reintentar» con el
 *    mismo identificador, así nunca se duplica), carga de mensajes anteriores, consulta cada 4 s mientras la pantalla
 *    está abierta y «Visto» para la otra persona al leerlos.
 *  - useCareChatSummary(): no leídos de todas las conversaciones (botón central de la barra, pantalla del cuidador/a).
 *  - useChatReader(): «Escuchar» un mensaje con la voz elegida (o la del teléfono si la voz natural no está disponible).
 */
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { AppState, Platform } from 'react-native';
import { useFocusEffect } from 'expo-router';
import * as Crypto from 'expo-crypto';
import * as Speech from 'expo-speech';
import { useSession } from '../providers/SessionProvider';
import { usePreferences } from '../providers/PreferencesProvider';
import { useEntitlement } from '../providers/EntitlementProvider';
import { useGeminiSimpleSpeech } from './useSpeech';
import { CareChatService, type CareChatMessage, type CareConversation } from '../services/CareChatService';
import { DemoMode } from '../services/DemoMode';
import { AppError, toAppError } from '../api/errors';
import { mergeChat, sortChat, type ChatItem } from '../utils/chatTimeline';
import { speakOnDevice } from '../utils/deviceSpeech';

export type { ChatItem, ChatItemStatus } from '../utils/chatTimeline';

const POLL_MS = 4000;
const PAGE = 80;

export function useCareChat(linkId: string | null) {
  const { session } = useSession();
  const myId = session?.userId ?? null;
  const [conversation, setConversation] = useState<CareConversation | null>(() =>
    linkId ? CareChatService.getSummary().find((c) => c.linkId === linkId) ?? null : null,
  );
  const [server, setServer] = useState<CareChatMessage[]>([]);
  const [local, setLocal] = useState<ChatItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<AppError | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const alive = useRef(true);
  const focused = useRef(false);
  const busy = useRef(false);
  const sending = useRef(0);
  const olderLoaded = useRef(false);
  const serverRef = useRef<CareChatMessage[]>([]);
  serverRef.current = server;

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  /** Marca como leídos los mensajes de la otra persona si la conversación está a la vista. */
  const markReadIfNeeded = useCallback((messages: readonly CareChatMessage[]) => {
    if (!linkId || !focused.current || AppState.currentState !== 'active') return;
    if (!messages.some((m) => m.senderId !== myId && !m.readAt)) return;
    void CareChatService.markRead(linkId).catch(() => undefined);
  }, [linkId, myId]);

  const load = useCallback(async () => {
    if (!linkId || busy.current) return;
    // Mientras sale un mensaje no se pisa la lista (se vería dos veces un instante).
    if (sending.current > 0) return;
    busy.current = true;
    try {
      const page = await CareChatService.messages(linkId, { limit: PAGE });
      if (!alive.current) return;
      setServer((prev) => {
        // Se conservan los anteriores ya cargados con «Ver mensajes anteriores».
        const ids = new Set(page.messages.map((m) => m.id));
        const oldest = page.messages[0]?.createdAt;
        const older = oldest ? prev.filter((m) => !ids.has(m.id) && Date.parse(m.createdAt) < Date.parse(oldest)) : [];
        return sortChat([...older, ...page.messages]);
      });
      if (page.conversation) setConversation(page.conversation);
      // Si ya se cargaron mensajes anteriores, «hay más» lo decide esa carga.
      if (!olderLoaded.current) setHasMore(page.hasMore);
      setError(null);
      markReadIfNeeded(page.messages);
    } catch (e) {
      if (alive.current) setError(toAppError(e));
    } finally {
      busy.current = false;
      if (alive.current) setLoading(false);
    }
  }, [linkId, markReadIfNeeded]);

  // Consulta periódica solo con la pantalla a la vista y la app en primer plano.
  useFocusEffect(
    useCallback(() => {
      focused.current = true;
      CareChatService.setActiveConversation(linkId);
      void load();
      const timer = setInterval(() => {
        if (AppState.currentState === 'active') void load();
      }, POLL_MS);
      const sub = AppState.addEventListener('change', (s) => {
        if (s === 'active') void load();
      });
      return () => {
        focused.current = false;
        CareChatService.setActiveConversation(null);
        clearInterval(timer);
        sub.remove();
      };
    }, [linkId, load]),
  );

  const deliver = useCallback(async (item: ChatItem) => {
    if (!linkId || !item.clientKey) return false;
    sending.current += 1;
    setLocal((l) => l.map((x) => (x.id === item.id ? { ...x, status: 'sending', error: undefined } : x)));
    try {
      const { message } = await CareChatService.send(linkId, item.content, item.clientKey);
      if (!alive.current) return true;
      setServer((s) => (s.some((m) => m.id === message.id) ? s : sortChat([...s, message])));
      setLocal((l) => l.filter((x) => x.id !== item.id));
      return true;
    } catch (e) {
      const err = toAppError(e);
      if (alive.current) {
        setLocal((l) => l.map((x) => (x.id === item.id ? { ...x, status: 'failed', error: err.message } : x)));
        if (err.kind === 'limit_reached' || err.kind === 'permission_denied' || err.kind === 'not_configured') setError(err);
      }
      return false;
    } finally {
      sending.current -= 1;
    }
  }, [linkId]);

  /** Envía un mensaje: aparece al momento («Enviando…») y se confirma al responder el servidor. */
  const send = useCallback(async (text: string): Promise<boolean> => {
    const content = text.trim();
    if (!linkId || !content || !myId) return false;
    const clientKey = Crypto.randomUUID();
    const item: ChatItem = {
      id: `local-${clientKey}`,
      linkId,
      senderId: myId,
      content,
      createdAt: new Date().toISOString(),
      readAt: null,
      status: 'sending',
      clientKey,
    };
    setLocal((l) => [...l, item]);
    return deliver(item);
  }, [linkId, myId, deliver]);

  /** Reintenta un mensaje que no salió (con el mismo identificador: si en realidad llegó, no se duplica). */
  const retry = useCallback((item: ChatItem) => {
    void deliver(item);
  }, [deliver]);

  /** Quita de la pantalla un mensaje que no se pudo enviar. */
  const discard = useCallback((item: ChatItem) => {
    setLocal((l) => l.filter((x) => x.id !== item.id));
  }, []);

  const loadOlder = useCallback(async () => {
    const oldest = serverRef.current[0]?.createdAt;
    if (!linkId || !oldest || loadingOlder) return;
    setLoadingOlder(true);
    try {
      const page = await CareChatService.messages(linkId, { limit: PAGE, before: oldest });
      if (!alive.current) return;
      setServer((s) => {
        const ids = new Set(s.map((m) => m.id));
        return sortChat([...page.messages.filter((m) => !ids.has(m.id)), ...s]);
      });
      olderLoaded.current = true;
      setHasMore(page.hasMore);
    } catch (e) {
      if (alive.current) setError(toAppError(e));
    } finally {
      if (alive.current) setLoadingOlder(false);
    }
  }, [linkId, loadingOlder]);

  const items = useMemo(() => mergeChat(server, local, myId), [server, local, myId]);
  return { conversation, items, myId, loading, error, hasMore, loadingOlder, send, retry, discard, loadOlder, refresh: load };
}

/** No leídos de todas las conversaciones (se actualiza solo cada `pollMs` mientras la app está en primer plano). */
export function useCareChatSummary(pollMs = 30_000) {
  const { session, status } = useSession();
  const signedIn = status === 'signedIn' && !!session?.userId;
  const conversations = useSyncExternalStore(CareChatService.subscribe, CareChatService.getSummary, CareChatService.getSummary);
  useEffect(() => {
    if (!signedIn) return undefined;
    void CareChatService.refreshSummary(0);
    const timer = setInterval(() => {
      if (AppState.currentState === 'active') void CareChatService.refreshSummary(pollMs / 2);
    }, pollMs);
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') void CareChatService.refreshSummary(5_000);
    });
    return () => {
      clearInterval(timer);
      sub.remove();
    };
  }, [signedIn, session?.userId, pollMs]);
  const unread = conversations.reduce((n, c) => n + c.unread, 0);
  return { conversations: signedIn ? conversations : [], unread: signedIn ? unread : 0 };
}

/**
 * «Escuchar» un mensaje. Con Premium suena la voz natural elegida (Sulafat o Achird); sin Premium (cuidador/a gratis)
 * o en el Modo demostración, la voz del teléfono en español. Nunca se queda mudo sin avisar.
 */
export function useChatReader() {
  const { prefs } = usePreferences();
  const entitlement = useEntitlement();
  const natural = useGeminiSimpleSpeech();
  const { speak: naturalSpeak, stop: naturalStop } = natural;
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const token = useRef(0);
  const useNatural = Platform.OS === 'web' || (entitlement.isPremium && !DemoMode.isActive());

  const stop = useCallback(() => {
    token.current += 1;
    naturalStop();
    Speech.stop();
    setDeviceId(null);
  }, [naturalStop]);

  const speak = useCallback((id: string, text: string) => {
    stop();
    if (useNatural) {
      naturalSpeak(id, text, prefs.speechRate, prefs.assistantVoice, 'assistant');
      return;
    }
    const my = ++token.current;
    const done = () => {
      if (my === token.current) setDeviceId(null);
    };
    setDeviceId(id);
    void speakOnDevice(text, Math.max(0.6, Math.min(1.1, prefs.speechRate)), () => my === token.current, {
      onDone: done,
      onStopped: done,
      onError: done,
    }).catch(done);
  }, [stop, useNatural, naturalSpeak, prefs.speechRate, prefs.assistantVoice]);

  useEffect(() => () => stop(), [stop]);
  return { speakingId: natural.speakingId ?? deviceId, loadingId: natural.loadingId, speak, stop };
}
