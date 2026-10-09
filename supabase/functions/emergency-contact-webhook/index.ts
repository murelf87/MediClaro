import { admin } from '../_shared/common.ts';

const SECRET = Deno.env.get('EMERGENCY_WEBHOOK_SECRET') ?? '';

async function hmac(attemptId: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(SECRET),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(attemptId));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

function same(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function xml(text: string, status = 200) {
  return new Response(text, { status, headers: { 'Content-Type': 'text/xml; charset=utf-8' } });
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return xml('<Response><Hangup/></Response>', 405);
  const url = new URL(req.url);
  const attemptId = url.searchParams.get('attempt') ?? '';
  const token = url.searchParams.get('token') ?? '';
  const kind = url.searchParams.get('kind') ?? '';
  if (!SECRET || !/^[0-9a-f-]{36}$/i.test(attemptId) || !same(token, await hmac(attemptId))) {
    return xml('<Response><Hangup/></Response>', 403);
  }  const form = await req.formData().catch(() => new FormData());
  const now = new Date().toISOString();

  if (kind === 'ack') {
    const digits = String(form.get('Digits') ?? '');
    if (digits === '1') {
      await admin.from('emergency_contact_attempts').update({
        acknowledged_at: now,
        call_status: 'acknowledged',
        updated_at: now,
      }).eq('id', attemptId);
      return xml('<Response><Say language="es-ES">Gracias. MediClaro ha registrado que estás atendiendo a la persona.</Say><Hangup/></Response>');
    }
    return xml('<Response><Say language="es-ES">No hemos recibido confirmación.</Say><Hangup/></Response>');
  }

  if (kind === 'call-status') {
    const status = String(form.get('CallStatus') ?? 'unknown').slice(0, 40);
    await admin.from('emergency_contact_attempts').update({ call_status: status, updated_at: now }).eq('id', attemptId);
    return xml('<Response/>');
  }

  if (kind === 'sms-status') {
    const status = String(form.get('MessageStatus') ?? 'unknown').slice(0, 40);
    await admin.from('emergency_contact_attempts').update({ sms_status: status, updated_at: now }).eq('id', attemptId);
    return xml('<Response/>');
  }

  return xml('<Response/>');
});