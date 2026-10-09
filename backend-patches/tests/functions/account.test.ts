// Pruebas de la función `account` (RGPD): ORIGINAL frente a PROPUESTA (R-06, exportación completa).
import assert from 'node:assert/strict';
import { callsTo, reset, state } from './fakes/state.ts';
import { loadFunction } from './load.ts';

const original = await loadFunction('../original/account/index.ts');
const patched = await loadFunction('../patched/account/index.ts');

const ME = '00000000-0000-4000-8000-000000000001';
const OTHER = '00000000-0000-4000-8000-000000000002';

function seed() {
  reset();
  state.user = { id: ME, email: null, phone: '34600123456' };
  state.tables = {
    profiles: [
      { id: ME, display_name: 'María', locale: 'es-ES', font_size: 'grande', easy_mode: false, speech_rate: 0.85, sub_state: 'FREE', created_at: '2026-09-01', subscription_id: 'sub_1' },
      { id: OTHER, display_name: 'Otra persona', sub_state: 'FREE' },
    ],
    scans: [
      { user_id: ME, nombre: 'Paracetamol Kern Pharma 1 g', nregistro: '65402', status: 'identified', created_at: '2026-09-20' },
      { user_id: OTHER, nombre: 'Ibuprofeno', nregistro: '1', status: 'identified', created_at: '2026-09-20' },
    ],
    saved_medications: [{ user_id: ME, nombre: 'Paracetamol Kern Pharma 1 g', nregistro: '65402', favorito: true, created_at: '2026-09-20' }],
    consents: [{ user_id: ME, kind: 'ai_processing', version: 'ia-2026-09@2026-09-28T10:00:00.000Z', granted: true, created_at: '2026-09-28' }],
    emergency_profiles: [
      { user_id: ME, full_name: 'María García López', allergies: 'Penicilina', blood_type: 'A+' },
      { user_id: OTHER, full_name: 'Otra persona', allergies: 'Ninguna' },
    ],
    caregiver_links: [
      { owner_id: ME, caregiver_id: null, caregiver_email: 'hija@example.com', status: 'pending', scopes: ['settings'], created_at: '2026-09-21' },
      { owner_id: OTHER, caregiver_id: null, caregiver_email: 'otro@example.com', status: 'pending', scopes: ['settings'], created_at: '2026-09-21' },
    ],
    usage_events: [
      { user_id: ME, kind: 'chat', detail: 'ok', created_at: '2026-09-28' },
      { user_id: OTHER, kind: 'chat', detail: 'ok', created_at: '2026-09-28' },
    ],
    audit_log: [{ user_id: OTHER, action: 'data_exported', created_at: '2026-09-01' }],
  };
}

const call = (fn: (r: Request) => Promise<Response>, body: unknown) =>
  fn(new Request('http://localhost/functions/v1/account', { method: 'POST', body: JSON.stringify(body) }));

Deno.test('R-06: el original NO incluye el perfil de emergencia en «Descargar mis datos»', async () => {
  seed();
  const res = await call(original, { action: 'export' });
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal('emergencyProfile' in data, false);
});

Deno.test('R-06: la propuesta incluye perfil de emergencia, cuidadores, teléfono, actividad y registro de seguridad', async () => {
  seed();
  const res = await call(patched, { action: 'export' });
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.emergencyProfile.full_name, 'María García López');
  assert.equal(data.emergencyProfile.allergies, 'Penicilina');
  assert.equal(data.phone, '34600123456');
  assert.deepEqual(data.caregivers.map((c: { caregiver_email: string }) => c.caregiver_email), ['hija@example.com']);
  assert.equal(data.usageEvents.length, 1);
  assert.deepEqual(data.securityLog, []);
  // Lo que ya exportaba sigue igual
  for (const k of ['exportedAt', 'email', 'profile', 'history', 'myMedications', 'consents']) assert.ok(k in data, `falta ${k}`);
  assert.equal(data.history.length, 1);
  assert.equal(data.consents[0].kind, 'ai_processing');
});

Deno.test('R-06: nunca incluye datos de otras personas', async () => {
  seed();
  const text = await (await call(patched, { action: 'export' })).text();
  assert.equal(text.includes('Otra persona'), false);
  assert.equal(text.includes('Ibuprofeno'), false);
  assert.equal(text.includes('otro@example.com'), false);
});

Deno.test('R-06: sin perfil de emergencia → emergencyProfile null (no falla)', async () => {
  seed();
  state.tables.emergency_profiles = [];
  const data = await (await call(patched, { action: 'export' })).json();
  assert.equal(data.emergencyProfile, null);
});

Deno.test('si una consulta falla → error, no un archivo incompleto (el original entregaba el historial vacío)', async () => {
  seed();
  state.failNext['scans:select'] = { code: '57014', message: 'timeout' };
  const r1 = await call(original, { action: 'export' });
  assert.equal(r1.status, 200, 'ORIGINAL: entrega el archivo…');
  assert.equal((await r1.json()).history, null, '…con el historial vacío sin avisar');

  seed();
  state.failNext['scans:select'] = { code: '57014', message: 'timeout' };
  const r2 = await call(patched, { action: 'export' });
  assert.equal(r2.status, 500);
  assert.equal(callsTo('audit_log', 'insert').length, 0, 'no se registra como exportado');
});

Deno.test('la exportación queda registrada (data_exported)', async () => {
  seed();
  await call(patched, { action: 'export' });
  const inserts = callsTo('audit_log', 'insert');
  assert.equal(inserts.length, 1);
  assert.equal(inserts[0].payload.action, 'data_exported');
  assert.equal(inserts[0].payload.user_id, ME);
});

Deno.test('eliminar cuenta (sin cambios): exige «ELIMINAR», cancela el cobro y borra a la persona', async () => {
  seed();
  const bad = await call(patched, { action: 'delete', confirm: 'si' });
  assert.equal(bad.status, 400);
  assert.equal(state.deletedUsers.length, 0);
  const ok = await call(patched, { action: 'delete', confirm: 'ELIMINAR' });
  assert.equal(ok.status, 200);
  assert.deepEqual(await ok.json(), { deleted: true });
  assert.deepEqual(state.canceledSubscriptions, ['sub_1']);
  assert.deepEqual(state.deletedUsers, [ME]);
});

Deno.test('acción desconocida → 400', async () => {
  seed();
  assert.equal((await call(patched, { action: 'otra' })).status, 400);
});
