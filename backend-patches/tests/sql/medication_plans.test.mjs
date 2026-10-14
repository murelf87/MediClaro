// «Mis pastillas»: prueba la migración 20261009120000_medication_plans.sql en PostgreSQL en memoria (PGlite) con
// dobles mínimos de Supabase (auth.uid, perfiles, Premium, vínculos de cuidador, cron y aviso al repartidor).
// Uso:  node medication_plans.test.mjs <ruta de la migración>      (necesita @electric-sql/pglite)
import { PGlite } from '@electric-sql/pglite';
import fs from 'node:fs';
import assert from 'node:assert/strict';

const migration = fs.readFileSync(process.argv[2], 'utf8').replace(/create extension if not exists pg_cron[^;]*;/i, '');
const db = new PGlite();
await db.exec(`
create role anon; create role authenticated; create role service_role;
create schema auth; create schema mediclaro_private; create schema cron;
grant usage on schema public to authenticated, anon, service_role;
create table auth.users (id uuid primary key);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
grant usage on schema auth to authenticated; grant execute on function auth.uid() to authenticated;
create table public.profiles (id uuid primary key references auth.users(id), sub_state text default 'FREE');
create function public.is_premium(p public.profiles) returns boolean language sql stable as $$ select p.sub_state in ('ACTIVE','TRIAL','PAST_DUE') $$;
create function public.hit_rate_limit(p_user uuid, p_bucket text, p_max int) returns boolean language sql as $$ select true $$;
create table public.care_links (id uuid primary key default gen_random_uuid(), patient_id uuid not null references auth.users(id),
  caregiver_id uuid references auth.users(id), patient_name text not null, caregiver_name text,
  expires_at timestamptz default now() + interval '1 day', accepted_at timestamptz, revoked_at timestamptz, created_at timestamptz default now());
create table public.care_devices (token text primary key, user_id uuid not null references auth.users(id), enabled boolean not null default true);
create table public.wakeups (n int); insert into public.wakeups values (0);
create function public.care_wake_dispatch() returns trigger language plpgsql as $$ begin update public.wakeups set n = n + 1; return null; end $$;
create table cron.job (jobname text primary key, schedule text, command text);
create function cron.schedule(n text, s text, c text) returns bigint language sql as $$ insert into cron.job values (n, s, c) on conflict (jobname) do update set schedule = excluded.schedule, command = excluded.command; select 1::bigint $$;
create function cron.unschedule(n text) returns boolean language sql as $$ delete from cron.job where jobname = n; select true $$;
`);
await db.exec(migration);
await db.exec(migration); // se puede aplicar dos veces

const P = '00000000-0000-4000-8000-00000000000a'; // paciente Premium
const C = '00000000-0000-4000-8000-00000000000c'; // cuidador vinculado
const X = '00000000-0000-4000-8000-00000000000f'; // otra persona
const F = '00000000-0000-4000-8000-0000000000f0'; // cuenta gratuita
const LINK = '00000000-0000-4000-8000-0000000001a1';
await db.exec(`insert into auth.users values ('${P}'), ('${C}'), ('${X}'), ('${F}');
  insert into public.profiles values ('${P}', 'ACTIVE'), ('${C}', 'FREE'), ('${X}', 'ACTIVE'), ('${F}', 'FREE');
  insert into public.care_links (id, patient_id, caregiver_id, patient_name, caregiver_name, accepted_at)
  values ('${LINK}', '${P}', '${C}', 'María', 'Javier', now());
  insert into public.care_devices values ('ExponentPushToken[abcdefghijklmn]', '${C}', true);`);

const uuid = () => crypto.randomUUID();
async function as(user, fn) {
  await db.exec(`reset role; select set_config('request.jwt.claim.sub', '${user}', false); set role authenticated;`);
  try {
    return await fn();
  } finally {
    await db.exec('reset role');
  }
}
const rpc = async (user, sql, params = []) => as(user, async () => (await db.query(sql, params)).rows[0]);
const json = (v) => JSON.stringify(v);
const today = (await db.query(`select current_date::text as d`)).rows[0].d;

