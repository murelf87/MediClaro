// Panel del propietario: prueba la migración 20261009170000_owner_admin_panel.sql en PostgreSQL en memoria (PGlite)
// con dobles mínimos de Supabase (auth.uid, usuarios con teléfono, perfiles, propietario por teléfono, Premium de
// cortesía, tablas de uso, cron). Sin red ni claves.
// Uso:  node owner_admin.test.mjs <ruta de la migración>      (necesita @electric-sql/pglite)
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import fs from 'node:fs';
import assert from 'node:assert/strict';

const migration = fs.readFileSync(process.argv[2], 'utf8').replace(/create extension if not exists pg_cron[^;]*;/i, '');
const db = new PGlite({ extensions: { pgcrypto } });
await db.exec(`
create role anon; create role authenticated; create role service_role;
create schema auth; create schema mediclaro_private; create schema cron; create schema extensions;
create extension pgcrypto with schema extensions;
grant usage on schema public to authenticated, anon, service_role;
create table auth.users (id uuid primary key, phone text, phone_confirmed_at timestamptz, is_anonymous boolean default false,
  last_sign_in_at timestamptz, created_at timestamptz default now());
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
grant usage on schema auth to authenticated, anon; grant execute on function auth.uid() to authenticated, anon;
create table public.profiles (id uuid primary key references auth.users(id) on delete cascade, display_name text,
  plan text not null default 'free', subscription_id text, billing_provider text not null default 'stripe', sub_state text not null default 'FREE',
  current_period_start timestamptz, current_period_end timestamptz, cancel_at_period_end boolean not null default false,
  paid_by_family boolean not null default false, created_at timestamptz not null default now());
-- Propietario y Premium de cortesía: copia de 20261002165000_owner_dashboard y 20261004130000_owner_premium_grants.
create table mediclaro_private.owner_phones (phone_hash text primary key, enabled boolean not null default true);
create function mediclaro_private.is_owner(p_user uuid) returns boolean language sql stable security definer set search_path=pg_catalog as $$
 select exists (select 1 from auth.users u join mediclaro_private.owner_phones o
  on o.phone_hash=encode(extensions.digest(regexp_replace(u.phone,'[^0-9]','','g'),'sha256'),'hex')
  where u.id=p_user and u.phone_confirmed_at is not null and not coalesce(u.is_anonymous,false) and o.enabled) $$;
create table mediclaro_private.premium_grants (phone text primary key check (phone ~ '^[1-9][0-9]{7,14}$'), granted_by uuid not null,
  granted_at timestamptz not null default now(), expires_at timestamptz, revoked_at timestamptz);
create function mediclaro_private.has_courtesy(p_user uuid) returns boolean language sql stable security definer set search_path=pg_catalog as $$
 select exists(select 1 from auth.users u join mediclaro_private.premium_grants g on g.phone=regexp_replace(u.phone,'[^0-9]','','g')
  where u.id=p_user and u.phone_confirmed_at is not null and not coalesce(u.is_anonymous,false) and g.revoked_at is null
   and (g.expires_at is null or g.expires_at>now())) $$;
create function public.is_premium(p public.profiles) returns boolean language sql stable security definer set search_path=pg_catalog as $$
 select mediclaro_private.is_owner(p.id) or mediclaro_private.has_courtesy(p.id) or p.sub_state in ('TRIAL','ACTIVE','PAST_DUE') $$;
create function public.hit_rate_limit(p_user uuid, p_bucket text, p_max int) returns boolean language sql as $$ select true $$;
create table public.audit_log (id bigint generated always as identity primary key, user_id uuid, action text not null, meta jsonb, created_at timestamptz not null default now());
create table public.care_links (id uuid primary key default gen_random_uuid(), patient_id uuid not null references auth.users(id) on delete cascade,
  caregiver_id uuid references auth.users(id) on delete cascade, patient_name text not null, caregiver_name text,
  accepted_at timestamptz, revoked_at timestamptz, created_at timestamptz default now());
create table public.scans (id bigint generated always as identity primary key, user_id uuid not null, created_at timestamptz not null default now());
create table public.usage_events (id bigint generated always as identity primary key, user_id uuid, kind text not null, detail text,
  cost_micros int not null default 0, created_at timestamptz not null default now());
create table public.medication_dose_events (id uuid primary key default gen_random_uuid(), user_id uuid not null, kind text not null,
  status text not null default 'active', recorded_at timestamptz not null default now());
create table public.care_incidents (id uuid primary key default gen_random_uuid(), patient_id uuid not null, state text not null default 'active',
  created_at timestamptz not null default now(), expires_at timestamptz not null default now() + interval '2 hours');
create table public.emergency_contact_attempts (id uuid primary key default gen_random_uuid(), user_id uuid not null, created_at timestamptz not null default now());
create table public.care_chat_messages (id uuid primary key default gen_random_uuid(), kind text not null default 'text', created_at timestamptz not null default now());
create table public.care_link_calls (id uuid primary key default gen_random_uuid(), created_at timestamptz not null default now());
create table public.store_subscriptions (id bigint generated always as identity primary key, user_id uuid not null, platform text not null,
  product_id text not null, status text not null, expires_at timestamptz, auto_renew boolean, last_verified_at timestamptz not null default now());
create table public.app_config (key text primary key, value jsonb not null, description text, updated_at timestamptz not null default now());
alter table public.app_config enable row level security;
create table public.care_push_jobs (id uuid primary key default gen_random_uuid(), created_at timestamptz not null default now(),
  sent_at timestamptz, attempts int not null default 0, provider_state text not null default 'pending');
create table public.medication_alert_jobs (id uuid primary key default gen_random_uuid(), created_at timestamptz not null default now(),
  sent_at timestamptz, attempts int not null default 0, provider_state text not null default 'pending');
create table cron.job (jobid bigserial, jobname text primary key, schedule text, command text, active boolean not null default true);
create table cron.job_run_details (jobid bigint, status text, start_time timestamptz);
create function cron.schedule(n text, s text, c text) returns bigint language sql as $$ insert into cron.job (jobname, schedule, command) values (n, s, c) on conflict (jobname) do update set schedule = excluded.schedule, command = excluded.command returning jobid $$;
create function cron.unschedule(n text) returns boolean language sql as $$ delete from cron.job where jobname = n; select true $$;
`);
await db.exec(migration);
await db.exec(migration); // se puede aplicar dos veces

