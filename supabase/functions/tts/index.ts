/**
 * Gemini TTS — voz natural de MediClaro.
 * La lectura de medicamentos admite varios segmentos pero devuelve UN solo WAV,
 * para que no haya cortes ni palabras partidas al cambiar de tarjeta.
 * Los segmentos llegan cortados entre frases; al unirlos se deja una pausa breve y natural.
 * Todas las voces hablan en español de España (acento castellano), como la explicación inicial.
 */
import { fail, handler, json } from '../_shared/common.ts';
import { requirePremium } from '../_shared/entitlements.ts';

const KEY = Deno.env.get('GEMINI_API_KEY') ?? '';
const MODEL = Deno.env.get('GEMINI_TTS_MODEL') ?? 'gemini-3.8-flash-tts';
const ALLOWED_VOICES = new Set(['Sulafat', 'Achird', 'Aoede']);
const MAX_SEGMENT = 3200;
const MAX_SEGMENTS = 16;
const MAX_TOTAL = 28_000;

const SPAIN_SPANISH = 'Speak in Spanish from Spain (Castilian accent, es-ES). ';

function styleFor(purpose: string): string {
  if (purpose === 'assistant') {
    return SPAIN_SPANISH + 'Natural, warm and reassuring. Speak clearly to an older adult, with human conversational cadence, gentle pauses and no theatrical exaggeration.';
  }
  if (purpose === 'preview') {
    return SPAIN_SPANISH + 'Warm, natural and friendly. Clear diction, relaxed pace, human cadence.';
  }
  return SPAIN_SPANISH + 'Warm, calm and exceptionally clear. Accessible reading for an older adult, unhurried cadence, natural pauses and precise pronunciation of medication names. Always finish the last word completely.';
}

/**
 * Los modelos de voz antiguos (respaldo si falla el principal) no admiten el estilo aparte: se les indica en el propio
 * texto, con la forma documentada por Google («Say …: texto»; solo se pronuncia lo que va detrás de los dos puntos).
 * Así también el respaldo habla en español de España y no con otro acento.
 */
function legacyPrompt(purpose: string, text: string): string {
  const how = purpose === 'reading' ? 'slowly and very clearly, finishing the last word completely' : 'warmly and naturally, like a calm conversation';
  return `Say in Spanish from Spain, with a Castilian accent (es-ES), ${how}: ${text}`;
}

/** Pausa entre segmentos al unirlos (24 kHz · 16 bits · mono): 0,28 s de silencio. */
const SEGMENT_PAUSE_BYTES = Math.round(24000 * 0.28) * 2;

function extractAudio(payload: any): { data: string; mime: string } | null {
  if (typeof payload?.output_audio?.data === 'string' && payload.output_audio.data) {
    return { data: payload.output_audio.data, mime: payload.output_audio.mime_type ?? 'audio/wav' };
  }
  const steps = Array.isArray(payload?.steps) ? payload.steps : [];
  for (let i = steps.length - 1; i >= 0; i -= 1) {
    const content = Array.isArray(steps[i]?.content) ? steps[i].content : [];
    for (let j = content.length - 1; j >= 0; j -= 1) {
      if (content[j]?.type === 'audio' && typeof content[j]?.data === 'string') {
        return { data: content[j].data, mime: content[j].mime_type ?? 'audio/wav' };
      }
    }
  }
  return null;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}

function pcm24kToWavBase64(pcmBase64: string): string {
  const pcm = Uint8Array.from(atob(pcmBase64), c => c.charCodeAt(0));
  const buffer = new ArrayBuffer(44 + pcm.length);
  const view = new DataView(buffer);
  const bytes = new Uint8Array(buffer);
  const put = (o: number, s: string) => { for (let i = 0; i < s.length; i += 1) bytes[o + i] = s.charCodeAt(i); };
  put(0, 'RIFF'); view.setUint32(4, 36 + pcm.length, true); put(8, 'WAVE'); put(12, 'fmt ');
  view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
  view.setUint32(24, 24000, true); view.setUint32(28, 48000, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true);
  put(36, 'data'); view.setUint32(40, pcm.length, true); bytes.set(pcm, 44);
  return bytesToBase64(bytes);
}

function wavToPcm(wavBase64: string): Uint8Array | null {
  const bytes = Uint8Array.from(atob(wavBase64), c => c.charCodeAt(0));
  if (bytes.length < 44) return null;
  const ascii = (offset: number, n: number) => String.fromCharCode(...bytes.subarray(offset, offset + n));
  if (ascii(0, 4) !== 'RIFF' || ascii(8, 4) !== 'WAVE') return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let offset = 12;
  while (offset + 8 <= bytes.length) {
    const id = ascii(offset, 4);
    const size = view.getUint32(offset + 4, true);
    const start = offset + 8;
    if (id === 'fmt ' && size >= 16) {
      const format = view.getUint16(start, true);
      const channels = view.getUint16(start + 2, true);
      const sampleRate = view.getUint32(start + 4, true);
      const bits = view.getUint16(start + 14, true);
      if (format !== 1 || channels !== 1 || sampleRate !== 24000 || bits !== 16) return null;
    }
    if (id === 'data') return bytes.slice(start, Math.min(start + size, bytes.length));
    offset = start + size + (size % 2);
  }
  return null;
}

