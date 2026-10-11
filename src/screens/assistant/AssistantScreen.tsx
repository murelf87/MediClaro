/**
 * 9 · Asistente de MediClaro — referencia 09_chat.
 *
 * Un único componente para:
 *  - la pestaña "Asistente" (mode 'tab'): sin "Volver", conversación general;
 *  - /chat?medicationId=…&medicationName=… (mode 'stack'): con "Volver" y contexto
 *    del medicamento (el backend recibe medicineId y usa su prospecto oficial).
 *
 * La conversación se conserva en el historial privado del usuario y se recupera
 * al volver a abrir MediClaro. No se borra al cambiar de pantalla ni al cerrar sesión.
 *
 * Teclado: KeyboardAvoidingView con behavior 'padding' en iOS y Android (con
 * edge-to-edge, obligatorio en Android 15+, la ventana ya no se redimensiona).
 * keyboardVerticalOffset = posición real (en ventana) del contenedor, medida con
 * measureInWindow: así el cálculo es exacto con o sin barra de pestañas debajo.
 *
 * Desplazamiento: el chat va SIEMPRE a lo último que se habló (al abrirlo, al cambiar de conversación, al enviar, cuando
 * llega la respuesta y mientras se va escribiendo) y solo se queda quieto si la persona sube a releer; entonces aparece el
 * botón «Ir al último mensaje». Las reglas están en chatScroll.ts. La lista es un ScrollView con todos los mensajes (el
 * servidor guarda como mucho 180 por conversación): así el final es exacto, sin estimaciones de alto.
 */
