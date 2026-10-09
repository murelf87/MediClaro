-- Wake the authenticated internal dispatcher after enqueuing jobs, without exposing its secret.
create function public.care_wake_dispatch() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
 perform net.http_post(
  url:='https://ldonnvkysjalpmystoeq.supabase.co/functions/v1/caregiver-dispatch',
  headers:=jsonb_build_object('Content-Type','application/json','x-care-key',(select decrypted_secret from vault.decrypted_secrets where name='mediclaro_care_worker')),
  body:='{}'::jsonb,timeout_milliseconds:=15000);
 return null;
end;
$$;
revoke all on function public.care_wake_dispatch() from public,anon,authenticated;
create trigger care_dispatch_on_jobs after insert on public.care_push_jobs for each statement execute function public.care_wake_dispatch();
