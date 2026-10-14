/**
 * Envía notificación cuando alguien solicita vincularse como cuidador
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

interface LinkRequestPayload {
  linkId: string;
  caregiverId: string;
  patientId: string;
}

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const payload: LinkRequestPayload = await req.json();
    const { linkId, caregiverId, patientId } = payload;

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Obtener tokens VoIP del paciente
    const { data: tokens, error: tokenError } = await supabase
      .from("care_voip_tokens")
      .select("token, platform")
      .eq("user_id", patientId)
      .eq("enabled", true);

    if (tokenError) {
      console.error("Error fetching tokens:", tokenError);
      return new Response(
        JSON.stringify({ error: "Failed to fetch tokens" }),
        { status: 500 }
      );
    }

    // Obtener nombre del cuidador que solicita
    const { data: caregiverProfile } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", caregiverId)
      .single();

    const caregiverName = caregiverProfile?.full_name || "Un contacto";

    // Enviar notificación a cada dispositivo del paciente
    let sentCount = 0;
    if (tokens && tokens.length > 0) {
      for (const { token, platform } of tokens) {
        try {
          const response = await fetch("https://exp.host/--/api/v2/push/send", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              to: token,
              title: "MediClaro: solicitud de cuidador",
              body: `${caregiverName} quiere vincularse como cuidador. Abre MediClaro para aceptar o rechazar.`,
              sound: "default",
              priority: "high",
              data: {
                route: "/caregiver-requests",
                kind: "link_request",
                linkId,
                caregiverId,
              },
            }),
          });

          if (response.ok) {
            sentCount++;
          }
        } catch (error) {
          console.error(`Failed to send push to ${token}:`, error);
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        notificationsSent: sentCount,
      }),
      { status: 200 }
    );
  } catch (error) {
    console.error("Send link request notification error:", error);
    return new Response(
      JSON.stringify({ error: String(error) }),
      { status: 500 }
    );
  }
});
