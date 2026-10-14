/**
 * Contenedor de pantalla.
 * - Respeta safe area (notch, Dynamic Island, barra de gestos).
 * - Columna centrada con ancho máximo (tablets y web escritorio).
 * - Scroll opcional, teclado (KeyboardAvoidingView) y pie fijo para botones.
 */
import { useEffect, useState, type ReactNode, type RefObject } from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
  type RefreshControlProps,
  type ScrollViewProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import type { ReactElement } from 'react';
import { useAppTheme } from '../providers/PreferencesProvider';
import type { ColorScheme } from '../theme';
import { AccessBanner } from './AccessBanner';

export type ScreenGradient = 'none' | 'emergency' | 'soft' | 'success' | 'premium';

export interface ScreenProps {
  children: ReactNode;
  /** Cabecera (AppHeader). Se coloca bajo la barra de estado. */
  header?: ReactNode;
  /** Pie fijo (botones principales). Respeta la barra de gestos. */
  footer?: ReactNode;
  scroll?: boolean;
  /** Márgenes horizontales estándar. */
  padded?: boolean;
  /** Bordes con safe area. En pestañas la barra inferior gestiona el borde inferior. */
  edges?: ('top' | 'bottom')[];
  background?: keyof ColorScheme;
  gradient?: ScreenGradient;
  statusBar?: 'dark' | 'light';
  keyboard?: boolean;
  contentStyle?: StyleProp<ViewStyle>;
  refreshControl?: ReactElement<RefreshControlProps>;
  scrollRef?: RefObject<ScrollView | null>;
  scrollProps?: Omit<ScrollViewProps, 'children' | 'contentContainerStyle' | 'refreshControl'>;
  testID?: string;
}

// Degradados suaves de la paleta de marca (terminan en el fondo #F8FAFC).
const GRADIENTS: Record<Exclude<ScreenGradient, 'none'>, [string, string, ...string[]]> = {
  emergency: ['#FFE7E6', '#FFF4F3', '#F8FAFC'],
  soft: ['#E6F0FF', '#F2F7FF', '#F8FAFC'],
  success: ['#E3F8EF', '#F1FBF6', '#F8FAFC'],
  premium: ['#D9E8FF', '#EDF4FF', '#F8FAFC'],
};

export function Screen({
  children,
  header,
  footer,
  scroll = true,
  padded = true,
  edges = ['top', 'bottom'],
  background = 'background',
  gradient = 'none',
  statusBar = 'dark',
  keyboard = false,
  contentStyle,
  refreshControl,
  scrollRef,
  scrollProps,
  testID,
}: ScreenProps) {
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const keyboardVisible = useKeyboardVisible(keyboard);
  const padTop = edges.includes('top') ? insets.top : 0;
  const padBottom = edges.includes('bottom') ? insets.bottom : 0;
  const horizontal = padded ? theme.layout.screenPaddingH : 0;

  const column: ViewStyle = {
    width: '100%',
    maxWidth: theme.layout.maxContentWidth,
    alignSelf: 'center',
    paddingHorizontal: horizontal,
  };

  const body = scroll ? (
    <ScrollView
      ref={scrollRef}
      style={styles.flex}
      contentContainerStyle={[styles.scrollContent, { paddingBottom: footer ? theme.spacing.xl : padBottom + theme.spacing.xl }]}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
      showsVerticalScrollIndicator={false}
      refreshControl={refreshControl}
      {...scrollProps}
    >
      <View style={[column, contentStyle]}>{children}</View>
    </ScrollView>
  ) : (
    <View style={[styles.flex, column, !footer && { paddingBottom: padBottom }, contentStyle]}>{children}</View>
  );

  const content = (
    <>
      {body}
      {footer ? (
        <View
          style={[
            styles.footer,
            {
              // Con el teclado abierto no hace falta el margen de la barra de gestos.
              paddingBottom: keyboardVisible ? theme.spacing.sm : Math.max(padBottom, theme.spacing.md),
              paddingTop: theme.spacing.sm,
              backgroundColor: gradient === 'none' ? theme.colors[background] : 'transparent',
            },
          ]}
        >
          <View style={[column, styles.footerInner]}>{footer}</View>
        </View>
      ) : null}
    </>
  );

  return (
    <View style={[styles.flex, { backgroundColor: theme.colors[background] }]} testID={testID}>
      {gradient !== 'none' ? (
        <LinearGradient colors={GRADIENTS[gradient]} locations={[0, 0.45, 1]} style={StyleSheet.absoluteFill} pointerEvents="none" />
      ) : null}
      <StatusBar style={statusBar} />
      <View style={{ paddingTop: padTop }}>
        <AccessBanner />
        {header ? <View style={{ width: '100%', maxWidth: theme.layout.maxContentWidth + 32, alignSelf: 'center' }}>{header}</View> : null}
      </View>
      {keyboard ? (
        // 'padding' también en Android: con edge-to-edge (RN 0.86) la ventana ya no se
        // redimensiona sola al abrir el teclado.
        <KeyboardAvoidingView style={styles.flex} behavior="padding">
          {content}
        </KeyboardAvoidingView>
      ) : (
        content
      )}
    </View>
  );
}

/** ¿Está el teclado abierto? (solo se escucha en pantallas con formularios). */
function useKeyboardVisible(enabled: boolean): boolean {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (!enabled) return undefined;
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const a = Keyboard.addListener(showEvent, () => setVisible(true));
    const b = Keyboard.addListener(hideEvent, () => setVisible(false));
    return () => {
      a.remove();
      b.remove();
    };
  }, [enabled]);
  return visible;
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scrollContent: { flexGrow: 1 },
  footer: { width: '100%' },
  footerInner: { gap: 10 },
});
