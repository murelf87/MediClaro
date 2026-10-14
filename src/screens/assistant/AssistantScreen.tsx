/**
 * 9 · Asistente de MediClaro — referencia 09_chat.
 *
 * Un único componente para:
 *  - la pestaña "Asistente" (mode 'tab'): sin "Volver", conversación general;
 *  - /chat?medicationId=…&medicationName=… (mode 'stack'): con "Volver" y contexto
 *    del medicamento (el backend recibe medicineId y usa su prospecto oficial).
 *
 * La conversación vive en AssistantService (memoria): se conserva al cambiar de
 * pestaña o de pantalla y se borra con "Nueva conversación" o al cerrar sesión.
 *
 * Teclado: KeyboardAvoidingView con behavior 'padding' en iOS y Android (con
 * edge-to-edge, obligatorio en Android 15+, la ventana ya no se redimensiona).
 * keyboardVerticalOffset = posición real (en ventana) del contenedor, medida con
 * measureInWindow: así el cálculo es exacto con o sin barra de pestañas debajo.
 */
import { useCallback, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  TextInput,
  View,
  type ListRenderItem,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  AppText,
  Badge,
  Card,
  EmergencyCallButton,
  Icon,
  IconButton,
  PrimaryButton,
  Screen,
  SecondaryButton,
  TextButton,
} from '../../components';
import { useAppTheme, useAssistantConversation, useEntitlement, usePreferences, useSimpleSpeech } from '../../hooks';
import { AiConsentService, PREMIUM_REQUIRED_CODE } from '../../services';
import { PUBLIC_HEALTH_RESOURCES } from '../../config/app';
import { MAX_FONT_SIZE_MULTIPLIER } from '../../theme';
import { callPhone, openExternalUrl } from '../../utils/device';
import { confirmAsync, showAlert } from '../../utils/dialogs';
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

export type AssistantMode = 'tab' | 'stack';

const MAX_LENGTH = 1000;
const COUNTER_FROM = 800;
const WELCOME =
  'Hola, soy tu asistente de MediClaro. Puedo ayudarte con información sobre medicamentos de forma sencilla y clara.';
const EMERGENCY_TITLE = 'Lo que describes puede ser una urgencia.';

