-- ─────────────────────────────────────────────────────────────────────────────────────────────────────────
-- MediClaro · «Mis pastillas»: pautas, horarios, tomas, correcciones, avisos y permisos del cuidador (09/10/2026).
-- LA APLICA EL PROPIETARIO:  npx supabase db push   (antes de desplegar `chat` y `caregiver-dispatch`).
--
-- Aditiva e idempotente: no borra ni cambia tablas, funciones ni políticas existentes.
--
--  · medication_treatments        Tratamiento + pauta confirmada (dosis, frecuencia, inicio/fin, instrucciones).
--  · medication_schedule_times    Horas programadas (reloj local de la persona) de cada tratamiento.
--  · medication_dose_events       Tomas confirmadas / omitidas / adicionales. NUNCA se borran ni se editan: una
--                                 corrección las marca 'voided' y deja constancia en medication_dose_corrections.
--  · medication_dose_corrections  Trazabilidad de cada corrección (quién, cuándo, por qué y el registro anterior).
--  · medication_reminder_events   Estado de los avisos: entregado, abierto, aplazado, «todavía no».
--                                 Un aviso entregado o abierto NO es una toma: solo cuenta la confirmación.
--  · medication_reminder_settings Ajustes de los avisos (se sincronizan entre teléfonos).
--  · medication_care_permissions  Qué puede hacer cada cuidador/a vinculado: ver, confirmar en nombre del paciente,
--                                 recibir avisos de tomas sin confirmar. Por defecto, NADA (lo activa el paciente).
--  · medication_alert_jobs        Cola de avisos push al cuidador (solo el servidor).
--
-- Seguridad: RLS en todas las tablas; la app solo puede LEER (lo suyo o lo que el paciente le permite ver) y todas
-- las escrituras pasan por funciones que comprueban quién es, sus permisos y Premium. Identificadores creados en el
-- teléfono + operaciones idempotentes → reintentar sin conexión nunca duplica. Horas en UTC (timestamptz) y la zona
-- IANA de la persona para calcular «hoy» y los cambios de hora.
-- ─────────────────────────────────────────────────────────────────────────────────────────────────────────

create schema if not exists mediclaro_private;

-- ─── Tablas ──────────────────────────────────────────────────────────────────────────────────────────────

create table if not exists public.medication_treatments (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  medicine_id text check (medicine_id is null or medicine_id ~ '^[0-9A-Za-z-]{1,20}$'),
  name text not null check (length(btrim(name)) between 1 and 120),
  strength text check (strength is null or length(strength) <= 60),
  dose_amount numeric(6,2) not null check (dose_amount > 0 and dose_amount <= 100),
  dose_unit text not null check (dose_unit in ('comprimido','capsula','sobre','ml','gotas','inhalacion','parche','unidad','aplicacion','ampolla','cucharada')),
  frequency text not null check (frequency in ('daily','weekly','interval')),
  days_of_week smallint[] check (days_of_week is null or (cardinality(days_of_week) between 1 and 7 and days_of_week <@ array[1,2,3,4,5,6,7]::smallint[])),
  interval_days smallint check (interval_days is null or interval_days between 1 and 90),
  start_date date not null,
  end_date date,
  instructions text check (instructions is null or length(instructions) <= 300),
  notes text check (notes is null or length(notes) <= 500),
  reminders_enabled boolean not null default true,
  active boolean not null default true,
  prescription_confirmed boolean not null check (prescription_confirmed),
  prescription_confirmed_by uuid references auth.users(id) on delete set null,
  prescription_confirmed_at timestamptz not null default now(),
  source text not null default 'manual' check (source in ('manual','photo','saved')),
  timezone text not null default 'Europe/Madrid' check (length(timezone) between 1 and 64),
  version integer not null default 1,
  last_mutation_id uuid,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  check (end_date is null or end_date >= start_date),
  check (frequency <> 'weekly' or days_of_week is not null),
  check (frequency <> 'interval' or interval_days is not null)
);
create index if not exists medication_treatments_user_idx on public.medication_treatments (user_id) where archived_at is null;

