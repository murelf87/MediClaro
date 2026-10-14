/**
 * Normalización de errores.
 * Cualquier fallo (red, Supabase, Edge Functions, permisos) se convierte en un
 * AppError con un `kind` estable y un mensaje en español claro para la persona.
 */
import type { AppErrorKind } from '../types';

export const DEFAULT_MESSAGES: Record<AppErrorKind, string> = {
  offline: 'No hay conexión a internet. Compruébala e inténtalo de nuevo.',
  timeout: 'La conexión está tardando demasiado. Inténtalo de nuevo.',
  unauthorized: 'Tu sesión ha caducado. Vuelve a entrar con tu teléfono.',
  limit_reached: 'Has llegado al límite de tu plan.',
  rate_limited: 'Demasiados intentos seguidos. Espera un momento.',
  provider_down: 'El servicio no está disponible ahora mismo. Inténtalo en unos minutos.',
  not_found: 'No hemos encontrado lo que buscas.',
  conflict: 'Esta acción ya no es necesaria.',
  invalid_input: 'Revisa los datos introducidos.',
  not_configured: 'Esta función todavía no está activada.',
  not_available: 'Esta función no está disponible en este dispositivo.',
  permission_denied: 'Necesitamos tu permiso para continuar.',
  cancelled: 'Operación cancelada.',
  unknown: 'Ha ocurrido un error. Inténtalo de nuevo.',
};

const RETRYABLE: AppErrorKind[] = ['offline', 'timeout', 'rate_limited', 'provider_down', 'unknown'];

export class AppError extends Error {
  readonly kind: AppErrorKind;
  readonly status?: number;
  readonly code?: string;
  readonly retryable: boolean;

  constructor(kind: AppErrorKind, message?: string, opts?: { status?: number; code?: string; cause?: unknown }) {
    super(message && message.trim() ? message : DEFAULT_MESSAGES[kind]);
    this.name = 'AppError';
    this.kind = kind;
    this.status = opts?.status;
    this.code = opts?.code;
    this.retryable = RETRYABLE.includes(kind);
  }
}

export function isAppError(e: unknown): e is AppError {
  return e instanceof AppError;
}

function looksOffline(message: string): boolean {
  return /network request failed|failed to fetch|networkerror|network error|load failed|internet|offline|ENOTFOUND|ECONNREFUSED/i.test(message);
}

/** Convierte cualquier valor lanzado en un AppError. */
export function toAppError(e: unknown, fallbackKind: AppErrorKind = 'unknown'): AppError {
  if (e instanceof AppError) return e;
  if (e && typeof e === 'object') {
    const anyE = e as { name?: string; message?: string; status?: number; code?: string };
    const message = String(anyE.message ?? '');
    if (anyE.name === 'AbortError' || /aborted|timeout/i.test(message)) {
      return new AppError('timeout', undefined, { cause: e });
    }
    if (looksOffline(message)) return new AppError('offline', undefined, { cause: e });
    if (anyE.status === 401) return new AppError('unauthorized', undefined, { status: 401 });
  }
  return new AppError(fallbackKind, undefined, { cause: e });
}

/**
 * Código con el que el servidor indica que una función con IA es solo de Premium (BACKEND_REQUIREMENTS → R-24).
 * Se trata como un límite del plan (nunca como sesión caducada, aunque llegue con 403).
 */
export const PREMIUM_REQUIRED_CODE = 'PREMIUM_REQUIRED';

/** Clasifica una respuesta HTTP de Edge Function. */
export function kindFromHttp(status: number, code?: string): AppErrorKind {
  if (code === 'LIMIT_REACHED' || code === 'CHAT_LIMIT' || code === PREMIUM_REQUIRED_CODE) return 'limit_reached';
  if (code === 'PROVIDER_DOWN' || code === 'AI_DOWN') return 'provider_down';
  if (status === 400 || status === 413 || status === 422) return 'invalid_input';
  if (status === 401 || status === 403) return 'unauthorized';
  if (status === 402) return 'limit_reached';
  if (status === 404) return 'not_found';
  if (status === 409) return 'conflict';
  if (status === 429) return 'rate_limited';
  if (status === 503) return 'provider_down';
  return 'unknown';
}
