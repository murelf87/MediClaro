/**
 * Pasos de «Cómo funciona» (Cuidador y avisos), con el segundo en que los cuenta la voz grabada de MediClaro
 * (Sulafat, assets/audio/tour-emergency-sulafat.wav). Sin React: se prueba en __tests__/careHowItWorks.test.ts.
 * El texto de cada paso es exactamente lo que dice la voz (la lista permitida del servidor de voz, tts-preview).
 */
import type { TourVisualId } from '../premium/TourScenes';

export interface CareStep {
  id: TourVisualId;
  /** Segundo de la grabación en que empieza este paso. */
  at: number;
  title: string;
  /** Lo que dice la voz en este paso (texto exacto de la grabación). */
  text: string;
}

/** Duración de la grabación (segundos). */
export const CARE_EXPLAIN_DURATION = 36.96;

/** Los pasos, con el segundo en que los cuenta la voz (medido sobre la grabación, con la imagen un poco antes). */
export const CARE_STEPS: CareStep[] = [
  { id: 'emergencyAlert', at: 0, title: 'Aviso a tu cuidador/a', text: 'Si MediClaro detecta una situación de malestar, puede avisar a tu cuidador o familiar vinculado, siempre que hayas autorizado esos avisos.' },
  { id: 'emergencyChat', at: 8.4, title: 'Un chat durante el aviso', text: 'Durante el aviso se abre un chat para que pueda hablar contigo y comprobar cómo estás.' },
  { id: 'emergencyLocation', at: 13.5, title: 'Tu ubicación, si quieres', text: 'También puedes compartir tu ubicación actual si das permiso.' },
  { id: 'emergencyRepeat', at: 17.1, title: 'Si no respondes', text: 'Si no respondes al mensaje de comprobación, se envía otro aviso.' },
  { id: 'emergency112', at: 21.0, title: 'El 112 lo decide una persona', text: 'Tu cuidador decide si necesita llamar al 112. Las llamadas autónomas al 112 están desactivadas.' },
  { id: 'emergencyCall', at: 28.9, title: 'Llamadas de voz', text: 'Las llamadas de voz por Internet requieren que estén disponibles en ambos teléfonos.' },
  { id: 'emergencyLimits', at: 33.6, title: 'Una ayuda, no un sustituto', text: 'MediClaro no sustituye a los servicios de emergencia.' },
];

/** Paso que toca en un segundo dado de la grabación. */
export function careStepAt(position: number, steps: CareStep[] = CARE_STEPS): number {
  let index = 0;
  for (let i = 0; i < steps.length; i += 1) if (position >= steps[i].at) index = i;
  return index;
}