// ─── Guardar tratamientos ────────────────────────────────────────────────────────────────────────────────
const T1 = uuid();
const base = {
  id: T1, mutationId: uuid(), name: 'Metformina', strength: '850 mg', doseAmount: 1, doseUnit: 'comprimido',
  frequency: 'daily', times: ['21:00', '15:45', '15:45'], startDate: '2026-10-01', timezone: 'Europe/Madrid',
  prescriptionConfirmed: true, source: 'photo', medicineId: '71269', instructions: 'Con la comida',
};
let r = await rpc(P, `select public.medication_save_treatment($1::jsonb) as r`, [json(base)]);
assert.equal(r.r.treatment.version, 1);
assert.deepEqual(r.r.treatment.times, ['15:45', '21:00'], 'horas ordenadas y sin repetir');
r = await rpc(P, `select public.medication_save_treatment($1::jsonb) as r`, [json(base)]);
assert.equal(r.r.replayed, true, 'reintento idempotente');
assert.equal(r.r.treatment.version, 1);
r = await rpc(P, `select public.medication_save_treatment($1::jsonb) as r`, [json({ ...base, mutationId: uuid(), expectedVersion: 1, notes: 'Desde el móvil A' })]);
assert.equal(r.r.treatment.version, 2);
r = await rpc(P, `select public.medication_save_treatment($1::jsonb) as r`, [json({ ...base, mutationId: uuid(), expectedVersion: 1, notes: 'Desde el móvil B' })]);
assert.equal(r.r.conflict, true, 'un cambio con versión antigua no pisa el del otro teléfono');
assert.equal(r.r.treatment.version, 2);
assert.equal(r.r.treatment.notes, 'Desde el móvil A');

const rejects = async (user, sql, params, code) => {
  await assert.rejects(as(user, () => db.query(sql, params)), new RegExp(code));
};
const saveSql = `select public.medication_save_treatment($1::jsonb)`;
await rejects(F, saveSql, [json({ ...base, id: uuid(), mutationId: uuid() })], 'PREMIUM_REQUIRED');
await rejects(P, saveSql, [json({ ...base, id: uuid(), mutationId: uuid(), prescriptionConfirmed: false })], 'PRESCRIPTION_NOT_CONFIRMED');
await rejects(P, saveSql, [json({ ...base, id: uuid(), mutationId: uuid(), times: ['25:00'] })], 'INVALID_TIMES');
await rejects(P, saveSql, [json({ ...base, id: uuid(), mutationId: uuid(), timezone: 'Marte/Olympus' })], 'INVALID_TIMEZONE');
await rejects(X, saveSql, [json({ ...base, mutationId: uuid() })], 'NOT_ALLOWED');
const T2 = uuid();
await rpc(P, saveSql, [json({ ...base, id: T2, mutationId: uuid(), name: 'Omeprazol', strength: '20 mg', doseUnit: 'capsula', times: ['08:00'], medicineId: '63710' })]);

