// Chat y llamadas entre la persona Premium y su cuidador/a: prueba la migración 20261009150000_care_chat_and_calls.sql
// en PostgreSQL en memoria (PGlite) con dobles mínimos de Supabase (auth.uid, perfiles, Premium, vínculos,
// dispositivos, cron y aviso al repartidor). Sin red ni claves.
// Uso:  node care_chat.test.mjs <ruta de la migración>      (necesita @electric-sql/pglite)
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
await db.exec(migration);
await db.exec(migration); // se puede aplicar dos veces

const P = '00000000-0000-4000-8000-00000000000a'; // paciente Premium (María)
const C = '00000000-0000-4000-8000-00000000000c'; // su cuidador (Javier, gratis)
const X = '00000000-0000-4000-8000-00000000000f'; // otra persona (solicitud pendiente)
const F = '00000000-0000-4000-8000-0000000000f0'; // paciente SIN Premium
const C2 = '00000000-0000-4000-8000-0000000000c2'; // cuidadora de F
const C3 = '00000000-0000-4000-8000-0000000000c3'; // vínculo ya revocado
const P2 = '00000000-0000-4000-8000-0000000000b0'; // otra paciente Premium (llamadas)
const C4 = '00000000-0000-4000-8000-0000000000b4'; // su cuidadora
const L1 = '00000000-0000-4000-8000-0000000001a1';
const L2 = '00000000-0000-4000-8000-0000000001a2';
const L3 = '00000000-0000-4000-8000-0000000001a3';
const L4 = '00000000-0000-4000-8000-0000000001a4';
const L5 = '00000000-0000-4000-8000-0000000001a5';
const TOKEN_P = 'ExponentPushToken[pacientePaciente]';
await db.exec(`insert into auth.users values ('${P}'), ('${C}'), ('${X}'), ('${F}'), ('${C2}'), ('${C3}'), ('${P2}'), ('${C4}');
  insert into public.profiles values ('${P}', 'ACTIVE'), ('${C}', 'FREE'), ('${X}', 'FREE'), ('${F}', 'FREE'), ('${C2}', 'FREE'), ('${C3}', 'FREE'),
    ('${P2}', 'ACTIVE'), ('${C4}', 'FREE');
  insert into public.care_links (id, patient_id, caregiver_id, patient_name, caregiver_name, accepted_at, revoked_at) values
    ('${L1}', '${P}', '${C}', 'María', 'Javier', now(), null),
    ('${L2}', '${F}', '${C2}', 'Rosa', 'Elena', now(), null),
    ('${L3}', '${P}', '${X}', 'María', 'Pedro', null, null),
    ('${L4}', '${P}', '${C3}', 'María', 'Antiguo', now() - interval '20 days', now() - interval '2 days'),
    ('${L5}', '${P2}', '${C4}', 'Carmen', 'Lucía', now(), null);
  insert into public.care_devices values ('${TOKEN_P}', '${P}', true);`);

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
const call = async (user, action, payload = {}) =>
  as(user, async () => (await db.query(`select public.care_call_action($1, $2::jsonb) as r`, [action, JSON.stringify(payload)])).rows[0].r);
const callRejects = async (user, action, payload, code) => {
  await assert.rejects(call(user, action, payload), new RegExp(code), `llamada ${action} debería fallar con ${code}`);
};
const wakeups = async () => Number((await db.query(`select n from public.wakeups`)).rows[0].n);
const pendingJobs = async (user) => (await db.query(`select * from public.care_chat_push_jobs where user_id = $1 and sent_at is null`, [user])).rows;

// ─── Conversaciones: solo vinculaciones aceptadas y vigentes ─────────────────────────────────────────────
let r = await chat(P, 'list');
assert.equal(r.conversations.length, 1, 'la solicitud pendiente y la vinculación revocada no tienen chat');
assert.equal(r.conversations[0].linkId, L1);
assert.equal(r.conversations[0].myRole, 'patient');
assert.equal(r.conversations[0].otherName, 'Javier');
assert.equal(r.conversations[0].canSend, true);
assert.equal(r.conversations[0].unread, 0);
assert.equal(r.conversations[0].lastMessage, null);
r = await chat(C, 'list');
assert.equal(r.conversations.length, 1);
assert.equal(r.conversations[0].myRole, 'caregiver');
assert.equal(r.conversations[0].otherName, 'María');
assert.equal((await chat(X, 'list')).conversations.length, 0, 'quien solo pidió vincularse no tiene chat');

