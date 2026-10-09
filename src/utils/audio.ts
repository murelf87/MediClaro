/**
 * Sesión de audio del teléfono.
 *
 * - Lectura en voz alta (voz natural, asistente, explicación inicial): en iPhone, sin esto la voz NO suena si el
 *   interruptor de silencio está activado; para personas mayores la lectura en voz alta es una función de
 *   accesibilidad. Además devuelve el sonido al ALTAVOZ después de usar el micrófono.
 * - Grabación («Hablar con el asistente»): en iPhone, expo-audio rechaza `record()` (RecordingDisabledException) si
 *   antes no se ha activado la grabación en la sesión de audio. Al terminar hay que volver a la lectura.
 */
import { Platform } from 'react-native';
import { setAudioModeAsync } from 'expo-audio';

export async function configureAudioForSpeech(): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    await setAudioModeAsync({
      allowsRecording: false,
      playsInSilentMode: true,
      shouldPlayInBackground: false,
      shouldRouteThroughEarpiece: false,
      interruptionMode: 'duckOthers',
    });
  } catch {
    // Si el sistema no lo permite, la voz sigue funcionando con el modo por defecto.
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
