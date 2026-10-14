/**
 * Inicia una llamada VoIP:
 * 1. Crea el registro de llamada en la BD
 * 2. Obtiene los tokens VoIP del receptor
 * 3. Envía notificaciones a iOS (APNs) y Android (FCM)
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

interface InitiateCallPayload {
  callerId: string;
  callerName: string;
  receiverId: string;
  linkId: string;
}

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const payload: InitiateCallPayload = await req.json();
    const { callerId, callerName, receiverId, linkId } = payload;

    // Inicializar cliente de Supabase
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // 1. Crear registro de llamada
    const callId = crypto.randomUUID();
    const { error: callError } = await supabase
      .from("care_calls")
      .insert({
        id: callId,
        caller_id: callerId,
        receiver_id: receiverId,
        link_id: linkId,
        status: "ringing",
        started_at: new Date().toISOString(),
      });

    if (callError) {
      console.error("Error creating call:", callError);
      return new Response(
        JSON.stringify({ error: "Failed to create call" }),
        { status: 500 }
      );
    }

    // 2. Obtener tokens VoIP del receptor
    const { data: voipTokens, error: tokenError } = await supabase
      .from("care_voip_tokens")
      .select("token, platform")
      .eq("user_id", receiverId)
      .eq("enabled", true);

    if (tokenError || !voipTokens || voipTokens.length === 0) {
      console.error("No VoIP tokens found for receiver:", tokenError);
      // Actualizar estado de la llamada a fallida
      await supabase
        .from("care_calls")
        .update({ status: "failed", ended_at: new Date().toISOString() })
        .eq("id", callId);

      return new Response(
        JSON.stringify({
          error: "No VoIP tokens found",
          callId,
        }),
        { status: 404 }
      );
    }

    // 3. Enviar notificaciones a través de send-voip-call
    const sendResponse = await fetch(
      `${supabaseUrl}/functions/v1/send-voip-call`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${supabaseKey}`,
        },
        body: JSON.stringify({
          voipTokens,
          payload: {
            callId,
            callerId,
            callerName,
            linkId,
          },
        }),
      }
    );

    if (!sendResponse.ok) {
      const error = await sendResponse.text();
      console.error("Error sending VoIP notifications:", error);

      // Actualizar estado de la llamada
      await supabase
        .from("care_calls")
        .update({ status: "failed", ended_at: new Date().toISOString() })
        .eq("id", callId);

      return new Response(
        JSON.stringify({
          error: "Failed to send notifications",
          callId,
          details: error,
        }),
        { status: 500 }
      );
    }

    const sendResult = await sendResponse.json();

    // 4. Registrar intento de envío
    console.log(`Call initiated: ${callId}`, sendResult);

    return new Response(
      JSON.stringify({
        success: true,
        callId,
        tokensSent: sendResult.success,
        tokensFailed: sendResult.failed,
      }),
      { status: 200 }
    );
  } catch (error) {
    console.error("Initiate VoIP call error:", error);
    return new Response(
      JSON.stringify({ error: String(error) }),
      { status: 500 }
    );
  }
});