// ─── Registrar tomas ─────────────────────────────────────────────────────────────────────────────────────
const doseSql = `select public.medication_record_dose($1::jsonb) as r`;
const dose = (o) => json({ treatmentId: T1, occurrenceDate: today, kind: 'taken', clientRecordedAt: new Date().toISOString(), takenAt: new Date(Date.now() - 60_000).toISOString(), timezone: 'Europe/Madrid', ...o });
const E1 = uuid();
r = await rpc(P, doseSql, [dose({ id: E1, scheduledTime: '15:45' })]);
assert.equal(r.r.event.kind, 'taken');
assert.equal(r.r.event.recordedByRole, 'patient');
assert.equal(r.r.event.medicineName, 'Metformina 850 mg');
r = await rpc(P, doseSql, [dose({ id: E1, scheduledTime: '15:45' })]);
assert.equal(r.r.replayed, true, 'el mismo envío dos veces no duplica');
r = await rpc(P, doseSql, [dose({ id: uuid(), scheduledTime: '15:45' })]);
assert.equal(r.r.event.kind, 'extra', 'segunda confirmación de la misma toma → toma adicional');
assert.equal(r.r.possibleDuplicate, true);
assert.equal(r.r.existing.id, E1);
await rejects(P, doseSql, [dose({ id: uuid(), scheduledTime: '15:45', kind: 'skipped', takenAt: null })], 'ALREADY_TAKEN');
// Omitida y luego tomada: la omisión se anula con trazabilidad.
const E3 = uuid(), E4 = uuid();
await rpc(P, doseSql, [dose({ id: E3, scheduledTime: '21:00', kind: 'skipped', takenAt: null })]);
r = await rpc(P, doseSql, [dose({ id: E4, scheduledTime: '21:00' })]);
assert.equal(r.r.event.kind, 'taken');
let rows = (await db.query(`select status, void_reason from public.medication_dose_events where id = $1`, [E3])).rows;
assert.equal(rows[0].status, 'voided');
rows = (await db.query(`select replacement_event_id from public.medication_dose_corrections where event_id = $1`, [E3])).rows;
assert.equal(rows[0].replacement_event_id, E4);
await rejects(P, doseSql, [dose({ id: uuid(), scheduledTime: '21:00', takenAt: new Date(Date.now() + 3_600_000).toISOString() })], 'INVALID_TAKEN_AT');
await rejects(P, doseSql, [dose({ id: uuid(), scheduledTime: '21:00', occurrenceDate: '2020-01-01' })], 'INVALID_OCCURRENCE');

// ─── Correcciones ────────────────────────────────────────────────────────────────────────────────────────
const fixSql = `select public.medication_correct_dose($1::jsonb) as r`;
const FIX = uuid();
const newTime = new Date(Date.now() - 30 * 60_000).toISOString();
r = await rpc(P, fixSql, [json({ id: FIX, eventId: E1, action: 'change_time', newTakenAt: newTime, reason: 'Me la tomé un poco antes' })]);
assert.equal(r.r.voided.status, 'voided');
assert.equal(r.r.replacement.correctsEventId, E1);
assert.equal(r.r.replacement.status, 'active');
r = await rpc(P, fixSql, [json({ id: FIX, eventId: E1, action: 'change_time', newTakenAt: newTime, reason: 'Me la tomé un poco antes' })]);
assert.equal(r.r.replayed, true);
await rejects(P, fixSql, [json({ id: uuid(), eventId: E1, action: 'void', reason: 'Otra vez' })], 'ALREADY_CORRECTED');
await rejects(P, fixSql, [json({ id: uuid(), eventId: E4, action: 'void', reason: '' })], 'REASON_REQUIRED');
rows = (await db.query(`select previous->>'id' as prev from public.medication_dose_corrections where id = $1`, [FIX])).rows;
assert.equal(rows[0].prev, E1, 'se guarda el registro anterior completo');
const totalEvents = Number((await db.query(`select count(*) from public.medication_dose_events`)).rows[0].count);
assert.equal(totalEvents, 5, 'nada se borra: 4 tomas + la corregida');

// ─── Permisos: la app no escribe directamente ────────────────────────────────────────────────────────────
await assert.rejects(as(P, () => db.query(`insert into public.medication_dose_events (id, user_id, treatment_id, kind, client_recorded_at, recorded_by_role, dose_amount, dose_unit, medicine_name, taken_at) values ('${uuid()}', '${P}', '${T1}', 'taken', now(), 'patient', 1, 'comprimido', 'x', now())`)), /permission denied/);
await assert.rejects(as(P, () => db.query(`update public.medication_dose_events set status = 'voided'`)), /permission denied/);
await assert.rejects(as(P, () => db.query(`delete from public.medication_dose_events`)), /permission denied/);