// Personas: O = propietario (teléfono en owner_phones), O2 = segundo teléfono de propietario, A = paciente gratis con
// teléfono, B = Premium de pago, C = cuidadora, N = cuenta sin teléfono (anónima), D = paciente gratis (Bizum caducado).
const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const O = id(1), O2 = id(2), A = id(10), B = id(11), C = id(12), N = id(13), D = id(14);
const phones = { [O]: '34600000001', [O2]: '34600000002', [A]: '34611222333', [B]: '34622333444', [C]: '34633444555', [D]: '34644555666' };
await db.exec(`
insert into auth.users (id, phone, phone_confirmed_at, is_anonymous) values
  ('${O}', '${phones[O]}', now(), false), ('${O2}', '${phones[O2]}', now(), false), ('${A}', '${phones[A]}', now(), false),
  ('${B}', '${phones[B]}', now(), false), ('${C}', '${phones[C]}', now(), false), ('${N}', null, null, true), ('${D}', '${phones[D]}', now(), false);
insert into mediclaro_private.owner_phones (phone_hash) values
  (encode(extensions.digest('${phones[O]}', 'sha256'), 'hex')), (encode(extensions.digest('${phones[O2]}', 'sha256'), 'hex'));
insert into public.profiles (id, display_name, plan, subscription_id, billing_provider, sub_state, current_period_start, current_period_end, created_at) values
  ('${O}', 'Antonio', 'free', null, 'stripe', 'FREE', null, null, now() - interval '30 days'),
  ('${O2}', 'Socia', 'free', null, 'stripe', 'FREE', null, null, now() - interval '29 days'),
  ('${A}', 'Carmen García', 'free', null, 'stripe', 'FREE', null, null, now() - interval '5 days'),
  ('${B}', 'Luis Martínez', 'premium', 'sub_123', 'apple', 'ACTIVE', now() - interval '10 days', now() + interval '20 days', now() - interval '4 days'),
  ('${C}', 'Ana López', 'free', null, 'stripe', 'FREE', null, null, now() - interval '3 days'),
  ('${N}', null, 'free', null, 'stripe', 'FREE', null, null, now() - interval '2 days'),
  ('${D}', 'María Torres', 'free', 'bizum-old', 'stripe', 'EXPIRED', now() - interval '60 days', now() - interval '30 days', now() - interval '1 days');
insert into public.care_links (patient_id, caregiver_id, patient_name, caregiver_name, accepted_at) values ('${A}', '${C}', 'Carmen', 'Ana', now());
insert into public.store_subscriptions (user_id, platform, product_id, status, expires_at, auto_renew) values
  ('${B}', 'apple', 'com.mediclaro.app.premium.monthly', 'active', now() + interval '20 days', true);
insert into public.scans (user_id, created_at) values ('${A}', now() - interval '1 day'), ('${B}', now() - interval '2 days'), ('${B}', now() - interval '40 days');
insert into public.usage_events (user_id, kind, detail, cost_micros, created_at) values
  ('${A}', 'chat', null, 1200, now() - interval '1 hour'), ('${B}', 'chat', 'emergency', 0, now() - interval '1 hour'),
  ('${B}', 'error', 'cima_down', 0, now() - interval '2 hours');
insert into public.medication_dose_events (user_id, kind, status, recorded_at) values
  ('${A}', 'taken', 'active', now() - interval '3 hours'), ('${A}', 'skipped', 'active', now() - interval '3 hours'),
  ('${A}', 'taken', 'voided', now() - interval '3 hours'), ('${B}', 'extra', 'active', now() - interval '1 day');
insert into public.care_incidents (patient_id, created_at) values ('${A}', now() - interval '1 day');
insert into public.emergency_contact_attempts (user_id, created_at) values ('${B}', now() - interval '2 days');
insert into public.care_chat_messages (kind) values ('text'), ('text'), ('call');
insert into public.care_link_calls default values;
insert into public.care_push_jobs (sent_at, provider_state) values (null, 'pending'), (now(), 'provider_delivered'), (now(), 'provider_failed');
insert into public.audit_log (user_id, action, meta) values ('${A}', 'data_exported', '{}');
insert into public.app_config (key, value) values ('plans', '{"storeVerification": false}');
insert into cron.job_run_details (jobid, status, start_time) select jobid, 'succeeded', now() from cron.job where jobname = 'mediclaro-owner-cleanup';
`);

