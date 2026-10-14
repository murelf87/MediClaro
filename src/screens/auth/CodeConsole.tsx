/**
 * Verificación por SMS — piezas de la pantalla /verify:
 *  - SmsSentAnimation: animación previa al escribir el código («¡Mensaje enviado!»).
 *  - SmsPreview: cómo se verá el SMS en el teléfono (con el código tapado), para reconocerlo.
 *  - CodeConsole: las 6 casillas (rebotan al escribir y tiemblan en rojo si el código no es correcto) y un
 *    teclado numérico GRANDE en pantalla, pensado para personas mayores. «Usar el teclado del teléfono»
 *    abre el teclado del sistema, que permite rellenar el código solo desde el SMS (iPhone y Android).
 * Todo respeta «Reducir movimiento» y funciona con lector de pantalla.
 */
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { Animated, Easing, Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { AppText, Icon, MediClaroMark, TextButton } from '../../components';
import { useReduceMotion } from '../../components/Motion';
import { SMS_TEMPLATE_EXAMPLE } from '../../config/app';
import { useAppTheme } from '../../hooks';
import { formatPhoneForDisplay, onlyDigits } from '../../utils/format';

const NATIVE = Platform.OS !== 'web';

// ─── Animación «¡Mensaje enviado!» ───────────────────────────────────────────

export function SmsSentAnimation({ phone, onDone }: { phone: string; onDone: () => void }) {
  const theme = useAppTheme();
  const c = theme.colors;
  const reduce = useReduceMotion();
  const fly = useRef(new Animated.Value(0)).current;
  const done = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0)).current;
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  useEffect(() => {
    if (reduce) {
      done.setValue(1);
      const t = setTimeout(() => onDoneRef.current(), 900);
      return () => clearTimeout(t);
    }
    const ring = Animated.loop(
      Animated.timing(pulse, { toValue: 1, duration: 1200, easing: Easing.out(Easing.quad), useNativeDriver: NATIVE }),
    );
    ring.start();
    const seq = Animated.sequence([
      Animated.delay(350),
      Animated.timing(fly, { toValue: 1, duration: 1400, easing: Easing.out(Easing.cubic), useNativeDriver: NATIVE }),
      Animated.spring(done, { toValue: 1, friction: 5, tension: 110, useNativeDriver: NATIVE }),
      Animated.delay(1000),
    ]);
    seq.start(({ finished }) => {
      if (finished) onDoneRef.current();
    });
    return () => {
      ring.stop();
      seq.stop();
    };
  }, [reduce, fly, done, pulse]);

  const bubbleStyle = {
    opacity: fly.interpolate({ inputRange: [0, 0.08, 0.85, 1], outputRange: [0, 1, 1, 0] }),
    transform: [
      { translateX: fly.interpolate({ inputRange: [0, 1], outputRange: [-30, 40] }) },
      { translateY: fly.interpolate({ inputRange: [0, 1], outputRange: [30, -40] }) },
      { scale: fly.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0.6, 1.05, 0.85] }) },
      { rotate: fly.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '-14deg'] }) },
    ],
  };
  const phoneStyle = { opacity: done.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }) };
  const checkStyle = { opacity: done, transform: [{ scale: done.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] }) }] };
  const ringStyle = {
    opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0] }),
    transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.55] }) }],
  };

  return (
    <View style={styles.sentWrap} accessibilityLiveRegion="polite" testID="sms-sent-animation">
      <View style={styles.stage}>
        <Animated.View style={[styles.ring, { backgroundColor: c.primarySoft }, ringStyle]} />
        <View style={[styles.circle, { backgroundColor: c.primaryTint }]}>
          <Animated.View style={[StyleSheet.absoluteFill, styles.center, phoneStyle]}>
            <Icon name="phone-portrait-outline" size={64} color={c.primary} />
          </Animated.View>
          <Animated.View style={[StyleSheet.absoluteFill, styles.center, styles.checkCircle, { backgroundColor: c.successStrong }, checkStyle]}>
            <Icon name="checkmark" size={64} color="#FFFFFF" />
          </Animated.View>
        </View>
        <Animated.View style={[styles.bubble, { backgroundColor: c.primary }, bubbleStyle]}>
          <Icon name="chatbubble-ellipses" size={22} color="#FFFFFF" />
          <AppText variant="captionStrong" style={styles.bubbleText} maxFontSizeMultiplier={1}>
            123···
          </AppText>
        </Animated.View>
      </View>
      <AppText variant="title" align="center" accessibilityRole="header" style={{ marginTop: theme.spacing.xl }}>
        ¡Mensaje enviado!
      </AppText>
      <AppText variant="body" color="textSecondary" align="center" style={styles.sentText}>
        {'Te hemos enviado un SMS con un código de 6 cifras al '}
        <AppText variant="bodyStrong" color="heading">
          {formatPhoneForDisplay(phone).replace(/ /g, ' ')}
        </AppText>
        .
      </AppText>
    </View>
  );
}

