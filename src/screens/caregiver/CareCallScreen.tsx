/**
 * /caregiver-call?link=<vinculación>[&call=<llamada>&incoming=1] — Llamada de voz entre la persona Premium y su
 * cuidador/a, como en WhatsApp:
 *  - saliente: foto o iniciales grandes con un halo que late, «Llamando…» con el tono de llamada, y «Colgar»;
 *  - entrante: suena y vibra, «Te está llamando», y dos botones grandes: Rechazar (rojo) y Aceptar (verde);
 *  - en llamada: contador, «Silenciar» y «Colgar»;
 *  - al terminar: por qué terminó y su duración, «Volver a llamar» e «Ir al chat» (y queda registrada en el chat).
 *  - arriba a la izquierda, una cruz para cerrar en cualquier momento: cuelga (o rechaza) y vuelve al chat.
 * Pantalla encendida mientras dura la llamada. Pensada para personas mayores: botones de 76 px y textos grandes.
 * En móviles pequeños (o con la letra muy grande) la foto se hace más pequeña para que nada se monte encima.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { BackHandler, Platform, Pressable, StyleSheet, View, useWindowDimensions, type LayoutChangeEvent } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { useKeepAwake } from 'expo-keep-awake';
import { AppText, Avatar, Icon, type IconName } from '../../components';
import { PulseHalo } from '../../components/Graphics';
import { useAppTheme } from '../../hooks';
import { callClock, endTitle, useCareCall } from '../../hooks/useCareCall';
import { CareCallService } from '../../services/CareCallService';
import { CareChatService } from '../../services/CareChatService';
import { confirmAsync } from '../../utils/dialogs';

const GREEN = '#16A34A';
const CENTER_GAP = 12;
const GREEN_PRESSED = '#15803D';

function firstParam(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}
const firstName = (name: string) => name.trim().split(/\s+/)[0] || name;

/** La pantalla no se apaga durante la llamada (solo en el móvil). */
function NativeKeepAwake() {
  useKeepAwake('mediclaro-call');
  return null;
}

function RoundButton({
  icon,
  label,
  color,
  pressedColor,
  iconColor = '#FFFFFF',
  size = 76,
  rotate,
  onPress,
  testID,
  accessibilityLabel,
}: {
  icon: IconName;
  label: string;
  color: string;
  pressedColor?: string;
  iconColor?: string;
  size?: number;
  rotate?: boolean;
  onPress: () => void;
  testID?: string;
  accessibilityLabel?: string;
}) {
  return (
    <View style={styles.roundWrap}>
      {/* Mismo alto para todos: las etiquetas quedan alineadas aunque «Colgar» sea más grande. */}
      <View style={styles.slot}>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel ?? label}
        testID={testID}
        style={({ pressed }) => [
          styles.round,
          { width: size, height: size, borderRadius: size / 2, backgroundColor: pressed && pressedColor ? pressedColor : color, transform: [{ scale: pressed ? 0.95 : 1 }] },
        ]}
      >
        <View style={rotate ? styles.hangIcon : null}>
          <Icon name={icon} size={Math.round(size * 0.42)} color={iconColor} />
        </View>
      </Pressable>
      </View>
      <AppText variant="label" style={styles.roundLabel} align="center">{label}</AppText>
    </View>
  );
}

