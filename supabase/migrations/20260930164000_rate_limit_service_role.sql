-- Las Edge Functions llaman hit_rate_limit mediante el cliente service_role.
-- El REVOKE de la migración inicial retiró el EXECUTE heredado de PUBLIC.
grant execute on function public.hit_rate_limit(uuid, text, int) to service_role;
