-- ─────────────────────────────────────────────────────────────────────────────
-- MediClaro · INTEGRADO R-07  — borrar el historial sin reiniciar la cuota
--
-- Problema: la política «borrar mis escaneos» (v2) deja a cada persona borrar sus filas de `scans` con la
-- clave pública. Como `get_account_status`, `can_scan` y `consume_scan` cuentan esas filas, borrarlas
-- reinicia la cuota gratuita → identificaciones (y coste de IA) ilimitados.
--
-- Solución:
--   1. Se retira la política de borrado: la API ya no permite borrar filas de `scans`.
--   2. «Borrar mi historial» pasa a ser la función `clear_scan_history()`: marca las filas como ocultas
--      (`hidden_at`) y ELIMINA su contenido (nombre y nº de registro del medicamento, confianza, método).
--      Solo se conserva lo necesario para contar la cuota: fecha y resultado (identificado / no encontrado).
--      Así el dato de salud («qué medicamento consultó») desaparece de verdad y la cuota no se reinicia.
--   3. La persona deja de ver las filas ocultas (política de lectura).
--
-- Idempotente. Pruebas: backend-patches/tests (npm test) — «R-07».
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.scans add column if not exists hidden_at timestamptz;

-- 1) Sin borrado directo desde la app.
drop policy if exists "borrar mis escaneos" on public.scans;

-- 3) Lo borrado no se ve en el historial.
drop policy if exists "leer mis escaneos" on public.scans;
create policy "leer mis escaneos" on public.scans
  for select using (auth.uid() = user_id and hidden_at is null);

-- 2) Borrar el historial (todo, o solo las filas indicadas). Devuelve cuántas filas se han borrado.
create or replace function public.clear_scan_history(p_ids bigint[] default null)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  n integer;
begin
  if me is null then
    raise exception 'Sesión no válida' using errcode = '42501';
  end if;
  update public.scans
     set hidden_at = now(), nombre = null, nregistro = null, score = null, confidence = null, method = null
   where user_id = me
     and hidden_at is null
     and (p_ids is null or id = any (p_ids));
  get diagnostics n = row_count;
  return n;
end $$;

revoke all on function public.clear_scan_history(bigint[]) from public, anon;
grant execute on function public.clear_scan_history(bigint[]) to authenticated;
