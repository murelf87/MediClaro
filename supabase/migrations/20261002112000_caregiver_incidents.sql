-- Caregiver incident-only chat. Every mutation authenticates and checks participants.
create table public.care_links (
 id uuid primary key default gen_random_uuid(), patient_id uuid not null references auth.users(id) on delete cascade,
 caregiver_id uuid references auth.users(id) on delete cascade, patient_name text not null,
 caregiver_name text, expires_at timestamptz not null default now()+interval '24 hours',
 accepted_at timestamptz, revoked_at timestamptz, created_at timestamptz not null default now(),
 check (patient_id is distinct from caregiver_id)
);
create unique index care_links_active_pair on public.care_links(patient_id,caregiver_id) where revoked_at is null and caregiver_id is not null;
create table public.care_profiles (
 user_id uuid primary key references auth.users(id) on delete cascade,
 role text not null check(role in ('patient','caregiver')) default 'patient'
);
create table public.care_incidents (
 id uuid primary key default gen_random_uuid(), patient_id uuid not null references auth.users(id) on delete cascade,
 client_key text not null, summary text not null, state text not null default 'active' check(state in ('active','closed')),
 created_at timestamptz not null default now(), expires_at timestamptz not null default now()+interval '2 hours',
 latitude double precision, longitude double precision, accuracy double precision, location_at timestamptz,
 closed_at timestamptz, unique(patient_id,client_key),
 check(latitude between -90 and 90), check(longitude between -180 and 180)
);
create table public.care_members (
 incident_id uuid not null references public.care_incidents(id) on delete cascade,
 link_id uuid not null references public.care_links(id) on delete cascade,
 received_at timestamptz, acknowledged_at timestamptz, primary key(incident_id,link_id)
);
create table public.care_messages (
 id uuid primary key default gen_random_uuid(), incident_id uuid not null references public.care_incidents(id) on delete cascade,
 sender_id uuid not null references auth.users(id) on delete cascade,
 content text not null check(length(content) between 1 and 2000), created_at timestamptz not null default now(),
 client_key uuid not null, unique(sender_id,client_key),
 response_due_at timestamptz, responded_at timestamptz, escalated_at timestamptz
);
create table public.care_devices (
 token text primary key, user_id uuid not null references auth.users(id) on delete cascade,
 enabled boolean not null default true, updated_at timestamptz not null default now()
);
create table public.care_push_jobs (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 incident_id uuid not null references public.care_incidents(id) on delete cascade,
 kind text not null check(kind in ('alarm','message','no_response')), created_at timestamptz not null default now(),
 sent_at timestamptz, attempts integer not null default 0, lease_until timestamptz,
 provider_state text not null default 'pending', ticket_ids jsonb
);
create index care_jobs_pending on public.care_push_jobs(created_at) where sent_at is null;
create index care_message_deadlines on public.care_messages(response_due_at) where responded_at is null and escalated_at is null;
alter table public.care_links enable row level security;
alter table public.care_profiles enable row level security;
alter table public.care_incidents enable row level security;
alter table public.care_members enable row level security;
alter table public.care_messages enable row level security;
alter table public.care_devices enable row level security;
alter table public.care_push_jobs enable row level security;
revoke all on public.care_links,public.care_profiles,public.care_incidents,public.care_members,public.care_messages,public.care_devices,public.care_push_jobs from anon,authenticated;
grant all on public.care_links,public.care_profiles,public.care_incidents,public.care_members,public.care_messages,public.care_devices,public.care_push_jobs to service_role;

create function public.care_can_read(p_incident uuid,p_user uuid) returns boolean
language sql stable security definer set search_path=public,pg_temp as $$
 select exists(select 1 from public.care_incidents i where i.id=p_incident and i.patient_id=p_user)
 or exists(select 1 from public.care_members m join public.care_links l on l.id=m.link_id
 where m.incident_id=p_incident and l.caregiver_id=p_user and l.revoked_at is null);
$$;
revoke all on function public.care_can_read(uuid,uuid) from public,anon,authenticated;

create function public.caregiver_action(p_action text,p_payload jsonb default '{}') returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare
 u uuid:=auth.uid(); link public.care_links; inc public.care_incidents; mid uuid; token text;
 role_value text; iid uuid; name_value text; recipient uuid; deadline integer;
 profile public.emergency_profiles; out_json jsonb; lat double precision; lng double precision;
