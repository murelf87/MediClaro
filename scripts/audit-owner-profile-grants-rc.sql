begin;
select set_config('request.jwt.claim.sub',(select id::text from auth.users where phone='34680127015'),true);
set local role authenticated;
do $$ declare n integer; begin
 if not (public.owner_access()->>'owner')::boolean then raise exception 'Owner missing'; end if;
 if public.get_account_status()->>'plan'<>'premium' then raise exception 'Premium missing'; end if;
 perform plan,subscription_status,current_period_end,billing_provider,cancel_at_period_end from public.profiles where id=auth.uid();
 get diagnostics n = row_count;
 if n<>1 then raise exception 'Own profile unreadable'; end if;
 if exists(select id from public.profiles where id<>auth.uid()) then raise exception 'Other profiles exposed'; end if;
 if has_column_privilege('authenticated','public.profiles','plan','UPDATE') then raise exception 'Billing editable'; end if;
 if has_column_privilege('authenticated','public.profiles','is_admin','SELECT') then raise exception 'Admin flags exposed'; end if;
 if jsonb_typeof(public.owner_dashboard()->'kpis')<>'object' then raise exception 'Dashboard missing'; end if;
end $$;
reset role;
select set_config('request.jwt.claim.sub',gen_random_uuid()::text,true);
set local role authenticated;
do $$ begin
 if (public.owner_access()->>'owner')::boolean then raise exception 'Stranger is owner'; end if;
 if exists(select id from public.profiles) then raise exception 'Stranger sees profiles'; end if;
 begin perform public.owner_dashboard(); raise exception 'Stranger sees dashboard'; exception when insufficient_privilege then null; end;
end $$;
reset role;
rollback;
select 'OWNER_PREMIUM_DASHBOARD_PROFILE_RLS_PASSED' as result;