async function as(user, fn) {
  await db.exec(`reset role; select set_config('request.jwt.claim.sub', '${user ?? ''}', false); set role ${user ? 'authenticated' : 'anon'};`);
  try {
    return await fn();
  } finally {
    await db.exec('reset role');
  }
}
const admin = async (user, action, payload = {}) =>
  as(user, async () => (await db.query(`select public.owner_admin($1, $2::jsonb) as r`, [action, JSON.stringify(payload)])).rows[0].r);
const rejects = async (user, action, payload, code) => {
  await assert.rejects(admin(user, action, payload), new RegExp(code), `${action} debería fallar con ${code}`);
};
const sql = async (q, p = []) => (await db.query(q, p)).rows;
const premium = async (u) => (await sql(`select public.is_premium(p) as v from public.profiles p where id = $1`, [u]))[0].v;

// ── Quién puede entrar ──────────────────────────────────────────────────────────────────────────────────
await rejects(null, 'status', {}, 'AUTH_REQUIRED|permission denied');
await rejects(A, 'status', {}, 'OWNER_REQUIRED');
await rejects(B, 'overview', {}, 'OWNER_REQUIRED');
await assert.rejects(as(A, () => db.query('select * from mediclaro_private.owner_pins')), /permission denied/);
await assert.rejects(as(A, () => db.query('select * from mediclaro_private.owner_bonos')), /permission denied/);
await assert.rejects(as(A, () => db.query(`select mediclaro_private.owner_grant('${A}', '{}'::jsonb)`)), /permission denied/);

let st = await admin(O, 'status');
assert.equal(st.hasPin, false);
assert.equal(st.name, 'Antonio');
assert.equal(st.phone, '+34 ••• ••• 001');
await rejects(O, 'overview', {}, 'OWNER_LOCKED');
await rejects(O, 'overview', { session: 'x'.repeat(64) }, 'OWNER_LOCKED');

