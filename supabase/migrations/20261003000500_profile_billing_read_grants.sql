-- Client subscription lookup needs these columns; RLS still limits rows to auth.uid().
-- Never grant billing updates, administrator flags or payment identifiers.
grant select (id, created_at, plan, subscription_status, current_period_end,
 billing_provider, cancel_at_period_end) on public.profiles to authenticated;
