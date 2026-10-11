/**
 * Ubicación con el móvil bloqueado durante un aviso al cuidador/a: se arranca con la app abierta, envía como mucho
 * una posición cada 9 s y se para sola cuando el aviso termina, caduca o se retira el permiso.
 */
const mockRpc = jest.fn();
jest.mock('../../lib/supabase', () => ({ supabase: { rpc: (...a: unknown[]) => mockRpc(...a) } }));
// Las funciones del mock se crean dentro de la fábrica: la tarea se define al cargar el módulo (antes que este archivo).
jest.mock('expo-task-manager', () => ({ defineTask: jest.fn(), isAvailableAsync: jest.fn(async () => true) }));
const mockGps = { started: false, permission: 'granted' };
jest.mock('expo-location', () => ({
  Accuracy: { High: 4 },
  ActivityType: { Other: 1 },
  getForegroundPermissionsAsync: async () => ({ status: mockGps.permission }),
  startLocationUpdatesAsync: jest.fn(async () => {
    mockGps.started = true;
  }),
  hasStartedLocationUpdatesAsync: jest.fn(async () => mockGps.started),
  stopLocationUpdatesAsync: jest.fn(async () => {
    mockGps.started = false;
  }),
}));

import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { BackgroundLocation, CARE_LOCATION_TASK, sendCareLocation } from '../BackgroundLocation';

const mockDefineTask = TaskManager.defineTask as unknown as jest.Mock;

type Executor = (body: { data: { locations?: unknown[] } | null; error: unknown }) => Promise<void>;
const executor = () => mockDefineTask.mock.calls[0][1] as Executor;
const at = (lat: number, lng: number) => ({ coords: { latitude: lat, longitude: lng, accuracy: 8 }, timestamp: 0 });
const future = () => new Date(Date.now() + 30 * 60_000).toISOString();
let clock = Date.parse('2026-10-11T12:00:00Z');

beforeEach(async () => {
  clock = Date.parse('2026-10-11T12:00:00Z');
  jest.spyOn(Date, 'now').mockImplementation(() => clock);
  mockRpc.mockReset();
  mockRpc.mockResolvedValue({ data: { shared: true }, error: null });
  mockGps.permission = 'granted';
  await BackgroundLocation.stop();
  (Location.startLocationUpdatesAsync as jest.Mock).mockClear();
  (Location.stopLocationUpdatesAsync as jest.Mock).mockClear();
});
afterEach(() => (Date.now as unknown as jest.SpyInstance).mockRestore?.());

test('la tarea queda definida al abrir la app', () => {
  expect(mockDefineTask).toHaveBeenCalledWith(CARE_LOCATION_TASK, expect.any(Function));
});

test('empieza con la app abierta: indicador azul (iPhone) y notificación fija (Android); no se repite', async () => {
  expect(await BackgroundLocation.start('inc-1', future())).toBe(true);
  expect(Location.startLocationUpdatesAsync).toHaveBeenCalledWith(
    CARE_LOCATION_TASK,
    expect.objectContaining({
      timeInterval: 10_000,
      showsBackgroundLocationIndicator: true,
      pausesUpdatesAutomatically: false,
      foregroundService: expect.objectContaining({ notificationBody: expect.stringMatching(/mientras dura el aviso/), killServiceOnDestroy: false }),
    }),
  );
  expect(await BackgroundLocation.isRunningFor('inc-1')).toBe(true);
  expect(await BackgroundLocation.start('inc-1', future())).toBe(true);
  expect(Location.startLocationUpdatesAsync).toHaveBeenCalledTimes(1);
});

test('sin permiso de ubicación no empieza', async () => {
  mockGps.permission = 'denied';
  expect(await BackgroundLocation.start('inc-1', future())).toBe(false);
  expect(Location.startLocationUpdatesAsync).not.toHaveBeenCalled();
});

test('con la pantalla bloqueada envía la posición, como mucho cada 9 s', async () => {
  await BackgroundLocation.start('inc-1', future());
  await executor()({ data: { locations: [at(40.1, -3.1), at(40.4168, -3.7038)] }, error: null });
  expect(mockRpc).toHaveBeenCalledTimes(1);
  expect(mockRpc.mock.calls[0]).toEqual([
    'caregiver_action',
    { p_action: 'location', p_payload: { incidentId: 'inc-1', latitude: 40.4168, longitude: -3.7038, accuracy: 8 } },
  ]);
  clock += 5_000;
  await executor()({ data: { locations: [at(40.42, -3.7)] }, error: null });
  expect(mockRpc).toHaveBeenCalledTimes(1);
  clock += 5_000;
  await executor()({ data: { locations: [at(40.43, -3.7)] }, error: null });
  expect(mockRpc).toHaveBeenCalledTimes(2);
});

test('sin conexión sigue intentándolo con la siguiente posición', async () => {
  await BackgroundLocation.start('inc-1', future());
  mockRpc.mockRejectedValueOnce(new Error('Network request failed'));
  await executor()({ data: { locations: [at(40, -3)] }, error: null });
  expect(await BackgroundLocation.isRunningFor('inc-1')).toBe(true);
});

test('se para sola cuando el aviso termina', async () => {
  await BackgroundLocation.start('inc-1', future());
  mockRpc.mockResolvedValue({ data: null, error: { message: 'INCIDENT_CLOSED' } });
  await executor()({ data: { locations: [at(40, -3)] }, error: null });
  expect(Location.stopLocationUpdatesAsync).toHaveBeenCalledWith(CARE_LOCATION_TASK);
  expect(await BackgroundLocation.isRunningFor('inc-1')).toBe(false);
});

test('se para si la persona retira el permiso de compartir su ubicación', async () => {
  await BackgroundLocation.start('inc-1', future());
  mockRpc.mockResolvedValue({ data: { shared: false }, error: null });
  await executor()({ data: { locations: [at(40, -3)] }, error: null });
  expect(Location.stopLocationUpdatesAsync).toHaveBeenCalled();
});

test('un aviso caducado no se envía y se para', async () => {
  await BackgroundLocation.start('inc-1', new Date(clock + 60_000).toISOString());
  clock += 2 * 60_000;
  await executor()({ data: { locations: [at(40, -3)] }, error: null });
  expect(mockRpc).not.toHaveBeenCalled();
  expect(Location.stopLocationUpdatesAsync).toHaveBeenCalled();
});

test('posiciones sin aviso guardado (p. ej. tras cerrar sesión): se para sin enviar nada', async () => {
  mockGps.started = true;
  await executor()({ data: { locations: [at(40, -3)] }, error: null });
  expect(mockRpc).not.toHaveBeenCalled();
  expect(mockGps.started).toBe(false);
});

test('respuesta del servidor para cada caso', async () => {
  const inc = { incidentId: 'inc-9', expiresAt: future() };
  const coords = { latitude: 1, longitude: 2, accuracy: null };
  mockRpc.mockResolvedValueOnce({ data: { shared: true }, error: null });
  expect(await sendCareLocation(inc, coords)).toBe(true);
  mockRpc.mockResolvedValueOnce({ data: null, error: { message: 'NOT_ALLOWED' } });
  expect(await sendCareLocation(inc, coords)).toBe(false);
  mockRpc.mockResolvedValueOnce({ data: null, error: { message: 'RATE_LIMIT' } });
  expect(await sendCareLocation(inc, coords)).toBe(true);
});