import { currentEmergencyMessage } from '../../services/AssistantService';
import { currentCaregiverSignal } from '../../services/CaregiverAlert';
import { CaregiverService } from '../../services/CaregiverService';
import { memo, useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
  useWindowDimensions,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { RecordingPresets, requestRecordingPermissionsAsync, useAudioRecorder } from 'expo-audio';
import {
  AppText,
  Badge,
  Card,
  EmergencyCallButton,
  Icon,
  IconButton,
  InfoBanner,
  PrimaryButton,
  Screen,
  SecondaryButton,
  TextButton,
} from '../../components';
import { canAutoSpeak, useAppTheme, useAssistantConversation, useAsync, useEntitlement, usePreferences, useGeminiSimpleSpeech, useRefreshOnFocus } from '../../hooks';
import { useReduceMotion } from '../../components/Motion';
import { AiConsentService, AssistantMemoryService, PREMIUM_REQUIRED_CODE, VoiceConversationService } from '../../services';
import { configureAudioForRecording, configureAudioForSpeech } from '../../utils/audio';
import { PUBLIC_HEALTH_RESOURCES } from '../../config/app';
import { ASSISTANT_NAME } from '../../config/assistant';
import { MAX_FONT_SIZE_MULTIPLIER } from '../../theme';
import { callPhone, openExternalUrl } from '../../utils/device';
import { showAlert } from '../../utils/dialogs';
import { formatPhoneForDisplay, onlyDigits } from '../../utils/format';
import type { AssistantContext, AssistantMessage, EmergencyResource } from '../../types';
import {
  AssistantAvatar,
  AssistantHeader,
  SuggestionChip,
  TypingIndicator,
  shortMedicationName,
  useKeyboardVisible,
} from './parts';
import { ConversationsSheet } from './ConversationsSheet';
import { DocumentSheet } from './DocumentSheet';
import { choosePhotosForDocument } from './documentFlow';
import { documentFlowDeps } from './documentFlowDeps';
import type { DocumentSource } from './documentPhotos';
import { AssistantSpeed, assistantRate, type AssistantSpeedKey } from '../../services/AssistantSpeed';
import { ReadingBar } from './ReadingBar';
import { AssistantThreads, type AssistantThread } from '../../services/AssistantThreads';
import { distanceToEnd, pinnedAfterScroll, pinnedWhenSettled, showLatestButton } from './chatScroll';

export type AssistantMode = 'tab' | 'stack';

const MAX_LENGTH = 1000;
/** Un mensaje de voz se envía solo al cumplir un minuto (por si se queda el dedo apoyado). */
const MAX_VOICE_MESSAGE_MS = 60_000;
/** `rows` solo existe en la web (react-native-web): la caja de escribir empieza con una línea. */
const WEB_ONE_ROW = Platform.OS === 'web' ? { rows: 1 } : {};

/** La respuesta del asistente aparece escribiéndose: una letra cada 40 ms (25 por segundo), como mucho ~20 s. */
const TYPING_TICK_MS = 40;
const TYPING_MAX_MS = 20_000;
const COUNTER_FROM = 800;
const WELCOME =
  `Hola, soy ${ASSISTANT_NAME}, tu asistente. Puedo ayudarte con tus medicamentos y acompañarte en tus dudas del día a día. ¿Cómo estás hoy?`;
const EMERGENCY_TITLE = 'Lo que describes puede ser una urgencia.';

const GENERAL_SUGGESTIONS = [
  // «Mis pastillas»: se responden con la pauta y las tomas confirmadas de verdad (sin IA).
  '¿Qué pastillas me quedan hoy?',
  '¿Me he tomado las pastillas de hoy?',
  '¿Qué hago si se me olvida una toma?',
  '¿Cómo guardo bien mis medicinas?',
];

type Row =
  | { kind: 'user'; key: string; message: AssistantMessage }
  | { kind: 'assistant'; key: string; message: AssistantMessage }
  | { kind: 'emergency'; key: string; message: AssistantMessage }
  | { kind: 'typing'; key: string };

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/** Números públicos con su formato habitual (config); el resto, formato estándar. */
function displayPhone(phone: string): string {
  const digits = onlyDigits(phone);
  const known = Object.values(PUBLIC_HEALTH_RESOURCES).find((r) => onlyDigits(r.phone) === digits);
  if (known && 'display' in known) return known.display;
  if (digits.length <= 4) return digits;
  return formatPhoneForDisplay(phone);
}

async function dial(phone: string) {
  const ok = await callPhone(phone);
  if (!ok) {
    await showAlert('No se ha podido abrir el teléfono', `Marca el ${displayPhone(phone)} desde la aplicación de teléfono.`);
  }
}

export function AssistantScreen({ mode }: { mode: AssistantMode }) {
  const router = useRouter();
  const theme = useAppTheme();
  const c = theme.colors;
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  // La caja de escribir lleva «adjuntar» y «enviar» dentro y es estrecha: el texto de ayuda se acorta según el ancho para que
  // no se parta en dos líneas (la segunda quedaba cortada).
  const placeholder = width >= 600 ? 'Escribe tu pregunta…' : width >= 370 ? 'Tu pregunta…' : 'Pregunta…';
  // Móviles bajos (iPhone SE…): la ayuda del micrófono ocupa una sola línea y deja más sitio a la conversación.
  const short = height < 760;
  const { prefs } = usePreferences();
  const keyboardVisible = useKeyboardVisible();
  const entitlement = useEntitlement();
  const assistantMemory = useAsync(() => AssistantMemoryService.get(), []);
  // Al volver al chat (p. ej. tras cambiar la memoria en Perfil y ajustes) se lee de nuevo.
  useRefreshOnFocus(assistantMemory.refresh);
  const memoryEnabled = assistantMemory.data?.enabled === true;
  // Al llegar al límite diario solo se ofrece Premium a quien aún no lo tiene.
  const offerPremium = entitlement.canSell && !entitlement.isPremium;

  // ── Contexto del medicamento (solo en la pantalla con "Volver") ──
  const params = useLocalSearchParams<{ medicationId?: string | string[]; medicationName?: string | string[]; question?: string | string[] }>();
  // Pregunta que llega desde otra pantalla (p. ej. «Preguntar a MediClaro» en Mis pastillas): se envía una vez.
  const initialQuestion = mode === 'stack' ? firstParam(params.question)?.trim().slice(0, 200) : undefined;
  const initialAsked = useRef(false);
  const rawId = mode === 'stack' ? firstParam(params.medicationId) : undefined;
  const rawName = mode === 'stack' ? firstParam(params.medicationName) : undefined;
  const medicationId = rawId && /^[\w-]{1,20}$/.test(rawId) ? rawId : undefined;
  const medicationName = medicationId && rawName?.trim() ? rawName.replace(/\s+/g, ' ').trim().slice(0, 120) : undefined;
  const ctx = useMemo<AssistantContext | undefined>(
    () => (medicationId ? { medicationId, medicationName } : undefined),
    [medicationId, medicationName],
  );
  const shortName = medicationName ? shortMedicationName(medicationName) : null;

  const { messages, sending, send, sendDocument, retry } = useAssistantConversation(ctx);
  const { speakingId, loadingId, speak, stop } = useGeminiSimpleSpeech();
  // Velocidad de lectura de las respuestas (caracol, tortuga, conejo): se recuerda y se usa también al leerlas solas.
  const speed = useSyncExternalStore(AssistantSpeed.subscribe, AssistantSpeed.get, AssistantSpeed.get);
  useEffect(() => AssistantSpeed.load(), []);
  const rate = assistantRate(speed);
  // Conversaciones: abrir una nueva (las anteriores se conservan) o volver a una anterior. Solo en el chat general.
  const [chatsOpen, setChatsOpen] = useState(false);
  const [docOpen, setDocOpen] = useState(false);
  const [docBusy, setDocBusy] = useState(false);
  const [threads, setThreads] = useState<AssistantThread[]>(() => AssistantThreads.list());
  const [activeThread, setActiveThread] = useState(() => AssistantThreads.activeKey());
  useEffect(() => {
    const sync = () => {
      setThreads(AssistantThreads.list());
      setActiveThread(AssistantThreads.activeKey());
    };
    sync();
    return AssistantThreads.subscribe(sync);
  }, []);
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const [recordingVoice, setRecordingVoice] = useState(false);
  const [processingVoice, setProcessingVoice] = useState(false);
  const micHeldRef = useRef(false);
  const recordingRef = useRef(false);
  const recordingLimitRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const finishVoiceRef = useRef<() => Promise<void>>(async () => undefined);
  const autoSpeakAfterRef = useRef<number | null>(null);
  const emergencyOpenedRef = useRef<string | null>(null);
  const caregiverOpenedRef = useRef(new Set<string>());
  useEffect(() => {
    const signal = currentCaregiverSignal(messages);
    if (!signal || caregiverOpenedRef.current.has(signal.clientKey)) return;
    caregiverOpenedRef.current.add(signal.clientKey);
    void CaregiverService.start(signal.clientKey, signal.summary).then(() => {
      if (!signal.emergency) router.push('/caregiver');
    }).catch(async (error: Error) => {
      await showAlert('Aviso al cuidador pendiente', error.message);
    });
  }, [messages, router]);
  const [draft, setDraft] = useState('');
  const [focused, setFocused] = useState(false);

  // Cada respuesta nueva del asistente se reproduce sola con la voz elegida; mientras suena aparece «Detener» y,
  // cuando acaba, «Repetir explicación» para volver a oírla.
  useEffect(() => {
    const after = autoSpeakAfterRef.current;
    if (after === null) return;
    const latest = [...messages]
      .reverse()
      .find((m) => m.role === 'assistant' && !m.emergency && Date.parse(m.createdAt) >= after - 1000);
    if (!latest) return;
    autoSpeakAfterRef.current = null;
    if (latest.text && canAutoSpeak(latest.text)) speak(latest.id, latest.text, rate, prefs.assistantVoice, 'assistant');
  }, [messages, speak, rate, prefs.assistantVoice]);

  // La voz y cualquier grabación se detienen al salir de la pantalla.
  useFocusEffect(useCallback(() => () => {
    stop();
    micHeldRef.current = false;
    if (recordingLimitRef.current) {
      clearTimeout(recordingLimitRef.current);
      recordingLimitRef.current = null;
    }
    if (recordingRef.current) {
      recordingRef.current = false;
      setRecordingVoice(false);
      void recorder.stop().catch(() => undefined);
      void configureAudioForSpeech();
    }
  }, [stop, recorder]));

  // Si la IA marca una respuesta como posible emergencia, inicia el flujo de protección.
  // La persona sigue teniendo un minuto para responder antes de que se prepare la escalada.
  useEffect(() => {
    const latest = currentEmergencyMessage(messages);
    if (!latest || emergencyOpenedRef.current === latest.id) return undefined;
    emergencyOpenedRef.current = latest.id;
    const timer = setTimeout(() => {
      stop();
      router.push('/emergency/assistant?mode=unsure');
    }, 1200);
    return () => clearTimeout(timer);
  }, [messages, router, stop]);

  // ── Teclado: posición real del contenedor en la ventana ──
  const wrapRef = useRef<View>(null);
  const [keyboardOffset, setKeyboardOffset] = useState(0);
  const measureWrap = useCallback(() => {
    wrapRef.current?.measureInWindow((_x, y) => {
      if (Number.isFinite(y)) setKeyboardOffset(Math.max(0, Math.round(y)));
    });
  }, []);

  // ── Desplazamiento automático al último mensaje ──
  // El chat va SIEMPRE a lo último que se habló. «Pegado» (pinned) lo suelta solo la persona al arrastrar la lista hacia
  // arriba; se vuelve a pegar al llegar abajo y, sin excepción, al abrir el chat, cambiar de conversación, enviar o llegar
  // un mensaje nuevo. Las animaciones, el teclado o una respuesta que crece NO lo cambian (ver chatScroll.ts).
  const listRef = useRef<ScrollView>(null);
  const pinned = useRef(true);
  const touching = useRef(false);
  const emptyChat = useRef(messages.length === 0);
  emptyChat.current = messages.length === 0;
  const scrollMetrics = useRef({ y: 0, lastY: 0, contentHeight: 0, viewHeight: 0 });
  const [showLatest, setShowLatest] = useState(false);
  const showLatestRef = useRef(false);
  const refreshLatestButton = useCallback(() => {
    const m = scrollMetrics.current;
    // Sin mensajes no hay «último mensaje»: se ve la bienvenida desde arriba.
    const next = !emptyChat.current && showLatestButton(pinned.current, distanceToEnd(m));
    if (next !== showLatestRef.current) {
      showLatestRef.current = next;
      setShowLatest(next);
    }
  }, []);
  const scrollToEnd = useCallback(() => {
    requestAnimationFrame(() => {
      // Chat vacío: se ve la bienvenida desde arriba (no el final de las sugerencias).
      if (emptyChat.current) listRef.current?.scrollTo({ y: 0, animated: false });
      else listRef.current?.scrollToEnd({ animated: false });
    });
  }, []);
  const goToLatest = useCallback(() => {
    pinned.current = true;
    touching.current = false; // por si se perdió el aviso de «soltó el dedo»: nunca se queda sin seguir
    refreshLatestButton();
    scrollToEnd();
    // El historial, las fuentes y el teclado terminan de medirse un instante después: se vuelve a bajar.
    setTimeout(() => { if (pinned.current) scrollToEnd(); }, 250);
    setTimeout(() => { if (pinned.current) scrollToEnd(); }, 800);
  }, [refreshLatestButton, scrollToEnd]);
  const readMetrics = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const ne = e?.nativeEvent;
    if (!ne?.contentOffset || !ne.contentSize || !ne.layoutMeasurement) return;
    const m = scrollMetrics.current;
    m.lastY = m.y;
    m.y = ne.contentOffset.y;
    m.contentHeight = ne.contentSize.height;
    m.viewHeight = ne.layoutMeasurement.height;
  }, []);
  const onScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    readMetrics(e);
    const m = scrollMetrics.current;
    // Chat vacío: la lista se lleva sola arriba del todo (bienvenida); eso no es «subir a releer».
    pinned.current = emptyChat.current
      ? true
      : pinnedAfterScroll({ pinned: pinned.current, lastY: m.lastY, y: m.y, distance: distanceToEnd(m), touching: touching.current });
    refreshLatestButton();
  }, [readMetrics, refreshLatestButton]);
  // Dedo sobre la lista: mientras la mueve (y su inercia) no se baja sola; al soltarla se decide si queda pegada.
  // Si hay inercia, `onUserScrollStart` la vuelve a marcar al empezar y `settle` decide otra vez al acabar.
  const onUserScrollStart = useCallback(() => { touching.current = true; pinned.current = false; }, []);
  const settle = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    touching.current = false;
    readMetrics(e);
    pinned.current = pinnedWhenSettled(distanceToEnd(scrollMetrics.current));
    refreshLatestButton();
    if (pinned.current) scrollToEnd();
  }, [readMetrics, refreshLatestButton, scrollToEnd]);
  const onContentSizeChange = useCallback((_w: number, h: number) => {
    scrollMetrics.current.contentHeight = h;
    if (pinned.current) scrollToEnd();
    else refreshLatestButton();
  }, [refreshLatestButton, scrollToEnd]);
  const onListLayout = useCallback((e: LayoutChangeEvent) => {
    scrollMetrics.current.viewHeight = e.nativeEvent.layout.height;
    if (pinned.current) scrollToEnd();
    else refreshLatestButton();
  }, [refreshLatestButton, scrollToEnd]);
  // En el navegador (vista previa) la rueda del ratón no genera «arrastre»: subir con ella también suelta el chat.
  const webScrollIntent = useMemo<Record<string, unknown>>(
    () => (Platform.OS === 'web' ? { onWheel: (e: { deltaY?: number }) => { if ((e.deltaY ?? 0) < 0) pinned.current = false; } } : {}),
    [],
  );
  useFocusEffect(useCallback(() => { goToLatest(); }, [goToLatest]));
  useEffect(() => { goToLatest(); }, [activeThread, goToLatest]);
  // Mensaje nuevo al final (la pregunta, la respuesta, el historial que llega…): se va a él aunque se hubiera subido a releer.
  const lastMessageId = messages.length ? messages[messages.length - 1].id : '';
  useEffect(() => { if (lastMessageId) goToLatest(); }, [lastMessageId, goToLatest]);

  const suggestions = useMemo(
    () =>
      ctx
        ? [
            `¿Para qué sirve ${shortName ?? 'este medicamento'}?`,
            '¿Tiene efectos secundarios?',
            '¿Puedo tomarlo con otros medicamentos?',
            '¿Cómo se toma?',
          ]
        : GENERAL_SUGGESTIONS,
    [ctx, shortName],
  );

  const animatedAssistantIds = useRef(new Set(messages.filter((m) => m.role === 'assistant').map((m) => m.id)));

  const rows = useMemo<Row[]>(() => {
    const out: Row[] = [];
    for (const m of messages) {
      if (m.role === 'user') {
        out.push({ kind: 'user', key: m.id, message: m });
        if (m.status === 'sending') out.push({ kind: 'typing', key: `typing-${m.id}` });
      } else if (m.emergency) {
        out.push({ kind: 'emergency', key: m.id, message: m });
      } else {
        out.push({ kind: 'assistant', key: m.id, message: m });
      }
    }
    return out;
  }, [messages]);

  const submit = useCallback(
    async (text?: string) => {
      const question = (text ?? draft).trim().slice(0, MAX_LENGTH);
      if (!question || sending) return;
      // Permiso explícito antes de enviar la pregunta a la IA (el borrador se conserva si no lo da).
      if (!(await AiConsentService.ensure())) return;
      if (text === undefined) setDraft('');
      autoSpeakAfterRef.current = Date.now();
      goToLatest();
      void send(question);
    },
    [draft, sending, send, goToLatest],
  );

  useEffect(() => {
    if (!initialQuestion || initialAsked.current || sending) return;
    initialAsked.current = true;
    void submit(initialQuestion);
  }, [initialQuestion, sending, submit]);

  // Clip: foto(s) de un informe, receta o analítica para que el asistente las explique con palabras sencillas.
  //
  // Orden que hace que se abran la cámara y la galería en el iPhone (antes no pasaba nada): primero el permiso de IA, con
  // nada más abierto (dos ventanas nativas no caben a la vez); después la hoja, que es una capa de la pantalla y no un
  // `Modal`; y al elegir una opción la hoja desaparece al instante y la cámara o la galería se abren sobre la pantalla libre.
  const openDocSheet = useCallback(async () => {
    if (sending) return;
    Keyboard.dismiss();
    if (!(await AiConsentService.ensure())) return;
    setDocBusy(false);
    setDocOpen(true);
  }, [sending]);
  const closeDocSheet = useCallback(() => setDocOpen(false), []);
  const attachDocument = useCallback(
    async (source: DocumentSource) => {
      if (docBusy || sending) return;
      setDocBusy(true);
      setDocOpen(false);
      try {
        const photos = await choosePhotosForDocument(source, documentFlowDeps);
        if (!photos.length) return;
        autoSpeakAfterRef.current = Date.now();
        goToLatest();
        void sendDocument(photos);
      } finally {
        setDocBusy(false);
      }
    },
    [docBusy, sending, sendDocument, goToLatest],
  );

  const beginVoiceMessage = useCallback(async () => {
    if (sending || processingVoice || recordingRef.current) return;
    micHeldRef.current = true;
    stop();
    if (!(await AiConsentService.ensure())) { micHeldRef.current = false; return; }
    const permission = await requestRecordingPermissionsAsync();
    if (!permission.granted) {
      micHeldRef.current = false;
      await showAlert('Permiso de micrófono', `Activa el micrófono para poder hablar con ${ASSISTANT_NAME}.`);
      return;
    }
    if (!micHeldRef.current) return;
    try {
      // En iPhone la grabación necesita activar el micrófono en la sesión de audio; si no, expo-audio la rechaza.
      await configureAudioForRecording();
      if (!micHeldRef.current) { await configureAudioForSpeech(); return; }
      await recorder.prepareToRecordAsync();
      if (!micHeldRef.current) { await configureAudioForSpeech(); return; }
      recorder.record();
      recordingRef.current = true;
      setRecordingVoice(true);
      // Un mensaje de voz dura como mucho un minuto: después se envía solo.
      if (recordingLimitRef.current) clearTimeout(recordingLimitRef.current);
      recordingLimitRef.current = setTimeout(() => { void finishVoiceRef.current(); }, MAX_VOICE_MESSAGE_MS);
    } catch {
      recordingRef.current = false;
      setRecordingVoice(false);
      micHeldRef.current = false;
      await configureAudioForSpeech();
      await showAlert('Micrófono no disponible', 'No se ha podido iniciar la grabación. Inténtalo de nuevo.');
    }
  }, [sending, processingVoice, recorder, stop]);

  const finishVoiceMessage = useCallback(async () => {
    micHeldRef.current = false;
    if (recordingLimitRef.current) {
      clearTimeout(recordingLimitRef.current);
      recordingLimitRef.current = null;
    }
    if (!recordingRef.current) return;
    recordingRef.current = false;
    setRecordingVoice(false);
    const seconds = recorder.currentTime;
    try {
      await recorder.stop();
      await configureAudioForSpeech();
      const uri = recorder.uri;
      if (seconds < 0.35 || !uri) {
        await showAlert('Mensaje demasiado corto', 'Mantén pulsado el micrófono mientras hablas y suéltalo cuando termines.');
        return;
      }
      setProcessingVoice(true);
      const transcript = await VoiceConversationService.transcribe(uri);
      await submit(transcript);
    } catch (e) {
      autoSpeakAfterRef.current = null;
      await configureAudioForSpeech();
      await showAlert('No he podido entenderte', (e as Error).message || 'Vuelve a intentarlo hablando un poco más cerca del teléfono.');
    } finally {
      setProcessingVoice(false);
    }
  }, [recorder, submit]);
  finishVoiceRef.current = finishVoiceMessage;

  // Lo último que sabe la pantalla sobre la voz. Así los botones de cada globo no cambian de identidad y los globos no se
  // repintan con cada letra que se escribe (la conversación puede tener cientos de mensajes).
  const live = useRef({ speakingId, loadingId, speak, stop, rate, voice: prefs.assistantVoice });
  live.current = { speakingId, loadingId, speak, stop, rate, voice: prefs.assistantVoice };
  const toggleSpeak = useCallback((message: AssistantMessage) => {
    const l = live.current;
    if (l.speakingId === message.id || l.loadingId === message.id) l.stop();
    else l.speak(message.id, message.text, l.rate, l.voice, 'assistant');
  }, []);
  // Un animal: se queda encendido y la respuesta se lee otra vez a esa velocidad.
  const readAtSpeed = useCallback((message: AssistantMessage, next: AssistantSpeedKey) => {
    const l = live.current;
    AssistantSpeed.set(next);
    l.stop();
    l.speak(message.id, message.text, assistantRate(next), l.voice, 'assistant');
  }, []);

  const startNewChat = useCallback(() => {
    stop();
    AssistantThreads.start();
    setChatsOpen(false);
  }, [stop]);
  const openChat = useCallback(
    (key: string) => {
      stop();
      AssistantThreads.select(key);
      setChatsOpen(false);
    },
    [stop],
  );

  const notifyCaregiver = useCallback(async () => {
    const latestUser = [...messages].reverse().find((m) => m.role === 'user');
    if (!latestUser) return;
    try {
      const result=await CaregiverService.start('assistant-' + latestUser.id, ('El paciente comunica: ' + latestUser.text).slice(0, 2000));
      router.push({pathname:'/caregiver',params:{incident:result.incidentId,autocall:'1'}});
    } catch (e) {
      await showAlert('No se ha podido avisar al cuidador', (e as Error).message || 'Vuelve a intentarlo.');
    }
  }, [messages, router]);

  const openSource = useCallback((url: string) => {
    void (async () => {
      const ok = await openExternalUrl(url);
      if (!ok) await showAlert('No se ha podido abrir el prospecto', 'Inténtalo de nuevo en un momento.');
    })();
  }, []);
  const onNotifyCaregiver = useCallback(() => { void notifyCaregiver(); }, [notifyCaregiver]);
  const openEmergency = useCallback(() => router.push('/emergency'), [router]);
  const openPremium = useCallback(() => router.push('/premium'), [router]);
  const retryMessage = useCallback(
    (id: string) => {
      goToLatest();
      void AiConsentService.ensure().then((ok) => (ok ? retry(id) : undefined));
    },
    [goToLatest, retry],
  );

  // Cada fila es un componente memorizado con funciones que no cambian: al escribir en la caja no se repinta la conversación.
  const renderRow = (item: Row) => {
    switch (item.kind) {
      case 'typing':
        return <TypingIndicator key={item.key} />;
      case 'user':
        return (
          <UserMessage
            key={item.key}
            message={item.message}
            canRetry={!sending}
            onRetry={retryMessage}
            onPremium={offerPremium ? openPremium : undefined}
            premium={entitlement.isPremium}
          />
        );
      case 'emergency':
        return <EmergencyReply key={item.key} message={item.message} onOpenEmergency={openEmergency} onNotifyCaregiver={onNotifyCaregiver} />;
      case 'assistant':
      default: {
        const isRecent = Date.now() - Date.parse(item.message.createdAt) < 15_000;
        const animate = isRecent && !animatedAssistantIds.current.has(item.message.id);
        animatedAssistantIds.current.add(item.message.id);
        return (
          <AssistantBubble
            key={item.key}
            message={item.message}
            animate={animate}
            speaking={speakingId === item.message.id || loadingId === item.message.id}
            speed={speed}
            onToggleSpeak={toggleSpeak}
            onSelectSpeed={readAtSpeed}
            onOpenSource={openSource}
          />
        );
      }
    }
  };

  const listHeader = (
    <View style={{ gap: theme.spacing.md }}>
      {!medicationId && messages.length > 0 ? (
        <TextButton label="Nueva conversación" icon="add-circle-outline" onPress={startNewChat} align="flex-start" testID="assistant-new-chat-inline" />
      ) : null}
      {messages.length === 0 ? (
        <View style={styles.welcomeRow}>
          <AssistantAvatar size={theme.easyMode ? 60 : 54} />
          <View
            style={[
              styles.bubble,
              styles.assistantBubble,
              { backgroundColor: c.primaryTint, borderColor: c.primarySoft, borderRadius: theme.radius.lg },
            ]}
          >
            <AppText variant="body" color="text">
              {WELCOME}
            </AppText>
            {shortName ? (
              <AppText variant="body" color="text" style={{ marginTop: theme.spacing.xs }}>
                {`¿Qué quieres saber sobre ${shortName}?`}
              </AppText>
            ) : null}
          </View>
        </View>
      ) : null}
      {messages.length === 0 ? (
        <>
          {/* La memoria solo se ofrece mientras está desactivada; una vez activada se gestiona en Perfil y ajustes
              («Memoria del asistente») y deja este espacio a la conversación. */}
          {assistantMemory.data && !memoryEnabled ? (
            <InfoBanner
              tone="info"
              title={`¿Quieres que ${ASSISTANT_NAME} te conozca un poco mejor?`}
              message="Si lo activas, podrá recordar gustos, rutinas o aficiones que tú le cuentes. No guardará datos médicos ni otra información sensible. Podrás desactivarlo en Perfil y ajustes."
              action={{
                label: 'Activar memoria',
                onPress: () => void AssistantMemoryService.setEnabled(true).then(() => assistantMemory.refresh()),
              }}
              testID="assistant-memory-offer"
            />
          ) : null}
          <View style={{ gap: theme.spacing.sm }} accessibilityLabel="Preguntas sugeridas">
            {suggestions.map((s) => (
              <SuggestionChip key={s} label={s} onPress={() => submit(s)} disabled={sending} />
            ))}
          </View>
        </>
      ) : null}
    </View>
  );

  const canSend = draft.trim().length > 0 && !sending;
  const bottomPadding =
    mode === 'stack' && !keyboardVisible ? Math.max(insets.bottom, theme.spacing.sm) : theme.spacing.sm;

  const header = (
    <AssistantHeader
      title="Asistente de MediClaro"
      showBack={mode === 'stack'}
      right={
        medicationId ? undefined : (
          <Pressable
            onPress={() => setChatsOpen(true)}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Conversaciones"
            accessibilityHint="Abre una conversación nueva o vuelve a una anterior"
            testID="assistant-chats"
            style={({ pressed }) => ({ minHeight: theme.touchTargets.min, minWidth: theme.touchTargets.min, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.6 : 1 })}
          >
            <Icon name="chatbubbles-outline" size={28} color={theme.colors.heading} />
          </Pressable>
        )
      }
    />
  );

  return (
    <Screen
      edges={['top']}
      scroll={false}
      padded={false}
      header={header}
      overlay={
        <DocumentSheet
          visible={docOpen}
          busy={docBusy}
          bottomInset={mode === 'stack' ? insets.bottom : 0}
          onCamera={() => void attachDocument('camera')}
          onLibrary={() => void attachDocument('library')}
          onClose={closeDocSheet}
        />
      }
    >
      {!medicationId ? (
        <ConversationsSheet
          visible={chatsOpen}
          threads={threads}
          activeKey={activeThread}
          canStartNew={messages.length > 0}
          onNew={startNewChat}
          onSelect={openChat}
          onClose={() => setChatsOpen(false)}
        />
      ) : null}
      <View ref={wrapRef} style={styles.flex} onLayout={measureWrap} collapsable={false}>
        <KeyboardAvoidingView style={styles.flex} behavior="padding" keyboardVerticalOffset={keyboardOffset}>
          {medicationName ? (
            <View style={[styles.contextRow, { paddingHorizontal: theme.layout.screenPaddingH }]}>
              {/* Badge ocupa todo el ancho por defecto: este contenedor lo ajusta a su texto. */}
              <View style={styles.contextBadge}>
                <Badge label={`Sobre: ${medicationName}`} tone="info" icon="medkit" size="sm" />
              </View>
            </View>
          ) : null}

          <View style={styles.flex}>
            <ScrollView
              ref={listRef}
              style={styles.flex}
              contentContainerStyle={{
                // La conversación se apoya abajo, junto a la caja de escribir (como en cualquier chat), y no arriba del todo.
                flexGrow: 1,
                justifyContent: 'flex-end',
                paddingHorizontal: theme.layout.screenPaddingH,
                paddingTop: theme.spacing.md,
                paddingBottom: theme.spacing.lg,
                gap: theme.spacing.md,
              }}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
              onScroll={onScroll}
              scrollEventThrottle={32}
              onScrollBeginDrag={onUserScrollStart}
              onScrollEndDrag={settle}
              onMomentumScrollBegin={onUserScrollStart}
              onMomentumScrollEnd={settle}
              onContentSizeChange={onContentSizeChange}
              onLayout={onListLayout}
              showsVerticalScrollIndicator={false}
              accessibilityLabel="Conversación con el asistente"
              testID="assistant-list"
              {...webScrollIntent}
            >
              {listHeader}
              {rows.map(renderRow)}
            </ScrollView>
            {/* Si la persona sube a releer, un botón grande la devuelve a lo último que se habló. */}
            {showLatest ? (
              <View style={styles.latestWrap} pointerEvents="box-none">
                <Pressable
                  onPress={goToLatest}
                  accessibilityRole="button"
                  accessibilityLabel="Ir al último mensaje"
                  accessibilityHint="Baja la conversación hasta lo último que se ha dicho"
                  testID="assistant-go-latest"
                  style={({ pressed }) => [
                    styles.latestBtn,
                    {
                      minHeight: theme.touchTargets.comfortable,
                      borderRadius: theme.radius.pill,
                      backgroundColor: pressed ? c.primaryPressed : c.primary,
                    },
                    theme.shadow.button,
                  ]}
                >
                  <Icon name="arrow-down" size={26} color={c.onPrimary} />
                  <AppText variant="label" style={{ color: c.onPrimary }}>
                    Ir al último mensaje
                  </AppText>
                </Pressable>
              </View>
            ) : null}
          </View>

          <View
            style={[
              styles.inputArea,
              {
                borderTopColor: c.divider,
                backgroundColor: c.background,
                paddingHorizontal: theme.layout.screenPaddingH,
                paddingTop: theme.spacing.sm,
                paddingBottom: bottomPadding,
                gap: theme.spacing.xs,
              },
            ]}
          >
            <View style={styles.composerRow}>
              <View
                style={[
                  styles.inputBox,
                  {
                    minHeight: theme.touchTargets.large,
                    borderRadius: theme.radius.xl,
                    borderColor: recordingVoice ? c.danger : focused ? c.primary : c.borderStrong,
                    borderWidth: focused || recordingVoice ? 2 : 1.5,
                    backgroundColor: recordingVoice ? c.dangerTint : c.surface,
                    paddingLeft: theme.spacing.md,
                  },
                ]}
              >
                <TextInput
                  value={draft}
                  onChangeText={setDraft}
                  placeholder={recordingVoice ? 'Te escucho…' : processingVoice ? 'Entendiendo…' : docBusy ? 'Preparando…' : placeholder}
                  placeholderTextColor={recordingVoice ? c.dangerText : c.textMuted}
                  editable={!recordingVoice && !processingVoice}
                  multiline
                  // En el navegador (vista previa) la caja empieza con UNA línea, como en el móvil (si no, salen dos).
                  {...WEB_ONE_ROW}
                  maxLength={MAX_LENGTH}
                  maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER}
                  accessibilityLabel="Escribe tu pregunta"
                  accessibilityHint={`Hasta ${MAX_LENGTH} caracteres`}
                  autoCapitalize="sentences"
                  textAlignVertical="center"
                  onFocus={() => {
                    setFocused(true);
                    goToLatest();
                    measureWrap(); // posición al día justo antes de que llegue el evento del teclado
                  }}
                  onBlur={() => setFocused(false)}
                  style={[
                    styles.input,
                    theme.typography.body,
                    { color: c.text, maxHeight: (theme.typography.body.lineHeight ?? 24) * 5 + 24 },
                  ]}
                  testID="assistant-input"
                />
                <View style={styles.sendWrap}>
                  <IconButton
                    icon="attach"
                    variant="tonal"
                    size={24}
                    accessibilityLabel="Adjuntar la foto de un documento"
                    onPress={() => void openDocSheet()}
                    disabled={sending || recordingVoice || processingVoice || docBusy}
                    testID="assistant-attach"
                  />
                </View>
                <View style={styles.sendWrap}>
                  <IconButton
                    icon="paper-plane"
                    variant="solid"
                    size={24}
                    accessibilityLabel="Enviar pregunta"
                    onPress={() => submit()}
                    disabled={!canSend}
                    testID="assistant-send"
                  />
                </View>
              </View>
              {/* Hablar con el asistente: al lado de «Enviar». Se mantiene pulsado mientras se habla y se suelta para enviar. */}
              <Pressable
                onPressIn={() => void beginVoiceMessage()}
                onPressOut={() => void finishVoiceMessage()}
                disabled={sending || processingVoice}
                accessibilityRole="button"
                accessibilityLabel={`Mantén pulsado para hablar con ${ASSISTANT_NAME}`}
                accessibilityHint="Mantén pulsado mientras hablas y suelta para enviar"
                accessibilityState={{ disabled: sending || processingVoice, busy: processingVoice }}
                testID="assistant-hold-to-talk"
                style={({ pressed }) => [
                  styles.micButton,
                  {
                    // Mismo alto y mismas esquinas que la caja de escribir: los dos quedan alineados.
                    width: theme.touchTargets.large,
                    height: theme.touchTargets.large,
                    borderRadius: theme.radius.xl,
                    backgroundColor: recordingVoice ? c.danger : pressed ? c.primaryPressed : c.primary,
                    opacity: sending || processingVoice ? 0.45 : 1,
                    transform: [{ scale: recordingVoice ? 1.06 : pressed ? 0.97 : 1 }],
                  },
                  theme.shadow.button,
                ]}
              >
                <Icon name={processingVoice ? 'hourglass-outline' : 'mic'} size={30} color={c.onPrimary} />
              </Pressable>
            </View>
            {!keyboardVisible || recordingVoice || processingVoice ? (
              <AppText
                variant="captionStrong"
                color={recordingVoice ? 'dangerText' : 'textSecondary'}
                align="center"
                accessibilityLiveRegion="polite"
                testID="assistant-voice-hint"
              >
                {recordingVoice
                  ? 'Te escucho… suelta para enviar'
                  : processingVoice
                    ? 'Entendiendo tu mensaje…'
                    : short
                      ? 'Mantén pulsado el micrófono para hablar.'
                      : `Mantén pulsado el micrófono para hablar. ${ASSISTANT_NAME} te responde con su voz.`}
              </AppText>
            ) : null}
            {draft.length >= COUNTER_FROM ? (
              <AppText
                variant="small"
                color={draft.length >= MAX_LENGTH ? 'dangerText' : 'textSecondary'}
                align="right"
                accessibilityLiveRegion="polite"
              >
                {`${draft.length}/${MAX_LENGTH}`}
              </AppText>
            ) : null}
            <AppText variant="small" color="textMuted" align="center" style={styles.disclaimer} testID="assistant-disclaimer">
              La IA no sustituye la opinión de un médico o farmacéutico.
            </AppText>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Screen>
  );
}

