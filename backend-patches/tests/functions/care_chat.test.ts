// Chat y llamadas con el cuidador/a en el servidor: el repartidor de avisos (caregiver-dispatch) envía «X te ha escrito»
// SIN el texto del mensaje y «X te está llamando», abre la conversación o la llamada al tocarlo y sigue funcionando si
// la migración aún no está; caregiver-rtc-config da credenciales de llamada solo a conversaciones que lo permiten.
// Sin red ni claves: la base de datos y los servicios externos son dobles en memoria.
// deno-lint-ignore-file no-explicit-any
import assert from 'node:assert/strict';
import { admin } from './fakes/common.ts';
import { callsTo, reset } from './fakes/state.ts';
import { loadFunction } from './load.ts';
import { careCallPushPayload, careChatPushPayload } from '../original/_shared/caregiverPush.ts';

const KEY = 'clave-interna-del-repartidor';
const TOKEN = 'ExponentPushToken[cuidadorCuidador]';
const LINK = '00000000-0000-4000-8000-0000000001a1';

const dispatch = await loadFunction('../original/caregiver-dispatch/index.ts');
const rtcConfig = await loadFunction('../original/caregiver-rtc-config/index.ts');

function serverWith(chatJobs: unknown, chatError: unknown = null, callJobs: unknown = []) {
  admin.rpc = (name: string) => {
    if (name === 'care_worker_key') return Promise.resolve({ data: KEY, error: null });
    if (name === 'care_chat_claim_push_jobs') return Promise.resolve({ data: chatError ? null : chatJobs, error: chatError });
    if (name === 'care_call_claim_push_jobs') return Promise.resolve({ data: chatError ? null : callJobs, error: chatError });
    return Promise.resolve({ data: [], error: null });
  };
}

async function run(): Promise<{ status: number; body: any; sent: any[] }> {
  const sent: any[] = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = ((url: string | URL, init?: RequestInit) => {
    if (String(url).endsWith('/push/send')) {
      const messages = JSON.parse(String(init?.body ?? '[]'));
      sent.push(...messages);
      return Promise.resolve(new Response(JSON.stringify({ data: messages.map((_: unknown, i: number) => ({ status: 'ok', id: `ticket-${i}` })) })));
    }
    return Promise.resolve(new Response(JSON.stringify({ data: {} })));
  }) as typeof fetch;
  try {
    const res = await dispatch(new Request('http://localhost/caregiver-dispatch', { method: 'POST', headers: { 'x-care-key': KEY } }));
    return { status: res.status, body: await res.json(), sent };
  } finally {
    globalThis.fetch = realFetch;
  }
}

Deno.test('Chat: el aviso dice quién escribe y cuántos mensajes, nunca el texto, y abre la conversación', async () => {
  reset();
  serverWith([{ id: 'job-1', user_id: 'u-cuidador', link_id: LINK, attempts: 1, tokens: [TOKEN, 'no-es-un-token'], senderName: 'Carmen', unread: 3 }]);
  const { status, body, sent } = await run();
  assert.equal(status, 200);
  assert.equal(body.processed, 1);
  assert.equal(sent.length, 1, 'solo a los dispositivos válidos');
  assert.equal(sent[0].to, TOKEN);
  assert.equal(sent[0].title, 'MediClaro: nuevo mensaje');
  assert.equal(sent[0].body, 'Carmen te ha escrito 3 mensajes. Abre MediClaro para leerlos.');
  assert.deepEqual(sent[0].data, { route: '/caregiver-chat', kind: 'care_chat', linkId: LINK });
  const update = callsTo('care_chat_push_jobs', 'update').at(-1);
  assert.equal(update?.payload.provider_state, 'provider_accepted');
  assert.ok(update?.payload.sent_at, 'el trabajo queda como enviado');
});

Deno.test('Chat: sin dispositivo registrado se marca y no se reintenta; un mensaje, en singular', async () => {
  reset();
  serverWith([{ id: 'job-2', user_id: 'u-paciente', link_id: LINK, attempts: 1, tokens: [], senderName: 'Javier', unread: 1 }]);
  const { sent } = await run();
  assert.equal(sent.length, 0);
  assert.equal(callsTo('care_chat_push_jobs', 'update').at(-1)?.payload.provider_state, 'no_registered_device');
  const one = careChatPushPayload(TOKEN, 'Javier', 1, LINK);
  assert.equal(one.body, 'Javier te ha escrito. Abre MediClaro para leerlo.');
  assert.equal(careChatPushPayload(TOKEN, '', 0).body, 'Tu familiar te ha escrito. Abre MediClaro para leerlo.');
});