create table if not exists public.medication_schedule_times (
  treatment_id uuid not null references public.medication_treatments(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  local_time time not null,
  primary key (treatment_id, local_time)
);
create index if not exists medication_schedule_times_user_idx on public.medication_schedule_times (user_id);

create table if not exists public.medication_dose_events (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  treatment_id uuid not null references public.medication_treatments(id) on delete cascade,
  occurrence_date date,
  scheduled_time time,
  scheduled_at timestamptz,
  kind text not null check (kind in ('taken','skipped','extra')),
  status text not null default 'active' check (status in ('active','voided')),
  taken_at timestamptz,
  client_recorded_at timestamptz not null,
  recorded_at timestamptz not null default now(),
  recorded_by uuid references auth.users(id) on delete set null,
  recorded_by_role text not null check (recorded_by_role in ('patient','caregiver')),
  recorded_by_name text check (recorded_by_name is null or length(recorded_by_name) <= 80),
  dose_amount numeric(6,2) not null,
  dose_unit text not null,
  medicine_name text not null check (length(medicine_name) <= 200),
  possible_duplicate boolean not null default false,
  corrects_event_id uuid references public.medication_dose_events(id) on delete set null,
  voided_at timestamptz,
  void_reason text check (void_reason is null or length(void_reason) <= 300),
  note text check (note is null or length(note) <= 300),
  source text not null default 'app' check (source in ('reminder','app','caregiver','late','assistant')),
  timezone text check (timezone is null or length(timezone) <= 64),
  check ((occurrence_date is null) = (scheduled_time is null)),
  check (kind = 'skipped' or taken_at is not null),
  check (kind <> 'skipped' or occurrence_date is not null)
);
-- Una sola resolución activa (tomada u omitida) por toma programada; las demás tomas reales son «adicionales».
create unique index if not exists medication_dose_one_resolution
  on public.medication_dose_events (treatment_id, occurrence_date, scheduled_time)
  where status = 'active' and kind in ('taken','skipped');
create index if not exists medication_dose_events_user_day_idx on public.medication_dose_events (user_id, occurrence_date);
create index if not exists medication_dose_events_user_recorded_idx on public.medication_dose_events (user_id, client_recorded_at desc);

create table if not exists public.medication_dose_corrections (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  event_id uuid not null references public.medication_dose_events(id) on delete cascade,
  replacement_event_id uuid references public.medication_dose_events(id) on delete set null,
  action text not null check (action in ('void','change_time')),
  reason text not null check (length(btrim(reason)) between 3 and 300),
  previous jsonb not null,
  corrected_by uuid references auth.users(id) on delete set null,
  corrected_by_role text not null check (corrected_by_role in ('patient','caregiver')),
  created_at timestamptz not null default now()
);
create index if not exists medication_dose_corrections_user_idx on public.medication_dose_corrections (user_id, created_at desc);

create table if not exists public.medication_reminder_events (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  treatment_id uuid not null references public.medication_treatments(id) on delete cascade,
  occurrence_date date not null,
  scheduled_time time not null,
  state text not null check (state in ('delivered','opened','snoozed','not_yet')),
  at timestamptz not null,
  created_at timestamptz not null default now()
);
create index if not exists medication_reminder_events_user_idx on public.medication_reminder_events (user_id, occurrence_date);

create table if not exists public.medication_reminder_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  enabled boolean not null default true,
  repeat_after_minutes smallint not null default 30 check (repeat_after_minutes in (0,10,15,20,30,45,60)),
  snooze_minutes smallint not null default 10 check (snooze_minutes in (5,10,15,30,60)),
  sound boolean not null default true,
  read_aloud boolean not null default true,
  show_medicine_name boolean not null default false,
  updated_at timestamptz not null default now()
);

create table if not exists public.medication_care_permissions (
  link_id uuid primary key references public.care_links(id) on delete cascade,
  patient_id uuid not null references auth.users(id) on delete cascade,
  caregiver_id uuid not null references auth.users(id) on delete cascade,
  can_view boolean not null default false,
  can_confirm boolean not null default false,
  missed_dose_alerts boolean not null default false,
  alert_after_minutes smallint not null default 60 check (alert_after_minutes in (30,60,90,120,180)),
  updated_at timestamptz not null default now(),
  check (not can_confirm or can_view),
  check (not missed_dose_alerts or can_view)
);
create index if not exists medication_care_permissions_caregiver_idx on public.medication_care_permissions (caregiver_id);

create table if not exists public.medication_alert_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  patient_id uuid not null references auth.users(id) on delete cascade,
  treatment_id uuid not null references public.medication_treatments(id) on delete cascade,
  occurrence_date date not null,
  scheduled_time time not null,
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  attempts integer not null default 0,
  lease_until timestamptz,
  provider_state text not null default 'pending',
  ticket_ids jsonb,
  unique (user_id, treatment_id, occurrence_date, scheduled_time)
);
create index if not exists medication_alert_jobs_pending on public.medication_alert_jobs (created_at) where sent_at is null;

-- ─── Permisos: la app solo lee; escribir, únicamente con las funciones de abajo ──────────────────────────

alter table public.medication_treatments enable row level security;
alter table public.medication_schedule_times enable row level security;
alter table public.medication_dose_events enable row level security;
alter table public.medication_dose_corrections enable row level security;
alter table public.medication_reminder_events enable row level security;
alter table public.medication_reminder_settings enable row level security;
alter table public.medication_care_permissions enable row level security;
alter table public.medication_alert_jobs enable row level security;

revoke all on public.medication_treatments, public.medication_schedule_times, public.medication_dose_events,
  public.medication_dose_corrections, public.medication_reminder_events, public.medication_reminder_settings,
  public.medication_care_permissions, public.medication_alert_jobs from public, anon, authenticated;
grant select on public.medication_treatments, public.medication_schedule_times, public.medication_dose_events,
  public.medication_dose_corrections, public.medication_reminder_events, public.medication_reminder_settings,
  public.medication_care_permissions to authenticated;
grant all on public.medication_treatments, public.medication_schedule_times, public.medication_dose_events,
  public.medication_dose_corrections, public.medication_reminder_events, public.medication_reminder_settings,
  public.medication_care_permissions, public.medication_alert_jobs to service_role;

-- ¿Puede la persona conectada ver la medicación de este paciente? (ella misma, o un cuidador/a vinculado y aceptado
-- al que el paciente ha dado permiso de ver). Solo responde sobre la propia persona conectada.
create or replace function public.medication_viewer_can_see(p_patient uuid) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select auth.uid() is not null and (
    p_patient = auth.uid()
    or exists (
      select 1 from public.medication_care_permissions m
      join public.care_links l on l.id = m.link_id
      where m.patient_id = p_patient and m.caregiver_id = auth.uid() and m.can_view
        and l.caregiver_id = auth.uid() and l.accepted_at is not null and l.revoked_at is null
    )
  );
$$;
revoke all on function public.medication_viewer_can_see(uuid) from public, anon;
grant execute on function public.medication_viewer_can_see(uuid) to authenticated, service_role;

drop policy if exists medication_treatments_read on public.medication_treatments;
create policy medication_treatments_read on public.medication_treatments for select to authenticated
  using (public.medication_viewer_can_see(user_id));
drop policy if exists medication_schedule_times_read on public.medication_schedule_times;
create policy medication_schedule_times_read on public.medication_schedule_times for select to authenticated
  using (public.medication_viewer_can_see(user_id));
