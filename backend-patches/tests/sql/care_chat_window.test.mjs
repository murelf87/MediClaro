// Chat con el cuidador/a: la conversación la abre la persona cuidada. Prueba 20261009190000_care_chat_window.sql
// encima de 20261009150000_care_chat_and_calls.sql en PostgreSQL en memoria (PGlite), sin red ni claves.
// Uso:  node care_chat_window.test.mjs <migración del chat> <migración de la ventana>
import { PGlite } from '@electric-sql/pglite';
import fs from 'node:fs';
import assert from 'node:assert/strict';

const base = fs.readFileSync(process.argv[2], 'utf8').replace(/create extension if not exists pg_cron[^;]*;/i, '');
const window = fs.readFileSync(process.argv[3], 'utf8');
const db = new PGlite();
await db.exec(`
create role anon; create role authenticated; create role service_role;
create schema auth; create schema mediclaro_private; create schema cron;
grant usage on schema public to authenticated, anon, service_role;
create table auth.users (id uuid primary key);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
grant usage on schema auth to authenticated; grant execute on function auth.uid() to authenticated;
create table public.profiles (id uuid primary key references auth.users(id) on delete cascade, sub_state text default 'FREE');
create function public.is_premium(p public.profiles) returns boolean language sql stable as $$ select p.sub_state in ('ACTIVE','TRIAL','PAST_DUE') $$;
create function public.hit_rate_limit(p_user uuid, p_bucket text, p_max int) returns boolean language sql as $$ select true $$;
create table public.care_links (id uuid primary key default gen_random_uuid(), patient_id uuid not null references auth.users(id) on delete cascade,
  caregiver_id uuid references auth.users(id) on delete cascade, patient_name text not null, caregiver_name text,
  expires_at timestamptz default now() + interval '1 day', accepted_at timestamptz, revoked_at timestamptz, created_at timestamptz default now());
create table public.care_devices (token text primary key, user_id uuid not null references auth.users(id) on delete cascade, enabled boolean not null default true);
create table public.wakeups (n int); insert into public.wakeups values (0);
create function public.care_wake_dispatch() returns trigger language plpgsql as $$ begin update public.wakeups set n = n + 1; return null; end $$;
create table cron.job (jobname text primary key, schedule text, command text);
create function cron.schedule(n text, s text, c text) returns bigint language sql as $$ insert into cron.job values (n, s, c) on conflict (jobname) do update set schedule = excluded.schedule, command = excluded.command; select 1::bigint $$;
create function cron.unschedule(n text) returns boolean language sql as $$ delete from cron.job where jobname = n; select true $$;
`);
await db.exec(base);
await db.exec(window);
await db.exec(window); // se puede aplicar dos veces

const P = '00000000-0000-4000-8000-00000000000a'; // paciente Premium (María)
const C = '00000000-0000-4000-8000-00000000000c'; // su cuidador (Javier, gratis)
const L1 = '00000000-0000-4000-8000-0000000001a1';
await db.exec(`insert into auth.users values ('${P}'), ('${C}');
  insert into public.profiles values ('${P}', 'ACTIVE'), ('${C}', 'FREE');
  insert into public.care_links (id, patient_id, caregiver_id, patient_name, caregiver_name, accepted_at) values
    ('${L1}', '${P}', '${C}', 'María', 'Javier', now());`);

const uuid = () => crypto.randomUUID();
async function as(user, fn) {
  await db.exec(`reset role; select set_config('request.jwt.claim.sub', '${user}', false); set role authenticated;`);
  try {
    return await fn();
  } finally {
    await db.exec('reset role');
  }
}
const chat = async (user, action, payload = {}) =>
  as(user, async () => (await db.query(`select public.care_chat_action($1, $2::jsonb) as r`, [action, JSON.stringify(payload)])).rows[0].r);
const rejects = async (user, action, payload, code) => {
  await assert.rejects(chat(user, action, payload), new RegExp(code), `${action} debería fallar con ${code}`);
};

