/**
 * Servicio para manejar geolocalización en tiempo real durante llamadas.
 * Captura ubicación del dispositivo y la envía a Supabase cada pocos segundos.
 */
import * as Location from 'expo-location';
import { careAction } from './CaregiverService';

// Re-export careAction para que LocationService sea auto-suficiente
export { careAction } from './CaregiverService';

export interface UserLocation {
  latitude: number;
  longitude: number;
  accuracy?: number;
  altitude?: number;
  heading?: number;
  speed?: number;
}

let locationSubscription: any = null;
let isTrackingLocation = false;

/**
 * Solicita permiso de ubicación
 */
export async function requestLocationPermission(): Promise<boolean> {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    return status === 'granted';
  } catch (error) {
    console.error('Error requesting location permission:', error);
    return false;
  }
}

/**
 * Solicita permiso de ubicación en background (para llamadas)
 */
export async function requestBackgroundLocationPermission(): Promise<boolean> {
  try {
    const { status } = await Location.requestBackgroundPermissionsAsync();
    return status === 'granted';
  } catch (error) {
    console.error('Error requesting background location permission:', error);
    return false;
  }
}

/**
 * Obtiene la ubicación actual una sola vez
 */
export async function getCurrentLocation(): Promise<UserLocation | null> {
  try {
    const hasPermission = await Location.getForegroundPermissionsAsync();
    if (!hasPermission.granted) {
      console.warn('Location permission not granted');
      return null;
    }

    const location = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });

    return {
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
      accuracy: location.coords.accuracy ?? undefined,
      altitude: location.coords.altitude ?? undefined,
      heading: location.coords.heading ?? undefined,
      speed: location.coords.speed ?? undefined,
    };
  } catch (error) {
    console.error('Error getting current location:', error);
    return null;
  }
}

/**
 * Inicia seguimiento continuo de ubicación (para durante llamadas)
 * Envía la ubicación a Supabase cada 5 segundos
 */
export async function startLocationTracking(): Promise<boolean> {
  if (isTrackingLocation) {
    console.warn('Location tracking already started');
    return true;
  }

  try {
    // Verificar permiso de foreground
    const fgPermission = await Location.getForegroundPermissionsAsync();
    if (!fgPermission.granted) {
      const granted = await requestLocationPermission();
      if (!granted) return false;
    }

    // Solicitar permiso de background
    await requestBackgroundLocationPermission();

    isTrackingLocation = true;

    // Suscribirse a actualizaciones de ubicación cada 5 segundos
    locationSubscription = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.Balanced,
        timeInterval: 5000, // Actualizar cada 5 segundos
        distanceInterval: 10, // O cuando se mueve 10 metros
        mayShowUserSettingsDialog: true,
      },
      async (location) => {
        try {
          const userLocation: UserLocation = {
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
            accuracy: location.coords.accuracy ?? undefined,
            altitude: location.coords.altitude ?? undefined,
            heading: location.coords.heading ?? undefined,
            speed: location.coords.speed ?? undefined,
          };

          // Enviar ubicación a Supabase
          await careAction('update_location', userLocation);
        } catch (error) {
          console.error('Error updating location:', error);
        }
      }
    );

    console.log('Location tracking started');
    return true;
  } catch (error) {
    console.error('Error starting location tracking:', error);
    isTrackingLocation = false;
    return false;
  }
}

/**
 * Detiene el seguimiento de ubicación
 */
export function stopLocationTracking(): void {
  if (locationSubscription) {
    locationSubscription.remove();
    locationSubscription = null;
  }
  isTrackingLocation = false;
  console.log('Location tracking stopped');
}

/**
 * Obtiene el estado del seguimiento
 */
export function isLocationTracking(): boolean {
  return isTrackingLocation;
}

/**
 * Calcula la distancia entre dos puntos (Haversine formula)
 */
export function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Radio de la Tierra en km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}