drop policy if exists medication_dose_events_read on public.medication_dose_events;
create policy medication_dose_events_read on public.medication_dose_events for select to authenticated
  using (public.medication_viewer_can_see(user_id));
drop policy if exists medication_dose_corrections_read on public.medication_dose_corrections;
create policy medication_dose_corrections_read on public.medication_dose_corrections for select to authenticated
  using (public.medication_viewer_can_see(user_id));
-- Los detalles de los avisos y los ajustes son solo de la propia persona (minimización).
drop policy if exists medication_reminder_events_read on public.medication_reminder_events;
create policy medication_reminder_events_read on public.medication_reminder_events for select to authenticated
  using (user_id = auth.uid());
drop policy if exists medication_reminder_settings_read on public.medication_reminder_settings;
create policy medication_reminder_settings_read on public.medication_reminder_settings for select to authenticated
  using (user_id = auth.uid());
drop policy if exists medication_care_permissions_read on public.medication_care_permissions;
create policy medication_care_permissions_read on public.medication_care_permissions for select to authenticated
  using (patient_id = auth.uid() or caregiver_id = auth.uid());
-- medication_alert_jobs: sin políticas (solo el servidor).

-- ─── Ayudas internas ─────────────────────────────────────────────────────────────────────────────────────

create or replace function mediclaro_private.medication_treatment_json(t public.medication_treatments) returns jsonb
language sql stable security definer set search_path = public, pg_temp as $$
  select jsonb_build_object(
    'id', t.id, 'medicineId', t.medicine_id, 'name', t.name, 'strength', t.strength,
    'doseAmount', t.dose_amount::float8, 'doseUnit', t.dose_unit, 'frequency', t.frequency,
    'daysOfWeek', to_jsonb(t.days_of_week), 'intervalDays', t.interval_days,
    'times', coalesce((select jsonb_agg(to_char(s.local_time, 'HH24:MI') order by s.local_time)
                       from public.medication_schedule_times s where s.treatment_id = t.id), '[]'::jsonb),
    'startDate', t.start_date, 'endDate', t.end_date, 'instructions', t.instructions, 'notes', t.notes,
    'remindersEnabled', t.reminders_enabled, 'active', t.active and t.archived_at is null,
    'prescriptionConfirmed', t.prescription_confirmed, 'version', t.version, 'timezone', t.timezone,
    'source', t.source, 'updatedAt', t.updated_at, 'archivedAt', t.archived_at
  );
$$;

create or replace function mediclaro_private.medication_event_json(e public.medication_dose_events) returns jsonb
language sql stable as $$
  select jsonb_build_object(
    'id', e.id, 'treatmentId', e.treatment_id, 'occurrenceDate', e.occurrence_date,
    'scheduledTime', to_char(e.scheduled_time, 'HH24:MI'), 'kind', e.kind, 'status', e.status,
    'takenAt', e.taken_at, 'clientRecordedAt', e.client_recorded_at, 'recordedAt', e.recorded_at,
    'recordedByRole', e.recorded_by_role, 'recordedByName', e.recorded_by_name,
    'doseAmount', e.dose_amount::float8, 'doseUnit', e.dose_unit, 'medicineName', e.medicine_name,
    'possibleDuplicate', e.possible_duplicate, 'correctsEventId', e.corrects_event_id,
    'voidReason', e.void_reason, 'voidedAt', e.voided_at, 'note', e.note, 'source', e.source
  );
$$;

create or replace function mediclaro_private.medication_require_premium(p_user uuid) returns void
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare prof public.profiles;
begin
  select * into prof from public.profiles where id = p_user;
  if prof.id is null or not coalesce(public.is_premium(prof), false) then raise exception 'PREMIUM_REQUIRED'; end if;
end;
$$;

-- Rol de quien actúa sobre la medicación de un paciente: 'patient', 'caregiver' (con permiso de confirmar) o null.
create or replace function mediclaro_private.medication_actor(p_patient uuid, p_actor uuid, p_need_confirm boolean)
returns table(role text, display_name text)
language sql stable security definer set search_path = public, pg_temp as $$
  select 'patient'::text, null::text where p_patient = p_actor
  union all
  select 'caregiver'::text, l.caregiver_name
  from public.medication_care_permissions m
  join public.care_links l on l.id = m.link_id
  where p_patient <> p_actor and m.patient_id = p_patient and m.caregiver_id = p_actor
    and l.caregiver_id = p_actor and l.accepted_at is not null and l.revoked_at is null
    and m.can_view and (not p_need_confirm or m.can_confirm)
  limit 1;
$$;

create or replace function mediclaro_private.medication_scheduled_on(t public.medication_treatments, d date) returns boolean
language sql immutable as $$
  select t.active and t.archived_at is null and d >= t.start_date and (t.end_date is null or d <= t.end_date) and (
    t.frequency = 'daily'
    or (t.frequency = 'weekly' and extract(isodow from d)::smallint = any(t.days_of_week))
    or (t.frequency = 'interval' and (d - t.start_date) % greatest(t.interval_days, 1) = 0)
  );
$$;

-- ─── Guardar un tratamiento con su pauta (solo el propio paciente) ───────────────────────────────────────

create or replace function public.medication_save_treatment(p jsonb) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  u uuid := auth.uid();
  tid uuid; mutation uuid; expected integer; current_row public.medication_treatments; saved public.medication_treatments;
  times_in text[]; t_text text; freq text; days smallint[]; every smallint; tz text; archived boolean;
