-- MediClaro Premium: identificaciones ILIMITADAS mientras dure la suscripción (decisión del propietario, 08/10/2026).
-- Sin pago por uso: con overage_enabled = false, consume_scan nunca marca una identificación como adicional
-- y la función identify-medicine no envía ningún evento de medición a Stripe.
-- 1.000.000 al mes es, en la práctica, sin límite; la app lo muestra como «Ilimitadas» (UNLIMITED_SCANS_FROM).
-- Solo cambia datos de configuración: no toca tablas, funciones, permisos ni RLS.
update public.plan_config
set monthly_scans = 1000000,
    hard_cap = 1000000,
    overage_enabled = false,
    updated_at = now()
where plan = 'premium';
