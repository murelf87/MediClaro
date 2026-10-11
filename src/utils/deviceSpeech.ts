import * as Speech from 'expo-speech';

/**
 * Calidad de una voz del teléfono por su identificador (iOS informa «premium» como calidad normal):
 *   premium > mejorada (enhanced) > normal (compact). Las voces «Eloquence» y las de novedad suenan a robot y
 *   nunca se eligen; la «Voz personal» necesita un permiso aparte.
 */
function tier(v: Speech.Voice): number {
  const id = (v.identifier ?? '').toLowerCase();
  if (id.includes('eloquence') || id.includes('speech.synthesis') || id.includes('personal')) return -10;
  if (id.includes('premium')) return 3;
  if (v.quality === 'Enhanced' || id.includes('enhanced')) return 2;
  if (id.includes('compact') || id.includes('com.apple.voice')) return 1;
  return 0;
}

const score = (v: Speech.Voice) => (v.language.toLowerCase().replace('_', '-') === 'es-es' ? 4 : 0) + tier(v);

/** La mejor voz en español instalada (de España antes que otras), o undefined si solo hay voces robóticas. */
export function pickDeviceVoice(voices: Speech.Voice[]): Speech.Voice | undefined {
  return voices
    .filter((v) => /^es(?:[-_]|$)/i.test(v.language) && tier(v) >= 0)
    .sort((a, b) => score(b) - score(a))[0];
}

/** «Premium», «Mejorada» o «Normal» (para el panel «Revisar la app»). */
export function deviceVoiceQuality(v: Speech.Voice): 'Premium' | 'Mejorada' | 'Normal' {
  const t = tier(v);
  return t >= 3 ? 'Premium' : t === 2 ? 'Mejorada' : 'Normal';
}

/** Lo máximo que se espera la lista de voces del teléfono: si tarda más, habla la voz española por defecto. */
const VOICE_LIST_WAIT_MS = 1_500;

function installedVoices(): Promise<Speech.Voice[]> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const late = new Promise<Speech.Voice[]>((resolve) => {
    timer = setTimeout(() => resolve([]), VOICE_LIST_WAIT_MS);
  });
  const list = Promise.resolve()
    .then(() => Speech.getAvailableVoicesAsync())
    .catch(() => [] as Speech.Voice[]);
  return Promise.race([list, late]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}

/** Prefer an installed high-quality Spanish voice; never depend on a fixed iOS voice ID. */
export async function speakOnDevice(
  text: string,
  rate: number,
  isCurrent: () => boolean,
  callbacks: Pick<Speech.SpeechOptions, 'onStart' | 'onDone' | 'onStopped' | 'onError'>,
): Promise<void> {
  const voices = await installedVoices();
  if (!isCurrent()) return;
  const voice = pickDeviceVoice(voices);
  await Speech.speak(text, {
    language: voice?.language ?? 'es-ES',
    ...(voice ? { voice: voice.identifier } : {}),
    rate,
    pitch: 1,
    ...callbacks,
  });
}
