-- MediClaro · «Cuando lo necesite» (11/10/2026). ADITIVA.
-- Permite una pauta sin horas ni avisos: la persona anota cada toma cuando la hace (medication_record_dose ya admite
-- tomas sin hora programada). No toca los datos existentes. Se puede aplicar dos veces sin problema.

begin;

alter table public.medication_treatments drop constraint if exists medication_treatments_frequency_check;
alter table public.medication_treatments add constraint medication_treatments_frequency_check
  check (frequency in ('daily','weekly','interval','as_needed'));

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
  if freq not in ('daily', 'weekly', 'interval', 'as_needed') then raise exception 'INVALID_FREQUENCY'; end if;
  if freq = 'weekly' then
    select array_agg(distinct (x)::smallint order by (x)::smallint) into days
    from jsonb_array_elements_text(coalesce(p->'daysOfWeek', '[]'::jsonb)) as x;
    if days is null or cardinality(days) = 0 then raise exception 'INVALID_DAYS'; end if;
  end if;
  if freq = 'interval' then every := (p->>'intervalDays')::smallint; end if;
  select array_agg(distinct x order by x) into times_in from jsonb_array_elements_text(coalesce(p->'times', '[]'::jsonb)) as x;
  -- «Cuando lo necesite»: sin horas y sin avisos. En las demás pautas hacen falta de 1 a 8 horas.
  if freq = 'as_needed' then times_in := array[]::text[]; end if;
  if freq <> 'as_needed' and (times_in is null or cardinality(times_in) not between 1 and 8) then raise exception 'INVALID_TIMES'; end if;
  foreach t_text in array coalesce(times_in, array[]::text[]) loop
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
    nullif(btrim(coalesce(p->>'notes', '')), ''), case when freq = 'as_needed' then false else coalesce((p->>'remindersEnabled')::boolean, true) end, not archived, true,
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

commit;
