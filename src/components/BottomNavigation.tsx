/**
 * Barra de navegación inferior: Inicio · Mis meds · Asistente · Perfil.
 * Compacta, proporcional y accesible (áreas táctiles ≥ 48, estado seleccionado).
 */
import { useContext } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BottomTabBarHeightCallbackContext, type BottomTabBarProps } from 'expo-router/js-tabs';
import { AppText } from './AppText';
import { Icon, type IconName } from './Icon';
import { useAppTheme } from '../providers/PreferencesProvider';

export const TAB_ITEMS: Record<string, { label: string; icon: IconName; iconActive: IconName }> = {
  index: { label: 'Inicio', icon: 'home-outline', iconActive: 'home' },
  medicines: { label: 'Mis meds', icon: 'medkit-outline', iconActive: 'medkit' },
  chat: { label: 'Asistente', icon: 'chatbubble-ellipses-outline', iconActive: 'chatbubble-ellipses' },
  profile: { label: 'Perfil', icon: 'person-outline', iconActive: 'person' },
};

export function BottomNavigation({ state, navigation }: BottomTabBarProps) {
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const c = theme.colors;
  const reportHeight = useContext(BottomTabBarHeightCallbackContext);
  return (
    <View
      onLayout={(e) => reportHeight?.(e.nativeEvent.layout.height)}
      style={[
        styles.bar,
        {
          paddingBottom: Math.max(insets.bottom, 8),
          backgroundColor: c.surface,
          borderTopColor: c.border,
        },
        theme.shadow.soft,
      ]}
      accessibilityRole="tablist"
    >
      <View style={[styles.inner, { maxWidth: theme.layout.maxContentWidth }]}>
        {state.routes.map((route, index) => {
          const item = TAB_ITEMS[route.name];
          if (!item) return null;
          const focused = state.index === index;
          const color = focused ? c.tabActive : c.tabInactive;
          const onPress = () => {
            const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
            if (!focused && !event.defaultPrevented) navigation.navigate(route.name, route.params);
          };
          return (
            <Pressable
              key={route.key}
              onPress={onPress}
              onLongPress={() => navigation.emit({ type: 'tabLongPress', target: route.key })}
              accessibilityRole="tab"
              accessibilityState={{ selected: focused }}
              accessibilityLabel={item.label}
              testID={`tab-${route.name}`}
              style={({ pressed }) => [styles.item, { minHeight: theme.layout.tabBarHeight, opacity: pressed ? 0.7 : 1 }]}
            >
              <Icon name={focused ? item.iconActive : item.icon} size={theme.easyMode ? 30 : 26} color={color} />
              <AppText variant="small" style={{ color, fontWeight: focused ? '800' : '600' }} numberOfLines={1}>
                {item.label}
              </AppText>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 4, alignItems: 'center' },
  inner: { flexDirection: 'row', width: '100%' },
  item: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 2, paddingVertical: 4 },
});
