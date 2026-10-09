-- ─────────────────────────────────────────────────────────────────────────────
-- MediClaro v4 — Tabla emergency_profiles completa
--
-- PRINCIPIO DE PRIVACIDAD:
-- - Todos los campos médicos son DECLARADOS por el usuario.
-- - RLS garantiza que solo el propietario accede a sus datos.
-- - Los campos de consentimiento controlan qué se comparte durante emergencias.
-- ─────────────────────────────────────────────────────────────────────────────

-- Crear tabla (o alterar si existe de versiones anteriores)
CREATE TABLE IF NOT EXISTS emergency_profiles (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Identidad
  full_name    TEXT NOT NULL DEFAULT '',
  date_of_birth DATE,                        -- NULL si no declarada
  phone        TEXT NOT NULL DEFAULT '',

  -- Dirección declarada
  address      TEXT NOT NULL DEFAULT '',
  postal_code  TEXT NOT NULL DEFAULT '',
  city         TEXT NOT NULL DEFAULT '',
  province     TEXT NOT NULL DEFAULT '',
  country      TEXT NOT NULL DEFAULT 'España',

  -- Datos médicos — SOLO DECLARADOS POR EL USUARIO, nunca inferidos
  blood_type          TEXT NOT NULL DEFAULT '',
  allergies           TEXT NOT NULL DEFAULT '',
  medical_conditions  TEXT NOT NULL DEFAULT '',
  current_medications TEXT NOT NULL DEFAULT '',
  additional_info     TEXT NOT NULL DEFAULT '',

  -- Contacto de emergencia
  emergency_contact_name          TEXT NOT NULL DEFAULT '',
  emergency_contact_relationship  TEXT NOT NULL DEFAULT '',
  emergency_contact_phone         TEXT NOT NULL DEFAULT '',

  -- Preferencias
  language          TEXT NOT NULL DEFAULT 'es-ES',
  voice_preference  TEXT NOT NULL DEFAULT 'female',

  -- Consentimientos granulares (todos activados por defecto)
  consent_share_location    BOOLEAN NOT NULL DEFAULT true,
  consent_share_address     BOOLEAN NOT NULL DEFAULT true,
  consent_share_medications BOOLEAN NOT NULL DEFAULT true,
  consent_share_allergies   BOOLEAN NOT NULL DEFAULT true,
  consent_share_medical_info BOOLEAN NOT NULL DEFAULT true,
  consent_share_conversation BOOLEAN NOT NULL DEFAULT true,
  consent_notify_contact    BOOLEAN NOT NULL DEFAULT true,

  -- Único por usuario
  UNIQUE (user_id)
);

-- Añadir columnas que podrían faltar en versiones anteriores de la tabla
DO $$
BEGIN
  -- date_of_birth puede no existir en v3
  BEGIN ALTER TABLE emergency_profiles ADD COLUMN date_of_birth DATE; EXCEPTION WHEN duplicate_column THEN NULL; END;
  BEGIN ALTER TABLE emergency_profiles ADD COLUMN province TEXT NOT NULL DEFAULT ''; EXCEPTION WHEN duplicate_column THEN NULL; END;
  BEGIN ALTER TABLE emergency_profiles ADD COLUMN country TEXT NOT NULL DEFAULT 'España'; EXCEPTION WHEN duplicate_column THEN NULL; END;
  BEGIN ALTER TABLE emergency_profiles ADD COLUMN emergency_contact_relationship TEXT NOT NULL DEFAULT ''; EXCEPTION WHEN duplicate_column THEN NULL; END;
  BEGIN ALTER TABLE emergency_profiles ADD COLUMN language TEXT NOT NULL DEFAULT 'es-ES'; EXCEPTION WHEN duplicate_column THEN NULL; END;
  BEGIN ALTER TABLE emergency_profiles ADD COLUMN voice_preference TEXT NOT NULL DEFAULT 'female'; EXCEPTION WHEN duplicate_column THEN NULL; END;
  BEGIN ALTER TABLE emergency_profiles ADD COLUMN consent_share_location BOOLEAN NOT NULL DEFAULT true; EXCEPTION WHEN duplicate_column THEN NULL; END;
  BEGIN ALTER TABLE emergency_profiles ADD COLUMN consent_share_address BOOLEAN NOT NULL DEFAULT true; EXCEPTION WHEN duplicate_column THEN NULL; END;
  BEGIN ALTER TABLE emergency_profiles ADD COLUMN consent_share_medications BOOLEAN NOT NULL DEFAULT true; EXCEPTION WHEN duplicate_column THEN NULL; END;
  BEGIN ALTER TABLE emergency_profiles ADD COLUMN consent_share_allergies BOOLEAN NOT NULL DEFAULT true; EXCEPTION WHEN duplicate_column THEN NULL; END;
  BEGIN ALTER TABLE emergency_profiles ADD COLUMN consent_share_medical_info BOOLEAN NOT NULL DEFAULT true; EXCEPTION WHEN duplicate_column THEN NULL; END;
  BEGIN ALTER TABLE emergency_profiles ADD COLUMN consent_share_conversation BOOLEAN NOT NULL DEFAULT true; EXCEPTION WHEN duplicate_column THEN NULL; END;
  BEGIN ALTER TABLE emergency_profiles ADD COLUMN consent_notify_contact BOOLEAN NOT NULL DEFAULT true; EXCEPTION WHEN duplicate_column THEN NULL; END;
