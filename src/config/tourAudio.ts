/**
 * Voz PREGRABADA de la explicación «Conocer MediClaro» (assets/audio, AAC mono 44,1 kHz, −16 LUFS).
 *
 * Grabada con la voz española «ef_dora» del modelo de voz libre Kokoro-82M (licencia Apache-2.0, uso
 * comercial permitido), ritmo pausado para personas mayores. Comprobación objetiva: transcrita
 * automáticamente (Whisper) sin ningún error de palabras en los 4 audios.
 *
 * Si falta el archivo de un paso, la app lee el mismo texto con la voz del sistema (expo-speech), así la
 * explicación con voz funciona siempre. Para cambiar la voz (p. ej. una locución profesional) basta con
 * sustituir los archivos manteniendo los nombres.
 */
import type { AudioSource } from 'expo-audio';

export type TourStepId = 'identify' | 'assistant' | 'voice' | 'emergency';

/* eslint-disable @typescript-eslint/no-require-imports */
export const TOUR_AUDIO: Partial<Record<TourStepId, AudioSource>> = {
  identify: require('../../assets/audio/tour-identify.m4a'),
  assistant: require('../../assets/audio/tour-assistant.m4a'),
  voice: require('../../assets/audio/tour-voice.m4a'),
  emergency: require('../../assets/audio/tour-emergency.m4a'),
};
/* eslint-enable @typescript-eslint/no-require-imports */