begin
 if u is null then raise exception 'AUTH_REQUIRED'; end if;
 if not public.hit_rate_limit(u,'caregiver-'||p_action,case when p_action='snapshot' then 60 when p_action='location' then 30 else 20 end) then raise exception 'RATE_LIMIT'; end if;
 if p_action='role' then
  role_value:=p_payload->>'role';
  if role_value not in ('patient','caregiver') then raise exception 'INVALID_ROLE'; end if;
  insert into public.care_profiles(user_id,role) values(u,role_value) on conflict(user_id) do update set role=excluded.role;
  return jsonb_build_object('role',role_value);
 elsif p_action='invite' then
  if (select count(*) from public.care_links where patient_id=u and revoked_at is null)>9 then raise exception 'LINK_LIMIT'; end if;
  name_value:=trim(coalesce(p_payload->>'name',''));
  if length(name_value) not between 1 and 80 then raise exception 'INVALID_NAME'; end if;
  insert into public.care_links(patient_id,patient_name) values(u,name_value) returning * into link;
  return jsonb_build_object('code',link.id,'expiresAt',link.expires_at);
 elsif p_action='accept' then
  name_value:=trim(coalesce(p_payload->>'name',''));
  if length(name_value) not between 1 and 80 then raise exception 'INVALID_NAME'; end if;
  select * into link from public.care_links where id=(p_payload->>'code')::uuid for update;
  if link.id is null or link.patient_id=u or link.caregiver_id is not null or link.revoked_at is not null or link.expires_at<now() then raise exception 'INVALID_INVITE'; end if;
  update public.care_links set caregiver_id=u,caregiver_name=name_value,accepted_at=now() where id=link.id;
  insert into public.care_profiles(user_id,role) values(u,'caregiver') on conflict(user_id) do update set role='caregiver';
  return jsonb_build_object('accepted',true);
 elsif p_action='revoke' then
  update public.care_links set revoked_at=now() where id=(p_payload->>'linkId')::uuid and (patient_id=u or caregiver_id=u) and revoked_at is null;
  if not found then raise exception 'NOT_ALLOWED'; end if;
  return jsonb_build_object('revoked',true);
 elsif p_action='device' then
  token:=p_payload->>'token';
  if token is null or token !~ '^(ExponentPushToken|ExpoPushToken)\[[A-Za-z0-9_-]{10,200}\]$' then raise exception 'INVALID_TOKEN'; end if;
  insert into public.care_devices(token,user_id,enabled) values(token,u,coalesce((p_payload->>'enabled')::boolean,true))
  on conflict(token) do update set user_id=u,enabled=excluded.enabled,updated_at=now();
  return jsonb_build_object('registered',true);
 elsif p_action='disable_devices' then
  update public.care_devices set enabled=false where user_id=u;
  return jsonb_build_object('disabled',true);
 elsif p_action='start' then
  select * into profile from public.emergency_profiles where user_id=u;
  if profile.user_id is null or not coalesce(profile.consent_notify_contact,false) then raise exception 'CONTACT_CONSENT_REQUIRED'; end if;
  if not exists(select 1 from public.care_links where patient_id=u and caregiver_id is not null and revoked_at is null) then raise exception 'NO_LINKED_CAREGIVER'; end if;
  if length(coalesce(p_payload->>'summary','')) not between 1 and 2000 or length(coalesce(p_payload->>'clientKey','')) not between 1 and 100 then raise exception 'INVALID_INCIDENT'; end if;
  insert into public.care_incidents(patient_id,client_key,summary) values(u,p_payload->>'clientKey',case when profile.consent_share_conversation then p_payload->>'summary' else 'El paciente ha activado un aviso de malestar. No ha autorizado compartir su conversación.' end)
  on conflict(patient_id,client_key) do nothing returning * into inc;
  if inc.id is null then
   select * into inc from public.care_incidents where patient_id=u and client_key=p_payload->>'clientKey';
   return jsonb_build_object('incidentId',inc.id,'queued',true);
  end if;
  insert into public.care_members(incident_id,link_id) select inc.id,id from public.care_links where patient_id=u and caregiver_id is not null and revoked_at is null;
  insert into public.care_push_jobs(user_id,incident_id,kind)
   select l.caregiver_id,inc.id,'alarm' from public.care_links l join public.care_members m on m.link_id=l.id where m.incident_id=inc.id;
  return jsonb_build_object('incidentId',inc.id,'queued',true);
 elsif p_action='snapshot' then
  -- Caregiver receives no conversation before a patient incident exists.
  select jsonb_build_object(
   'role',coalesce((select role from public.care_profiles where user_id=u),'patient'),
   'links',coalesce((select jsonb_agg(jsonb_build_object('id',l.id,'patientId',l.patient_id,'caregiverId',l.caregiver_id,'patientName',l.patient_name,'caregiverName',l.caregiver_name,'accepted',l.accepted_at is not null)) from public.care_links l where (l.patient_id=u or l.caregiver_id=u) and l.revoked_at is null),'[]'),
   'incidents',coalesce((select jsonb_agg(to_jsonb(i) || jsonb_build_object(
    'members',(select jsonb_agg(jsonb_build_object('receivedAt',m.received_at,'acknowledgedAt',m.acknowledged_at,'caregiverName',l.caregiver_name)) from public.care_members m join public.care_links l on l.id=m.link_id where m.incident_id=i.id and l.revoked_at is null),
    'messages',coalesce((select jsonb_agg(to_jsonb(cm) order by cm.created_at) from (select * from public.care_messages where incident_id=i.id order by created_at desc limit 100) cm),'[]'),
    'notificationState',coalesce((select provider_state from public.care_push_jobs j where j.incident_id=i.id order by created_at desc limit 1),'none')))
    from public.care_incidents i where i.created_at>now()-interval '24 hours' and public.care_can_read(i.id,u)),'[]')
  ) into out_json;
  return out_json;
 end if;
 iid:=(p_payload->>'incidentId')::uuid;
 select * into inc from public.care_incidents where id=iid for update;
 if inc.id is null or not public.care_can_read(iid,u) then raise exception 'NOT_ALLOWED'; end if;
 if p_action='received' or p_action='ack' then
  update public.care_members m set received_at=coalesce(received_at,now()),
   acknowledged_at=case when p_action='ack' then coalesce(acknowledged_at,now()) else acknowledged_at end
  from public.care_links l where m.link_id=l.id and m.incident_id=iid and l.caregiver_id=u and l.revoked_at is null;
  if not found then raise exception 'CAREGIVER_ONLY'; end if;
  return jsonb_build_object('confirmed',true);
 end if;
 if inc.state<>'active' or inc.expires_at<=now() then raise exception 'INCIDENT_CLOSED'; end if;
 if p_action='close' then
  if inc.patient_id<>u then raise exception 'PATIENT_ONLY'; end if;
  update public.care_incidents set state='closed',closed_at=now(),latitude=null,longitude=null,accuracy=null,location_at=null where id=iid;
  update public.care_messages set responded_at=now() where incident_id=iid and response_due_at is not null and responded_at is null;
  return jsonb_build_object('closed',true);
 elsif p_action='location' then
  if inc.patient_id<>u then raise exception 'PATIENT_ONLY'; end if;
  select * into profile from public.emergency_profiles where user_id=u;
  if not coalesce(profile.consent_share_location,false) then
   update public.care_incidents set latitude=null,longitude=null,accuracy=null,location_at=null where id=iid;
   return jsonb_build_object('shared',false);
  end if;
  lat:=(p_payload->>'latitude')::double precision; lng:=(p_payload->>'longitude')::double precision;
  if lat is null or lng is null or not(lat between -90 and 90) or not(lng between -180 and 180) then raise exception 'INVALID_LOCATION'; end if;
  update public.care_incidents set latitude=lat,longitude=lng,accuracy=greatest(0,(p_payload->>'accuracy')::double precision),location_at=now() where id=iid;
  return jsonb_build_object('shared',true);
 elsif p_action='message' then
  if length(trim(coalesce(p_payload->>'content',''))) not between 1 and 2000 then raise exception 'INVALID_MESSAGE'; end if;
  deadline:=case when inc.patient_id<>u and coalesce((p_payload->>'checkIn')::boolean,false) then 60 else null end;
  insert into public.care_messages(incident_id,sender_id,content,client_key,response_due_at)
   values(iid,u,trim(p_payload->>'content'),(p_payload->>'clientKey')::uuid,case when deadline is not null then now()+make_interval(secs=>deadline) end)
   on conflict(sender_id,client_key) do nothing returning id into mid;
  if mid is not null then
   if inc.patient_id=u then
    update public.care_messages set responded_at=now() where incident_id=iid and response_due_at is not null and responded_at is null;
   end if;
   insert into public.care_push_jobs(user_id,incident_id,kind)
    select distinct r,iid,'message' from (
     select inc.patient_id r where inc.patient_id<>u
     union select l.caregiver_id from public.care_members m join public.care_links l on l.id=m.link_id where m.incident_id=iid and l.revoked_at is null and l.caregiver_id<>u
    ) recipients;
  end if;
  return jsonb_build_object('stored',true,'responseDeadlineSeconds',deadline);
 end if;
 raise exception 'INVALID_ACTION';
