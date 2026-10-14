/**
 * Idioma (/language). Hoy solo existe el español: se muestra como opción activa,
 * sin controles que no hagan nada.
 */
import { View } from 'react-native';
import { Screen, AppHeader, AppText, Icon, InfoBanner, ListGroup, SettingRow } from '../../components';
import { useAppTheme } from '../../hooks';

export default function LanguageScreen() {
  const theme = useAppTheme();
  return (
    <Screen header={<AppHeader title="Idioma" fallbackHref="/(tabs)/profile" />}>
      <AppText variant="body" color="textSecondary" style={{ marginTop: theme.spacing.xs, marginBottom: theme.spacing.md }}>
        El idioma en el que ves los textos de MediClaro.
      </AppText>

      <ListGroup>
        <SettingRow
          leading={
            <View style={{ width: 30, alignItems: 'center' }}>
              <AppText style={{ fontSize: 24 }} allowFontScaling={false} accessibilityElementsHidden importantForAccessibility="no">
                🇪🇸
              </AppText>
            </View>
          }
          label="Español"
          description="Idioma de la aplicación"
          right={<Icon name="checkmark-circle" size={28} color="primary" />}
          testID="language-es"
        />
      </ListGroup>

      <InfoBanner
        tone="info"
        message="Por ahora MediClaro solo está disponible en español."
        style={{ marginTop: theme.spacing.lg }}
      />
    </Screen>
  );
}
