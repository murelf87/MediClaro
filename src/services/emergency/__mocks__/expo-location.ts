/**
 * Mock de expo-location para tests.
 * Simula GPS respondiendo, GPS impreciso, GPS sin permiso y GPS timeout.
 */

export enum Accuracy {
  Lowest  = 1,
  Low     = 2,
  Balanced = 3,
  High    = 4,
  Highest = 5,
  BestForNavigation = 6,
}

export type LocationStatus = 'granted' | 'denied' | 'undetermined';

let _permissionStatus: LocationStatus = 'granted';
let _shouldTimeout = false;
let _accuracy: number = 15; // metros

// Control helpers para los tests
export function __setPermission(status: LocationStatus) { _permissionStatus = status; }
export function __setTimeoutMode(val: boolean)          { _shouldTimeout = val; }
export function __setAccuracy(metres: number)           { _accuracy = metres; }
export function __reset() {
  _permissionStatus = 'granted';
  _shouldTimeout = false;
  _accuracy = 15;
}

export async function requestForegroundPermissionsAsync() {
  return { status: _permissionStatus };
}

export async function getForegroundPermissionsAsync() {
  return { status: _permissionStatus };
}

export async function getCurrentPositionAsync(_opts?: unknown) {
  if (_shouldTimeout) {
    await new Promise(resolve => setTimeout(resolve, 60_000));
    throw new Error('TIMEOUT');
  }
  return {
    coords: {
      latitude:  40.4168,
      longitude: -3.7038,
      accuracy:  _accuracy,
    },
    timestamp: Date.now(),
  };
}

export async function reverseGeocodeAsync(
  _coords: { latitude: number; longitude: number },
  _opts?: unknown,
) {
  return [
    {
      street:     'Calle Gran Vía',
      streetNumber: '1',
      postalCode: '28013',
      city:       'Madrid',
      region:     'Comunidad de Madrid',
      subregion:  'Madrid',
    },
  ];
}
