// Pruebas de comportamiento de las migraciones propuestas (backend-patches/migrations).
// 1) Sobre el esquema ACTUAL (supabase/migrations) se reproducen los fallos R-01, R-05, R-07 y R-09.
// 2) Con los parches aplicados encima, se comprueba que quedan corregidos y que no se abre ningún permiso.
//
// Ejecutar:  cd backend-patches/tests && npm install && npm test
import { describe, test, before } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { applyFile, applyMigrations, asAnon, asService, asUser, createDb, createUser, errorCode } from './sim.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const ORIGINAL = process.env.MIGRATIONS_DIR ?? path.resolve(here, '../../supabase/migrations');
const PATCHES = path.resolve(here, '../migrations');
const R01 = path.join(PATCHES, '20260928090000_r01_sub_state_sync.sql');

// ── Ayudas que imitan a las Edge Functions (service_role) y a la app (authenticated) ──────────────────

/** Lo que escribe hoy el webhook de Stripe en `profiles` (plan + estado + periodo). */
async function webhookWrites(db, userId, status, { periodStart = null } = {}) {
  const premium = ['active', 'trialing', 'past_due'].includes(status);
  await asService(db, () =>
    db.query(
      `update public.profiles set plan = $2, subscription_status = $3, current_period_start = $4, updated_at = now() where id = $1`,
      [userId, premium ? 'premium' : 'free', status, periodStart],
    ),
  );
}

async function subState(db, userId) {
  const r = await asService(db, () => db.query('select sub_state from public.profiles where id = $1', [userId]));
  return r.rows[0].sub_state;
}

async function accountStatus(db, userId) {
  const r = await asUser(db, userId, () => db.query('select public.get_account_status() as s'));
  return r.rows[0].s;
}

/** Lo que hace identify-medicine al terminar una identificación. */
async function consumeScan(db, userId, status = 'identified') {
  const r = await asService(db, () =>
    db.query(`select public.consume_scan($1, $2, '65402', 'Paracetamol Kern Pharma 1 g', 0.95, 'barcode') as r`, [userId, status]),
  );
  return r.rows[0].r;
}

async function canScan(db, userId) {
  const r = await asService(db, () => db.query('select public.can_scan($1) as ok', [userId]));
  return r.rows[0].ok;
}

async function canChat(db, userId) {
  const r = await asService(db, () => db.query('select public.can_chat($1) as ok', [userId]));
  return r.rows[0].ok;
}

/** Lo que registra el chat (metrics.logEvent). `at` en SQL, p. ej. "now()". */
async function logChat(db, userId, detail = 'ok', at = 'now()') {
  await asService(db, () =>
    db.query(`insert into public.usage_events (user_id, kind, detail, created_at) values ($1, 'chat', $2, ${at})`, [userId, detail]),
  );
}

async function freshOriginal() {
  const db = await createDb();
  await applyMigrations(db, ORIGINAL);
  return db;
}

async function freshPatched() {
  const db = await freshOriginal();
  await applyMigrations(db, PATCHES);
  return db;
}

// ── 1) El esquema actual: se reproducen los fallos ─────────────────────────────────────────────────────

describe('Esquema actual (sin parches): se reproducen los fallos documentados', () => {
  let db;
  before(async () => {
    db = await freshOriginal();
  });

  test('R-01: con la suscripción activa en Stripe, el servidor sigue aplicando el plan gratuito', async () => {
    const u = await createUser(db, '+34600000101');
    await webhookWrites(db, u, 'active', { periodStart: '2026-09-01T00:00:00Z' });
    assert.equal(await subState(db, u), 'FREE');
    const s = await accountStatus(db, u);
    assert.equal(s.plan, 'free');
    assert.equal(s.included_scans, 5);
    for (let i = 0; i < 10; i += 1) await logChat(db, u);
    assert.equal(await canChat(db, u), false, 'con 10 preguntas ya no puede seguir, aunque paga Premium (200/día)');
  });

  test('R-07: borrando sus filas de `scans` la persona reinicia la cuota gratuita', async () => {
    const u = await createUser(db, '+34600000102');
    for (let i = 0; i < 5; i += 1) assert.equal((await consumeScan(db, u)).allowed, true);
    assert.equal(await canScan(db, u), false);
    const del = await asUser(db, u, () => db.query('delete from public.scans where user_id = auth.uid()'));
    assert.equal(del.affectedRows, 5, 'la API le deja borrar sus 5 filas');
    assert.equal(await canScan(db, u), true, 'y vuelve a tener cuota');
  });

  test('R-05: guardar `phone` o `additional_info` en el perfil de emergencia falla (columna inexistente)', async () => {
    const u = await createUser(db, '+34600000103');
    const code = await errorCode(
      asUser(db, u, () => db.query(`insert into public.emergency_profiles (user_id, phone) values (auth.uid(), '+34600000000')`)),
    );
    assert.equal(code, '42703');
  });

  test('R-09: `get_account_status()` no dice cuántas preguntas quedan hoy', async () => {
    const u = await createUser(db, '+34600000104');
    const s = await accountStatus(db, u);
    assert.equal('chats_today' in s, false);
    assert.equal('chat_per_day' in s, false);
  });
});