END $$;

-- ── Row Level Security ────────────────────────────────────────────────────────

ALTER TABLE emergency_profiles ENABLE ROW LEVEL SECURITY;

-- Eliminar políticas anteriores si existen
DROP POLICY IF EXISTS "emergency_profiles_owner_select" ON emergency_profiles;
DROP POLICY IF EXISTS "emergency_profiles_owner_insert" ON emergency_profiles;
DROP POLICY IF EXISTS "emergency_profiles_owner_update" ON emergency_profiles;
DROP POLICY IF EXISTS "emergency_profiles_owner_delete" ON emergency_profiles;

-- Solo el propio usuario puede leer, crear, actualizar y borrar su perfil
CREATE POLICY "emergency_profiles_owner_select"
  ON emergency_profiles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "emergency_profiles_owner_insert"
  ON emergency_profiles FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "emergency_profiles_owner_update"
  ON emergency_profiles FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "emergency_profiles_owner_delete"
  ON emergency_profiles FOR DELETE
  USING (auth.uid() = user_id);

-- ── Índices ───────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_emergency_profiles_user_id ON emergency_profiles (user_id);

-- ── Trigger updated_at ────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_emergency_profiles_updated_at ON emergency_profiles;

CREATE TRIGGER trg_emergency_profiles_updated_at
  BEFORE UPDATE ON emergency_profiles
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── Comentarios de columnas (documentación en BD) ─────────────────────────────

COMMENT ON TABLE  emergency_profiles IS 'Perfil de emergencia configurado voluntariamente por el usuario. Todos los datos médicos son DECLARADOS por el usuario, nunca inferidos.';
COMMENT ON COLUMN emergency_profiles.blood_type          IS 'DATO DECLARADO POR EL USUARIO. Nunca inferido.';
COMMENT ON COLUMN emergency_profiles.allergies           IS 'DATO DECLARADO POR EL USUARIO. Nunca inferido.';
COMMENT ON COLUMN emergency_profiles.medical_conditions  IS 'DATO DECLARADO POR EL USUARIO. Nunca inferido.';
COMMENT ON COLUMN emergency_profiles.current_medications IS 'DATO DECLARADO POR EL USUARIO. Nunca inferido.';
COMMENT ON COLUMN emergency_profiles.consent_share_location    IS 'Consentimiento para compartir ubicación GPS durante emergencia.';
COMMENT ON COLUMN emergency_profiles.consent_share_address     IS 'Consentimiento para compartir dirección declarada durante emergencia.';
COMMENT ON COLUMN emergency_profiles.consent_share_medications IS 'Consentimiento para compartir medicamentos durante emergencia.';
COMMENT ON COLUMN emergency_profiles.consent_share_allergies   IS 'Consentimiento para compartir alergias durante emergencia.';
COMMENT ON COLUMN emergency_profiles.consent_share_medical_info IS 'Consentimiento para compartir condiciones médicas durante emergencia.';
COMMENT ON COLUMN emergency_profiles.consent_share_conversation IS 'Consentimiento para compartir los últimos 10 min de conversación.';
COMMENT ON COLUMN emergency_profiles.consent_notify_contact    IS 'Consentimiento para enviar SMS al contacto de emergencia.';
