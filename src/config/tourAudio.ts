/**
 * Narración de «Conocer MediClaro»: UNA sola toma continua con UNA sola voz (Sulafat, la del principio de la
 * explicación), grabada con voz natural de Google Gemini e incluida en la app (sin red, sin cuotas).
 * Se monta con `node scripts/build-tour-track.mjs` a partir de la grabación assets/audio/tour-overview-sulafat.wav.
 * La voz (TOUR_VOICE) y la línea de tiempo están en config/tour.ts.
 *
 * Desde el 09/10/2026 ya no depende de la voz elegida en Accesibilidad: antes había dos voces y la explicación se
 * montaba uniendo cinco grabaciones, y al unirlas cambiaba el tono y había cortes.
 */
import type { AudioSource } from 'expo-audio';

/* eslint-disable @typescript-eslint/no-require-imports */
export const TOUR_TRACK: AudioSource = require('../../assets/audio/tour-full-sulafat.wav');
/* eslint-enable @typescript-eslint/no-require-imports */

/**
 * «Cómo funciona» de Cuidador y avisos: la explicación de los avisos al cuidador/a con la misma voz (Sulafat),
 * grabada e incluida en la app. Dura 36,96 s. Los pasos y el segundo en que la voz cuenta cada uno están en
 * screens/caregiver/CareHowItWorks.tsx.
 */
/* eslint-disable @typescript-eslint/no-require-imports */
export const CARE_EXPLAIN_TRACK: AudioSource = require('../../assets/audio/tour-emergency-sulafat.wav');
/* eslint-enable @typescript-eslint/no-require-imports */