// ── 2) Con los parches ─────────────────────────────────────────────────────────────────────────────────

describe('Parches: aplicación', () => {
  test('se aplican sobre el esquema actual sin errores y se pueden aplicar dos veces', async () => {
    const db = await freshOriginal();
    const files = await applyMigrations(db, PATCHES);
    assert.equal(files.length, 4);
    await applyMigrations(db, PATCHES);
  });
});

describe('R-01 · sub_state se deriva siempre del plan y del estado de la suscripción', () => {
  let db;
  before(async () => {
    db = await freshPatched();
  });

  for (const [status, expected] of [
    ['active', 'ACTIVE'],
    ['trialing', 'TRIAL'],
    ['past_due', 'PAST_DUE'],
    ['canceled', 'CANCELLED'],
    ['unpaid', 'EXPIRED'],
    ['incomplete_expired', 'EXPIRED'],
    ['incomplete', 'FREE'],
    ['paused', 'FREE'],
  ]) {
    test(`Stripe «${status}» → ${expected}`, async () => {
      const u = await createUser(db);
      await webhookWrites(db, u, status);
      assert.equal(await subState(db, u), expected);
    });
  }

  test('plan «premium» sin estado de pago → FREE (doble comprobación)', async () => {
    const u = await createUser(db);
    await asService(db, () => db.query(`update public.profiles set plan = 'premium', subscription_status = null where id = $1`, [u]));
    assert.equal(await subState(db, u), 'FREE');
  });

  test('una cuenta nueva empieza en FREE', async () => {
    const u = await createUser(db);
    assert.equal(await subState(db, u), 'FREE');
  });

  test('con Premium activo se aplican los límites Premium: 100 incluidas, 200 preguntas/día', async () => {
    const u = await createUser(db);
    await webhookWrites(db, u, 'active', { periodStart: new Date(Date.now() - 86400000).toISOString() });
    const s = await accountStatus(db, u);
    assert.equal(s.plan, 'premium');
    assert.equal(s.state, 'ACTIVE');
    assert.equal(s.included_scans, 100);
    assert.equal(s.chat_per_day, 200);
    for (let i = 0; i < 10; i += 1) await logChat(db, u);
    assert.equal(await canChat(db, u), true);
  });

  test('Premium: a partir de la identificación 101 se marca como uso adicional (se factura)', async () => {
    const u = await createUser(db);
    await webhookWrites(db, u, 'active', { periodStart: new Date(Date.now() - 86400000).toISOString() });
    let last;
    for (let i = 0; i < 101; i += 1) last = await consumeScan(db, u);
    assert.equal(last.allowed, true);
    assert.equal(last.overage, true);
    assert.equal((await accountStatus(db, u)).scans_this_period, 101);
  });

  test('al cancelar (canceled) vuelve al plan gratuito', async () => {
    const u = await createUser(db);
    await webhookWrites(db, u, 'active');
    await webhookWrites(db, u, 'canceled');
    const s = await accountStatus(db, u);
    assert.equal(s.plan, 'free');
    assert.equal(s.state, 'CANCELLED');
    assert.equal(s.included_scans, 5);
  });

  test('corrige las cuentas que ya pagaban antes de aplicar el parche', async () => {
    const old = await freshOriginal();
    const u = await createUser(old);
    await webhookWrites(old, u, 'active');
    assert.equal(await subState(old, u), 'FREE');
    await applyFile(old, R01);
    assert.equal(await subState(old, u), 'ACTIVE');
    assert.equal((await accountStatus(old, u)).plan, 'premium');
  });

  test('la persona no puede darse Premium a sí misma desde la app', async () => {
    const u = await createUser(db);
    const r = await asUser(db, u, () =>
      db.query(`update public.profiles set plan = 'premium', subscription_status = 'active', sub_state = 'ACTIVE' where id = auth.uid()`),
    );
    assert.equal(r.affectedRows, 0);
    assert.equal(await subState(db, u), 'FREE');
    assert.equal((await accountStatus(db, u)).plan, 'free');
  });

  test('guardar ajustes (update_my_settings) sigue funcionando y no toca el plan', async () => {
    const u = await createUser(db);
    await webhookWrites(db, u, 'active');
    await asUser(db, u, () => db.query(`select public.update_my_settings('{"font_size":"muy_grande","easy_mode":true}'::jsonb)`));
    const s = await accountStatus(db, u);
    assert.equal(s.settings.font_size, 'muy_grande');
    assert.equal(s.settings.easy_mode, true);
    assert.equal(s.state, 'ACTIVE');
  });
});