begin
  if u is null then raise exception 'AUTH_REQUIRED'; end if;
  if not public.hit_rate_limit(u, 'medication-save', 60) then raise exception 'RATE_LIMIT'; end if;
  perform mediclaro_private.medication_require_premium(u);
  tid := (p->>'id')::uuid;
  mutation := nullif(p->>'mutationId', '')::uuid;
  expected := nullif(p->>'expectedVersion', '')::integer;
  if tid is null or mutation is null then raise exception 'INVALID_INPUT'; end if;

  select * into current_row from public.medication_treatments where id = tid for update;
  if current_row.id is not null then
    if current_row.user_id <> u then raise exception 'NOT_ALLOWED'; end if;
    -- Reintento de un guardado que ya se aplicó (se perdió la respuesta): idempotente.
    if current_row.last_mutation_id = mutation then
      return jsonb_build_object('treatment', mediclaro_private.medication_treatment_json(current_row), 'replayed', true);
    end if;
    -- Otro teléfono lo cambió antes: no se pisa. Gana el servidor y la app lo explica.
    if expected is not null and expected <> current_row.version then
      return jsonb_build_object('conflict', true, 'treatment', mediclaro_private.medication_treatment_json(current_row));
    end if;
  end if;

  archived := coalesce((p->>'archived')::boolean, false);
  freq := coalesce(p->>'frequency', 'daily');
  if freq not in ('daily', 'weekly', 'interval') then raise exception 'INVALID_FREQUENCY'; end if;
  if freq = 'weekly' then
    select array_agg(distinct (x)::smallint order by (x)::smallint) into days
    from jsonb_array_elements_text(coalesce(p->'daysOfWeek', '[]'::jsonb)) as x;
    if days is null or cardinality(days) = 0 then raise exception 'INVALID_DAYS'; end if;
  end if;
  if freq = 'interval' then every := (p->>'intervalDays')::smallint; end if;
  select array_agg(distinct x order by x) into times_in from jsonb_array_elements_text(coalesce(p->'times', '[]'::jsonb)) as x;
  if times_in is null or cardinality(times_in) not between 1 and 8 then raise exception 'INVALID_TIMES'; end if;
  foreach t_text in array times_in loop
    if t_text !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' then raise exception 'INVALID_TIMES'; end if;
  end loop;
  tz := coalesce(nullif(p->>'timezone', ''), 'Europe/Madrid');
  if not exists (select 1 from pg_timezone_names where name = tz) then raise exception 'INVALID_TIMEZONE'; end if;
  if coalesce((p->>'prescriptionConfirmed')::boolean, false) is not true then raise exception 'PRESCRIPTION_NOT_CONFIRMED'; end if;

  insert into public.medication_treatments as m (
    id, user_id, medicine_id, name, strength, dose_amount, dose_unit, frequency, days_of_week, interval_days,
    start_date, end_date, instructions, notes, reminders_enabled, active, prescription_confirmed,
    prescription_confirmed_by, prescription_confirmed_at, source, timezone, version, last_mutation_id, created_by,
    archived_at
  ) values (
    tid, u, nullif(p->>'medicineId', ''), btrim(p->>'name'), nullif(btrim(coalesce(p->>'strength', '')), ''),
    (p->>'doseAmount')::numeric, p->>'doseUnit', freq, days, every,
    (p->>'startDate')::date, nullif(p->>'endDate', '')::date, nullif(btrim(coalesce(p->>'instructions', '')), ''),
    nullif(btrim(coalesce(p->>'notes', '')), ''), coalesce((p->>'remindersEnabled')::boolean, true), not archived, true,
    u, now(), coalesce(nullif(p->>'source', ''), 'manual'), tz, 1, mutation, u,
    case when archived then now() end
  )
  on conflict (id) do update set
    medicine_id = excluded.medicine_id, name = excluded.name, strength = excluded.strength,
    dose_amount = excluded.dose_amount, dose_unit = excluded.dose_unit, frequency = excluded.frequency,
    days_of_week = excluded.days_of_week, interval_days = excluded.interval_days, start_date = excluded.start_date,
    end_date = excluded.end_date, instructions = excluded.instructions, notes = excluded.notes,
    reminders_enabled = excluded.reminders_enabled, active = excluded.active,
    prescription_confirmed_by = excluded.prescription_confirmed_by, prescription_confirmed_at = excluded.prescription_confirmed_at,
    timezone = excluded.timezone, version = m.version + 1, last_mutation_id = excluded.last_mutation_id,
    updated_at = now(), archived_at = case when excluded.archived_at is not null then coalesce(m.archived_at, now()) end
  where m.user_id = excluded.user_id
  returning * into saved;
  if saved.id is null then raise exception 'NOT_ALLOWED'; end if;

  delete from public.medication_schedule_times where treatment_id = tid;
  insert into public.medication_schedule_times (treatment_id, user_id, local_time)
  select tid, u, x::time from unnest(times_in) as x;

  return jsonb_build_object('treatment', mediclaro_private.medication_treatment_json(saved));
end;
$$;

-- ─── Registrar una toma (paciente o cuidador/a con permiso de confirmar) ─────────────────────────────────

create or replace function public.medication_record_dose(p jsonb) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  u uuid := auth.uid();
  eid uuid := (p->>'id')::uuid;
  t public.medication_treatments; existing public.medication_dose_events; resolved public.medication_dose_events;
  saved public.medication_dose_events; actor record; kind_in text := p->>'kind'; kind_out text;
  occ_date date := nullif(p->>'occurrenceDate', '')::date; occ_time time := nullif(p->>'scheduledTime', '')::time;
  taken timestamptz := nullif(p->>'takenAt', '')::timestamptz;
  client_at timestamptz := coalesce(nullif(p->>'clientRecordedAt', '')::timestamptz, now());
  duplicate boolean := false; auto_correction uuid;
