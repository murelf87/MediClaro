create table if not exists public.emergency_contact_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  call_sid text,
  message_sid text,
  call_status text not null default 'starting',
  sms_status text not null default 'starting',
  acknowledged_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.emergency_contact_attempts enable row level security;
create index if not exists emergency_contact_attempts_user_created
  on public.emergency_contact_attempts(user_id, created_at desc);

drop policy if exists emergency_contact_attempts_owner_select on public.emergency_contact_attempts;
create policy emergency_contact_attempts_owner_select
  on public.emergency_contact_attempts for select
  using (auth.uid() = user_id);

grant select on table public.emergency_contact_attempts to authenticated;
grant select, insert, update, delete on table public.emergency_contact_attempts to service_role;