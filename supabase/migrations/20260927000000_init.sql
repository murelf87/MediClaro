-- MediClaro · esquema inicial
-- Principio: el cliente SOLO puede leer sus datos. Toda escritura sensible
-- (plan, contadores, Stripe) la hacen las Edge Functions con service_role.

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  stripe_customer_id text unique,
  plan text not null default 'free' check (plan in ('free','premium')),
  subscription_id text,
  subscription_status text,
  current_period_start timestamptz,
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.scans (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  nregistro text,
  nombre text,
  confidence text,
  billed_overage boolean not null default false,
  created_at timestamptz not null default now()
);
create index scans_user_date on public.scans (user_id, created_at desc);

-- Idempotencia de webhooks de Stripe (evita procesar dos veces un evento)
create table public.stripe_events (
  id text primary key,
  type text not null,
  received_at timestamptz not null default now()
);

-- Límite de peticiones por usuario (anti-abuso del chat y la IA)
create table public.rate_limits (
  user_id uuid not null,
  bucket text not null,
  window_start timestamptz not null,
  count int not null default 0,
  primary key (user_id, bucket, window_start)
);

alter table public.profiles enable row level security;
alter table public.scans enable row level security;
alter table public.stripe_events enable row level security;
alter table public.rate_limits enable row level security;

create policy "leer mi perfil" on public.profiles for select using (auth.uid() = id);
create policy "leer mis escaneos" on public.scans for select using (auth.uid() = user_id);
-- stripe_events y rate_limits: sin políticas => inaccesibles desde el cliente.

-- Perfil automático al registrarse
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id) values (new.id) on conflict do nothing;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Parámetros del plan (cámbielos aquí y en la pantalla de suscripción)
create function public.plan_limits() returns jsonb language sql immutable as $$
  select jsonb_build_object('free_scans', 5, 'included_scans', 100)
$$;

create function public.period_start_for(p public.profiles) returns timestamptz
language sql stable as $$
  select case when p.plan = 'premium' and p.current_period_start is not null
              then p.current_period_start
              else date_trunc('month', now()) end
$$;

-- Estado de cuenta para la app (solo lectura, del propio usuario)
create function public.get_account_status() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare p public.profiles; n int; lim jsonb := public.plan_limits();
begin
  select * into p from public.profiles where id = auth.uid();
  if not found then return null; end if;
  select count(*) into n from public.scans where user_id = p.id and created_at >= public.period_start_for(p);
  return jsonb_build_object(
    'plan', p.plan,
    'status', p.subscription_status,
    'scans_this_period', n,
    'included_scans', (lim->>'included_scans')::int,
    'free_scans_left', greatest(0, (lim->>'free_scans')::int - n)
  );
end $$;
revoke all on function public.get_account_status() from public, anon;
grant execute on function public.get_account_status() to authenticated;

-- Reserva atómica de un escaneo. La llama SOLO el backend (service_role).
-- Bloquea la fila del perfil para evitar condiciones de carrera.
create function public.consume_scan(p_user uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare p public.profiles; n int; lim jsonb := public.plan_limits(); overage boolean := false; sid bigint;
begin
  select * into p from public.profiles where id = p_user for update;
  if not found then raise exception 'perfil no encontrado'; end if;
  select count(*) into n from public.scans where user_id = p_user and created_at >= public.period_start_for(p);

  if p.plan = 'free' or p.subscription_status not in ('active','trialing') then
    if n >= (lim->>'free_scans')::int then
      return jsonb_build_object('allowed', false);
    end if;
  elsif n >= (lim->>'included_scans')::int then
    overage := true;  -- se cobra por uso vía Stripe Meter
  end if;

  insert into public.scans (user_id, billed_overage) values (p_user, overage) returning id into sid;
  return jsonb_build_object('allowed', true, 'scan_id', sid, 'overage', overage,
                            'stripe_customer_id', p.stripe_customer_id);
end $$;
revoke all on function public.consume_scan(uuid) from public, anon, authenticated;

-- Contador de límite de peticiones (ventana de 1 minuto)
create function public.hit_rate_limit(p_user uuid, p_bucket text, p_max int) returns boolean
language plpgsql security definer set search_path = public as $$
declare c int;
begin
  insert into public.rate_limits (user_id, bucket, window_start, count)
  values (p_user, p_bucket, date_trunc('minute', now()), 1)
  on conflict (user_id, bucket, window_start) do update set count = rate_limits.count + 1
  returning count into c;
  delete from public.rate_limits where window_start < now() - interval '1 hour';
  return c <= p_max;
end $$;
revoke all on function public.hit_rate_limit(uuid, text, int) from public, anon, authenticated;
