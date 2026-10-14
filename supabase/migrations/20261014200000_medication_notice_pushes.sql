-- Avisos push de «Mis pastillas» entre la persona cuidada y su cuidador/a:
--   · toma confirmada u omitida  · tratamiento nuevo, cambiado, suspendido o eliminado.
-- Quién recibe: si lo hace la persona cuidada, su cuidador/a con permiso de ver su medicación; si lo hace el cuidador/a,
-- la persona cuidada. Nunca quien lo hizo. El aviso NO lleva el nombre del medicamento ni dosis (pantalla bloqueada).
-- Se generan en la base de datos (disparadores), así que no dependen de la app ni del cliente.

create table if not exists public.medication_notice_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,      -- quien recibe
  patient_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('taken','skipped','added','changed','suspended','deleted')),
  actor_role text not null check (actor_role in ('patient','caregiver')),
  scheduled_time time,
  dedupe_key text not null,
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  attempts integer not null default 0,
  lease_until timestamptz,
  provider_state text not null default 'pending',
  ticket_ids jsonb,
  unique (user_id, dedupe_key)
);
create index if not exists medication_notice_jobs_pending on public.medication_notice_jobs (created_at) where sent_at is null;
alter table public.medication_notice_jobs enable row level security;
revoke all on public.medication_notice_jobs from public, anon, authenticated;
grant all on public.medication_notice_jobs to service_role;

-- Quién recibe el aviso de algo que hizo `actor` sobre la medicación de `patient`.
create or replace function mediclaro_private.medication_notice_recipients(p_patient uuid, p_actor uuid)
returns table (recipient uuid, actor_role text)
language sql stable security definer set search_path = public, pg_temp as $$
  select m.caregiver_id, 'patient'::text
  from public.medication_care_permissions m
  join public.care_links l on l.id = m.link_id and l.caregiver_id = m.caregiver_id and l.accepted_at is not null and l.revoked_at is null
  where m.patient_id = p_patient and m.can_view and coalesce(p_actor, p_patient) = p_patient
  union all
  select p_patient, 'caregiver'::text
  where p_actor is not null and p_actor <> p_patient
    and exists (select 1 from public.care_links l where l.patient_id = p_patient and l.caregiver_id = p_actor
                  and l.accepted_at is not null and l.revoked_at is null)
$$;

create or replace function mediclaro_private.medication_notice_on_dose() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if new.status <> 'active' or new.kind not in ('taken','skipped') then return new; end if;
  insert into public.medication_notice_jobs (user_id, patient_id, kind, actor_role, scheduled_time, dedupe_key)
  select r.recipient, new.user_id, new.kind, r.actor_role, new.scheduled_time, 'dose:' || new.id
  from mediclaro_private.medication_notice_recipients(new.user_id, new.recorded_by) r
  on conflict (user_id, dedupe_key) do nothing;
  return new;
end;
$$;
drop trigger if exists medication_notice_dose on public.medication_dose_events;
create trigger medication_notice_dose after insert on public.medication_dose_events
  for each row execute function mediclaro_private.medication_notice_on_dose();

create or replace function mediclaro_private.medication_notice_on_treatment() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  k text;
  who uuid := auth.uid();
begin
  if tg_op = 'INSERT' then
    k := 'added';
  elsif new.archived_at is not null and old.archived_at is null then
    k := 'deleted';
  elsif old.active and not new.active then
    k := 'suspended';
  elsif old.version is distinct from new.version then
    k := 'changed';
  else
    return new;
  end if;
  -- Varias ediciones seguidas del mismo tratamiento: un solo aviso por tramo de 10 minutos.
  insert into public.medication_notice_jobs (user_id, patient_id, kind, actor_role, dedupe_key)
  select r.recipient, new.user_id, k, r.actor_role,
         'tr:' || new.id || ':' || k || ':' || floor(extract(epoch from now()) / 600)::bigint
  from mediclaro_private.medication_notice_recipients(new.user_id, who) r
  on conflict (user_id, dedupe_key) do nothing;
  return new;
end;
$$;
drop trigger if exists medication_notice_treatment on public.medication_treatments;
create trigger medication_notice_treatment after insert or update on public.medication_treatments
  for each row execute function mediclaro_private.medication_notice_on_treatment();

-- El repartidor (caregiver-dispatch) recoge los trabajos. Se cancelan si el vínculo ya no existe.
create or replace function public.medication_notice_claim_jobs() returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare result jsonb;
begin
  update public.medication_notice_jobs j set sent_at = now(), provider_state = 'cancelled'
  where j.sent_at is null and (
    j.created_at < now() - interval '1 day'
    or not exists (select 1 from public.care_links l
                   where ((l.patient_id = j.patient_id and l.caregiver_id = j.user_id)
                       or (l.patient_id = j.user_id and l.caregiver_id = j.patient_id))
                     and l.accepted_at is not null and l.revoked_at is null));
  with claimed as (
    update public.medication_notice_jobs j set attempts = attempts + 1, lease_until = now() + interval '90 seconds'
    where id in (select id from public.medication_notice_jobs where sent_at is null and attempts < 5
                   and (lease_until is null or lease_until < now()) order by created_at for update skip locked limit 40)
    returning j.*
  )
  select coalesce(jsonb_agg(to_jsonb(c) || jsonb_build_object(
      'tokens', coalesce((select jsonb_agg(dv.token) from public.care_devices dv where dv.user_id = c.user_id and dv.enabled), '[]'),
      'otherName', (select case when l.patient_id = c.patient_id and l.caregiver_id = c.user_id then l.patient_name else l.caregiver_name end
                    from public.care_links l
                    where ((l.patient_id = c.patient_id and l.caregiver_id = c.user_id) or (l.patient_id = c.user_id and l.caregiver_id = c.patient_id))
                      and l.revoked_at is null order by l.accepted_at desc limit 1),
      'scheduledTime', to_char(c.scheduled_time, 'HH24:MI'))), '[]'::jsonb)
  into result from claimed c;
  return result;
end;
$$;
revoke all on function public.medication_notice_claim_jobs() from public, anon, authenticated;
grant execute on function public.medication_notice_claim_jobs() to service_role;
revoke all on function mediclaro_private.medication_notice_recipients(uuid, uuid),
  mediclaro_private.medication_notice_on_dose(), mediclaro_private.medication_notice_on_treatment() from public, anon, authenticated;

drop trigger if exists medication_notice_wake on public.medication_notice_jobs;
create trigger medication_notice_wake after insert on public.medication_notice_jobs
  for each statement execute function public.care_wake_dispatch();

-- Retención: los avisos ya enviados se borran a los 30 días.
do $$ begin
  if exists (select 1 from cron.job where jobname = 'mediclaro-medication-notice-cleanup') then
    perform cron.unschedule('mediclaro-medication-notice-cleanup');
  end if;
end $$;
select cron.schedule('mediclaro-medication-notice-cleanup', '37 3 * * *',
  $cron$ delete from public.medication_notice_jobs where created_at < now() - interval '30 days' $cron$);
