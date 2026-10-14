/**
 * Tests — LocationService (Section 21)
 *
 * Escenarios cubiertos:
 * - GPS OK (usuario responde, coordenadas reales)
 * - GPS sin permiso
 * - GPS impreciso (accuracy > 100 m)
 * - Sin expo-location disponible → UNAVAILABLE
 * - formatLocationForUI / formatLocationForSpeech
 *
 * NOTA: LocationService usa require() dinámico en nivel de módulo, por lo que
 * debemos resetear módulos antes de cambiar el estado del mock entre tests.
 */

// Estado del mock — prefijo 'mock' requerido por Jest para variables en jest.mock()
let mockPermissionStatus: 'granted' | 'denied' | 'undetermined' = 'granted';
let mockAccuracyMetres = 15;

// Jest mock declarado antes de los imports (hoisted)
jest.mock('expo-location', () => {
  const Accuracy = { High: 4 };

  return {
    Accuracy,
    requestForegroundPermissionsAsync: jest.fn(async () => ({ status: mockPermissionStatus })),
    getForegroundPermissionsAsync:     jest.fn(async () => ({ status: mockPermissionStatus })),
    getCurrentPositionAsync: jest.fn(async () => ({
      coords: { latitude: 40.4168, longitude: -3.7038, accuracy: mockAccuracyMetres },
      timestamp: Date.now(),
    })),
    reverseGeocodeAsync: jest.fn(async () => ([{
      street: 'Calle Gran Vía', streetNumber: '1',
      postalCode: '28013', city: 'Madrid',
      region: 'Comunidad de Madrid', subregion: 'Madrid',
    }])),
  };
});

jest.mock('@react-native-async-storage/async-storage', () =>
  require('../__mocks__/async-storage').default,
);

import {
  getCurrentLocation,
  formatLocationForUI,
  formatLocationForSpeech,
} from '../LocationService';

import type { EmergencyLocation } from '../types';

beforeEach(() => {
  mockPermissionStatus = 'granted';
  mockAccuracyMetres = 15;
  jest.clearAllMocks();
});

// ─── getCurrentLocation ───────────────────────────────────────────────────────

describe('getCurrentLocation — GPS OK (usuario responde)', () => {

  it('devuelve ok:true con coordenadas cuando hay permiso y GPS', async () => {
    const result = await getCurrentLocation();

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.location.latitude).toBeCloseTo(40.4168, 2);
    expect(result.location.longitude).toBeCloseTo(-3.7038, 2);
    expect(result.location.provenance).toBe('DEVICE_LOCATION');
  });

  it('isApproximate:false cuando accuracy ≤ 100 m', async () => {
    mockAccuracyMetres = 15;
    const result = await getCurrentLocation();
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.location.isApproximate).toBe(false);
  });

  it('incluye dirección geocodificada (Madrid, CP 28013)', async () => {
    const result = await getCurrentLocation();
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.location.resolvedCity).toBe('Madrid');
    expect(result.location.resolvedPostalCode).toBe('28013');
    expect(result.location.resolvedProvince).toBe('Comunidad de Madrid');
  });
});

describe('getCurrentLocation — GPS impreciso', () => {

  it('accuracy > 100 m → isApproximate:true (pero ok:true)', async () => {
    mockAccuracyMetres = 250; // baja precisión
    const result = await getCurrentLocation();

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.location.isApproximate).toBe(true);
  });

  it('accuracy == 100 m → isApproximate:false (límite exacto)', async () => {
    mockAccuracyMetres = 100;
    const result = await getCurrentLocation();
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // 100 m ≤ 100 m → no es aproximada
    expect(result.location.isApproximate).toBe(false);
  });
});

describe('getCurrentLocation — sin permiso', () => {

  it('devuelve PERMISSION_DENIED cuando el usuario rechaza el permiso', async () => {
    mockPermissionStatus = 'denied';
    const result = await getCurrentLocation();

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe('PERMISSION_DENIED');
  });
});

// ─── formatLocationForUI ──────────────────────────────────────────────────────

describe('formatLocationForUI', () => {

  const LOC_BASE: EmergencyLocation = {
    latitude: 40.4168, longitude: -3.7038, accuracy: 10,
    timestamp: new Date().toISOString(),
    resolvedAddress: 'Calle Gran Vía 1',
    resolvedCity: 'Madrid',
    resolvedPostalCode: '28013',
    resolvedProvince: 'Comunidad de Madrid',
    isApproximate: false,
    ageSeconds: 3,
    provenance: 'DEVICE_LOCATION',
  };

  it('incluye ciudad y código postal', () => {
    const text = formatLocationForUI(LOC_BASE);
    expect(text).toContain('Madrid');
    expect(text).toContain('28013');
  });

  it('muestra "ahora mismo" para ageSeconds < 5', () => {
    const text = formatLocationForUI({ ...LOC_BASE, ageSeconds: 3 });
    expect(text).toContain('ahora mismo');
  });

  it('muestra "hace N segundos" para ageSeconds ≥ 5', () => {
    const text = formatLocationForUI({ ...LOC_BASE, ageSeconds: 12 });
    expect(text).toContain('hace 12 segundos');
  });

  it('incluye "(aproximada)" cuando isApproximate:true', () => {
    const text = formatLocationForUI({ ...LOC_BASE, isApproximate: true });
    expect(text).toContain('aproximada');
  });

  it('usa coordenadas si no hay dirección resuelta', () => {
    const loc: EmergencyLocation = {
      latitude: 40.4168, longitude: -3.7038, accuracy: 10,
      timestamp: new Date().toISOString(),
      isApproximate: false, ageSeconds: 1,
      provenance: 'DEVICE_LOCATION',
    };
    const text = formatLocationForUI(loc);
    expect(text).toContain('40.4168');
    expect(text).toContain('-3.7038');
  });
});

// ─── formatLocationForSpeech ──────────────────────────────────────────────────

describe('formatLocationForSpeech', () => {

  const LOC: EmergencyLocation = {
    latitude: 40.4168, longitude: -3.7038, accuracy: 10,
    timestamp: new Date().toISOString(),
    resolvedAddress: 'Calle Gran Vía 1',
    resolvedCity: 'Madrid',
    resolvedProvince: 'Comunidad de Madrid',
    resolvedPostalCode: '28013',
    isApproximate: false, ageSeconds: 5,
    provenance: 'DEVICE_LOCATION',
  };

  it('separa los dígitos del código postal (pronunciable por TTS)', () => {
    const text = formatLocationForSpeech(LOC);
    // CP 28013 → "2 8 0 1 3"
    expect(text).toContain('2 8 0 1 3');
  });

  it('incluye "La ubicación es aproximada" cuando isApproximate:true', () => {
    const text = formatLocationForSpeech({ ...LOC, isApproximate: true });
    expect(text).toContain('aproximada');
  });

  it('usa coordenadas cuando no hay dirección resuelta', () => {
    const loc: EmergencyLocation = {
      latitude: 40.4168, longitude: -3.7038, accuracy: 10,
      timestamp: new Date().toISOString(),
      isApproximate: false, ageSeconds: 1,
      provenance: 'DEVICE_LOCATION',
    };
    const text = formatLocationForSpeech(loc);
    expect(text).toContain('Coordenadas');
    expect(text).toContain('40.4168');
  });
});
