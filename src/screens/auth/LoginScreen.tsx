/**
 * 3 · Acceso con TELÉFONO + CÓDIGO SMS (sin email ni contraseña).
 *
 * Incluye el acceso TEMPORAL "Entrar sin verificar" pedido por el propietario para
 * probar toda la app mientras el SMS no está activo. Solo aparece si
 * DemoMode.available() (se desactiva en las compilaciones de tienda).
 */
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import {
  Screen,
  AppHeader,
  AppText,
  MediClaroLogo,
  PhoneInput,
  PrimaryButton,
  SecondaryButton,
  TextButton,
} from '../../components';
import { useAppTheme } from '../../hooks';
import { AuthService, DemoMode, AppError } from '../../services';
import { DEFAULT_PHONE_COUNTRY, type PhoneCountry } from '../../config/countries';
import { PHONE_ERROR_MESSAGES, validateNationalPhone } from '../../utils/format';
import { AuthErrorBanner, LegalConsent, OrDivider, asAppError, useEnterApp } from './parts';

export default function LoginScreen() {
  const router = useRouter();
  const theme = useAppTheme();
  const demoAvailable = DemoMode.available();

  const [country, setCountry] = useState<PhoneCountry>(DEFAULT_PHONE_COUNTRY);
  const [digits, setDigits] = useState('');
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<AppError | null>(null);
  const [entering, setEntering] = useState(false);
  const [enterError, setEnterError] = useState<AppError | null>(null);

  const enterApp = useEnterApp(() => {
    setEntering(false);
    setEnterError(new AppError('unknown', 'No hemos podido abrir la sesión. Inténtalo de nuevo.'));
  });

  const clearErrors = () => {
    setPhoneError(null);
    setSendError(null);
  };

  const sendCode = async () => {
    if (sending || entering) return;
    const check = validateNationalPhone(digits, country);
    if (!check.ok) {
      setPhoneError(PHONE_ERROR_MESSAGES[check.reason]);
      return;
    }
    clearErrors();
    setSending(true);
    try {
      await AuthService.requestOtp(check.e164);
      router.push({ pathname: '/verify', params: { phone: check.e164 } });
    } catch (e) {
      setSendError(asAppError(e));
    } finally {
      setSending(false);
    }
  };

  const enterWithoutVerification = async () => {
    if (entering || sending) return;
    setEntering(true);
    setEnterError(null);
    try {
      await AuthService.enterWithoutVerification();
      // Seguimos mostrando "cargando" hasta que el Inicio aparece.
      enterApp();
    } catch (e) {
      setEnterError(asAppError(e));
      setEntering(false);
    }
  };

  return (
    <Screen
      keyboard
      gradient="soft"
      header={<AppHeader fallbackHref="/welcome" />}
      footer={
        <TextButton
          label="¿Es una urgencia? Pulsa aquí"
          tone="danger"
          onPress={() => router.push('/emergency')}
          accessibilityHint="Abre la pantalla de emergencia. No necesitas entrar en la app."
          testID="login-emergency"
        />
      }
    >
      <View style={[styles.brand, { marginTop: theme.spacing.xs }]}>
        <MediClaroLogo variant="horizontal" size="md" />
      </View>

      <AppText variant="title" align="center" accessibilityRole="header" style={{ marginTop: theme.spacing.xl }}>
        Entra con tu teléfono
      </AppText>
      <AppText variant="body" color="textSecondary" align="center" style={{ marginTop: theme.spacing.xs }}>
        Te enviaremos un código por SMS. No necesitas contraseña.
      </AppText>

      <AppText variant="label" color="heading" style={{ marginTop: theme.spacing.xl, marginBottom: theme.spacing.xs }}>
        Tu número de móvil
      </AppText>
      <PhoneInput
        country={country}
        onCountryChange={(c) => {
          setCountry(c);
          clearErrors();
        }}
        value={digits}
        onChange={(d) => {
          setDigits(d);
          if (phoneError || sendError) clearErrors();
        }}
        error={phoneError}
        onSubmit={sendCode}
        disabled={sending || entering}
      />

      {sendError ? (
        <AuthErrorBanner
          error={sendError}
          extra={
            sendError.kind === 'not_configured' && demoAvailable
              ? 'Mientras tanto, puedes usar «Entrar sin verificar» (más abajo).'
              : undefined
          }
        />
      ) : null}

      <PrimaryButton
        label="Enviar código"
        icon="arrow-forward"
        iconPosition="right"
        onPress={sendCode}
        loading={sending}
        disabled={digits.length === 0 || entering}
        accessibilityHint="Te enviamos un SMS con un código de 6 cifras"
        style={{ marginTop: theme.spacing.lg }}
        testID="login-send"
      />

      {demoAvailable ? (
        <View>
          <OrDivider />
          <SecondaryButton
            label="Entrar sin verificar"
            variant="outline"
            icon="flash"
            onPress={enterWithoutVerification}
            loading={entering}
            disabled={sending}
            accessibilityHint="Acceso temporal para probar la app sin recibir el SMS"
            testID="login-bypass"
          />
          <AppText variant="caption" color="textSecondary" align="center" style={{ marginTop: theme.spacing.xs }}>
            Temporal: para probar la app sin recibir el SMS. Si el servidor no está conectado verás datos de ejemplo.
          </AppText>
          {enterError ? <AuthErrorBanner error={enterError} title="No hemos podido entrar" /> : null}
        </View>
      ) : null}

      <LegalConsent
        onTerms={() => router.push({ pathname: '/legal', params: { section: 'terms' } })}
        onPrivacy={() => router.push({ pathname: '/legal', params: { section: 'privacy' } })}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  brand: { alignItems: 'center' },
});
