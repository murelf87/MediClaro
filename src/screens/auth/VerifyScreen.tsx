/**
 * 3b · Verificación del código SMS (/verify?phone=+34600123456).
 * - Primero, animación «¡Mensaje enviado!» (se puede saltar; sin animación con «Reducir movimiento»).
 * - Después, la consola: cómo se verá el SMS, 6 casillas y teclado numérico grande en pantalla
 *   (o el teclado del teléfono, que rellena el código solo desde el SMS).
 * - Envío automático al completar las 6 cifras (sin envíos duplicados) y botón "Verificar".
 * - Código incorrecto: las casillas tiemblan en rojo y se vacían. Caducidad (OTP_CONFIG.ttlSeconds) y
 *   reenvío (OTP_CONFIG.resendSeconds).
 * - `purpose=link`: confirma el teléfono añadido DESPUÉS del pago («Completa tu cuenta»).
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  Screen,
  AppHeader,
  AppText,
  Icon,
  InfoBanner,
  PrimaryButton,
  TextButton,
  LoadingState,
} from '../../components';
import { useReduceMotion } from '../../components/Motion';
import { useAppTheme, useCountdown } from '../../hooks';
import { AuthService, DemoMode, AppError } from '../../services';
import { OTP_CONFIG } from '../../config/app';
import { formatDuration, formatPhoneForDisplay } from '../../utils/format';
import { showAlert } from '../../utils/dialogs';
import { AuthErrorBanner, asAppError, normalizePhoneParam, useEnterApp } from './parts';
import { CodeConsole, SmsPreview, SmsSentAnimation, type CodeConsoleHandle } from './CodeConsole';

const WRONG_CODE = 'El código no es correcto. Revísalo e inténtalo de nuevo.';

export default function VerifyScreen() {
  const router = useRouter();
  const theme = useAppTheme();
  const params = useLocalSearchParams<{ phone?: string | string[]; purpose?: string | string[] }>();
  const phone = normalizePhoneParam(params.phone);
  const linking = (Array.isArray(params.purpose) ? params.purpose[0] : params.purpose) === 'link';
  const fallback = linking ? '/complete-account' : '/login';

  const reduceMotion = useReduceMotion();
  const [phase, setPhase] = useState<'sent' | 'code'>(reduceMotion ? 'code' : 'sent');
  const consoleRef = useRef<CodeConsoleHandle>(null);
  const [code, setCode] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [codeError, setCodeError] = useState<string | null>(null);
  const [error, setError] = useState<AppError | null>(null);
  const [resent, setResent] = useState(false);
  const [resending, setResending] = useState(false);
  const [entering, setEntering] = useState(false);

  const expiry = useCountdown(OTP_CONFIG.ttlSeconds);
  const resend = useCountdown(OTP_CONFIG.resendSeconds);
  const expired = !expiry.running && expiry.remaining === 0;

  const busy = useRef(false);
  const lastSubmitted = useRef<string | null>(null);

  const enterApp = useEnterApp(() => {
    busy.current = false;
    setVerifying(false);
    setEntering(false);
    setError(new AppError('unknown', 'No hemos podido abrir la sesión. Inténtalo de nuevo.'));
  });

  // Sin teléfono no hay nada que verificar
  useEffect(() => {
    if (!phone) router.replace(fallback);
  }, [phone, router, fallback]);

  const verify = useCallback(
    async (value: string) => {
      if (!phone || busy.current || expired || value.length !== OTP_CONFIG.length) return;
      busy.current = true;
      lastSubmitted.current = value;
      setVerifying(true);
      setCodeError(null);
      setError(null);
      setResent(false);
      try {
        if (linking) {
          await AuthService.verifyPhoneLink(phone, value);
          busy.current = false;
          setVerifying(false);
          await showAlert('Teléfono guardado', 'Tu cuenta ya está protegida con tu número. Si cambias de móvil, entra con él.');
          router.replace('/(tabs)');
          return;
        }
        await AuthService.verifyOtp(phone, value);
        // Mantenemos "cargando" hasta que aparece el Inicio.
        enterApp();
      } catch (e) {
        const err = asAppError(e);
        busy.current = false;
        setVerifying(false);
        if (err.code === 'otp_invalid') {
          consoleRef.current?.shake();
          setCodeError(WRONG_CODE);
          // Se vacía tras el temblor para escribirlo otra vez.
          setTimeout(() => {
            setCode('');
            lastSubmitted.current = null;
          }, 450);
        } else {
          setError(err);
        }
      }
    },
    [phone, expired, enterApp, linking, router],
  );

  // Envío automático al completar el código (una sola vez por código)
  useEffect(() => {
    if (code.length === OTP_CONFIG.length && code !== lastSubmitted.current) void verify(code);
  }, [code, verify]);

  const requestNewCode = async () => {
    if (!phone || resending) return;
    setResending(true);
    setError(null);
    setCodeError(null);
    setResent(false);
    try {
      if (linking) await AuthService.requestPhoneLink(phone);
      else await AuthService.requestOtp(phone);
      expiry.start();
      resend.start();
      setCode('');
      lastSubmitted.current = null;
      setResent(true);
    } catch (e) {
      setError(asAppError(e));
    } finally {
      setResending(false);
    }
  };

  const enterWithoutVerification = async () => {
    if (entering || verifying) return;
    setEntering(true);
    setError(null);
    try {
      await AuthService.enterWithoutVerification();
      enterApp();
    } catch (e) {
      setError(asAppError(e));
      setEntering(false);
    }
  };

  const onCodeChange = (v: string) => {
    if (busy.current) return;
    setCode(v);
    if (codeError) setCodeError(null);
  };

  const changeNumber = () => {
    if (router.canGoBack()) router.back();
    else router.replace(fallback);
  };

  if (!phone) {
    return (
      <Screen header={<AppHeader fallbackHref={fallback} />}>
        <LoadingState message="Volviendo…" />
      </Screen>
    );
  }

  const footer = expired ? (
    <PrimaryButton
      label="Pedir un código nuevo"
      icon="refresh"
      onPress={requestNewCode}
      loading={resending}
      testID="verify-new-code"
    />
  ) : (
    <PrimaryButton
      label="Verificar"
      onPress={() => void verify(code)}
      loading={verifying}
      disabled={code.length !== OTP_CONFIG.length || entering}
      accessibilityLabel="Verificar el código"
      accessibilityHint="Comprueba el código que te hemos enviado"
      testID="verify-submit"
    />
  );

  if (phase === 'sent') {
    return (
      <Screen
        gradient="soft"
        header={<AppHeader fallbackHref={fallback} />}
        footer={
          <PrimaryButton
            label="Escribir el código"
            icon="keypad"
            onPress={() => setPhase('code')}
            testID="verify-to-code"
          />
        }
      >
        <SmsSentAnimation phone={phone} onDone={() => setPhase('code')} />
      </Screen>
    );
  }

  return (
    <Screen gradient="soft" header={<AppHeader fallbackHref={fallback} />} footer={footer}>
      <AppText variant="title" align="center" accessibilityRole="header" style={{ marginTop: theme.spacing.xs }}>
        Escribe el código
      </AppText>
      <AppText variant="body" color="textSecondary" align="center" style={{ marginTop: theme.spacing.xxs }}>
        Lo hemos enviado por SMS al{' '}
        <AppText variant="bodyStrong" color="heading">
          {/* Espacios no separables: el número nunca se parte entre dos líneas */}
          {formatPhoneForDisplay(phone).replace(/ /g, '\u00A0')}
        </AppText>
      </AppText>
      <TextButton label="Cambiar número" onPress={changeNumber} icon="create-outline" testID="verify-change-number" />

      <View style={{ marginTop: theme.spacing.xs }}>
        <SmsPreview />
      </View>

      <View style={{ marginTop: theme.spacing.lg }}>
        <CodeConsole ref={consoleRef} value={code} onChange={onCodeChange} length={OTP_CONFIG.length} error={!!codeError} disabled={expired || verifying} />
      </View>

      {codeError ? (
        <View style={[styles.inlineError, { marginTop: theme.spacing.xs }]} accessibilityRole="alert" accessibilityLiveRegion="polite">
          <Icon name="alert-circle" size={20} color="danger" />
          <AppText variant="captionStrong" color="dangerText" style={styles.flexText}>
            {codeError}
          </AppText>
        </View>
      ) : null}

      {expired ? (
        <InfoBanner
          tone="warning"
          title="El código ha caducado"
          message="Por seguridad, cada código dura unos minutos. Pide uno nuevo para continuar."
          style={{ marginTop: theme.spacing.md }}
        />
      ) : (
        <AppText variant="caption" color="textSecondary" align="center" style={{ marginTop: theme.spacing.sm }}>
          {`El código caduca en ${formatDuration(expiry.remaining)}`}
        </AppText>
      )}

      {error ? <AuthErrorBanner error={error} title={error.kind === 'offline' ? undefined : 'No hemos podido comprobarlo'} /> : null}
      {resent && !error ? (
        <InfoBanner
          tone="success"
          title="Te hemos enviado un código nuevo"
          message={`Llegará por SMS al ${formatPhoneForDisplay(phone)}.`}
          style={{ marginTop: theme.spacing.md }}
        />
      ) : null}

      {!expired ? (
        <View style={[styles.center, { marginTop: theme.spacing.xs }]}>
          {resend.remaining > 0 ? (
            <AppText variant="caption" color="textMuted" align="center" style={{ minHeight: theme.touchTargets.min, textAlignVertical: 'center' }}>
              {`Podrás pedir otro código en ${formatDuration(resend.remaining)}`}
            </AppText>
          ) : (
            <TextButton
              label={resending ? 'Enviando…' : 'Reenviar código'}
              icon="refresh"
              onPress={requestNewCode}
              disabled={resending}
              testID="verify-resend"
            />
          )}
        </View>
      ) : null}

      {DemoMode.available() && !linking ? (
        <TextButton
          label={entering ? 'Entrando…' : '¿No te llega el SMS? Entrar sin verificar'}
          tone="muted"
          onPress={enterWithoutVerification}
          disabled={entering || verifying}
          accessibilityHint="Acceso temporal para probar la app sin el código"
          style={{ marginTop: theme.spacing.xs }}
          testID="verify-bypass"
        />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  inlineError: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  flexText: { flexShrink: 1 },
  center: { alignItems: 'center' },
});
