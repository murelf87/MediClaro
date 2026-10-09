/**
 * Piezas del chat con el cuidador/a (y del chat de los avisos de emergencia), pensadas para personas mayores:
 * burbujas grandes y con buen contraste, hora y «Visto» en cada mensaje, separadores de día, botón «Escuchar» en los
 * mensajes recibidos, respuestas rápidas y una caja de escribir con un botón de enviar grande.
 */
import { type ReactNode } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { AppText } from './AppText';
import { Icon, type IconName } from './Icon';
import { Avatar } from './Feedback';
import { useAppTheme } from '../providers/PreferencesProvider';
import { MAX_FONT_SIZE_MULTIPLIER } from '../theme';
import { callLogLabel } from '../utils/chatTimeline';

export type BubbleStatus = 'sending' | 'failed' | 'sent' | 'read';

/** `rows` solo existe en la web (react-native-web): la caja de escribir empieza con una línea. */
const WEB_ONE_ROW = Platform.OS === 'web' ? { rows: 1 } : {};

const STATUS_LABEL: Record<BubbleStatus, string> = {
  sending: 'Enviando…',
  failed: 'No enviado',
  sent: 'Enviado',
  read: 'Visto',
};

export function ChatBubble({
  text,
  mine,
  time,
  status,
  senderName,
  firstInGroup = true,
  lastInGroup = true,
  compact = false,
  highlight,
  listening,
  onListen,
  onRetry,
  onDiscard,
  footer,
  testID,
}: {
  text: string;
  mine: boolean;
  time: string;
  /** Solo en los mensajes propios. */
  status?: BubbleStatus;
  /** Quién escribe (para el lector de pantalla y, si se pide, encima de la burbuja). */
  senderName: string;
  firstInGroup?: boolean;
  lastInGroup?: boolean;
  /** Versión más pequeña (vista previa en la pantalla del cuidador/a). */
  compact?: boolean;
  /** Texto destacado debajo (p. ej. «Respuesta pendiente»). */
  highlight?: string;
  listening?: boolean;
  onListen?: () => void;
  onRetry?: () => void;
  onDiscard?: () => void;
  footer?: ReactNode;
  testID?: string;
}) {
  const theme = useAppTheme();
  const c = theme.colors;
  const failed = status === 'failed';
  const fg = mine ? c.onPrimary : c.text;
  const meta = mine ? 'rgba(255,255,255,0.86)' : c.textMuted;
  const tail = 6;
  const r = compact ? 16 : 20;
  const statusText = mine && status ? STATUS_LABEL[status] : '';
  const statusIcon: IconName | null = !mine || !status
    ? null
    : status === 'sending' ? 'time-outline' : status === 'failed' ? 'alert-circle' : status === 'read' ? 'checkmark-done' : 'checkmark';
  return (
    <View
      style={[
        styles.row,
        { alignItems: mine ? 'flex-end' : 'flex-start', marginTop: firstInGroup ? (compact ? 6 : 10) : 3 },
      ]}
      testID={testID}
    >
      <View
        accessible
        accessibilityLabel={`${mine ? 'Tú' : senderName}, a las ${time}: ${text}.${statusText ? ` ${statusText}.` : ''}`}
        style={[
          styles.bubble,
          {
            maxWidth: compact ? '92%' : '84%',
            paddingHorizontal: compact ? 12 : 16,
            paddingTop: compact ? 8 : 11,
            paddingBottom: compact ? 6 : 8,
            backgroundColor: mine ? (failed ? c.dangerPressed : c.primary) : c.surface,
            borderColor: mine ? 'transparent' : c.border,
            borderWidth: mine ? 0 : 1,
            borderTopLeftRadius: !mine && !firstInGroup ? tail : r,
            borderTopRightRadius: mine && !firstInGroup ? tail : r,
            borderBottomLeftRadius: !mine && lastInGroup ? tail : r,
            borderBottomRightRadius: mine && lastInGroup ? tail : r,
            opacity: status === 'sending' ? 0.82 : 1,
          },
          !mine && !compact ? theme.shadow.card : null,
        ]}
      >
        <AppText
          variant={compact ? 'caption' : 'body'}
          style={{ color: fg }}
          selectable={!compact}
          numberOfLines={compact ? 3 : undefined}
        >
          {text}
        </AppText>
        <View style={[styles.meta, { justifyContent: onListen ? 'space-between' : 'flex-end' }]}>
          {onListen ? (
            <Pressable
              onPress={onListen}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel={listening ? 'Detener la lectura del mensaje' : 'Escuchar el mensaje'}
              style={({ pressed }) => [styles.listen, { borderColor: c.primarySoft, backgroundColor: pressed ? c.primaryTint : 'transparent' }]}
              testID={testID ? `${testID}-listen` : undefined}
            >
              <Icon name={listening ? 'stop-circle-outline' : 'volume-high'} size={18} color={c.primary} />
              <AppText variant="small" style={{ color: c.primary }}>{listening ? 'Detener' : 'Escuchar'}</AppText>
            </Pressable>
          ) : null}
          <View style={styles.metaRight}>
            <AppText variant="small" style={{ color: meta, fontWeight: '500' }}>{time}</AppText>
            {statusIcon ? <Icon name={statusIcon} size={16} color={status === 'read' ? '#BFE3FF' : meta} /> : null}
            {mine && (status === 'read' || status === 'sending') ? (
              <AppText variant="small" style={{ color: meta, fontWeight: '500' }}>{statusText}</AppText>
            ) : null}
          </View>
        </View>
      </View>
      {highlight ? (
        <AppText variant="small" color="textSecondary" style={[styles.under, { textAlign: mine ? 'right' : 'left' }]}>{highlight}</AppText>
      ) : null}
      {failed ? (
        <View style={styles.failedRow} accessibilityRole="alert">
          <AppText variant="small" color="dangerText" style={styles.failedText}>No se ha enviado.</AppText>
          {onRetry ? (
            <Pressable onPress={onRetry} hitSlop={10} accessibilityRole="button" accessibilityLabel="Reintentar el envío" style={styles.failedBtn} testID={testID ? `${testID}-retry` : undefined}>
              <Icon name="refresh" size={16} color={c.primary} />
              <AppText variant="small" style={{ color: c.primary }}>Reintentar</AppText>
            </Pressable>
          ) : null}
          {onDiscard ? (
            <Pressable onPress={onDiscard} hitSlop={10} accessibilityRole="button" accessibilityLabel="Quitar este mensaje" style={styles.failedBtn}>
              <Icon name="close" size={16} color={c.textSecondary} />
              <AppText variant="small" color="textSecondary">Quitar</AppText>
            </Pressable>
          ) : null}
        </View>
      ) : null}
      {footer}
    </View>
  );
}

