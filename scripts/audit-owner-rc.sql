-- Real database authorization tests. All fixtures are rolled back.
begin;
select set_config('mediclaro.test_uid',gen_random_uuid()::text,true);
insert into mediclaro_private.owner_phones(phone_hash) values
 (encode(extensions.digest('34999000001','sha256'),'hex'));
insert into auth.users(id,instance_id,aud,role,phone,is_anonymous,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
 values(current_setting('mediclaro.test_uid')::uuid,'00000000-0000-0000-0000-000000000000',
 'authenticated','authenticated','34999000001',false,'{}','{}',now(),now());
select set_config('request.jwt.claim.sub',current_setting('mediclaro.test_uid'),true);
select set_config('request.jwt.claim.role','authenticated',true);
set local role authenticated;
do $$ begin
 if (public.owner_access()->>'owner')::boolean then raise exception 'Unverified phone granted owner'; end if;
 if public.get_account_status()->>'plan'='premium' then raise exception 'Unverified phone granted Premium'; end if;
 begin
  perform public.owner_dashboard();
  raise exception 'Unverified phone accessed dashboard';
 exception when insufficient_privilege then null;
 end;
 begin
  perform public.owner_access_for_service(auth.uid());
  raise exception 'Client called privileged owner lookup';
 exception when insufficient_privilege then null;
 end;
 begin
  perform public.get_account_status_billing();
  raise exception 'Client called hidden billing function';
 exception when insufficient_privilege then null;
 end;
end $$;
reset role;
update auth.users set phone_confirmed_at=now() where id=current_setting('mediclaro.test_uid')::uuid;
set local role authenticated;
do $$ declare dashboard jsonb; status jsonb;
begin
 if not (public.owner_access()->>'owner')::boolean then raise exception 'Verified owner rejected'; end if;
 status:=public.get_account_status();
 if status->>'plan'<>'premium' or status->>'state'<>'ACTIVE' or not (status->>'owner_access')::boolean then raise exception 'Owner entitlement missing'; end if;
 if status->>'period_end' is not null or (status->>'cancel_at_period_end')::boolean then raise exception 'Owner has billing renewal'; end if;
 dashboard:=public.owner_dashboard(7,0);
 if not dashboard ? 'accounts' or not dashboard ? 'daily' or not dashboard ? 'notifications' then raise exception 'Incomplete dashboard'; end if;
 if jsonb_array_length(dashboard->'accounts')>20 then raise exception 'Unbounded account page'; end if;
 perform public.owner_dashboard(30,1);
 perform public.owner_dashboard(90,0);
 begin
  perform public.owner_dashboard(1000,0);
  raise exception 'Invalid range accepted';
 exception when invalid_parameter_value then null;
 end;
 begin
  perform public.owner_dashboard(30,-1);
  raise exception 'Invalid page accepted';
 exception when invalid_parameter_value then null;
 end;
end $$;
reset role;
-- Force the metered path; both config and customer fixture are rolled back.
update public.plan_config set monthly_scans=0,overage_enabled=true,hard_cap=10000 where plan='premium';
update public.profiles set stripe_customer_id='cus_rc_owner_fixture' where id=current_setting('mediclaro.test_uid')::uuid;
do $$ declare result jsonb; u uuid:=current_setting('mediclaro.test_uid')::uuid;
begin
 result:=public.consume_scan(u,'identified','rc-owner-test','Temporary RC check',1.0::real,'qa');
 if not (result->>'allowed')::boolean then raise exception 'Owner scan refused'; end if;
 if (result->>'overage')::boolean or result->>'stripe_customer_id' is not null then raise exception 'Owner was charged'; end if;
end $$;
update auth.users set is_anonymous=true where id=current_setting('mediclaro.test_uid')::uuid;
set local role authenticated;
do $$ begin
 if (public.owner_access()->>'owner')::boolean then raise exception 'Anonymous owner granted'; end if;
end $$;
reset role;
update auth.users set is_anonymous=false where id=current_setting('mediclaro.test_uid')::uuid;
update mediclaro_private.owner_phones set enabled=false where phone_hash=encode(extensions.digest('34999000001','sha256'),'hex');
set local role authenticated;
do $$ begin
 if (public.owner_access()->>'owner')::boolean then raise exception 'Revoked owner still has access'; end if;
 begin
  perform public.owner_dashboard();
  raise exception 'Revoked owner accessed dashboard';
 exception when insufficient_privilege then null;
 end;
end $$;
reset role;
do $$ begin
 if (select count(*) from mediclaro_private.owner_phones where phone_hash in
 ('e0e245ca2aa438c172d9f4371290e620f541cb4e5e5df4b0013bdc42c712f8ee','cf4ca8322176be84ebe41ab295af8879fecd5d0c3cf6a6b9c6841ffe807b0898') and enabled)<>2 then raise exception 'Owner allowlist incomplete'; end if;
 if has_function_privilege('anon','public.owner_dashboard(integer,integer)','EXECUTE') then raise exception 'Unauthenticated dashboard access'; end if;
 if has_table_privilege('authenticated','mediclaro_private.owner_phones','SELECT') then raise exception 'Owner allowlist exposed'; end if;
end $$;
rollback;
select 'OWNER_AUTHORIZATION_AND_DASHBOARD_CHECKS_PASSED' as result;
