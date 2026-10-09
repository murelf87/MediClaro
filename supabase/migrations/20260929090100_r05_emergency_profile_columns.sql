-- ─────────────────────────────────────────────────────────────────────────────
-- MediClaro · INTEGRADO R-05  — columnas que faltan en `emergency_profiles`
--
-- Problema: la migración v3 crea `emergency_profiles` sin `phone`, `additional_info` ni `created_at`; la v4
-- usa `CREATE TABLE IF NOT EXISTS` (no hace nada porque la tabla ya existe) y sus `ALTER` no las añaden.
-- Si la app enviara esos campos, el guardado fallaría (42703 / PGRST204). Tampoco hay sitio para el
-- servicio privado de asistencia de cada persona ni para su médico: hoy la app los guarda solo en el
-- teléfono (cifrados) y se pierden al cambiar de móvil.
--
-- Solución: añadir las columnas. Las políticas RLS existentes (solo la persona dueña lee y escribe su fila)
-- cubren automáticamente las columnas nuevas. Son datos de salud (art. 9 RGPD): no se crean vistas,
-- índices ni copias adicionales.
--
-- Tras aplicarla, la app necesita un cambio pequeño para usar las columnas nuevas (ver README, «R-05»).
-- Idempotente. Pruebas: backend-patches/tests (npm test) — «R-05».
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.emergency_profiles
  add column if not exists phone                    text        not null default '',
  add column if not exists additional_info          text        not null default '',
  add column if not exists created_at               timestamptz not null default now(),
  add column if not exists private_assistance_name  text        not null default '',
  add column if not exists private_assistance_phone text        not null default '',
  add column if not exists primary_doctor_name      text        not null default '',
  add column if not exists primary_doctor_phone     text        not null default '';

comment on column public.emergency_profiles.phone                    is 'Teléfono de la persona. DATO DECLARADO POR EL USUARIO.';
comment on column public.emergency_profiles.additional_info          is 'Información adicional para emergencias. DATO DECLARADO POR EL USUARIO.';
comment on column public.emergency_profiles.private_assistance_name  is 'Servicio privado de asistencia de ESTA persona (independiente del 112).';
comment on column public.emergency_profiles.private_assistance_phone is 'Teléfono del servicio privado de asistencia de esta persona. El 112 nunca se llama automáticamente.';
comment on column public.emergency_profiles.primary_doctor_name      is 'Médico de cabecera. DATO DECLARADO POR EL USUARIO.';
comment on column public.emergency_profiles.primary_doctor_phone     is 'Teléfono del centro de salud o del médico. DATO DECLARADO POR EL USUARIO.';
