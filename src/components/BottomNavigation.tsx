/**
 * Barra de navegación inferior: Inicio · Mis meds · [chat con tu cuidador/a] · Asistente · Perfil.
 * Compacta, proporcional y accesible (áreas táctiles ≥ 48, estado seleccionado).
 * En el centro, simétrico, un botón redondo y grande para el chat con el cuidador/a: con una sola conversación abre
 * directamente el chat; con varias (o ninguna, o un aviso de emergencia activo) lleva a «Cuidador y avisos».
 * Muestra cuántos mensajes hay sin leer y, si hay un aviso activo, un punto.
 */
import { useContext, useSyncExternalStore } from 'react';
import { Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, type Href } from 'expo-router';
import { BottomTabBarHeightCallbackContext, type BottomTabBarProps } from 'expo-router/js-tabs';
import { AppText } from './AppText';
import { Icon, type IconName } from './Icon';
import { useAppTheme } from '../providers/PreferencesProvider';
import { getLastCareSnapshot, incidentActive, subscribeCareSnapshot } from '../services/CaregiverService';
import { useCareChatSummary } from '../hooks/useCareChat';
import { chatOpen } from '../services/CareChatService';
import { useNow } from '../hooks/usePillPlan';
import { OffBadge } from './CareChatWindow';

export const TAB_ITEMS: Record<string, { label: string; icon: IconName; iconActive: IconName }> = {
  index: { label: 'Inicio', icon: 'home-outline', iconActive: 'home' },
  medicines: { label: 'Mis meds', icon: 'medkit-outline', iconActive: 'medkit' },
  chat: { label: 'Asistente', icon: 'chatbubble-ellipses-outline', iconActive: 'chatbubble-ellipses' },
  profile: { label: 'Perfil', icon: 'person-outline', iconActive: 'person' },
};

/** Botón central: chat con el cuidador/a. */
function CareChatButton() {
  const theme = useAppTheme();
  const c = theme.colors;
  const router = useRouter();
  const care = useSyncExternalStore(subscribeCareSnapshot, getLastCareSnapshot, getLastCareSnapshot);
  const alert = !!care?.incidents.some((i) => incidentActive(i));
  const chats = useCareChatSummary();
  const unread = chats.unread;
  const size = theme.easyMode ? 70 : 64;
  // Cuidador/a: el chat lo enciende la persona cuidada; si ninguna conversación está encendida, el botón se ve
  // apagado (en rojo) hasta que vuelva a escribir. La persona cuidada lo ve siempre encendido.
  const now = useNow(30_000).getTime();
  const asCaregiver = chats.conversations.length > 0 && chats.conversations.every((cv) => cv.myRole === 'caregiver');
  const off = asCaregiver && !alert && !chats.conversations.some((cv) => chatOpen(cv, now));
  const open = () => {
    // Un aviso de emergencia activo va primero; con una sola conversación, directamente al chat.
    if (!alert && chats.conversations.length === 1) {
      router.push({ pathname: '/caregiver-chat', params: { link: chats.conversations[0].linkId } } as Href);
    } else {
      router.push('/caregiver' as Href);
    }
  };
  // En móviles estrechos (320–359 px) la etiqueta se reduce un poco para que quepa entera.
  const narrow = useWindowDimensions().width < 360;
  return (
    <Pressable
      onPress={open}
      accessibilityRole="button"
      accessibilityLabel={`${asCaregiver ? 'Chat con tu familiar' : 'Chat con tu cuidador/a'}${off ? '. Apagado: se enciende cuando te escriba' : ''}${alert ? '. Hay un aviso activo' : ''}${unread ? `. ${unread} mensaje${unread === 1 ? '' : 's'} sin leer` : ''}`}
      accessibilityHint={asCaregiver ? 'Abre el chat con la persona a la que cuidas' : 'Abre el chat con tu cuidador/a'}
      accessibilityState={{ disabled: off }}
      testID={off ? 'tab-care-chat-off' : 'tab-care-chat'}
      style={({ pressed }) => [styles.item, styles.centerSlot, { minHeight: theme.layout.tabBarHeight, opacity: pressed ? 0.85 : 1 }]}
    >
      <View
        style={[
          styles.centerCircle,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            marginTop: -Math.round(size * 0.42),
            backgroundColor: off ? c.dangerSoft : c.danger,
            borderColor: off ? '#F5C2C2' : c.surface,
          },
          off ? null : theme.shadow.danger,
        ]}
      >
        <Icon name="chatbubbles" size={theme.easyMode ? 34 : 30} color={off ? c.danger : '#FFFFFF'} />
        <View style={[styles.heart, { backgroundColor: off ? c.danger : c.surface }]}>
          <Icon name="heart" size={13} color={off ? '#FFFFFF' : c.danger} />
        </View>
        {off ? <OffBadge size={22} testID="tab-care-chat-off-badge" /> : null}
        {alert ? (
          <View style={[styles.dot, { backgroundColor: c.warning, borderColor: c.surface }]} testID="tab-care-chat-alert" />
        ) : unread ? (
          <View style={[styles.count, { backgroundColor: c.surface, borderColor: c.danger }]} testID="tab-care-chat-unread">
            <AppText variant="small" style={[styles.countText, { color: c.dangerText }]} allowFontScaling={false}>
              {unread > 9 ? '9+' : String(unread)}
            </AppText>
          </View>
        ) : null}
      </View>
      <AppText variant="small" style={[{ color: c.dangerText, fontWeight: '700' }, narrow ? styles.narrowLabel : null]} numberOfLines={1}>
        {off ? 'Apagado' : asCaregiver ? 'Chat' : 'Cuidador/a'}
      </AppText>
    </Pressable>
  );
}

