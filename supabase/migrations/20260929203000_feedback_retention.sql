-- Feedback de producto y motivos de baja.
-- Se conserva de forma agregable incluso si el usuario elimina su cuenta (user_id -> null).
create table public.product_feedback (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users(id) on delete set null,
  kind text not null check (kind in ('suggestion','cancellation_intent','cancellation')),
  category text,
  reason_code text,
  message text,
  billing_provider text,
  locale text,
  created_at timestamptz not null default now()
);
create index product_feedback_kind_date on public.product_feedback(kind, created_at desc);
alter table public.product_feedback enable row level security;
-- Sin políticas de cliente: solo escribe/lee el backend con service role.

alter table public.profiles
  add column cancellation_feedback_pending boolean not null default false;
create or replace function public.track_cancellation_feedback_pending()
returns trigger language plpgsql as $$
begin
  if new.cancel_at_period_end = true and old.cancel_at_period_end = false then
    new.cancellation_feedback_pending := true;
  elsif old.cancel_at_period_end = true
    and new.cancel_at_period_end = false
    and new.subscription_status in ('active','trialing') then
    -- Reactivó la renovación antes de irse.
    new.cancellation_feedback_pending := false;
  end if;
  return new;
end $$;
drop trigger if exists trg_cancellation_feedback_pending on public.profiles;
create trigger trg_cancellation_feedback_pending
before update of cancel_at_period_end, subscription_status on public.profiles
for each row execute function public.track_cancellation_feedback_pending();