// ── Crear el código ─────────────────────────────────────────────────────────────────────────────────────
for (const weak of ['123456', '111111', '12345', 'abcdef', '654321', '1234567']) {
  await rejects(O, 'setup_pin', { pin: weak }, 'PIN_WEAK');
}
const setup = await admin(O, 'setup_pin', { pin: '482913', trustDevice: true, deviceLabel: 'iPhone de Antonio' });
assert.equal(setup.ok, true);
assert.match(setup.session, /^[0-9a-f]{64}$/);
assert.match(setup.deviceToken, /^[0-9a-f]{64}$/);
const stored = (await sql(`select pin_hash from mediclaro_private.owner_pins where user_id = $1`, [O]))[0].pin_hash;
assert.ok(stored.startsWith('$2a$10$') && !stored.includes('482913'), 'el código se guarda cifrado con bcrypt');
await rejects(O, 'setup_pin', { pin: '739164' }, 'PIN_ALREADY_SET');
let S = setup.session;
const deviceToken = setup.deviceToken;

const ov = await admin(O, 'overview', { session: S });
assert.equal(ov.counts.users, 7);
assert.equal(ov.counts.paid, 1);
assert.equal(ov.counts.premium, 3, 'los dos propietarios + Luis');
assert.equal(ov.counts.caregivers, 1);
assert.equal(ov.counts.errors24h, 1);
assert.equal(ov.owner.hasPin, true);

// La sesión de un propietario no sirve para el otro.
await rejects(O2, 'overview', { session: S }, 'OWNER_LOCKED');

// ── Cerrar y abrir con código: bloqueo tras 5 fallos (se guarda aunque falle) ────────────────────────────
assert.deepEqual(await admin(O, 'lock', { session: S }), { ok: true });
await rejects(O, 'overview', { session: S }, 'OWNER_LOCKED');
for (const left of [4, 3, 2, 1]) {
  const r = await admin(O, 'unlock', { pin: '000999' });
  assert.equal(r.ok, false);
  assert.equal(r.error, 'PIN_INCORRECT');
  assert.equal(r.attemptsLeft, left);
}
let r = await admin(O, 'unlock', { pin: '000999' });
assert.equal(r.error, 'LOCKED');
assert.ok(new Date(r.lockedUntil) > new Date());
r = await admin(O, 'unlock', { pin: '482913' });
assert.equal(r.error, 'LOCKED', 'bloqueado aunque ahora acierte');
assert.ok((await admin(O, 'status')).lockedUntil);
assert.equal((await sql(`select count(*)::int as n from public.audit_log where action = 'owner_locked'`))[0].n, 1);
await db.exec(`update mediclaro_private.owner_pins set locked_until = now() - interval '1 second' where user_id = '${O}'`);
r = await admin(O, 'unlock', { pin: '482913' });
assert.equal(r.ok, true);
S = r.session;
assert.equal(r.deviceToken, undefined);
assert.equal((await admin(O, 'status')).attemptsLeft, 5);

// ── Face ID: permiso de dispositivo ─────────────────────────────────────────────────────────────────────
r = await admin(O, 'unlock_device', { deviceToken });
assert.equal(r.ok, true);
assert.match(r.session, /^[0-9a-f]{64}$/);
assert.equal((await admin(O, 'unlock_device', { deviceToken: 'f'.repeat(64) })).error, 'DEVICE_INVALID');
assert.equal((await admin(O, 'unlock_device', { deviceToken: 'nope' })).error, 'DEVICE_INVALID');
assert.equal((await admin(O2, 'unlock_device', { deviceToken })).error, 'DEVICE_INVALID', 'el permiso es de su propietario');

// ── Caducidad de la sesión: 15 min sin actividad y 8 h como máximo ──────────────────────────────────────
const S2 = (await admin(O, 'unlock', { pin: '482913' })).session;
await db.exec(`update mediclaro_private.owner_sessions set expires_at = now() - interval '1 second' where token_hash = mediclaro_private.owner_hash('${S2}')`);
await rejects(O, 'overview', { session: S2 }, 'OWNER_LOCKED');
const S3 = (await admin(O, 'unlock', { pin: '482913' })).session;
await db.exec(`update mediclaro_private.owner_sessions set created_at = now() - interval '9 hours' where token_hash = mediclaro_private.owner_hash('${S3}')`);
await rejects(O, 'overview', { session: S3 }, 'OWNER_LOCKED');
await admin(O, 'overview', { session: S }); // la buena sigue viva

