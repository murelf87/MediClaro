/**
 * /easy-mode — Modo fácil: letra muy grande, botones más grandes e Inicio simplificado.
 * El cambio se aplica al instante en toda la app (usePreferences.setEasyMode).
 */
import { Pressable, StyleSheet, Switch, View } from 'react-native';
import { useRouter } from 'expo-router';
import { AppHeader, AppText, Card, CheckItem, InfoBanner, PrimaryButton, Screen } from '../../components';
import { useAppTheme, usePreferences } from '../../hooks';
import { EasyModeIllustration } from './parts';

const FEATURES = [
  'Letra muy grande en toda la app',
  'Botones más grandes',
  'Un Inicio más sencillo, con lo esencial',
  'El botón de emergencia siempre a mano',
];

export default function EasyModeScreen() {
  const router = useRouter();
  const theme = useAppTheme();
  const c = theme.colors;
  const { prefs, setEasyMode } = usePreferences();
  const enabled = prefs.easyMode;
  const toggle = (value: boolean) => void setEasyMode(value);

  return (
    <Screen
      header={<AppHeader title="Modo fácil" />}
      footer={
        enabled ? (
          <PrimaryButton label="Ir al Inicio para verlo" icon="home" onPress={() => router.replace('/(tabs)')} testID="easy-mode-home" />
        ) : undefined
      }
    >
      <View style={[styles.hero, { gap: theme.spacing.xs }]}>
        <EasyModeIllustration size={170} />
        <AppText variant="title" align="center" accessibilityRole="header">
          Más grande y más sencillo
        </AppText>
        <AppText variant="body" color="textSecondary" align="center">
          Actívalo si te cuesta leer o pulsar en la pantalla.
        </AppText>
      </View>

      <Card style={{ marginTop: theme.spacing.lg }}>
        <View style={{ gap: theme.spacing.xs }}>
          {FEATURES.map((f) => (
            <CheckItem key={f} label={f} />
          ))}
        </View>
      </Card>

      <Pressable
        onPress={() => toggle(!enabled)}
        accessibilityRole="switch"
        accessibilityLabel="Activar Modo fácil"
        accessibilityState={{ checked: enabled }}
        testID="easy-mode-toggle"
        style={({ pressed }) => [
          styles.toggleCard,
          {
            marginTop: theme.spacing.md,
            minHeight: theme.touchTargets.easyMode + 16,
            borderRadius: theme.radius.lg,
            borderColor: enabled ? c.primary : c.border,
            borderWidth: enabled ? 2 : 1,
            paddingHorizontal: enabled ? 17 : 18,
            backgroundColor: enabled ? c.primaryTint : pressed ? c.surfaceAlt : c.surface,
          },
          theme.shadow.card,
        ]}
      >
        <View style={styles.flex}>
          <AppText variant="heading" color="heading">
            Activar Modo fácil
          </AppText>
          <AppText variant="bodyStrong" color={enabled ? 'successText' : 'textSecondary'}>
            {enabled ? 'Activado' : 'Desactivado'}
          </AppText>
        </View>
        <Switch
          value={enabled}
          onValueChange={toggle}
          trackColor={{ true: c.primary, false: c.borderStrong }}
          thumbColor={c.surface}
          ios_backgroundColor={c.borderStrong}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={styles.bigSwitch}
        />
      </Pressable>

      {enabled ? (
        <InfoBanner
          tone="success"
          title="Modo fácil activado"
          message="Ya se aplica en toda la app. Puedes desactivarlo aquí cuando quieras."
          style={{ marginTop: theme.spacing.md }}
        />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  hero: { alignItems: 'center', marginTop: 4 },
  toggleCard: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingVertical: 14 },
  bigSwitch: { transform: [{ scale: 1.2 }] },
});
