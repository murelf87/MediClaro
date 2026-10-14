/**
 * Envía un mensaje en el chat y notifica al otro usuario
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

interface ChatMessagePayload {
  linkId: string;
  content: string;
  locationLatitude?: number;
  locationLongitude?: number;
}

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const payload: ChatMessagePayload = await req.json();
    const { linkId, content, locationLatitude, locationLongitude } = payload;

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Obtener usuario actual (desde auth header)
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
    }

    // Insertar mensaje
    const { data: message, error: msgError } = await supabase
      .from("care_chat_messages")
      .insert({
        link_id: linkId,
        sender_id: authHeader.replace("Bearer ", ""),
        content,
        location_latitude: locationLatitude,
        location_longitude: locationLongitude,
      })
      .select()
      .single();

    if (msgError) {
      console.error("Error creating message:", msgError);
      return new Response(
        JSON.stringify({ error: "Failed to create message" }),
        { status: 500 }
      );
    }

    // Obtener info del vínculo para notificar al otro usuario
    const { data: link, error: linkError } = await supabase
      .from("care_links")
      .select("patient_id, caregiver_id")
      .eq("id", linkId)
      .single();

    if (linkError || !link) {
      console.error("Error fetching link:", linkError);
      return new Response(
        JSON.stringify({ error: "Failed to fetch link info" }),
        { status: 500 }
      );
    }

    // Determinar quién es el receptor
    const receiverId = message.sender_id === link.patient_id ? link.caregiver_id : link.patient_id;

    // Obtener tokens VoIP del receptor para enviar notificación
    const { data: tokens, error: tokenError } = await supabase
      .from("care_voip_tokens")
      .select("token, platform")
      .eq("user_id", receiverId)
      .eq("enabled", true);

    if (!tokenError && tokens && tokens.length > 0) {
      // Obtener nombre del sender
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", message.sender_id)
        .single();

      const senderName = profile?.full_name || "Un contacto";

      // Enviar notificaciones push
      for (const { token, platform } of tokens) {
        try {
          await fetch("https://exp.host/--/api/v2/push/send", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              to: token,
              title: "MediClaro: nuevo mensaje",
              body: `${senderName}: ${content.substring(0, 50)}...`,
              sound: "default",
              priority: "high",
              data: {
                route: "/caregiver-chat",
                kind: "care_chat",
                linkId,
              },
            }),
          });
        } catch (error) {
          console.error(`Failed to send push to ${token}:`, error);
        }
      }
    }

    return new Response(JSON.stringify({ success: true, messageId: message.id }), { status: 200 });
  } catch (error) {
    console.error("Send chat message error:", error);
    return new Response(JSON.stringify({ error: String(error) }), { status: 500 });
  }
});
