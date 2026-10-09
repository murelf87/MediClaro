/** Aviso general de MediClaro en Inicio: se lee del servidor, caduca, se puede cerrar y sin servidor no hay aviso. */
const mockRpc = jest.fn();
jest.mock('../../lib/supabase', () => ({ supabase: { rpc: (...a: unknown[]) => mockRpc(...a) } }));

import { AppNoticeService, parseNotice } from '../AppNoticeService';

beforeEach(() => {
  mockRpc.mockReset();
  AppNoticeService.clearCache();
});

test('lee, guarda unos minutos y se puede cerrar', async () => {
  mockRpc.mockResolvedValue({ data: { id: 'n1', title: 'Mantenimiento', message: 'Mañana de 2 a 3 h.', tone: 'warning', until: null }, error: null });
  expect(await AppNoticeService.visible()).toMatchObject({ id: 'n1', tone: 'warning', title: 'Mantenimiento' });
  await AppNoticeService.visible();
  expect(mockRpc).toHaveBeenCalledTimes(1);
  expect(mockRpc).toHaveBeenCalledWith('app_notice');
  await AppNoticeService.dismiss('n1');
  expect(await AppNoticeService.visible()).toBeNull();
});

test('sin servidor, caducado o raro: no hay aviso', async () => {
  mockRpc.mockResolvedValue({ data: null, error: { code: 'PGRST202', message: 'Could not find the function public.app_notice' } });
  expect(await AppNoticeService.visible()).toBeNull();
  expect(parseNotice({ id: 'x', message: 'Hola', until: '2000-01-01T00:00:00Z' })).toBeNull();
  expect(parseNotice({ id: 'x', message: '   ' })).toBeNull();
  expect(parseNotice('hola')).toBeNull();
  expect(parseNotice({ id: 'x', message: 'Hola', tone: 'rojo' })).toMatchObject({ tone: 'info', title: null });
});
