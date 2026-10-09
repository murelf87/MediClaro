/**
 * Cliente Supabase (capa de infraestructura).
 *
 * ⚠️  Solo lo importan los servicios de src/services y src/api.
 *     Los componentes y pantallas NUNCA deben importar este archivo.
 *
 * Configuración (valores públicos, NO secretos):
 *   - EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY (recomendado), o
 *   - app.json → expo.extra.supabaseUrl / supabaseAnonKey
 * La "anon key" es pública por diseño; la seguridad la aplica RLS en el backend.
 * La service_role key JAMÁS debe estar en la app.
 */
import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import { secureTextStorage } from './secureChunkedStorage';
import Constants from 'expo-constants';

// ─── Almacenamiento de la sesión ──────────────────────────────────────────────
// iOS / Android: llavero / Keystore cifrado (expo-secure-store), troceado en
// fragmentos de < 2 KB (ver src/lib/secureChunkedStorage.ts).

// ─── Configuración pública ────────────────────────────────────────────────────

const extra = (Constants.expoConfig?.extra ?? {}) as { supabaseUrl?: string; supabaseAnonKey?: string };

// `||` (no `??`): una variable vacía en .env no debe anular la de app.json
export const SUPABASE_URL: string = process.env.EXPO_PUBLIC_SUPABASE_URL || extra.supabaseUrl || '';
export const SUPABASE_ANON_KEY: string = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || extra.supabaseAnonKey || '';

/** ¿Está configurado el proyecto de Supabase? (evita llamadas a una URL de ejemplo) */
export const isBackendConfigured =
  /^https:\/\/[^\s]+$/.test(SUPABASE_URL) && !SUPABASE_URL.includes('TU-PROYECTO') &&
  SUPABASE_ANON_KEY.length > 20 && !SUPABASE_ANON_KEY.includes('TU_ANON_KEY');

// @qa-real-client-start
const realClient = createClient(SUPABASE_URL || 'https://not-configured.supabase.co', SUPABASE_ANON_KEY || 'not-configured', {
  auth: {
    storage: secureTextStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
// @qa-real-client-end

type SupabaseLike = typeof realClient;

// ─── Cliente activo (real o demostración) ─────────────────────────────────────
// El "Modo demostración" (botón "Entrar sin verificar") sustituye el cliente real
// por un backend simulado en memoria. Los servicios usan siempre `supabase`,
// que delega en el cliente activo en cada llamada.

let activeClient: SupabaseLike = realClient;
let demoActive = false;
const clientListeners = new Set<() => void>();

export function switchToDemoClient(client: unknown): void {
  activeClient = client as SupabaseLike;
  demoActive = true;
  clientListeners.forEach((l) => l());
}

export function switchToRealClient(): void {
  activeClient = realClient;
  demoActive = false;
  clientListeners.forEach((l) => l());
}

export function isDemoClientActive(): boolean {
  return demoActive;
}

/** Aviso cuando cambia el cliente activo (entrar/salir del modo demostración). */
export function onActiveClientChange(listener: () => void): () => void {
  clientListeners.add(listener);
  return () => {
    clientListeners.delete(listener);
  };
}

export const supabase: SupabaseLike = new Proxy({} as SupabaseLike, {
  get(_target, prop) {
    const current = activeClient as unknown as Record<PropertyKey, unknown>;
    const value = current[prop];
    return typeof value === 'function' ? (value as (...a: unknown[]) => unknown).bind(activeClient) : value;
  },
});
