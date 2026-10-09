/**
 * SpeechService — voz natural de MediClaro mediante Gemini TTS.
 *
 * La GEMINI_API_KEY vive exclusivamente en la Edge Function `tts`.
 * El cliente solo envía texto, voz permitida y propósito. El backend devuelve
 * un WAV efímero en base64, que se guarda en la caché local del dispositivo.
 *
 * Antes de enviarlo, el texto se prepara para la voz (unidades, «c/8 h», 112…): ver utils/speechText.
 * Las previsualizaciones públicas (`tts-preview`) solo aceptan textos fijos y se envían tal cual.
 * Nunca se corta un texto a mitad de palabra: si es largo, se divide por frases y el servidor devuelve
 * un único audio continuo.
 */
import { File, Paths } from 'expo-file-system';
import { invokeFunction } from '../api';
import { isBackendConfigured, isDemoClientActive, SUPABASE_ANON_KEY, SUPABASE_URL } from '../lib/supabase';
import { endWithPause, prepareSpeechText } from '../utils/speechText';
import { VOICE_PREVIEW_TEXTS } from '../config/voicePreviews';
import type { GeminiVoice } from './PreferencesService';

export type SpeechPurpose = 'reading' | 'assistant' | 'preview';

interface TtsResponse {
  audioBase64: string;
  mimeType?: string;
  voice?: GeminiVoice;
  model?: string;
  segments?: number;
  continuous?: boolean;
}

/** Máximo de caracteres por petición simple (el servidor admite 3200 por segmento). */
const MAX_SINGLE_CHARS = 3000;

/**
 * Muestra fija de Sulafat para el Modo demostración (sin cuenta real no se genera audio nuevo).
 * Debe coincidir EXACTAMENTE con un texto permitido en supabase/functions/tts-preview (hay una prueba que lo comprueba).
 */
export const DEMO_VOICE_SAMPLE: string = VOICE_PREVIEW_TEXTS.demoSample;

let counter = 0;

function safeVoice(voice: GeminiVoice): GeminiVoice {
  return voice === 'Achird' || voice === 'Aoede' ? voice : 'Sulafat';
}

function saveAudio(audioBase64: string): { uri: string; cleanup: () => void } {
  counter += 1;
  const file = new File(Paths.cache, `mediclaro-gemini-${Date.now()}-${counter}.wav`);
  file.write(audioBase64, { encoding: 'base64' });
  return {
    uri: file.uri,
    cleanup: () => {
      try {
        if (file.exists) file.delete();
      } catch {
        // La caché también puede ser purgada por el sistema.
      }
    },
  };
}

function splitForTts(text: string, max = 2800): string[] {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (!clean) return [];
  if (clean.length <= max) return [clean];

  const out: string[] = [];
  const sentences = clean.match(/[^.!?;:]+[.!?;:]?\s*/g) ?? [clean];
  let current = '';

  const pushWords = (value: string) => {
    const words = value.trim().split(/\s+/).filter(Boolean);
    let chunk = '';
    for (const word of words) {
      const candidate = chunk ? `${chunk} ${word}` : word;
      if (candidate.length <= max) chunk = candidate;
      else {
        if (chunk) out.push(chunk);
        chunk = word;
      }
    }
    if (chunk) out.push(chunk);
  };

  for (const raw of sentences) {
    const sentence = raw.trim();
    if (!sentence) continue;
    if (sentence.length > max) {
      if (current) { out.push(current); current = ''; }
      pushWords(sentence);
      continue;
    }
    const candidate = current ? `${current} ${sentence}` : sentence;
    if (candidate.length <= max) current = candidate;
    else {
      if (current) out.push(current);
      current = sentence;
    }
  }
  if (current) out.push(current);
  return out;
}