// ─── Enviar: idempotente, con aviso push SIN el texto y un solo aviso pendiente por conversación ─────────
const K1 = uuid();
const before = await wakeups();
r = await chat(P, 'send', { linkId: L1, content: '  Hola, Javier. Ya me he tomado las pastillas.  ', clientKey: K1 });
assert.equal(r.replayed, false);
assert.equal(r.message.content, 'Hola, Javier. Ya me he tomado las pastillas.', 'sin espacios sobrantes');
assert.equal(r.message.senderId, P);
assert.equal(r.message.readAt, null);
const M1 = r.message.id;
assert.equal((await pendingJobs(C)).length, 1, 'aviso para el cuidador');
assert.equal(await wakeups(), before + 1, 'se despierta al repartidor');
r = await chat(P, 'send', { linkId: L1, content: 'Hola, Javier. Ya me he tomado las pastillas.', clientKey: K1 });
assert.equal(r.replayed, true, 'reenviar tras perder la respuesta no duplica');
assert.equal(r.message.id, M1);
r = await chat(P, 'send', { linkId: L1, content: '¿Vienes el sábado?\u0007', clientKey: uuid() });
assert.equal(r.message.content, '¿Vienes el sábado?', 'sin caracteres de control');
assert.equal((await pendingJobs(C)).length, 1, 'varios mensajes seguidos → un solo aviso pendiente');
assert.equal(await wakeups(), before + 1, 'y no se vuelve a despertar al repartidor');
assert.equal(Number((await db.query(`select count(*) from public.care_chat_messages`)).rows[0].count), 2);

// ─── Leer: no leídos, orden, páginas y «Visto» ───────────────────────────────────────────────────────────
r = await chat(C, 'list');
assert.equal(r.conversations[0].unread, 2);
assert.equal(r.conversations[0].lastMessage.content, '¿Vienes el sábado?');
r = await chat(C, 'messages', { linkId: L1 });
assert.deepEqual(r.messages.map((m) => m.content), ['Hola, Javier. Ya me he tomado las pastillas.', '¿Vienes el sábado?'], 'del más antiguo al más reciente');
assert.equal(r.hasMore, false);
assert.equal(r.conversation.myRole, 'caregiver');
r = await chat(C, 'messages', { linkId: L1, limit: 1 });
assert.equal(r.messages.length, 1);
assert.equal(r.messages[0].content, '¿Vienes el sábado?', 'la página trae los más recientes');
assert.equal(r.hasMore, true);
r = await chat(C, 'messages', { linkId: L1, limit: 1, before: r.messages[0].createdAt });
assert.equal(r.messages[0].id, M1, 'y la siguiente página, los anteriores');
r = await chat(C, 'messages', { linkId: L1, limit: 'mucho', before: 'ayer' });
assert.equal(r.messages.length, 2, 'parámetros raros → valores por defecto, sin error');
r = await chat(P, 'read', { linkId: L1 });
assert.equal(r.read, 0, 'los mensajes propios no se marcan como leídos');
r = await chat(C, 'read', { linkId: L1 });
assert.equal(r.read, 2);
assert.equal((await chat(C, 'list')).conversations[0].unread, 0);
r = await chat(P, 'messages', { linkId: L1 });
assert.ok(r.messages.every((m) => m.readAt), 'la persona ve «Visto»');
assert.equal((await pendingJobs(C)).length, 0, 'leído antes del aviso → el aviso se cancela');