// ─── Mensajes ─────────────────────────────────────────────────────────────────

function AssistantBubbleBase({
  message,
  animate,
  speaking,
  speed,
  onToggleSpeak,
  onSelectSpeed,
  onOpenSource,
}: {
  message: AssistantMessage;
  animate: boolean;
  speaking: boolean;
  speed: AssistantSpeedKey;
  onToggleSpeak: (message: AssistantMessage) => void;
  onSelectSpeed: (message: AssistantMessage, speed: AssistantSpeedKey) => void;
  onOpenSource: (url: string) => void;
}) {
  const theme = useAppTheme();
  const c = theme.colors;
  const reduceMotion = useReduceMotion();
  // Se decide al aparecer: si la lista vuelve a pintar la fila (p. ej. al empezar la voz) no se corta el efecto.
  const [typing] = useState(animate && !reduceMotion);
  const total = message.text.length;
  const [visible, setVisible] = useState(() => (typing ? 0 : total));
  // La respuesta se va escribiendo poco a poco, como si el asistente la tecleara (algo más rápido que su voz, nunca más de ~20 s).
  useEffect(() => {
    if (!typing) { setVisible(total); return undefined; }
    const perTick = Math.max(1, Math.ceil(total / (TYPING_MAX_MS / TYPING_TICK_MS)));
    const timer = setInterval(() => {
      setVisible((current) => {
        const next = Math.min(total, current + perTick);
        if (next >= total) clearInterval(timer);
        return next;
      });
    }, TYPING_TICK_MS);
    return () => clearInterval(timer);
  }, [message.id, total, typing]);
  const done = visible >= total;
  // Los animales de la velocidad y «Repetir explicación» están desde que empieza la respuesta (no hay que esperar a que
  // acabe de escribirse: son hasta ~20 s y, sin ellos a la vista, no se sabe que se puede leer más despacio).
  const hasText = message.text.trim().length > 0;
  const sourceUrl = message.sourceUrl;
  return (
    <View style={styles.assistantColumn}>
      <View
        style={[
          styles.bubble,
          styles.assistantBubble,
          { backgroundColor: c.primaryTint, borderColor: c.primarySoft, borderRadius: theme.radius.lg },
        ]}
      >
        {/* Solo el texto es «un elemento» para el lector de pantalla: así los botones de debajo se pueden usar uno a uno. */}
        <Pressable
          onPress={done ? undefined : () => setVisible(total)}
          accessible
          accessibilityLabel={message.text}
          accessibilityHint={done ? undefined : 'Toca para ver la respuesta completa'}
          testID={done ? 'assistant-reply' : 'assistant-reply-typing'}
        >
          <AppText variant="body" color="text" selectable={done}>
            {done ? message.text : message.text.slice(0, visible)}
            {done ? null : <AppText variant="body" style={{ color: c.primary }}>{' ▍'}</AppText>}
          </AppText>
        </Pressable>
      </View>
      {/* Fuera del globo, justo debajo: «Repetir explicación» / «Detener» y los animales de la velocidad. */}
      {hasText ? (
        <ReadingBar
          speaking={speaking}
          speed={speed}
          onToggleSpeak={() => onToggleSpeak(message)}
          onSelectSpeed={(next) => onSelectSpeed(message, next)}
        />
      ) : null}
      {sourceUrl ? (
        <View style={styles.actions}>
          <TextButton label="Ver prospecto oficial" icon="document-text-outline" onPress={() => onOpenSource(sourceUrl)} align="flex-start" />
        </View>
      ) : null}
    </View>
  );
}
const AssistantBubble = memo(AssistantBubbleBase);

