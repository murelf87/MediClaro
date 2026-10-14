/**
 * MediClaro — LocationService
 * GPS acquisition + reverse geocoding.
 * NUNCA mezcla ubicación del dispositivo con dirección declarada por el usuario.
 *
 * NOTA: Requiere que expo-location esté instalado (npm install expo-location).
 * Si no está disponible, las funciones devuelven error UNAVAILABLE.
 */

import { EmergencyLocation } from './types';

// Importar expo-location dinámicamente: si el módulo nativo no está disponible
// (p. ej. en un entorno de pruebas), la emergencia sigue funcionando sin GPS.
type ExpoLocationModule = typeof import('expo-location');
let ExpoLocation: ExpoLocationModule | null = null;

try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  ExpoLocation = require('expo-location');
} catch {
  // expo-location no disponible — operaremos en modo degradado
  ExpoLocation = null;
}

export type LocationResult =
  | { ok: true; location: EmergencyLocation }
  | { ok: false; error: 'PERMISSION_DENIED' | 'TIMEOUT' | 'UNAVAILABLE' | 'UNKNOWN'; message: string };

const TIMEOUT_MS = 15_000;
const HIGH_ACCURACY_THRESHOLD_M = 100;

export async function requestLocationPermission(): Promise<boolean> {
  if (!ExpoLocation) return false;
  try {
    const { status } = await ExpoLocation.requestForegroundPermissionsAsync();
    return status === 'granted';
  } catch {
    return false;
  }
}

export async function getCurrentLocation(): Promise<LocationResult> {
  if (!ExpoLocation) {
    return {
      ok: false,
      error: 'UNAVAILABLE',
      message: 'Servicio de ubicación no disponible en este dispositivo',
    };
  }

  try {
    // 1. Verificar permisos
    const { status } = await ExpoLocation.getForegroundPermissionsAsync();
    if (status !== 'granted') {
      const granted = await requestLocationPermission();
      if (!granted) {
        return {
          ok: false,
          error: 'PERMISSION_DENIED',
          message: 'Permiso de ubicación denegado',
        };
      }
    }

    // 2. Obtener posición con timeout (el temporizador se cancela en cuanto hay respuesta)
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    const position = await Promise.race([
      ExpoLocation.getCurrentPositionAsync({
        accuracy: ExpoLocation.Accuracy.High,
      }),
      new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error('TIMEOUT')), TIMEOUT_MS);
      }),
    ]).finally(() => {
      if (timeoutId !== undefined) clearTimeout(timeoutId);
    });

    const { latitude, longitude, accuracy } = position.coords;
    const timestamp = new Date(position.timestamp).toISOString();
    const isApproximate = (accuracy ?? 999) > HIGH_ACCURACY_THRESHOLD_M;

    // 3. Geocodificación inversa (mejor esfuerzo)
    let resolvedAddress: string | undefined;
    let resolvedPostalCode: string | undefined;
    let resolvedCity: string | undefined;
    let resolvedProvince: string | undefined;

    try {
      const geocodeResults = await ExpoLocation.reverseGeocodeAsync({ latitude, longitude });
      if (geocodeResults.length > 0) {
        const g = geocodeResults[0];
        resolvedAddress = [g.street, g.streetNumber].filter(Boolean).join(' ') || undefined;
        resolvedPostalCode = g.postalCode ?? undefined;
        resolvedCity = g.city ?? g.subregion ?? undefined;
        resolvedProvince = g.region ?? undefined;
      }
    } catch {
      // Geocoding es opcional — continuamos sin dirección
    }

    const ageSeconds = Math.round((Date.now() - position.timestamp) / 1000);

    return {
      ok: true,
      location: {
        latitude,
        longitude,
        accuracy: accuracy ?? 999,
        timestamp,
        resolvedAddress,
        resolvedPostalCode,
        resolvedCity,
        resolvedProvince,
        isApproximate,
        ageSeconds,
        provenance: 'DEVICE_LOCATION',
      },
    };
  } catch (e) {
    const message = (e as { message?: string } | null)?.message;
    if (message === 'TIMEOUT') {
      return { ok: false, error: 'TIMEOUT', message: 'Tiempo de espera agotado para GPS' };
    }
    return { ok: false, error: 'UNKNOWN', message: String(message ?? 'Error desconocido') };
  }
}

/** Descripción legible de la ubicación para UI */
export function formatLocationForUI(loc: EmergencyLocation): string {
  const parts: string[] = [];
  if (loc.resolvedAddress) parts.push(loc.resolvedAddress);
  if (loc.resolvedCity) parts.push(loc.resolvedCity);
  if (loc.resolvedPostalCode) parts.push(loc.resolvedPostalCode);

  const base = parts.length > 0 ? parts.join(', ') : `${loc.latitude.toFixed(4)}, ${loc.longitude.toFixed(4)}`;
  const age = loc.ageSeconds < 5 ? 'ahora mismo' : `hace ${loc.ageSeconds} segundos`;
  const precision = loc.isApproximate ? ' (aproximada)' : '';

  return `${base}${precision} · Ubicación obtenida ${age}`;
}

/** Descripción para resumen verbal — pronunciable por TTS */
export function formatLocationForSpeech(loc: EmergencyLocation): string {
  const parts: string[] = [];

  if (loc.resolvedAddress) parts.push(`Calle: ${loc.resolvedAddress}`);
  if (loc.resolvedCity) parts.push(loc.resolvedCity);
  if (loc.resolvedProvince) parts.push(loc.resolvedProvince);
  if (loc.resolvedPostalCode) {
    const digits = loc.resolvedPostalCode.split('').join(' ');
    parts.push(`Código postal: ${digits}`);
  }

  if (parts.length === 0) {
    return `Coordenadas: ${loc.latitude.toFixed(4)} norte, ${loc.longitude.toFixed(4)} este`;
  }

  const precision = loc.isApproximate ? ' La ubicación es aproximada.' : '';
  return `${parts.join('. ')}.${precision}`;
}