end;
$$;
revoke all on function public.caregiver_action(text,jsonb) from public,anon;
grant execute on function public.caregiver_action(text,jsonb) to authenticated;

create function public.care_tick() returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare msg record;
begin
 update public.care_incidents set state='closed',closed_at=now(),latitude=null,longitude=null,accuracy=null,location_at=null where state='active' and expires_at<=now();
 -- Explicit revocation of location removes its latest snapshot within one scheduler tick.
 update public.care_incidents i set latitude=null,longitude=null,accuracy=null,location_at=null where latitude is not null and not exists(select 1 from public.emergency_profiles p where p.user_id=i.patient_id and p.consent_share_location=true);
 for msg in select m.* from public.care_messages m join public.care_incidents i on i.id=m.incident_id
  where m.response_due_at<=now() and m.responded_at is null and m.escalated_at is null and i.state='active' for update of m skip locked
 loop
  update public.care_messages set escalated_at=now() where id=msg.id;
  insert into public.care_push_jobs(user_id,incident_id,kind) select patient_id,msg.incident_id,'no_response' from public.care_incidents where id=msg.incident_id;
  insert into public.care_push_jobs(user_id,incident_id,kind)
   select l.caregiver_id,msg.incident_id,'no_response' from public.care_members m join public.care_links l on l.id=m.link_id where m.incident_id=msg.incident_id and l.revoked_at is null;
 end loop;
 delete from public.care_incidents where created_at<now()-interval '30 days';
 delete from public.care_links where caregiver_id is null and expires_at<now()-interval '1 day';
