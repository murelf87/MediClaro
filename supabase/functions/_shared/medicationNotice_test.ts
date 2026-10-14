import { medicationNoticePushPayload } from './caregiverPush.ts';
function assert(c: unknown, m = 'assert') { if (!c) throw new Error(m); }

Deno.test('aviso de toma: dice quién y a qué hora, sin medicamento ni dosis', () => {
  const p = medicationNoticePushPayload('ExponentPushToken[abcdefghijkl]', 'taken', 'Marina', 'patient', '09:00');
  assert(p.body.includes('Marina') && p.body.includes('09:00'));
  assert(!/mg|comprimido|ibuprofeno/i.test(p.title + p.body));
  assert(p.priority === 'high' && p.data.kind === 'medication_notice');
});
Deno.test('aviso de cambio de tratamiento para cada tipo', () => {
  for (const k of ['added', 'changed', 'suspended', 'deleted', 'skipped']) {
    const p = medicationNoticePushPayload('t', k, 'Luis', 'caregiver');
    assert(p.title.startsWith('MediClaro: ') && p.body.includes('Luis'), k);
  }
});
Deno.test('sin nombre usa una frase neutra según quién lo hizo', () => {
  assert(medicationNoticePushPayload('t', 'changed', '', 'caregiver').body.includes('Tu cuidador/a'));
  assert(medicationNoticePushPayload('t', 'changed', undefined, 'patient').body.includes('Tu familiar'));
});