/** Une los apartados en segmentos de hasta 3000 caracteres, siempre cortando entre frases. */
export function packContinuousSegments(parts: string[]): string[] {
  const atomic = parts
    .map((part) => endWithPause(prepareSpeechText(part)))
    .filter(Boolean)
    .flatMap((part) => splitForTts(part));
  const packed: string[] = [];
  let current = '';
  for (const part of atomic) {
    if (!current) { current = part; continue; }
    const candidate = `${current} ${part}`;
    if (candidate.length <= MAX_SINGLE_CHARS) current = candidate;
    else { packed.push(current); current = part; }
  }
  if (current) packed.push(current);
  return packed;
}

async function publicPreview(text: string, voice: GeminiVoice): Promise<TtsResponse> {
  if (!isBackendConfigured) {
    return invokeFunction<TtsResponse>('tts-preview', { text, voice: safeVoice(voice), purpose: 'preview' }, { timeoutMs: 60_000 });
  }
  // La previsualización y la respuesta fija de QA usan textos permitidos: no deben
  // depender de una sesión real, de que haya caducado ni de una suscripción.
  const r = await fetch(`${SUPABASE_URL}/functions/v1/tts-preview`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: SUPABASE_ANON_KEY },
    body: JSON.stringify({ text, voice: safeVoice(voice), purpose: 'preview' }),
  });
  const data = (await r.json().catch(() => ({}))) as TtsResponse & { error?: string };
  if (!r.ok) throw new Error(data.error || 'La voz natural no está disponible.');
  return data;
}

export const SpeechService = {
  async synthesize(text: string, voice: GeminiVoice, purpose: SpeechPurpose): Promise<{ uri: string; cleanup: () => void }> {
    // Textos fijos (previsualización, o la respuesta de ejemplo del Modo demostración): se envían tal cual.
    if (purpose === 'preview' || (purpose === 'assistant' && isDemoClientActive())) {
      const exact = text.replace(/\s+/g, ' ').trim();
      if (!exact) throw new Error('Texto vacío');
      const response = await publicPreview(exact, voice);
      if (!response?.audioBase64) throw new Error('Audio vacío');
      return saveAudio(response.audioBase64);
    }

    const clean = prepareSpeechText(text);
    if (!clean) throw new Error('Texto vacío');
    // Un texto largo nunca se recorta (cortaría una palabra): se lee entero como audio continuo.
    if (clean.length > MAX_SINGLE_CHARS) return SpeechService.synthesizeContinuous([clean], voice, purpose);

    const response = await invokeFunction<TtsResponse>('tts', { text: clean, voice: safeVoice(voice), purpose }, { timeoutMs: 60_000 });
    if (!response?.audioBase64) throw new Error('Audio vacío');
    return saveAudio(response.audioBase64);
  },

  async synthesizeContinuous(
    parts: string[],
    voice: GeminiVoice = 'Sulafat',
    purpose: Exclude<SpeechPurpose, 'preview'> = 'reading',
  ): Promise<{ uri: string; cleanup: () => void }> {
    // Modo demostración: no hay cuenta real que pueda generar audio nuevo; se reproduce una muestra fija de la voz.
    if (isDemoClientActive() && purpose === 'reading') {
      const response = await publicPreview(DEMO_VOICE_SAMPLE, voice);
      if (!response?.audioBase64) throw new Error('Audio vacío');
      return saveAudio(response.audioBase64);
    }

    const segments = packContinuousSegments(parts);
    if (!segments.length) throw new Error('Texto vacío');
    const total = segments.reduce((n, s) => n + s.length, 0);
    if (total > 28_000) throw new Error('La explicación es demasiado larga para una sola reproducción.');

    const response = segments.length === 1
      ? await invokeFunction<TtsResponse>(
          'tts',
          { text: segments[0], voice: safeVoice(voice), purpose },
          { timeoutMs: 90_000 },
        )
      : await invokeFunction<TtsResponse>(
          'tts',
          { segments, voice: safeVoice(voice), purpose },
          { timeoutMs: 150_000 },
        );

    if (!response?.audioBase64) throw new Error('Audio vacío');
    return saveAudio(response.audioBase64);
  },
};