begin
  if u is null then raise exception 'AUTH_REQUIRED'; end if;
  if eid is null then raise exception 'INVALID_INPUT'; end if;
  if not public.hit_rate_limit(u, 'medication-dose', 120) then raise exception 'RATE_LIMIT'; end if;

  -- Reintento de un envío que ya llegó: devuelve el mismo registro (idempotente).
  select * into existing from public.medication_dose_events where id = eid;
  if existing.id is not null then
    if not public.medication_viewer_can_see(existing.user_id) then raise exception 'NOT_ALLOWED'; end if;
    return jsonb_build_object('event', mediclaro_private.medication_event_json(existing), 'replayed', true);
  end if;

  select * into t from public.medication_treatments where id = (p->>'treatmentId')::uuid;
  if t.id is null then raise exception 'NOT_FOUND'; end if;
  select * into actor from mediclaro_private.medication_actor(t.user_id, u, true);
  if actor.role is null then raise exception 'NOT_ALLOWED'; end if;
  perform mediclaro_private.medication_require_premium(t.user_id);

  if kind_in not in ('taken', 'skipped', 'extra') then raise exception 'INVALID_KIND'; end if;
  if (occ_date is null) <> (occ_time is null) then raise exception 'INVALID_OCCURRENCE'; end if;
  if kind_in = 'skipped' and occ_date is null then raise exception 'INVALID_OCCURRENCE'; end if;
  if kind_in <> 'skipped' then
    if taken is null then raise exception 'TAKEN_AT_REQUIRED'; end if;
    -- Ni en el futuro ni de hace más de 7 días (las tomas a posteriori se registran con su hora real).
    if taken > now() + interval '10 minutes' or taken < now() - interval '7 days' then raise exception 'INVALID_TAKEN_AT'; end if;
  end if;
  if occ_date is not null and (occ_date < current_date - 8 or occ_date > current_date + 2) then raise exception 'INVALID_OCCURRENCE'; end if;

  kind_out := kind_in;
  if occ_date is not null then
    -- Bloquea esa toma mientras se decide (dos teléfonos a la vez).
    perform pg_advisory_xact_lock(hashtext(t.id::text || occ_date::text || occ_time::text));
    select * into resolved from public.medication_dose_events
      where treatment_id = t.id and occurrence_date = occ_date and scheduled_time = occ_time
        and status = 'active' and kind in ('taken', 'skipped')
      order by client_recorded_at limit 1;
    if resolved.id is not null then
      if kind_in = 'skipped' then
        if resolved.kind = 'skipped' then
          return jsonb_build_object('event', mediclaro_private.medication_event_json(resolved), 'replayed', true);
        end if;
        raise exception 'ALREADY_TAKEN';
      elsif resolved.kind = 'taken' then
        -- Ya figura confirmada: NO se rechaza (una toma adicional real importa), se guarda como posible incidencia.
        kind_out := 'extra';
        duplicate := true;
      else
        -- Estaba marcada como «no tomada» y ahora se confirma tomada: se corrige con trazabilidad.
        auto_correction := gen_random_uuid();
        update public.medication_dose_events set status = 'voided', voided_at = now(),
          void_reason = 'Se confirmó la toma después de marcarla como no tomada'
          where id = resolved.id;
        insert into public.medication_dose_corrections (id, user_id, event_id, replacement_event_id, action, reason, previous, corrected_by, corrected_by_role)
          values (auto_correction, t.user_id, resolved.id, null, 'void', 'Se confirmó la toma después de marcarla como no tomada',
                  mediclaro_private.medication_event_json(resolved), u, actor.role);
      end if;
    end if;
  end if;
  if kind_out = 'extra' then duplicate := true; end if;

  insert into public.medication_dose_events (
    id, user_id, treatment_id, occurrence_date, scheduled_time, scheduled_at, kind, status, taken_at, client_recorded_at,
    recorded_by, recorded_by_role, recorded_by_name, dose_amount, dose_unit, medicine_name, possible_duplicate, note,
    source, timezone
  ) values (
    eid, t.user_id, t.id, occ_date, occ_time,
    case when occ_date is not null then (occ_date + occ_time) at time zone t.timezone end,
    kind_out, 'active', case when kind_out <> 'skipped' then taken end, client_at, u, actor.role, actor.display_name,
    coalesce(nullif(p->>'doseAmount', '')::numeric, t.dose_amount), coalesce(nullif(p->>'doseUnit', ''), t.dose_unit),
    left(btrim(t.name || coalesce(' ' || t.strength, '')), 200), duplicate, nullif(left(btrim(coalesce(p->>'note', '')), 300), ''),
    case when actor.role = 'caregiver' then 'caregiver' else coalesce(nullif(p->>'source', ''), 'app') end,
    nullif(left(coalesce(p->>'timezone', ''), 64), '')
  ) returning * into saved;

  if auto_correction is not null then
    update public.medication_dose_corrections set replacement_event_id = saved.id where id = auto_correction;
  end if;
  return jsonb_build_object(
    'event', mediclaro_private.medication_event_json(saved),
    'possibleDuplicate', duplicate,
    'existing', case when duplicate and resolved.id is not null then mediclaro_private.medication_event_json(resolved) end
  );
end;
$$;

-- ─── Corregir una toma (nunca se borra: se anula con motivo y, si hace falta, se registra la buena) ───────

create or replace function public.medication_correct_dose(p jsonb) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  u uuid := auth.uid(); cid uuid := (p->>'id')::uuid; action_in text := p->>'action';
  reason_in text := btrim(coalesce(p->>'reason', '')); e public.medication_dose_events; replacement public.medication_dose_events;
  done public.medication_dose_corrections; actor record; new_taken timestamptz := nullif(p->>'newTakenAt', '')::timestamptz;