export function BottomNavigation({ state, navigation }: BottomTabBarProps) {
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const c = theme.colors;
  const reportHeight = useContext(BottomTabBarHeightCallbackContext);
  const routes = state.routes.filter((r) => TAB_ITEMS[r.name]);
  const half = Math.ceil(routes.length / 2);
  const tab = (route: (typeof state.routes)[number]) => {
    const item = TAB_ITEMS[route.name];
    const index = state.routes.indexOf(route);
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
  };
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
        {routes.slice(0, half).map(tab)}
        <CareChatButton />
        {routes.slice(half).map(tab)}
      </View>
    </View>
  );
}

/**
 * La misma barra fuera de las pestañas (por ejemplo, en el panel del propietario, como en su diseño): cada botón lleva a
 * su pestaña. `active` marca la pestaña de la que se viene.
 */
const STANDALONE_TABS: { name: keyof typeof TAB_ITEMS; href: string }[] = [
  { name: 'index', href: '/(tabs)' },
  { name: 'medicines', href: '/(tabs)/medicines' },
  { name: 'chat', href: '/(tabs)/chat' },
  { name: 'profile', href: '/(tabs)/profile' },
];

export function StandaloneTabBar({ active }: { active?: keyof typeof TAB_ITEMS }) {
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const c = theme.colors;
  const tab = (t: (typeof STANDALONE_TABS)[number]) => {
    const item = TAB_ITEMS[t.name];
    const focused = active === t.name;
    const color = focused ? c.tabActive : c.tabInactive;
    return (
      <Pressable
        key={t.name}
        onPress={() => router.navigate(t.href as Href)}
        accessibilityRole="tab"
        accessibilityState={{ selected: focused }}
        accessibilityLabel={item.label}
        testID={`tab-${t.name}`}
        style={({ pressed }) => [styles.item, { minHeight: theme.layout.tabBarHeight, opacity: pressed ? 0.7 : 1 }]}
      >
        <Icon name={focused ? item.iconActive : item.icon} size={theme.easyMode ? 30 : 26} color={color} />
        <AppText variant="small" style={{ color, fontWeight: focused ? '800' : '600' }} numberOfLines={1}>
          {item.label}
        </AppText>
      </Pressable>
    );
  };
  return (
    <View
      style={[styles.bar, { paddingBottom: Math.max(insets.bottom, 8), backgroundColor: c.surface, borderTopColor: c.border }, theme.shadow.soft]}
      accessibilityRole="tablist"
    >
      <View style={[styles.inner, { maxWidth: theme.layout.maxContentWidth }]}>
        {STANDALONE_TABS.slice(0, 2).map(tab)}
        <CareChatButton />
        {STANDALONE_TABS.slice(2).map(tab)}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 4, alignItems: 'center', overflow: 'visible' },
  inner: { flexDirection: 'row', width: '100%', overflow: 'visible' },
  item: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 2, paddingVertical: 4 },
  centerSlot: { justifyContent: 'flex-end', overflow: 'visible' },
  centerCircle: { alignItems: 'center', justifyContent: 'center', borderWidth: 4 },
  heart: {
    position: 'absolute',
    right: 9,
    bottom: 9,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: { position: 'absolute', top: 2, right: 2, width: 16, height: 16, borderRadius: 8, borderWidth: 2 },
  count: { position: 'absolute', top: -4, right: -6, minWidth: 24, height: 24, borderRadius: 12, borderWidth: 2, paddingHorizontal: 4, alignItems: 'center', justifyContent: 'center' },
  countText: { fontSize: 13, lineHeight: 16, fontWeight: '800' },
  narrowLabel: { fontSize: 11, letterSpacing: -0.2 },
});
