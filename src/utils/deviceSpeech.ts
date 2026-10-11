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

// ─── Voz de mujer o de hombre ───────────────────────────────────────────────────────────────────────────
// Cada persona elige voz de mujer (Sulafat) o de hombre (Achird). Con la voz del teléfono se busca una voz en español
// del mismo tipo. El sistema no dice si una voz es de mujer o de hombre: se reconoce por el nombre de las voces en
// español de Apple. Si el teléfono no tiene ninguna del tipo elegido (o no se reconoce, p. ej. en Android), se usa la
// mejor que tenga.

export type VoiceGender = 'female' | 'male';

const FEMALE = new Set(['monica', 'marisol', 'paulina', 'angelica', 'isabela', 'soledad', 'jimena', 'francisca', 'lucia', 'helena', 'carmen', 'elena', 'laura', 'sara']);
const MALE = new Set(['jorge', 'juan', 'diego', 'carlos', 'pablo', 'enrique', 'alvaro', 'andres']);

function plain(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

/** Mujer u hombre según el nombre de la voz; null si no se reconoce. */
export function deviceVoiceGender(v: Speech.Voice): VoiceGender | null {
  const fromName = plain(v.name ?? '').split(/[\s(]/)[0];
  const fromId = plain((v.identifier ?? '').split('.').pop() ?? '').replace(/-(compact|premium|enhanced)$/, '');
  for (const n of [fromName, fromId]) {
    if (FEMALE.has(n)) return 'female';
    if (MALE.has(n)) return 'male';
  }
  return null;
}

/** La voz natural elegida (Sulafat/Aoede = mujer, Achird = hombre) dice qué tipo de voz del teléfono buscar. */
export function genderOfVoice(voice?: string | null): VoiceGender | undefined {
  if (voice === 'Achird') return 'male';
  if (voice === 'Sulafat' || voice === 'Aoede') return 'female';
  return undefined;
}

function spanishVoices(voices: Speech.Voice[]): Speech.Voice[] {
  return voices.filter((v) => /^es(?:[-_]|$)/i.test(v.language) && tier(v) >= 0).sort((a, b) => score(b) - score(a));
}

/**
 * La mejor voz en español instalada (de España antes que otras), del tipo pedido si hay alguna; undefined si solo hay
 * voces robóticas.
 */
export function pickDeviceVoice(voices: Speech.Voice[], gender?: VoiceGender): Speech.Voice | undefined {
  const spanish = spanishVoices(voices);
  if (gender) {
    const match = spanish.find((v) => deviceVoiceGender(v) === gender);
    if (match) return match;
  }
  return spanish[0];
}

/** ¿Tiene el teléfono alguna voz en español de este tipo? */
export function hasDeviceVoice(voices: Speech.Voice[], gender: VoiceGender): boolean {
  return spanishVoices(voices).some((v) => deviceVoiceGender(v) === gender);
}

/** «Premium», «Mejorada» o «Normal» (para el panel «Revisar la app»). */
export function deviceVoiceQuality(v: Speech.Voice): 'Premium' | 'Mejorada' | 'Normal' {
  const t = tier(v);
  return t >= 3 ? 'Premium' : t === 2 ? 'Mejorada' : 'Normal';
}

/** Lo máximo que se espera la lista de voces del teléfono: si tarda más, habla la voz española por defecto. */
const VOICE_LIST_WAIT_MS = 1_500;

export function installedVoices(): Promise<Speech.Voice[]> {
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

/** Lee con la mejor voz en español instalada (del tipo elegido, si lo hay); nunca depende de una voz fija. */
export async function speakOnDevice(
  text: string,
  rate: number,
  isCurrent: () => boolean,
  callbacks: Pick<Speech.SpeechOptions, 'onStart' | 'onDone' | 'onStopped' | 'onError'>,
  gender?: VoiceGender,
): Promise<void> {
  const voices = await installedVoices();
  if (!isCurrent()) return;
  const voice = pickDeviceVoice(voices, gender);
  await Speech.speak(text, {
    language: voice?.language ?? 'es-ES',
    ...(voice ? { voice: voice.identifier } : {}),
    rate,
    pitch: 1,
    ...callbacks,
  });
}
