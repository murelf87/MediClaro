-- «Notifícanos un error» (Ayuda) y la bandeja «Errores notificados» del panel del propietario (11/10/2026).
--
--  · Cualquiera puede escribir desde la app (con o sin cuenta): public.report_problem(mensaje, contacto, contexto).
--  · Solo los propietarios, con el panel abierto, los leen y los marcan como resueltos: public.owner_reports(...).
--  · La tabla vive en el esquema privado: nadie la lee directamente; solo estas dos funciones.
--  · Límites contra abusos: 5 por hora y cuenta; sin cuenta, 3 por hora y origen y 60 por hora en total;
--    300 por hora en total para todos.
--  · Los resueltos se borran solos a los 180 días; al borrar una cuenta se borran sus mensajes.
--  · De la IP solo se guarda una huella (SHA-256), nunca la IP.

create table if not exists mediclaro_private.problem_reports (
  id uuid primary key default gen_random_uuid(),
  ref text not null unique,
  user_id uuid references auth.users(id) on delete cascade,
  message text not null check (char_length(message) between 3 and 2000),
  contact text check (contact is null or char_length(contact) <= 120),
  context jsonb not null default '{}'::jsonb check (jsonb_typeof(context) = 'object'),
  status text not null default 'new' check (status in ('new', 'read', 'resolved')),
  owner_note text check (owner_note is null or char_length(owner_note) <= 1000),
  ip_hash text,
  created_at timestamptz not null default now(),
  read_at timestamptz,
  resolved_at timestamptz,
  resolved_by uuid
);
create index if not exists problem_reports_status_idx on mediclaro_private.problem_reports (status, created_at desc);
create index if not exists problem_reports_user_idx on mediclaro_private.problem_reports (user_id, created_at desc);
create index if not exists problem_reports_ip_idx on mediclaro_private.problem_reports (ip_hash, created_at desc) where user_id is null;
alter table mediclaro_private.problem_reports enable row level security;
revoke all on mediclaro_private.problem_reports from public, anon, authenticated;

-- Referencia corta para hablar con la persona («E-7K2PX»): sin letras que se confunden (0/O, 1/I/L).
create or replace function mediclaro_private.report_ref() returns text
language plpgsql volatile set search_path = pg_catalog as $$
declare alphabet text := '23456789ABCDEFGHJKMNPQRSTUVWXYZ'; r text := ''; i int;
begin
  for i in 1..5 loop
    r := r || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
  end loop;
  return 'E-' || r;
end $$;

-- ── Enviar (desde Ayuda) ─────────────────────────────────────────────────────────────────────────────────
create or replace function public.report_problem(p_message text, p_contact text default null, p_context jsonb default '{}'::jsonb)
returns jsonb
language plpgsql volatile security definer set search_path = pg_catalog as $$
declare
  u uuid := auth.uid();
  v_msg text := btrim(coalesce(p_message, ''));
  v_contact text := nullif(btrim(coalesce(p_contact, '')), '');
  v_ctx jsonb := coalesce(p_context, '{}'::jsonb);
  v_ip text := '';
  v_ip_hash text;
  v_ref text;
  v_try int := 0;
