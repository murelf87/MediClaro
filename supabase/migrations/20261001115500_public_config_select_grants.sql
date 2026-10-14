begin;

grant select on table public.app_config to anon, authenticated;
grant select on table public.plan_config to anon, authenticated;

drop policy if exists "app_config_public_read" on public.app_config;
create policy "app_config_public_read"
  on public.app_config
  for select
  to anon, authenticated
  using (key in ('plans', 'emergency'));

commit;
