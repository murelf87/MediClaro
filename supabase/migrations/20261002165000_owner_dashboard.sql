-- Owner access is checked against verified Auth identity, never client/profile fields.
create schema if not exists mediclaro_private;
revoke all on schema mediclaro_private from public,anon,authenticated;
create table mediclaro_private.owner_phones (
 phone_hash text primary key, enabled boolean not null default true
);
revoke all on mediclaro_private.owner_phones from public,anon,authenticated;
insert into mediclaro_private.owner_phones(phone_hash) values
 ('e0e245ca2aa438c172d9f4371290e620f541cb4e5e5df4b0013bdc42c712f8ee'),
 ('cf4ca8322176be84ebe41ab295af8879fecd5d0c3cf6a6b9c6841ffe807b0898');
create function mediclaro_private.is_owner(p_user uuid) returns boolean
language sql stable security definer set search_path=pg_catalog as $$
 select exists (
  select 1 from auth.users u join mediclaro_private.owner_phones o
  on o.phone_hash=encode(extensions.digest(regexp_replace(u.phone,'[^0-9]','','g'),'sha256'),'hex')
  where u.id=p_user and u.phone_confirmed_at is not null
  and not coalesce(u.is_anonymous,false) and o.enabled
 );
$$;
revoke all on function mediclaro_private.is_owner(uuid) from public,anon,authenticated;
create function public.owner_access() returns jsonb
language sql stable security definer set search_path=pg_catalog as $$
 select jsonb_build_object('owner',mediclaro_private.is_owner(auth.uid()));
$$;
revoke all on function public.owner_access() from public,anon;
grant execute on function public.owner_access() to authenticated;
create function public.owner_access_for_service(p_user uuid) returns boolean
language sql stable security definer set search_path=pg_catalog as $$
 select mediclaro_private.is_owner(p_user);
$$;
revoke all on function public.owner_access_for_service(uuid) from public,anon,authenticated;
grant execute on function public.owner_access_for_service(uuid) to service_role;
create or replace function public.is_premium(p public.profiles) returns boolean
language sql stable security definer set search_path=pg_catalog as $$
 select mediclaro_private.is_owner(p.id) or p.sub_state in ('TRIAL','ACTIVE','PAST_DUE');
$$;
-- Keep existing counters/settings, applying owner access independently of billing webhooks.
alter function public.get_account_status() rename to get_account_status_billing;
revoke all on function public.get_account_status_billing() from public,anon,authenticated;
create function public.get_account_status() returns jsonb
language plpgsql stable security definer set search_path=pg_catalog as $$
declare result jsonb; owner boolean:=mediclaro_private.is_owner(auth.uid());
begin
 result:=public.get_account_status_billing();
 if result is null then return null; end if;
 if owner then
  result:=result || jsonb_build_object('plan','premium','state','ACTIVE','period_end',null,'cancel_at_period_end',false);
 end if;
 return result || jsonb_build_object('owner_access',owner);
end;
$$;
revoke all on function public.get_account_status() from public,anon;
grant execute on function public.get_account_status() to authenticated;
create function public.owner_dashboard(p_days integer default 30,p_page integer default 0) returns jsonb
language plpgsql security definer set search_path=pg_catalog as $$
declare since_at timestamptz; result jsonb;
begin
 if not mediclaro_private.is_owner(auth.uid()) then
  raise exception 'OWNER_REQUIRED' using errcode='42501';
 end if;
 if p_days not in (7,30,90) or p_page not between 0 and 10000 then
  raise exception 'INVALID_RANGE' using errcode='22023';
 end if;
 since_at:=now()-make_interval(days=>p_days);
 result:=jsonb_build_object(
  'generatedAt',now(),'days',p_days,'page',p_page,
  'kpis',jsonb_build_object(
   'users',(select count(*) from public.profiles),
   'verified',(select count(*) from auth.users where phone_confirmed_at is not null and not coalesce(is_anonymous,false)),
   'newUsers',(select count(*) from public.profiles where created_at>=since_at),
   'premium',(select count(*) from public.profiles p where public.is_premium(p)),
   'pastDue',(select count(*) from public.profiles where sub_state='PAST_DUE'),
   'cancelled',(select count(*) from public.profiles where sub_state='CANCELLED'),
   'scans',(select count(*) from public.scans where created_at>=since_at),
   'activeUsers',(select count(distinct user_id) from public.usage_events where created_at>=since_at),
   'chats',(select count(*) from public.usage_events where kind='chat' and created_at>=since_at),
   'errors',(select count(*) from public.usage_events where kind='error' and created_at>=since_at),
   'costEuro',(select coalesce(sum(cost_micros),0)::numeric/1000000 from public.usage_events where created_at>=since_at),
   'saved',(select count(*) from public.saved_medications),
   'favorites',(select count(*) from public.saved_medications where favorito),
   'linkedCaregivers',(select count(*) from public.care_links where accepted_at is not null and revoked_at is null),
   'activeIncidents',(select count(*) from public.care_incidents where state='active' and expires_at>now()),
   'incidents',(select count(*) from public.care_incidents where created_at>=since_at),
   'calls',(select count(*) from public.care_calls where created_at>=since_at),
   'pushPending',(select count(*) from public.care_push_jobs where sent_at is null)
  ),
  'billing',coalesce((select jsonb_agg(to_jsonb(b)) from (
   select billing_provider as provider,sub_state as state,count(*) as count
   from public.profiles group by billing_provider,sub_state order by billing_provider,sub_state
  ) b),'[]'::jsonb),
  'daily',coalesce((select jsonb_agg(to_jsonb(d) order by d.day) from (
   select (created_at at time zone 'Europe/Madrid')::date as day,
    count(*) filter(where kind='scan') as scans,count(*) filter(where kind='chat') as chats,
    count(*) filter(where kind='error') as errors,coalesce(sum(cost_micros),0)::numeric/1000000 as cost
   from public.usage_events where created_at>=since_at group by 1
  ) d),'[]'::jsonb),
  'notifications',coalesce((select jsonb_agg(to_jsonb(n)) from (
   select provider_state as state,count(*) as count from public.care_push_jobs
   where created_at>=since_at group by provider_state order by provider_state
  ) n),'[]'::jsonb),
  'activity',coalesce((select jsonb_agg(to_jsonb(a) order by a.created_at desc) from (
   select action,created_at from public.audit_log where created_at>=since_at order by created_at desc limit 30
  ) a),'[]'::jsonb),
  'accounts',coalesce((select jsonb_agg(to_jsonb(a) order by a.created_at desc) from (
   select p.id,p.created_at,
    case when u.phone_confirmed_at is not null then '*** '||right(u.phone,3) else 'Sin verificar' end as phone,
    case when public.is_premium(p) then 'premium' else 'free' end as plan,
    case when mediclaro_private.is_owner(p.id) then 'Propietario' else p.sub_state end as state,
    p.billing_provider as provider
   from public.profiles p left join auth.users u on u.id=p.id
   order by p.created_at desc,p.id limit 20 offset p_page*20
  ) a),'[]'::jsonb)
 );
 return result;
end;
$$;
revoke all on function public.owner_dashboard(integer,integer) from public,anon;
grant execute on function public.owner_dashboard(integer,integer) to authenticated;