// ── Usuarios ────────────────────────────────────────────────────────────────────────────────────────────
let users = await admin(O, 'users', { session: S });
assert.equal(users.total, 7);
assert.equal(users.users[0].name, 'María Torres', 'los más nuevos primero');
const byName = Object.fromEntries(users.users.map((u) => [u.name ?? 'sin nombre', u]));
assert.equal(byName['Antonio'].plan, 'owner');
assert.equal(byName['Luis Martínez'].plan, 'paid');
assert.equal(byName['Luis Martínez'].provider, 'apple');
assert.equal(byName['Carmen García'].plan, 'free');
assert.equal(byName['Carmen García'].patientLinks, 1);
assert.equal(byName['Ana López'].caregiver, true);
assert.equal(byName['María Torres'].provider, 'bizum');
assert.equal(byName['sin nombre'].verified, false);
assert.equal(byName['sin nombre'].phone, null);
assert.ok(users.users.every((u) => !u.phone || /^\+34 ••• ••• \d{3}$/.test(u.phone)), 'teléfonos enmascarados');
assert.ok(!JSON.stringify(users).includes('611222333'), 'nunca el número completo');
assert.equal((await admin(O, 'users', { session: S, tab: 'caregivers' })).total, 1);
assert.equal((await admin(O, 'users', { session: S, tab: 'patients' })).total, 6);
assert.equal((await admin(O, 'users', { session: S, q: 'carm' })).users[0].id, A);
assert.equal((await admin(O, 'users', { session: S, q: '611 222 333' })).users[0].id, A, 'busca por teléfono');
assert.equal((await admin(O, 'users', { session: S, q: '0034611222333' })).total, 1);
assert.equal((await admin(O, 'users', { session: S, q: '100%_' })).total, 0, 'comodines escapados');
await rejects(O, 'users', { session: S, tab: 'raros' }, 'INVALID_REQUEST');

const detail = await admin(O, 'user', { session: S, userId: B });
assert.equal(detail.user.name, 'Luis Martínez');
assert.equal(detail.store.platform, 'apple');
assert.equal(detail.usage30d.scans, 1);
assert.equal(detail.usage30d.chats, 1);
assert.equal(detail.usage30d.doses, 1);
assert.ok(detail.lastActivityAt);
await rejects(O, 'user', { session: S, userId: 'nope' }, 'INVALID_REQUEST');
await rejects(O, 'user', { session: S, userId: id(999) }, 'NOT_FOUND');

// ── Bonos ───────────────────────────────────────────────────────────────────────────────────────────────
await rejects(O, 'bono_create', { session: S, name: '  ', days: 30, maxUses: 2 }, 'INVALID_NAME');
await rejects(O, 'bono_create', { session: S, name: 'X', days: 30, maxUses: 0 }, 'INVALID_USES');
await rejects(O, 'bono_create', { session: S, name: 'X', days: 30, maxUses: '5' }, 'INVALID_USES');
await rejects(O, 'bono_create', { session: S, name: 'X', days: 'mucho', maxUses: 2 }, 'INVALID_REQUEST');
await rejects(O, 'bono_create', { session: S, name: 'X', days: 99999, maxUses: 2 }, 'INVALID_REQUEST');
await rejects(O, 'bono_create', { session: S, name: 'X', maxUses: 2 }, 'INVALID_REQUEST');
const familia = await admin(O, 'bono_create', { session: S, name: 'Familia García', days: 30, maxUses: 2, note: 'Para la familia' });
assert.equal(familia.state, 'active');
assert.equal(familia.uses, 0);
const vitalicio = await admin(O, 'bono_create', { session: S, name: 'Bono vitalicio', days: null, maxUses: 1 });
assert.equal(vitalicio.days, null);

