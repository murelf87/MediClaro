-- Restore client privileges only for the existing owner-scoped RLS tables.
-- No schema or identification pipeline changes.
begin;
grant usage on schema public to authenticated;
grant select, insert, update, delete on public.saved_medications to authenticated;
grant select, delete on public.scans to authenticated;
grant usage, select on sequence public.saved_medications_id_seq to authenticated;
alter table public.saved_medications enable row level security;
alter table public.scans enable row level security;
commit;
