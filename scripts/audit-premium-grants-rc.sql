begin;

-- All fixtures and grants in this audit are rolled back.
select set_config('mediclaro.audit_owner',(select id::text from auth.users where phone='34680127015' and phone_confirmed_at is not null),true);
select set_config('mediclaro.audit_user',gen_random_uuid()::text,true);
insert into auth.users(id,aud,role,phone,phone_confirmed_at,is_anonymous)
 values(current_setting('mediclaro.audit_user')::uuid,'authenticated','authenticated','99912345678',now(),false);
insert into public.profiles(id) values(current_setting('mediclaro.audit_user')::uuid) on conflict do nothing;
select set_config('request.jwt.claim.sub',current_setting('mediclaro.audit_owner'),true);
set local role authenticated;
do $$
declare result jsonb;
begin
 result:=public.owner_set_premium_grant('+99912345678',true,30);
 if result->>'verified'<>'true' then raise exception 'FAIL verification'; end if;
 if (public.owner_premium_grants(0)->>'total')::int<1 then raise exception 'FAIL listing'; end if;
 begin
  perform public.owner_set_premium_grant('bad-phone',true,null);
  raise exception 'FAIL invalid input accepted';
 exception when invalid_parameter_value then null; end;
end $$;
select set_config('request.jwt.claim.sub',current_setting('mediclaro.audit_user'),true);
do $$
begin
 if public.get_account_status()->>'plan'<>'premium' then raise exception 'FAIL premium'; end if;
 if public.owner_access()->>'owner'<>'false' then raise exception 'FAIL privilege escalation'; end if;
 begin
  perform public.owner_set_premium_grant('99912345679',true,null);
  raise exception 'FAIL non-owner grant';
 exception when insufficient_privilege then null; end;
 begin
  perform public.owner_premium_grants(0);
  raise exception 'FAIL non-owner listing';
 exception when insufficient_privilege then null; end;
 begin
  perform public.courtesy_access_for_service(auth.uid());
  raise exception 'FAIL service RPC exposed';
 exception when insufficient_privilege then null; end;
 begin
  perform 1 from mediclaro_private.premium_grants;
  raise exception 'FAIL private grants exposed';
 exception when insufficient_privilege then null; end;
end $$;
reset role;
update auth.users set phone_confirmed_at=null where id=current_setting('mediclaro.audit_user')::uuid;
do $$ begin
 if mediclaro_private.has_courtesy(current_setting('mediclaro.audit_user')::uuid) then raise exception 'FAIL unverified user'; end if;
end $$;
update auth.users set phone_confirmed_at=now(),is_anonymous=true where id=current_setting('mediclaro.audit_user')::uuid;
do $$ begin
 if mediclaro_private.has_courtesy(current_setting('mediclaro.audit_user')::uuid) then raise exception 'FAIL anonymous user'; end if;
end $$;
update auth.users set is_anonymous=false where id=current_setting('mediclaro.audit_user')::uuid;
update mediclaro_private.premium_grants set expires_at=now()-interval '1 minute' where phone='99912345678';
do $$ begin
 if mediclaro_private.has_courtesy(current_setting('mediclaro.audit_user')::uuid) then raise exception 'FAIL expired grant'; end if;
end $$;
select set_config('request.jwt.claim.sub',current_setting('mediclaro.audit_owner'),true);
set local role authenticated;
select public.owner_set_premium_grant('99912345678',true,null);
select public.owner_set_premium_grant('99912345678',false,null);
select set_config('request.jwt.claim.sub',current_setting('mediclaro.audit_user'),true);
do $$ begin
 if public.get_account_status()->>'plan'<>'free' then raise exception 'FAIL revoked grant'; end if;
end $$;
reset role;
update public.profiles set plan='premium',subscription_status='active',sub_state='ACTIVE'
 where id=current_setting('mediclaro.audit_user')::uuid;
set local role authenticated;
do $$ begin
 if public.get_account_status()->>'plan'<>'premium' then raise exception 'FAIL paid plan overwritten'; end if;
end $$;
reset role;
do $$ begin
 if (select count(*) from public.audit_log where user_id=current_setting('mediclaro.audit_owner')::uuid
  and action in ('courtesy_premium_granted','courtesy_premium_revoked') and created_at>=transaction_timestamp())<>3
 then raise exception 'FAIL audit trail'; end if;
end $$;
rollback;
select 'COURTESY_PREMIUM_AUTHORIZATION_AUDIT_PASSED' as result;