// Conceder con bono a una cuenta (Carmen) y a un teléfono que aún no tiene cuenta.
assert.equal(await premium(A), false);
let g = await admin(O, 'grant', { session: S, userId: A, bonoId: familia.id });
assert.equal(g.ok, true);
assert.equal(g.verified, true);
assert.equal(g.bono.uses, 1);
assert.equal(g.user.plan, 'courtesy');
assert.ok(new Date(g.expiresAt) > new Date(Date.now() + 29 * 864e5));
assert.equal(await premium(A), true, 'Premium de cortesía activo');
await rejects(O, 'grant', { session: S, userId: A, bonoId: familia.id }, 'BONO_ALREADY_USED');
g = await admin(O, 'grant', { session: S, phone: '+34 655 444 333', bonoId: familia.id });
assert.equal(g.verified, false);
assert.equal(g.phone, '+34 ••• ••• 333');
assert.equal(g.bono.uses, 2);
await rejects(O, 'grant', { session: S, userId: C, bonoId: familia.id }, 'BONO_EXHAUSTED');
let bonos = await admin(O, 'bonos', { session: S });
assert.equal(bonos.total, 2);
assert.equal(bonos.bonos.find((b) => b.id === familia.id).state, 'exhausted');
assert.equal(bonos.activeCount, 1);
assert.equal((await admin(O, 'bonos', { session: S, state: 'finished' })).total, 1);
const fd = await admin(O, 'bono', { session: S, bonoId: familia.id });
assert.equal(fd.uses.length, 2);
assert.equal(fd.uses.find((u) => u.userId === A).name, 'Carmen García');
assert.equal(fd.uses.find((u) => !u.userId).phone, '+34 ••• ••• 333');
assert.ok(fd.uses.every((u) => u.active));

// Sin teléfono verificado no se puede; teléfono no válido; peticiones mal formadas.
await rejects(O, 'grant', { session: S, userId: N, days: 30 }, 'USER_NO_PHONE');
await rejects(O, 'grant', { session: S, phone: '12', days: 30 }, 'INVALID_PHONE');
await rejects(O, 'grant', { session: S, userId: C }, 'INVALID_REQUEST');
await rejects(O, 'grant', { session: S, userId: C, days: '30' }, 'INVALID_REQUEST');
await rejects(O, 'grant', { session: S, userId: C, days: 0 }, 'INVALID_REQUEST');

// Desactivar y activar un bono.
await admin(O, 'bono_disable', { session: S, bonoId: vitalicio.id });
await rejects(O, 'grant', { session: S, userId: C, bonoId: vitalicio.id }, 'BONO_DISABLED');
await admin(O, 'bono_enable', { session: S, bonoId: vitalicio.id });
g = await admin(O, 'grant', { session: S, userId: C, bonoId: vitalicio.id });
assert.equal(g.lifetime, true);
assert.equal(g.expiresAt, null);

// Conceder por días: si ya tenía más, se queda la fecha más lejana.
g = await admin(O, 'grant', { session: S, userId: A, days: 7 });
assert.ok(new Date(g.expiresAt) > new Date(Date.now() + 29 * 864e5), 'no se acorta');
g = await admin(O, 'grant', { session: S, userId: A, days: 365 });
assert.ok(new Date(g.expiresAt) > new Date(Date.now() + 364 * 864e5));

// Retirar.
r = await admin(O, 'revoke', { session: S, userId: A });
assert.equal(r.changed, true);
assert.equal(await premium(A), false);
assert.equal((await admin(O, 'revoke', { session: S, userId: A })).changed, false);

// ── Suscripciones ───────────────────────────────────────────────────────────────────────────────────────
const active = await admin(O, 'subscriptions', { session: S });
assert.equal(active.totals.paid, 1);
assert.equal(active.totals.courtesy, 2, 'Ana (vitalicio) y el teléfono pendiente');
assert.equal(active.total, 3);
const luis = active.rows.find((x) => x.userId === B);
assert.equal(luis.kind, 'paid');
assert.equal(luis.provider, 'apple');
const pendiente = active.rows.find((x) => x.kind === 'courtesy' && !x.userId);
assert.equal(pendiente.phone, '+34 ••• ••• 333');
const history = await admin(O, 'subscriptions', { session: S, tab: 'history' });
assert.ok(history.rows.some((x) => x.userId === A && x.state === 'REVOKED'));
assert.ok(history.rows.some((x) => x.userId === D && x.provider === 'bizum' && x.state === 'EXPIRED'));

