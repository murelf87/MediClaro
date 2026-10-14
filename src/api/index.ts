/**
 * Capa API — acceso de bajo nivel al backend.
 * Uso exclusivo de src/services. Las pantallas importan servicios/hooks, nunca esto.
 */
import { supabase } from '../lib/supabase';
import { AppError, toAppError } from './errors';
import { assertBackendConfigured } from './functions';

export { supabase, isBackendConfigured, isDemoClientActive } from '../lib/supabase';
export { invokeFunction, assertBackendConfigured, type EdgeFunctionName } from './functions';
export { AppError, toAppError, isAppError, DEFAULT_MESSAGES, PREMIUM_REQUIRED_CODE } from './errors';

/** Id del usuario con sesión (lectura local, sin red). Lanza `unauthorized` si no hay sesión. */
export async function requireUserId(): Promise<string> {
  assertBackendConfigured();
  const { data } = await supabase.auth.getSession();
  const id = data.session?.user.id;
  if (!id) throw new AppError('unauthorized');
  return id;
}

/** Convierte un error de PostgREST/Supabase en AppError. */
export function dbError(error: { message?: string; code?: string; status?: number } | null | undefined): AppError {
  if (!error) return new AppError('unknown');
  const msg = error.message ?? '';
  if (error.code === 'PGRST301' || /JWT|not authenticated/i.test(msg)) {
    return new AppError('unauthorized', undefined, { code: error.code });
  }
  if (/fetch|network|Failed to fetch|Network request failed/i.test(msg)) return new AppError('offline');
  return toAppError(error);
}
