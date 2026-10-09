/**
 * Pantalla de marca mientras se carga la sesión y las fuentes.
 */
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { MediClaroLogo } from '../../components/MediClaroLogo';
import { AppText } from '../../components/AppText';
import { useAppTheme } from '../../providers/PreferencesProvider';
import { APP_TAGLINE } from '../../config/app';

export function BrandSplash() {
  const theme = useAppTheme();
  return (
    <View style={[styles.wrap, { backgroundColor: theme.colors.background }]} accessibilityLabel="MediClaro, cargando">
      <MediClaroLogo variant="stacked" size="xl" />
      <AppText variant="body" color="textSecondary" align="center" style={styles.tagline}>
        {APP_TAGLINE}
      </AppText>
      <ActivityIndicator color={theme.colors.primary} style={{ marginTop: 28 }} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  tagline: { marginTop: 12, maxWidth: 320 },
});