function UserMessageBase({
  message,
  canRetry,
  onRetry,
  onPremium,
  premium,
}: {
  message: AssistantMessage;
  canRetry: boolean;
  onRetry: (id: string) => void;
  /** Solo si se puede ofrecer Premium (compras en la app y la persona aún no lo tiene). */
  onPremium?: () => void;
  /** La app ya ve Premium para esta cuenta. */
  premium: boolean;
}) {
  const theme = useAppTheme();
  const c = theme.colors;
  const failed = message.status === 'error';
  const limit = failed && message.errorKind === 'limit_reached';
  // El servidor exige Premium: si la persona ya lo tiene, el servidor aún no lo ha confirmado (se puede reintentar).
  const serverPremiumOnly = failed && message.errorCode === PREMIUM_REQUIRED_CODE;
  const syncing = serverPremiumOnly && premium;
  const premiumOnly = serverPremiumOnly && !premium;
  return (
    <View style={styles.userColumn}>
      <View
        style={[
          styles.bubble,
          styles.userBubble,
          { backgroundColor: c.primary, borderRadius: theme.radius.lg, opacity: failed && !limit ? 0.85 : 1 },
        ]}
        accessible
        accessibilityLabel={`Tu pregunta: ${message.text}`}
      >
        <AppText variant="body" style={{ color: c.onPrimary }} selectable>
          {message.text}
        </AppText>
      </View>

      {syncing ? (
        <View style={styles.errorBlock} accessibilityRole="alert">
          <View style={styles.errorLine}>
            <Icon name="sync-outline" size={18} color={c.primary} />
            <AppText variant="caption" color="textSecondary" style={styles.errorText}>
              Estamos confirmando tu suscripción. Inténtalo de nuevo en unos minutos.
            </AppText>
          </View>
          <TextButton label="Reintentar" icon="refresh" onPress={() => onRetry(message.id)} disabled={!canRetry} align="flex-end" />
        </View>
      ) : limit ? (
        <Card tone="warning" elevated={false} style={[styles.fullWidth, { gap: theme.spacing.sm }]}>
          <View style={styles.cardTitle}>
            <Icon name={premiumOnly ? 'lock-closed-outline' : 'hourglass-outline'} size={24} color={c.warningText} />
            <AppText variant="bodyStrong" color="heading" style={styles.flex}>
              {premiumOnly ? 'El asistente es de MediClaro Premium' : 'Has llegado al límite de preguntas de hoy'}
            </AppText>
          </View>
          <AppText variant="body" color="textSecondary">
            {premiumOnly
              ? onPremium
                ? 'Con MediClaro Premium puedes preguntar tus dudas sobre medicamentos cuando lo necesites.'
                : 'Esta función no está incluida en tu plan.'
              : onPremium
                ? 'Mañana podrás volver a preguntar. Con MediClaro Premium puedes hacer más preguntas cada día.'
                : 'Mañana podrás volver a preguntar. Mientras tanto, la ficha de cada medicamento sigue disponible.'}
          </AppText>
          {onPremium ? (
            <PrimaryButton label="Ver MediClaro Premium" icon="star" size="md" onPress={onPremium} testID="assistant-limit-premium" />
          ) : null}
        </Card>
      ) : failed ? (
        <View style={styles.errorBlock} accessibilityRole="alert">
          <View style={styles.errorLine}>
            <Icon name="alert-circle" size={18} color={c.danger} />
            <AppText variant="caption" color="dangerText" style={styles.errorText}>
              {message.errorMessage || 'No se ha podido enviar la pregunta.'}
            </AppText>
          </View>
          <TextButton label="Reintentar" icon="refresh" onPress={() => onRetry(message.id)} disabled={!canRetry} align="flex-end" />
        </View>
      ) : null}
    </View>
  );
}

