-- ─────────────────────────────────────────────────────────────────────────────
-- MediClaro — v5: app_config table
--
-- Propósito: almacenamiento de configuración de la aplicación modificable
-- desde el dashboard del propietario sin recompilar la app.
--
-- Uso principal: configuración del módulo de emergencia (primaryAssistanceNumber,
-- primaryAssistanceName, countryEmergencyNumber, regionOverrides).
--
-- SEGURIDAD:
-- - SELECT público (la app lee sin autenticar) — los valores son no-sensibles.
-- - INSERT/UPDATE/DELETE solo para service_role (owner dashboard).
--
-- ─────────────────────────────────────────────────────────────────────────────

-- ─── Tabla principal ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.app_config (
  key         TEXT        PRIMARY KEY,          -- Clave única de configuración (ej: 'emergency')
  value       JSONB       NOT NULL,             -- Valor en JSON sin tipado rígido — flexible
  description TEXT,                             -- Texto explicativo para el dashboard
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.app_config IS
  'Configuración global de la aplicación modificable en caliente desde el dashboard. '
  'Solo service_role puede escribir. Los clientes solo leen.';

COMMENT ON COLUMN public.app_config.key   IS 'Clave única. Ej: ''emergency'', ''features'', ''limits''.';
COMMENT ON COLUMN public.app_config.value IS 'Valor JSONB libre. Documentado por ''description''.';

-- ─── Trigger: updated_at automático ──────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.app_config_set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_app_config_updated_at ON public.app_config;

CREATE TRIGGER trg_app_config_updated_at
  BEFORE UPDATE ON public.app_config
  FOR EACH ROW
  EXECUTE FUNCTION public.app_config_set_updated_at();

-- ─── Row Level Security ───────────────────────────────────────────────────────

ALTER TABLE public.app_config ENABLE ROW LEVEL SECURITY;

-- Los clientes (anon / authenticated) pueden LEER cualquier fila
-- (la configuración no contiene datos sensibles de usuario)
CREATE POLICY "app_config_public_read"
  ON public.app_config
  FOR SELECT
  USING (true);

-- Solo service_role puede insertar / actualizar / eliminar
-- (No se necesita política explícita: service_role bypasea RLS por diseño de Supabase)

-- ─── Datos iniciales ──────────────────────────────────────────────────────────
--
-- NOTA: primaryAssistanceNumber está vacío intencionalmente.
-- El propietario de MediClaro lo establece desde el dashboard antes del
-- despliegue en producción.
--
-- regionOverrides permite sobrescribir por país / región en el futuro:
-- "PT" → Portugal, "FR" → France, etc.
-- El campo está vacío ahora pero EmergencyConfigService ya lo soporta.

INSERT INTO public.app_config (key, value, description)
VALUES (
  'emergency',
  jsonb_build_object(
    'primaryAssistanceName',   'Central MediClaro',
    'primaryAssistanceNumber', '',
    'countryEmergencyNumber',  '112',
    'regionOverrides',         '{}'::jsonb
  ),
  'Configuración del módulo de emergencia. '
  'primaryAssistanceNumber: número al que llama el botón principal (vacío = sin configurar). '
  'countryEmergencyNumber: número oficial de emergencias del país (NUNCA vacío). '
  'regionOverrides: sobrescrituras por código de país ISO-3166-1 alfa-2.'
)
ON CONFLICT (key) DO NOTHING;   -- No sobreescribir si ya existe (evita perder config de producción)

-- ─── Índice auxiliar (búsqueda futura por tipo de config) ────────────────────

CREATE INDEX IF NOT EXISTS idx_app_config_key ON public.app_config (key);

-- ─────────────────────────────────────────────────────────────────────────────
-- Verificación rápida (comentada para producción)
-- SELECT key, value, description, updated_at FROM public.app_config WHERE key = 'emergency';
-- ─────────────────────────────────────────────────────────────────────────────
