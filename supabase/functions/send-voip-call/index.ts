/**
 * Envía llamadas VoIP a iOS (APNs) y Android (FCM).
 * Usa la clave privada .p8 guardada en secretos de Supabase para firmar JWTs.
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import * as jose from "https://deno.land/x/jose@v4.14.1/index.ts";

interface VoIPCallPayload {
  callId: string;
  callerId: string;
  callerName: string;
  linkId: string;
}

// Tipos para la respuesta de APNs
interface APNsResponse {
  platform: 'ios' | 'android';
  token: string;
  success: boolean;
  error?: string;
}

/**
 * Crea y firma un JWT para autenticarse en APNs
 */
async function createAPNsToken(apnsKey: string, keyId: string, teamId: string): Promise<string> {
  const privateKey = await jose.importPKCS8(apnsKey, "ES256");

  const token = await new jose.SignJWT({
    iss: teamId,
  })
    .setProtectedHeader({
      alg: "ES256",
      kid: keyId,
      typ: "JWT",
    })
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(privateKey);

  return token;
}

/**
 * Envía notificación VoIP a un dispositivo iOS via APNs
 */
async function sendToiOS(
  token: string,
  payload: VoIPCallPayload,
  apnsToken: string,
  keyId: string,
  teamId: string
): Promise<APNsResponse> {
  try {
    const voipPayload = {
      aps: {
        alert: {
          title: "Llamada de MediClaro",
          body: `${payload.callerName} te está llamando`,
        },
        sound: "default",
        badge: 1,
        "mutable-content": 1,
        category: "VOIP_CALL",
      },
      data: payload,
    };

    // APNs production endpoint (cambiar a development si es necesario)
    const apnsUrl = `https://api.push.apple.com/3/device/${token}`;

    const response = await fetch(apnsUrl, {
      method: "POST",
      headers: {
        "authorization": `bearer ${apnsToken}`,
        "apns-topic": "com.mediclaro.app.voip", // Bundle ID + .voip
        "apns-push-type": "voip",
        "apns-priority": "10",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(voipPayload),
    });

    if (response.ok) {
      return { platform: "ios", token, success: true };
    } else {
      const error = await response.text();
      console.error(`APNs error for ${token}: ${error}`);
      return {
        platform: "ios",
        token,
        success: false,
        error: `APNs ${response.status}: ${error}`
      };
    }
  } catch (error) {
    console.error(`Error sending to iOS ${token}:`, error);
    return {
      platform: "ios",
      token,
      success: false,
      error: String(error)
    };
  }
}

/**
 * Envía notificación de prioridad máxima a Android via FCM
 */
async function sendToAndroid(
  token: string,
  payload: VoIPCallPayload
): Promise<APNsResponse> {
  try {
    // Por ahora usamos Expo como intermediario para Android
    // Idealmente deberíamos usar FCM directamente
    const response = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        to: token,
        sound: "default",
        priority: "max",
        data: {
          ...payload,
          kind: "voip_call",
        },
        categoryId: "VOIP_CALL",
      }),
    });

    if (response.ok) {
      return { platform: "android", token, success: true };
    } else {
      const error = await response.text();
      console.error(`FCM error for ${token}: ${error}`);
      return {
        platform: "android",
        token,
        success: false,
        error: `FCM ${response.status}: ${error}`
      };
    }
  } catch (error) {
    console.error(`Error sending to Android ${token}:`, error);
    return {
      platform: "android",
      token,
      success: false,
      error: String(error)
    };
  }
}

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const { voipTokens, payload }: {
      voipTokens: Array<{ token: string; platform: 'ios' | 'android' }>;
      payload: VoIPCallPayload;
    } = await req.json();

    // Obtener secretos de Supabase
    const apnsKey = Deno.env.get("APNS_KEY");
    const keyId = Deno.env.get("APNS_KEY_ID");
    const teamId = Deno.env.get("APNS_TEAM_ID");

    if (!apnsKey || !keyId || !teamId) {
      console.error("Missing APNs credentials in secrets");
      return new Response(
        JSON.stringify({ error: "APNs credentials not configured" }),
        { status: 500 }
      );
    }

    // Crear JWT para APNs (válido por 1 hora)
    const apnsJWT = await createAPNsToken(apnsKey, keyId, teamId);

    const results: APNsResponse[] = [];

    for (const { token, platform } of voipTokens) {
      if (platform === "ios") {
        const result = await sendToiOS(token, payload, apnsJWT, keyId, teamId);
        results.push(result);
      } else if (platform === "android") {
        const result = await sendToAndroid(token, payload);
        results.push(result);
      }
    }

    const summary = {
      total: results.length,
      success: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
      results,
    };

    return new Response(JSON.stringify(summary), { status: 200 });
  } catch (error) {
    console.error("VoIP call error:", error);
    return new Response(
      JSON.stringify({ error: String(error) }),
      { status: 500 }
    );
  }
});
