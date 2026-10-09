/**
 * Tarjeta del chat en «Cuidador y avisos»: con quién hablas, los últimos mensajes como en el chat, cuántos hay sin leer
 * y una caja «Escribe a …» que abre la conversación completa (/caregiver-chat).
 */
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { AppText, Avatar, Card, Icon } from '../../components';
import { ChatBubble, ChatCallEntry, UnreadBadge } from '../../components/CareChat';
import { useAppTheme } from '../../hooks';
import { CareChatService, canWriteNow, chatOpen, type CareChatMessage, type CareConversation } from '../../services/CareChatService';
import { chatDayKey, chatDayLabel, chatTime } from '../../utils/chatTimeline';
import { ChatWindowState, OffBadge } from '../../components/CareChatWindow';
import { useNow } from '../../hooks/usePillPlan';

const firstName = (name: string) => name.trim().split(/\s+/)[0] || name;

export function CareChatCard({
  conversation,
  myId,
  onOpen,
  onCall,
}: {
  conversation: CareConversation;
  myId: string | null;
  onOpen: () => void;
  /** Llamada de voz (solo si la conversación lo permite). */
  onCall?: () => void;
}) {
  const theme = useAppTheme();
  const c = theme.colors;
  const [recent, setRecent] = useState<CareChatMessage[]>(() => (conversation.lastMessage ? [conversation.lastMessage] : []));
  const lastId = conversation.lastMessage?.id ?? '';
  const lastRead = conversation.lastMessage?.readAt ?? '';
  useEffect(() => {
    let alive = true;
    if (!lastId) {
      setRecent([]);
      return undefined;
    }
    void CareChatService.messages(conversation.linkId, { limit: 3 })
      .then((page) => {
        if (alive) setRecent(page.messages);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [conversation.linkId, lastId, lastRead]);

  const patientSide = conversation.myRole === 'patient';
  const other = conversation.otherName;
  const first = firstName(other);
  const last = conversation.lastMessage;
  const unread = conversation.unread;
  // La conversación la enciende la persona cuidada: para el cuidador/a, apagada (en rojo) tras 1 hora sin mensajes.
  const now = useNow(30_000).getTime();
  const open = chatOpen(conversation, now);
  const writable = canWriteNow(conversation, now);
  const off = !patientSide && conversation.premium && !open;
  return (
    <Card style={[styles.card, { borderColor: off ? '#F5C2C2' : unread ? c.primary : c.border }]} testID={`caregiver-chat-card-${conversation.linkId}`}>
      <View style={styles.head}>
        <View>
          <Avatar name={other} size={52} tone={off ? 'neutral' : 'primary'} />
          {off ? <OffBadge size={20} testID={`caregiver-chat-off-${conversation.linkId}`} /> : null}
        </View>
        <View style={styles.flex}>
          <AppText variant="subheading" color="heading" numberOfLines={1}>{`Chat con ${first}`}</AppText>
          <AppText variant="caption" color="textSecondary" numberOfLines={1}>
            {patientSide ? 'Tu cuidador/a' : 'Familiar al que cuidas'}
            {last ? ` · ${chatDayLabel(last.createdAt).toLowerCase() === 'hoy' ? chatTime(last.createdAt) : chatDayLabel(last.createdAt)}` : ''}
          </AppText>
        </View>
        <UnreadBadge count={unread} testID={`caregiver-chat-unread-${conversation.linkId}`} />
        {onCall && conversation.premium ? (
          <Pressable
            onPress={onCall}
            accessibilityRole="button"
            accessibilityLabel={`Llamar a ${other}`}
            hitSlop={6}
            style={({ pressed }) => [styles.call, { backgroundColor: pressed ? c.primarySoft : c.primaryTint }]}
            testID={`caregiver-chat-call-${conversation.linkId}`}
          >
            <Icon name="call" size={22} color={c.primary} />
          </Pressable>
        ) : null}
      </View>

      <Pressable
        onPress={onOpen}
        accessibilityRole="button"
        accessibilityLabel={unread ? `Abrir el chat con ${other}. ${unread} mensaje${unread === 1 ? '' : 's'} sin leer` : `Abrir el chat con ${other}`}
        style={({ pressed }) => [styles.thread, { backgroundColor: c.background, borderColor: c.border, borderRadius: theme.radius.lg, opacity: pressed ? 0.9 : 1 }]}
        testID={`caregiver-chat-open-${conversation.linkId}`}
      >
        {recent.length ? (
          recent.map((m, i) => {
            const newDay = i === 0 || chatDayKey(recent[i - 1].createdAt) !== chatDayKey(m.createdAt);
            const sameAsPrev = !newDay && recent[i - 1].senderId === m.senderId;
            const next = recent[i + 1];
            const sameAsNext = !!next && next.senderId === m.senderId && chatDayKey(next.createdAt) === chatDayKey(m.createdAt);
            return (
              <View key={m.id}>
                {newDay ? (
                  <AppText variant="small" color="textMuted" align="center" style={styles.day}>{chatDayLabel(m.createdAt)}</AppText>
                ) : null}
                {m.kind === 'call' ? (
                  <ChatCallEntry compact outcome={m.callOutcome} mine={m.senderId === myId} seconds={m.callSeconds} time={chatTime(m.createdAt)} />
                ) : (
                <ChatBubble
                  compact
                  text={m.content}
                  mine={m.senderId === myId}
                  time={chatTime(m.createdAt)}
                  status={m.senderId === myId ? (m.readAt ? 'read' : 'sent') : undefined}
                  senderName={m.senderId === myId ? 'Tú' : other}
                  firstInGroup={!sameAsPrev}
                  lastInGroup={!sameAsNext}
                />
                )}
              </View>
            );
          })
        ) : (
          <View style={styles.emptyThread}>
            <Icon name="chatbubbles-outline" size={28} color={c.primary} />
            <AppText variant="caption" color="textSecondary" align="center">
              {`Todavía no os habéis escrito. ${patientSide ? `Lo que escribas, ${first} lo verá en su móvil.` : `Escríbele: lo verá en su móvil.`}`}
            </AppText>
          </View>
        )}
        <View style={[styles.fakeInput, { borderColor: c.borderStrong, backgroundColor: c.surface }]}>
          <AppText variant="body" color="textMuted" style={styles.flex} numberOfLines={1}>
            {writable ? `Escribe a ${first}…` : !conversation.premium ? 'Chat en pausa: solo lectura' : 'Chat apagado'}
          </AppText>
          <View style={[styles.fakeSend, { backgroundColor: writable ? c.primary : c.surfaceMuted }]}>
            <Icon name="paper-plane" size={20} color={writable ? c.onPrimary : c.textMuted} />
          </View>
        </View>
      </Pressable>
      {conversation.premium ? (
        <ChatWindowState patientSide={patientSide} open={open} otherFirst={first} until={conversation.openUntil ? chatTime(conversation.openUntil) : ''} />
      ) : null}
    </Card>
  );
}

/** Sin conversaciones todavía: cómo se abre el chat. */
export function CareChatPlaceholder({ caregiverSide, onLink }: { caregiverSide: boolean; onLink?: () => void }) {
  const theme = useAppTheme();
  const c = theme.colors;
  return (
    <Card style={styles.card} testID="caregiver-chat-placeholder">
      <View style={styles.head}>
        <View style={[styles.icon, { backgroundColor: c.primaryTint }]}>
          <Icon name="chatbubbles" size={26} color={c.primary} />
        </View>
        <View style={styles.flex}>
          <AppText variant="subheading" color="heading">{caregiverSide ? 'Chat con tu familiar' : 'Chat con tu cuidador/a'}</AppText>
          <AppText variant="caption" color="textSecondary">
            {caregiverSide
              ? 'Cuando tu familiar acepte tu solicitud, podréis escribiros aquí y verás sus mensajes al momento.'
              : 'Cuando aceptes a tu cuidador/a, podréis escribiros aquí: verá tus mensajes en su móvil y tú los suyos.'}
          </AppText>
        </View>
      </View>
      {onLink ? (
        <Pressable onPress={onLink} accessibilityRole="button" style={styles.linkRow} hitSlop={8}>
          <AppText variant="label" style={{ color: c.primary }}>{caregiverSide ? 'Enviar mi solicitud' : 'Vincular a mi cuidador/a'}</AppText>
          <Icon name="arrow-down" size={18} color={c.primary} />
        </Pressable>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: 12, borderWidth: 1 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  flex: { flex: 1, minWidth: 0 },
  thread: { borderWidth: 1, padding: 12, gap: 2 },
  emptyThread: { alignItems: 'center', gap: 6, paddingVertical: 8 },
  day: { marginTop: 4, fontWeight: '500' },
  fakeInput: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1.5, borderRadius: 999, paddingLeft: 16, paddingRight: 6, minHeight: 52, marginTop: 10 },
  fakeSend: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  icon: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  linkRow: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', minHeight: 40 },
  call: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
});