// ─── Cuidador/a: nada sin permiso; ver; confirmar; nunca editar lo que no registró ───────────────────────
const planSql = `select public.medication_get_plan($1::uuid) as r`;
await rejects(C, planSql, [P], 'NOT_ALLOWED');
assert.equal((await as(C, () => db.query(`select * from public.medication_treatments`))).rows.length, 0, 'RLS: sin permiso no ve nada');
await rejects(C, `select public.medication_set_care_permissions($1::uuid, $2::jsonb)`, [LINK, json({ canView: true })], 'NOT_ALLOWED');
await rpc(P, `select public.medication_set_care_permissions($1::uuid, $2::jsonb)`, [LINK, json({ canView: true, canConfirm: false })]);
r = await rpc(C, planSql, [P]);
assert.equal(r.r.access, 'view');
assert.equal(r.r.treatments.length, 2);
assert.equal(r.r.settings, null, 'los ajustes de avisos no se comparten');
assert.equal((await as(C, () => db.query(`select * from public.medication_reminder_events`))).rows.length, 0);
await rejects(C, doseSql, [dose({ id: uuid(), treatmentId: T2, scheduledTime: '08:00' })], 'NOT_ALLOWED');
await rpc(P, `select public.medication_set_care_permissions($1::uuid, $2::jsonb)`, [LINK, json({ canView: true, canConfirm: true })]);
const EC = uuid();
r = await rpc(C, doseSql, [dose({ id: EC, treatmentId: T2, scheduledTime: '08:00' })]);
assert.equal(r.r.event.recordedByRole, 'caregiver');
assert.equal(r.r.event.recordedByName, 'Javier');
await rejects(C, fixSql, [json({ id: uuid(), eventId: E4, action: 'void', reason: 'No era así' })], 'NOT_ALLOWED');
r = await rpc(C, fixSql, [json({ id: uuid(), eventId: EC, action: 'void', reason: 'Me equivoqué de persona' })]);
assert.equal(r.r.voided.status, 'voided');
// Otras personas: nada.
await rejects(X, planSql, [P], 'NOT_ALLOWED');
await rejects(X, doseSql, [dose({ id: uuid(), treatmentId: T2, scheduledTime: '08:00' })], 'NOT_ALLOWED');
assert.equal((await as(X, () => db.query(`select * from public.medication_dose_events`))).rows.length, 0);
// Vínculo retirado → sin acceso.
await db.exec(`update public.care_links set revoked_at = now() where id = '${LINK}'`);
await rejects(C, planSql, [P], 'NOT_ALLOWED');
assert.equal((await as(C, () => db.query(`select * from public.medication_treatments`))).rows.length, 0);

// ─── Avisos (entregado/abierto/aplazado) y ajustes ───────────────────────────────────────────────────────
const R1 = uuid();
const remind = json([{ id: R1, treatmentId: T1, occurrenceDate: today, scheduledTime: '21:00', state: 'opened', at: new Date().toISOString() }]);
r = await rpc(P, `select public.medication_log_reminders($1::jsonb) as r`, [remind]);
assert.equal(r.r.saved, 1);
r = await rpc(P, `select public.medication_log_reminders($1::jsonb) as r`, [remind]);
assert.equal(r.r.saved, 0, 'idempotente');
r = await rpc(X, `select public.medication_log_reminders($1::jsonb) as r`, [json([{ id: uuid(), treatmentId: T1, occurrenceDate: today, scheduledTime: '21:00', state: 'opened' }])]);
assert.equal(r.r.saved, 0, 'no se pueden registrar avisos de otra persona');
r = await rpc(P, `select public.medication_save_settings($1::jsonb) as r`, [json({ repeatAfterMinutes: 15, snoozeMinutes: 10, showMedicineName: false })]);
assert.equal(r.r.repeat_after_minutes, 15);
r = await rpc(P, `select public.medication_get_plan() as r`);
assert.equal(r.r.access, 'owner');
assert.equal(r.r.reminderEvents.length, 1);
assert.equal(r.r.settings.repeat_after_minutes, 15);
assert.ok(r.r.events.length >= 5);
assert.ok(r.r.corrections.length >= 2);