describe('R-07 · borrar el historial sin reiniciar la cuota', () => {
  let db;
  before(async () => {
    db = await freshPatched();
  });

  test('la API ya no deja borrar filas de `scans`: la cuota no se reinicia', async () => {
    const u = await createUser(db);
    for (let i = 0; i < 5; i += 1) await consumeScan(db, u);
    const del = await asUser(db, u, () => db.query('delete from public.scans where user_id = auth.uid()'));
    assert.equal(del.affectedRows, 0);
    assert.equal(await canScan(db, u), false);
  });

  test('clear_scan_history(): la persona deja de verlo, se borra qué medicamento era y la cuota se mantiene', async () => {
    const u = await createUser(db);
    for (let i = 0; i < 3; i += 1) await consumeScan(db, u);
    await consumeScan(db, u, 'not_found');
    const before = await accountStatus(db, u);
    const n = await asUser(db, u, () => db.query('select public.clear_scan_history() as n'));
    assert.equal(n.rows[0].n, 4);
    const visible = await asUser(db, u, () => db.query('select * from public.scans'));
    assert.equal(visible.rows.length, 0);
    const stored = await asService(db, () =>
      db.query('select nombre, nregistro, score, confidence, method, status, hidden_at from public.scans where user_id = $1', [u]),
    );
    assert.equal(stored.rows.length, 4);
    for (const row of stored.rows) {
      assert.equal(row.nombre, null);
      assert.equal(row.nregistro, null);
      assert.equal(row.score, null);
      assert.equal(row.confidence, null);
      assert.equal(row.method, null);
      assert.ok(row.hidden_at instanceof Date);
    }
    assert.deepEqual(stored.rows.map((r) => r.status).sort(), ['identified', 'identified', 'identified', 'not_found']);
    const after = await accountStatus(db, u);
    assert.equal(after.scans_this_period, before.scans_this_period);
    assert.equal(after.free_scans_left, before.free_scans_left);
  });

  test('se puede borrar solo una identificación', async () => {
    const u = await createUser(db);
    const a = await consumeScan(db, u);
    await consumeScan(db, u);
    const n = await asUser(db, u, () => db.query('select public.clear_scan_history($1::bigint[]) as n', [[a.scan_id]]));
    assert.equal(n.rows[0].n, 1);
    const visible = await asUser(db, u, () => db.query('select id from public.scans'));
    assert.equal(visible.rows.length, 1);
  });

  test('no puede borrar el historial de otra persona', async () => {
    const owner = await createUser(db);
    const other = await createUser(db);
    const a = await consumeScan(db, owner);
    const n = await asUser(db, other, () => db.query('select public.clear_scan_history($1::bigint[]) as n', [[a.scan_id]]));
    assert.equal(n.rows[0].n, 0);
    const visible = await asUser(db, owner, () => db.query('select nombre from public.scans'));
    assert.equal(visible.rows.length, 1);
    assert.equal(visible.rows[0].nombre, 'Paracetamol Kern Pharma 1 g');
  });

  test('sin sesión no se puede llamar', async () => {
    assert.equal(await errorCode(asAnon(db, () => db.query('select public.clear_scan_history()'))), '42501');
  });
});

