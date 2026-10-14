// Tope mensual de la voz natural: prueba 20261011180000_voice_mode.sql + 20261011200000_voice_budget.sql en PostgreSQL
// en memoria (PGlite). Sin red ni claves.
// Uso:  node voice_budget.test.mjs <voice_mode.sql> <voice_budget.sql>      (necesita @electric-sql/pglite)
import { PGlite } from '@electric-sql/pglite';
import fs from 'node:fs';
import assert from 'node:assert/strict';

const modeSql = fs.readFileSync(process.argv[2], 'utf8');
const budgetSql = fs.readFileSync(process.argv[3], 'utf8');
const db = new PGlite();
const OWNER = '11111111-1111-1111-1111-111111111111';
const USER = '22222222-2222-2222-2222-222222222222';

await db.exec(`
create role anon; create role authenticated; create role service_role;
create schema auth; create schema mediclaro_private;
grant usage on schema public to authenticated, anon, service_role;
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
grant usage on schema auth to authenticated, anon; grant execute on function auth.uid() to authenticated, anon;
create function mediclaro_private.is_owner(p_user uuid) returns boolean language sql stable as $$ select p_user = '${OWNER}'::uuid $$;
create function public.hit_rate_limit(p_user uuid, p_bucket text, p_max int) returns boolean language sql as $$ select true $$;
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
`);
await db.exec(modeSql);
// Dos veces: se puede aplicar de nuevo sin romper nada.
await db.exec(budgetSql);
await db.exec(budgetSql);

async function as(role, user, sql, params = []) {
  await db.exec(`reset role; select set_config('request.jwt.claim.sub', '${user ?? ''}', false); set role ${role}`);
  try { return await db.query(sql, params); } finally { await db.exec('reset role'); }
}
const rpc = (user, action, payload) => as('authenticated', user, 'select public.owner_settings($1, $2::jsonb) as r', [action, JSON.stringify(payload)]).then((x) => x.rows[0].r);
const take = (n) => as('service_role', null, 'select public.voice_budget_take($1) as ok', [n]).then((x) => x.rows[0].ok);
const rejects = async (p, code) => { await assert.rejects(p, (e) => String(e.message).includes(code), `debía fallar con ${code}`); };

// Tope por defecto 25 USD a 30 USD por millón → 833.333 caracteres.
assert.equal(await take(1000), true, 'cabe');
assert.equal(await take(832_333), true, 'justo en el tope');
assert.equal(await take(1), false, 'una más ya no cabe');
let b = await rpc(OWNER, 'budget_get', { session: 'abierto' });
assert.equal(b.chars, 833_333);
assert.equal(b.blocked, 1);
assert.equal(b.limitUsd, 25);
assert.equal(b.spentUsd, 25);

// Subir el tope desde el panel desbloquea; bajarlo a 0 apaga la voz natural.
b = await rpc(OWNER, 'budget_set', { limitUsd: 30, session: 'abierto' });
assert.equal(b.limitUsd, 30);
assert.equal(await take(1000), true, 'con más tope vuelve a caber');
await rpc(OWNER, 'budget_set', { limitUsd: 0, session: 'abierto' });
assert.equal(await take(1), false, 'tope 0 = voz natural apagada');
await rpc(OWNER, 'budget_set', { limitUsd: '12.5', session: 'abierto' }).catch(() => {});
assert.equal((await rpc(OWNER, 'budget_get', { session: 'abierto' })).limitUsd, 12.5);

// Quién puede qué.
await rejects(as('anon', null, 'select public.voice_budget_take(1)'), 'permission denied');
await rejects(as('authenticated', USER, 'select public.voice_budget_take(1)'), 'permission denied');
await rejects(rpc(USER, 'budget_set', { limitUsd: 1, session: 'abierto' }), 'OWNER_REQUIRED');
await rejects(rpc(OWNER, 'budget_set', { limitUsd: 1 }), 'OWNER_LOCKED');
await rejects(rpc(OWNER, 'budget_set', { limitUsd: -3, session: 'abierto' }), 'INVALID_REQUEST');
await rejects(rpc(OWNER, 'budget_set', { limitUsd: 'mucho', session: 'abierto' }), 'INVALID_REQUEST');
await rejects(as('authenticated', USER, 'select * from mediclaro_private.voice_usage'), 'permission denied');
// Los ajustes del tope no los lee cualquiera (solo plans, emergency y voice).
const anon = await as('anon', null, 'select key from public.app_config order by key');
assert.ok(!anon.rows.some((r) => r.key === 'voice_budget'), 'voice_budget no es público');

// Lo de voz (modo) sigue funcionando.
assert.deepEqual(await rpc(OWNER, 'voice_set', { mode: 'device', session: 'abierto' }), { mode: 'device' });

// Queda en el registro.
const audit = await db.query("select meta from public.audit_log where action = 'owner_voice_budget' order by id");
assert.ok(audit.rows.length >= 3);
assert.deepEqual(audit.rows[0].meta, { from: 25, to: 30 });

// Mes nuevo: empieza de cero.
await db.exec("update mediclaro_private.voice_usage set month = '2000-01'");
await rpc(OWNER, 'budget_set', { limitUsd: 25, session: 'abierto' });
assert.equal(await take(500_000), true, 'mes nuevo, contador a cero');

console.log('MIGRACION_TOPE_DE_LA_VOZ=OK');
