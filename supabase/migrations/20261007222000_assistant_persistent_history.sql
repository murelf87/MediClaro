-- Persistent assistant history + longitudinal context.
-- Messages survive navigation, app restarts and sign-out. They are user-owned and
-- can only be removed explicitly by the authenticated user (or account deletion).

create table if not exists public.assistant_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  conversation_key text not null check (char_length(conversation_key) between 1 and 80),
  client_id text not null check (char_length(client_id) between 3 and 80),
  role text not null check (role in ('user','assistant')),
  content text not null check (char_length(content) between 1 and 8000),
  source_url text,
  emergency jsonb,
  created_at timestamptz not null default now(),
  unique(user_id,client_id)
);
create index if not exists assistant_messages_user_conversation_time
  on public.assistant_messages(user_id,conversation_key,created_at desc);

alter table public.assistant_messages enable row level security;
drop policy if exists "assistant history own read" on public.assistant_messages;
drop policy if exists "assistant history own delete" on public.assistant_messages;
create policy "assistant history own read" on public.assistant_messages
  for select to authenticated using(user_id=auth.uid());
create policy "assistant history own delete" on public.assistant_messages
  for delete to authenticated using(user_id=auth.uid());

revoke all on public.assistant_messages from public,anon;
grant select,delete on public.assistant_messages to authenticated;
grant all on public.assistant_messages to service_role;

-- Rolling server-side context for continuity when the full history becomes long.
-- It may include health information the user told the assistant, so it receives
-- the same ownership/deletion protections as the message history.
create table if not exists public.assistant_context_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  summary text not null default '' check (char_length(summary) <= 4000),
  updated_at timestamptz not null default now()
);
alter table public.assistant_context_state enable row level security;
drop policy if exists "assistant context own read" on public.assistant_context_state;
drop policy if exists "assistant context own delete" on public.assistant_context_state;
create policy "assistant context own read" on public.assistant_context_state
  for select to authenticated using(user_id=auth.uid());
create policy "assistant context own delete" on public.assistant_context_state
  for delete to authenticated using(user_id=auth.uid());

revoke all on public.assistant_context_state from public,anon;
grant select,delete on public.assistant_context_state to authenticated;
grant all on public.assistant_context_state to service_role;

create or replace function public.my_assistant_history(p_key text,p_limit int default 120)
returns table(
  client_id text,
  role text,
  content text,
  source_url text,
  emergency jsonb,
  created_at timestamptz
)
language sql security definer set search_path=public,pg_temp stable as $$
  select q.client_id,q.role,q.content,q.source_url,q.emergency,q.created_at
  from (
    select m.client_id,m.role,m.content,m.source_url,m.emergency,m.created_at
    from public.assistant_messages m
    where m.user_id=auth.uid()
      and m.conversation_key=left(coalesce(nullif(p_key,''),'general'),80)
    order by m.created_at desc
    limit greatest(1,least(coalesce(p_limit,120),250))
  ) q
  order by q.created_at asc
$$;
revoke all on function public.my_assistant_history(text,int) from public,anon;
grant execute on function public.my_assistant_history(text,int) to authenticated;

create or replace function public.delete_my_assistant_history() returns void
language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  delete from public.assistant_messages where user_id=auth.uid();
  delete from public.assistant_context_state where user_id=auth.uid();
  delete from public.assistant_memories where user_id=auth.uid();
end;
$$;
revoke all on function public.delete_my_assistant_history() from public,anon;
grant execute on function public.delete_my_assistant_history() to authenticated;
