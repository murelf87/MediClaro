/**
 * AuthService — acceso con TELÉFONO + CÓDIGO SMS.
 *
 * Usa Supabase Auth (Phone OTP). El envío del SMS lo hace el proveedor
 * configurado en el backend (p. ej. Twilio): la app NUNCA contiene credenciales
 * del proveedor. Requisitos de backend en BACKEND_REQUIREMENTS.md → "Auth por SMS".
 */
import { AppState, Platform, type AppStateStatus } from 'react-native';
import { supabase, AppError, assertBackendConfigured, isBackendConfigured, isDemoClientActive, toAppError } from '../api';
import { onActiveClientChange } from '../lib/supabase';
import { DemoMode } from './DemoMode';
import { TestAccess } from './TestAccess';
import { QA_ACCESS_TOKEN } from '../config/app';
import type { AccessMode, AuthSession } from '../types';

interface AuthLikeError {
  message?: string;
  code?: string;
  status?: number;
  name?: string;
}

/** Traduce los errores de Supabase Auth a mensajes claros. */
export function mapAuthError(e: unknown, stage: 'request' | 'verify'): AppError {
  if (e instanceof AppError) return e;
  const err = (e ?? {}) as AuthLikeError;
  const code = err.code ?? '';
  const msg = err.message ?? '';

  if (err.name === 'AuthRetryableFetchError' || /fetch|network/i.test(msg)) {
    return new AppError('offline', 'No hay conexión a internet. Compruébala e inténtalo de nuevo.');
  }
  if (code === 'phone_provider_disabled' || /unsupported phone provider|phone.*(disabled|not enabled)/i.test(msg)) {
    return new AppError('not_configured', 'El acceso por SMS todavía no está activado. Inténtalo más tarde.', { code: 'phone_provider_disabled' });
  }
  if (code === 'over_sms_send_rate_limit' || code === 'over_request_rate_limit' || err.status === 429 || /rate limit|security purposes/i.test(msg)) {
    return new AppError(
      'rate_limited',
      stage === 'request'
        ? 'Has pedido varios códigos seguidos. Espera un momento antes de pedir otro.'
        : 'Demasiados intentos. Espera un momento y vuelve a probar.',
      { code: code || 'rate_limited' },
    );
  }
  if (code === 'sms_send_failed' || /sms.*(send|failed)|error sending/i.test(msg)) {
    return new AppError('provider_down', 'No hemos podido enviar el SMS. Comprueba el número e inténtalo de nuevo.', { code: 'sms_send_failed' });
  }
  if (code === 'validation_failed' || /invalid phone|phone number format|invalid format/i.test(msg)) {
    return new AppError('invalid_input', 'El número de teléfono no es válido.', { code: 'invalid_phone' });
  }
  if (code === 'otp_expired' || /expired|invalid.*(otp|token)|token has expired/i.test(msg)) {
    return new AppError('invalid_input', 'El código no es correcto o ha caducado.', { code: 'otp_invalid' });
  }
  if (code === 'signup_disabled' || /signups not allowed/i.test(msg)) {
    return new AppError('not_configured', 'Ahora mismo no se pueden crear cuentas nuevas.', { code: 'signup_disabled' });
  }
  return toAppError(e);
}

type RawSession = { user: { id: string; phone?: string | null; email?: string | null; is_anonymous?: boolean } } | null;

function toAuthSession(session: RawSession): AuthSession | null {
  if (!session) return null;
  const phone = session.user.phone ? (session.user.phone.startsWith('+') ? session.user.phone : `+${session.user.phone}`) : null;
  const mode: AccessMode = isDemoClientActive() ? 'demo' : session.user.is_anonymous ? 'anonymous' : 'verified';
  return { userId: session.user.id, phone, email: session.user.email ?? null, mode };
}

