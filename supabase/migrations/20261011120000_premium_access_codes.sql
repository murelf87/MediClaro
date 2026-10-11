-- «Ya soy Premium»: código MediClaro personal para entrar en otro móvil sin SMS (11/10/2026).
-- Solo se guarda la huella (SHA-256) del código, nunca el código. Solo el servidor (service_role) accede.
create table if not exists public.premium_access_codes (
  user_id uuid primary key references auth.users(id) on delete cascade,
  code_hash text not null unique,
  created_at timestamptz not null default now(),
  last_used_at timestamptz
);
alter table public.premium_access_codes enable row level security;
revoke all on public.premium_access_codes from public, anon, authenticated;
grant select, insert, update, delete on public.premium_access_codes to service_role;

-- Límite de intentos por origen (IP) para entrar con código: ventanas de 15 minutos.
create table if not exists public.access_code_attempts (
  key text not null,
  window_start timestamptz not null,
  count int not null default 0,
  primary key (key, window_start)
);
alter table public.access_code_attempts enable row level security;
revoke all on public.access_code_attempts from public, anon, authenticated;
grant select, insert, update, delete on public.access_code_attempts to service_role;

create or replace function public.hit_access_code_limit(p_key text, p_max int) returns boolean
language plpgsql security definer set search_path = public as $$
declare c int;
begin
  insert into public.access_code_attempts (key, window_start, count)
  values (p_key, to_timestamp(floor(extract(epoch from now()) / 900) * 900), 1)
  on conflict (key, window_start) do update set count = access_code_attempts.count + 1
  returning count into c;
  delete from public.access_code_attempts where window_start < now() - interval '1 day';
  return c <= p_max;
end $$;
revoke all on function public.hit_access_code_limit(text, int) from public, anon, authenticated;
grant execute on function public.hit_access_code_limit(text, int) to service_role;
