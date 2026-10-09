/**
 * Panel del propietario (app): abrir con código, sesión solo en memoria, cierre por el servidor y al volver de segundo
 * plano, Face ID guardado en el llavero y errores claros. Con el panel simulado (misma forma que owner_admin).
 */
const mockRpc = jest.fn();
jest.mock('../../lib/supabase', () => ({
  supabase: {
    rpc: (...a: unknown[]) => mockRpc(...a),
    auth: { getSession: async () => ({ data: { session: { user: { id: 'owner-1' } } } }) },
  },
}));
jest.mock('../../api/functions', () => ({ assertBackendConfigured: () => undefined, invokeFunction: jest.fn() }));

import { OwnerAdminService, OWNER_NOT_DEPLOYED, ownerError, toCsv } from '../OwnerAdminService';
import { createDemoOwner } from '../../mocks/demoOwner';
import { __emitAppState } from '../emergency/__mocks__/react-native';
import { __reset as resetSecureStore, __setBiometrics, getItemAsync, setItemAsync } from '../emergency/__mocks__/expo-secure-store';

let clock = Date.parse('2026-10-09T10:00:00Z');
let owner = createDemoOwner({ ownerId: 'owner-1', ownerName: () => 'Antonio', ownerPhone: '+34600123456', now: () => clock });

beforeEach(() => {
  clock = Date.parse('2026-10-09T10:00:00Z');
  jest.spyOn(Date, 'now').mockImplementation(() => clock);
  owner = createDemoOwner({ ownerId: 'owner-1', ownerName: () => 'Antonio', ownerPhone: '+34600123456', now: () => clock });
  mockRpc.mockReset();
  mockRpc.mockImplementation(async (name: string, args: unknown) => owner.rpc(name, args));
  OwnerAdminService.clear();
  resetSecureStore();
});
afterEach(() => jest.restoreAllMocks());

test('crear el código, abrir el panel y cerrarlo', async () => {
  expect(await OwnerAdminService.status()).toMatchObject({ hasPin: false, name: 'Antonio', phone: '+34 ••• ••• 456' });
  await expect(OwnerAdminService.setupPin('123456', false)).rejects.toMatchObject({ code: 'PIN_WEAK', message: expect.stringMatching(/difícil de adivinar/) });
  expect(OwnerAdminService.isUnlocked()).toBe(false);
  const changes = jest.fn();
  const off = OwnerAdminService.subscribe(changes);
  expect(await OwnerAdminService.setupPin('482913', false)).toMatchObject({ ok: true });
  expect(OwnerAdminService.isUnlocked()).toBe(true);
  expect(changes).toHaveBeenCalled();
  const o = await OwnerAdminService.overview();
  expect(o.counts.users).toBeGreaterThan(5);
  const sent = mockRpc.mock.calls.at(-1)?.[1] as { p_action: string; p_payload: { session: string } };
  expect(sent.p_action).toBe('overview');
  expect(sent.p_payload.session).toMatch(/^[0-9a-f]{64}$/);
  await OwnerAdminService.lock();
  expect(OwnerAdminService.isUnlocked()).toBe(false);
  const calls = mockRpc.mock.calls.length;
  await expect(OwnerAdminService.overview()).rejects.toMatchObject({ code: 'OWNER_LOCKED' });
  expect(mockRpc.mock.calls.length).toBe(calls); // cerrado: ni siquiera pregunta al servidor
  off();
});

test('código incorrecto: intentos y bloqueo de 15 minutos', async () => {
  await OwnerAdminService.setupPin('482913', false);
  await OwnerAdminService.lock();
  expect(await OwnerAdminService.unlock('000999')).toEqual({ ok: false, error: 'PIN_INCORRECT', attemptsLeft: 4 });
  for (let i = 0; i < 3; i += 1) await OwnerAdminService.unlock('000999');
  expect(await OwnerAdminService.unlock('000999')).toMatchObject({ ok: false, error: 'LOCKED' });
  expect(await OwnerAdminService.unlock('482913')).toMatchObject({ ok: false, error: 'LOCKED' });
  clock += 16 * 60_000;
  expect(await OwnerAdminService.unlock('482913')).toMatchObject({ ok: true });
});

test('el panel se cierra solo: sin actividad, si el servidor lo cierra y al volver de segundo plano', async () => {
  await OwnerAdminService.setupPin('482913', false);
  clock += 16 * 60_000; // 16 min sin usarlo
  expect(OwnerAdminService.isUnlocked()).toBe(false);
  await expect(OwnerAdminService.overview()).rejects.toMatchObject({ code: 'OWNER_LOCKED' });

  await OwnerAdminService.unlock('482913');
  mockRpc.mockImplementationOnce(async () => ({ data: null, error: { message: 'OWNER_LOCKED' } }));
  await expect(OwnerAdminService.users()).rejects.toMatchObject({ code: 'OWNER_LOCKED' });
  expect(OwnerAdminService.isUnlocked()).toBe(false);

  await OwnerAdminService.unlock('482913');
  __emitAppState('background');
  clock += 60_000;
  __emitAppState('active');
  expect(OwnerAdminService.isUnlocked()).toBe(true); // 1 minuto fuera: sigue abierto
  __emitAppState('background');
  clock += 3 * 60_000;
  __emitAppState('active');
  expect(OwnerAdminService.isUnlocked()).toBe(false); // 3 minutos fuera: se cierra
});

