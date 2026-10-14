/**
 * Actualiza la ubicación del usuario actual en la BD.
 * Se llama cada 5 segundos durante una llamada VoIP.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

interface LocationPayload {
  latitude: number;
  longitude: number;
  accuracy?: number;
  altitude?: number;
  heading?: number;
  speed?: number;
}

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const payload: LocationPayload = await req.json();

    // Obtener usuario autenticado del header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401 }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Obtener usuario actual
    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace("Bearer ", "")
    );

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401 }
      );
    }

    // UPSERT ubicación (actualizar si existe, insertar si no)
    const { data, error } = await supabase
      .from("care_patient_locations")
      .upsert(
        {
          user_id: user.id,
          latitude: payload.latitude,
          longitude: payload.longitude,
          accuracy: payload.accuracy,
          altitude: payload.altitude,
          heading: payload.heading,
          speed: payload.speed,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" }
      );

    if (error) {
      console.error("Error updating location:", error);
      return new Response(
        JSON.stringify({ error: "Failed to update location" }),
        { status: 500 }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        locationId: data?.[0]?.id,
      }),
      { status: 200 }
    );
  } catch (error) {
    console.error("Update location error:", error);
    return new Response(
      JSON.stringify({ error: String(error) }),
      { status: 500 }
    );
  }
});
