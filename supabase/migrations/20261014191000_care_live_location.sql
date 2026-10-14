-- Ubicación en directo desde el chat de cuidado.
--  · Solo la persona que paga Premium (paciente del vínculo) puede compartirla, durante el tiempo que ella elija
--    (15 min, 1 h u 8 h). Se puede parar en cualquier momento y caduca sola.
--  · La persona cuidadora solo la ve mientras está activa. Al caducar o parar se borran las coordenadas.
--  · Una sola ubicación por vínculo (se sobrescribe): no se guarda historial de recorridos.
--  · Al empezar y al parar se deja un mensaje en el chat (y por tanto su aviso push), para que nadie se entere tarde.

create table if not exists public.care_live_locations (
  link_id uuid primary key references public.care_links(id) on delete cascade,
  patient_id uuid not null,
  started_at timestamptz not null default now(),
  expires_at timestamptz not null,
  latitude double precision,
  longitude double precision,
  accuracy real,
  updated_at timestamptz
);
alter table public.care_live_locations enable row level security; -- solo mediante la función
revoke all on public.care_live_locations from public, anon, authenticated;

create or replace function mediclaro_private.care_live_json(r public.care_live_locations, viewer uuid) returns jsonb
language sql stable set search_path = public, pg_temp as $$
  select case when r.link_id is null or r.expires_at <= now() then jsonb_build_object('active', false)
  else jsonb_build_object(
    'active', true, 'linkId', r.link_id, 'mine', r.patient_id = viewer,
    'startedAt', r.started_at, 'expiresAt', r.expires_at,
    'latitude', r.latitude, 'longitude', r.longitude, 'accuracy', r.accuracy, 'updatedAt', r.updated_at) end
$$;

create or replace function mediclaro_private.care_live_note(p_link public.care_links, p_text text) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  insert into public.care_chat_messages (link_id, sender_id, content, client_key)
  values (p_link.id, p_link.patient_id, p_text, gen_random_uuid());
  insert into public.care_chat_push_jobs (user_id, link_id) values (p_link.caregiver_id, p_link.id) on conflict do nothing;
end;
$$;

create or replace function public.care_live_location_action(p_action text, p_payload jsonb default '{}'::jsonb) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  u uuid := auth.uid();
  v_link public.care_links;
  v_patient public.profiles;
  v_row public.care_live_locations;
  v_link_id uuid;
  v_min integer;
  v_lat double precision;
  v_lng double precision;
  v_acc real;
begin
  if u is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then p_payload := '{}'::jsonb; end if;
  if p_action not in ('start', 'update', 'stop', 'get') then raise exception 'INVALID_ACTION'; end if;
  if not public.hit_rate_limit(u, 'care-live-' || p_action, case when p_action = 'update' then 40 else 30 end) then
    raise exception 'RATE_LIMIT';
  end if;
  v_link_id := mediclaro_private.care_chat_uuid(p_payload->>'linkId');
  if v_link_id is null then raise exception 'INVALID_REQUEST'; end if;
  select * into v_link from public.care_links l
  where l.id = v_link_id and l.caregiver_id is not null and l.accepted_at is not null and l.revoked_at is null
    and (l.patient_id = u or l.caregiver_id = u);
  if v_link.id is null then raise exception 'NOT_ALLOWED'; end if;

  if p_action = 'get' then
    select * into v_row from public.care_live_locations where link_id = v_link.id;
    return mediclaro_private.care_live_json(v_row, u);
  end if;

  if v_link.patient_id <> u then raise exception 'PATIENT_ONLY'; end if;

  if p_action = 'start' then
    select * into v_patient from public.profiles where id = v_link.patient_id;
    if v_patient.id is null or not public.is_premium(v_patient) then raise exception 'PREMIUM_REQUIRED'; end if;
    v_min := (p_payload->>'minutes')::integer;
    if v_min is null or v_min not in (15, 60, 480) then raise exception 'INVALID_REQUEST'; end if;
    insert into public.care_live_locations (link_id, patient_id, started_at, expires_at)
    values (v_link.id, u, now(), now() + make_interval(mins => v_min))
    on conflict (link_id) do update
      set patient_id = u, started_at = now(), expires_at = excluded.expires_at,
          latitude = null, longitude = null, accuracy = null, updated_at = null
    returning * into v_row;
    perform mediclaro_private.care_live_note(v_link, '📍 Ha empezado a compartir su ubicación en directo.');
    return mediclaro_private.care_live_json(v_row, u);
  end if;

  if p_action = 'update' then
    v_lat := (p_payload->>'latitude')::double precision;
    v_lng := (p_payload->>'longitude')::double precision;
    v_acc := nullif(p_payload->>'accuracy', '')::real;
    if v_lat is null or v_lng is null or v_lat not between -90 and 90 or v_lng not between -180 and 180 then
      raise exception 'INVALID_REQUEST';
    end if;
    update public.care_live_locations
    set latitude = v_lat, longitude = v_lng, accuracy = case when v_acc between 0 and 100000 then v_acc end, updated_at = now()
    where link_id = v_link.id and patient_id = u and expires_at > now()
    returning * into v_row;
    -- Si ya caducó o la paró, la app deja de enviar.
    if v_row.link_id is null then return jsonb_build_object('active', false); end if;
    return jsonb_build_object('active', true, 'expiresAt', v_row.expires_at);
  end if;

  -- stop
  delete from public.care_live_locations where link_id = v_link.id and patient_id = u returning * into v_row;
  if v_row.link_id is not null then
    perform mediclaro_private.care_live_note(v_link, '📍 Ha dejado de compartir su ubicación.');
  end if;
  return jsonb_build_object('active', false);
end;
$$;
revoke all on function public.care_live_location_action(text, jsonb) from public, anon;
grant execute on function public.care_live_location_action(text, jsonb) to authenticated;

-- Limpieza: las coordenadas caducadas no se conservan.
create or replace function mediclaro_private.care_live_cleanup() returns integer
language sql security definer set search_path = public, pg_temp as $$
  with d as (delete from public.care_live_locations where expires_at <= now() returning 1) select count(*)::integer from d
$$;
revoke all on function mediclaro_private.care_live_json(public.care_live_locations, uuid),
  mediclaro_private.care_live_note(public.care_links, text), mediclaro_private.care_live_cleanup() from public, anon, authenticated;

do $$ begin
  if exists (select 1 from cron.job where jobname = 'mediclaro-care-live-cleanup') then
    perform cron.unschedule('mediclaro-care-live-cleanup');
  end if;
end $$;
select cron.schedule('mediclaro-care-live-cleanup', '*/30 * * * *', $cron$ select mediclaro_private.care_live_cleanup(); $cron$);
