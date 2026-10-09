import { fail, handler, json } from '../_shared/common.ts';
import { requirePremium } from '../_shared/entitlements.ts';

const ALLOWED = new Set(['audio/m4a','audio/mp4','audio/aac','audio/x-m4a','audio/wav','audio/webm','audio/3gpp']);

Deno.serve(handler({ bucket: 'voice-transcribe', maxPerMinute: 12, maxBodyBytes: 6_500_000 }, async (_req, user, body) => {
  await requirePremium(user.id);
  const audioBase64 = typeof body?.audioBase64 === 'string' ? body.audioBase64 : '';
  const mimeType = typeof body?.mimeType === 'string' ? body.mimeType.toLowerCase() : 'audio/m4a';
  if (!audioBase64 || audioBase64.length > 6_000_000) return fail('Audio vacío o demasiado largo.', 400, 'INVALID_AUDIO');
  if (!ALLOWED.has(mimeType)) return fail('Formato de audio no compatible.', 400, 'INVALID_AUDIO_TYPE');

  const key = Deno.env.get('GEMINI_API_KEY');
  if (!key) return fail('La transcripción por voz no está disponible ahora mismo.', 503, 'VOICE_DOWN');

  const models = ['gemini-3.8-flash','gemini-3.6-flash','gemini-2.5-flash'];
  let lastStatus = 503;
  for (const model of models) {
    try {
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [
            { text: 'Transcribe literalmente este audio hablado en español. Devuelve solo el texto pronunciado, sin comillas, sin comentarios y sin añadir información.' },
            { inlineData: { mimeType, data: audioBase64 } },
          ] }],
          generationConfig: { temperature: 0, maxOutputTokens: 700 },
        }),
        signal: AbortSignal.timeout(30_000),
      });
      lastStatus = r.status;
      if (!r.ok) { await r.text(); continue; }
      const payload = await r.json();
      const text = payload?.candidates?.[0]?.content?.parts?.map((p:any)=>typeof p?.text==='string'?p.text:'').join(' ').trim();
      if (text) return json({ text: text.replace(/^["“]|["”]$/g,'').trim(), model });
    } catch { /* fallback model */ }
  }
  return fail('No he podido entender el audio. Inténtalo de nuevo.', lastStatus === 429 ? 429 : 503, 'VOICE_TRANSCRIBE_FAILED');
}));