// ─── Vista previa del SMS ────────────────────────────────────────────────────

export function SmsPreview() {
  const theme = useAppTheme();
  const c = theme.colors;
  const reduce = useReduceMotion();
  const slide = useRef(new Animated.Value(reduce ? 1 : 0)).current;
  useEffect(() => {
    if (reduce) return;
    Animated.spring(slide, { toValue: 1, friction: 7, tension: 70, delay: 150, useNativeDriver: NATIVE }).start();
  }, [reduce, slide]);
  return (
    <Animated.View
      style={{
        opacity: slide,
        transform: [{ translateY: slide.interpolate({ inputRange: [0, 1], outputRange: [-24, 0] }) }],
      }}
    >
      <View
        style={[styles.preview, { backgroundColor: c.surface, borderColor: c.border, borderRadius: theme.radius.lg }, theme.shadow.soft]}
        accessible
        accessibilityLabel={`Así verás el mensaje: ${SMS_TEMPLATE_EXAMPLE.replace(/•+/, 'el código de 6 cifras')}`}
        testID="sms-preview"
      >
        <View style={styles.previewHead}>
          <View style={[styles.previewIcon, { borderColor: c.border }]}>
            <MediClaroMark size={20} accessibilityLabel="" />
          </View>
          <AppText variant="captionStrong" color="heading" style={styles.flex}>
            Mensajes · MediClaro
          </AppText>
          <AppText variant="small" color="textMuted">
            ahora
          </AppText>
        </View>
        <AppText variant="body" color="text" style={{ marginTop: 4 }}>
          {SMS_TEMPLATE_EXAMPLE}
        </AppText>
      </View>
      <AppText variant="small" color="textSecondary" align="center" style={{ marginTop: 6 }}>
        Así verás el mensaje en tu teléfono
      </AppText>
    </Animated.View>
  );
}

// ─── Consola del código ──────────────────────────────────────────────────────

export interface CodeConsoleHandle {
  /** Hace temblar las casillas (código incorrecto). */
  shake: () => void;
}

