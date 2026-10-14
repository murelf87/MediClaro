-- MediClaro v6 · producción: compras de tienda + IA exclusivamente Premium.
-- La verificación real la realizan iap-verify / notificaciones de Apple y Google.

-- R-24: ninguna cuenta gratuita puede reservar cuota de identificación/chat en servidor.
update public.plan_config
set monthly_scans = 0, hard_cap = 0, chat_per_day = 0, overage_enabled = false, updated_at = now()
where plan = 'free';

-- Suscripciones verificadas por Apple/Google. No hay políticas: solo service_role.
create table if not exists public.store_subscriptions (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  platform text not null check (platform in ('apple','google')),
  store_key text not null,
  product_id text not null,
  base_plan_id text,
  plan_id text,
  status text not null,
  environment text,
  expires_at timestamptz,
  auto_renew boolean,
  last_verified_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique(platform, store_key)
);
create index if not exists store_subscriptions_user_idx on public.store_subscriptions(user_id, last_verified_at desc);
alter table public.store_subscriptions enable row level security;

-- Idempotencia de notificaciones de tienda. Solo se conserva identificador/tipo, no datos de salud.
create table if not exists public.store_events (
  platform text not null check (platform in ('apple','google')),
  event_id text not null,
  event_type text,
  received_at timestamptz not null default now(),
  primary key(platform, event_id)
);
alter table public.store_events enable row level security;

-- R-12: catálogo comercial. storeVerification queda FALSE hasta que el titular haya
-- desplegado iap-verify, configurado secretos y probado Sandbox/License Testing.
insert into public.app_config(key, value) values ('plans', jsonb_build_object(
  'providerLabel', 'Apple / Google Play',
  'checkoutAcceptsPlanId', false,
  'storeVerification', false,
  'plans', jsonb_build_array(
    jsonb_build_object('id','premium_monthly','name','MediClaro Premium','period','monthly','priceCents',499,'currency','EUR','highlighted',false,'purchasable',true,
      'store',jsonb_build_object('apple',jsonb_build_object('productId','com.mediclaro.app.premium.monthly'),'google',jsonb_build_object('productId','mediclaro_premium','basePlanId','monthly'))),
    jsonb_build_object('id','premium_quarterly','name','MediClaro Premium','period','quarterly','priceCents',1299,'currency','EUR','highlighted',false,'purchasable',true,
      'store',jsonb_build_object('apple',jsonb_build_object('productId','com.mediclaro.app.premium.quarterly'),'google',jsonb_build_object('productId','mediclaro_premium','basePlanId','quarterly'))),
    jsonb_build_object('id','premium_annual','name','MediClaro Premium','period','annual','priceCents',3999,'currency','EUR','highlighted',true,'badge','Recomendado','purchasable',true,
      'store',jsonb_build_object('apple',jsonb_build_object('productId','com.mediclaro.app.premium.annual'),'google',jsonb_build_object('productId','mediclaro_premium','basePlanId','annual')))
  )
)) on conflict (key) do update set value = excluded.value, updated_at = now();
