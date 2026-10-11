-- MediClaro · «IA este mes» en el panel del propietario (11/10/2026). ADITIVA, solo lectura.
-- Resume lo que se ha usado y el coste ESTIMADO de la IA en el mes en curso (hora de Madrid): preguntas al asistente,
-- escaneos, coste de texto e imagen (el que ya se apunta en usage_events) y la voz natural (caracteres y dólares
-- estimados del tope mensual). Sin datos médicos ni textos de nadie: solo cuentas.
-- Solo propietarios con el panel abierto. Se puede aplicar dos veces sin problema.

begin;

create or replace function public.owner_ai_usage(p_action text, p_payload jsonb default '{}'::jsonb) returns jsonb
language plpgsql volatile security definer set search_path = pg_catalog as $$
declare u uuid := auth.uid(); a text := lower(coalesce(p_action, '')); pl jsonb := coalesce(p_payload, '{}'::jsonb);
  v_month text := to_char(now() at time zone 'Europe/Madrid', 'YYYY-MM');
  v_since timestamptz := date_trunc('month', now() at time zone 'Europe/Madrid') at time zone 'Europe/Madrid';
  v_chats bigint; v_people bigint; v_scans bigint; v_cost numeric; v_chars bigint; v_blocked bigint;
  v_limit numeric; v_price numeric; v_top jsonb;
begin
  if u is null then raise exception 'AUTH_REQUIRED' using errcode = '42501'; end if;
  if not mediclaro_private.is_owner(u) then raise exception 'OWNER_REQUIRED' using errcode = '42501'; end if;
  if jsonb_typeof(pl) <> 'object' then raise exception 'INVALID_REQUEST' using errcode = '22023'; end if;
  if not public.hit_rate_limit(u, 'owner_admin', 240) then raise exception 'RATE_LIMIT' using errcode = 'P0001'; end if;
  perform mediclaro_private.owner_touch_session(u, pl->>'session');

  if a <> 'month' then raise exception 'INVALID_REQUEST' using errcode = '22023'; end if;

  select count(*) filter (where kind = 'chat'),
         count(distinct user_id) filter (where kind = 'chat'),
         count(*) filter (where kind = 'scan'),
         coalesce(sum(cost_micros), 0)::numeric / 1000000
    into v_chats, v_people, v_scans, v_cost
    from public.usage_events where created_at >= v_since;

  -- Las personas que más preguntan (solo cuántas preguntas, nunca quiénes son): para ver si el límite diario es justo.
  select coalesce(jsonb_agg(n order by n desc), '[]'::jsonb) into v_top
    from (select count(*) as n from public.usage_events
           where kind = 'chat' and user_id is not null and created_at >= v_since
           group by user_id order by count(*) desc limit 5) t;

  select coalesce(chars, 0), coalesce(blocked, 0) into v_chars, v_blocked from mediclaro_private.voice_usage where month = v_month;
  select s.limit_usd, s.usd_per_million into v_limit, v_price from mediclaro_private.voice_budget_settings() s;

  return jsonb_build_object(
    'month', v_month,
    'chats', coalesce(v_chats, 0),
    'chatPeople', coalesce(v_people, 0),
    'scans', coalesce(v_scans, 0),
    'aiCostEur', round(coalesce(v_cost, 0), 4),
    'voiceChars', coalesce(v_chars, 0),
    'voiceBlocked', coalesce(v_blocked, 0),
    'voiceUsd', round(coalesce(v_chars, 0) * v_price / 1000000, 2),
    'voiceLimitUsd', v_limit,
    'topChats', v_top);
end $$;

revoke all on function public.owner_ai_usage(text, jsonb) from public, anon;
grant execute on function public.owner_ai_usage(text, jsonb) to authenticated;

commit;
