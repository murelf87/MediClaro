/**
 * «Ayuda → Notifícanos un error»: lo que se envía (mensaje, contacto y datos técnicos sin datos de salud) y los
 * errores claros (demasiados mensajes, servidor sin activar).
 */
const mockRpc = jest.fn();
jest.mock('../../lib/supabase', () => ({
  supabase: { rpc: (...a: unknown[]) => mockRpc(...a) },
  isBackendConfigured: true,
  isDemoClientActive: () => false,
}));

import { ProblemReportService, buildReportContext, validateReport } from '../ProblemReportService';
import { isPublicRoute } from '../../navigation/routeGuard';

beforeEach(() => mockRpc.mockReset());

test('se puede abrir sin cuenta', () => {
  expect(isPublicRoute(['report-problem'])).toBe(true);
});

test('comprueba el texto antes de enviarlo', () => {
  expect(validateReport('  hola ', '')).toMatch(/un poco más/);
  expect(validateReport('No se oye la voz del asistente', '')).toBeNull();
  expect(validateReport('x'.repeat(2001), '')).toMatch(/demasiado largo/);
  expect(validateReport('No se oye la voz del asistente', '6'.repeat(121))).toMatch(/contacto es demasiado largo/);
});

test('datos técnicos: versión, sistema y pantallas; nunca datos de salud', () => {
  const c = buildReportContext({
    screen: '/assistant',
    screens: ['/', '/assistant', '/help'],
    area: 'Voz',
    sessionMode: 'verified',
    premium: true,
    fontSize: 'grande',
    easyMode: false,
    readingVoice: 'Sulafat',
    assistantVoice: 'Achird',
    preview: null,
  });
  expect(c).toMatchObject({
    appVersion: expect.any(String),
    platform: 'android',
    runtime: 'app',
    build: '35',
    screen: '/assistant',
    screens: '/ → /assistant → /help',
    area: 'Voz',
    account: 'verified',
    premium: true,
    fontSize: 'grande',
    easyMode: false,
    readingVoice: 'Sulafat',
    assistantVoice: 'Achird',
  });
  expect(c).not.toHaveProperty('preview');
  // Solo estos datos técnicos: nada de medicamentos, salud, ubicación ni el nombre del móvil.
  const allowed = ['appVersion', 'runtime', 'platform', 'osVersion', 'payments', 'sentAt', 'build', 'timeZone', 'screen', 'screens', 'area', 'account', 'premium', 'fontSize', 'easyMode', 'readingVoice', 'assistantVoice', 'preview', 'js'];
  expect(Object.keys(c).filter((k) => !allowed.includes(k))).toEqual([]);
  expect(buildReportContext({}).account).toBe('none');
});

test('envía y devuelve la referencia', async () => {
  mockRpc.mockResolvedValue({ data: { ok: true, ref: 'E-7K2PX' }, error: null });
  await expect(ProblemReportService.send('  No se oye la voz  ', ' 600 123 456 ', { area: 'Voz' })).resolves.toEqual({ ref: 'E-7K2PX' });
  const [fn, args] = mockRpc.mock.calls[0] as [string, { p_message: string; p_contact: string | null; p_context: Record<string, unknown> }];
  expect(fn).toBe('report_problem');
  expect(args.p_message).toBe('No se oye la voz');
  expect(args.p_contact).toBe('600 123 456');
  expect(args.p_context.area).toBe('Voz');
});

test('sin contacto se envía null', async () => {
  mockRpc.mockResolvedValue({ data: { ok: true, ref: 'E-AAAAA' }, error: null });
  await ProblemReportService.send('La app se cierra al abrir el asistente', '   ', {});
  expect((mockRpc.mock.calls[0] as [string, { p_contact: unknown }])[1].p_contact).toBeNull();
});

test('no envía un texto demasiado corto', async () => {
  await expect(ProblemReportService.send('mal', '', {})).rejects.toMatchObject({ kind: 'invalid_input' });
  expect(mockRpc).not.toHaveBeenCalled();
});

test('errores claros', async () => {
  mockRpc.mockResolvedValue({ data: null, error: { message: 'RATE_LIMIT' } });
  await expect(ProblemReportService.send('No se oye la voz del asistente', '', {})).rejects.toMatchObject({ kind: 'rate_limited', message: expect.stringMatching(/varios mensajes seguidos/) });
  mockRpc.mockResolvedValue({ data: null, error: { code: 'PGRST202', message: 'Could not find the function public.report_problem' } });
  await expect(ProblemReportService.send('No se oye la voz del asistente', '', {})).rejects.toMatchObject({ kind: 'not_configured' });
});