// ── Estadísticas ────────────────────────────────────────────────────────────────────────────────────────
const stats7 = await admin(O, 'stats', { session: S, days: 7 });
assert.equal(stats7.unit, 'day');
assert.equal(stats7.series.length, 7);
assert.equal(stats7.kpis.doses, 2, 'tomadas + adicional, sin omitidas ni anuladas');
assert.equal(stats7.kpis.chats, 1, 'sin las derivadas a emergencia');
assert.equal(stats7.kpis.scans, 2);
assert.equal(stats7.kpis.emergencies, 2);
assert.equal(stats7.kpis.careMessages, 2);
assert.equal(stats7.kpis.calls, 1);
assert.equal(stats7.kpis.bonosUsed, 3);
assert.equal(stats7.series.reduce((n, b) => n + b.doses, 0), 2);
assert.equal(stats7.series.reduce((n, b) => n + b.scans, 0), 2);
const stats365 = await admin(O, 'stats', { session: S, days: 365 });
assert.equal(stats365.unit, 'month');
assert.ok(stats365.series.length >= 12 && stats365.series.length <= 13);
assert.equal(stats365.kpis.scans, 3);
await rejects(O, 'stats', { session: S, days: 12 }, 'INVALID_RANGE');

// ── Registro y auditoría ────────────────────────────────────────────────────────────────────────────────
const activity = await admin(O, 'audit', { session: S });
const actions = activity.rows.map((x) => x.action);
for (const a of ['owner_pin_created', 'owner_unlocked', 'owner_locked', 'owner_bono_created', 'courtesy_premium_granted', 'courtesy_premium_revoked', 'owner_user_viewed', 'owner_bono_disabled']) {
  assert.ok(actions.includes(a), `actividad incluye ${a}`);
}
const grantRow = activity.rows.find((x) => x.action === 'courtesy_premium_granted' && x.target === 'Ana López');
assert.equal(grantRow.actor, 'Antonio');
assert.equal(grantRow.detail.bono_name, 'Bono vitalicio');
assert.ok(activity.rows.every((x) => !('phone_hash' in x.detail)), 'sin huellas de teléfono');
const events = await admin(O, 'audit', { session: S, tab: 'events' });
assert.ok(events.rows.some((x) => x.action === 'user_registered' && x.actor === 'Carmen García'));
assert.ok(events.rows.some((x) => x.action === 'data_exported'));
assert.ok(!events.rows.some((x) => x.action.startsWith('owner_')));

// ── Aviso para todos ────────────────────────────────────────────────────────────────────────────────────
assert.equal((await as(null, () => db.query('select public.app_notice() as n'))).rows[0].n, null);
await rejects(O, 'notice_set', { session: S, enabled: true, message: 'x'.repeat(300) }, 'INVALID_NOTICE');
await rejects(O, 'notice_set', { session: S, enabled: true, message: 'Hola', until: '2000-01-01T00:00:00Z' }, 'INVALID_NOTICE');
await rejects(O, 'notice_set', { session: S, enabled: 'sí', message: 'Hola' }, 'INVALID_REQUEST');
const notice = await admin(O, 'notice_set', { session: S, enabled: true, title: 'Mantenimiento', message: 'Mañana de 2 a 3 h la identificación no estará disponible.', tone: 'warning' });
assert.equal(notice.notice.enabled, true);
const seen = (await as(null, () => db.query('select public.app_notice() as n'))).rows[0].n;
assert.equal(seen.title, 'Mantenimiento');
assert.equal(seen.tone, 'warning');
assert.equal((await as(A, () => db.query('select public.app_notice() as n'))).rows[0].n.id, notice.notice.id);
await admin(O, 'notice_set', { session: S, enabled: false, message: '' });
assert.equal((await as(A, () => db.query('select public.app_notice() as n'))).rows[0].n, null);
assert.equal((await admin(O, 'notice_get', { session: S })).notice.enabled, false);

