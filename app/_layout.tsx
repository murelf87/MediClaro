/**
 * Layout raÃ­z: proveedores globales, navegaciÃ³n y protecciÃ³n de rutas.
 * Las pantallas usan su propia cabecera (AppHeader) â†’ headerShown: false.
 *
 * Rutas: "/" es el Inicio (pestaÃ±as). La bienvenida vive en "/welcome".
 *
 * QuiÃ©n ve quÃ©:
 *  - Sin cuenta: bienvenida, explicaciÃ³n, planes y pago (sin registrarse), acceso, legales, ayuda y la pantalla
 *    principal de emergencia (112), que SIEMPRE es pÃºblica.
 *  - Cuenta sin telÃ©fono creada al pagar: si aÃºn no tiene Premium (pago cancelado o pendiente) vuelve a la
 *    bienvenida; con Premium, toda la app. Nunca se le pide el telÃ©fono antes de pagar.
 *  - Con telÃ©fono: toda la app; las funciones reales muestran los planes si no hay Premium (PremiumGate).
 */
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { Stack, useGlobalSearchParams, useRouter, useSegments, type Href } from 'expo-router';
import { useFonts } from 'expo-font';
import Ionicons from '@expo/vector-icons/Ionicons';
import { SessionProvider, useSession } from '../src/providers/SessionProvider';
import { PreferencesProvider, useAppTheme } from '../src/providers/PreferencesProvider';
import { EntitlementProvider, useEntitlement } from '../src/providers/EntitlementProvider';
import { BrandSplash } from '../src/screens/auth/BrandSplash';
import { AiConsentHost } from '../src/components/AiConsentHost';
import { CaregiverHost } from '../src/components/CaregiverHost';
import { CareCallHost } from '../src/components/CareCallHost';
import { PillReminderHost } from '../src/components/PillReminderHost';
import { DemoPaymentSheetsHost } from '../src/mocks/demoPayments';
import { configureAudioForSpeech } from '../src/utils/audio';
import { PREMIUM_REQUIRED } from '../src/config/app';
import { PostAuthRoute } from '../src/services/PostAuthRoute';
import { TestAccess } from '../src/services/TestAccess';
import { AUTH_FLOW, PAYMENT_FLOW, routeTarget } from '../src/navigation/routeGuard';

function RootNavigator() {
  const { status, session } = useSession();
  const entitlement = useEntitlement();
  const segments = useSegments() as string[];
  const search = useGlobalSearchParams<{ purpose?: string | string[] }>();
  const router = useRouter();
  const theme = useAppTheme();
  const first = segments[0] ?? '';
  const purpose = Array.isArray(search.purpose) ? search.purpose[0] : search.purpose;
  const linkingPhone = first === 'verify' && purpose === 'link';
  // Un acceso anónimo gratuito es un perfil Básico válido. Solo lo tratamos como
  // cuenta de pago mientras está realmente dentro del flujo de compra/verificación.
  const paymentAccount =
    session?.mode === 'anonymous' &&
    !TestAccess.isActive() &&
    (PAYMENT_FLOW.has(first) || linkingPhone);

  const target = routeTarget({
    status,
    segments,
    linkingPhone,
    paymentAccount,
    entitlementReady: entitlement.status === 'ready',
    isPremium: entitlement.isPremium,
    premiumRequired: PREMIUM_REQUIRED,
    postAuth: PostAuthRoute.peek(),
  }) as Href | null;
  const needsRedirect = status === 'loading' || target !== null;
  const targetKey = target ? JSON.stringify(target) : '';

  useEffect(() => {
    if (!target) return;
    router.replace(target);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetKey, router]);

  // El destino pendiente tras entrar con el telÃ©fono (p. ej. volver al pago) se olvida AL LLEGAR, no antes:
  // mientras la navegaciÃ³n termina, la protecciÃ³n de rutas lo sigue necesitando para no mandar al Inicio.
  useEffect(() => {
    if (status === 'signedIn' && !AUTH_FLOW.has(first) && PostAuthRoute.peek()) PostAuthRoute.consume();
  }, [status, first]);

  return (
    <View style={styles.flex}>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: theme.colors.background },
          animation: 'slide_from_right',
        }}
      >
        <Stack.Screen name="(tabs)" options={{ animation: 'fade' }} />
        <Stack.Screen name="welcome" options={{ animation: 'fade' }} />
        <Stack.Screen name="tour" options={{ animation: 'fade_from_bottom' }} />
        <Stack.Screen name="premium-success" options={{ animation: 'fade', gestureEnabled: false }} />
        <Stack.Screen name="scan" options={{ animation: 'fade', contentStyle: { backgroundColor: '#000000' } }} />
        <Stack.Screen name="processing" options={{ animation: 'fade', gestureEnabled: false }} />
        <Stack.Screen
          name="emergency/in-call"
          options={{ animation: 'fade', contentStyle: { backgroundColor: theme.colors.callBackground } }}
        />
        <Stack.Screen
          name="caregiver-call"
          options={{ animation: 'fade', gestureEnabled: false, contentStyle: { backgroundColor: theme.colors.callBackground } }}
        />
      </Stack>
      <AiConsentHost />
      <CaregiverHost />
      <CareCallHost />
      <PillReminderHost />
      <DemoPaymentSheetsHost />
      {needsRedirect ? (
        // Tapa la transiciÃ³n (carga de sesiÃ³n o redirecciÃ³n) para que nunca se vea
        // una pantalla privada sin sesiÃ³n ni un parpadeo.
        <View style={StyleSheet.absoluteFill}>
          <BrandSplash />
        </View>
      ) : null}
    </View>
  );
}

function FontGate() {
  const [loaded, error] = useFonts({ ...Ionicons.font });
  useEffect(() => {
    void configureAudioForSpeech();
  }, []);
  if (!loaded && !error) return <BrandSplash />;
  return <RootNavigator />;
}

export default function RootLayout() {
  return (
    <SessionProvider>
      <PreferencesProvider>
        <EntitlementProvider>
          <FontGate />
        </EntitlementProvider>
      </PreferencesProvider>
    </SessionProvider>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
});