// ─── Repartidor de avisos ────────────────────────────────────────────────────────────────────────────────
assert.deepEqual(JSON.parse(JSON.stringify((await db.query(`select public.care_chat_claim_push_jobs() as r`)).rows[0].r)), []);
r = await chat(C, 'send', { linkId: L1, content: 'Sí, voy a comer contigo. Un beso.', clientKey: uuid() });
const jobs = (await db.query(`select public.care_chat_claim_push_jobs() as r`)).rows[0].r;
assert.equal(jobs.length, 1);
assert.equal(jobs[0].user_id, P);
assert.deepEqual(jobs[0].tokens, [TOKEN_P]);
assert.equal(jobs[0].senderName, 'Javier');
assert.equal(jobs[0].unread, 1);
assert.doesNotMatch(JSON.stringify(jobs[0]), /comer contigo/, 'el trabajo del aviso no lleva el texto del mensaje');
assert.deepEqual((await db.query(`select public.care_chat_claim_push_jobs() as r`)).rows[0].r, [], 'un trabajo reservado no se reparte dos veces');

// ─── Quién puede ─────────────────────────────────────────────────────────────────────────────────────────
await rejects(X, 'messages', { linkId: L1 }, 'NOT_ALLOWED');
await rejects(X, 'send', { linkId: L1, content: 'Hola', clientKey: uuid() }, 'NOT_ALLOWED');
await rejects(X, 'read', { linkId: L1 }, 'NOT_ALLOWED');
await rejects(P, 'messages', { linkId: L3 }, 'NOT_ALLOWED');
await rejects(X, 'send', { linkId: L3, content: 'Hola', clientKey: uuid() }, 'NOT_ALLOWED');
await rejects(P, 'send', { linkId: L4, content: 'Hola', clientKey: uuid() }, 'NOT_ALLOWED');
await rejects(C3, 'messages', { linkId: L4 }, 'NOT_ALLOWED');
// Sin Premium de la persona cuidada: se puede leer, pero no escribir (ni ella ni su cuidadora).
r = await chat(F, 'list');
assert.equal(r.conversations[0].canSend, false);
await rejects(F, 'send', { linkId: L2, content: 'Hola', clientKey: uuid() }, 'PREMIUM_REQUIRED');
await rejects(C2, 'send', { linkId: L2, content: 'Hola', clientKey: uuid() }, 'PREMIUM_REQUIRED');
assert.equal((await chat(C2, 'messages', { linkId: L2 })).messages.length, 0);
// Datos no válidos.
await rejects(P, 'send', { linkId: L1, content: '   ', clientKey: uuid() }, 'INVALID_CONTENT');
await rejects(P, 'send', { linkId: L1, content: 'x'.repeat(1001), clientKey: uuid() }, 'INVALID_CONTENT');
await rejects(P, 'send', { linkId: L1, content: 'Hola', clientKey: 'no-es-un-uuid' }, 'INVALID_REQUEST');
await rejects(P, 'send', { linkId: 'nada', content: 'Hola', clientKey: uuid() }, 'INVALID_REQUEST');
await rejects(P, 'borrar', { linkId: L1 }, 'INVALID_ACTION');
const someoneElsesKey = uuid();
await chat(C2, 'messages', { linkId: L2 });
await rejects('', 'list', {}, 'AUTH_REQUIRED');
// La app no toca las tablas directamente.
await assert.rejects(as(P, () => db.query(`select * from public.care_chat_messages`)), /permission denied/);
await assert.rejects(as(P, () => db.query(`insert into public.care_chat_messages (link_id, sender_id, content, client_key) values ('${L1}', '${P}', 'x', '${someoneElsesKey}')`)), /permission denied/);
await assert.rejects(as(P, () => db.query(`update public.care_chat_messages set read_at = now()`)), /permission denied/);
await assert.rejects(as(C, () => db.query(`select * from public.care_chat_push_jobs`)), /permission denied/);