function CodeBox({ digit, active, error }: { digit: string | undefined; active: boolean; error: boolean }) {
  const theme = useAppTheme();
  const c = theme.colors;
  const reduce = useReduceMotion();
  const pop = useRef(new Animated.Value(1)).current;
  const caret = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!digit || reduce) return;
    pop.setValue(1.14);
    Animated.spring(pop, { toValue: 1, friction: 4, tension: 180, useNativeDriver: NATIVE }).start();
  }, [digit, reduce, pop]);

  useEffect(() => {
    if (!active || reduce) {
      caret.setValue(1);
      return undefined;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(caret, { toValue: 0, duration: 500, useNativeDriver: NATIVE }),
        Animated.timing(caret, { toValue: 1, duration: 500, useNativeDriver: NATIVE }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [active, reduce, caret]);

  const size = theme.fontSize === 'muy_grande' ? 50 : 46;
  return (
    <Animated.View
      style={[
        styles.box,
        {
          width: size,
          height: size + 16,
          borderRadius: theme.radius.sm,
          borderColor: error ? c.danger : active ? c.primary : digit ? c.primarySoft : c.borderStrong,
          borderWidth: active || error ? 2.5 : 1.5,
          backgroundColor: error ? c.dangerTint : digit ? c.primaryTint : c.surface,
          transform: [{ scale: pop }],
        },
      ]}
    >
      {digit ? (
        <AppText variant="title" style={{ color: c.heading }} allowFontScaling={false}>
          {digit}
        </AppText>
      ) : active ? (
        <Animated.View style={[styles.caret, { backgroundColor: c.primary, opacity: caret }]} />
      ) : null}
    </Animated.View>
  );
}

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del'] as const;

function Key({ k, onPress, disabled }: { k: (typeof KEYS)[number]; onPress: () => void; disabled?: boolean }) {
  const theme = useAppTheme();
  const c = theme.colors;
  if (!k) return <View style={styles.keySlot} />;
  const del = k === 'del';
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={del ? 'Borrar la última cifra' : k}
      testID={`key-${k}`}
      style={({ pressed }) => [
        styles.keySlot,
        styles.key,
        {
          minHeight: theme.easyMode ? 72 : 60,
          borderRadius: theme.radius.md,
          backgroundColor: pressed ? c.primarySoft : del ? 'transparent' : c.surface,
          borderColor: del ? 'transparent' : c.border,
          transform: [{ scale: pressed ? 0.96 : 1 }],
          opacity: disabled ? 0.45 : 1,
        },
        !del ? theme.shadow.card : null,
      ]}
    >
      {del ? (
        <Icon name="backspace-outline" size={30} color={c.heading} />
      ) : (
        <AppText variant="title" color="heading" allowFontScaling={false} style={styles.keyText}>
          {k}
        </AppText>
      )}
    </Pressable>
  );
}

export const CodeConsole = forwardRef<
  CodeConsoleHandle,
  { value: string; onChange: (v: string) => void; length?: number; error?: boolean; disabled?: boolean }
>(function CodeConsole({ value, onChange, length = 6, error = false, disabled = false }, ref) {
  const theme = useAppTheme();
  const reduce = useReduceMotion();
  const shakeX = useRef(new Animated.Value(0)).current;
  const inputRef = useRef<TextInput>(null);
  const [systemKeyboard, setSystemKeyboard] = useState(false);
  const valueRef = useRef(value);
  valueRef.current = value;

  useImperativeHandle(ref, () => ({
    shake: () => {
      if (reduce) return;
      shakeX.setValue(0);
      Animated.sequence(
        [12, -12, 9, -9, 5, -5, 0].map((x) => Animated.timing(shakeX, { toValue: x, duration: 55, useNativeDriver: NATIVE })),
      ).start();
    },
  }));

  // Se calcula sobre el último valor escrito (no sobre el de la última pintura): pulsaciones rápidas no se pierden.
  const press = (k: string) => {
    if (disabled) return;
    const current = valueRef.current;
    const next = k === 'del' ? current.slice(0, -1) : current.length < length ? current + k : current;
    if (next === current) return;
    valueRef.current = next;
    onChange(next);
  };

  // Web (solo QA / escritorio): el teclado físico también escribe en la consola.
  useEffect(() => {
    if (Platform.OS !== 'web' || systemKeyboard || disabled) return undefined;
    const doc = (globalThis as { document?: Document }).document;
    if (!doc) return undefined;
    const handler = (e: KeyboardEvent) => {
      if (/^[0-9]$/.test(e.key)) press(e.key);
      else if (e.key === 'Backspace') press('del');
    };
    doc.addEventListener('keydown', handler);
    return () => doc.removeEventListener('keydown', handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [systemKeyboard, disabled]);

  const digits = value.split('');
  const toggleKeyboard = () => {
    if (systemKeyboard) {
      inputRef.current?.blur();
      setSystemKeyboard(false);
    } else {
      setSystemKeyboard(true);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  };

  return (
    <View style={{ gap: theme.spacing.md }}>
      <Animated.View
        style={[styles.boxes, { transform: [{ translateX: shakeX }] }]}
        accessible
        accessibilityRole="text"
        accessibilityLabel={`Código: ${value.length} de ${length} cifras escritas`}
        accessibilityLiveRegion="polite"
        testID="code-boxes"
      >
        {Array.from({ length }).map((_, i) => (
          <CodeBox
            key={i}
            digit={digits[i]}
            error={error}
            active={!disabled && (i === value.length || (i === length - 1 && value.length === length))}
          />
        ))}
      </Animated.View>

      {/* Campo del sistema: autocompletar el código desde el SMS (iPhone y Android) o pegarlo. */}
      <TextInput
        ref={inputRef}
        value={value}
        onChangeText={(t) => onChange(onlyDigits(t).slice(0, length))}
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        autoComplete={Platform.OS === 'android' ? 'sms-otp' : 'one-time-code'}
        maxLength={length}
        editable={!disabled}
        onFocus={() => setSystemKeyboard(true)}
        onBlur={() => setSystemKeyboard(false)}
        accessibilityLabel={`Código de ${length} cifras`}
        accessibilityHint="Escribe el código con el teclado del teléfono, o usa el teclado grande de la pantalla"
        caretHidden
        style={styles.hidden}
        testID="code-input"
      />

      {!systemKeyboard ? (
        <View style={[styles.keypad, { gap: theme.spacing.xs }]} accessibilityLabel="Teclado numérico">
          {[0, 1, 2, 3].map((row) => (
            <View key={row} style={[styles.keyRow, { gap: theme.spacing.xs }]}>
              {KEYS.slice(row * 3, row * 3 + 3).map((k, i) => (
                <Key key={`${row}-${i}`} k={k} onPress={() => press(k)} disabled={disabled} />
              ))}
            </View>
          ))}
        </View>
      ) : null}

      <TextButton
        label={systemKeyboard ? 'Usar el teclado grande' : 'Usar el teclado del teléfono'}
        icon={systemKeyboard ? 'keypad-outline' : 'phone-portrait-outline'}
        tone="muted"
        onPress={toggleKeyboard}
        accessibilityHint={systemKeyboard ? undefined : 'Abre el teclado del teléfono, que puede rellenar el código solo desde el SMS'}
        testID="code-keyboard-toggle"
      />
    </View>
  );
});

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { alignItems: 'center', justifyContent: 'center' },
  sentWrap: { alignItems: 'center', paddingTop: 24 },
  stage: { width: 220, height: 200, alignItems: 'center', justifyContent: 'center' },
  ring: { position: 'absolute', width: 150, height: 150, borderRadius: 75 },
  circle: { width: 150, height: 150, borderRadius: 75, overflow: 'hidden' },
  checkCircle: { borderRadius: 75 },
  bubble: {
    position: 'absolute',
    top: 40,
    left: 110,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
    borderBottomLeftRadius: 4,
  },
  bubbleText: { color: '#FFFFFF', letterSpacing: 1 },
  sentText: { marginTop: 8, maxWidth: 340 },
  preview: { padding: 12, borderWidth: 1 },
  previewHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  previewIcon: { width: 28, height: 28, borderRadius: 7, borderWidth: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF' },
  boxes: { flexDirection: 'row', justifyContent: 'center', gap: 8 },
  box: { alignItems: 'center', justifyContent: 'center' },
  caret: { width: 3, height: 28, borderRadius: 2 },
  hidden: { position: 'absolute', width: 1, height: 1, opacity: 0 },
  keypad: { alignSelf: 'center', width: '100%', maxWidth: 360 },
  keyRow: { flexDirection: 'row' },
  keySlot: { flex: 1 },
  key: { alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  keyText: { fontSize: 30, lineHeight: 36 },
});
