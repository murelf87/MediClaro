-- MediClaro v3: tabla de medicamentos guardados (app) y perfiles de emergencia

-- 1) Medicamentos guardados por el usuario desde la pantalla de resultado
-- (Nota: el esquema 'saved_medications' de v2 tiene columnas diferentes — esta tabla
--  usa los campos que lee la app: name, active_ingredient, form, scan_data, saved_at)
create table if not exists public.saved_medicines (
  id          bigint generated always as identity primary key,
  user_id     uuid not null references auth.users(id) on delete cascade,
  nregistro   text not null,
  name        text not null,
  active_ingredient text,
  form        text,
  scan_data   jsonb,
  saved_at    timestamptz not null default now(),
  unique (user_id, nregistro)
);
alter table public.saved_medicines enable row level security;
create policy "mis meds guardados: leer"  on public.saved_medicines for select using (auth.uid() = user_id);
create policy "mis meds guardados: crear" on public.saved_medicines for insert with check (auth.uid() = user_id);
create policy "mis meds guardados: borrar" on public.saved_medicines for delete using (auth.uid() = user_id);

-- Índice para búsqueda rápida por usuario
create index saved_medicines_user on public.saved_medicines (user_id, saved_at desc);


-- 2) Perfil de emergencia (datos médicos del paciente para el 112)
create table if not exists public.emergency_profiles (
  id                      bigint generated always as identity primary key,
  user_id                 uuid not null references auth.users(id) on delete cascade unique,
  full_name               text,
  address                 text,
  postal_code             text,
  city                    text,
  blood_type              text,
  allergies               text,
  medical_conditions      text,
  current_medications     text,
  emergency_contact_name  text,
  emergency_contact_phone text,
  updated_at              timestamptz not null default now()
);
alter table public.emergency_profiles enable row level security;
create policy "mi perfil emergencia: leer"   on public.emergency_profiles for select  using (auth.uid() = user_id);
create policy "mi perfil emergencia: crear"  on public.emergency_profiles for insert  with check (auth.uid() = user_id);
create policy "mi perfil emergencia: editar" on public.emergency_profiles for update  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "mi perfil emergencia: borrar" on public.emergency_profiles for delete  using (auth.uid() = user_id);

-- trigger para updated_at automático
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end $$;

create trigger emergency_profiles_updated_at
  before update on public.emergency_profiles
  for each row execute function public.set_updated_at();


-- 3) Aseguramos las columnas de accesibilidad que la app lee de profiles
--    (ya añadidas en v2; este bloque es idempotente por si alguien aplica v3 sin v2)
do $$ begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles' and column_name = 'font_size'
  ) then
    alter table public.profiles add column font_size text not null default 'grande'
      check (font_size in ('normal','grande','muy_grande'));
  end if;
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles' and column_name = 'easy_mode'
  ) then
    alter table public.profiles add column easy_mode boolean not null default false;
  end if;
end $$;


-- 4) Rate-limit bucket para emergency-assess (muy conservador: max 5/min)
--    El handler de common.ts llama a rpc hit_rate_limit — nos aseguramos de que
--    el bucket 'emergency_assess' exista en la tabla si usamos esa función.
--    (Si hit_rate_limit no usa tabla devolverá false; el Edge Function tiene su propio contador.)