const UserMessage = memo(UserMessageBase);

function EmergencyReplyBase({
  message,
  onOpenEmergency,
  onNotifyCaregiver,
}: {
  message: AssistantMessage;
  onOpenEmergency: () => void;
  onNotifyCaregiver: () => void;
}) {
  const theme = useAppTheme();
  const c = theme.colors;
  const resources: EmergencyResource[] = message.emergency?.resources ?? [];
  const officialDigits = onlyDigits(PUBLIC_HEALTH_RESOURCES.emergency.phone);
  const official = resources.find((r) => onlyDigits(r.phone) === officialDigits);
  const officialPhone = official?.phone ?? PUBLIC_HEALTH_RESOURCES.emergency.phone;
  const others = resources.filter((r) => onlyDigits(r.phone) && onlyDigits(r.phone) !== onlyDigits(officialPhone));
  const detail = message.text.startsWith(EMERGENCY_TITLE) ? message.text.slice(EMERGENCY_TITLE.length).trim() : message.text;

  return (
    <Card tone="danger" elevated={false} style={{ gap: theme.spacing.md }} testID="assistant-emergency">
      <View style={styles.cardTitle} accessible accessibilityRole="alert">
        <View style={[styles.alertIcon, { backgroundColor: c.danger }]}>
          <Icon name="warning" size={22} color={c.onPrimary} />
        </View>
        <AppText variant="heading" color="dangerText" style={styles.flex}>
          {EMERGENCY_TITLE}
        </AppText>
      </View>
      {detail ? (
        <AppText variant="body" color="text">
          {detail}
        </AppText>
      ) : null}
      <EmergencyCallButton number={onlyDigits(officialPhone)} onPress={() => void dial(officialPhone)} />
      {others.length > 0 ? (
        <View style={{ gap: theme.spacing.md }}>
          <AppText variant="captionStrong" color="textSecondary">
            También puedes llamar a:
          </AppText>
          {others.map((r) => (
            // Nombre encima y número en el botón: el teléfono nunca se corta.
            <View key={`${r.label}-${r.phone}`} style={{ gap: theme.spacing.xxs }}>
              <AppText variant="label" color="heading">
                {r.label}
              </AppText>
              <SecondaryButton
                label={`Llamar al ${displayPhone(r.phone)}`}
                icon="call-outline"
                variant="neutral"
                onPress={() => void dial(r.phone)}
                accessibilityLabel={`Llamar a ${r.label}, ${displayPhone(r.phone)}`}
              />
            </View>
          ))}
        </View>
      ) : null}
      <View style={{ gap: theme.spacing.sm }}>
        <PrimaryButton label="Avisar y llamar a mi cuidador/a" icon="call-outline" onPress={onNotifyCaregiver} testID="assistant-emergency-caregiver" />
        <SecondaryButton label="Abrir emergencia" icon="alert-circle-outline" variant="dangerOutline" onPress={onOpenEmergency} testID="assistant-emergency-open" />
      </View>
    </Card>
  );
}

