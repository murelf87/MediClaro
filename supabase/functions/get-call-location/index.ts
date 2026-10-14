/**
 * Obtiene la ubicación en tiempo real del usuario vinculado durante una llamada.
 * Se usa en la pantalla de llamada para mostrar el mapa.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

interface LocationResponse {
  latitude: number;
  longitude: number;
  accuracy?: number;
  altitude?: number;
  heading?: number;
  speed?: number;
  updated_at: string;
  user_id: string;
  user_name?: string;
}

serve(async (req) => {
  if (req.method !== "GET") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const url = new URL(req.url);
    const callId = url.searchParams.get("callId");

    if (!callId) {
      return new Response(
        JSON.stringify({ error: "callId is required" }),
        { status: 400 }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Obtener información de la llamada
    const { data: call, error: callError } = await supabase
      .from("care_calls")
      .select("*")
      .eq("id", callId)
      .single();

    if (callError || !call) {
      return new Response(
        JSON.stringify({ error: "Call not found" }),
        { status: 404 }
      );
    }

    // Obtener la ubicación más reciente del otro usuario en la llamada
    // (si eres el caller, obtén la ubicación del receiver, y viceversa)
    const { data: locations, error: locError } = await supabase
      .from("care_patient_locations")
      .select("*, user_id")
      .eq("user_id", call.receiver_id) // Obtener ubicación del receptor
      .order("updated_at", { ascending: false })
      .limit(1);

    if (locError) {
      console.error("Error fetching location:", locError);
      return new Response(
        JSON.stringify({ error: "Failed to fetch location" }),
        { status: 500 }
      );
    }

    if (!locations || locations.length === 0) {
      return new Response(
        JSON.stringify({
          error: "Location not available",
          message: "El otro usuario no ha compartido su ubicación aún",
        }),
        { status: 404 }
      );
    }

    const location = locations[0];

    // Obtener nombre del usuario (opcional)
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", location.user_id)
      .single();

    const response: LocationResponse = {
      latitude: location.latitude,
      longitude: location.longitude,
      accuracy: location.accuracy,
      altitude: location.altitude,
      heading: location.heading,
      speed: location.speed,
      updated_at: location.updated_at,
      user_id: location.user_id,
      user_name: profile?.full_name,
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Get call location error:", error);
    return new Response(
      JSON.stringify({ error: String(error) }),
      { status: 500 }
    );
  }
});