// ── Estado del sistema ──────────────────────────────────────────────────────────────────────────────────
const sys = await admin(O, 'system', { session: S });
assert.equal(sys.database, 'ok');
const careQueue = sys.queues.find((q) => q.key === 'care_push_jobs');
assert.deepEqual([careQueue.pending, careQueue.failed24h, careQueue.delivered24h], [1, 1, 1]);
assert.equal(sys.queues.length, 2, 'solo las colas que existen');
assert.ok(sys.cron.some((j) => j.name === 'mediclaro-owner-cleanup' && j.lastStatus === 'succeeded'));
assert.equal(sys.errors24h, 1);
assert.equal(sys.storeVerification, false);
assert.equal(sys.features.careChat, true);

// ── Copias (exportar) ───────────────────────────────────────────────────────────────────────────────────
const exp = await admin(O, 'export', { session: S, kind: 'users' });
assert.equal(exp.rows.length, 7);
assert.equal(exp.columns[0], 'Nombre');
assert.ok(!JSON.stringify(exp).includes('611222333'), 'exportación con teléfonos enmascarados');
for (const k of ['subscriptions', 'bonos', 'audit']) assert.ok((await admin(O, 'export', { session: S, kind: k })).rows.length > 0, k);
await rejects(O, 'export', { session: S, kind: 'todo' }, 'INVALID_REQUEST');
assert.ok((await sql(`select count(*)::int as n from public.audit_log where action = 'owner_export'`))[0].n >= 4);

// ── Cuenta, dispositivos y cambio de código ─────────────────────────────────────────────────────────────
const acct = await admin(O, 'account', { session: S });
assert.equal(acct.devices, 1);
assert.ok(acct.recentUnlocks.length >= 3);
let devs = await admin(O, 'devices', { session: S });
assert.equal(devs.devices.length, 1);
assert.equal(devs.devices[0].label, 'iPhone de Antonio');
const trusted = await admin(O, 'trust_device', { session: S, pin: '482913', deviceLabel: 'iPad' });
assert.match(trusted.deviceToken, /^[0-9a-f]{64}$/);
assert.equal((await admin(O, 'trust_device', { session: S, pin: '000000' })).error, 'PIN_INCORRECT');
devs = await admin(O, 'devices', { session: S });
assert.equal(devs.devices.length, 2);
await admin(O, 'device_revoke', { session: S, deviceId: devs.devices.find((d) => d.label === 'iPad').id });
assert.equal((await admin(O, 'unlock_device', { deviceToken: trusted.deviceToken })).error, 'DEVICE_INVALID');

const other = (await admin(O, 'unlock', { pin: '482913' })).session;
assert.equal((await admin(O, 'change_pin', { session: S, currentPin: '111000', newPin: '573920' })).error, 'PIN_INCORRECT');
await rejects(O, 'change_pin', { session: S, currentPin: '482913', newPin: '123456' }, 'PIN_WEAK');
await rejects(O, 'change_pin', { session: S, currentPin: '482913', newPin: '482913' }, 'PIN_SAME');
assert.deepEqual(await admin(O, 'change_pin', { session: S, currentPin: '482913', newPin: '573920' }), { ok: true });
assert.equal((await admin(O, 'unlock_device', { deviceToken })).error, 'DEVICE_INVALID', 'Face ID retirado al cambiar el código');
await rejects(O, 'overview', { session: other }, 'OWNER_LOCKED');
await admin(O, 'overview', { session: S }); // la sesión actual sigue
assert.equal((await admin(O, 'unlock', { pin: '482913' })).error, 'PIN_INCORRECT');
assert.equal((await admin(O, 'unlock', { pin: '573920' })).ok, true);

// El segundo propietario tiene su propio código.
assert.equal((await admin(O2, 'status')).hasPin, false);
assert.equal((await admin(O2, 'unlock', { pin: '573920' })).error, 'PIN_NOT_SET');
await rejects(O, 'algo_raro', { session: S }, 'INVALID_ACTION');

// Limpieza programada.
assert.ok((await sql(`select 1 from cron.job where jobname = 'mediclaro-owner-cleanup'`)).length === 1);
await db.exec(`update mediclaro_private.owner_sessions set expires_at = now() - interval '40 days'`);
await db.exec(`select mediclaro_private.owner_cleanup()`);
assert.equal((await sql(`select count(*)::int as n from mediclaro_private.owner_sessions`))[0].n, 0);

console.log('MIGRACION_PANEL_PROPIETARIO=OK');