/**
 * Registro de una llamada en la conversación («Llamada de voz · 3 min», «Llamada perdida»…), centrado como en
 * WhatsApp. En una llamada perdida, «Devolver la llamada».
 */
export function ChatCallEntry({
  outcome,
  mine,
  seconds,
  time,
  onCallBack,
  compact = false,
  testID,
}: {
  outcome: 'answered' | 'missed' | 'declined' | 'failed' | null | undefined;
  mine: boolean;
  seconds?: number | null;
  time: string;
  onCallBack?: () => void;
  compact?: boolean;
  testID?: string;
}) {
  const theme = useAppTheme();
  const c = theme.colors;
  const missed = outcome === 'missed' && !mine;
  const label = callLogLabel(outcome, mine, seconds);
  const tint = missed ? c.danger : outcome === 'answered' ? c.successStrong : c.textSecondary;
  return (
    <View style={[styles.callRow, { marginTop: compact ? 6 : 12 }]} testID={testID}>
      <View
        style={[styles.callPill, { backgroundColor: missed ? c.dangerSoft : c.surface, borderColor: missed ? '#F9D3D1' : c.border }]}
        accessible
        accessibilityLabel={`${label}, a las ${time}`}
      >
        <View style={[styles.callIcon, { backgroundColor: missed ? c.danger : outcome === 'answered' ? c.successSoft : c.surfaceAlt }]}>
          <Icon name={mine ? 'arrow-up' : 'arrow-down'} size={11} color={missed ? '#FFFFFF' : tint} />
          <Icon name="call" size={13} color={missed ? '#FFFFFF' : tint} />
        </View>
        <AppText variant={compact ? 'small' : 'captionStrong'} style={{ color: missed ? c.dangerText : c.heading, flexShrink: 1 }}>{label}</AppText>
        <AppText variant="small" color="textMuted">{time}</AppText>
      </View>
      {missed && onCallBack ? (
        <Pressable onPress={onCallBack} accessibilityRole="button" hitSlop={8} style={styles.callBack} testID={testID ? `${testID}-back` : undefined}>
          <Icon name="call" size={16} color={c.primary} />
          <AppText variant="small" style={{ color: c.primary }}>Devolver la llamada</AppText>
        </Pressable>
      ) : null}
    </View>
  );
}