export default function CareCallScreen() {
  const theme = useAppTheme();
  const c = theme.colors;
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ link?: string | string[]; call?: string | string[]; incoming?: string | string[] }>();
  const rawLink = firstParam(params.link) ?? '';
  const linkId = /^[\w-]{1,64}$/.test(rawLink) ? rawLink : null;
  const rawCall = firstParam(params.call) ?? '';
  const callId = /^[\w-]{1,64}$/.test(rawCall) ? rawCall : null;
  const incoming = firstParam(params.incoming) === '1' && !!callId;
  const known = CareChatService.getSummary().find((x) => x.linkId === linkId);
  const callApi = useCareCall({ linkId, callId, incoming });
  const { phase, reason, message, muted, seconds, simulated } = callApi;
  const other = callApi.call?.otherName ?? known?.otherName ?? 'Tu familiar';
  const otherFirst = firstName(other);

  // Tamaño de la foto según el hueco que dejan los textos: 210 px en la mayoría de móviles y menos en los pequeños.
  const { height: winH, width: winW } = useWindowDimensions();
  const short = winH < 700;
  const narrow = winW < 360;
  const [centerH, setCenterH] = useState(0);
  const [textH, setTextH] = useState(0);
  const onCenterLayout = useCallback((e: LayoutChangeEvent) => setCenterH(Math.round(e.nativeEvent.layout.height)), []);
  const onTextLayout = useCallback((e: LayoutChangeEvent) => setTextH(Math.round(e.nativeEvent.layout.height)), []);
  const guess = winH < 640 ? 140 : short ? 172 : 210;
  const halo = centerH && textH ? Math.max(96, Math.min(210, Math.floor(centerH - textH - CENTER_GAP - 24))) : guess;
  const avatar = Math.round(halo * 0.63);

  useEffect(() => {
    CareCallService.setScreenOpen(true);
    return () => CareCallService.setScreenOpen(false);
  }, []);

  // Vuelve a la conversación: si ya estaba abierta debajo, se vuelve a ella (sin abrir otra igual).
  const toChat = useCallback(() => {
    const link = callApi.call?.linkId ?? linkId;
    if (link) router.dismissTo({ pathname: '/caregiver-chat', params: { link } });
    else router.dismissTo('/caregiver');
  }, [callApi.call?.linkId, linkId, router]);

  // Cruz «Cerrar»: rechaza una llamada entrante, cuelga una que suena o está en curso (preguntando si ya se habla) y
  // vuelve al chat.
  const closing = useRef(false);
  const close = useCallback(async () => {
    if (closing.current) return;
    if (phase === 'connected' || phase === 'connecting') {
      const ok = await confirmAsync({
        title: '¿Colgar y cerrar?',
        message: `Se terminará la llamada con ${otherFirst}.`,
        confirmText: 'Colgar',
        cancelText: 'Seguir hablando',
        destructive: true,
      });
      if (!ok) return;
    }
    closing.current = true;
    if (phase === 'incoming') callApi.decline();
    else if (phase !== 'ended') callApi.hangup();
    toChat();
  }, [phase, callApi, toChat, otherFirst]);

  // Botón «atrás» de Android: rechaza una llamada entrante y pregunta antes de colgar una en curso.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (phase === 'ended') return false;
      if (phase === 'incoming') {
        callApi.decline();
        return true;
      }
      void confirmAsync({ title: '¿Colgar la llamada?', confirmText: 'Colgar', cancelText: 'Seguir hablando', destructive: true }).then((ok) => {
        if (ok) callApi.hangup();
      });
      return true;
    });
    return () => sub.remove();
  }, [phase, callApi]);

  const ringing = phase === 'calling' || phase === 'incoming' || phase === 'starting';
  const status =
    phase === 'starting'
      ? 'Preparando la llamada…'
      : phase === 'calling'
        ? 'Llamando…'
        : phase === 'incoming'
          ? 'Te está llamando'
          : phase === 'connecting'
            ? 'Conectando…'
            : phase === 'connected'
              ? 'En llamada'
              : reason
                ? endTitle(reason, otherFirst)
                : 'Llamada finalizada';

  return (
    <View style={[styles.flex, { backgroundColor: c.callBackground }]} testID="care-call-screen">
      <StatusBar style="light" />
      {Platform.OS !== 'web' && phase !== 'ended' ? <NativeKeepAwake /> : null}
      <LinearGradient colors={['#123A8C', c.callBackground, '#0A1630']} locations={[0, 0.55, 1]} style={StyleSheet.absoluteFill} />
      <View style={[styles.flex, { paddingTop: insets.top + (short ? 8 : 16), paddingBottom: Math.max(insets.bottom, 16) + (short ? 0 : 8) }]}>
        <View style={styles.top}>
          <View style={styles.topRow}>
            <Pressable
              onPress={() => void close()}
              accessibilityRole="button"
              accessibilityLabel={phase === 'ended' ? 'Cerrar y volver al chat' : phase === 'incoming' ? 'Rechazar y cerrar' : 'Colgar y cerrar'}
              hitSlop={8}
              testID="care-call-close"
              style={({ pressed }) => [styles.closeBtn, { backgroundColor: pressed ? 'rgba(255,255,255,0.28)' : 'rgba(255,255,255,0.16)' }]}
            >
              <Icon name="close" size={26} color="#FFFFFF" />
            </Pressable>
            <View style={styles.secure} accessible accessibilityLabel="Llamada de voz por internet, cifrada">
              <Icon name="lock-closed" size={14} color={c.callTextMuted} />
              <AppText variant="small" style={{ color: c.callTextMuted, flexShrink: 1 }} numberOfLines={1}>
                {narrow ? 'Llamada cifrada' : 'Llamada de voz de MediClaro · cifrada'}
              </AppText>
            </View>
            <View style={styles.closeSpacer} />
          </View>
          {simulated ? (
            <View style={[styles.demo, { backgroundColor: 'rgba(245,158,11,0.18)', borderColor: 'rgba(245,158,11,0.6)' }]} testID="care-call-simulated">
              <Icon name="flask-outline" size={14} color="#FCD34D" />
              <AppText variant="small" style={{ color: '#FDE68A' }}>{narrow ? 'Prueba: aquí no hay sonido' : 'Llamada de prueba: aquí no hay sonido'}</AppText>
            </View>
          ) : null}
        </View>

        <View style={styles.center} onLayout={onCenterLayout}>
          {ringing ? (
            <PulseHalo size={halo} color="rgba(255,255,255,0.16)">
              <Avatar name={other} size={avatar} />
            </PulseHalo>
          ) : (
            <View style={[styles.avatarStill, { width: halo, height: halo }]}>
              <Avatar name={other} size={avatar} />
            </View>
          )}
          <View style={styles.texts} onLayout={onTextLayout}>
            <AppText variant="title" align="center" style={styles.name} numberOfLines={2} testID="care-call-name">{other}</AppText>
            <AppText
              variant={phase === 'ended' ? 'subheading' : 'body'}
              align="center"
              style={{ color: phase === 'ended' && reason !== 'hangup' && reason !== 'other_hangup' ? '#FECACA' : c.callTextMuted }}
              accessibilityLiveRegion="polite"
              testID="care-call-status"
            >
              {status}
            </AppText>
            {phase === 'connected' ? (
              <AppText variant="display" align="center" style={styles.clock} accessibilityLabel={`Duración ${callClock(seconds)}`} testID="care-call-clock">
                {callClock(seconds)}
              </AppText>
            ) : null}
            {phase === 'ended' && seconds > 0 ? (
              <AppText variant="body" align="center" style={{ color: c.callTextMuted }}>{`Duración: ${callClock(seconds)}`}</AppText>
            ) : null}
            {phase === 'incoming' ? (
              <AppText variant="caption" align="center" style={{ color: c.callTextMuted }}>Llamada de voz por internet</AppText>
            ) : null}
            {message ? (
              <AppText variant="caption" align="center" style={[styles.message, { color: c.callTextMuted }]} testID="care-call-message">{message}</AppText>
            ) : null}
          </View>
        </View>

        {phase === 'incoming' ? (
          <View style={[styles.bottom, short && styles.bottomShort]}>
            <View style={[styles.row, narrow && styles.rowNarrow]}>
              <RoundButton icon="call" rotate label="Rechazar" color={c.danger} pressedColor={c.dangerPressed} onPress={callApi.decline} testID="care-call-decline" accessibilityLabel={`Rechazar la llamada de ${other}`} />
              <RoundButton icon="call" label="Aceptar" color={GREEN} pressedColor={GREEN_PRESSED} onPress={() => void callApi.accept()} testID="care-call-accept" accessibilityLabel={`Aceptar la llamada de ${other}`} />
            </View>
            <Pressable
              onPress={() => {
                callApi.decline();
                toChat();
              }}
              accessibilityRole="button"
              accessibilityLabel={`Rechazar la llamada y escribir a ${otherFirst}`}
              style={styles.textBtn}
              hitSlop={8}
              testID="care-call-reply-chat"
            >
              <Icon name="chatbubble-ellipses-outline" size={18} color={c.callText} />
              <AppText variant="label" style={{ color: c.callText }}>{narrow ? 'No puedo: escribirle' : 'No puedo ahora: escribirle'}</AppText>
            </Pressable>
          </View>
        ) : phase === 'ended' ? (
          <View style={[styles.bottom, short && styles.bottomShort]}>
            <View style={[styles.row, narrow && styles.rowNarrow]}>
              <RoundButton icon="call" label="Volver a llamar" color={GREEN} pressedColor={GREEN_PRESSED} onPress={() => void callApi.start()} testID="care-call-again" />
              <RoundButton icon="chatbubble-ellipses" label="Ir al chat" color="rgba(255,255,255,0.16)" onPress={toChat} testID="care-call-chat" />
            </View>
          </View>
        ) : (
          <View style={[styles.bottom, short && styles.bottomShort]}>
            <View style={[styles.row, narrow && styles.rowNarrow]}>
              <RoundButton
                icon={muted ? 'mic-off' : 'mic'}
                label={muted ? 'Activar micro' : 'Silenciar'}
                color={muted ? '#FFFFFF' : 'rgba(255,255,255,0.16)'}
                iconColor={muted ? c.callBackground : '#FFFFFF'}
                size={64}
                onPress={callApi.toggleMute}
                testID="care-call-mute"
                accessibilityLabel={muted ? 'Activar el micrófono' : 'Silenciar el micrófono'}
              />
              <RoundButton icon="call" rotate label="Colgar" color={c.danger} pressedColor={c.dangerPressed} onPress={callApi.hangup} testID="care-call-hangup" />
            </View>
            {phase === 'connected' && !simulated ? (
              <AppText variant="small" align="center" style={{ color: c.callTextMuted }}>Mantén MediClaro abierta mientras habláis.</AppText>
            ) : null}
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  top: { alignItems: 'center', gap: 10, paddingHorizontal: 16 },
  topRow: { flexDirection: 'row', alignItems: 'center', alignSelf: 'stretch', gap: 8 },
  closeBtn: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  closeSpacer: { width: 48 },
  secure: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  demo: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 5 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: CENTER_GAP, paddingHorizontal: 24 },
  avatarStill: { alignItems: 'center', justifyContent: 'center' },
  texts: { alignItems: 'center', gap: 8, alignSelf: 'stretch' },
  name: { color: '#FFFFFF' },
  clock: { color: '#FFFFFF', fontVariant: ['tabular-nums'] },
  message: { maxWidth: 320 },
  bottom: { gap: 18, paddingHorizontal: 24, alignItems: 'center' },
  bottomShort: { gap: 8 },
  row: { flexDirection: 'row', justifyContent: 'center', alignItems: 'flex-start', gap: 64 },
  rowNarrow: { gap: 36 },
  roundWrap: { alignItems: 'center', gap: 8, minWidth: 96 },
  slot: { height: 76, alignItems: 'center', justifyContent: 'center' },
  round: { alignItems: 'center', justifyContent: 'center' },
  roundLabel: { color: '#FFFFFF' },
  hangIcon: { transform: [{ rotate: '135deg' }] },
  textBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 44, paddingHorizontal: 12 },
});
