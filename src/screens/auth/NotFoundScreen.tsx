/**
 * Pantalla no encontrada (+not-found): enlace roto o ruta que ya no existe.
 * Nunca deja a la persona atrapada: siempre puede volver al inicio.
 */
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen, AppHeader, AppText, Icon, PrimaryButton } from '../../components';
import { useAppTheme } from '../../hooks';

export default function NotFoundScreen() {
  const router = useRouter();
  const theme = useAppTheme();

  return (
    <Screen
      header={<AppHeader fallbackHref="/" />}
      footer={
        <PrimaryButton
          label="Volver al inicio"
          icon="home"
          onPress={() => router.replace('/')}
          testID="notfound-home"
        />
      }
    >
      <View style={styles.center}>
        <View style={[styles.iconCircle, { backgroundColor: theme.colors.primaryTint, borderColor: theme.colors.primarySoft }]}>
          <Icon name="compass-outline" size={52} color="primary" />
        </View>
        <AppText variant="title" align="center" accessibilityRole="header" style={{ marginTop: theme.spacing.xl }}>
          No encontramos esta pantalla
        </AppText>
        <AppText variant="body" color="textSecondary" align="center" style={[styles.text, { marginTop: theme.spacing.sm }]}>
          Puede que el enlace no sea correcto o que la pantalla ya no exista. Vuelve al inicio para seguir.
        </AppText>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 40 },
  iconCircle: { width: 112, height: 112, borderRadius: 56, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  text: { maxWidth: 340 },
});