describe('R-05 · perfil de emergencia con las columnas que faltaban', () => {
  let db;
  before(async () => {
    db = await freshPatched();
  });

  test('la persona guarda y lee su teléfono, información adicional, servicio privado y médico', async () => {
    const u = await createUser(db);
    await asUser(db, u, () =>
      db.query(
        `insert into public.emergency_profiles (user_id, full_name, phone, additional_info, private_assistance_name,
           private_assistance_phone, primary_doctor_name, primary_doctor_phone)
         values (auth.uid(), 'María García López', '+34600123456', 'Marcapasos', 'Teleasistencia Municipal', '900123456',
           'Dra. Ruiz', '910000000')
         on conflict (user_id) do update set phone = excluded.phone`,
      ),
    );
    const r = await asUser(db, u, () => db.query('select * from public.emergency_profiles'));
    assert.equal(r.rows.length, 1);
    assert.equal(r.rows[0].phone, '+34600123456');
    assert.equal(r.rows[0].additional_info, 'Marcapasos');
    assert.equal(r.rows[0].private_assistance_phone, '900123456');
    assert.equal(r.rows[0].primary_doctor_name, 'Dra. Ruiz');
    assert.ok(r.rows[0].created_at instanceof Date);
  });

  test('otra persona no lo ve ni lo puede cambiar; sin sesión tampoco', async () => {
    const owner = await createUser(db);
    const other = await createUser(db);
    await asUser(db, owner, () => db.query(`insert into public.emergency_profiles (user_id, phone) values (auth.uid(), '+34600999999')`));
    const seen = await asUser(db, other, () => db.query('select * from public.emergency_profiles where user_id = $1', [owner]));
    assert.equal(seen.rows.length, 0);
    const upd = await asUser(db, other, () => db.query(`update public.emergency_profiles set phone = 'x' where user_id = $1`, [owner]));
    assert.equal(upd.affectedRows, 0);
    const anon = await asAnon(db, () => db.query('select * from public.emergency_profiles'));
    assert.equal(anon.rows.length, 0);
  });

  test('borrar el perfil de emergencia (botón de la app) sigue funcionando', async () => {
    const u = await createUser(db);
    await asUser(db, u, () => db.query(`insert into public.emergency_profiles (user_id, phone) values (auth.uid(), '+34600111111')`));
    const del = await asUser(db, u, () => db.query('delete from public.emergency_profiles where user_id = auth.uid()'));
    assert.equal(del.affectedRows, 1);
  });
});