begin
  if char_length(v_msg) < 3 then raise exception 'MESSAGE_TOO_SHORT' using errcode = '22023'; end if;
  if char_length(v_msg) > 2000 then raise exception 'MESSAGE_TOO_LONG' using errcode = '22023'; end if;
  if v_contact is not null and char_length(v_contact) > 120 then raise exception 'CONTACT_TOO_LONG' using errcode = '22023'; end if;
  if jsonb_typeof(v_ctx) <> 'object' or pg_column_size(v_ctx) > 8192 then v_ctx := '{}'::jsonb; end if;

  begin
    v_ip := btrim(split_part(coalesce(current_setting('request.headers', true)::json->>'x-forwarded-for', ''), ',', 1));
  exception when others then
    v_ip := '';
  end;
  v_ip_hash := case when v_ip = '' then null else encode(extensions.digest('mediclaro-report:' || v_ip, 'sha256'), 'hex') end;

  if (select count(*) from mediclaro_private.problem_reports where created_at > now() - interval '1 hour') >= 300 then
    raise exception 'RATE_LIMIT' using errcode = 'P0001';
  end if;
  if u is not null then
    if (select count(*) from mediclaro_private.problem_reports where user_id = u and created_at > now() - interval '1 hour') >= 5 then
      raise exception 'RATE_LIMIT' using errcode = 'P0001';
    end if;
  else
    if v_ip_hash is not null and (select count(*) from mediclaro_private.problem_reports
                                   where user_id is null and ip_hash = v_ip_hash and created_at > now() - interval '1 hour') >= 3 then
      raise exception 'RATE_LIMIT' using errcode = 'P0001';
    end if;
    if (select count(*) from mediclaro_private.problem_reports where user_id is null and created_at > now() - interval '1 hour') >= 60 then
      raise exception 'RATE_LIMIT' using errcode = 'P0001';
    end if;
  end if;

  loop
    v_try := v_try + 1;
    v_ref := mediclaro_private.report_ref();
    begin
      insert into mediclaro_private.problem_reports (ref, user_id, message, contact, context, ip_hash)
      values (v_ref, u, v_msg, v_contact, v_ctx, v_ip_hash);
      exit;
    exception when unique_violation then
      if v_try >= 5 then raise; end if;
    end;
  end loop;
  return jsonb_build_object('ok', true, 'ref', v_ref);
end $$;

revoke all on function public.report_problem(text, text, jsonb) from public;
grant execute on function public.report_problem(text, text, jsonb) to anon, authenticated;

-- ── Bandeja del propietario ─────────────────────────────────────────────────────────────────────────────
create or replace function mediclaro_private.report_json(r mediclaro_private.problem_reports, p_full boolean) returns jsonb
language sql stable security definer set search_path = pg_catalog as $$
  select jsonb_build_object(
    'id', r.id,
    'ref', r.ref,
    'status', r.status,
    'createdAt', r.created_at,
    'readAt', r.read_at,
    'resolvedAt', r.resolved_at,
    'message', case when p_full then r.message else left(r.message, 240) end,
    'contact', r.contact,
    'note', r.owner_note,
    'context', case when p_full then r.context
                    else jsonb_strip_nulls(jsonb_build_object('platform', r.context->'platform', 'appVersion', r.context->'appVersion',
                                                              'runtime', r.context->'runtime', 'screen', r.context->'screen')) end,
    'user', case when r.user_id is null then null else mediclaro_private.owner_user_json(r.user_id) end)
$$;

create or replace function public.owner_reports(p_action text, p_payload jsonb default '{}'::jsonb) returns jsonb
language plpgsql volatile security definer set search_path = pg_catalog as $$
declare u uuid := auth.uid(); a text := lower(coalesce(p_action, '')); pl jsonb := coalesce(p_payload, '{}'::jsonb);
  v_session uuid; v_id uuid; v_status text; v_filter text; v_limit int := 50; v_row mediclaro_private.problem_reports;