// ─── Sin mensajes: el cuidador ve el chat apagado y no puede escribir; la persona cuidada sí ─────────────
let r = await chat(C, 'list');
assert.equal(r.conversations[0].canSend, false, 'apagado para el cuidador hasta que María escriba');
assert.equal(r.conversations[0].openUntil, null);
assert.equal(r.conversations[0].premium, true);
r = await chat(P, 'list');
assert.equal(r.conversations[0].canSend, true, 'María siempre puede escribir');
await rejects(C, 'send', { linkId: L1, content: 'Hola, mamá', clientKey: uuid() }, 'CHAT_CLOSED');

// ─── María escribe: el chat se enciende 1 hora para Javier ────────────────────────────────────────────────
r = await chat(P, 'send', { linkId: L1, content: 'Hola, hijo. ¿Estás ahí?', clientKey: uuid() });
assert.equal(r.replayed, false);
r = await chat(C, 'list');
assert.equal(r.conversations[0].canSend, true);
const until = Date.parse(r.conversations[0].openUntil);
assert.ok(until > Date.now() + 58 * 60_000 && until < Date.now() + 61 * 60_000, 'encendido durante una hora');
r = await chat(C, 'send', { linkId: L1, content: 'Sí, mamá. ¿Cómo estás?', clientKey: uuid() });
assert.equal(r.replayed, false);
// Que el cuidador escriba no alarga la hora: solo cuenta lo que escribe María.
r = await chat(C, 'messages', { linkId: L1 });
assert.equal(Date.parse(r.conversation.openUntil), until);
assert.equal(r.messages.length, 2);

// ─── Pasa la hora sin que María escriba: se apaga; vuelve a encenderse cuando ella escribe ────────────────
await db.exec(`update public.care_chat_messages set created_at = created_at - interval '61 minutes'`);
r = await chat(C, 'list');
assert.equal(r.conversations[0].canSend, false, 'tras una hora sin mensajes de María, apagado');
assert.equal(r.conversations[0].openUntil, null);
await rejects(C, 'send', { linkId: L1, content: '¿Sigues ahí?', clientKey: uuid() }, 'CHAT_CLOSED');
// Las llamadas (apartado anterior) no dependen de la ventana: el mensaje de llamada no la abre ni la cierra.
await db.exec(`insert into public.care_chat_messages (link_id, sender_id, content, client_key, kind, call_outcome, call_seconds)
  values ('${L1}', '${P}', 'Llamada perdida', gen_random_uuid(), 'call', 'missed', 0)`);
r = await chat(C, 'list');
assert.equal(r.conversations[0].canSend, false, 'una llamada no enciende el chat');
r = await chat(P, 'send', { linkId: L1, content: 'Ya estoy en casa.', clientKey: uuid() });
r = await chat(C, 'list');
assert.equal(r.conversations[0].canSend, true, 'María escribe y vuelve a encenderse');
// Un reintento del cuidador de un envío que ya entró sigue devolviendo el mismo mensaje aunque el chat se apague.
const K = uuid();
r = await chat(C, 'send', { linkId: L1, content: 'Me alegro.', clientKey: K });
await db.exec(`update public.care_chat_messages set created_at = created_at - interval '61 minutes'`);
r = await chat(C, 'send', { linkId: L1, content: 'Me alegro.', clientKey: K });
assert.equal(r.replayed, true);

// ─── Sin Premium, nada cambia: apagado para los dos ───────────────────────────────────────────────────────
await db.exec(`update public.profiles set sub_state = 'FREE' where id = '${P}'`);
r = await chat(P, 'list');
assert.equal(r.conversations[0].canSend, false);
assert.equal(r.conversations[0].premium, false);
await rejects(P, 'send', { linkId: L1, content: 'Hola', clientKey: uuid() }, 'PREMIUM_REQUIRED');

console.log('MIGRACION_VENTANA_CHAT_CUIDADOR=OK');
