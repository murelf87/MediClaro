-- Caregiver pairing v2: persistent 6-digit code for Premium patients.
-- Entering/scanning the code only creates a request. The Premium patient must approve it.
-- Caregiver remains free and does not need phone/SMS. Premium rights are never inherited.

create table if not exists public.care_pair_codes (
  patient_id uuid primary key references auth.users(id) on delete cascade,
  code char(6) not null unique check (code ~ '^[0-9]{6}$'),
  created_at timestamptz not null default now(),
  rotated_at timestamptz not null default now()
);
alter table public.care_pair_codes enable row level security;
revoke all on public.care_pair_codes from public,anon,authenticated;
grant all on public.care_pair_codes to service_role;

create table if not exists public.care_link_push_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  link_id uuid not null references public.care_links(id) on delete cascade,
  kind text not null check(kind in ('link_request','link_approved','link_rejected','link_revoked')),
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  attempts integer not null default 0,
  lease_until timestamptz,
  provider_state text not null default 'pending',
  ticket_ids jsonb
);
create index if not exists care_link_jobs_pending
  on public.care_link_push_jobs(created_at)
  where sent_at is null;
create unique index if not exists care_link_jobs_dedupe
  on public.care_link_push_jobs(user_id,link_id,kind)
  where sent_at is null;
alter table public.care_link_push_jobs enable row level security;
revoke all on public.care_link_push_jobs from public,anon,authenticated;
grant all on public.care_link_push_jobs to service_role;

create or replace function public.care_pairing_action(p_action text,p_payload jsonb default '{}') returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare
  u uuid:=auth.uid();
  p public.profiles;
  patient public.profiles;
  link public.care_links;
  code_value text;
  name_value text;
  new_code text;
  link_id uuid;
  caregiver_uid uuid;
  i integer;