begin
  if u is null then raise exception 'AUTH_REQUIRED' using errcode = '42501'; end if;
  if not mediclaro_private.is_owner(u) then raise exception 'OWNER_REQUIRED' using errcode = '42501'; end if;
  if jsonb_typeof(pl) <> 'object' then raise exception 'INVALID_REQUEST' using errcode = '22023'; end if;
  if not public.hit_rate_limit(u, 'owner_admin', 240) then raise exception 'RATE_LIMIT' using errcode = 'P0001'; end if;
  -- Igual que el resto del panel: hace falta el panel abierto (código de 6 cifras o Face ID).
  v_session := mediclaro_private.owner_touch_session(u, pl->>'session');
  pl := pl - 'session';

  case a
    when 'count' then
      return jsonb_build_object(
        'open', (select count(*) from mediclaro_private.problem_reports where status <> 'resolved'),
        'new', (select count(*) from mediclaro_private.problem_reports where status = 'new'));
    when 'list' then
      v_filter := coalesce(pl->>'filter', 'open');
      if v_filter not in ('open', 'resolved', 'all') then v_filter := 'open'; end if;
      if coalesce(pl->>'limit', '') ~ '^[0-9]{1,3}$' then v_limit := least(greatest((pl->>'limit')::int, 1), 100); end if;
      return jsonb_build_object(
        'reports', coalesce((
          select jsonb_agg(mediclaro_private.report_json(r, false) order by r.created_at desc)
            from (select * from mediclaro_private.problem_reports
                   where v_filter = 'all'
                      or (v_filter = 'open' and status <> 'resolved')
                      or (v_filter = 'resolved' and status = 'resolved')
                   order by created_at desc
                   limit v_limit) r), '[]'::jsonb),
        'open', (select count(*) from mediclaro_private.problem_reports where status <> 'resolved'),
        'new', (select count(*) from mediclaro_private.problem_reports where status = 'new'));
    when 'get' then
      v_id := mediclaro_private.owner_uuid(pl->>'id');
      select * into v_row from mediclaro_private.problem_reports where id = v_id;
      if not found then raise exception 'NOT_FOUND' using errcode = 'P0002'; end if;
      if v_row.status = 'new' then
        update mediclaro_private.problem_reports set status = 'read', read_at = now() where id = v_id returning * into v_row;
      end if;
      return mediclaro_private.report_json(v_row, true);
    when 'set_status' then
      v_id := mediclaro_private.owner_uuid(pl->>'id');
      v_status := pl->>'status';
      if v_status is null or v_status not in ('read', 'resolved') then raise exception 'INVALID_REQUEST' using errcode = '22023'; end if;
      update mediclaro_private.problem_reports
         set status = v_status,
             read_at = coalesce(read_at, now()),
             resolved_at = case when v_status = 'resolved' then now() end,
             resolved_by = case when v_status = 'resolved' then u end,
             owner_note = case when pl ? 'note' then nullif(left(btrim(coalesce(pl->>'note', '')), 1000), '') else owner_note end
       where id = v_id
       returning * into v_row;
      if not found then raise exception 'NOT_FOUND' using errcode = 'P0002'; end if;
      perform mediclaro_private.owner_audit(u, case when v_status = 'resolved' then 'owner_report_resolved' else 'owner_report_reopened' end,
                                            jsonb_build_object('ref', v_row.ref));
      return mediclaro_private.report_json(v_row, true);
    else
      raise exception 'INVALID_ACTION' using errcode = '22023';
  end case;
end $$;

revoke all on function public.owner_reports(text, jsonb) from public, anon;
grant execute on function public.owner_reports(text, jsonb) to authenticated;
revoke all on function mediclaro_private.report_ref() from public, anon, authenticated;
revoke all on function mediclaro_private.report_json(mediclaro_private.problem_reports, boolean) from public, anon, authenticated;

-- Limpieza diaria (04:12): los resueltos de hace más de 180 días.
create or replace function mediclaro_private.problem_reports_cleanup() returns void
language sql volatile security definer set search_path = pg_catalog as $$
  delete from mediclaro_private.problem_reports where status = 'resolved' and resolved_at < now() - interval '180 days';
$$;
revoke all on function mediclaro_private.problem_reports_cleanup() from public, anon, authenticated;

do $$ begin
  if exists (select 1 from cron.job where jobname = 'mediclaro-reports-cleanup') then
    perform cron.unschedule('mediclaro-reports-cleanup');
  end if;
end $$;
select cron.schedule('mediclaro-reports-cleanup', '12 4 * * *', $cron$select mediclaro_private.problem_reports_cleanup()$cron$);