function mergeWavBase64(parts: string[]): string | null {
  const pcmParts = parts.map(wavToPcm);
  if (pcmParts.some((p) => !p)) return null;
  const valid = pcmParts as Uint8Array[];
  const pauses = Math.max(0, valid.length - 1) * SEGMENT_PAUSE_BYTES;
  const total = valid.reduce((n, p) => n + p.length, 0) + pauses;
  const merged = new Uint8Array(total); // los huecos quedan a cero = silencio
  let offset = 0;
  valid.forEach((p, i) => {
    merged.set(p, offset);
    offset += p.length;
    if (i < valid.length - 1) offset += SEGMENT_PAUSE_BYTES;
  });
  return pcm24kToWavBase64(bytesToBase64(merged));
}

async function synthesizeSegment(text: string, voice: string, purpose: string): Promise<{ wav: string; model: string } | null> {
  const requestModel = (model: string) => {
    const legacy = model.startsWith('gemini-2.5') || model.startsWith('gemini-3.1');
    const content: any = { type: 'text', text: legacy ? legacyPrompt(purpose, text) : text };
    if (!legacy) content.annotations = [{ type: 'speech_metadata', style: styleFor(purpose) }];
    return fetch('https://generativelanguage.googleapis.com/v1beta/interactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': KEY },
      body: JSON.stringify({
        model,
        input: [{ type: 'user_input', content: [content] }],
        response_format: legacy ? { type: 'audio' } : { type: 'audio', mime_type: 'audio/wav', sample_rate: 24000 },
        generation_config: { speech_config: [{ voice }] },
      }),
      signal: AbortSignal.timeout(45_000),
    });
  };

  const candidates = Array.from(new Set([MODEL, 'gemini-3.8-flash-lite-tts', 'gemini-2.5-flash-preview-tts']));
  for (const model of candidates) {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const r = await requestModel(model);
        if (r.ok) {
          const payload = await r.json();
          const audio = extractAudio(payload);
          if (audio) {
            return {
              wav: /l16|pcm/i.test(audio.mime) ? pcm24kToWavBase64(audio.data) : audio.data,
              model,
            };
          }
        } else {
          await r.text();
        }
        const retryable = r.status === 404 || r.status === 408 || r.status === 429 || r.status >= 500;
        if (!retryable) break;
        if (attempt === 0) await new Promise(resolve => setTimeout(resolve, 350));
      } catch {
        if (attempt === 0) await new Promise(resolve => setTimeout(resolve, 350));
      }
    }
  }
  return null;
}

Deno.serve(handler({ bucket: 'tts', maxPerMinute: 12, maxBodyBytes: 40_000 }, async (_req, user, body) => {
  const purpose = body?.purpose === 'assistant' || body?.purpose === 'preview' ? body.purpose : 'reading';
  if (purpose !== 'preview') await requirePremium(user.id);
  if (!KEY) return fail('La voz natural no está configurada.', 503, 'TTS_DOWN');

  const rawSegments = Array.isArray(body?.segments) ? body.segments : [body?.text];
  const segments = rawSegments
    .filter((v: unknown) => typeof v === 'string')
    .map((v: string) => v.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
  if (!segments.length) return fail('Falta el texto');
  if (segments.length > MAX_SEGMENTS || segments.some((s: string) => s.length > MAX_SEGMENT)) {
    return fail('Lectura demasiado larga', 413, 'TTS_TOO_LONG');
  }
  if (segments.reduce((n: number, s: string) => n + s.length, 0) > MAX_TOTAL) {
    return fail('Lectura demasiado larga', 413, 'TTS_TOO_LONG');
  }

  const voice = typeof body?.voice === 'string' && ALLOWED_VOICES.has(body.voice) ? body.voice : 'Sulafat';
  const wavs: string[] = [];
  const models: string[] = [];
  for (const segment of segments) {
    const result = await synthesizeSegment(segment, voice, purpose);
    if (!result) return fail('La voz natural no está disponible ahora mismo.', 503, 'TTS_DOWN');
    wavs.push(result.wav);
    models.push(result.model);
  }

  if (wavs.length === 1) {
    return json({ audioBase64: wavs[0], mimeType: 'audio/wav', voice, model: models[0] });
  }

  const merged = mergeWavBase64(wavs);
  if (!merged) return fail('No se ha podido preparar la reproducción completa.', 503, 'TTS_MERGE_FAILED');
  return json({
    audioBase64: merged,
    mimeType: 'audio/wav',
    voice,
    model: Array.from(new Set(models)).join(','),
    segments: segments.length,
    continuous: true,
  });
}));