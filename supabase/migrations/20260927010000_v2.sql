-- MediClaro v2: configuración sin código, estados de suscripción, caché,
-- Mis medicamentos, historial, ajustes de accesibilidad, auditoría y métricas.

-- 1) Configuración comercial editable desde el panel (sin tocar código)
create table public.plan_config (
  plan text primary key check (plan in ('free','premium')),
  monthly_scans int not null,            -- free: límite duro · premium: incluidas antes del pago por uso
  overage_enabled boolean not null default false,
  hard_cap int not null,                 -- tope absoluto anti-abuso / control de costes
  chat_per_day int not null,
  updated_at timestamptz not null default now()
);
insert into public.plan_config values
  ('free',    5,   false, 5,   10,  now()),
  ('premium', 100, true,  500, 200, now());
alter table public.plan_config enable row level security;
create policy "config legible" on public.plan_config for select using (true);

-- 2) Estados de suscripción normalizados y proveedor de cobro (Stripe / Apple / Google)
alter table public.profiles
  add column billing_provider text not null default 'stripe' check (billing_provider in ('stripe','apple','google')),
  add column sub_state text not null default 'FREE'
    check (sub_state in ('FREE','TRIAL','ACTIVE','PAST_DUE','CANCELLED','EXPIRED')),
  add column display_name text,
  add column locale text not null default 'es-ES',
  add column font_size text not null default 'grande' check (font_size in ('normal','grande','muy_grande')),
  add column easy_mode boolean not null default false,
  add column speech_rate real not null default 0.85 check (speech_rate between 0.5 and 1.5),
  add column country text not null default 'ES',
  add column onboarded boolean not null default false,
  add column is_admin boolean not null default false,
  add column cancel_at_period_end boolean not null default false;

-- El usuario puede cambiar SOLO sus preferencias (nunca plan, estado ni admin)
create function public.update_my_settings(p jsonb) returns void
language plpgsql security definer set search_path = public as $$
begin
  update public.profiles set
    display_name = coalesce(left(p->>'display_name', 60), display_name),
    locale      = coalesce(p->>'locale', locale),
    font_size   = coalesce(p->>'font_size', font_size),
    easy_mode   = coalesce((p->>'easy_mode')::boolean, easy_mode),
    speech_rate = coalesce((p->>'speech_rate')::real, speech_rate),
    onboarded   = coalesce((p->>'onboarded')::boolean, onboarded),
    updated_at  = now()
  where id = auth.uid();
end $$;
revoke all on function public.update_my_settings(jsonb) from public, anon;
grant execute on function public.update_my_settings(jsonb) to authenticated;

-- 3) Historial: más detalle y borrado por el propio usuario
alter table public.scans
  add column status text,                 -- identified | ambiguous | not_found
  add column score real,
  add column method text;                 -- barcode | cn_ocr | name_ocr
create policy "borrar mis escaneos" on public.scans for delete using (auth.uid() = user_id);

-- 4) Mis medicamentos (sin tratamientos automáticos)
create table public.saved_medications (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  nregistro text not null,
  nombre text not null,
  principio_activo text,
  presentacion text,
  favorito boolean not null default false,
  created_at timestamptz not null default now(),
  unique (user_id, nregistro)
);
alter table public.saved_medications enable row level security;
create policy "mis meds: leer"   on public.saved_medications for select using (auth.uid() = user_id);
create policy "mis meds: crear"  on public.saved_medications for insert with check (auth.uid() = user_id);
create policy "mis meds: editar" on public.saved_medications for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "mis meds: borrar" on public.saved_medications for delete using (auth.uid() = user_id);

-- 5) Caché farmacológica compartida (no contiene datos personales)
create table public.med_cache (
  provider text not null,
  key text not null,
  data jsonb not null,
  fetched_at timestamptz not null default now(),
  primary key (provider, key)
);
alter table public.med_cache enable row level security; -- solo backend

-- 6) Métricas de coste y errores (sin información médica del usuario)
create table public.usage_events (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users(id) on delete set null,
  kind text not null,          -- scan | chat | ai_call | error
  detail text,                 -- p.ej. 'gemini', 'cima_down', 'not_found'
  cost_micros int not null default 0,  -- coste estimado en millonésimas de €
  created_at timestamptz not null default now()
);
create index usage_events_kind_date on public.usage_events (kind, created_at desc);
alter table public.usage_events enable row level security; -- solo backend/admin

-- 7) Auditoría de seguridad
create table public.audit_log (
  id bigint generated always as identity primary key,
  user_id uuid,
  action text not null,        -- account_deleted | data_exported | subscription_changed | admin_config_changed
  meta jsonb,
  created_at timestamptz not null default now()
);
alter table public.audit_log enable row level security;

-- 8) Consentimientos (RGPD)
create table public.consents (
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null,          -- terms | privacy | caregiver
  version text not null,
  granted boolean not null,
  created_at timestamptz not null default now(),
  primary key (user_id, kind, version)
);
alter table public.consents enable row level security;
create policy "mis consentimientos" on public.consents for select using (auth.uid() = user_id);
create policy "dar consentimiento" on public.consents for insert with check (auth.uid() = user_id);

-- 9) Cuidador (arquitectura preparada; requiere invitación aceptada por el titular)
create table public.caregiver_links (
  id bigint generated always as identity primary key,
  owner_id uuid not null references auth.users(id) on delete cascade,
  caregiver_email text not null,
  caregiver_id uuid references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','active','revoked')),
  scopes text[] not null default '{settings,favorites}',
  created_at timestamptz not null default now()
);
alter table public.caregiver_links enable row level security;
create policy "titular gestiona" on public.caregiver_links for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
create policy "cuidador ve" on public.caregiver_links for select using (auth.uid() = caregiver_id);