begin
  if u is null then raise exception 'AUTH_REQUIRED'; end if;
  if cid is null then raise exception 'INVALID_INPUT'; end if;
  select * into done from public.medication_dose_corrections where id = cid;
  if done.id is not null then
    if not public.medication_viewer_can_see(done.user_id) then raise exception 'NOT_ALLOWED'; end if;
    return jsonb_build_object('correctionId', done.id, 'replayed', true);
  end if;
  if action_in not in ('void', 'change_time') then raise exception 'INVALID_ACTION'; end if;
  if length(reason_in) not between 3 and 300 then raise exception 'REASON_REQUIRED'; end if;

  select * into e from public.medication_dose_events where id = (p->>'eventId')::uuid for update;
  if e.id is null then raise exception 'NOT_FOUND'; end if;
  select * into actor from mediclaro_private.medication_actor(e.user_id, u, true);
  if actor.role is null then raise exception 'NOT_ALLOWED'; end if;
  -- El cuidador/a solo corrige lo que registró él/ella.
  if actor.role = 'caregiver' and e.recorded_by is distinct from u then raise exception 'NOT_ALLOWED'; end if;
  if e.status <> 'active' then raise exception 'ALREADY_CORRECTED'; end if;

  update public.medication_dose_events set status = 'voided', voided_at = now(), void_reason = reason_in where id = e.id;

  if action_in = 'change_time' then
    if e.kind = 'skipped' or new_taken is null then raise exception 'INVALID_TAKEN_AT'; end if;
    if new_taken > now() + interval '10 minutes' or new_taken < now() - interval '8 days' then raise exception 'INVALID_TAKEN_AT'; end if;
    insert into public.medication_dose_events (
      id, user_id, treatment_id, occurrence_date, scheduled_time, scheduled_at, kind, status, taken_at, client_recorded_at,
      recorded_by, recorded_by_role, recorded_by_name, dose_amount, dose_unit, medicine_name, possible_duplicate, note,
      source, timezone, corrects_event_id
    ) values (
      coalesce(nullif(p->>'replacementId', '')::uuid, gen_random_uuid()), e.user_id, e.treatment_id, e.occurrence_date,
      e.scheduled_time, e.scheduled_at, e.kind, 'active', new_taken, now(), u, actor.role, actor.display_name,
      e.dose_amount, e.dose_unit, e.medicine_name, e.possible_duplicate, e.note, 'late', e.timezone, e.id
    ) returning * into replacement;
  end if;

  insert into public.medication_dose_corrections (id, user_id, event_id, replacement_event_id, action, reason, previous, corrected_by, corrected_by_role)
  values (cid, e.user_id, e.id, replacement.id, action_in, reason_in, mediclaro_private.medication_event_json(e), u, actor.role);

  return jsonb_build_object(
    'correctionId', cid,
    'voided', mediclaro_private.medication_event_json((select x from public.medication_dose_events x where x.id = e.id)),
    'replacement', case when replacement.id is not null then mediclaro_private.medication_event_json(replacement) end
  );
end;
$$;

-- ─── Estado de los avisos (entregado / abierto / aplazado / «todavía no»): nunca equivale a una toma ─────

create or replace function public.medication_log_reminders(p jsonb) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare u uuid := auth.uid(); n integer;
begin
  if u is null then raise exception 'AUTH_REQUIRED'; end if;
  if jsonb_typeof(p) <> 'array' or jsonb_array_length(p) > 50 then raise exception 'INVALID_INPUT'; end if;
  if not public.hit_rate_limit(u, 'medication-reminders', 60) then raise exception 'RATE_LIMIT'; end if;
  insert into public.medication_reminder_events (id, user_id, treatment_id, occurrence_date, scheduled_time, state, at)
  select (x->>'id')::uuid, u, (x->>'treatmentId')::uuid, (x->>'occurrenceDate')::date, (x->>'scheduledTime')::time,
         x->>'state', least(coalesce(nullif(x->>'at', '')::timestamptz, now()), now() + interval '5 minutes')
  from jsonb_array_elements(p) as x
  where exists (select 1 from public.medication_treatments t where t.id = (x->>'treatmentId')::uuid and t.user_id = u)
  on conflict (id) do nothing;
  get diagnostics n = row_count;
  return jsonb_build_object('saved', n);
end;
$$;

create or replace function public.medication_save_settings(p jsonb) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare u uuid := auth.uid(); s public.medication_reminder_settings;
begin
  if u is null then raise exception 'AUTH_REQUIRED'; end if;
  insert into public.medication_reminder_settings as r (user_id, enabled, repeat_after_minutes, snooze_minutes, sound, read_aloud, show_medicine_name, updated_at)
  values (u, coalesce((p->>'enabled')::boolean, true), coalesce((p->>'repeatAfterMinutes')::smallint, 30),
          coalesce((p->>'snoozeMinutes')::smallint, 10), coalesce((p->>'sound')::boolean, true),
          coalesce((p->>'readAloud')::boolean, true), coalesce((p->>'showMedicineName')::boolean, false), now())
  on conflict (user_id) do update set enabled = excluded.enabled, repeat_after_minutes = excluded.repeat_after_minutes,
    snooze_minutes = excluded.snooze_minutes, sound = excluded.sound, read_aloud = excluded.read_aloud,
    show_medicine_name = excluded.show_medicine_name, updated_at = now()
  returning * into s;
  return to_jsonb(s) - 'user_id';
end;
$$;

-- ─── Permisos del cuidador/a (los decide SOLO el paciente) ───────────────────────────────────────────────