// ─── Llamadas de voz ─────────────────────────────────────────────────────────────────────────────────────
const SDP = 'v=0\r\no=- 46117317 2 IN IP4 127.0.0.1\r\ns=-\r\n';
const CALL1 = uuid();
await callRejects(C2, 'offer', { linkId: L2, callId: uuid(), sdp: SDP }, 'PREMIUM_REQUIRED');
await callRejects(X, 'offer', { linkId: L5, callId: uuid(), sdp: SDP }, 'NOT_ALLOWED');
await callRejects(P2, 'offer', { linkId: L5, callId: uuid(), sdp: 'hola' }, 'INVALID_SDP');
await callRejects(P2, 'offer', { linkId: L5, callId: 'no-es-uuid', sdp: SDP }, 'INVALID_REQUEST');
const wakeBeforeCall = await wakeups();
let c = await call(P2, 'offer', { linkId: L5, callId: CALL1, sdp: SDP });
assert.equal(c.state, 'ringing');
assert.equal(c.direction, 'outgoing');
assert.equal(c.otherName, 'Lucía');
assert.equal(c.offer, null, 'quien llama no recibe la SDP de nuevo');
assert.equal(await wakeups(), wakeBeforeCall + 1, 'el aviso «te está llamando» despierta al repartidor');
assert.equal((await call(P2, 'offer', { linkId: L5, callId: CALL1, sdp: SDP })).id, CALL1, 'reintento: la misma llamada');
await callRejects(C4, 'offer', { linkId: L5, callId: uuid(), sdp: SDP }, 'CALL_BUSY');
let callJobs = (await db.query(`select public.care_call_claim_push_jobs() as r`)).rows[0].r;
assert.equal(callJobs.length, 1);
assert.equal(callJobs[0].user_id, C4);
assert.equal(callJobs[0].callerName, 'Carmen');
c = await call(C4, 'incoming');
assert.equal(c.id, CALL1);
assert.equal(c.direction, 'incoming');
assert.equal(c.offer, SDP, 'quien recibe la llamada recibe la oferta');
assert.equal(c.otherName, 'Carmen');
assert.equal(await call(X, 'incoming'), null);
await callRejects(X, 'snapshot', { callId: CALL1 }, 'NOT_ALLOWED');
await callRejects(P2, 'answer', { callId: CALL1, sdp: SDP }, 'NOT_ALLOWED');
c = await call(C4, 'answer', { callId: CALL1, sdp: SDP });
assert.equal(c.state, 'answered');
c = await call(P2, 'snapshot', { callId: CALL1 });
assert.equal(c.answer, SDP, 'quien llama recibe la respuesta');
assert.deepEqual((await db.query(`select public.care_call_claim_push_jobs() as r`)).rows[0].r, [], 'contestada: el aviso ya no se envía');
await db.query(`update public.care_link_calls set answered_at = now() - interval '95 seconds' where id = $1`, [CALL1]);
c = await call(C4, 'end', { callId: CALL1 });
assert.equal(c.state, 'ended');
assert.equal(c.outcome, 'answered');
let row = (await db.query(`select offer, answer from public.care_link_calls where id = $1`, [CALL1])).rows[0];
assert.deepEqual(row, { offer: null, answer: null }, 'al colgar se borra la señalización');
let log = (await chat(C4, 'messages', { linkId: L5 })).messages.at(-1);
assert.equal(log.kind, 'call');
assert.equal(log.callOutcome, 'answered');
assert.ok(log.callSeconds >= 94 && log.callSeconds <= 97, `duración ${log.callSeconds}`);
assert.equal(log.senderId, P2);
assert.ok(log.readAt, 'una llamada contestada no cuenta como «sin leer»');
// Perdida: nadie contesta en 45 s.
const CALL2 = uuid();
await call(C4, 'offer', { linkId: L5, callId: CALL2, sdp: SDP });
await db.query(`update public.care_link_calls set expires_at = now() - interval '1 second' where id = $1`, [CALL2]);
assert.equal(await call(P2, 'incoming'), null, 'ya no suena');
c = await call(C4, 'snapshot', { callId: CALL2 });
assert.equal(c.outcome, 'missed');
r = await chat(P2, 'list');
assert.equal(r.conversations[0].unread, 1, 'la llamada perdida queda como «sin leer»');
assert.equal(r.conversations[0].lastMessage.callOutcome, 'missed');
// Rechazada y no conectada.
const CALL3 = uuid();
await call(P2, 'offer', { linkId: L5, callId: CALL3, sdp: SDP });
await callRejects(P2, 'decline', { callId: CALL3 }, 'NOT_ALLOWED');
assert.equal((await call(C4, 'decline', { callId: CALL3 })).outcome, 'declined');
await callRejects(C4, 'answer', { callId: CALL3, sdp: SDP }, 'CALL_ENDED');
const CALL4 = uuid();
await call(P2, 'offer', { linkId: L5, callId: CALL4, sdp: SDP });
assert.equal((await call(P2, 'fail', { callId: CALL4 })).outcome, 'failed');
const CALL5 = uuid();
await call(C4, 'offer', { linkId: L5, callId: CALL5, sdp: SDP });
assert.equal((await call(C4, 'end', { callId: CALL5 })).outcome, 'missed', 'cancelada por quien llama → perdida para la otra persona');
assert.deepEqual((await chat(P2, 'messages', { linkId: L5 })).messages.map((m) => m.callOutcome), ['answered', 'missed', 'declined', 'failed', 'missed']);
await callRejects(P2, 'borrar', { callId: CALL5 }, 'INVALID_ACTION');
await assert.rejects(as(P2, () => db.query(`select * from public.care_link_calls`)), /permission denied/);
await callRejects('', 'incoming', {}, 'AUTH_REQUIRED');
// Al desvincular durante una llamada, se corta.
const CALL6 = uuid();
await call(P2, 'offer', { linkId: L5, callId: CALL6, sdp: SDP });
await db.query(`update public.care_links set revoked_at = now() where id = $1`, [L5]);
assert.equal(await call(C4, 'incoming'), null);
assert.equal((await db.query(`select state from public.care_link_calls where id = $1`, [CALL6])).rows[0].state, 'ended');

