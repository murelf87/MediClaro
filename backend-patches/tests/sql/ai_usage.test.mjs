// «IA este mes» del panel: prueba 20261011180000_voice_mode.sql + 20261011200000_voice_budget.sql +
// 20261011210000_ai_usage.sql en PostgreSQL en memoria (PGlite). Sin red ni claves.
// Uso:  node ai_usage.test.mjs <voice_mode.sql> <voice_budget.sql> <ai_usage.sql>
import { PGlite } from '@electric-sql/pglite';
import fs from 'node:fs';
import assert from 'node:assert/strict';

const [modeSql, budgetSql, usageSql] = process.argv.slice(2, 5).map((p) => fs.readFileSync(p, 'utf8'));
const db = new PGlite();
const OWNER = '11111111-1111-1111-1111-111111111111';
const A = '22222222-2222-2222-2222-222222222222';
const B = '33333333-3333-3333-3333-333333333333';

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
language sql volatile security definer set search_path = pg_catalog as $$ insert into public.audit_log (user_id, action, meta) values (p_user, p_action, p_meta) $$;
create table public.app_config (key text primary key, value jsonb not null, description text, updated_at timestamptz not null default now());
alter table public.app_config enable row level security;
grant select on table public.app_config to anon, authenticated;
create policy "app_config_public_read" on public.app_config for select to anon, authenticated using (key in ('plans', 'emergency'));
create table public.usage_events (id bigint generated always as identity primary key, user_id uuid, kind text not null, detail text, cost_micros int not null default 0, created_at timestamptz not null default now());
alter table public.usage_events enable row level security;
`);
await db.exec(modeSql);
await db.exec(budgetSql);
await db.exec(usageSql);
await db.exec(usageSql); // se puede aplicar otra vez

// Este mes: A pregunta 3 veces, B 1; 2 escaneos; costes. El mes pasado no cuenta.
await db.exec(`
insert into public.usage_events (user_id, kind, detail, cost_micros) values
 ('${A}','chat','gemini',150),('${A}','chat','gemini',150),('${A}','chat','gemini',150),('${B}','chat','gemini',150),
 ('${A}','scan','gemini',400),('${B}','scan','gemini',400);
insert into public.usage_events (user_id, kind, detail, cost_micros, created_at) values
 ('${A}','chat','gemini',999999, now() - interval '70 days');
`);
await db.exec("reset role; set role service_role"); await db.query('select public.voice_budget_take(100000)'); await db.exec('reset role');

async function as(role, user, sql, params = []) {
  await db.exec(`reset role; select set_config('request.jwt.claim.sub', '${user ?? ''}', false); set role ${role}`);
  try { return await db.query(sql, params); } finally { await db.exec('reset role'); }
}
const usage = (user, payload) => as('authenticated', user, 'select public.owner_ai_usage($1, $2::jsonb) as r', ['month', JSON.stringify(payload)]).then((x) => x.rows[0].r);
const rejects = async (p, code) => { await assert.rejects(p, (e) => String(e.message).includes(code), `debía fallar con ${code}`); };

const r = await usage(OWNER, { session: 'abierto' });
assert.equal(r.chats, 4);
assert.equal(r.chatPeople, 2);
assert.equal(r.scans, 2);
assert.equal(r.aiCostEur, 0.0014, 'solo el mes en curso: 4×150 + 2×400 = 1.400 millonésimas');
assert.equal(r.voiceChars, 100000);
assert.equal(r.voiceUsd, 3);
assert.equal(r.voiceLimitUsd, 25);
assert.deepEqual(r.topChats, [3, 1], 'solo cuentas, sin saber quién es quién');
assert.match(r.month, /^[0-9]{4}-[0-9]{2}$/);
assert.ok(!JSON.stringify(r).includes(A) && !JSON.stringify(r).includes(B), 'nadie aparece con su identificador');

await rejects(as('anon', null, "select public.owner_ai_usage('month', '{}')"), 'permission denied');
await rejects(usage(A, { session: 'abierto' }), 'OWNER_REQUIRED');
await rejects(usage(OWNER, {}), 'OWNER_LOCKED');
await rejects(as('authenticated', OWNER, "select public.owner_ai_usage('otra', '{\"session\":\"abierto\"}')"), 'INVALID_REQUEST');

console.log('MIGRACION_IA_ESTE_MES=OK');
