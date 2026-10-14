-- ─────────────────────────────────────────────────────────────────────────────────────────────────────────
-- MediClaro · Pago con Bizum y «Que pague mi familiar o cuidador/a» (09/10/2026). LA APLICA EL PROPIETARIO:
--   npx supabase db push      (antes de desplegar create-checkout, stripe-webhook y family-pay)
--
-- 1) profiles.paid_by_family: la suscripción la paga otra persona (no se guarda quién).
-- 2) family_pay_invites: enlaces de pago para un familiar. Solo el servidor (clave de servicio) los lee y escribe;
--    del enlace se guarda únicamente su huella SHA-256.
-- 3) Bizum: Stripe NO admite cobros recurrentes con Bizum, así que se paga un periodo de una vez. El webhook deja
--    Premium hasta la fecha pagada (subscription_id 'bizum-…', sin renovación) y este cron lo devuelve a gratuito al
--    terminar. El trigger profiles_sync_sub_state (R-01) recalcula sub_state.
-- 4) get_account_status: añade payment_kind ('bizum' | 'subscription') y paid_by_family para que la app explique
--    «Pagado con Bizum hasta…» o «Lo paga un familiar» sin leer identificadores de pago.
-- Aditiva e idempotente: no cambia datos existentes.
-- ─────────────────────────────────────────────────────────────────────────────────────────────────────────

alter table public.profiles add column if not exists paid_by_family boolean not null default false;

create table if not exists public.family_pay_invites (
  id uuid primary key default gen_random_uuid(),
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  beneficiary_id uuid not null references auth.users(id) on delete cascade,
  beneficiary_name text check (beneficiary_name is null or length(beneficiary_name) <= 40),
  plan_id text not null check (length(plan_id) between 1 and 60),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  checkout_session_id text,
  paid_at timestamptz,
  revoked_at timestamptz
);
create index if not exists family_pay_invites_beneficiary_idx on public.family_pay_invites (beneficiary_id, created_at desc);
alter table public.family_pay_invites enable row level security;
-- Sin políticas: ninguna cuenta puede leer ni escribir invitaciones por la API; solo las funciones del servidor.
revoke all on public.family_pay_invites from public, anon, authenticated;

create extension if not exists pg_cron with schema pg_catalog;
do $$ begin
  if exists (select 1 from cron.job where jobname = 'mediclaro-expire-bizum-premium') then
    perform cron.unschedule('mediclaro-expire-bizum-premium');
  end if;
end $$;
select cron.schedule('mediclaro-expire-bizum-premium', '*/5 * * * *', $cron$
  update public.profiles
     set plan = 'free', subscription_status = 'canceled', cancel_at_period_end = false, updated_at = now()
   where plan = 'premium' and subscription_id like 'bizum-%' and current_period_end < now();
$cron$);

create or replace function public.get_account_status() returns jsonb
language plpgsql stable security definer set search_path=pg_catalog as $$
declare result jsonb; owner boolean:=mediclaro_private.is_owner(auth.uid());
 courtesy boolean:=mediclaro_private.has_courtesy(auth.uid());
 billing record;
begin
 result:=public.get_account_status_billing();
 if result is null then return null; end if;
 if owner or courtesy then
  result:=result || jsonb_build_object('plan','premium','state','ACTIVE');
 end if;
 if owner then
  result:=result || jsonb_build_object('period_end',null,'cancel_at_period_end',false);
 end if;
 select p.subscription_id, p.paid_by_family into billing from public.profiles p where p.id=auth.uid();
 return result || jsonb_build_object(
  'owner_access',owner,
  'courtesy_access',courtesy,
  'payment_kind',case when billing.subscription_id like 'bizum-%' then 'bizum'
                      when billing.subscription_id like 'sub_%' then 'subscription' end,
  'paid_by_family',coalesce(billing.paid_by_family,false)
 );
end;
$$;
revoke all on function public.get_account_status() from public, anon;
grant execute on function public.get_account_status() to authenticated;