describe('R-09 + R-10 · preguntas de hoy y cancelación en get_account_status()', () => {
  let db;
  before(async () => {
    db = await freshPatched();
  });

  test('cuenta las preguntas de hoy y las restantes; las de emergencia no gastan', async () => {
    const u = await createUser(db);
    for (let i = 0; i < 3; i += 1) await logChat(db, u, 'ok');
    await logChat(db, u, 'emergency');
    const s = await accountStatus(db, u);
    assert.equal(s.chats_today, 3);
    assert.equal(s.chat_per_day, 10);
    assert.equal(s.chats_left_today, 7);
  });

  test('el límite (can_chat) usa el mismo recuento que se muestra', async () => {
    const u = await createUser(db);
    for (let i = 0; i < 9; i += 1) await logChat(db, u, 'ok');
    for (let i = 0; i < 5; i += 1) await logChat(db, u, 'emergency');
    assert.equal(await canChat(db, u), true);
    await logChat(db, u, 'ok');
    assert.equal(await canChat(db, u), false);
    assert.equal((await accountStatus(db, u)).chats_left_today, 0);
  });

  test('el día empieza a las 00:00 de España', async () => {
    const r = await db.query(`select to_char(public.chat_day_start() at time zone 'Europe/Madrid', 'HH24:MI:SS') as t`);
    assert.equal(r.rows[0].t, '00:00:00');
    const u = await createUser(db);
    await logChat(db, u, 'ok', `public.chat_day_start() - interval '1 minute'`);
    await logChat(db, u, 'ok', `public.chat_day_start() + interval '1 minute'`);
    assert.equal((await accountStatus(db, u)).chats_today, 1);
  });

  test('Premium: 200 preguntas al día', async () => {
    const u = await createUser(db);
    await webhookWrites(db, u, 'active');
    const s = await accountStatus(db, u);
    assert.equal(s.chat_per_day, 200);
    assert.equal(s.chats_left_today, 200);
  });

  test('devuelve cancel_at_period_end (R-10)', async () => {
    const u = await createUser(db);
    await webhookWrites(db, u, 'active');
    assert.equal((await accountStatus(db, u)).cancel_at_period_end, false);
    await asService(db, () => db.query('update public.profiles set cancel_at_period_end = true where id = $1', [u]));
    const s = await accountStatus(db, u);
    assert.equal(s.cancel_at_period_end, true);
    assert.equal(s.plan, 'premium', 'sigue siendo Premium hasta el final del periodo');
  });

  test('mantiene todos los campos que ya leía la app', async () => {
    const u = await createUser(db);
    const s = await accountStatus(db, u);
    for (const k of ['plan', 'state', 'period_end', 'scans_this_period', 'included_scans', 'free_scans_left', 'settings']) {
      assert.ok(k in s, `falta ${k}`);
    }
  });
});

describe('Seguridad: los parches no abren permisos', () => {
  let db;
  before(async () => {
    db = await freshPatched();
  });

  test('sin sesión no se puede consultar el estado de la cuenta', async () => {
    assert.equal(await errorCode(asAnon(db, () => db.query('select public.get_account_status()'))), '42501');
  });

  test('la app no puede llamar a las funciones internas del servidor', async () => {
    const u = await createUser(db);
    for (const sql of [
      `select public.consume_scan('${u}', 'identified', null, null, 1, 'barcode')`,
      `select public.can_scan('${u}')`,
      `select public.can_chat('${u}')`,
      `select public.chats_today('${u}')`,
      'select public.chat_day_start()',
      `select public.hit_rate_limit('${u}', 'chat', 100)`,
    ]) {
      assert.equal(await errorCode(asUser(db, u, () => db.query(sql))), '42501', sql);
    }
  });

  test('la app no puede leer datos de otras personas ni tablas internas', async () => {
    const a = await createUser(db);
    const b = await createUser(db);
    await consumeScan(db, a);
    await logChat(db, a);
    const scans = await asUser(db, b, () => db.query('select * from public.scans'));
    assert.equal(scans.rows.length, 0);
    const profiles = await asUser(db, b, () => db.query('select * from public.profiles'));
    assert.deepEqual(profiles.rows.map((r) => r.id), [b]);
    const events = await asUser(db, b, () => db.query('select * from public.usage_events'));
    assert.equal(events.rows.length, 0);
  });

  test('el permiso para la IA de la app se registra en `consents` (kind ai_processing) solo para uno mismo', async () => {
    const a = await createUser(db);
    const b = await createUser(db);
    const ok = await errorCode(
      asUser(db, a, () =>
        db.query(
          `insert into public.consents (user_id, kind, version, granted) values (auth.uid(), 'ai_processing', 'ia-2026-09@2026-09-28T10:00:00.000Z', true)`,
        ),
      ),
    );
    assert.equal(ok, 'OK');
    const dup = await errorCode(
      asUser(db, a, () =>
        db.query(
          `insert into public.consents (user_id, kind, version, granted) values (auth.uid(), 'ai_processing', 'ia-2026-09@2026-09-28T10:00:00.000Z', true)`,
        ),
      ),
    );
    assert.equal(dup, '23505', 'un reintento del mismo registro da 23505 (la app lo trata como ya registrado)');
    const forOther = await errorCode(
      asUser(db, b, () =>
        db.query(`insert into public.consents (user_id, kind, version, granted) values ($1, 'ai_processing', 'x', true)`, [a]),
      ),
    );
    assert.equal(forOther, '42501');
  });
});
