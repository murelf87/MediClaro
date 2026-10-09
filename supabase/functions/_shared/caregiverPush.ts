export function caregiverPushPayload(token: string, incidentId: string, kind: string) {
 const title = kind === 'no_response' ? 'MediClaro: respuesta pendiente' : kind === 'alarm' ? 'MediClaro: aviso de tu familiar' : 'MediClaro: nuevo mensaje';
 return { to: token, title, body: 'Abre MediClaro para consultar el aviso privado.', sound: 'default', priority: 'high',
  channelId: 'caregiver-alerts', data: { route: '/caregiver', incidentId }, ttl: 300 };
}
export function caregiverLinkPushPayload(token: string, kind: string, patientName?: string, caregiverName?: string) {
 const title = kind === 'link_request'
  ? 'MediClaro: solicitud de cuidador/a'
  : kind === 'link_approved'
   ? 'MediClaro: vinculación aceptada'
   : kind === 'link_rejected'
    ? 'MediClaro: vinculación no aceptada'
    : 'MediClaro: vinculación finalizada';
 const body = kind === 'link_request'
  ? `${caregiverName || 'Una persona'} quiere vincularse como cuidador/a. Abre MediClaro para aceptar o rechazar.`
  : kind === 'link_approved'
   ? `Ya estás vinculado/a como cuidador/a de ${patientName || 'tu familiar'}.`
   : kind === 'link_rejected'
    ? 'La solicitud de vinculación no ha sido aceptada.'
    : `La vinculación con ${patientName || 'la otra persona'} ha finalizado.`;
 return { to: token, title, body, sound: 'default', priority: 'high',
  channelId: 'caregiver-alerts', data: { route: '/caregiver', kind }, ttl: 600 };
}
/** Toma sin confirmar del familiar (lo activa el paciente). En la pantalla bloqueada NO se muestra el medicamento. */
export function medicationAlertPushPayload(token: string, patientName?: string, scheduledTime?: string) {
 return { to: token, title: 'MediClaro: toma sin confirmar',
  body: `${patientName || 'Tu familiar'} no ha confirmado la toma de las ${scheduledTime || 'hora prevista'}. Abre MediClaro para verlo.`,
  sound: 'default', priority: 'high', channelId: 'caregiver-alerts', data: { route: '/caregiver', kind: 'medication' }, ttl: 3600 };
}
/**
 * Mensaje nuevo en el chat con el cuidador/a. El aviso dice QUIÉN escribe y cuántos mensajes hay sin leer, nunca el
 * texto (puede hablar de salud y se vería en la pantalla bloqueada). Al tocarlo se abre esa conversación.
 */
export function careChatPushPayload(token: string, senderName?: string, unread?: number, linkId?: string) {
 const who = (senderName || '').trim() || 'Tu familiar';
 const count = Number.isFinite(Number(unread)) && Number(unread) > 1 ? Math.min(99, Math.floor(Number(unread))) : 1;
 return { to: token, title: 'MediClaro: nuevo mensaje',
  body: count > 1 ? `${who} te ha escrito ${count} mensajes. Abre MediClaro para leerlos.` : `${who} te ha escrito. Abre MediClaro para leerlo.`,
  sound: 'default', priority: 'high', channelId: 'caregiver-alerts',
  data: { route: '/caregiver-chat', kind: 'care_chat', linkId: linkId ?? null }, ttl: 86400 };
}
/**
 * Llamada de voz entrante del chat con el cuidador/a: «X te está llamando». Caduca enseguida (la llamada suena 45 s).
 * Al tocarlo se abre la pantalla de la llamada para contestar o rechazar.
 */
export function careCallPushPayload(token: string, callerName?: string, linkId?: string, callId?: string) {
 const who = (callerName || '').trim() || 'Tu familiar';
 return { to: token, title: 'MediClaro: llamada de voz', body: `${who} te está llamando. Abre MediClaro para contestar.`,
  sound: 'default', priority: 'high', channelId: 'caregiver-alerts',
  data: { route: '/caregiver-call', kind: 'care_call', linkId: linkId ?? null, callId: callId ?? null }, ttl: 45 };
}
export function isExpoToken(token: unknown): token is string {
 return typeof token === 'string' && /^(ExponentPushToken|ExpoPushToken)\[[A-Za-z0-9_-]{10,200}\]$/.test(token);
}
export async function sameSecret(a: string, b: string): Promise<boolean> {
 const hash = async (s: string) => new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)));
 const [aa,bb] = await Promise.all([hash(a),hash(b)]);
 let difference=0; for(let i=0;i<aa.length;i++) difference |= aa[i]^bb[i];
 return a.length>0 && b.length>0 && difference===0;
}
