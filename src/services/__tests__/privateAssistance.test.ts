/**
 * MediClaro NO tiene central de avisos ni atiende llamadas (decisión del propietario, 11/10/2026).
 * El botón azul solo llama al servicio privado que la persona eligió (su teleasistencia, un familiar…).
 * Aunque el servidor tuviera un número configurado, la app nunca ofrece uno «de MediClaro».
 * Solo en el Modo demostración hay un número de ejemplo, con la llamada simulada.
 */
let mockDemo = false;
let mockExtras: Record<string, string> = {};
const mockDial = jest.fn(async (..._a: unknown[]) => 'success');
jest.mock('../../api', () => ({
  supabase: { auth: { getSession: async () => ({ data: { session: { user: { id: 'u1' } } } }) } },
  AppError: class extends Error {},
  toAppError: (e: unknown) => e,
  invokeFunction: jest.fn(),
}));
jest.mock('../../api/storage', () => ({
  secureLocalStore: { getJSON: async () => mockExtras, setJSON: async () => undefined },
  localStore: { getJSON: async (_k: string, fallback: unknown) => fallback, setJSON: async () => undefined, remove: async () => undefined },
}));
jest.mock('../DemoMode', () => ({ DemoMode: { isActive: () => mockDemo } }));
jest.mock('../AuthService', () => ({ AuthService: {} }));
jest.mock('../CaregiverService', () => ({ CaregiverService: {} }));
jest.mock('../emergency/EmergencyProfileService', () => ({}));
jest.mock('../emergency/LocationService', () => ({}));
jest.mock('../emergency/EmergencyReportService', () => ({}));
jest.mock('../emergency/EmergencyVoiceService', () => ({ emergencyVoiceService: {} }));
jest.mock('../emergency/EmergencyMeshService', () => ({ EmergencyMeshService: {} }));
jest.mock('../emergency/EmergencyContactService', () => ({ callPrimaryAssistance: (...a: unknown[]) => mockDial(...a) }));
jest.mock('../emergency/EmergencyConfigService', () => ({
  emergencyConfigService: {
    getConfig: async () => ({
      primaryAssistanceName: 'Central del servidor',
      primaryAssistanceNumber: '+34900000000',
      countryEmergencyNumber: '112',
      regionOverrides: {},
    }),
  },
}));

import { EmergencyService } from '../EmergencyService';

beforeEach(() => {
  mockDemo = false;
  mockExtras = {};
  mockDial.mockClear();
});

test('sin número propio no hay botón azul: nunca se ofrece un número «de MediClaro» (aunque el servidor tenga uno)', async () => {
  expect(await EmergencyService.getPrivateAssistanceNumber()).toBeNull();
  expect(await EmergencyService.callPrivateAssistance()).toBe('not_configured');
  expect(mockDial).not.toHaveBeenCalled();
});

test('con el número que eligió la persona, se llama a ese servicio', async () => {
  mockExtras = { privateAssistanceName: 'Mi teleasistencia', privateAssistancePhone: '+34 600 111 222' };
  expect(await EmergencyService.getPrivateAssistanceNumber()).toEqual({ name: 'Mi teleasistencia', phone: '+34 600 111 222', source: 'user' });
  expect(await EmergencyService.callPrivateAssistance()).toBe('success');
  expect(mockDial).toHaveBeenCalledWith(expect.objectContaining({ primaryAssistanceNumber: '+34 600 111 222' }));
});

test('Modo demostración: número de ejemplo con la llamada simulada (no se marca)', async () => {
  mockDemo = true;
  expect((await EmergencyService.getPrivateAssistanceNumber())?.source).toBe('example');
  expect(await EmergencyService.isPrivateCallSimulated()).toBe(true);
  expect(await EmergencyService.callPrivateAssistance()).toBe('success');
  expect(mockDial).not.toHaveBeenCalled();
});

test('ningún texto de la app habla de una central de MediClaro', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const fs = require('fs') as typeof import('fs');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const path = require('path') as typeof import('path');
  const srcDir = path.resolve(__dirname, '../..');
  const offenders: string[] = [];
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name !== '__tests__' && entry.name !== 'node_modules') walk(full);
      } else if (/\.(ts|tsx)$/.test(entry.name) && /central (de )?(avisos )?(de )?mediclaro|mediclaro te atiende/i.test(fs.readFileSync(full, 'utf8'))) {
        offenders.push(path.relative(srcDir, full));
      }
    }
  };
  walk(srcDir);
  expect(offenders).toEqual([]);
});
