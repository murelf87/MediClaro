create table public.care_calls (
 id uuid primary key default gen_random_uuid(), incident_id uuid not null references public.care_incidents(id) on delete cascade,
 caller_id uuid not null references auth.users(id) on delete cascade, recipient_id uuid not null references auth.users(id) on delete cascade,
 state text not null default 'ringing' check(state in ('ringing','answered','ended')),
 offer text, answer text, created_at timestamptz not null default now(), expires_at timestamptz not null default now()+interval '60 seconds',
 check(caller_id<>recipient_id),check(length(offer)<=64000),check(length(answer)<=64000)
);
create unique index care_one_call on public.care_calls(incident_id) where state in ('ringing','answered');
alter table public.care_calls enable row level security;
revoke all on public.care_calls from anon,authenticated;
grant all on public.care_calls to service_role;
create function public.caregiver_call(p_action text,p_payload jsonb default '{}') returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare u uuid:=auth.uid(); iid uuid; cid uuid; inc public.care_incidents; c public.care_calls; recipient uuid; sdp text;
begin
 if u is null then raise exception 'AUTH_REQUIRED'; end if;
 if not public.hit_rate_limit(u,'care-call-'||p_action,case when p_action='snapshot' then 120 else 20 end) then raise exception 'RATE_LIMIT'; end if;
 iid:=(p_payload->>'incidentId')::uuid;
 select * into inc from public.care_incidents where id=iid for update;
 if inc.id is null or not public.care_can_read(iid,u) then raise exception 'NOT_ALLOWED'; end if;
 update public.care_calls set state='ended',offer=null,answer=null where incident_id=iid and state<>'ended'
  and (expires_at<=now() or inc.state<>'active' or inc.expires_at<=now() or not public.care_can_read(iid,caller_id) or not public.care_can_read(iid,recipient_id));
 if p_action='snapshot' then
  select * into c from public.care_calls where incident_id=iid and (caller_id=u or recipient_id=u) and state<>'ended' order by created_at desc limit 1;
  return case when c.id is null then 'null'::jsonb else to_jsonb(c) end;
 end if;
 if inc.state<>'active' or inc.expires_at<=now() then raise exception 'INCIDENT_CLOSED'; end if;
 if p_action='offer' then
  recipient:=(p_payload->>'recipientId')::uuid;sdp:=p_payload->>'sdp';
  if recipient is null or recipient=u or not public.care_can_read(iid,recipient)
    or (u<>inc.patient_id and recipient<>inc.patient_id) then raise exception 'NOT_ALLOWED'; end if;
  if length(coalesce(sdp,'')) not between 1 and 64000 or sdp not like 'v=0%' then raise exception 'INVALID_SDP'; end if;
  if exists(select 1 from public.care_calls where incident_id=iid and state<>'ended') then raise exception 'CALL_BUSY'; end if;
  insert into public.care_calls(id,incident_id,caller_id,recipient_id,offer) values((p_payload->>'callId')::uuid,iid,u,recipient,sdp) returning * into c;
  insert into public.care_push_jobs(user_id,incident_id,kind) values(recipient,iid,'message');
  return to_jsonb(c);
 end if;
 cid:=(p_payload->>'callId')::uuid;
 select * into c from public.care_calls where id=cid and incident_id=iid and (caller_id=u or recipient_id=u) for update;
 if c.id is null then raise exception 'NOT_ALLOWED'; end if;
 if p_action='end' then
  update public.care_calls set state='ended',offer=null,answer=null where id=cid;
  return jsonb_build_object('ended',true);
 elsif p_action='answer' then
  if c.recipient_id<>u or c.state<>'ringing' or c.expires_at<=now() then raise exception 'NOT_ALLOWED'; end if;
  sdp:=p_payload->>'sdp';
  if length(coalesce(sdp,'')) not between 1 and 64000 or sdp not like 'v=0%' then raise exception 'INVALID_SDP'; end if;
  update public.care_calls set answer=sdp,state='answered',expires_at=least(inc.expires_at,now()+interval '20 minutes') where id=cid returning * into c;
  return to_jsonb(c);
 end if;
 raise exception 'INVALID_ACTION';
end;
$$;
revoke all on function public.caregiver_call(text,jsonb) from public,anon;
grant execute on function public.caregiver_call(text,jsonb) to authenticated;
