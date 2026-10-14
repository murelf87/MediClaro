-- Courtesy Premium is independent of paid billing and never grants owner access.
begin;
create table if not exists mediclaro_private.premium_grants (
 phone text primary key check (phone ~ '^[1-9][0-9]{7,14}$'),
 granted_by uuid not null,
 granted_at timestamptz not null default now(),
 expires_at timestamptz,
 revoked_at timestamptz
);
revoke all on mediclaro_private.premium_grants from public, anon, authenticated;
create or replace function mediclaro_private.has_courtesy(p_user uuid) returns boolean
language sql stable security definer set search_path=pg_catalog as $$
 select exists(
  select 1 from auth.users u join mediclaro_private.premium_grants g
   on g.phone=regexp_replace(u.phone,'[^0-9]','','g')
  where u.id=p_user and u.phone_confirmed_at is not null
   and not coalesce(u.is_anonymous,false) and g.revoked_at is null
   and (g.expires_at is null or g.expires_at>now())
 );
$$;
revoke all on function mediclaro_private.has_courtesy(uuid) from public,anon,authenticated;
create or replace function public.courtesy_access_for_service(p_user uuid) returns boolean
language sql stable security definer set search_path=pg_catalog as $$
 select mediclaro_private.has_courtesy(p_user);
$$;
revoke all on function public.courtesy_access_for_service(uuid) from public,anon,authenticated;
grant execute on function public.courtesy_access_for_service(uuid) to service_role;
create or replace function public.is_premium(p public.profiles) returns boolean
language sql stable security definer set search_path=pg_catalog as $$
 select mediclaro_private.is_owner(p.id) or mediclaro_private.has_courtesy(p.id)
  or p.sub_state in ('TRIAL','ACTIVE','PAST_DUE');
$$;
create or replace function public.get_account_status() returns jsonb
language plpgsql stable security definer set search_path=pg_catalog as $$
declare result jsonb; owner boolean:=mediclaro_private.is_owner(auth.uid());
 courtesy boolean:=mediclaro_private.has_courtesy(auth.uid());
begin
 result:=public.get_account_status_billing();
 if result is null then return null; end if;
 if owner or courtesy then
  result:=result || jsonb_build_object('plan','premium','state','ACTIVE');
 end if;
 if owner then
  result:=result || jsonb_build_object('period_end',null,'cancel_at_period_end',false);
 end if;
 return result || jsonb_build_object('owner_access',owner,'courtesy_access',courtesy);
end;
$$;
create or replace function public.owner_set_premium_grant(p_phone text,p_enabled boolean,p_days integer default null)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare normalized text; expiry timestamptz; verified boolean;
begin
 if not mediclaro_private.is_owner(auth.uid()) then
  raise exception 'OWNER_REQUIRED' using errcode='42501';
 end if;
 if p_phone is null or length(p_phone)>32 or p_phone !~ '^[+0-9 ()-]+$'
  or p_enabled is null or (p_days is not null and (p_days<1 or p_days>3650)) then
  raise exception 'INVALID_GRANT' using errcode='22023';
 end if;
 normalized:=regexp_replace(p_phone,'[^0-9]','','g');
 if length(normalized)=9 then normalized:='34'||normalized; end if;
 if normalized !~ '^[1-9][0-9]{7,14}$' then
  raise exception 'INVALID_PHONE' using errcode='22023';
 end if;
 expiry:=case when p_days is null then null else now()+make_interval(days=>p_days) end;
 if p_enabled then
  insert into mediclaro_private.premium_grants(phone,granted_by,expires_at)
  values(normalized,auth.uid(),expiry)
  on conflict(phone) do update set granted_by=excluded.granted_by,granted_at=now(),
   expires_at=excluded.expires_at,revoked_at=null;
 else
  update mediclaro_private.premium_grants set revoked_at=now()
  where phone=normalized and revoked_at is null;
 end if;
 insert into public.audit_log(user_id,action,meta)
 values(auth.uid(),case when p_enabled then 'courtesy_premium_granted' else 'courtesy_premium_revoked' end,
  jsonb_build_object('phone_hash',encode(extensions.digest(normalized,'sha256'),'hex'),'expires_at',expiry));
 select exists(select 1 from auth.users where regexp_replace(phone,'[^0-9]','','g')=normalized
  and phone_confirmed_at is not null and not coalesce(is_anonymous,false)) into verified;
 return jsonb_build_object('phone','+'||normalized,'enabled',p_enabled,'verified',verified,'expiresAt',expiry);
end;
$$;
revoke all on function public.owner_set_premium_grant(text,boolean,integer) from public,anon;
grant execute on function public.owner_set_premium_grant(text,boolean,integer) to authenticated;
create or replace function public.owner_premium_grants(p_page integer default 0) returns jsonb
language plpgsql stable security definer set search_path=pg_catalog as $$
declare result jsonb;
begin
 if not mediclaro_private.is_owner(auth.uid()) then
  raise exception 'OWNER_REQUIRED' using errcode='42501';
 end if;
 if p_page is null or p_page<0 or p_page>10000 then
  raise exception 'INVALID_RANGE' using errcode='22023';
 end if;
 select jsonb_build_object('total',(select count(*) from mediclaro_private.premium_grants),
  'grants',coalesce((select jsonb_agg(to_jsonb(r)) from (
   select '+'||g.phone as phone,g.granted_at as "grantedAt",g.expires_at as "expiresAt",
    g.revoked_at as "revokedAt",
    (g.revoked_at is null and (g.expires_at is null or g.expires_at>now())) as active,
    exists(select 1 from auth.users u where regexp_replace(u.phone,'[^0-9]','','g')=g.phone
      and u.phone_confirmed_at is not null and not coalesce(u.is_anonymous,false)) as verified
   from mediclaro_private.premium_grants g order by g.granted_at desc,g.phone limit 20 offset p_page*20
  ) r),'[]'::jsonb)) into result;
 return result;
end;
$$;
revoke all on function public.owner_premium_grants(integer) from public,anon;
grant execute on function public.owner_premium_grants(integer) to authenticated;
commit;
