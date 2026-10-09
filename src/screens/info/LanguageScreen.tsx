/**
 * Idioma (/language). Hoy MediClaro está en español de España (textos, voces y fuentes oficiales de la AEMPS):
 * se muestra como opción activa, sin controles que no hagan nada.
 * La bandera se dibuja (las banderas emoji no se ven en todos los dispositivos, p. ej. en Windows salen «ES»).
 */
import { StyleSheet, View } from 'react-native';
import { Screen, AppHeader, AppText, Icon, InfoBanner, ListGroup, SettingRow } from '../../components';
import { useAppTheme } from '../../hooks';

/** Bandera de España (franjas roja, amarilla y roja en proporción 1:2:1), sin escudo. */
function SpainFlag() {
  return (
    <View style={styles.flag} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <View style={[styles.stripe, { flex: 1, backgroundColor: '#AA151B' }]} />
      <View style={[styles.stripe, { flex: 2, backgroundColor: '#F1BF00' }]} />
      <View style={[styles.stripe, { flex: 1, backgroundColor: '#AA151B' }]} />
    </View>
  );
}

export default function LanguageScreen() {
  const theme = useAppTheme();
  return (
    <Screen header={<AppHeader title="Idioma" fallbackHref="/(tabs)/profile" />}>
      <AppText variant="body" color="textSecondary" style={{ marginTop: theme.spacing.xs, marginBottom: theme.spacing.md }}>
        El idioma en el que ves y escuchas MediClaro.
      </AppText>

      <ListGroup>
        <SettingRow
          leading={
            <View style={styles.flagSlot}>
              <SpainFlag />
            </View>
          }
          label="Español (España)"
          description="Textos y voces en castellano de España"
          right={<Icon name="checkmark-circle" size={28} color="primary" />}
          selected
          testID="language-es-ES"
        />
      </ListGroup>

      <InfoBanner
        tone="info"
        message="MediClaro está en español de España: los textos, las voces que leen los prospectos y la información oficial de la AEMPS."
        style={{ marginTop: theme.spacing.lg }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  flagSlot: { width: 30, alignItems: 'center' },
  flag: { width: 30, height: 20, borderRadius: 3, overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(0,0,0,0.15)' },
  stripe: { width: '100%' },
});
