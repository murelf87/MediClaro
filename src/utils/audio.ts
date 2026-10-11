/**
 * Sesión de audio del teléfono.
 *
 * - Lectura en voz alta (voz natural, asistente, explicación inicial): en iPhone, sin esto la voz NO suena si el
 *   interruptor de silencio está activado; para personas mayores la lectura en voz alta es una función de
 *   accesibilidad. Además devuelve el sonido al ALTAVOZ después de usar el micrófono.
 *   NUNCA bloquea: si el sistema no responde en 1,5 s se sigue igualmente (una espera sin fin aquí dejaría la voz
 *   «preparándose» sin llegar a pedirla al servidor).
 * - Grabación («Hablar con el asistente»): en iPhone, expo-audio rechaza `record()` (RecordingDisabledException) si
 *   antes no se ha activado la grabación en la sesión de audio. Al terminar hay que volver a la lectura.
 */
import { Platform } from 'react-native';
import { setAudioModeAsync } from 'expo-audio';

/** Cómo ha ido la preparación del audio (para el diagnóstico de la voz). */
export type AudioModeResult = 'ok' | 'error' | 'timeout' | 'web';

/** Lo máximo que se espera a que el sistema prepare el audio antes de seguir. */
export const AUDIO_MODE_WAIT_MS = 1_500;

export async function configureAudioForSpeech(waitMs: number = AUDIO_MODE_WAIT_MS): Promise<AudioModeResult> {
  if (Platform.OS === 'web') return 'web';
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<AudioModeResult>((resolve) => {
    timer = setTimeout(() => resolve('timeout'), waitMs);
  });
  // Promise.resolve().then(): también un fallo inmediato (módulo nativo ausente) se queda en 'error', sin lanzar.
  const attempt = Promise.resolve()
    .then(() =>
      setAudioModeAsync({
        allowsRecording: false,
        playsInSilentMode: true,
        shouldPlayInBackground: false,
        shouldRouteThroughEarpiece: false,
        interruptionMode: 'duckOthers',
      }),
    )
    .then(
      () => 'ok' as const,
      // Si el sistema no lo permite, la voz sigue funcionando con el modo por defecto.
      () => 'error' as const,
    );
  try {
    return await Promise.race([attempt, timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * Prepara el teléfono para grabar un mensaje de voz. Lanza un error si el sistema no lo permite (la pantalla
 * lo muestra con un aviso claro; nunca cierra la app). El sonido sigue saliendo por el altavoz, no por el
 * auricular.
 */
export async function configureAudioForRecording(): Promise<void> {
  if (Platform.OS === 'web') return;
  await setAudioModeAsync({
    allowsRecording: true,
    playsInSilentMode: true,
    shouldPlayInBackground: false,
    shouldRouteThroughEarpiece: false,
    interruptionMode: 'doNotMix',
  });
}
