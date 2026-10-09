/**
 * Estado del chat con el cuidador/a: la conversación la enciende la persona cuidada (Premium). Desde su último
 * mensaje, su cuidador/a puede responder durante 1 hora; después el chat se ve APAGADO (icono rojo) para el
 * cuidador/a, allí donde salga (botón central, tarjeta de Inicio, Cuidador y avisos y el propio chat), hasta que la
 * persona cuidada vuelva a escribirle. La persona cuidada escribe siempre.
 *
 *  - ChatWindowState: la línea de estado dentro del chat.
 *  - CareChatHomeCard: la tarjeta grande de Inicio (como la de identificar), encendida, apagada o con candado.
 *  - OffBadge: el puntito rojo de «apagado» para iconos.
 */
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { AppText } from './AppText';
import { FitText } from './FitText';
import { Icon } from './Icon';
import { useAppTheme } from '../providers/PreferencesProvider';

export const CHAT_WINDOW_HOURS = 1;

/** Línea de estado dentro de la conversación. */
export function ChatWindowState({
  patientSide,
  open,
  otherFirst,
  until,
  style,
}: {
  patientSide: boolean;
  open: boolean;
  otherFirst: string;
  /** Hora hasta la que está encendido («19:45»), si lo está. */
  until: string;
  style?: StyleProp<ViewStyle>;
}) {
  const theme = useAppTheme();
  const c = theme.colors;
  const off = !open;
  let text: string;
  if (patientSide) {
    text = open ? `${otherFirst} puede responderte hasta las ${until}.` : `Escríbele: ${otherFirst} podrá responderte durante ${CHAT_WINDOW_HOURS} hora.`;
  } else {
    text = open ? `Encendido hasta las ${until}: ${otherFirst} te ha escrito.` : `Apagado: se enciende cuando ${otherFirst} te escriba, durante ${CHAT_WINDOW_HOURS} hora.`;
  }
  const tone = patientSide ? (open ? 'ok' : 'info') : off ? 'off' : 'ok';
  const colors = tone === 'off' ? { bg: c.dangerSoft, fg: c.dangerText, line: '#F5C2C2' } : tone === 'ok' ? { bg: c.successSoft, fg: c.successStrong, line: '#BBE7CB' } : { bg: c.primaryTint, fg: c.primary, line: c.primarySoft };
  return (
    <View
      style={[styles.state, { backgroundColor: colors.bg, borderColor: colors.line, borderRadius: theme.radius.md }, style]}
      accessible
      accessibilityLiveRegion="polite"
      accessibilityLabel={text}
      testID={`care-chat-window-${tone === 'off' ? 'off' : 'on'}`}
    >
      <Icon name={tone === 'off' ? 'power' : tone === 'ok' ? 'radio-button-on' : 'information-circle'} size={18} color={colors.fg} />
      <AppText variant="small" style={[styles.stateText, { color: colors.fg }]}>{text}</AppText>
    </View>
  );
}

/** Puntito rojo de «apagado» sobre un icono. */
export function OffBadge({ size = 18, testID }: { size?: number; testID?: string }) {
  const theme = useAppTheme();
  return (
    <View
      style={[styles.offBadge, { width: size, height: size, borderRadius: size / 2, backgroundColor: theme.colors.danger, borderColor: theme.colors.surface }]}
      testID={testID}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Icon name="power" size={Math.round(size * 0.6)} color="#FFFFFF" />
    </View>
  );
}

export type CareChatCardState =
  /** Persona cuidada con Premium y cuidador/a vinculado: se puede escribir. */
  | 'ready'
  /** Persona cuidada con Premium pero sin cuidador/a todavía. */
  | 'unlinked'
  /** Cuidador/a: encendido (la persona cuidada ha escrito hace menos de 1 hora). */
  | 'on'
  /** Cuidador/a: apagado hasta que la persona cuidada escriba. */
  | 'off'
  /** Sin Premium: función de MediClaro Premium. */
  | 'locked';

/**
 * Tarjeta grande del chat en Inicio (misma forma que «Identificar un medicamento»): siempre está, en el estado
 * que toque.
 */
