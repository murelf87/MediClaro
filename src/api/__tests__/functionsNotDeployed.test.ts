/**
 * Una función del servidor que aún no se ha desplegado (p. ej. «explain-document», la del clip del chat) responde 404 con
 * {"code":"NOT_FOUND","message":"Requested function was not found"}. La persona debe leer algo claro, no «No hemos
 * encontrado lo que buscas».
 */
const mockInvoke = jest.fn();
jest.mock('../../lib/supabase', () => ({
  supabase: { functions: { invoke: (...a: unknown[]) => mockInvoke(...a) } },
  isBackendConfigured: () => true,
  isDemoClientActive: () => true,
}));

import { invokeFunction } from '../functions';

beforeEach(() => mockInvoke.mockReset());

function httpError(status: number, body: unknown) {
  return {
    data: null,
    error: { name: 'FunctionsHttpError', message: 'Edge Function returned a non-2xx status code', context: { status, json: async () => body } },
  };
}

test('función sin desplegar: «Esta función todavía no está activada.»', async () => {
  mockInvoke.mockResolvedValue(httpError(404, { code: 'NOT_FOUND', message: 'Requested function was not found' }));
  await expect(invokeFunction('explain-document', { images: [] })).rejects.toMatchObject({
    kind: 'not_found',
    message: 'Esta función todavía no está activada.',
  });
});

test('un 404 normal de una función que sí existe no se confunde con «sin desplegar»', async () => {
  mockInvoke.mockResolvedValue(httpError(404, { error: 'No encontrado en la base oficial' }));
  await expect(invokeFunction('medicine-detail', { id: '1' })).rejects.toMatchObject({
    kind: 'not_found',
    message: 'No encontramos este medicamento en la base oficial.',
  });
});

test('un 404 sin cuerpo conocido sigue diciendo lo de siempre', async () => {
  mockInvoke.mockResolvedValue(httpError(404, { message: 'otra cosa' }));
  await expect(invokeFunction('medicine-detail', { id: '1' })).rejects.toMatchObject({ kind: 'not_found', message: 'No hemos encontrado lo que buscas.' });
});
