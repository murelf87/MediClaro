/**
 * /complete-account — «Completa tu cuenta» (tablero: pantalla 9). SOLO después del pago.
 *
 * Añade el teléfono a la cuenta creada al pagar: te enviamos un SMS y, al confirmar el código
 * (/verify?purpose=link), la cuenta queda vinculada a tu número (así no pierdes Premium si cambias de móvil).
 * «Ahora no» → al Inicio (se puede completar más tarde desde Perfil).
 */
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import { AppText, InfoBanner, PhoneInput, PrimaryButton, Screen, TextButton } from '../../components';
import { FadeIn } from '../../components/Motion';
import { GuideAvatar } from '../../components/Guide';
import { SUPPORT_EMAIL } from '../../config/app';
import { DEFAULT_PHONE_COUNTRY, type PhoneCountry } from '../../config/countries';
import { useAppTheme, useEntitlement, useSession } from '../../hooks';
import { AppError, AuthService, isAppError } from '../../services';
import { PHONE_ERROR_MESSAGES, validateNationalPhone } from '../../utils/format';
import { BrandHeader, PremiumPill, SecureNote } from './parts';

export default function CompleteAccountScreen() {
  const router = useRouter();
  const theme = useAppTheme();
  const { status, session } = useSession();
  const entitlement = useEntitlement();
  const [country, setCountry] = useState<PhoneCountry>(DEFAULT_PHONE_COUNTRY);
  const [digits, setDigits] = useState('');
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [error, setError] = useState<AppError | null>(null);
  const [sending, setSending] = useState(false);

  // Sin sesión no hay cuenta que completar; con teléfono ya está completa.
  if (status === 'signedOut') return <Redirect href="/welcome" />;
  if (session?.phone) return <Redirect href="/(tabs)" />;
  if (status === 'loading' || entitlement.status !== 'ready') return <Screen header={<BrandHeader />}><AppText>Comprobando tu suscripción…</AppText></Screen>;
  if (!entitlement.isPremium) return <Redirect href="/premium" />;

  const send = async () => {
    if (sending) return;
    const check = validateNationalPhone(digits, country);
    if (!check.ok) {
      setPhoneError(PHONE_ERROR_MESSAGES[check.reason]);
      return;
    }
    setPhoneError(null);
    setError(null);
    setSending(true);
    try {
      await AuthService.requestPhoneLink(check.e164);
      router.push({ pathname: '/verify', params: { phone: check.e164, purpose: 'link' } });
    } catch (e) {
      setError(isAppError(e) ? e : new AppError('unknown'));
    } finally {
      setSending(false);
    }
  };

  const exists = error?.code === 'phone_exists';

  return (
    <Screen
      keyboard
      gradient="soft"
      header={<BrandHeader fallbackHref="/(tabs)" />}
      footer={
        <>
          <PrimaryButton
            label="Continuar"
            icon="arrow-forward"
            iconPosition="right"
            onPress={send}
            loading={sending}
            disabled={!digits}
            testID="complete-continue"
          />
          <TextButton label="Ahora no" onPress={() => router.replace('/(tabs)')} testID="complete-later" />
        </>
      }
      testID="complete-account"
    >
      <View style={[styles.head, { gap: theme.spacing.xs }]}>
        <FadeIn from="scale">
          <GuideAvatar size={76} />
        </FadeIn>
        <PremiumPill style={{ marginTop: theme.spacing.xs }} />
        <AppText variant="title" align="center" accessibilityRole="header">
          Completa tu cuenta
        </AppText>
        <AppText variant="body" color="textSecondary" align="center">
          Añade tu número de teléfono para proteger tu cuenta y configurar tus datos personales.
        </AppText>
      </View>

      <AppText variant="label" color="heading" style={{ marginTop: theme.spacing.xl, marginBottom: theme.spacing.xs }}>
        Número de teléfono
      </AppText>
      <PhoneInput
        country={country}
        onCountryChange={(c) => {
          setCountry(c);
          setPhoneError(null);
        }}
        value={digits}
        onChange={(d) => {
          setDigits(d);
          if (phoneError) setPhoneError(null);
          if (error) setError(null);
        }}
        error={phoneError}
        onSubmit={send}
        disabled={sending}
      />
      <View style={{ marginTop: theme.spacing.sm }}>
        <SecureNote center={false} text="Te enviaremos un SMS de verificación. Solo se utilizará para tu cuenta." />
      </View>

      {error ? (
        <InfoBanner
          tone={exists ? 'warning' : error.kind === 'offline' ? 'neutral' : 'danger'}
          title={exists ? 'Este número ya tiene una cuenta' : 'No hemos podido enviar el SMS'}
          message={
            exists
              ? `Usa otro número o escríbenos${SUPPORT_EMAIL ? ` a ${SUPPORT_EMAIL}` : ''} para unir las dos cuentas. Tu Premium sigue activo en este teléfono.`
              : error.message
          }
          style={{ marginTop: theme.spacing.md }}
        />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: { alignItems: 'center', marginTop: 8 },
});
