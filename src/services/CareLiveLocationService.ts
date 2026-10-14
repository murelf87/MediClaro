/**
 * Ubicación en directo desde el chat de cuidado (migración 20261014191000_care_live_location.sql).
 *
 *  - Solo la persona con Premium la comparte, el tiempo que ella elige (15 min, 1 h o 8 h), y puede pararla cuando quiera.
 *  - La persona cuidadora la ve mientras está activa. Al caducar o parar, el servidor borra las coordenadas.
 *  - El envío se hace con la app abierta (también si cambia de pantalla). Con el móvil bloqueado depende del sistema:
 *    seguir con la pantalla apagada necesita la tarea nativa de ubicación (como en los avisos de emergencia).
 */
import * as Location from 'expo-location';
import { supabase } from '../lib/supabase';

export const LIVE_DURATIONS = [
  { minutes: 15, label: '15 minutos' },
  { minutes: 60, label: '1 hora' },
  { minutes: 480, label: '8 horas' },
] as const;

export interface LiveLocation {
  active: boolean;
  mine: boolean;
  expiresAt: string | null;
  latitude: number | null;
  longitude: number | null;
  updatedAt: string | null;
}
const NONE: LiveLocation = { active: false, mine: false, expiresAt: null, latitude: null, longitude: null, updatedAt: null };

const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const text = (v: unknown): string | null => (typeof v === 'string' && v ? v : null);

export function parseLive(v: unknown): LiveLocation {
  const o = v && typeof v === 'object' ? (v as Record<string, unknown>) : {};
  if (o.active !== true) return NONE;
  return {
    active: true,
    mine: o.mine === true,
    expiresAt: text(o.expiresAt),
    latitude: num(o.latitude),
    longitude: num(o.longitude),
    updatedAt: text(o.updatedAt),
  };
}

const MESSAGES: Record<string, string> = {
  PREMIUM_REQUIRED: 'Compartir la ubicación necesita MediClaro Premium activo.',
  PATIENT_ONLY: 'Solo la persona cuidada puede compartir su ubicación.',
  NOT_ALLOWED: 'Esta conversación ya no está disponible.',
  RATE_LIMIT: 'Demasiados intentos seguidos. Espera un momento.',
};
export function liveErrorMessage(e: unknown): string {
  const raw = String((e as { message?: unknown })?.message ?? '');
  const code = Object.keys(MESSAGES).find(k => raw.includes(k));
  return code ? MESSAGES[code] : 'No se ha podido completar. Inténtalo de nuevo.';
}

async function rpc(action: 'start' | 'update' | 'stop' | 'get', payload: Record<string, unknown>): Promise<unknown> {
  const { data, error } = await supabase.rpc('care_live_location_action', { p_action: action, p_payload: payload });
  if (error) throw error;
  return data;
}

export async function getLiveLocation(linkId: string): Promise<LiveLocation> {
  return parseLive(await rpc('get', { linkId }));
}

let watcher: Location.LocationSubscription | null = null;
let watchedLink: string | null = null;
let sentAt = 0;
const MIN_INTERVAL_MS = 10_000;

export async function stopSharing(linkId: string): Promise<void> {
  if (watchedLink === linkId) {
    watcher?.remove();
    watcher = null;
    watchedLink = null;
  }
  await rpc('stop', { linkId });
}

function stopWatching(): void {
  watcher?.remove();
  watcher = null;
  watchedLink = null;
}

/** Empieza (o reanuda) el envío de posiciones para un vínculo con la ubicación ya activa en el servidor. */
export async function resumeSending(linkId: string): Promise<void> {
  if (watchedLink === linkId && watcher) return;
  stopWatching();
  watchedLink = linkId;
  watcher = await Location.watchPositionAsync(
    { accuracy: Location.Accuracy.Balanced, distanceInterval: 15, timeInterval: MIN_INTERVAL_MS },
    pos => {
      const now = Date.now();
      if (now - sentAt < MIN_INTERVAL_MS) return;
      sentAt = now;
      void rpc('update', {
        linkId,
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
        accuracy: pos.coords.accuracy ?? null,
      })
        .then(r => {
          if ((r as { active?: unknown } | null)?.active === false) stopWatching();
        })
        .catch(() => undefined); // sin conexión: se reintenta con la siguiente posición
    },
  );
}

/** Pide permiso, activa el uso compartido en el servidor y empieza a enviar. */
export async function startSharing(linkId: string, minutes: number): Promise<LiveLocation> {
  const perm = await Location.requestForegroundPermissionsAsync();
  if (perm.status !== 'granted') throw new Error('LOCATION_DENIED');
  const live = parseLive(await rpc('start', { linkId, minutes }));
  await resumeSending(linkId);
  return live;
}
