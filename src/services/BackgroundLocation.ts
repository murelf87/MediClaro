/**
 * Ubicación con el móvil bloqueado durante un aviso al cuidador/a (11/10/2026).
 *
 *  - Solo mientras hay un aviso ACTIVO de la propia persona y ella ha permitido compartir su ubicación.
 *  - Se arranca con la app abierta (al empezar el aviso) y sigue aunque se bloquee la pantalla:
 *      · iPhone: modo de fondo «location» con el indicador azul; basta el permiso «Al usar la app» (no se pide «Siempre»).
 *      · Android: servicio en primer plano con una notificación fija («Compartiendo tu ubicación mientras dura el
 *        aviso»); tampoco necesita el permiso de ubicación en segundo plano.
 *  - Se para sola cuando el aviso termina o caduca (el servidor responde INCIDENT_CLOSED), cuando la persona retira el
 *    permiso de compartir la ubicación, y al cerrar sesión.
 *  - En Expo Go, en la web y en compilaciones sin el módulo nativo no hace nada: se sigue enviando la ubicación con la
 *    app abierta (CaregiverHost), como hasta ahora.
 */
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Location from 'expo-location';
import { supabase } from '../lib/supabase';
import { localStore } from '../api/storage';

export const CARE_LOCATION_TASK = 'mediclaro-care-location';
const KEY = 'mediclaro_care_location_v1';
/** Como mucho una posición cada 9 s (el servidor admite 30 por minuto). */
const MIN_INTERVAL_MS = 9_000;

type TaskManagerModule = typeof import('expo-task-manager');
let TaskManager: TaskManagerModule | null = null;
try {
  // Carga perezosa: una compilación sin el módulo nativo no debe romperse al abrir la app.
  TaskManager = Platform.OS === 'web' ? null : (require('expo-task-manager') as TaskManagerModule);
} catch {
  TaskManager = null;
}

export interface SharedIncident {
  incidentId: string;
  expiresAt: string;
}

let active: SharedIncident | null = null;
let lastSentAt = 0;
let orphanChecked = false;

async function current(): Promise<SharedIncident | null> {
  if (active) return active;
  const stored = await localStore.getJSON<SharedIncident | null>(KEY, null);
  if (stored && typeof stored.incidentId === 'string' && typeof stored.expiresAt === 'string') active = stored;
  return active;
}

/**
 * Envía una posición del aviso. Devuelve false si hay que dejar de compartir: el aviso ha terminado o caducado, la
 * persona ya no tiene acceso, o ha retirado el permiso de compartir su ubicación. Sin conexión devuelve true (se
 * reintenta con la siguiente posición).
 */
export async function sendCareLocation(
  incident: SharedIncident,
  coords: { latitude: number; longitude: number; accuracy: number | null },
  now = Date.now(),
): Promise<boolean> {
  if (!(Date.parse(incident.expiresAt) > now)) return false;
  const { data, error } = await supabase.rpc('caregiver_action', {
    p_action: 'location',
    p_payload: { incidentId: incident.incidentId, latitude: coords.latitude, longitude: coords.longitude, accuracy: coords.accuracy },
  });
  if (error) {
    const message = String(error.message ?? '');
    return !/INCIDENT_CLOSED|NOT_ALLOWED|PATIENT_ONLY|AUTH_REQUIRED/.test(message);
  }
  return (data as { shared?: unknown } | null)?.shared !== false;
}

/** Para las actualizaciones del sistema y olvida el aviso guardado. */
async function stopUpdates(): Promise<void> {
  active = null;
  await localStore.remove(KEY);
  try {
    if (TaskManager && (await Location.hasStartedLocationUpdatesAsync(CARE_LOCATION_TASK))) {
      await Location.stopLocationUpdatesAsync(CARE_LOCATION_TASK);
    }
  } catch {
    // Sin el módulo nativo no hay nada que parar.
  }
}

/** Lo que hace el sistema con cada lote de posiciones (también con la pantalla bloqueada). */
export async function handleLocations(locations: Location.LocationObject[] | undefined, now = Date.now()): Promise<void> {
  const last = locations?.[locations.length - 1];
  if (!last) return;
  const incident = await current();
  if (!incident) {
    // Llegan posiciones sin aviso guardado (p. ej. tras cerrar sesión o un cierre inesperado): se para del todo.
    await stopUpdates();
    return;
  }
  if (now - lastSentAt < MIN_INTERVAL_MS) return;
  lastSentAt = now;
  const keep = await sendCareLocation(
    incident,
    { latitude: last.coords.latitude, longitude: last.coords.longitude, accuracy: last.coords.accuracy ?? null },
    now,
  ).catch(() => true);
  if (!keep) await stopUpdates();
}

// La tarea tiene que definirse al cargar la app (también cuando el sistema la despierta para darle posiciones).
if (TaskManager) {
  try {
    TaskManager.defineTask<{ locations?: Location.LocationObject[] }>(CARE_LOCATION_TASK, async ({ data, error }) => {
      if (error) return;
      await handleLocations(data?.locations);
    });
  } catch {
    TaskManager = null;
  }
}

export const BackgroundLocation = {
  /** ¿Este móvil puede seguir compartiendo con la pantalla bloqueada? (no en Expo Go ni en la web) */
  async supported(): Promise<boolean> {
    if (!TaskManager || Platform.OS === 'web' || Constants.executionEnvironment === 'storeClient') return false;
    try {
      return await TaskManager.isAvailableAsync();
    } catch {
      return false;
    }
  },

  /** ¿Ya se está compartiendo ESTE aviso con la pantalla bloqueada? */
  async isRunningFor(incidentId: string): Promise<boolean> {
    const incident = await current();
    if (!incident || incident.incidentId !== incidentId) return false;
    try {
      return await Location.hasStartedLocationUpdatesAsync(CARE_LOCATION_TASK);
    } catch {
      return false;
    }
  },

  /**
   * Empieza a compartir (hay que llamarlo con la app abierta). Devuelve false si no se puede; entonces CaregiverHost
   * envía la ubicación solo con la app abierta.
   */
  async start(incidentId: string, expiresAt: string): Promise<boolean> {
    if (!(await BackgroundLocation.supported())) return false;
    if (await BackgroundLocation.isRunningFor(incidentId)) return true;
    try {
      if ((await Location.getForegroundPermissionsAsync()).status !== 'granted') return false;
      active = { incidentId, expiresAt };
      lastSentAt = 0;
      await localStore.setJSON(KEY, active);
      await Location.startLocationUpdatesAsync(CARE_LOCATION_TASK, {
        accuracy: Location.Accuracy.High,
        timeInterval: 10_000,
        distanceInterval: 10,
        showsBackgroundLocationIndicator: true,
        pausesUpdatesAutomatically: false,
        activityType: Location.ActivityType.Other,
        foregroundService: {
          notificationTitle: 'MediClaro · aviso a tu cuidador/a',
          notificationBody: 'Compartiendo tu ubicación mientras dura el aviso.',
          notificationColor: '#DC2626',
          killServiceOnDestroy: false,
        },
      });
      return true;
    } catch {
      active = null;
      await localStore.remove(KEY);
      return false;
    }
  },

  /** Deja de compartir (aviso terminado, permiso retirado o sesión cerrada). */
  async stop(): Promise<void> {
    const had = !!(await current());
    // Sin aviso guardado, se comprueba una sola vez por arranque que no quede nada en marcha (se llama cada 10 s).
    if (!had && orphanChecked) return;
    orphanChecked = true;
    await stopUpdates();
  },
};
