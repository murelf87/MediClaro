-- MediClaro · Tope mensual de gasto de la voz natural (11/10/2026). ADITIVA.
-- Cuando el gasto estimado del mes llega al tope, el servidor deja de pedir voz a Google (error TTS_BUDGET) y la app
-- lee sola con la voz del teléfono. Al empezar el mes siguiente se reinicia.
--  · El gasto es una ESTIMACIÓN por caracteres (dólares por millón de caracteres, configurable). Google factura por uso.
--  · tope = 0 → voz natural apagada (siempre la del teléfono).
--  · El propietario lo cambia desde el panel (owner_settings: budget_get / budget_set), queda en el registro.
-- Se puede aplicar dos veces sin problema.

begin;

create table if not exists mediclaro_private.voice_usage (
  month text primary key check (month ~ '^[0-9]{4}-[0-9]{2}$'),
  chars bigint not null default 0 check (chars >= 0),
  blocked bigint not null default 0 check (blocked >= 0),
  updated_at timestamptz not null default now()
);
alter table mediclaro_private.voice_usage enable row level security;
revoke all on mediclaro_private.voice_usage from public, anon, authenticated;

-- Ajustes del tope: NO son de lectura pública (solo se leen por owner_settings y voice_budget_take).
insert into public.app_config (key, value, description)
values ('voice_budget', jsonb_build_object('limit_usd', 25, 'usd_per_million_chars', 30),
        'Tope mensual de gasto estimado de la voz natural (USD) y precio estimado por millón de caracteres.')
on conflict (key) do nothing;

-- Un solo punto de verdad para leer los ajustes con valores seguros por defecto.
create or replace function mediclaro_private.voice_budget_settings(out limit_usd numeric, out usd_per_million numeric)
language sql stable set search_path = pg_catalog as $$
  select coalesce((select (value->>'limit_usd')::numeric from public.app_config where key = 'voice_budget'), 25),
         coalesce((select (value->>'usd_per_million_chars')::numeric from public.app_config where key = 'voice_budget'), 30)
$$;
revoke all on function mediclaro_private.voice_budget_settings() from public, anon, authenticated;

-- Reserva caracteres para una petición a Google. Devuelve true si cabe en el tope del mes (y los suma), false si no.
-- Atómica: dos peticiones a la vez no pueden pasarse del tope. Solo la usan las funciones del servidor.
create or replace function public.voice_budget_take(p_chars integer) returns boolean
language plpgsql volatile security definer set search_path = pg_catalog as $$
declare
  v_month text := to_char(now() at time zone 'Europe/Madrid', 'YYYY-MM');
  v_limit numeric; v_price numeric; v_max_chars bigint; v_chars bigint;
begin
  if p_chars is null or p_chars < 0 then raise exception 'INVALID_REQUEST' using errcode = '22023'; end if;
  select s.limit_usd, s.usd_per_million into v_limit, v_price from mediclaro_private.voice_budget_settings() s;
  if v_limit <= 0 or v_price <= 0 then
    v_max_chars := 0;
  else
    v_max_chars := floor(v_limit / v_price * 1000000);
  end if;
  insert into mediclaro_private.voice_usage (month) values (v_month) on conflict (month) do nothing;
  select chars into v_chars from mediclaro_private.voice_usage where month = v_month for update;
  if v_chars + p_chars > v_max_chars then
    update mediclaro_private.voice_usage set blocked = blocked + 1, updated_at = now() where month = v_month;
    return false;
  end if;
  update mediclaro_private.voice_usage set chars = chars + p_chars, updated_at = now() where month = v_month;
  return true;
end $$;
revoke all on function public.voice_budget_take(integer) from public, anon, authenticated;
grant execute on function public.voice_budget_take(integer) to service_role;

-- Panel del propietario: se amplía owner_settings con budget_get / budget_set (voice_get / voice_set no cambian).
create or replace function public.owner_settings(p_action text, p_payload jsonb default '{}'::jsonb) returns jsonb
language plpgsql volatile security definer set search_path = pg_catalog as $$
declare u uuid := auth.uid(); a text := lower(coalesce(p_action, '')); pl jsonb := coalesce(p_payload, '{}'::jsonb);
  v_mode text; v_old text;
  v_limit numeric; v_price numeric; v_old_limit numeric; v_month text := to_char(now() at time zone 'Europe/Madrid', 'YYYY-MM');
  v_chars bigint; v_blocked bigint;
