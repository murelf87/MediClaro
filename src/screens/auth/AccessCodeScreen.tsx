/**
 * /premium-login — «Ya soy Premium»: entrar con el código MediClaro (MC-XXXX-XXXX), sin SMS.
 *  - Lo usan las personas Premium y también los propietarios (su código se crea en Perfil → Cuenta).
 *  - «He olvidado mi código» → entrar con el teléfono (SMS, solo números que ya tienen MediClaro Premium);
 *    después, en Perfil → Cuenta, se crea un código nuevo.
 */
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import {
  AppHeader,
  AppText,
  Icon,
  InfoBanner,
  MediClaroLogo,
  PrimaryButton,
  Screen,
  TextButton,
  TextField,
} from '../../components';
import { useAppTheme } from '../../hooks';
import { AccessCodeService, formatAccessCodeInput, normalizeAccessCode, AppError } from '../../services';
import { AuthErrorBanner, asAppError } from './parts';

export default function AccessCodeScreen() {
  const router = useRouter();
  const theme = useAppTheme();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<AppError | null>(null);
  const valid = normalizeAccessCode(code) !== null;

  const enter = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await AccessCodeService.login(code);
      router.replace('/(tabs)');
    } catch (e) {
      setError(asAppError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen header={<AppHeader title="" onBack={() => router.back()} />} keyboard gradient="premium" testID="access-code-screen">
      <View style={[styles.center, { gap: theme.spacing.xs }]}>
        <MediClaroLogo variant="horizontal" size="md" />
        <View style={[styles.badge, { backgroundColor: theme.colors.primaryTint, marginTop: theme.spacing.md }]}>
          <Icon name="key" size={30} color="primary" />
        </View>
        <AppText variant="title" color="heading" align="center">Ya soy Premium</AppText>
        <AppText variant="body" color="textSecondary" align="center" style={styles.lead}>
          Escribe tu código MediClaro para entrar. No hace falta el teléfono ni esperar un SMS.
        </AppText>
      </View>

      <View style={{ marginTop: theme.spacing.lg, gap: theme.spacing.md }}>
        <TextField
          label="Tu código MediClaro"
          value={code}
          onChangeText={(t: string) => {
            setCode(formatAccessCodeInput(t));
            if (error) setError(null);
          }}
          placeholder="MC-4K7P-9X2Q"
          autoCapitalize="characters"
          autoCorrect={false}
          autoComplete="off"
          textContentType="oneTimeCode"
          returnKeyType="go"
          onSubmitEditing={() => valid && void enter()}
          hint="Lo encuentras en Perfil → Cuenta del móvil donde contrataste Premium."
          editable={!busy}
          testID="access-code-input"
        />
        {error ? <AuthErrorBanner error={error} title="No hemos podido entrar" /> : null}
        <PrimaryButton
          label="Entrar"
          icon="arrow-forward"
          iconPosition="right"
          onPress={() => void enter()}
          loading={busy}
          disabled={!valid || busy}
          testID="access-code-enter"
        />
      </View>

      <View style={{ marginTop: theme.spacing.xl, gap: theme.spacing.xs }}>
        <InfoBanner
          tone="info"
          title="¿Has olvidado tu código?"
          message="Entra con tu teléfono: te enviaremos un SMS. Si tu Premium está en vigor, entrarás y podrás crear un código nuevo en Perfil → Cuenta."
        />
        <TextButton
          label="He olvidado mi código"
          icon="call-outline"
          onPress={() => router.push('/login')}
          accessibilityHint="Entra con tu número de teléfono y un código por SMS"
          testID="access-code-forgot"
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center' },
  badge: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center' },
  lead: { maxWidth: 340 },
});
