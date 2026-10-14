-- Restaura privilegios de tabla para el perfil de emergencia.
-- RLS sigue limitando a cada usuario a su propia fila.
grant select, insert, update, delete on table public.emergency_profiles to authenticated;
grant select, insert, update, delete on table public.emergency_profiles to service_role;

do $$
declare
  seq_name text;
begin
  select pg_get_serial_sequence('public.emergency_profiles', 'id') into seq_name;
  if seq_name is not null then
    execute format('grant usage, select on sequence %s to authenticated', seq_name);
    execute format('grant usage, select on sequence %s to service_role', seq_name);
  end if;
end $$;