/** «Hoy», «Ayer», «Lunes 6 de octubre» centrado entre los mensajes. */
export function ChatDayDivider({ label }: { label: string }) {
  const theme = useAppTheme();
  return (
    <View style={styles.day} accessibilityRole="header" accessibilityLabel={label}>
      <View style={[styles.dayPill, { backgroundColor: theme.colors.surfaceAlt, borderColor: theme.colors.border }]}>
        <AppText variant="small" color="textSecondary">{label}</AppText>
      </View>
    </View>
  );
}

/** Caja de escribir + botón de enviar grande y redondo. */
export function ChatComposer({
  value,
  onChangeText,
  onSend,
  placeholder,
  disabled,
  maxLength = 1000,
  sendLabel = 'Enviar mensaje',
  onFocus,
  testID,
}: {
  value: string;
  onChangeText: (text: string) => void;
  onSend: () => void;
  placeholder: string;
  disabled?: boolean;
  maxLength?: number;
  sendLabel?: string;
  onFocus?: () => void;
  testID?: string;
}) {
  const theme = useAppTheme();
  const c = theme.colors;
  const canSend = !disabled && value.trim().length > 0;
  const size = theme.easyMode ? 64 : 56;
  return (
    <View style={styles.composer}>
      <View
        style={[
          styles.inputBox,
          { minHeight: size, borderRadius: theme.radius.xl, borderColor: c.borderStrong, backgroundColor: disabled ? c.surfaceAlt : c.surface },
        ]}
      >
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={c.textMuted}
          editable={!disabled}
          multiline
          {...WEB_ONE_ROW}
          maxLength={maxLength}
          maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER}
          accessibilityLabel={placeholder}
          accessibilityHint={`Hasta ${maxLength} letras`}
          autoCapitalize="sentences"
          textAlignVertical="center"
          onFocus={onFocus}
          style={[styles.input, theme.typography.body, { color: c.text, maxHeight: (theme.typography.body.lineHeight ?? 24) * 5 + 24 }]}
          testID={testID ? `${testID}-input` : undefined}
        />
      </View>
      <Pressable
        onPress={onSend}
        disabled={!canSend}
        accessibilityRole="button"
        accessibilityLabel={sendLabel}
        accessibilityState={{ disabled: !canSend }}
        style={({ pressed }) => [
          styles.send,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: canSend ? (pressed ? c.primaryPressed : c.primary) : c.surfaceMuted,
            transform: [{ scale: pressed && canSend ? 0.96 : 1 }],
          },
          canSend ? theme.shadow.button : null,
        ]}
        testID={testID ? `${testID}-send` : undefined}
      >
        <Icon name="paper-plane" size={26} color={canSend ? c.onPrimary : c.textMuted} />
      </Pressable>
    </View>
  );
}

