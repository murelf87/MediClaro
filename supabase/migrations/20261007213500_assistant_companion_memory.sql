-- Optional conversational memory for MediClaro companion mode.
-- Stores only short, non-sensitive everyday facts extracted from what the user voluntarily shares.
create table if not exists public.assistant_memories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  memory text not null check (char_length(memory) between 2 and 220),
  memory_hash text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id,memory_hash)
);
create index if not exists assistant_memories_user_updated on public.assistant_memories(user_id,updated_at desc);
alter table public.assistant_memories enable row level security;

drop policy if exists "assistant memories own read" on public.assistant_memories;
drop policy if exists "assistant memories own delete" on public.assistant_memories;
create policy "assistant memories own read" on public.assistant_memories for select to authenticated using(user_id=auth.uid());
create policy "assistant memories own delete" on public.assistant_memories for delete to authenticated using(user_id=auth.uid());

revoke all on public.assistant_memories from public,anon;
grant select,delete on public.assistant_memories to authenticated;
grant all on public.assistant_memories to service_role;
