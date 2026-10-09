/**
 * /caregiver-chat?link=<vinculación> — Chat entre la persona Premium y su cuidador/a (los dos ven la misma pantalla,
 * cada uno desde su lado).
 *
 *  - Lo que escribe una persona lo ve la otra con la hora; quien escribe ve «Enviado» y, cuando la otra lo lee, «Visto».
 *  - Burbujas grandes, separadores de día, «Escuchar» en los mensajes recibidos y frases rápidas para escribir menos.
 *  - Se actualiza sola cada pocos segundos con la pantalla abierta; al tocar un aviso «X te ha escrito» se abre aquí.
 *  - Para escribir, la persona cuidada debe tener Premium (el cuidador/a es gratis). Si no, se puede leer.
 *  - Teclado: igual que el asistente (KeyboardAvoidingView con la posición real del contenedor en la ventana).
 */
import { useCallback, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  View,
  useWindowDimensions,
  type ListRenderItem,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppHeader, AppText, Avatar, Icon, InfoBanner, PrimaryButton, Screen, TextButton } from '../../components';
import { ChatBubble, ChatCallEntry, ChatComposer, ChatDayDivider, ChatPerson, QuickReplies } from '../../components/CareChat';
import { useAppTheme, useEntitlement } from '../../hooks';
import { useCareChat, useChatReader, type ChatItem } from '../../hooks/useCareChat';
import { CARE_CHAT_MAX_LENGTH, canWriteNow, chatOpen } from '../../services/CareChatService';
import { useNow } from '../../hooks/usePillPlan';
import { ChatWindowState } from '../../components/CareChatWindow';
import { buildChatRows, chatTime, type ChatRow } from '../../utils/chatTimeline';
import { useKeyboardVisible } from '../assistant/parts';
import { showAlert } from '../../utils/dialogs';

/** Frases rápidas: lo que más se escriben una persona mayor y su cuidador/a. */
export const PATIENT_QUICK_REPLIES = ['Estoy bien 😊', 'Ya me he tomado las pastillas', '¿Puedes llamarme?', 'Necesito que vengas'];
export const CAREGIVER_QUICK_REPLIES = ['¿Cómo estás?', '¿Te has tomado las pastillas?', 'Te llamo ahora', 'Voy para allá'];

function firstParam(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}
const firstName = (name: string) => name.trim().split(/\s+/)[0] || name;

