-- Copia local del catálogo de medicamentos de CIMA (AEMPS), solo para cuando CIMA no responde.
-- Contiene únicamente datos públicos de medicamentos: ningún dato personal. Solo la lee el backend.
-- Los prospectos NO se copian aquí: se siguen pidiendo a CIMA y guardando en med_cache.

create table if not exists public.med_catalog (
  nregistro text primary key,
  nombre_norm text not null,            -- nombre sin tildes, en minúsculas, para buscar
  principios_norm text not null default '',
  cns text[] not null default '{}',     -- códigos nacionales (CN) de sus presentaciones
  comerc boolean not null default true,
  data jsonb not null,                  -- MedicationSummary tal como lo devuelve el proveedor
  synced_at timestamptz not null default now()
);
create index if not exists med_catalog_cns on public.med_catalog using gin (cns);
create index if not exists med_catalog_synced on public.med_catalog (synced_at);
alter table public.med_catalog enable row level security; -- solo backend (service role)

-- Estado de la sincronización: una sola fila. Permite reanudar si una pasada se corta.
create table if not exists public.med_catalog_sync (
  id int primary key default 1 check (id = 1),
  next_page int not null default 1,
  total_rows int,
  started_at timestamptz,
  finished_at timestamptz,
  last_error text,
  updated_at timestamptz not null default now()
);
insert into public.med_catalog_sync (id) values (1) on conflict (id) do nothing;
alter table public.med_catalog_sync enable row level security; -- solo backend
