/**
 * Llamadas a Edge Functions del backend.
 * Solo la usan los servicios. Añade timeout y normaliza errores.
 */
import { supabase, isBackendConfigured, isDemoClientActive } from '../lib/supabase';
import { AppError, DEFAULT_MESSAGES, kindFromHttp, toAppError } from './errors';
import type { AppErrorKind } from '../types';

/**
 * Los mensajes del backend usan "usted"; la app tutea. Se traducen los conocidos
 * para que el tono sea el mismo en toda la app.
 */
const MESSAGE_BY_CODE: Record<string, string> = {
  LIMIT_REACHED: 'Has llegado al límite de identificaciones de este mes.',
  CHAT_LIMIT: 'Has llegado al límite de preguntas de hoy. Mañana podrás seguir.',
  PREMIUM_REQUIRED: 'Esta función es de MediClaro Premium.',
  PROVIDER_DOWN: 'Ahora mismo no podemos consultar la información oficial. Inténtalo de nuevo en unos minutos.',
  AI_DOWN: 'El asistente no está disponible ahora mismo. Inténtalo de nuevo en unos minutos.',
  TTS_DOWN: 'La voz natural no está disponible ahora mismo. Inténtalo de nuevo en unos minutos.',
  TTS_TOO_LONG: 'Este texto es demasiado largo para leerlo de una vez.',
};

const MESSAGE_BY_TEXT: Record<string, string> = {
  'Sesión caducada. Vuelva a entrar.': 'Tu sesión ha caducado. Vuelve a entrar.',
  'Demasiadas peticiones. Espere un momento.': 'Demasiados intentos seguidos. Espera un momento.',
  'Ha ocurrido un error. Inténtelo de nuevo.': 'Ha ocurrido un error. Inténtalo de nuevo.',
  'Escriba una pregunta': 'Escribe una pregunta.',
  'Falta la foto o el código': 'Falta la foto o el código del medicamento.',
  'La foto es demasiado grande': 'La foto es demasiado grande. Inténtalo de nuevo.',
  'Petición demasiado grande': 'La foto es demasiado grande. Inténtalo de nuevo.',
  'Ya tiene una suscripción activa.': 'Ya tienes una suscripción activa.',
  'No tiene ninguna suscripción.': 'No tienes ninguna suscripción.',
  'URL de retorno no válida': 'No se ha podido preparar el pago. Inténtalo de nuevo.',
  'Método no permitido': 'Ha ocurrido un error. Inténtalo de nuevo.',
  'Medicamento no válido': 'Medicamento no válido.',
  'No encontrado en la base oficial': 'No encontramos este medicamento en la base oficial.',
  'Confirmación no válida': 'No se ha podido confirmar la eliminación. Inténtalo de nuevo.',
  'Acción no válida': 'Ha ocurrido un error. Inténtalo de nuevo.',
  'Requested function was not found': 'Esta función todavía no está activada.',
};

function localizeMessage(kind: AppErrorKind, code: string | undefined, message: string | undefined): string {
  if (code && MESSAGE_BY_CODE[code]) return MESSAGE_BY_CODE[code];
  const known = message ? MESSAGE_BY_TEXT[message.trim()] : undefined;
  if (known) return known;
  // Mensajes desconocidos del servidor en errores genéricos → texto propio
  if (!message || kind === 'unknown' || kind === 'unauthorized' || kind === 'rate_limited') return DEFAULT_MESSAGES[kind];
  return message;
}

export type EdgeFunctionName =
  | 'identify-medicine'
  | 'medicine-detail'
  | 'chat'
  | 'tts'
  | 'tts-preview'
  | 'voice-transcribe'
  | 'account'
  | 'create-checkout'
  | 'customer-portal'
  | 'emergency-assess'
  | 'emergency-contact'
  | 'emergency-contact-status'
  /** Comprueba en el servidor una compra de Apple o Google y activa Premium (BACKEND_REQUIREMENTS → R-04). */
  | 'iap-verify'
  /** «Que pague mi familiar o cuidador/a»: crea el enlace de pago (migración 20261009100000). */
  | 'family-pay'
  /** Credenciales temporales para las llamadas de voz por internet entre paciente y cuidador/a. */
  | 'caregiver-rtc-config';

const DEFAULT_TIMEOUT_MS = 30_000;

interface HttpErrorContext {
  status?: number;
  json?: () => Promise<unknown>;
  text?: () => Promise<string>;
}

export function assertBackendConfigured(): void {
  if (!isBackendConfigured && !isDemoClientActive()) {
    throw new AppError(
      'not_configured',
      'La aplicación todavía no está conectada al servidor de MediClaro.',
    );
  }
}

export async function invokeFunction<T>(
  name: EdgeFunctionName,
  body: Record<string, unknown>,
  opts?: { timeoutMs?: number },
): Promise<T> {
  assertBackendConfigured();
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timeoutMs = opts?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  // El tiempo máximo se cumple SIEMPRE: aunque el cliente ignore la cancelación, la espera termina (nunca se queda
  // «enviando» para siempre, p. ej. el asistente sin dejar escribir otra pregunta).
  let expire: ((e: unknown) => void) | null = null;
  const expired = new Promise<never>((_, reject) => {
    expire = reject;
  });
  const timer = setTimeout(() => {
    controller?.abort();
    expire?.(new AppError('timeout'));
  }, timeoutMs);

  try {
    const { data, error } = await Promise.race([
      supabase.functions.invoke(name, {
        body,
        ...(controller ? { signal: controller.signal } : null),
      }),
      expired,
    ]);

    if (error) {
      const errName = (error as { name?: string }).name ?? '';
      if (errName === 'FunctionsHttpError') {
        const ctx = (error as { context?: HttpErrorContext }).context;
        const status = ctx?.status ?? 500;
        let message: string | undefined;
        let code: string | undefined;
        try {
          const parsed = (await ctx?.json?.()) as { error?: unknown; code?: unknown } | undefined;
          if (parsed && typeof parsed.error === 'string') message = parsed.error;
          if (parsed && typeof parsed.code === 'string') code = parsed.code;
        } catch {
          // Cuerpo no JSON: usamos el mensaje por defecto del tipo de error
        }
        const kind = kindFromHttp(status, code);
        throw new AppError(kind, localizeMessage(kind, code, message), { status, code });
      }
      if (errName === 'FunctionsFetchError' || errName === 'FunctionsRelayError') {
        throw toAppError((error as { context?: unknown }).context ?? error, 'offline');
      }
      throw toAppError(error);
    }
    return data as T;
  } catch (e) {
    throw toAppError(e);
  } finally {
    clearTimeout(timer);
  }
}