create or replace function public.medication_set_care_permissions(p_link uuid, p jsonb) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare u uuid := auth.uid(); l public.care_links; view_ok boolean; confirm_ok boolean; alerts_ok boolean; after_min smallint;
begin
  if u is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into l from public.care_links where id = p_link;
  if l.id is null or l.patient_id <> u then raise exception 'NOT_ALLOWED'; end if;
  if l.caregiver_id is null or l.accepted_at is null or l.revoked_at is not null then raise exception 'LINK_NOT_ACTIVE'; end if;
  view_ok := coalesce((p->>'canView')::boolean, false);
  confirm_ok := view_ok and coalesce((p->>'canConfirm')::boolean, false);
  alerts_ok := view_ok and coalesce((p->>'missedDoseAlerts')::boolean, false);
  after_min := coalesce((p->>'alertAfterMinutes')::smallint, 60);
  insert into public.medication_care_permissions as m (link_id, patient_id, caregiver_id, can_view, can_confirm, missed_dose_alerts, alert_after_minutes, updated_at)
  values (l.id, l.patient_id, l.caregiver_id, view_ok, confirm_ok, alerts_ok, after_min, now())
  on conflict (link_id) do update set can_view = excluded.can_view, can_confirm = excluded.can_confirm,
    missed_dose_alerts = excluded.missed_dose_alerts, alert_after_minutes = excluded.alert_after_minutes, updated_at = now();
  return jsonb_build_object('linkId', l.id, 'canView', view_ok, 'canConfirm', confirm_ok, 'missedDoseAlerts', alerts_ok, 'alertAfterMinutes', after_min);
end;
$$;

-- ─── Leer la pauta y el historial (propio o, con permiso, del familiar) ──────────────────────────────────

create or replace function public.medication_get_plan(p_patient uuid default null, p_from date default null, p_to date default null) returns jsonb
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare
  u uuid := auth.uid(); target uuid := coalesce(p_patient, auth.uid());
  d_from date := coalesce(p_from, current_date - 35); d_to date := coalesce(p_to, current_date + 2); access text; perms jsonb;
begin
  if u is null then raise exception 'AUTH_REQUIRED'; end if;
  if not public.medication_viewer_can_see(target) then raise exception 'NOT_ALLOWED'; end if;
  if d_to < d_from or d_to - d_from > 400 then raise exception 'INVALID_RANGE'; end if;
  if target = u then
    access := 'owner';
    perms := coalesce((select jsonb_agg(jsonb_build_object(
        'linkId', l.id, 'caregiverName', l.caregiver_name, 'canView', coalesce(m.can_view, false),
        'canConfirm', coalesce(m.can_confirm, false), 'missedDoseAlerts', coalesce(m.missed_dose_alerts, false),
        'alertAfterMinutes', coalesce(m.alert_after_minutes, 60)) order by l.accepted_at)
      from public.care_links l left join public.medication_care_permissions m on m.link_id = l.id
      where l.patient_id = u and l.caregiver_id is not null and l.accepted_at is not null and l.revoked_at is null), '[]'::jsonb);
  else
    select case when m.can_confirm then 'confirm' else 'view' end,
           jsonb_build_array(jsonb_build_object('linkId', m.link_id, 'patientName', l.patient_name, 'canView', m.can_view,
             'canConfirm', m.can_confirm, 'missedDoseAlerts', m.missed_dose_alerts, 'alertAfterMinutes', m.alert_after_minutes))
      into access, perms
      from public.medication_care_permissions m join public.care_links l on l.id = m.link_id
      where m.patient_id = target and m.caregiver_id = u and l.revoked_at is null limit 1;
  end if;
  return jsonb_build_object(
    'patientId', target,
    'access', access,
    'serverTime', now(),
    'treatments', coalesce((select jsonb_agg(mediclaro_private.medication_treatment_json(t) order by t.created_at)
                            from public.medication_treatments t where t.user_id = target
                              and (t.archived_at is null or t.archived_at > d_from::timestamptz)), '[]'::jsonb),
    'events', coalesce((select jsonb_agg(mediclaro_private.medication_event_json(e) order by e.client_recorded_at)
                        from public.medication_dose_events e where e.user_id = target
                          and coalesce(e.occurrence_date, (e.taken_at at time zone 'UTC')::date) between d_from and d_to), '[]'::jsonb),
    'corrections', coalesce((select jsonb_agg(jsonb_build_object('id', c.id, 'eventId', c.event_id, 'replacementEventId', c.replacement_event_id,
                               'action', c.action, 'reason', c.reason, 'byRole', c.corrected_by_role, 'createdAt', c.created_at) order by c.created_at)
                             from public.medication_dose_corrections c where c.user_id = target and c.created_at >= d_from::timestamptz), '[]'::jsonb),
    'reminderEvents', case when target = u then coalesce((select jsonb_agg(jsonb_build_object('id', r.id, 'treatmentId', r.treatment_id,
                               'occurrenceDate', r.occurrence_date, 'scheduledTime', to_char(r.scheduled_time, 'HH24:MI'), 'state', r.state, 'at', r.at) order by r.at)
                             from public.medication_reminder_events r where r.user_id = u and r.occurrence_date >= current_date - 7), '[]'::jsonb) else '[]'::jsonb end,
    'settings', case when target = u then (select to_jsonb(s) - 'user_id' from public.medication_reminder_settings s where s.user_id = u) end,
    'permissions', perms
  );
end;
$$;

-- ─── Derecho de supresión: borrar toda la medicación de la propia cuenta ─────────────────────────────────

create or replace function public.medication_delete_all() returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare u uuid := auth.uid(); n integer;
begin
  if u is null then raise exception 'AUTH_REQUIRED'; end if;
  delete from public.medication_treatments where user_id = u; -- en cascada: horas, tomas, correcciones, avisos y trabajos
  get diagnostics n = row_count;
  delete from public.medication_reminder_settings where user_id = u;
  delete from public.medication_care_permissions where patient_id = u;
  return jsonb_build_object('deletedTreatments', n);
