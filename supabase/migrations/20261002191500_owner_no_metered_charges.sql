-- Owner access must never generate metered Stripe overage charges.
alter function public.consume_scan(uuid,text,text,text,real,text) rename to consume_scan_billing;
revoke all on function public.consume_scan_billing(uuid,text,text,text,real,text) from public,anon,authenticated,service_role;
create function public.consume_scan(p_user uuid,p_status text,p_nregistro text,p_nombre text,p_score real,p_method text)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare result jsonb;
begin
 result:=public.consume_scan_billing(p_user,p_status,p_nregistro,p_nombre,p_score,p_method);
 if mediclaro_private.is_owner(p_user) and coalesce((result->>'allowed')::boolean,false) then
  update public.scans set billed_overage=false where id=(result->>'scan_id')::bigint and user_id=p_user;
  result:=result || jsonb_build_object('overage',false,'stripe_customer_id',null);
 end if;
 return result;
end;
$$;
revoke all on function public.consume_scan(uuid,text,text,text,real,text) from public,anon,authenticated;
grant execute on function public.consume_scan(uuid,text,text,text,real,text) to service_role;