begin
  if u is null then raise exception 'AUTH_REQUIRED' using errcode = '42501'; end if;
  if not mediclaro_private.is_owner(u) then raise exception 'OWNER_REQUIRED' using errcode = '42501'; end if;
  if jsonb_typeof(pl) <> 'object' then raise exception 'INVALID_REQUEST' using errcode = '22023'; end if;
  if not public.hit_rate_limit(u, 'owner_admin', 240) then raise exception 'RATE_LIMIT' using errcode = 'P0001'; end if;
  -- Igual que el resto del panel: hace falta el panel abierto.
  perform mediclaro_private.owner_touch_session(u, pl->>'session');
  pl := pl - 'session';

  case a
    when 'voice_get' then
      return jsonb_build_object('mode', coalesce((select value->>'mode' from public.app_config where key = 'voice'), 'natural'));
    when 'voice_set' then
      v_mode := pl->>'mode';
      if v_mode is null or v_mode not in ('natural', 'device') then raise exception 'INVALID_REQUEST' using errcode = '22023'; end if;
      select value->>'mode' into v_old from public.app_config where key = 'voice';
      insert into public.app_config (key, value, description)
      values ('voice', jsonb_build_object('mode', v_mode), 'Voz de la app: natural (Google) o la del teléfono. Se cambia desde el panel.')
      on conflict (key) do update set value = jsonb_build_object('mode', v_mode), updated_at = now();
      perform mediclaro_private.owner_audit(u, 'owner_voice_mode', jsonb_build_object('from', coalesce(v_old, 'natural'), 'to', v_mode));
      return jsonb_build_object('mode', v_mode);
    when 'budget_get' then
      select s.limit_usd, s.usd_per_million into v_limit, v_price from mediclaro_private.voice_budget_settings() s;
      select coalesce(chars, 0), coalesce(blocked, 0) into v_chars, v_blocked from mediclaro_private.voice_usage where month = v_month;
      return jsonb_build_object('limitUsd', v_limit, 'usdPerMillion', v_price, 'month', v_month,
                                'chars', coalesce(v_chars, 0), 'blocked', coalesce(v_blocked, 0),
                                'spentUsd', round(coalesce(v_chars, 0) * v_price / 1000000, 2));
    when 'budget_set' then
      if coalesce(pl->>'limitUsd', '') !~ '^[0-9]{1,4}(\.[0-9]{1,2})?$' then raise exception 'INVALID_REQUEST' using errcode = '22023'; end if;
      v_limit := (pl->>'limitUsd')::numeric;
      select s.limit_usd, s.usd_per_million into v_old_limit, v_price from mediclaro_private.voice_budget_settings() s;
      insert into public.app_config (key, value, description)
      values ('voice_budget', jsonb_build_object('limit_usd', v_limit, 'usd_per_million_chars', v_price),
              'Tope mensual de gasto estimado de la voz natural (USD) y precio estimado por millón de caracteres.')
      on conflict (key) do update set value = jsonb_build_object('limit_usd', v_limit, 'usd_per_million_chars', v_price), updated_at = now();
      perform mediclaro_private.owner_audit(u, 'owner_voice_budget', jsonb_build_object('from', v_old_limit, 'to', v_limit));
      select coalesce(chars, 0), coalesce(blocked, 0) into v_chars, v_blocked from mediclaro_private.voice_usage where month = v_month;
      return jsonb_build_object('limitUsd', v_limit, 'usdPerMillion', v_price, 'month', v_month,
                                'chars', coalesce(v_chars, 0), 'blocked', coalesce(v_blocked, 0),
                                'spentUsd', round(coalesce(v_chars, 0) * v_price / 1000000, 2));
    else
      raise exception 'INVALID_REQUEST' using errcode = '22023';
  end case;
end $$;

revoke all on function public.owner_settings(text, jsonb) from public;
grant execute on function public.owner_settings(text, jsonb) to authenticated;

commit;
