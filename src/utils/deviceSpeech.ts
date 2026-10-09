import * as Speech from 'expo-speech';

/** Prefer an installed high-quality Spanish voice; never depend on a fixed iOS voice ID. */
export async function speakOnDevice(
  text: string,
  rate: number,
  isCurrent: () => boolean,
  callbacks: Pick<Speech.SpeechOptions, 'onStart' | 'onDone' | 'onStopped' | 'onError'>,
): Promise<void> {
  const voices = await Speech.getAvailableVoicesAsync().catch(() => []);
  if (!isCurrent()) return;
  const score = (v: Speech.Voice) =>
    (v.language.toLowerCase().replace('_', '-') === 'es-es' ? 4 : 0) +
    (v.quality === 'Enhanced' ? 2 : 0);
  const spanish = voices.filter(v => /^es(?:[-_]|$)/i.test(v.language))
    .sort((a, b) => score(b) - score(a));
  const voice = spanish[0];
  await Speech.speak(text, {
    language: voice?.language ?? 'es-ES',
    ...(voice ? { voice: voice.identifier } : {}),
    rate,
    pitch: 1,
    ...callbacks,
  });
}
