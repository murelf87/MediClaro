/**
 * /my-access-code — «Tu código MediClaro» justo después de registrarse con Premium (teléfono confirmado), o después
 * de entrar con el teléfono desde «He olvidado mi código». Se crea solo al abrir la pantalla y se pide guardarlo:
 * con él se entra en un móvil nuevo desde «Ya soy Premium», sin SMS. Un código nuevo anula el anterior.
 */
import { useEffect, useRef, useState } from 'react';
import { Platform, Share, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { AppText, Icon, InfoBanner, LoadingState, MediClaroLogo, PrimaryButton, Screen, SecondaryButton } from '../../components';
import { useAppTheme } from '../../hooks';
import { AccessCodeService } from '../../services';
import { errorMessage } from '../premium/parts';

export default function MyAccessCodeScreen() {
  const router = useRouter();
  const theme = useAppTheme();
  const c = theme.colors;
  const [code, setCode] = useState<string | null>(null);
  const [error, setError] = useState('');
  const started = useRef(false);

  const create = () => {
    setError('');
    AccessCodeService.issue().then(setCode).catch((e) => setError(errorMessage(e)));
  };
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    create();
  }, []);

  const share = async () => {
    if (!code) return;
    try {
      await Share.share({ message: `Mi código MediClaro (para entrar con «Ya soy Premium» si cambio de móvil): ${code}` });
    } catch {
      // Cancelado: el código sigue en pantalla para apuntarlo.
    }
  };

  return (
    <Screen gradient="premium" testID="my-access-code-screen">
      <View style={[styles.center, { gap: theme.spacing.sm, marginTop: theme.spacing.lg }]}>
        <MediClaroLogo variant="horizontal" size="md" />
        <View style={[styles.badge, { backgroundColor: c.primaryTint, marginTop: theme.spacing.md }]}>
          <Icon name="key" size={30} color="primary" />
        </View>
        <AppText variant="title" color="heading" align="center">Tu código MediClaro</AppText>
        <AppText variant="body" color="textSecondary" align="center" style={styles.lead}>
          Guárdalo en un lugar seguro o apúntalo en un papel. Si cambias de móvil, entra con él desde «Ya soy Premium», sin SMS.
        </AppText>
      </View>

      <View style={{ marginTop: theme.spacing.lg, gap: theme.spacing.md }}>
        {code ? (
          <>
            <View style={[styles.codeBox, { borderColor: c.primary, borderRadius: theme.radius.lg, backgroundColor: c.surface }]}>
              <AppText variant="title" color="heading" align="center" selectable style={styles.code} accessibilityLabel={`Tu código: ${code.split('').join(' ')}`} testID="my-access-code-value">
                {code}
              </AppText>
            </View>
            <InfoBanner tone="warning" message="Por seguridad, este código solo se muestra ahora. No se lo des a nadie. Si lo pierdes, entra con tu teléfono y te daremos uno nuevo." />
            <SecondaryButton label="Guardarlo o enviármelo" icon="share-outline" variant="outline" onPress={() => void share()} />
            <PrimaryButton label="Ya lo he guardado" icon="checkmark" onPress={() => router.replace('/(tabs)')} testID="my-access-code-done" />
          </>
        ) : error ? (
          <>
            <InfoBanner tone="danger" message={error} />
            <PrimaryButton label="Intentarlo de nuevo" icon="refresh" onPress={create} />
            <SecondaryButton label="Ahora no" variant="outline" onPress={() => router.replace('/(tabs)')} />
          </>
        ) : (
          <LoadingState message="Creando tu código…" />
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center' },
  badge: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center' },
  lead: { maxWidth: 340 },
  codeBox: { borderWidth: 2, borderStyle: 'dashed', paddingVertical: 22, paddingHorizontal: 8 },
  code: { fontSize: 30, lineHeight: 38, letterSpacing: 3, fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: undefined }) },
});