export const AuthService = {
  /** Envía un código de 6 dígitos por SMS al número (formato E.164, p. ej. +34600123456). */
  async requestOtp(phoneE164: string): Promise<void> {
    assertBackendConfigured();
    try {
      const { error } = await supabase.auth.signInWithOtp({
        phone: phoneE164,
        options: { shouldCreateUser: true, channel: 'sms' },
      });
      if (error) throw error;
    } catch (e) {
      throw mapAuthError(e, 'request');
    }
  },

  /** Verifica el código. Devuelve la sesión creada. */
  async verifyOtp(phoneE164: string, code: string): Promise<AuthSession> {
    assertBackendConfigured();
    const token = code.replace(/\D+/g, '');
    if (token.length !== 6) throw new AppError('invalid_input', 'El código tiene 6 cifras.');
    try {
      const { data, error } = await supabase.auth.verifyOtp({ phone: phoneE164, token, type: 'sms' });
      if (error) throw error;
      const session = toAuthSession(data.session as RawSession);
      if (!session) throw new AppError('unknown', 'No hemos podido iniciar la sesión. Inténtalo de nuevo.');
      return session;
    } catch (e) {
      throw mapAuthError(e, 'verify');
    }
  },

  /**
   * ACCESO SIN VERIFICAR (temporal, pedido por el propietario).
   * 1) Con servidor conectado y accesos anónimos permitidos → sesión real de prueba.
   * 2) Si no → Modo demostración con datos de ejemplo.
   * No disponible en compilaciones de tienda (DEMO_ACCESS_ENABLED).
   */
  async enterWithoutVerification(): Promise<'anonymous' | 'demo'> {
    if (!DemoMode.available()) throw new AppError('not_available', 'Esta opción no está disponible.');

    // Build interna: cuando existe el token QA usamos el backend REAL con una cuenta anónima
    // Premium temporal. Así se pueden probar de verdad IA, cámara, CIMA/AEMPS y voz sin cobrar.
    if (isBackendConfigured && QA_ACCESS_TOKEN) {
      try {
        if (DemoMode.isActive()) await DemoMode.disable();
        await TestAccess.clear();
        const { data, error } = await supabase.auth.signInAnonymously();
        if (error) throw error;
        if (!data.session) throw new AppError('unknown', 'No hemos podido iniciar el acceso de prueba.');
        const { error: qaError } = await supabase.functions.invoke('qa-access', {
          body: {},
          headers: { 'x-qa-access': QA_ACCESS_TOKEN },
        });
        if (qaError) throw qaError;
        await TestAccess.mark();
        return 'anonymous';
      } catch (e) {
        await supabase.auth.signOut().catch(() => undefined);
        await TestAccess.clear();
        throw toAppError(e);
      }
    }

    // Si no hay backend/token QA se mantiene el modo simulado para revisar interfaz, con Premium activo
    // (igual que el acceso de prueba real) para que se vean también las funciones Premium.
    await TestAccess.clear();
    await DemoMode.enable({ premium: true });
    return 'demo';
  },

  /**
   * Cuenta para pagar SIN pedir el teléfono antes del pago.
   * - Con sesión: la de siempre.
   * - Sin sesión: cuenta sin teléfono (acceso anónimo de Supabase). El teléfono se añade DESPUÉS del pago
   *   («Completa tu cuenta» → requestPhoneLink/verifyPhoneLink) y la cuenta pasa a ser permanente.
   *   Requiere «Allow anonymous sign-ins» en Supabase Auth (BACKEND_REQUIREMENTS.md → R-21). Si está
   *   desactivado se lanza AppError('not_configured', code 'anonymous_disabled') y se detiene la compra
   *   sin pedir el teléfono ni realizar cargos. La verificación pertenece al paso posterior al pago.
   * - Modo demostración (compilaciones de prueba sin servidor): cuenta de demostración sin teléfono.
   */
  async ensureAccount(): Promise<AuthSession> {
    const existing = await AuthService.getSession();
    if (existing) return existing;
    // Servidor real, o backend simulado ya activo (QA y compilaciones de prueba sin servidor).
    if (isBackendConfigured || isDemoClientActive()) {
      try {
        const { data, error } = await supabase.auth.signInAnonymously();
        if (error) throw error;
        const session = toAuthSession(data.session as RawSession);
        if (!session) throw new AppError('unknown');
        return session;
      } catch (e) {
        const err = (e ?? {}) as AuthLikeError;
        if (err.code === 'anonymous_provider_disabled' || /anonymous sign-ins are disabled/i.test(err.message ?? '')) {
          throw new AppError('not_configured', 'Ahora mismo no podemos crear tu cuenta sin el teléfono.', { code: 'anonymous_disabled' });
        }
        throw mapAuthError(e, 'request');
      }
    }
    if (DemoMode.available()) {
      await DemoMode.enable({ anonymous: true });
      const session = await AuthService.getSession();
      if (session) return session;
    }
    throw new AppError('not_configured', 'La aplicación todavía no está conectada al servidor de MediClaro.');
  },

  /** Añade un teléfono a la cuenta (tras el pago): envía el código por SMS al número nuevo. */
  async requestPhoneLink(phoneE164: string): Promise<void> {
    assertBackendConfigured();
    try {
      const { error } = await supabase.auth.updateUser({ phone: phoneE164 });
      if (error) throw error;
    } catch (e) {
      const err = (e ?? {}) as AuthLikeError;
      if (err.code === 'phone_exists' || /already (been )?registered|phone.*exists/i.test(err.message ?? '')) {
        throw new AppError('conflict', 'Este número ya tiene una cuenta de MediClaro.', { code: 'phone_exists' });
      }
      throw mapAuthError(e, 'request');
    }
  },

  /** Confirma el código del SMS y deja el teléfono vinculado a la cuenta. */
  async verifyPhoneLink(phoneE164: string, code: string): Promise<AuthSession> {
    assertBackendConfigured();
    const token = code.replace(/\D+/g, '');
    if (token.length !== 6) throw new AppError('invalid_input', 'El código tiene 6 cifras.');
    try {
      const { data, error } = await supabase.auth.verifyOtp({ phone: phoneE164, token, type: 'phone_change' });
      if (error) throw error;
      const session = toAuthSession((data.session ?? (await supabase.auth.getSession()).data.session) as RawSession);
      if (!session) throw new AppError('unknown', 'No hemos podido guardar tu teléfono. Inténtalo de nuevo.');
      return session;
    } catch (e) {
      throw mapAuthError(e, 'verify');
    }
  },

  async logout(): Promise<void> {
    await TestAccess.clear();
    if (DemoMode.isActive()) {
      await supabase.auth.signOut().catch(() => undefined);
      await DemoMode.disable();
      // Compilaciones de prueba sin servidor: se vuelve al backend simulado sin sesión.
      await DemoMode.startWithoutServer();
      return;
    }
    try {
      await supabase.auth.signOut();
    } catch {
      // Si falla la red, cerramos igualmente la sesión local
      await supabase.auth.signOut({ scope: 'local' }).catch(() => undefined);
    }
  },

  async getSession(): Promise<AuthSession | null> {
    try {
      const { data } = await supabase.auth.getSession();
      return toAuthSession(data.session as RawSession);
    } catch {
      return null;
    }
  },

  /**
   * Suscripción a cambios de sesión (también al entrar/salir del modo demostración).
   * Devuelve la función para cancelar.
   */
  onAuthStateChange(listener: (session: AuthSession | null) => void): () => void {
    const subscribe = () => {
      const { data } = supabase.auth.onAuthStateChange((_event, session) => listener(toAuthSession(session as RawSession)));
      return () => data.subscription.unsubscribe();
    };
    let unsubscribe = subscribe();
    const offClientChange = onActiveClientChange(() => {
      unsubscribe();
      unsubscribe = subscribe();
      void AuthService.getSession().then(listener);
    });
    return () => {
      unsubscribe();
      offClientChange();
    };
  },

  /**
   * Refresco automático del token solo con la app en primer plano
   * (recomendación de Supabase para React Native).
   */
  bindAutoRefreshToAppState(): () => void {
    if (Platform.OS === 'web') return () => undefined;
    const handler = (state: AppStateStatus) => {
      if (state === 'active') supabase.auth.startAutoRefresh();
      else supabase.auth.stopAutoRefresh();
    };
    handler(AppState.currentState);
    const sub = AppState.addEventListener('change', handler);
    return () => sub.remove();
  },
};
