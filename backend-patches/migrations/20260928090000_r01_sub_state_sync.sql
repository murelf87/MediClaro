-- ─────────────────────────────────────────────────────────────────────────────
-- MediClaro · PROPUESTA R-01 (NO APLICADA) — el plan Premium se aplica de verdad en el servidor
--
-- Problema: `is_premium()` (migración v2) decide con `profiles.sub_state`, pero el webhook de Stripe solo
-- escribe `plan` y `subscription_status`; `sub_state` se queda en 'FREE'. Resultado: quien paga Premium
-- recibe los límites gratuitos (5 identificaciones/mes, 10 preguntas/día) y el uso extra nunca se mide.
--
-- Solución: `sub_state` pasa a ser un valor DERIVADO. Un trigger lo recalcula en cada alta o cambio de la
-- fila a partir de `plan` + `subscription_status`. Da igual qué proceso escriba el estado (el webhook de
-- Stripe hoy; una verificación de compras de Apple/Google mañana): el estado normalizado siempre coincide.
-- Los estados de pago solo cuentan si además `plan = 'premium'` (doble comprobación).
--
-- Incluye la corrección de las filas existentes. Idempotente: se puede ejecutar más de una vez.
-- Pruebas: backend-patches/tests (npm test) — «R-01».
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.profiles_sync_sub_state()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.sub_state := case
    when new.subscription_status = 'canceled' then 'CANCELLED'
    when new.subscription_status in ('unpaid', 'incomplete_expired') then 'EXPIRED'
    when new.plan = 'premium' and new.subscription_status = 'trialing' then 'TRIAL'
    when new.plan = 'premium' and new.subscription_status = 'active' then 'ACTIVE'
    when new.plan = 'premium' and new.subscription_status = 'past_due' then 'PAST_DUE'
    else 'FREE'
  end;
  return new;
end $$;

-- Es una función de trigger: nadie debe poder invocarla por la API.
revoke all on function public.profiles_sync_sub_state() from public, anon, authenticated;

drop trigger if exists profiles_sync_sub_state on public.profiles;
create trigger profiles_sync_sub_state
  before insert or update on public.profiles
  for each row execute function public.profiles_sync_sub_state();

-- Corrige las filas existentes: la actualización dispara el trigger, que recalcula `sub_state`.
update public.profiles set sub_state = sub_state;