/** Frases rápidas: al tocar una, se escribe en la caja (y la persona decide si la envía). */
export function QuickReplies({ items, onPick, testID }: { items: string[]; onPick: (text: string) => void; testID?: string }) {
  const theme = useAppTheme();
  const c = theme.colors;
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={styles.quick}
      accessibilityLabel="Frases rápidas"
      testID={testID}
    >
      {items.map((text) => (
        <Pressable
          key={text}
          onPress={() => onPick(text)}
          accessibilityRole="button"
          accessibilityLabel={`Escribir: ${text}`}
          style={({ pressed }) => [
            styles.quickChip,
            { borderColor: c.primarySoft, backgroundColor: pressed ? c.primaryTint : c.surface, borderRadius: theme.radius.pill },
          ]}
        >
          <AppText variant="label" style={{ color: c.primary }}>{text}</AppText>
        </Pressable>
      ))}
    </ScrollView>
  );
}

/** Persona con la que se habla (cabecera del chat): foto o iniciales, nombre y relación. */
export function ChatPerson({ name, caption, size = 40, off = false }: { name: string; caption: string; size?: number; off?: boolean }) {
  const theme = useAppTheme();
  return (
    <View style={styles.person} accessible accessibilityRole="header" accessibilityLabel={`Chat con ${name}. ${caption}`}>
      <Avatar name={name} size={size} tone={off ? 'neutral' : 'primary'} />
      <View style={styles.personText}>
        <AppText variant="subheading" color="heading" numberOfLines={1}>{name}</AppText>
        <View style={styles.personCaption}>
          {off ? <View style={[styles.offDot, { backgroundColor: theme.colors.danger }]} /> : null}
          <AppText variant="small" style={off ? { color: theme.colors.dangerText, fontWeight: '700' } : undefined} color={off ? undefined : 'textSecondary'} numberOfLines={1}>
            {caption}
          </AppText>
        </View>
      </View>
    </View>
  );
}

/** Número de mensajes sin leer (círculo). */
export function UnreadBadge({ count, testID }: { count: number; testID?: string }) {
  const theme = useAppTheme();
  if (count <= 0) return null;
  return (
    <View style={[styles.unread, { backgroundColor: theme.colors.danger }]} accessible accessibilityLabel={`${count} sin leer`} testID={testID}>
      <AppText variant="small" style={styles.unreadText} allowFontScaling={false}>{count > 99 ? '99+' : String(count)}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  personCaption: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  offDot: { width: 8, height: 8, borderRadius: 4 },
  row: { width: '100%' },
  bubble: { gap: 4 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  metaRight: { flexDirection: 'row', alignItems: 'center', gap: 4, marginLeft: 'auto' },
  listen: { flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  under: { marginTop: 4, maxWidth: '84%' },
  failedRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginTop: 6, justifyContent: 'flex-end' },
  failedText: { flexShrink: 1 },
  failedBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 32 },
  day: { alignItems: 'center', marginTop: 16, marginBottom: 4 },
  dayPill: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 999, borderWidth: StyleSheet.hairlineWidth },
  composer: { flexDirection: 'row', alignItems: 'flex-end', gap: 10 },
  inputBox: { flex: 1, borderWidth: 1.5, paddingHorizontal: 16, justifyContent: 'center' },
  input: { minHeight: 52, paddingTop: 14, paddingBottom: 14 },
  send: { alignItems: 'center', justifyContent: 'center' },
  quick: { gap: 8, paddingVertical: 2, paddingRight: 8 },
  quickChip: { borderWidth: 1.5, paddingHorizontal: 14, paddingVertical: 9, minHeight: 44, justifyContent: 'center' },
  person: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, minWidth: 0 },
  personText: { flex: 1, minWidth: 0 },
  unread: { minWidth: 24, height: 24, borderRadius: 12, paddingHorizontal: 6, alignItems: 'center', justifyContent: 'center' },
  callRow: { alignItems: 'center', gap: 4 },
  callPill: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 999, paddingLeft: 6, paddingRight: 12, paddingVertical: 5, maxWidth: '92%' },
  callIcon: { flexDirection: 'row', alignItems: 'center', borderRadius: 999, paddingHorizontal: 6, paddingVertical: 4 },
  callBack: { flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 32 },
  unreadText: { color: '#FFFFFF', fontSize: 13, lineHeight: 16, fontWeight: '800' },
});