export function CareChatHomeCard({
  state,
  otherFirst,
  unread = 0,
  until = '',
  onPress,
  testID = 'home-care-chat',
}: {
  state: CareChatCardState;
  /** Nombre de pila de la otra persona (cuidador/a o familiar cuidado). */
  otherFirst: string;
  unread?: number;
  /** Hora hasta la que está encendido (estado «on»). */
  until?: string;
  onPress: () => void;
  testID?: string;
}) {
  const theme = useAppTheme();
  const c = theme.colors;
  const off = state === 'off';
  const locked = state === 'locked';
  const dim = off || locked || state === 'unlinked';
  const title =
    state === 'on' || state === 'off' ? `Chat con ${otherFirst}` : state === 'unlinked' ? 'Chat con tu cuidador/a' : state === 'ready' ? `Chat con ${otherFirst}` : 'Chat con tu cuidador/a';
  const sub =
    state === 'ready'
      ? unread
        ? `${unread} mensaje${unread === 1 ? '' : 's'} sin leer`
        : `Escríbele cuando quieras: podrá responderte durante ${CHAT_WINDOW_HOURS} hora`
      : state === 'on'
        ? unread
          ? `${unread} mensaje${unread === 1 ? '' : 's'} sin leer · encendido hasta las ${until}`
          : `Encendido hasta las ${until}`
        : state === 'off'
          ? `Apagado · se enciende cuando ${otherFirst} te escriba`
          : state === 'unlinked'
            ? 'Vincula a tu cuidador/a para poder escribirle'
            : 'Función de MediClaro Premium';
  const fg = dim ? c.heading : '#FFFFFF';
  const subFg = dim ? c.textSecondary : 'rgba(255,255,255,0.92)';
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${sub}`}
      accessibilityState={{ disabled: off }}
      testID={testID}
      style={({ pressed }) => [
        styles.card,
        { borderRadius: theme.radius.lg, backgroundColor: dim ? c.surface : c.danger, borderColor: off ? '#F5C2C2' : dim ? c.border : 'transparent' },
        dim ? theme.shadow.card : theme.shadow.danger,
        { opacity: pressed ? 0.88 : 1, transform: [{ scale: pressed ? 0.99 : 1 }] },
      ]}
    >
      {!dim ? (
        <LinearGradient colors={['#F0605D', '#E24747', '#C92F2F']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[StyleSheet.absoluteFill, { borderRadius: theme.radius.lg }]} />
      ) : null}
      <View style={styles.inner}>
        <View style={[styles.tile, { backgroundColor: dim ? (off ? c.dangerSoft : c.surfaceMuted) : '#FFFFFF' }]}>
          <Icon name="chatbubbles" size={28} color={dim ? (off ? c.danger : c.textMuted) : c.danger} />
          <View style={[styles.heart, { backgroundColor: dim ? c.surface : c.danger }]}>
            <Icon name="heart" size={11} color={dim ? c.danger : '#FFFFFF'} />
          </View>
          {off ? <OffBadge size={20} testID={`${testID}-off`} /> : null}
        </View>
        <View style={styles.text}>
          <FitText variant="heading" fit="words" minScale={0.7} style={{ color: fg }}>{title}</FitText>
          <AppText variant="caption" style={{ color: subFg }}>{sub}</AppText>
        </View>
        {locked ? (
          <View style={[styles.lock, { backgroundColor: c.premiumSoft, borderRadius: theme.radius.pill }]}>
            <Icon name="lock-closed" size={14} color={c.premiumText} />
          </View>
        ) : unread && !off ? (
          <View style={[styles.count, { backgroundColor: dim ? c.danger : '#FFFFFF' }]} testID={`${testID}-unread`}>
            <AppText variant="small" style={[styles.countText, { color: dim ? '#FFFFFF' : c.dangerText }]} allowFontScaling={false}>
              {unread > 9 ? '9+' : String(unread)}
            </AppText>
          </View>
        ) : (
          <Icon name="chevron-forward" size={24} color={dim ? c.textMuted : '#FFFFFF'} />
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  state: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 8 },
  stateText: { flex: 1, fontWeight: '600' },
  offBadge: { position: 'absolute', right: -6, top: -6, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  card: { overflow: 'visible', justifyContent: 'center', minHeight: 92, borderWidth: 1 },
  inner: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, gap: 14 },
  tile: { width: 56, height: 56, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  heart: { position: 'absolute', right: 6, bottom: 6, width: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  text: { flex: 1, gap: 2 },
  lock: { paddingHorizontal: 8, paddingVertical: 6 },
  count: { minWidth: 28, height: 28, borderRadius: 14, paddingHorizontal: 6, alignItems: 'center', justifyContent: 'center' },
  countText: { fontWeight: '800' },
});
