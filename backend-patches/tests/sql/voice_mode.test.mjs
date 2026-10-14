// Voz de la app: prueba la migración 20261011180000_voice_mode.sql en PostgreSQL en memoria (PGlite), con dobles
// mínimos de Supabase (roles, auth.uid, propietario, sesión del panel, registro). Sin red ni claves.
// Uso:  node voice_mode.test.mjs <ruta de la migración>      (necesita @electric-sql/pglite)
import { PGlite } from '@electric-sql/pglite';
import fs from 'node:fs';
import assert from 'node:assert/strict';

const migration = fs.readFileSync(process.argv[2], 'utf8');
const db = new PGlite();
const OWNER = '11111111-1111-1111-1111-111111111111';
const USER = '22222222-2222-2222-2222-222222222222';

await db.exec(`
create role anon; create role authenticated;
create schema auth; create schema mediclaro_private;
grant usage on schema public to authenticated, anon;
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
grant usage on schema auth to authenticated, anon; grant execute on function auth.uid() to authenticated, anon;
create function mediclaro_private.is_owner(p_user uuid) returns boolean language sql stable as $$ select p_user = '${OWNER}'::uuid $$;
create function public.hit_rate_limit(p_user uuid, p_bucket text, p_max int) returns boolean language sql as $$ select true $$;
-- Sesión del panel: sin sesión abierta, el panel está cerrado.
create function mediclaro_private.owner_touch_session(p_user uuid, p_session text) returns uuid language plpgsql as $$
begin
  if coalesce(p_session, '') <> 'abierto' then raise exception 'OWNER_LOCKED' using errcode = '42501'; end if;
  return gen_random_uuid();
end $$;
create table public.audit_log (id bigint generated always as identity primary key, user_id uuid, action text not null, meta jsonb, created_at timestamptz not null default now());
create function mediclaro_private.owner_audit(p_user uuid, p_action text, p_meta jsonb default '{}'::jsonb) returns void
language sql volatile security definer set search_path = pg_catalog as $$
  insert into public.audit_log (user_id, action, meta) values (p_user, p_action, coalesce(p_meta, '{}'::jsonb))
$$;
create table public.app_config (key text primary key, value jsonb not null, description text, updated_at timestamptz not null default now());
alter table public.app_config enable row level security;
grant select on table public.app_config to anon, authenticated;
create policy "app_config_public_read" on public.app_config for select to anon, authenticated using (key in ('plans', 'emergency'));
insert into public.app_config (key, value) values ('plans', '{"x":1}'), ('emergency', '{"y":2}'), ('app_notice', '{"secret":true}');
`);

// Dos veces: la migración se puede aplicar de nuevo sin romper nada.
await db.exec(migration);
await db.exec(migration);

async function as(user, sql, params = []) {
  await db.exec(`reset role; select set_config('request.jwt.claim.sub', '${user ?? ''}', false);`);
  await db.exec(user ? 'set role authenticated' : 'set role anon');
  try {
    return await db.query(sql, params);
  } finally {
    await db.exec('reset role');
  }
}
const rpc = (user, action, payload) => as(user, 'select public.owner_settings($1, $2::jsonb) as r', [action, JSON.stringify(payload)]).then((x) => x.rows[0].r);
const rejects = async (p, code) => {
  await assert.rejects(p, (e) => String(e.message).includes(code), `debía fallar con ${code}`);
};

// Por defecto: voz natural (como hasta ahora) y la puede leer cualquiera, también sin cuenta.
const anonRead = await as(null, "select key, value from public.app_config order by key");
assert.deepEqual(anonRead.rows.map((r) => r.key), ['emergency', 'plans', 'voice'], 'sin cuenta se leen plans, emergency y voice (y nada más)');
assert.equal(anonRead.rows.find((r) => r.key === 'voice').value.mode, 'natural');

// Solo el propietario con el panel abierto.
await rejects(rpc(null, 'voice_get', {}), 'permission denied'); // sin cuenta ni siquiera se puede llamar
await rejects(rpc(USER, 'voice_set', { mode: 'device', session: 'abierto' }), 'OWNER_REQUIRED');
await rejects(rpc(OWNER, 'voice_set', { mode: 'device' }), 'OWNER_LOCKED');
await rejects(rpc(OWNER, 'voice_set', { mode: 'robot', session: 'abierto' }), 'INVALID_REQUEST');
await rejects(rpc(OWNER, 'otra_cosa', { session: 'abierto' }), 'INVALID_REQUEST');

assert.deepEqual(await rpc(OWNER, 'voice_get', { session: 'abierto' }), { mode: 'natural' });
assert.deepEqual(await rpc(OWNER, 'voice_set', { mode: 'device', session: 'abierto' }), { mode: 'device' });
assert.equal((await as(USER, "select value from public.app_config where key = 'voice'")).rows[0].value.mode, 'device', 'la ven todas las personas');
assert.deepEqual(await rpc(OWNER, 'voice_get', { session: 'abierto' }), { mode: 'device' });

// Nadie puede cambiarla escribiendo en la tabla directamente.
await rejects(as(USER, "update public.app_config set value = '{\"mode\":\"natural\"}' where key = 'voice'"), 'permission denied');

// Queda en el registro.
const audit = await db.query("select action, meta from public.audit_log where action = 'owner_voice_mode'");
assert.equal(audit.rows.length, 1);
assert.deepEqual(audit.rows[0].meta, { from: 'natural', to: 'device' });

// Aplicarla otra vez no cambia la voz elegida.
await db.exec(migration);
assert.equal((await db.query("select value->>'mode' as m from public.app_config where key = 'voice'")).rows[0].m, 'device');

console.log('MIGRACION_VOZ_DE_LA_APP=OK');
