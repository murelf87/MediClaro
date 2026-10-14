import { admin, fail, handler, json } from '../_shared/common.ts';
import { requirePremium } from '../_shared/entitlements.ts';

const TWILIO_SID = Deno.env.get('TWILIO_ACCOUNT_SID') ?? '';
const TWILIO_TOKEN = Deno.env.get('TWILIO_AUTH_TOKEN') ?? '';
const TWILIO_FROM = Deno.env.get('TWILIO_FROM_NUMBER') ?? '';
const WEBHOOK_SECRET = Deno.env.get('EMERGENCY_WEBHOOK_SECRET') ?? '';
const BASE_URL = Deno.env.get('SUPABASE_URL') ?? '';

function xml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

function normalizePhone(raw: string, country: string): string | null {
  const clean = raw.replace(/[\s()-]/g, '');
  if (/^\+[1-9]\d{7,14}$/.test(clean)) return clean;
  const digits = clean.replace(/\D/g, '');
  if (country === 'ES' && /^\d{9}$/.test(digits)) return `+34${digits}`;
  return null;
}

async function hmac(attemptId: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(WEBHOOK_SECRET),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(attemptId));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, '0')).join('');
}async function twilioPost(path: string, values: Record<string, string>) {
  const body = new URLSearchParams(values);
  const auth = btoa(`${TWILIO_SID}:${TWILIO_TOKEN}`);
  const r = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/${path}.json`, {
    method: 'POST',
    headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`Twilio ${r.status}: ${String(data?.message ?? 'error')}`);
  return data as Record<string, unknown>;
}

Deno.serve(handler({ bucket: 'emergency-contact', maxPerMinute: 3, maxBodyBytes: 8_000 }, async (_req, user, body) => {
  await requirePremium(user.id);
  if (!TWILIO_SID || !TWILIO_TOKEN || !TWILIO_FROM || !WEBHOOK_SECRET) {
    return fail('La telefonía automática todavía no está configurada.', 503, 'TELEPHONY_NOT_CONFIGURED');
  }

  const { data: profile, error } = await admin.from('emergency_profiles')
    .select('full_name,country,emergency_contact_name,emergency_contact_phone,consent_notify_contact,consent_share_location')
    .eq('user_id', user.id).maybeSingle();
  if (error) throw error;
  if (!profile?.emergency_contact_phone || profile.consent_notify_contact !== true) {
    return fail('No hay un contacto de emergencia disponible.', 409, 'NO_EMERGENCY_CONTACT');
  }
  const rawCountry = String(profile.country ?? 'ES').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toUpperCase();
  const country = ['ES', 'ESPANA', 'SPAIN'].includes(rawCountry) ? 'ES' : rawCountry;
  const phone = normalizePhone(String(profile.emergency_contact_phone), country);
  if (!phone) return fail('El teléfono del contacto no es válido.', 422, 'INVALID_CONTACT_PHONE');

  const latitude = Number(body.latitude);
  const longitude = Number(body.longitude);
  const hasLocation = profile.consent_share_location === true &&
    typeof body.latitude === 'number' && typeof body.longitude === 'number' &&
    Number.isFinite(latitude) && Number.isFinite(longitude) && Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180;
  const mapUrl = hasLocation ? `https://maps.google.com/?q=${latitude.toFixed(6)},${longitude.toFixed(6)}` : '';
  const userName = String(profile.full_name ?? '').trim() || 'La persona usuaria de MediClaro';
  const noResponse = body.noResponse === true;  const reason = noResponse
    ? 'MediClaro ha detectado una posible emergencia y no está recibiendo respuesta de la persona.'
    : 'MediClaro ha detectado una posible situación de emergencia.';
  const attemptId = crypto.randomUUID();
  const token = await hmac(attemptId);
  const callback = `${BASE_URL}/functions/v1/emergency-contact-webhook?attempt=${encodeURIComponent(attemptId)}&token=${token}`;

  const smsText = [
    `MediClaro: ${userName} puede necesitar ayuda.`,
    reason,
    mapUrl ? `Ubicación actual: ${mapUrl}` : '',
    'Por favor, atiende la llamada de MediClaro.',
  ].filter(Boolean).join(' ');
  const spoken = `${reason} Se trata de ${userName}. ${hasLocation ? `Su ubicación actual está en las coordenadas ${latitude.toFixed(5)}, ${longitude.toFixed(5)}.` : ''} Pulsa 1 para confirmar que vas a atenderle.`;  const { error: insertError } = await admin.from('emergency_contact_attempts')
    .insert({ id: attemptId, user_id: user.id });
  if (insertError) throw insertError;

  let messageSid = '';
  let callSid = '';
  try {
    const sms = await twilioPost('Messages', {
      To: phone,
      From: TWILIO_FROM,
      Body: smsText,
      StatusCallback: `${callback}&kind=sms-status`,
    });
    messageSid = String(sms.sid ?? '');
  } catch (e) {
    console.error('emergency sms', e);
  }

  const twiml = `<Response><Gather numDigits="1" timeout="12" action="${xml(`${callback}&kind=ack`)}" method="POST"><Say language="es-ES">${xml(spoken)}</Say></Gather><Say language="es-ES">No hemos recibido confirmación. MediClaro continuará con el protocolo de emergencia.</Say><Hangup/></Response>`;  try {
    const call = await twilioPost('Calls', {
      To: phone,
      From: TWILIO_FROM,
      Twiml: twiml,
      Timeout: '25',
      StatusCallback: `${callback}&kind=call-status`,
      StatusCallbackEvent: 'initiated ringing answered completed',
      StatusCallbackMethod: 'POST',
    });
    callSid = String(call.sid ?? '');
  } catch (e) {
    console.error('emergency call', e);
  }

  await admin.from('emergency_contact_attempts').update({
    call_sid: callSid || null,
    message_sid: messageSid || null,
    call_status: callSid ? 'queued' : 'failed',
    sms_status: messageSid ? 'queued' : 'failed',
    updated_at: new Date().toISOString(),
  }).eq('id', attemptId);

  if (!callSid && !messageSid) return fail('No se ha podido contactar con el familiar.', 503, 'CONTACT_FAILED');
  return json({ attemptId, callStarted: Boolean(callSid), smsSent: Boolean(messageSid) });
}));