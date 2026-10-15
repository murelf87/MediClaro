-- Tabla para almacenar ubicación en tiempo real de pacientes
CREATE TABLE IF NOT EXISTS care_patient_locations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  latitude DECIMAL(10, 8) NOT NULL,
  longitude DECIMAL(11, 8) NOT NULL,
  accuracy FLOAT,
  altitude FLOAT,
  heading FLOAT,
  speed FLOAT,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE
);

-- Índice para búsquedas por usuario (más frecuente)
CREATE INDEX idx_patient_locations_user_id ON care_patient_locations(user_id);
CREATE INDEX idx_patient_locations_updated_at ON care_patient_locations(updated_at DESC);

-- Habilitar RealtimeDB en la tabla para suscripciones en tiempo real
ALTER TABLE care_patient_locations ENABLE ROW LEVEL SECURITY;

-- RLS: Los usuarios pueden ver su propia ubicación y la de sus pacientes/cuidadores vinculados
CREATE POLICY "Users can view their own location" ON care_patient_locations
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Caregivers can view linked patient location" ON care_patient_locations
  FOR SELECT
  USING (
    user_id IN (
      SELECT patient_id FROM care_links
      WHERE caregiver_id = auth.uid()
        AND accepted_at IS NOT NULL
        AND revoked_at IS NULL
        AND (expires_at IS NULL OR expires_at > NOW())
    )
  );

CREATE POLICY "Patients can view linked caregiver location during calls" ON care_patient_locations
  FOR SELECT
  USING (
    user_id IN (
      SELECT caregiver_id FROM care_links
      WHERE patient_id = auth.uid()
        AND accepted_at IS NOT NULL
        AND revoked_at IS NULL
        AND (expires_at IS NULL OR expires_at > NOW())
    )
  );

-- Permitir que los usuarios actualicen su propia ubicación
CREATE POLICY "Users can update their own location" ON care_patient_locations
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own location (update)" ON care_patient_locations
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Función para actualizar la ubicación (UPSERT)
CREATE OR REPLACE FUNCTION update_patient_location(
  p_latitude DECIMAL,
  p_longitude DECIMAL,
  p_accuracy FLOAT DEFAULT NULL,
  p_altitude FLOAT DEFAULT NULL,
  p_heading FLOAT DEFAULT NULL,
  p_speed FLOAT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_location_id UUID;
BEGIN
  -- Intentar actualizar si existe
  UPDATE care_patient_locations
  SET
    latitude = p_latitude,
    longitude = p_longitude,
    accuracy = p_accuracy,
    altitude = p_altitude,
    heading = p_heading,
    speed = p_speed,
    updated_at = NOW()
  WHERE user_id = auth.uid()
  RETURNING id INTO v_location_id;

  -- Si no existe, insertar
  IF v_location_id IS NULL THEN
    INSERT INTO care_patient_locations (
      user_id, latitude, longitude, accuracy, altitude, heading, speed, updated_at
    )
    VALUES (
      auth.uid(), p_latitude, p_longitude, p_accuracy, p_altitude, p_heading, p_speed, NOW()
    )
    RETURNING id INTO v_location_id;
  END IF;

  RETURN v_location_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Función para obtener la ubicación más reciente de un usuario
CREATE OR REPLACE FUNCTION get_latest_user_location(p_user_id UUID)
RETURNS TABLE (
  latitude DECIMAL,
  longitude DECIMAL,
  accuracy FLOAT,
  altitude FLOAT,
  heading FLOAT,
  speed FLOAT,
  updated_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    cl.latitude,
    cl.longitude,
    cl.accuracy,
    cl.altitude,
    cl.heading,
    cl.speed,
    cl.updated_at
  FROM care_patient_locations cl
  WHERE cl.user_id = p_user_id
  ORDER BY cl.updated_at DESC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- Tabla para controlar compartición de ubicación durante llamadas
CREATE TABLE IF NOT EXISTS care_call_location_sharing (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  call_id UUID NOT NULL REFERENCES care_calls(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sharing_enabled BOOLEAN DEFAULT true,
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  ended_at TIMESTAMP WITH TIME ZONE,
  UNIQUE(call_id, user_id)
);

ALTER TABLE care_call_location_sharing ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view location sharing in their calls" ON care_call_location_sharing
  FOR SELECT
  USING (
    user_id = auth.uid() OR
    call_id IN (
      SELECT id FROM care_calls
      WHERE caller_id = auth.uid() OR recipient_id = auth.uid()
    )
  );

CREATE POLICY "Users can manage their own location sharing" ON care_call_location_sharing
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own location sharing" ON care_call_location_sharing
  FOR UPDATE
  USING (user_id = auth.uid());