export default function CareChatScreen() {
  const theme = useAppTheme();
  const c = theme.colors;
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const entitlement = useEntitlement();
  const keyboardVisible = useKeyboardVisible();
  // Móviles estrechos (320–359 px): el botón del 112 solo con su icono, para que se lea el nombre.
  const narrow = useWindowDimensions().width < 360;
  const params = useLocalSearchParams<{ link?: string | string[] }>();
  const rawLink = firstParam(params.link) ?? '';
  const linkId = /^[\w-]{1,64}$/.test(rawLink) ? rawLink : null;
  const chat = useCareChat(linkId);
  const reader = useChatReader();
  const [draft, setDraft] = useState('');
  const conversation = chat.conversation;
  const patientSide = conversation?.myRole !== 'caregiver';
  const other = conversation?.otherName ?? (patientSide ? 'Tu cuidador/a' : 'Tu familiar');
  const otherFirst = firstName(other);
  // La conversación la enciende la persona cuidada: su cuidador/a escribe solo durante la hora siguiente a su último
  // mensaje. Se calcula en el teléfono con la fecha que da el servidor (y se vuelve a mirar cada medio minuto).
  const now = useNow(30_000).getTime();
  const premium = conversation ? conversation.premium : true;
  const open = conversation ? chatOpen(conversation, now) : true;
  const canSend = conversation ? canWriteNow(conversation, now) : true;
  const openUntilText = conversation?.openUntil ? chatTime(conversation.openUntil) : '';
  const blocked = chat.error && (chat.error.kind === 'not_configured' || (chat.error.kind === 'permission_denied' && chat.error.code !== 'CHAT_CLOSED'));

  // ── Teclado: posición real del contenedor en la ventana ──
  const wrapRef = useRef<View>(null);
  const [keyboardOffset, setKeyboardOffset] = useState(0);
  const measureWrap = useCallback(() => {
    wrapRef.current?.measureInWindow((_x, y) => {
      if (Number.isFinite(y)) setKeyboardOffset(Math.max(0, Math.round(y)));
    });
  }, []);

  // ── Siempre abajo del todo, salvo si la persona está leyendo mensajes anteriores ──
  const listRef = useRef<FlatList<ChatRow<ChatItem>>>(null);
  const stickToBottom = useRef(true);
  const scrollToEnd = useCallback((animated = true) => {
    requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated }));
  }, []);
  const onScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
    stickToBottom.current = contentSize.height - (contentOffset.y + layoutMeasurement.height) < 120;
  }, []);

  const rows = useMemo(() => buildChatRows(chat.items, chat.myId), [chat.items, chat.myId]);

  const submit = async () => {
    const text = draft.trim();
    if (!text) return;
    setDraft('');
    stickToBottom.current = true;
    scrollToEnd();
    const ok = await chat.send(text);
    if (!ok) scrollToEnd();
  };

  const callNow = () => {
    if (!linkId) return;
    if (!premium) {
      void showAlert('Llamadas en pausa', patientSide
        ? 'Para llamar necesitas MediClaro Premium activo.'
        : `Para llamar, ${otherFirst} necesita MediClaro Premium activo.`);
      return;
    }
    router.push({ pathname: '/caregiver-call', params: { link: linkId } });
  };

  const renderItem: ListRenderItem<ChatRow<ChatItem>> = ({ item }) => {
    if (item.kind === 'day') return <ChatDayDivider label={item.label} />;
    const m = item.message;
    if (m.kind === 'call') {
      return (
        <ChatCallEntry
          outcome={m.callOutcome}
          mine={item.mine}
          seconds={m.callSeconds}
          time={chatTime(m.createdAt)}
          onCallBack={premium ? callNow : undefined}
          testID="care-chat-call-log"
        />
      );
    }
    const speakId = `chat-${m.id}`;
    return (
      <ChatBubble
        text={m.content}
        mine={item.mine}
        time={chatTime(m.createdAt)}
        status={item.mine ? m.status : undefined}
        senderName={item.mine ? 'Tú' : other}
        firstInGroup={item.firstInGroup}
        lastInGroup={item.lastInGroup}
        listening={reader.speakingId === speakId || reader.loadingId === speakId}
        onListen={item.mine ? undefined : () => (reader.speakingId === speakId ? reader.stop() : reader.speak(speakId, m.content))}
        onRetry={m.status === 'failed' ? () => chat.retry(m) : undefined}
        onDiscard={m.status === 'failed' ? () => chat.discard(m) : undefined}
        testID={item.mine ? 'care-chat-mine' : 'care-chat-theirs'}
      />
    );
  };

  const header = (
    <AppHeader
      fallbackHref="/caregiver"
      center={
        <ChatPerson
          name={other}
          caption={patientSide ? 'Tu cuidador/a' : premium && !open ? 'Chat apagado' : 'Familiar al que cuidas'}
          off={!patientSide && premium && !open}
        />
      }
      right={
        <View style={styles.headerActions}>
          <Pressable
            onPress={callNow}
            accessibilityRole="button"
            accessibilityLabel={`Llamar a ${other}`}
            hitSlop={6}
            style={({ pressed }) => [styles.callBtn, { backgroundColor: pressed ? c.primarySoft : c.primaryTint, opacity: premium ? 1 : 0.5 }]}
            testID="care-chat-call"
          >
            <Icon name="call" size={22} color={c.primary} />
          </Pressable>
          {patientSide ? (
            <Pressable
              onPress={() => router.push('/emergency')}
              accessibilityRole="button"
              accessibilityLabel="¿Es una urgencia? Abrir emergencias y el 112"
              hitSlop={6}
              style={({ pressed }) => [styles.sos, { borderColor: c.danger, backgroundColor: pressed ? c.dangerSoft : c.surface }]}
              testID="care-chat-emergency"
            >
              <Icon name="alert-circle" size={18} color={c.danger} />
              {narrow ? null : <AppText variant="small" style={{ color: c.dangerText }}>112</AppText>}
            </Pressable>
          ) : null}
        </View>
      }
    />
  );

  const listHeader = (
    <View style={{ gap: theme.spacing.sm }}>
      {chat.hasMore ? (
        <TextButton
          label={chat.loadingOlder ? 'Cargando…' : 'Ver mensajes anteriores'}
          icon="arrow-up-circle-outline"
          onPress={() => {
            stickToBottom.current = false;
            void chat.loadOlder();
          }}
          disabled={chat.loadingOlder}
          align="center"
          testID="care-chat-older"
        />
      ) : null}
      <View style={styles.privacy} accessible accessibilityLabel={`Solo lo veis ${otherFirst} y tú. Los mensajes se borran a los 90 días.`}>
        <Icon name="lock-closed" size={14} color={c.textMuted} />
        <AppText variant="small" color="textMuted" align="center" style={styles.thin}>
          {`Solo lo veis ${otherFirst} y tú · Se borran a los 90 días`}
        </AppText>
      </View>
    </View>
  );

  const empty = !chat.loading && !chat.items.length && !blocked;
  const emptyState = (
    <View style={[styles.empty, { backgroundColor: c.surface, borderColor: c.border, borderRadius: theme.radius.xl }]} testID="care-chat-empty">
      <Avatar name={other} size={64} />
      <AppText variant="heading" color="heading" align="center">{`Escribe a ${otherFirst}`}</AppText>
      <AppText variant="body" color="textSecondary" align="center">
        Lo que escribas aquí le llegará a su móvil con la hora. Cuando lo lea, verás «Visto».
      </AppText>
    </View>
  );

  const quick = patientSide ? PATIENT_QUICK_REPLIES : CAREGIVER_QUICK_REPLIES;
  const bottomPadding = keyboardVisible ? theme.spacing.sm : Math.max(insets.bottom, theme.spacing.sm);

  if (!linkId) {
    return (
      <Screen header={<AppHeader title="Chat" fallbackHref="/caregiver" />}>
        <InfoBanner tone="warning" title="No encontramos esta conversación" message="Ábrela desde «Cuidador y avisos»." />
        <PrimaryButton label="Ir a Cuidador y avisos" icon="people" onPress={() => router.replace('/caregiver')} />
      </Screen>
    );
  }

  return (
    <Screen edges={['top']} scroll={false} padded={false} header={header} testID="care-chat-screen">
      <View ref={wrapRef} style={styles.flex} onLayout={measureWrap} collapsable={false}>
        <KeyboardAvoidingView style={styles.flex} behavior="padding" keyboardVerticalOffset={keyboardOffset}>
          {blocked ? (
            <View style={{ paddingHorizontal: theme.layout.screenPaddingH, paddingTop: theme.spacing.sm, gap: theme.spacing.sm }}>
              <InfoBanner tone="warning" title={chat.error?.message ?? 'Esta conversación no está disponible.'} />
              <PrimaryButton label="Volver a Cuidador y avisos" icon="people" onPress={() => router.replace('/caregiver')} />
            </View>
          ) : !premium ? (
            <View style={{ paddingHorizontal: theme.layout.screenPaddingH, paddingTop: theme.spacing.sm }}>
              <InfoBanner
                tone="warning"
                title="El chat está en pausa"
                message={
                  patientSide
                    ? 'Para seguir escribiéndoos necesitas MediClaro Premium activo. Podéis seguir leyendo los mensajes.'
                    : `Para escribir, ${otherFirst} necesita MediClaro Premium activo. Podéis seguir leyendo los mensajes.`
                }
                action={patientSide && entitlement.canSell ? { label: 'Ver planes', onPress: () => router.push('/premium') } : undefined}
                testID="care-chat-paused"
              />
            </View>
          ) : (
            <ChatWindowState
              patientSide={patientSide}
              open={open}
              otherFirst={otherFirst}
              until={openUntilText}
              style={{ marginHorizontal: theme.layout.screenPaddingH, marginTop: theme.spacing.sm }}
            />
          )}

          {chat.loading && !chat.items.length ? (
            <View style={styles.loading}>
              <ActivityIndicator color={c.primary} />
              <AppText variant="caption" color="textSecondary">Cargando la conversación…</AppText>
            </View>
          ) : (
            <FlatList
              ref={listRef}
              style={styles.flex}
              data={rows}
              extraData={`${reader.speakingId ?? ''}|${reader.loadingId ?? ''}`}
              keyExtractor={(r) => r.key}
              renderItem={renderItem}
              ListHeaderComponent={listHeader}
              ListFooterComponent={empty ? emptyState : null}
              contentContainerStyle={{
                flexGrow: 1,
                justifyContent: 'flex-end',
                paddingHorizontal: theme.layout.screenPaddingH,
                paddingTop: theme.spacing.sm,
                paddingBottom: theme.spacing.md,
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
              accessibilityLabel={`Conversación con ${other}`}
              testID="care-chat-list"
            />
          )}

          {!blocked ? (
            <View
              style={[
                styles.inputArea,
                {
                  borderTopColor: c.divider,
                  backgroundColor: c.background,
                  paddingHorizontal: theme.layout.screenPaddingH,
                  paddingTop: theme.spacing.sm,
                  paddingBottom: bottomPadding,
                  gap: theme.spacing.sm,
                },
              ]}
            >
              {canSend && !draft.trim() ? <QuickReplies items={quick} onPick={setDraft} testID="care-chat-quick" /> : null}
              <ChatComposer
                value={draft}
                onChangeText={setDraft}
                onSend={() => void submit()}
                placeholder={canSend ? `Escribe a ${otherFirst}…` : !premium ? 'El chat está en pausa' : 'Chat apagado'}
                disabled={!canSend}
                maxLength={CARE_CHAT_MAX_LENGTH}
                sendLabel={`Enviar mensaje a ${otherFirst}`}
                onFocus={() => {
                  stickToBottom.current = true;
                  measureWrap();
                }}
                testID="care-chat"
              />
              {chat.error && !blocked && chat.error.kind !== 'limit_reached' ? (
                <AppText variant="small" color="textSecondary" align="center" accessibilityLiveRegion="polite">
                  {chat.error.kind === 'offline' ? 'Sin conexión: los mensajes nuevos llegarán al volver internet.' : chat.error.message}
                </AppText>
              ) : null}
            </View>
          ) : null}
        </KeyboardAvoidingView>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  thin: { fontWeight: '400' },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8, marginRight: 8 },
  callBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  sos: { flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1.5, borderRadius: 999, paddingHorizontal: 10, minHeight: 40 },
  privacy: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 6 },
  empty: { alignItems: 'center', gap: 10, padding: 20, borderWidth: 1, marginTop: 16 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  inputArea: { borderTopWidth: StyleSheet.hairlineWidth },
});