test('Face ID: el permiso se guarda en el llavero protegido y abre el panel', async () => {
  __setBiometrics(true);
  expect(OwnerAdminService.canUseFaceId()).toBe(true);
  const token = 'a'.repeat(64);
  mockRpc.mockImplementation(async (_name: string, args: { p_action: string; p_payload: Record<string, unknown> }) => {
    if (args.p_action === 'unlock') return { data: { ok: true, session: 'b'.repeat(64), expiresAt: 'x', deviceToken: token, deviceId: 'd1' }, error: null };
    if (args.p_action === 'unlock_device') {
      return { data: args.p_payload.deviceToken === token ? { ok: true, session: 'c'.repeat(64), expiresAt: 'x' } : { ok: false, error: 'DEVICE_INVALID' }, error: null };
    }
    return { data: { ok: true }, error: null };
  });
  expect(await OwnerAdminService.unlock('482913', true)).toMatchObject({ ok: true, faceIdSaved: true });
  expect(setItemAsync).toHaveBeenCalledWith('mediclaro_owner_device_owner-1', token, expect.objectContaining({ requireAuthentication: true }));
  expect(await OwnerAdminService.hasFaceId()).toBe(true);
  await OwnerAdminService.lock();
  expect(await OwnerAdminService.unlockWithFaceId()).toMatchObject({ ok: true });
  expect(getItemAsync).toHaveBeenLastCalledWith('mediclaro_owner_device_owner-1', expect.objectContaining({ requireAuthentication: true }));
  expect(OwnerAdminService.isUnlocked()).toBe(true);
  // Si el servidor ya no lo reconoce (código cambiado), se olvida en el teléfono.
  await OwnerAdminService.lock();
  await setItemAsync('mediclaro_owner_device_owner-1', 'f'.repeat(64));
  expect(await OwnerAdminService.unlockWithFaceId()).toMatchObject({ ok: false, error: 'DEVICE_INVALID' });
  expect(await OwnerAdminService.hasFaceId()).toBe(false);
});

test('bonos y Premium de cortesía de principio a fin', async () => {
  await OwnerAdminService.setupPin('482913', false);
  const bono = await OwnerAdminService.bonoCreate({ name: 'Familia García', days: 30, maxUses: 1 });
  const people = await OwnerAdminService.users({ q: 'luis' });
  expect(people.items).toHaveLength(1);
  const luis = people.items[0];
  expect(luis.plan).toBe('free');
  const g = await OwnerAdminService.grant({ userId: luis.id }, { bonoId: bono.id });
  expect(g).toMatchObject({ ok: true, verified: true, bono: { uses: 1, maxUses: 1 }, user: { plan: 'courtesy' } });
  await expect(OwnerAdminService.grant({ phone: '600 000 111' }, { bonoId: bono.id })).rejects.toMatchObject({ code: 'BONO_EXHAUSTED' });
  await expect(OwnerAdminService.grant({ phone: '12' }, { days: 30 })).rejects.toMatchObject({ code: 'INVALID_PHONE' });
  const pedro = (await OwnerAdminService.users({ q: 'pedro' })).items[0];
  await expect(OwnerAdminService.grant({ userId: pedro.id }, { days: 30 })).rejects.toMatchObject({ code: 'USER_NO_PHONE' });
  expect((await OwnerAdminService.revoke({ userId: luis.id })).changed).toBe(true);
  const audit = await OwnerAdminService.audit('activity');
  expect(audit.rows.map((r) => r.action)).toEqual(expect.arrayContaining(['owner_bono_created', 'courtesy_premium_granted', 'courtesy_premium_revoked']));
});

test('errores claros y CSV para Excel', () => {
  expect(ownerError({ message: 'OWNER_REQUIRED' })).toMatchObject({ kind: 'permission_denied', message: expect.stringMatching(/solo para el propietario/) });
  expect(ownerError({ code: 'PGRST202', message: 'Could not find the function public.owner_admin' })).toMatchObject({ kind: 'not_configured', code: OWNER_NOT_DEPLOYED });
  expect(ownerError({ message: 'BONO_ALREADY_USED' }).message).toMatch(/ya recibió este bono/);
  const csv = toCsv({ kind: 'users', generatedAt: '', columns: ['Nombre', 'Nota'], rows: [['Ana; López', 'dice "hola"'], [null, 3]] });
  expect(csv.startsWith('﻿')).toBe(true);
  expect(csv).toContain('"Ana; López";"dice ""hola"""');
  expect(csv).toContain('\r\n;3\r\n');
});