// ─── Avisos al cuidador por tomas sin confirmar ──────────────────────────────────────────────────────────
const LINK2 = uuid();
await db.exec(`insert into public.care_links (id, patient_id, caregiver_id, patient_name, caregiver_name, accepted_at) values ('${LINK2}', '${P}', '${C}', 'María', 'Javier', now())`);
await rpc(P, `select public.medication_set_care_permissions($1::uuid, $2::jsonb)`, [LINK2, json({ canView: true, missedDoseAlerts: true, alertAfterMinutes: 60 })]);
const twoHoursAgo = (await db.query(`select to_char((now() at time zone 'Europe/Madrid') - interval '2 hours', 'HH24:MI') as t,
  ((now() at time zone 'Europe/Madrid') - interval '2 hours')::date::text as d`)).rows[0];
const T3 = uuid();
await rpc(P, saveSql, [json({ ...base, id: T3, mutationId: uuid(), name: 'Enalapril', strength: '10 mg', times: [twoHoursAgo.t], startDate: '2026-01-01' })]);
const wakeBefore = (await db.query(`select n from public.wakeups`)).rows[0].n;
await db.exec(`select mediclaro_private.medication_enqueue_missed_alerts()`);
await db.exec(`select mediclaro_private.medication_enqueue_missed_alerts()`);
let jobs = (await db.query(`select * from public.medication_alert_jobs where treatment_id = '${T3}'`)).rows;
assert.equal(jobs.length, 1, 'un solo aviso por toma aunque el cron pase dos veces');
assert.ok((await db.query(`select n from public.wakeups`)).rows[0].n > wakeBefore, 'despierta al repartidor');
// Las tomas confirmadas no avisan (T1 15:45/21:00 de hoy ya resueltas o futuras no generan aviso indebido).
const claimed = (await db.query(`select public.medication_claim_alert_jobs() as r`)).rows[0].r;
const mine = claimed.find((j) => j.treatment_id === T3);
assert.ok(mine, 'el repartidor recoge el aviso');
assert.equal(mine.patientName, 'María');
assert.deepEqual(mine.tokens, ['ExponentPushToken[abcdefghijklmn]']);
// Si se confirma antes de enviarlo, se cancela.
await db.exec(`update public.medication_alert_jobs set lease_until = null`);
await rpc(P, doseSql, [dose({ id: uuid(), treatmentId: T3, occurrenceDate: twoHoursAgo.d, scheduledTime: twoHoursAgo.t })]);
const again = (await db.query(`select public.medication_claim_alert_jobs() as r`)).rows[0].r;
assert.equal(again.filter((j) => j.treatment_id === T3).length, 0);
jobs = (await db.query(`select provider_state from public.medication_alert_jobs where treatment_id = '${T3}'`)).rows;
assert.equal(jobs[0].provider_state, 'cancelled');
assert.equal((await db.query(`select count(*) from cron.job where jobname = 'mediclaro-medication-missed-doses'`)).rows[0].count, 1);

// ─── RLS activada en todas las tablas y derecho de supresión ─────────────────────────────────────────────
const noRls = (await db.query(`select relname from pg_class where relname like 'medication_%' and relkind = 'r' and not relrowsecurity`)).rows;
assert.deepEqual(noRls, []);
r = await rpc(P, `select public.medication_delete_all() as r`);
assert.equal(r.r.deletedTreatments, 3);
for (const table of ['medication_treatments', 'medication_dose_events', 'medication_dose_corrections', 'medication_reminder_events', 'medication_reminder_settings', 'medication_alert_jobs']) {
  assert.equal(Number((await db.query(`select count(*) from public.${table}`)).rows[0].count), 0, table);
}
console.log('MIGRACION_MIS_PASTILLAS=OK');
