/**
 * Piezas LOCALES de las pantallas de acceso (onboarding, login, verificación).
 * No son componentes compartidos: solo las usan las pantallas de src/screens/auth.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useNavigation, useRouter } from 'expo-router';
import { AppText, InfoBanner } from '../../components';
import { useAppTheme, useSession } from '../../hooks';
import { AppError, isAppError } from '../../services';
import { onlyDigits } from '../../utils/format';
import type { AppErrorKind } from '../../types';

/** Cualquier fallo → AppError (los servicios ya lanzan AppError con el mensaje en español). */
export function asAppError(e: unknown): AppError {
  return isAppError(e) ? e : new AppError('unknown');
}

/** Espera sin bloquear la interfaz. */
export function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Parámetro `phone` de /verify → formato E.164 (+34600123456) o null si no es válido.
 * Tolera el "+" decodificado como espacio en la URL.
 */
export function normalizePhoneParam(raw: string | string[] | undefined): string | null {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (!value) return null;
  const digits = onlyDigits(value);
  if (digits.length < 8 || digits.length > 15) return null;
  return `+${digits}`;
}

/**
 * Entrada en la app tras iniciar sesión (código SMS o "Entrar sin verificar").
 * El layout raíz redirige al Inicio en cuanto la sesión está activa; aquí esperamos
 * a que la sesión exista (evita el rebote a la bienvenida) y, solo como respaldo,
 * navegamos nosotros si la pantalla sigue visible. Si la sesión no llega, avisamos.
 */
export function useEnterApp(onTimeout: () => void): () => void {
  const { status } = useSession();
  const router = useRouter();
  const navigation = useNavigation();
  const [requested, setRequested] = useState(false);
  const onTimeoutRef = useRef(onTimeout);
  onTimeoutRef.current = onTimeout;

  useEffect(() => {
    if (!requested) return undefined;
    if (status === 'signedIn') {
      const fallback = setTimeout(() => {
        if (navigation.isFocused()) router.replace('/(tabs)');
      }, 400);
      return () => clearTimeout(fallback);
    }
    const giveUp = setTimeout(() => {
      setRequested(false);
      onTimeoutRef.current();
    }, 8000);
    return () => clearTimeout(giveUp);
  }, [requested, status, navigation, router]);

  return useCallback(() => setRequested(true), []);
}

const ERROR_TITLES: Partial<Record<AppErrorKind, string>> = {
  offline: 'Sin conexión',
  timeout: 'Está tardando demasiado',
  rate_limited: 'Demasiados intentos',
  not_configured: 'El acceso por SMS aún no está activado',
  invalid_input: 'Revisa el número',
  provider_down: 'No hemos podido enviar el SMS',
  not_available: 'Opción no disponible',
  unauthorized: 'No hemos podido iniciar la sesión',
};

/** Aviso de error de acceso: gris si no hay conexión, rojo en el resto de casos. */
export function AuthErrorBanner({
  error,
  title,
  extra,
}: {
  error: AppError;
  title?: string;
  /** Frase adicional (p. ej. cómo seguir mientras el SMS no está activo). */
  extra?: string;
}) {
  const theme = useAppTheme();
  return (
    <InfoBanner
      tone={error.kind === 'offline' ? 'neutral' : 'danger'}
      title={title ?? ERROR_TITLES[error.kind] ?? 'No ha sido posible'}
      message={extra ? `${error.message} ${extra}` : error.message}
      style={{ marginTop: theme.spacing.md }}
    />
  );
}

/** Separador "— o —" entre dos formas de entrar. */
export function OrDivider({ label = 'o' }: { label?: string }) {
  const theme = useAppTheme();
  return (
    <View style={[styles.or, { marginVertical: theme.spacing.lg }]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <View style={[styles.orLine, { backgroundColor: theme.colors.border }]} />
      <AppText variant="captionStrong" color="textMuted">
        {label}
      </AppText>
      <View style={[styles.orLine, { backgroundColor: theme.colors.border }]} />
    </View>
  );
}

function InlineLink({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="link"
      accessibilityLabel={label}
      hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
      style={({ pressed }) => [styles.inlineLink, { opacity: pressed ? 0.6 : 1 }]}
    >
      <AppText variant="captionStrong" color="link" style={styles.underline}>
        {label}
      </AppText>
    </Pressable>
  );
}

/** "Al continuar aceptas las Condiciones de uso y la Política de privacidad" con ambos enlaces pulsables. */
export function LegalConsent({ onTerms, onPrivacy }: { onTerms: () => void; onPrivacy: () => void }) {
  const theme = useAppTheme();
  return (
    <View style={[styles.consent, { marginTop: theme.spacing.lg }]}>
      <AppText variant="caption" color="textSecondary">
        Al continuar aceptas las
      </AppText>
      <InlineLink label="Condiciones de uso" onPress={onTerms} />
      <AppText variant="caption" color="textSecondary">
        y la
      </AppText>
      <InlineLink label="Política de privacidad" onPress={onPrivacy} />
    </View>
  );
}

const styles = StyleSheet.create({
  or: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  orLine: { flex: 1, height: StyleSheet.hairlineWidth * 2 },
  consent: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center', columnGap: 4 },
  inlineLink: { minHeight: 32, justifyContent: 'center' },
  underline: { textDecorationLine: 'underline' },
});
