/**
 * Tests — permiso explícito antes de enviar datos a la IA (Apple 5.1.2(i)).
 */
const mockInserts: Record<string, unknown>[] = [];
let mockSessionUserId: string | null = 'user-1';
let mockInsertFails = false;
let mockInsertDuplicate = false;

jest.mock('../../api', () => {
  const actual = jest.requireActual('../../api/errors');
  return {
    ...actual,
    supabase: {
      auth: {
        getSession: async () => ({ data: { session: mockSessionUserId ? { user: { id: mockSessionUserId } } : null } }),
      },
      from: (table: string) => ({
        insert: async (row: Record<string, unknown>) => {
          if (mockInsertFails) return { error: { message: 'offline' } };
          if (mockInsertDuplicate) return { error: { code: '23505', message: 'duplicate key' } };
          mockInserts.push({ table, ...row });
          return { error: null };
        },
      }),
    },
  };
});

jest.mock('../DemoMode', () => ({ DemoMode: { isActive: () => false } }));

import { __reset as resetStorage } from '../emergency/__mocks__/async-storage';
import { AI_CONSENT_REQUIRED, AI_CONSENT_VERSION, AiConsentService } from '../AiConsentService';
import { AppError } from '../../api/errors';

beforeEach(() => {
  resetStorage();
  mockInserts.length = 0;
  mockSessionUserId = 'user-1';
  mockInsertFails = false;
  mockInsertDuplicate = false;
});

const flush = async () => {
  for (let i = 0; i < 5; i += 1) await new Promise((r) => setTimeout(r, 0));
};

describe('AiConsentService', () => {
  it('sin decisión el estado es «unknown» y los servicios no pueden enviar nada', async () => {
    expect(await AiConsentService.getStatus()).toBe('unknown');
    await expect(AiConsentService.assertGranted()).rejects.toMatchObject({ kind: 'permission_denied', code: AI_CONSENT_REQUIRED });
    await expect(AiConsentService.assertGranted()).rejects.toBeInstanceOf(AppError);
  });

  it('ensure() abre la petición y espera: «Aceptar» concede y registra la decisión con fecha', async () => {
    const pending = AiConsentService.ensure();
    await flush();
    expect(AiConsentService.isRequestOpen()).toBe(true);
    await AiConsentService.answer(true);
    await expect(pending).resolves.toBe(true);
    expect(AiConsentService.isRequestOpen()).toBe(false);
    expect(await AiConsentService.isGranted()).toBe(true);
    await flush();
    expect(mockInserts).toHaveLength(1);
    expect(mockInserts[0]).toMatchObject({ table: 'consents', user_id: 'user-1', kind: 'ai_processing', granted: true });
    expect(String(mockInserts[0].version)).toMatch(new RegExp(`^${AI_CONSENT_VERSION}@\\d{4}-\\d{2}-\\d{2}T`));
  });

  it('«Ahora no» no concede nada ni registra nada', async () => {
    const pending = AiConsentService.ensure();
    await flush();
    await AiConsentService.answer(false);
    await expect(pending).resolves.toBe(false);
    expect(await AiConsentService.getStatus()).toBe('unknown');
    expect(mockInserts).toHaveLength(0);
  });

  it('con permiso concedido, ensure() responde al momento sin abrir nada', async () => {
    await AiConsentService.grant();
    await expect(AiConsentService.ensure()).resolves.toBe(true);
    expect(AiConsentService.isRequestOpen()).toBe(false);
    await expect(AiConsentService.assertGranted()).resolves.toBeUndefined();
  });

  it('retirar el permiso bloquea de nuevo y queda registrado (granted: false)', async () => {
    await AiConsentService.grant();
    await AiConsentService.revoke();
    await flush();
    expect(await AiConsentService.getStatus()).toBe('denied');
    await expect(AiConsentService.assertGranted()).rejects.toMatchObject({ code: AI_CONSENT_REQUIRED });
    expect(mockInserts.map((r) => r.granted)).toEqual([true, false]);
  });

  it('el permiso es por cuenta: otra cuenta en el mismo teléfono empieza sin permiso', async () => {
    await AiConsentService.grant();
    mockSessionUserId = 'user-2';
    expect(await AiConsentService.getStatus()).toBe('unknown');
    mockSessionUserId = 'user-1';
    expect(await AiConsentService.getStatus()).toBe('granted');
  });

  it('sin conexión se guarda en el teléfono y el registro se reintenta después', async () => {
    mockInsertFails = true;
    await AiConsentService.grant();
    await flush();
    expect(await AiConsentService.isGranted()).toBe(true);
    await flush();
    expect(mockInserts).toHaveLength(0);
    mockInsertFails = false;
    await AiConsentService.getStatus();
    await flush();
    await flush();
    expect(mockInserts).toHaveLength(1);
    // Una vez registrado no se vuelve a enviar
    await AiConsentService.getStatus();
    await flush();
    expect(mockInserts).toHaveLength(1);
  });

  it('al eliminar la cuenta se borra su decisión del teléfono', async () => {
    await AiConsentService.grant();
    await AiConsentService.forgetAccountLocalData('user-1');
    expect(await AiConsentService.getStatus()).toBe('unknown');
  });

  it('una nueva petición cierra la anterior como rechazada', async () => {
    const first = AiConsentService.ensure();
    await flush();
    const second = AiConsentService.ensure();
    await flush();
    await expect(first).resolves.toBe(false);
    await AiConsentService.answer(true);
    await expect(second).resolves.toBe(true);
  });

  it('si el servidor ya tenía el registro (duplicado), se da por registrado y no se reintenta', async () => {
    mockInsertDuplicate = true;
    await AiConsentService.grant();
    await flush();
    mockInsertDuplicate = false;
    await AiConsentService.getStatus();
    await flush();
    expect(mockInserts).toHaveLength(0);
  });

  it('cada decisión queda registrada en orden, también si se toman sin conexión', async () => {
    mockInsertFails = true;
    await AiConsentService.grant();
    await AiConsentService.revoke();
    await AiConsentService.grant();
    await flush();
    expect(mockInserts).toHaveLength(0);
    mockInsertFails = false;
    await AiConsentService.getStatus();
    await flush();
    expect(mockInserts.map((r) => r.granted)).toEqual([true, false, true]);
  });

  it('responder «Aceptar» no espera a la red (el registro va en segundo plano)', async () => {
    const pending = AiConsentService.ensure();
    await flush();
    await AiConsentService.answer(true);
    await expect(pending).resolves.toBe(true);
    expect(await AiConsentService.isGranted()).toBe(true);
  });
});
