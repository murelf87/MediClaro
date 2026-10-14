/**
 * Pestañas principales: Inicio · Mis meds · Asistente · Perfil.
 */
import { Tabs } from 'expo-router/js-tabs';
import { BottomNavigation } from '../../src/components/BottomNavigation';
import { useAppTheme } from '../../src/providers/PreferencesProvider';

export default function TabsLayout() {
  const theme = useAppTheme();
  return (
    <Tabs
      tabBar={(props) => <BottomNavigation {...props} />}
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: theme.colors.background } }}
    >
      <Tabs.Screen name="index" options={{ title: 'Inicio' }} />
      <Tabs.Screen name="medicines" options={{ title: 'Mis meds' }} />
      <Tabs.Screen name="chat" options={{ title: 'Asistente' }} />
      <Tabs.Screen name="profile" options={{ title: 'Perfil' }} />
    </Tabs>
  );
}
