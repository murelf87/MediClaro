-- ─────────────────────────────────────────────────────────────────────────────
-- MediClaro · INTEGRADO R-09 + R-10  — preguntas restantes del asistente y cancelación
--
-- R-09: `get_account_status()` no dice cuántas preguntas al asistente lleva la persona hoy, así que la app
--       solo puede avisar cuando ya ha llegado al límite. Se añaden `chats_today`, `chat_per_day` y
--       `chats_left_today`.
-- R-10: se añade `cancel_at_period_end` (lo escribe el webhook corregido; ver functions/stripe-webhook).
--
-- Dos ajustes de criterio, aplicados IGUAL en el contador y en el límite (`can_chat`) para que lo que ve
-- la persona coincida con lo que aplica el servidor:
--   · El «día» empieza a las 00:00 de España (Europe/Madrid), no a las 00:00 UTC (las 01:00 o 02:00 en
--     España). La app dice «Mañana podrás volver a preguntar»: así es exacto.
--   · Los mensajes derivados a emergencia no gastan preguntas (no llaman a la IA ni tienen coste).
--
-- Mantiene todos los campos actuales de `get_account_status()` (compatible con la app publicada).
-- Idempotente. Pruebas: backend-patches/tests (npm test) — «R-09».
-- ─────────────────────────────────────────────────────────────────────────────

-- Inicio del día en España.
create or replace function public.chat_day_start()
returns timestamptz
language sql
stable
set search_path = public
as $$
  select date_trunc('day', now() at time zone 'Europe/Madrid') at time zone 'Europe/Madrid'
$$;

-- Preguntas respondidas hoy (sin contar las derivadas a emergencia).
create or replace function public.chats_today(p_user uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::int
    from public.usage_events
   where user_id = p_user
     and kind = 'chat'
     and coalesce(detail, '') <> 'emergency'
     and created_at >= public.chat_day_start()
$$;

revoke all on function public.chat_day_start() from public, anon, authenticated;
revoke all on function public.chats_today(uuid) from public, anon, authenticated;

-- Límite diario del asistente con el mismo recuento.
create or replace function public.can_chat(p_user uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  p public.profiles;
  c public.plan_config;
begin
  select * into p from public.profiles where id = p_user;
  select * into c from public.plan_config where plan = case when public.is_premium(p) then 'premium' else 'free' end;
  return public.chats_today(p_user) < c.chat_per_day;
end $$;

revoke all on function public.can_chat(uuid) from public, anon, authenticated;

-- Estado de la cuenta para la app (solo lectura, de la propia persona).
create or replace function public.get_account_status()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  p public.profiles;
  n int;
  c public.plan_config;
  chats int;
begin
  select * into p from public.profiles where id = auth.uid();
  if not found then return null; end if;
  select * into c from public.plan_config where plan = case when public.is_premium(p) then 'premium' else 'free' end;
  select count(*) into n from public.scans
   where user_id = p.id and created_at >= public.period_start_for(p) and status <> 'not_found';
  chats := public.chats_today(p.id);
  return jsonb_build_object(
    'plan', case when public.is_premium(p) then 'premium' else 'free' end,
    'state', p.sub_state,
    'period_end', p.current_period_end,
    'cancel_at_period_end', p.cancel_at_period_end,
    'scans_this_period', n,
    'included_scans', c.monthly_scans,
    'free_scans_left', greatest(0, c.monthly_scans - n),
    'chats_today', chats,
    'chat_per_day', c.chat_per_day,
    'chats_left_today', greatest(0, c.chat_per_day - chats),
    'settings', jsonb_build_object('display_name', p.display_name, 'font_size', p.font_size, 'easy_mode', p.easy_mode,
                                   'speech_rate', p.speech_rate, 'locale', p.locale, 'onboarded', p.onboarded,
                                   'country', p.country)
  );
end $$;

revoke all on function public.get_account_status() from public, anon;
grant execute on function public.get_account_status() to authenticated;
