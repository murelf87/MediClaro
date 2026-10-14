/**
 * Obtiene la ubicación más reciente del usuario actual.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
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

    // Obtener ubicación más reciente
    const { data: locations, error } = await supabase
      .from("care_patient_locations")
      .select("*")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false })
      .limit(1);

    if (error) {
      console.error("Error fetching location:", error);
      return new Response(
        JSON.stringify({ error: "Failed to fetch location" }),
        { status: 500 }
      );
    }

    if (!locations || locations.length === 0) {
      return new Response(
        JSON.stringify({
          error: "Location not found",
          message: "No hay ubicación registrada",
        }),
        { status: 404 }
      );
    }

    const location = locations[0];
    return new Response(
      JSON.stringify({
        latitude: location.latitude,
        longitude: location.longitude,
        accuracy: location.accuracy,
        altitude: location.altitude,
        heading: location.heading,
        speed: location.speed,
        updated_at: location.updated_at,
      }),
      { status: 200 }
    );
  } catch (error) {
    console.error("Get user location error:", error);
    return new Response(
      JSON.stringify({ error: String(error) }),
      { status: 500 }
    );
  }
});
