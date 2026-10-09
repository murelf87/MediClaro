/**
 * Aviso permanente en los accesos de PRUEBA (solo compilaciones de desarrollo/preview):
 *  - demo: "Modo demostración · datos de ejemplo" (nada es real)
 *  - acceso de prueba sin teléfono («Entrar sin verificar»): "Acceso de prueba sin verificar el móvil"
 *  - sin servidor configurado y sin sesión: "Modo demostración · servidor no conectado"
 * Tocar el aviso permite salir. Una cuenta sin teléfono creada AL PAGAR no es de prueba: no muestra aviso.
 */
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { AppText } from './AppText';
import { Icon } from './Icon';
import { useSession } from '../providers/SessionProvider';
import { useAppTheme } from '../providers/PreferencesProvider';
import { confirmAsync } from '../utils/dialogs';
import { DemoMode } from '../services/DemoMode';
import { TestAccess } from '../services/TestAccess';

export function AccessBanner() {
  const { session, signOut } = useSession();
  const theme = useAppTheme();
  const router = useRouter();
  const [testAccess, setTestAccess] = useState(TestAccess.isActive());
  useEffect(() => TestAccess.subscribe(() => setTestAccess(TestAccess.isActive())), []);

  if (!session) {
    if (!DemoMode.isActive()) return null;
    return (
      <View
        style={[styles.bar, { backgroundColor: theme.colors.warningSoft, borderBottomColor: '#F6D58E' }]}
        accessible
        accessibilityLabel="Modo demostración: el servidor no está conectado. Los pagos son simulados."
      >
        <View style={styles.inner}>
          <Icon name="flask" size={16} color={theme.colors.warningText} />
          <AppText variant="small" style={{ color: theme.colors.warningText }} numberOfLines={1}>
            Modo demostración · pagos simulados
          </AppText>
        </View>
      </View>
    );
  }
  if (session.mode === 'verified') return null;
  if (session.mode === 'anonymous' && !testAccess) return null;

  const demo = session.mode === 'demo';
  const text = demo ? 'Modo demostración · datos de ejemplo' : 'Acceso de prueba sin verificar el móvil';

  const onPress = async () => {
    const ok = await confirmAsync({
      title: demo ? '¿Salir del modo demostración?' : '¿Salir del acceso de prueba?',
      message: demo
        ? 'Estás viendo la app con datos de ejemplo: nada de lo que ves es real. Al salir volverás a la pantalla de bienvenida.'
        : 'Estás usando la app sin haber verificado tu móvil. Al salir volverás a la pantalla de bienvenida.',
      confirmText: 'Salir',
      cancelText: 'Seguir probando',
    });
    if (!ok) return;
    await signOut();
    router.replace('/welcome');
  };

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${text}. Toca para salir`}
      style={({ pressed }) => [
        styles.bar,
        { backgroundColor: pressed ? '#FCE7B8' : theme.colors.warningSoft, borderBottomColor: '#F6D58E' },
      ]}
    >
      <View style={styles.inner}>
        <Icon name={demo ? 'flask' : 'lock-open'} size={16} color={theme.colors.warningText} />
        <AppText variant="small" style={{ color: theme.colors.warningText }} numberOfLines={1}>
          {text}
        </AppText>
        <AppText variant="small" style={{ color: theme.colors.warningText, textDecorationLine: 'underline' }}>
          Salir
        </AppText>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bar: { width: '100%', borderBottomWidth: StyleSheet.hairlineWidth, minHeight: 32, justifyContent: 'center' },
  inner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 6 },
});
