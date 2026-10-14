-- Tabla de chat entre cuidador y paciente
CREATE TABLE IF NOT EXISTS care_chat_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  link_id UUID NOT NULL REFERENCES care_links(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  location_latitude DECIMAL(10, 8),
  location_longitude DECIMAL(11, 8),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_chat_messages_link ON care_chat_messages(link_id);
CREATE INDEX idx_chat_messages_created ON care_chat_messages(created_at DESC);

-- Estado de usuarios (para ver si están en línea)
CREATE TABLE IF NOT EXISTS care_user_online_status (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  is_online BOOLEAN DEFAULT false,
  last_seen_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLS para chat
ALTER TABLE care_chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read messages from their linked relationships" ON care_chat_messages
  FOR SELECT
  USING (
    auth.uid() IN (
      SELECT patient_id FROM care_links WHERE id = link_id
      UNION
      SELECT caregiver_id FROM care_links WHERE id = link_id
    )
  );

CREATE POLICY "Users can insert messages in their linked relationships" ON care_chat_messages
  FOR INSERT
  WITH CHECK (
    auth.uid() = sender_id AND
    auth.uid() IN (
      SELECT patient_id FROM care_links WHERE id = link_id
      UNION
      SELECT caregiver_id FROM care_links WHERE id = link_id
    )
  );

-- RLS para estado en línea
ALTER TABLE care_user_online_status ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view online status of linked users" ON care_user_online_status
  FOR SELECT
  USING (
    user_id = auth.uid() OR
    user_id IN (
      SELECT patient_id FROM care_links WHERE caregiver_id = auth.uid()
      UNION
      SELECT caregiver_id FROM care_links WHERE patient_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their own online status" ON care_user_online_status
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own online status (update)" ON care_user_online_status
  FOR UPDATE
  USING (user_id = auth.uid());

-- Función para actualizar estado en línea
CREATE OR REPLACE FUNCTION update_user_online_status(p_is_online BOOLEAN)
RETURNS BOOLEAN AS $$
BEGIN
  INSERT INTO care_user_online_status (user_id, is_online, last_seen_at, updated_at)
  VALUES (auth.uid(), p_is_online, NOW(), NOW())
  ON CONFLICT(user_id) DO UPDATE SET
    is_online = p_is_online,
    last_seen_at = NOW(),
    updated_at = NOW();

  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Función para obtener estado en línea
CREATE OR REPLACE FUNCTION get_user_online_status(p_user_id UUID)
RETURNS TABLE (
  is_online BOOLEAN,
  last_seen_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    cos.is_online,
    cos.last_seen_at
  FROM care_user_online_status cos
  WHERE cos.user_id = p_user_id;
END;
$$ LANGUAGE plpgsql;