const EmergencyReply = memo(EmergencyReplyBase);

const styles = StyleSheet.create({
  // Botón «Ir al último mensaje»: flota sobre la conversación, justo encima de la caja de escribir.
  latestWrap: { position: 'absolute', left: 0, right: 0, bottom: 10, alignItems: 'center' },
  latestBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 22, paddingVertical: 10 },
  // Aviso legal discreto: letra pequeña y sin negrita (sigue siendo legible y lo lee el lector de pantalla).
  disclaimer: { fontWeight: '400' },
  flex: { flex: 1 },
  fullWidth: { alignSelf: 'stretch' },
  contextRow: { paddingTop: 4, paddingBottom: 4 },
  contextBadge: { alignSelf: 'flex-start', maxWidth: '100%' },
  welcomeRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  bubble: { paddingHorizontal: 16, paddingVertical: 14 },
  assistantBubble: { flexShrink: 1, borderWidth: 1, borderTopLeftRadius: 6 },
  assistantColumn: { alignItems: 'flex-start', maxWidth: '94%' },
  userColumn: { alignItems: 'flex-end', gap: 6 },
  userBubble: { maxWidth: '86%', borderTopRightRadius: 6 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 8, marginTop: 2 },
  errorBlock: { alignItems: 'flex-end', maxWidth: '92%' },
  errorLine: { flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
  errorText: { flexShrink: 1, textAlign: 'right' },
  cardTitle: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  alertIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  inputArea: { borderTopWidth: StyleSheet.hairlineWidth },
  // Caja y micrófono del mismo alto (64), alineados abajo: si la pregunta ocupa varias líneas, la caja crece hacia arriba.
  composerRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 10 },
  inputBox: { flex: 1, flexDirection: 'row', alignItems: 'flex-end', gap: 6 },
  input: { flex: 1, minHeight: 60, paddingTop: 18, paddingBottom: 18 },
  sendWrap: { paddingVertical: 6, paddingRight: 6 },
  micButton: { alignItems: 'center', justifyContent: 'center' },
});
