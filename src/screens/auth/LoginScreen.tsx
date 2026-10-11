/**
 * 3 · Acceso con TELÉFONO + CÓDIGO SMS (sin email ni contraseña).
 *
 * Sin accesos de prueba: el botón «Entrar sin verificar» se quitó por decisión del propietario (11/10/2026).
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
  TextButton,
} from '../../components';
import { useAppTheme } from '../../hooks';
import { AuthService, AppError } from '../../services';
import { DEFAULT_PHONE_COUNTRY, type PhoneCountry } from '../../config/countries';
import { PHONE_ERROR_MESSAGES, validateNationalPhone } from '../../utils/format';
import { AuthErrorBanner, LegalConsent, asAppError } from './parts';

export default function LoginScreen() {
  const router = useRouter();
  const theme = useAppTheme();

  const [country, setCountry] = useState<PhoneCountry>(DEFAULT_PHONE_COUNTRY);
  const [digits, setDigits] = useState('');
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<AppError | null>(null);

  const clearErrors = () => {
    setPhoneError(null);
    setSendError(null);
  };

  const sendCode = async () => {
    if (sending) return;
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
        disabled={sending}
      />

      {sendError ? (
        <AuthErrorBanner
          error={sendError}
        />
      ) : null}

      <PrimaryButton
        label="Enviar código"
        icon="arrow-forward"
        iconPosition="right"
        onPress={sendCode}
        loading={sending}
        disabled={digits.length === 0}
        accessibilityHint="Te enviamos un SMS con un código de 6 cifras"
        style={{ marginTop: theme.spacing.lg }}
        testID="login-send"
      />


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
