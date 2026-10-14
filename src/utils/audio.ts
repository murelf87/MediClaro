/**
 * Audio de la lectura en voz alta.
 * En iPhone, sin esto la voz NO suena si el interruptor de silencio está activado:
 * para personas mayores la lectura en voz alta es una función de accesibilidad.
 */
import { Platform } from 'react-native';
import { setAudioModeAsync } from 'expo-audio';

export async function configureAudioForSpeech(): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    await setAudioModeAsync({
      playsInSilentMode: true,
      shouldPlayInBackground: false,
      interruptionMode: 'duckOthers',
    });
  } catch {
    // Si el sistema no lo permite, la voz sigue funcionando con el modo por defecto.
  }
}