end;
$$;

revoke all on function public.medication_save_treatment(jsonb), public.medication_record_dose(jsonb),
  public.medication_correct_dose(jsonb), public.medication_log_reminders(jsonb), public.medication_save_settings(jsonb),
  public.medication_set_care_permissions(uuid, jsonb), public.medication_get_plan(uuid, date, date),
  public.medication_delete_all() from public, anon;
grant execute on function public.medication_save_treatment(jsonb), public.medication_record_dose(jsonb),
  public.medication_correct_dose(jsonb), public.medication_log_reminders(jsonb), public.medication_save_settings(jsonb),
  public.medication_set_care_permissions(uuid, jsonb), public.medication_get_plan(uuid, date, date),
  public.medication_delete_all() to authenticated;
revoke all on function mediclaro_private.medication_treatment_json(public.medication_treatments),
  mediclaro_private.medication_event_json(public.medication_dose_events), mediclaro_private.medication_require_premium(uuid),
  mediclaro_private.medication_actor(uuid, uuid, boolean), mediclaro_private.medication_scheduled_on(public.medication_treatments, date)
  from public, anon, authenticated;

-- ─── Avisos al cuidador/a por tomas sin confirmar (opcionales; los activa el paciente) ───────────────────

create or replace function mediclaro_private.medication_enqueue_missed_alerts() returns integer
language plpgsql security definer set search_path = public, pg_temp as $$
declare n integer;
begin
  insert into public.medication_alert_jobs (user_id, patient_id, treatment_id, occurrence_date, scheduled_time)
  select m.caregiver_id, t.user_id, t.id, d.local_date, st.local_time
  from public.medication_care_permissions m
  join public.care_links l on l.id = m.link_id and l.caregiver_id = m.caregiver_id and l.accepted_at is not null and l.revoked_at is null
  join public.medication_treatments t on t.user_id = m.patient_id and t.reminders_enabled
  join public.medication_schedule_times st on st.treatment_id = t.id
  cross join lateral (values ((now() at time zone t.timezone)::date), ((now() at time zone t.timezone)::date - 1)) as d(local_date)
  where m.can_view and m.missed_dose_alerts
    and mediclaro_private.medication_scheduled_on(t, d.local_date)
    and ((d.local_date + st.local_time) at time zone t.timezone) + make_interval(mins => m.alert_after_minutes) <= now()
    and ((d.local_date + st.local_time) at time zone t.timezone) > now() - interval '6 hours'
    and not exists (
      select 1 from public.medication_dose_events e
      where e.treatment_id = t.id and e.occurrence_date = d.local_date and e.scheduled_time = st.local_time
        and e.status = 'active' and e.kind in ('taken', 'skipped'))
  on conflict (user_id, treatment_id, occurrence_date, scheduled_time) do nothing;
  get diagnostics n = row_count;
  return n;
end;
$$;
revoke all on function mediclaro_private.medication_enqueue_missed_alerts() from public, anon, authenticated;

-- El repartidor de avisos (función caregiver-dispatch) recoge los trabajos. Si mientras tanto se confirmó la toma o
-- el paciente retiró el permiso, el aviso se cancela.
create or replace function public.medication_claim_alert_jobs() returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare result jsonb;
begin
  update public.medication_alert_jobs j set sent_at = now(), provider_state = 'cancelled'
  where j.sent_at is null and (
    exists (select 1 from public.medication_dose_events e where e.treatment_id = j.treatment_id and e.occurrence_date = j.occurrence_date
              and e.scheduled_time = j.scheduled_time and e.status = 'active' and e.kind in ('taken', 'skipped'))
    or not exists (select 1 from public.medication_care_permissions m join public.care_links l on l.id = m.link_id
                   where m.patient_id = j.patient_id and m.caregiver_id = j.user_id and m.can_view and m.missed_dose_alerts
                     and l.accepted_at is not null and l.revoked_at is null));
  with claimed as (
    update public.medication_alert_jobs j set attempts = attempts + 1, lease_until = now() + interval '90 seconds'
    where id in (select id from public.medication_alert_jobs where sent_at is null and attempts < 5
                   and (lease_until is null or lease_until < now()) order by created_at for update skip locked limit 40)
    returning j.*
  )
  select coalesce(jsonb_agg(to_jsonb(c) || jsonb_build_object(
      'tokens', coalesce((select jsonb_agg(dv.token) from public.care_devices dv where dv.user_id = c.user_id and dv.enabled), '[]'),
      'patientName', (select l.patient_name from public.care_links l where l.patient_id = c.patient_id and l.caregiver_id = c.user_id
                        and l.revoked_at is null order by l.accepted_at desc limit 1),
      'scheduledTime', to_char(c.scheduled_time, 'HH24:MI'))), '[]'::jsonb)
  into result from claimed c;
  return result;
end;
$$;
revoke all on function public.medication_claim_alert_jobs() from public, anon, authenticated;
grant execute on function public.medication_claim_alert_jobs() to service_role;

-- Despierta al repartidor al encolar avisos (misma función segura que los avisos de emergencia).
drop trigger if exists medication_alert_wake on public.medication_alert_jobs;
create trigger medication_alert_wake after insert on public.medication_alert_jobs
  for each statement execute function public.care_wake_dispatch();

create extension if not exists pg_cron with schema pg_catalog;
do $$ begin
  if exists (select 1 from cron.job where jobname = 'mediclaro-medication-missed-doses') then
    perform cron.unschedule('mediclaro-medication-missed-doses');
  end if;
end $$;
select cron.schedule('mediclaro-medication-missed-doses', '*/10 * * * *', $cron$ select mediclaro_private.medication_enqueue_missed_alerts(); $cron$);