// ─── Portabilidad («Descargar mis datos») ────────────────────────────────────────────────────────────────
r = await chat(P, 'export');
assert.equal(r.conversations.length, 1);
assert.deepEqual(r.conversations[0].messages.map((m) => m.senderId), [P, P, C]);

// ─── Conservación: 90 días; al desvincular deja de verse y se borra ──────────────────────────────────────
await db.query(`update public.care_chat_messages set created_at = now() - interval '91 days' where id = $1`, [M1]);
let removed = (await db.query(`select mediclaro_private.care_chat_cleanup() as n`)).rows[0].n;
// El mensaje de más de 90 días y los 6 registros de llamadas de la vinculación que se deshizo (L5).
assert.equal(removed, 1 + 6, 'se borra lo que tiene más de 90 días y lo de las vinculaciones deshechas');
assert.equal((await chat(P, 'messages', { linkId: L1 })).messages.length, 2);
await db.query(`update public.care_links set revoked_at = now() where id = $1`, [L1]);
assert.equal((await chat(P, 'list')).conversations.length, 0, 'al desvincular, la conversación deja de verse al momento');
await rejects(C, 'messages', { linkId: L1 }, 'NOT_ALLOWED');
removed = (await db.query(`select mediclaro_private.care_chat_cleanup() as n`)).rows[0].n;
assert.equal(removed, 2, 'y la limpieza diaria la borra');
assert.equal((await db.query(`select count(*) from cron.job where jobname = 'mediclaro-care-chat-cleanup'`)).rows[0].count, 1);

// ─── Eliminar la cuenta borra sus mensajes ───────────────────────────────────────────────────────────────
await db.query(`update public.profiles set sub_state = 'ACTIVE' where id = $1`, [F]);
await chat(C2, 'send', { linkId: L2, content: 'Hola, Rosa', clientKey: uuid() });
await db.query(`delete from auth.users where id = $1`, [C2]);
assert.equal(Number((await db.query(`select count(*) from public.care_chat_messages where link_id = $1`, [L2])).rows[0].count), 0);

console.log('MIGRACION_CHAT_Y_LLAMADAS_CUIDADOR=OK');