begin
  if u is null then raise exception 'AUTH_REQUIRED'; end if;
  if not public.hit_rate_limit(u,'care-pair-'||p_action,case when p_action='request' then 6 else 30 end) then
    raise exception 'RATE_LIMIT';
  end if;

  if p_action='my_code' or p_action='rotate_code' then
    select * into p from public.profiles where id=u;
    if p.id is null or not public.is_premium(p) then raise exception 'PREMIUM_REQUIRED'; end if;

    if p_action='rotate_code' then
      delete from public.care_pair_codes where patient_id=u;
    end if;

    select code into code_value from public.care_pair_codes where patient_id=u;
    if code_value is null then
      for i in 1..30 loop
        new_code:=lpad(floor(random()*1000000)::int::text,6,'0');
        begin
          insert into public.care_pair_codes(patient_id,code) values(u,new_code);
          code_value:=new_code;
          exit;
        exception when unique_violation then
          -- Retry with another six-digit value.
        end;
      end loop;
    end if;
    if code_value is null then raise exception 'CODE_GENERATION_FAILED'; end if;
    return jsonb_build_object('code',code_value);
  end if;

  if p_action='request' then
    code_value:=trim(coalesce(p_payload->>'code',''));
    name_value:=trim(coalesce(p_payload->>'name',''));
    if code_value !~ '^[0-9]{6}$' then raise exception 'INVALID_CODE'; end if;
    if length(name_value) not between 1 and 80 then raise exception 'INVALID_NAME'; end if;

    select pr.* into patient
    from public.care_pair_codes pc
    join public.profiles pr on pr.id=pc.patient_id
    where pc.code=code_value and public.is_premium(pr)
    limit 1;
    if patient.id is null then raise exception 'INVALID_CODE'; end if;
    if patient.id=u then raise exception 'SELF_LINK'; end if;

    select * into link from public.care_links
    where patient_id=patient.id and caregiver_id=u and revoked_at is null
    order by created_at desc limit 1 for update;

    if link.id is null then
      insert into public.care_links(patient_id,caregiver_id,patient_name,caregiver_name,expires_at)
      values(
        patient.id,
        u,
        coalesce(nullif(trim(patient.display_name),''),'Paciente MediClaro'),
        name_value,
        now()+interval '24 hours'
      ) returning * into link;
    elsif link.accepted_at is null then
      update public.care_links
      set caregiver_name=name_value,expires_at=now()+interval '24 hours'
      where id=link.id returning * into link;
    end if;

    if link.accepted_at is null then
      insert into public.care_link_push_jobs(user_id,link_id,kind)
      values(patient.id,link.id,'link_request')
      on conflict do nothing;
    end if;

    return jsonb_build_object(
      'linkId',link.id,
      'patientName',link.patient_name,
      'status',case when link.accepted_at is null then 'pending' else 'accepted' end
    );
  end if;

  link_id:=(p_payload->>'linkId')::uuid;

  if p_action='approve' then
    select * into p from public.profiles where id=u;
    if p.id is null or not public.is_premium(p) then raise exception 'PREMIUM_REQUIRED'; end if;
    select * into link from public.care_links
      where id=link_id and patient_id=u and caregiver_id is not null
        and accepted_at is null and revoked_at is null and expires_at>now()
      for update;
    if link.id is null then raise exception 'INVALID_REQUEST'; end if;

    update public.care_links set accepted_at=now() where id=link.id returning * into link;
    insert into public.care_profiles(user_id,role) values(link.caregiver_id,'caregiver')
      on conflict(user_id) do update set role='caregiver';
    insert into public.care_link_push_jobs(user_id,link_id,kind)
      values(link.caregiver_id,link.id,'link_approved')
      on conflict do nothing;
    return jsonb_build_object('accepted',true,'caregiverName',link.caregiver_name);
  end if;

  if p_action='reject' then
    select * into link from public.care_links
      where id=link_id and patient_id=u and caregiver_id is not null
        and accepted_at is null and revoked_at is null
      for update;
    if link.id is null then raise exception 'INVALID_REQUEST'; end if;
    update public.care_links set revoked_at=now() where id=link.id;
    insert into public.care_link_push_jobs(user_id,link_id,kind)
      values(link.caregiver_id,link.id,'link_rejected')
      on conflict do nothing;
    return jsonb_build_object('rejected',true);
  end if;

  if p_action='disconnect' then
    select * into link from public.care_links
      where id=link_id and revoked_at is null and (patient_id=u or caregiver_id=u)
      for update;
    if link.id is null then raise exception 'NOT_ALLOWED'; end if;
    caregiver_uid:=link.caregiver_id;
    update public.care_links set revoked_at=now() where id=link.id;

    if caregiver_uid is not null and not exists(
      select 1 from public.care_links
      where caregiver_id=caregiver_uid and accepted_at is not null and revoked_at is null and id<>link.id
    ) then
      insert into public.care_profiles(user_id,role) values(caregiver_uid,'patient')
        on conflict(user_id) do update set role='patient';
    end if;

    insert into public.care_link_push_jobs(user_id,link_id,kind)
      select case when u=link.patient_id then link.caregiver_id else link.patient_id end,link.id,'link_revoked'
      where case when u=link.patient_id then link.caregiver_id else link.patient_id end is not null
      on conflict do nothing;
    return jsonb_build_object('disconnected',true);
  end if;

  if p_action='status' then
    select * into p from public.profiles where id=u;
    return jsonb_build_object(
      'premium',coalesce(public.is_premium(p),false),
      'code',case when p.id is not null and public.is_premium(p)
        then (select code from public.care_pair_codes where patient_id=u)
        else null end,
      'role',coalesce((select role from public.care_profiles where user_id=u),'patient')
    );
  end if;

  raise exception 'INVALID_ACTION';
end;
$$;
revoke all on function public.care_pairing_action(text,jsonb) from public,anon;
grant execute on function public.care_pairing_action(text,jsonb) to authenticated;

create or replace function public.care_claim_link_jobs() returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare result jsonb;
begin
  with claimed as (
    update public.care_link_push_jobs j
    set attempts=attempts+1,lease_until=now()+interval '90 seconds'
    where id in (
      select id from public.care_link_push_jobs
      where sent_at is null and attempts<5 and (lease_until is null or lease_until<now())
      order by created_at for update skip locked limit 40
    )
    returning j.*
  )
  select coalesce(jsonb_agg(
    to_jsonb(c) || jsonb_build_object(
      'tokens',coalesce((select jsonb_agg(d.token) from public.care_devices d where d.user_id=c.user_id and d.enabled),'[]'),
      'patientName',l.patient_name,
      'caregiverName',l.caregiver_name
    )
  ),'[]')
  into result
  from claimed c
  join public.care_links l on l.id=c.link_id;
  return result;
end;
$$;
revoke all on function public.care_claim_link_jobs() from public,anon,authenticated;
grant execute on function public.care_claim_link_jobs() to service_role;