end;
$$;
revoke all on function public.care_tick() from public,anon,authenticated;
grant execute on function public.care_tick() to service_role;

create function public.care_claim_jobs() returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare result jsonb;
begin
 perform public.care_tick();
 with claimed as (
  update public.care_push_jobs j set attempts=attempts+1,lease_until=now()+interval '90 seconds'
  where id in (select id from public.care_push_jobs where sent_at is null and attempts<5 and (lease_until is null or lease_until<now()) order by created_at for update skip locked limit 40)
  returning j.*
 )
 select coalesce(jsonb_agg(to_jsonb(c)||jsonb_build_object('tokens',coalesce(
  (select jsonb_agg(d.token) from public.care_devices d where d.user_id=c.user_id and d.enabled),'[]'))),'[]') into result from claimed c
 where exists(select 1 from public.care_incidents i where i.id=c.incident_id and i.state='active' and public.care_can_read(i.id,c.user_id));
 update public.care_push_jobs j set sent_at=now(),provider_state='cancelled' where sent_at is null and not exists(select 1 from public.care_incidents i where i.id=j.incident_id and i.state='active' and public.care_can_read(i.id,j.user_id));
 return result;
end;
$$;
revoke all on function public.care_claim_jobs() from public,anon,authenticated;
grant execute on function public.care_claim_jobs() to service_role;

-- Secret created inside Vault; never committed or returned to clients.
create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron with schema pg_catalog;
do $$ begin
 if not exists(select 1 from vault.secrets where name='mediclaro_care_worker') then
  perform vault.create_secret(gen_random_uuid()::text||gen_random_uuid()::text,'mediclaro_care_worker','Internal caregiver dispatch authentication');
 end if;
end $$;
create function public.care_worker_key() returns text language sql security definer set search_path=public,pg_temp as $$
 select decrypted_secret from vault.decrypted_secrets where name='mediclaro_care_worker' limit 1;
$$;
revoke all on function public.care_worker_key() from public,anon,authenticated;
grant execute on function public.care_worker_key() to service_role;
select cron.schedule('mediclaro-caregiver-dispatch','* * * * *',$cron$
 select net.http_post(
  url:='https://ldonnvkysjalpmystoeq.supabase.co/functions/v1/caregiver-dispatch',
  headers:=jsonb_build_object('Content-Type','application/json','x-care-key',(select decrypted_secret from vault.decrypted_secrets where name='mediclaro_care_worker')),
  body:='{}'::jsonb,timeout_milliseconds:=15000);
$cron$);