Deno.test('Chat: si la migración del chat aún no está desplegada, los demás avisos siguen funcionando', async () => {
  reset();
  serverWith(null, { message: 'Could not find the function public.care_chat_claim_push_jobs' });
  const { status, body } = await run();
  assert.equal(status, 200);
  assert.equal(body.processed, 0);
  assert.equal(callsTo('care_chat_push_jobs').length, 0, 'no toca la tabla que no existe');
});

Deno.test('Llamada: «X te está llamando» abre la llamada para contestar y caduca enseguida', async () => {
  reset();
  serverWith([], null, [{ id: 'job-c', user_id: 'u-cuidador', link_id: LINK, call_id: 'call-1', attempts: 1, tokens: [TOKEN], callerName: 'Carmen' }]);
  const { sent } = await run();
  assert.equal(sent.length, 1);
  assert.equal(sent[0].title, 'MediClaro: llamada de voz');
  assert.equal(sent[0].body, 'Carmen te está llamando. Abre MediClaro para contestar.');
  assert.deepEqual(sent[0].data, { route: '/caregiver-call', kind: 'care_call', linkId: LINK, callId: 'call-1' });
  assert.equal(sent[0].ttl, 45, 'una llamada que ya no suena no debe llegar tarde');
  assert.equal(callsTo('care_call_push_jobs', 'update').at(-1)?.payload.provider_state, 'provider_accepted');
  assert.equal(careCallPushPayload(TOKEN, '').body, 'Tu familiar te está llamando. Abre MediClaro para contestar.');
});

Deno.test('Llamada: credenciales solo para una conversación aceptada con Premium (y los avisos, como antes)', async () => {
  Deno.env.set('SUPABASE_URL', 'https://ejemplo.supabase.co');
  Deno.env.set('SUPABASE_ANON_KEY', 'clave-publica');
  Deno.env.delete('CAREGIVER_TURN_URLS');
  const asked: Array<{ url: string; auth: string | null; body: any }> = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = ((url: string | URL, init?: RequestInit) => {
    const headers = new Headers(init?.headers);
    asked.push({ url: String(url), auth: headers.get('Authorization'), body: JSON.parse(String(init?.body ?? '{}')) });
    if (String(url).endsWith('/rpc/care_chat_action')) {
      return Promise.resolve(new Response(JSON.stringify({ conversations: [{ linkId: LINK, canSend: true }, { linkId: 'en-pausa', canSend: false }] })));
    }
    if (String(url).endsWith('/rpc/caregiver_action')) {
      return Promise.resolve(new Response(JSON.stringify({ incidents: [{ id: 'aviso-1', state: 'active', expires_at: new Date(Date.now() + 60_000).toISOString() }] })));
    }
    return Promise.resolve(new Response('{}', { status: 404 }));
  }) as typeof fetch;
  const ask = async (body: unknown) => {
    const res = await rtcConfig(new Request('http://localhost/caregiver-rtc-config', {
      method: 'POST', headers: { Authorization: 'Bearer jwt-de-la-persona', 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    }));
    return { status: res.status, body: await res.json() };
  };
  try {
    let r = await ask({ linkId: LINK });
    assert.equal(r.status, 200);
    assert.ok(r.body.iceServers?.length, 'servidores para la conexión');
    assert.equal(asked.at(-1)?.auth, 'Bearer jwt-de-la-persona', 'se comprueba con la sesión de quien llama');
    assert.deepEqual(asked.at(-1)?.body, { p_action: 'list', p_payload: {} });
    r = await ask({ linkId: 'en-pausa' });
    assert.equal(r.status, 403, 'sin Premium de la persona cuidada no hay llamada');
    r = await ask({ linkId: 'de-otra-persona' });
    assert.equal(r.status, 403);
    r = await ask({ incidentId: 'aviso-1' });
    assert.equal(r.status, 200, 'durante un aviso, como hasta ahora');
    r = await ask({ incidentId: 'aviso-viejo' });
    assert.equal(r.status, 403);
  } finally {
    globalThis.fetch = realFetch;
  }
});
