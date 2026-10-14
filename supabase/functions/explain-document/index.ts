// «Explicar un documento» (clip del chat): lee 1–3 fotos de un informe, receta, analítica o prospecto y lo explica con
// palabras sencillas. Premium. Cuenta como una pregunta del día. NO se guarda ninguna foto: solo el texto de la
// explicación en el historial de la conversación.
import { admin, fail, handler, json } from '../_shared/common.ts';
import { gemini } from '../_shared/ai.ts';
import { COST, logEvent } from '../_shared/metrics.ts';
import { requirePremium } from '../_shared/entitlements.ts';
import { cleanDocumentImages, cleanDocumentReply, DOCUMENT_SYSTEM } from '../_shared/documentExplain.ts';

function safeKey(value: unknown): string {
  const raw = typeof value === 'string' ? value.trim() : '';
  return /^[A-Za-z0-9:_-]{1,80}$/.test(raw) ? raw : 'general';
}
function safeId(value: unknown): string {
  const raw = typeof value === 'string' ? value.trim() : '';
  return /^[A-Za-z0-9:._-]{3,80}$/.test(raw) ? raw : crypto.randomUUID();
}
async function save(userId: string, key: string, clientId: string, role: 'user' | 'assistant', content: string) {
  const { error } = await admin.from('assistant_messages').upsert(
    { user_id: userId, conversation_key: key, client_id: clientId, role, content: content.slice(0, 8000), source_url: null, emergency: null },
    { onConflict: 'user_id,client_id' },
  );
  if (error) console.warn('assistant history save', error.message);
}

Deno.serve(handler({ bucket: 'doc', maxPerMinute: 4, maxBodyBytes: 4_300_000 }, async (_req, user, body) => {
  const { images, error } = cleanDocumentImages(body?.images);
  if (error) return fail(error);
  const key = safeKey(body?.conversationKey);
  const clientId = safeId(body?.clientMessageId);
  const replyId = `${clientId}:assistant`;

  await requirePremium(user.id);
  const { data: allowed } = await admin.rpc('can_chat', { p_user: user.id });
  if (!allowed) return fail('Ha llegado al límite de preguntas de hoy. Mañana podrá seguir.', 402, 'CHAT_LIMIT');

  const label = images.length === 1 ? '📎 Documento enviado (1 foto)' : `📎 Documento enviado (${images.length} fotos)`;
  await save(user.id, key, clientId, 'user', label);

  try {
    const raw = await gemini({
      system: DOCUMENT_SYSTEM,
      maxTokens: 2800,
      preferredModel: 'gemini-3.8-flash',
      contents: [{
        role: 'user',
        parts: [
          ...images.map((data) => ({ inline_data: { mime_type: 'image/jpeg', data } })),
          { text: 'Explícame este documento con palabras sencillas.' },
        ],
      }],
    });
    const reply = cleanDocumentReply(raw) || 'No he podido leer el documento. Prueba con otra foto, con más luz y más cerca.';
    await save(user.id, key, replyId, 'assistant', reply);
    await logEvent(user.id, 'chat', 'document', COST.gemini_vision * images.length);
    return json({ reply, sourceUrl: null, messageId: replyId });
  } catch (e) {
    await logEvent(user.id, 'error', 'document_ai_down');
    console.error(e);
    return fail('No he podido leer el documento ahora mismo. Inténtalo de nuevo en unos minutos.', 503, 'AI_DOWN');
  }
}));
