// «Cuando lo necesite»: prueba 20261009120000_medication_plans.sql + 20261011230000_medication_as_needed.sql en PostgreSQL en memoria (PGlite) con
// dobles mínimos de Supabase (auth.uid, perfiles, Premium, vínculos de cuidador, cron y aviso al repartidor).
// Uso:  node medication_as_needed.test.mjs <medication_plans.sql> <medication_as_needed.sql>      (necesita @electric-sql/pglite)
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
const migration2 = fs.readFileSync(process.argv[3], 'utf8');
await db.exec(migration2);
await db.exec(migration2); // se puede aplicar dos veces

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


const rejects = async (user, sql, params, code) => { await assert.rejects(as(user, () => db.query(sql, params)), new RegExp(code)); };
const saveSql = `select public.medication_save_treatment($1::jsonb) as r`;
const T = uuid();
const base = { id: T, mutationId: uuid(), name: 'Paracetamol', strength: '1 g', doseAmount: 1, doseUnit: 'comprimido', frequency: 'as_needed',
  times: ['09:00'], remindersEnabled: true, startDate: today, timezone: 'Europe/Madrid', prescriptionConfirmed: true };

// Sin la migración 2, una pauta «cuando lo necesite» no existía; con ella se guarda sin horas y sin avisos.
let r = await rpc(P, saveSql, [json(base)]);
assert.equal(r.r.treatment.frequency, 'as_needed');
assert.deepEqual(r.r.treatment.times, [], 'sin horas aunque lleguen');
assert.equal(r.r.treatment.remindersEnabled, false, 'sin avisos');
// No genera tomas programadas.
assert.equal((await db.query(`select mediclaro_private.medication_scheduled_on(t, current_date) as s from public.medication_treatments t where id = '${T}'`)).rows[0].s, false);
// Anotar una toma sin hora programada (la hace la persona cuando la necesita).
const E = uuid();
r = await rpc(P, `select public.medication_record_dose($1::jsonb) as r`, [json({ id: E, treatmentId: T, kind: 'taken', takenAt: new Date().toISOString(), source: 'app' })]);
assert.equal(r.r.event.kind, 'taken');
assert.equal(r.r.possibleDuplicate, false);
// Las demás pautas siguen exigiendo horas y una frecuencia válida.
await rejects(P, saveSql, [json({ ...base, id: uuid(), mutationId: uuid(), frequency: 'daily', times: [] })], 'INVALID_TIMES');
await rejects(P, saveSql, [json({ ...base, id: uuid(), mutationId: uuid(), frequency: 'sometimes' })], 'INVALID_FREQUENCY');
// Cambiar una pauta diaria a «cuando lo necesite» y volver.
const D = uuid();
r = await rpc(P, saveSql, [json({ ...base, id: D, mutationId: uuid(), frequency: 'daily', times: ['08:00', '20:00'], remindersEnabled: true })]);
assert.deepEqual(r.r.treatment.times, ['08:00', '20:00']);
r = await rpc(P, saveSql, [json({ ...base, id: D, mutationId: uuid(), expectedVersion: 1, frequency: 'as_needed' })]);
assert.equal(r.r.treatment.frequency, 'as_needed');
assert.equal((await db.query(`select count(*) from public.medication_schedule_times where treatment_id = '${D}'`)).rows[0].count, 0);
console.log('MIGRACION_CUANDO_LO_NECESITE=OK');
