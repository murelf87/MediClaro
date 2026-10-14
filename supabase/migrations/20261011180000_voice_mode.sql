-- MediClaro · Voz de la app elegida por el propietario desde su panel (11/10/2026). ADITIVA.
--   'natural': voz natural de Google (Sulafat/Achird); si no llega, la mejor voz en español instalada en cada móvil.
--   'device' : siempre la voz instalada en cada móvil (gratis, sin límites; cada móvil suena distinto).
--
-- 1. Clave 'voice' en app_config (por defecto 'natural', como hasta ahora). Lectura pública, igual que 'plans' y
--    'emergency' (solo dice qué voz usar; no tiene datos de nadie).
-- 2. owner_settings(): solo propietarios con el panel abierto (código de 6 cifras o Face ID); queda en el registro.
-- Se puede aplicar dos veces sin problema.

begin;

insert into public.app_config (key, value, description)
values ('voice', jsonb_build_object('mode', 'natural'), 'Voz de la app: natural (Google) o la del teléfono. Se cambia desde el panel.')
on conflict (key) do nothing;

drop policy if exists "app_config_public_read" on public.app_config;
create policy "app_config_public_read"
  on public.app_config
  for select
  to anon, authenticated
  using (key in ('plans', 'emergency', 'voice'));

create or replace function public.owner_settings(p_action text, p_payload jsonb default '{}'::jsonb) returns jsonb
language plpgsql volatile security definer set search_path = pg_catalog as $$
declare u uuid := auth.uid(); a text := lower(coalesce(p_action, '')); pl jsonb := coalesce(p_payload, '{}'::jsonb);
  v_mode text; v_old text;
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
    else
      raise exception 'INVALID_REQUEST' using errcode = '22023';
  end case;
end $$;

revoke all on function public.owner_settings(text, jsonb) from public;
grant execute on function public.owner_settings(text, jsonb) to authenticated;

commit;