-- 10) Lógica de consumo reescrita con plan_config y estados
drop function if exists public.consume_scan(uuid);
drop function if exists public.get_account_status();
drop function if exists public.plan_limits();

create or replace function public.is_premium(p public.profiles) returns boolean
language sql stable as $$ select p.sub_state in ('TRIAL','ACTIVE','PAST_DUE') $$;

create or replace function public.period_start_for(p public.profiles) returns timestamptz
language sql stable as $$
  select case when public.is_premium(p) and p.current_period_start is not null
              then p.current_period_start else date_trunc('month', now()) end
$$;

create function public.get_account_status() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare p public.profiles; n int; c public.plan_config;
begin
  select * into p from public.profiles where id = auth.uid();
  if not found then return null; end if;
  select * into c from public.plan_config where plan = case when public.is_premium(p) then 'premium' else 'free' end;
  select count(*) into n from public.scans where user_id = p.id and created_at >= public.period_start_for(p) and status <> 'not_found';
  return jsonb_build_object(
    'plan', case when public.is_premium(p) then 'premium' else 'free' end,
    'state', p.sub_state,
    'period_end', p.current_period_end,
    'scans_this_period', n,
    'included_scans', c.monthly_scans,
    'free_scans_left', greatest(0, c.monthly_scans - n),
    'settings', jsonb_build_object('display_name', p.display_name, 'font_size', p.font_size, 'easy_mode', p.easy_mode,
                                   'speech_rate', p.speech_rate, 'locale', p.locale, 'onboarded', p.onboarded, 'country', p.country)
  );
end $$;
revoke all on function public.get_account_status() from public, anon;
grant execute on function public.get_account_status() to authenticated;

-- Comprueba (sin consumir) si puede escanear: evita gastar IA si no hay cupo
create function public.can_scan(p_user uuid) returns boolean
language plpgsql stable security definer set search_path = public as $$
declare p public.profiles; n int; c public.plan_config;
begin
  select * into p from public.profiles where id = p_user;
  select * into c from public.plan_config where plan = case when public.is_premium(p) then 'premium' else 'free' end;
  select count(*) into n from public.scans where user_id = p_user and created_at >= public.period_start_for(p) and status <> 'not_found';
  return n < case when c.overage_enabled then c.hard_cap else c.monthly_scans end;
end $$;
revoke all on function public.can_scan(uuid) from public, anon, authenticated;

create function public.consume_scan(p_user uuid, p_status text, p_nregistro text, p_nombre text, p_score real, p_method text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare p public.profiles; n int; c public.plan_config; overage boolean := false; sid bigint;
begin
  select * into p from public.profiles where id = p_user for update;
  if not found then raise exception 'perfil no encontrado'; end if;
  select * into c from public.plan_config where plan = case when public.is_premium(p) then 'premium' else 'free' end;
  select count(*) into n from public.scans where user_id = p_user and created_at >= public.period_start_for(p) and status <> 'not_found';

  if p_status <> 'not_found' then
    if not c.overage_enabled and n >= c.monthly_scans then return jsonb_build_object('allowed', false); end if;
    if c.overage_enabled and n >= c.hard_cap then return jsonb_build_object('allowed', false); end if;
    overage := c.overage_enabled and n >= c.monthly_scans;
  end if;

  insert into public.scans (user_id, status, nregistro, nombre, score, method, confidence, billed_overage)
  values (p_user, p_status, p_nregistro, p_nombre, p_score, p_method,
          case when p_score >= 0.9 then 'alta' when p_score >= 0.7 then 'media' else 'baja' end, overage)
  returning id into sid;
  return jsonb_build_object('allowed', true, 'scan_id', sid, 'overage', overage, 'stripe_customer_id', p.stripe_customer_id);
end $$;
revoke all on function public.consume_scan(uuid, text, text, text, real, text) from public, anon, authenticated;

-- Chat: límite diario por plan
create function public.can_chat(p_user uuid) returns boolean
language plpgsql stable security definer set search_path = public as $$
declare p public.profiles; c public.plan_config; n int;
begin
  select * into p from public.profiles where id = p_user;
  select * into c from public.plan_config where plan = case when public.is_premium(p) then 'premium' else 'free' end;
  select count(*) into n from public.usage_events where user_id = p_user and kind = 'chat' and created_at >= date_trunc('day', now());
  return n < c.chat_per_day;
end $$;
revoke all on function public.can_chat(uuid) from public, anon, authenticated;

-- 11) Vistas para el panel de administración (solo service_role / admins)
create view public.admin_kpis with (security_invoker = true) as
select
  (select count(*) from public.profiles) as usuarios,
  (select count(*) from public.profiles where created_at >= now() - interval '30 days') as altas_30d,
  (select count(*) from public.profiles where sub_state in ('ACTIVE','TRIAL')) as premium,
  (select count(*) from public.profiles where sub_state = 'PAST_DUE') as impagados,
  (select count(*) from public.profiles where sub_state = 'CANCELLED') as cancelados,
  (select count(distinct user_id) from public.scans where created_at >= now() - interval '1 day') as dau,
  (select count(distinct user_id) from public.scans where created_at >= now() - interval '30 days') as mau,
  (select count(*) from public.scans where created_at >= date_trunc('day', now())) as escaneos_hoy,
  (select count(*) from public.scans where created_at >= date_trunc('month', now())) as escaneos_mes,
  (select coalesce(sum(cost_micros),0)/1e6 from public.usage_events where created_at >= date_trunc('month', now())) as coste_ia_mes_eur;
revoke all on public.admin_kpis from anon, authenticated;