const GENERAL_SUGGESTIONS = [
  '¿Para qué sirve el paracetamol?',
  '¿Qué efectos secundarios tiene el ibuprofeno?',
  '¿Puedo tomar dos medicamentos a la vez?',
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
  const { prefs } = usePreferences();
  const keyboardVisible = useKeyboardVisible();
  const entitlement = useEntitlement();
  // Al llegar al límite diario solo se ofrece Premium a quien aún no lo tiene.
  const offerPremium = entitlement.canSell && !entitlement.isPremium;

  // ── Contexto del medicamento (solo en la pantalla con "Volver") ──
  const params = useLocalSearchParams<{ medicationId?: string | string[]; medicationName?: string | string[] }>();
  const rawId = mode === 'stack' ? firstParam(params.medicationId) : undefined;
  const rawName = mode === 'stack' ? firstParam(params.medicationName) : undefined;
  const medicationId = rawId && /^[\w-]{1,20}$/.test(rawId) ? rawId : undefined;
  const medicationName = medicationId && rawName?.trim() ? rawName.replace(/\s+/g, ' ').trim().slice(0, 120) : undefined;
  const ctx = useMemo<AssistantContext | undefined>(
    () => (medicationId ? { medicationId, medicationName } : undefined),
    [medicationId, medicationName],
  );
  const shortName = medicationName ? shortMedicationName(medicationName) : null;

  const { messages, sending, send, retry, clear } = useAssistantConversation(ctx);
  const { speakingId, speak, stop } = useSimpleSpeech();
  const [draft, setDraft] = useState('');
  const [focused, setFocused] = useState(false);

  // La voz se detiene al salir de la pantalla (la pestaña sigue montada).
  useFocusEffect(useCallback(() => () => stop(), [stop]));

  // ── Teclado: posición real del contenedor en la ventana ──
  const wrapRef = useRef<View>(null);
  const [keyboardOffset, setKeyboardOffset] = useState(0);
  const measureWrap = useCallback(() => {
    wrapRef.current?.measureInWindow((_x, y) => {
      if (Number.isFinite(y)) setKeyboardOffset(Math.max(0, Math.round(y)));
    });
  }, []);

  // ── Desplazamiento automático al último mensaje ──
  const listRef = useRef<FlatList<Row>>(null);
  const stickToBottom = useRef(true);
  const scrollToEnd = useCallback((animated = true) => {
    requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated }));
  }, []);
  const onScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
    stickToBottom.current = contentSize.height - (contentOffset.y + layoutMeasurement.height) < 120;
  }, []);

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
      stickToBottom.current = true;
      void send(question);
      scrollToEnd();
    },
    [draft, sending, send, scrollToEnd],
  );

  const onNewConversation = useCallback(async () => {
    if (sending) {
      await showAlert('Un momento', 'Espera a que llegue la respuesta para empezar una conversación nueva.');
      return;
    }
    const ok = await confirmAsync({
      title: '¿Empezar una conversación nueva?',
      message: 'Se borrarán los mensajes de esta conversación.',
      confirmText: 'Empezar de nuevo',
      cancelText: 'Cancelar',
      destructive: true,
    });
    if (!ok) return;
    stop();
    clear();
    stickToBottom.current = true;
  }, [sending, stop, clear]);

  const toggleSpeak = useCallback(
    (message: AssistantMessage) => {
      if (speakingId === message.id) stop();
      else speak(message.id, message.text, prefs.speechRate);
    },
    [speakingId, speak, stop, prefs.speechRate],
  );

  const openSource = useCallback(async (url: string) => {
    const ok = await openExternalUrl(url);
    if (!ok) await showAlert('No se ha podido abrir el prospecto', 'Inténtalo de nuevo en un momento.');
  }, []);

  const renderItem: ListRenderItem<Row> = ({ item }) => {
    switch (item.kind) {
      case 'typing':
        return <TypingIndicator />;
      case 'user':
        return (
          <UserMessage
            message={item.message}
            canRetry={!sending}
            onRetry={() => {
              stickToBottom.current = true;
              void AiConsentService.ensure().then((ok) => (ok ? retry(item.message.id) : undefined));
            }}
            onPremium={offerPremium ? () => router.push('/premium') : undefined}
            premium={entitlement.isPremium}
          />
        );
      case 'emergency':
        return <EmergencyReply message={item.message} onOpenEmergency={() => router.push('/emergency')} />;
      case 'assistant':
      default:
        return (
          <AssistantBubble
            message={item.message}
            speaking={speakingId === item.message.id}
            onToggleSpeak={() => toggleSpeak(item.message)}
            onOpenSource={item.message.sourceUrl ? () => void openSource(item.message.sourceUrl as string) : undefined}
          />
        );
    }
  };

  const listHeader = (
    <View style={{ gap: theme.spacing.md }}>
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
      {messages.length === 0 ? (
        <View style={{ gap: theme.spacing.sm }} accessibilityLabel="Preguntas sugeridas">
          {suggestions.map((s) => (
            <SuggestionChip key={s} label={s} onPress={() => submit(s)} disabled={sending} />
          ))}
        </View>
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
        messages.length > 0 ? (
          <IconButton
            icon="create-outline"
            accessibilityLabel="Nueva conversación"
            onPress={() => void onNewConversation()}
            testID="assistant-new"
          />
        ) : null
      }
    />
  );

  return (
    <Screen edges={['top']} scroll={false} padded={false} header={header}>
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

          <FlatList
            ref={listRef}
            style={styles.flex}
            data={rows}
            extraData={`${speakingId ?? ''}|${sending ? 1 : 0}`}
            keyExtractor={(item) => item.key}
            renderItem={renderItem}
            ListHeaderComponent={listHeader}
            contentContainerStyle={{
              paddingHorizontal: theme.layout.screenPaddingH,
              paddingTop: theme.spacing.md,
              paddingBottom: theme.spacing.lg,
              gap: theme.spacing.md,
            }}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
            onScroll={onScroll}
            scrollEventThrottle={100}
            onContentSizeChange={() => {
              if (stickToBottom.current) scrollToEnd();
            }}
            onLayout={() => {
              if (stickToBottom.current) scrollToEnd(false);
            }}
            showsVerticalScrollIndicator={false}
            accessibilityLabel="Conversación con el asistente"
          />

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
            <View
              style={[
                styles.inputBox,
                {
                  minHeight: theme.touchTargets.large,
                  borderRadius: theme.radius.xl,
                  borderColor: focused ? c.primary : c.borderStrong,
                  borderWidth: focused ? 2 : 1.5,
                  backgroundColor: c.surface,
                  paddingLeft: theme.spacing.md,
                },
              ]}
            >
              <TextInput
                value={draft}
                onChangeText={setDraft}
                placeholder="Escribe tu pregunta…"
                placeholderTextColor={c.textMuted}
                multiline
                maxLength={MAX_LENGTH}
                maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER}
                accessibilityLabel="Escribe tu pregunta"
                accessibilityHint={`Hasta ${MAX_LENGTH} caracteres`}
                autoCapitalize="sentences"
                textAlignVertical="center"
                onFocus={() => {
                  setFocused(true);
                  stickToBottom.current = true;
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
            <AppText variant="caption" color="textMuted" align="center">
              La IA no sustituye la opinión de un médico o farmacéutico.
            </AppText>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Screen>
  );
}

// ─── Mensajes ─────────────────────────────────────────────────────────────────

function AssistantBubble({
  message,
  speaking,
  onToggleSpeak,
  onOpenSource,
}: {
  message: AssistantMessage;
  speaking: boolean;
  onToggleSpeak: () => void;
  onOpenSource?: () => void;
}) {
  const theme = useAppTheme();
  const c = theme.colors;
  return (
    <View style={styles.assistantColumn}>
      <View
        style={[
          styles.bubble,
          styles.assistantBubble,
          { backgroundColor: c.primaryTint, borderColor: c.primarySoft, borderRadius: theme.radius.lg },
        ]}
      >
        <AppText variant="body" color="text" selectable>
          {message.text}
        </AppText>
      </View>
      <View style={styles.actions}>
        <TextButton
          label={speaking ? 'Detener' : 'Escuchar'}
          icon={speaking ? 'stop-circle-outline' : 'volume-high'}
          onPress={onToggleSpeak}
          align="flex-start"
        />
        {onOpenSource ? (
          <TextButton label="Ver prospecto oficial" icon="document-text-outline" onPress={onOpenSource} align="flex-start" />
        ) : null}
      </View>
    </View>
  );
}

function UserMessage({
  message,
  canRetry,
  onRetry,
  onPremium,
  premium,
}: {
  message: AssistantMessage;
  canRetry: boolean;
  onRetry: () => void;
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
          <TextButton label="Reintentar" icon="refresh" onPress={onRetry} disabled={!canRetry} align="flex-end" />
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
          <TextButton label="Reintentar" icon="refresh" onPress={onRetry} disabled={!canRetry} align="flex-end" />
        </View>
      ) : null}
    </View>
  );
}

function EmergencyReply({ message, onOpenEmergency }: { message: AssistantMessage; onOpenEmergency: () => void }) {
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
      <TextButton label="Abrir la pantalla de emergencia" icon="alert-circle-outline" tone="danger" onPress={onOpenEmergency} />
    </Card>
  );
}

const styles = StyleSheet.create({
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
  inputBox: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  input: { flex: 1, minHeight: 48, paddingTop: 12, paddingBottom: 12 },
  sendWrap: { paddingVertical: 6, paddingRight: 6 },
});
