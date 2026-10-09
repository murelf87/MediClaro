/**
 * «Conocer MediClaro»: guion, imágenes y línea de tiempo de la presentación continua.
 *
 *  - tourScript.json   → lo que dice la voz (igual que la lista permitida de `tts-preview`) y las imágenes,
 *                        cada una con la frase en la que debe aparecer.
 *  - tourTimeline.json → segundo exacto de cada imagen en la pista. Lo GENERA `node scripts/build-tour-track.mjs`
 *                        a partir de la grabación; no se edita a mano.
 *
 * Desde el 09/10/2026 la explicación es UNA sola toma con UNA sola voz (Sulafat), sin partes: una barra de progreso
 * continua y las imágenes que cambian con la voz. Los tipos conservan las partes e imágenes antiguas (identificar,
 * asistente, lectura, emergencias) por si se vuelven a grabar en una sola toma más adelante.
 *
 * La pantalla no conoce audio ni archivos: pregunta aquí qué imagen toca en el segundo actual.
 */
import type { IconName } from '../components/Icon';
import script from './tourScript.json';
import timeline from './tourTimeline.json';

export type TourChapterId = 'overview' | 'identify' | 'assistant' | 'voice' | 'emergency';

export type TourSceneId =
  | 'welcome'
  | 'problem'
  | 'together'
  | 'featurePhoto'
  | 'featureAsk'
  | 'featureListen'
  | 'featureSave'
  | 'featureReady'
  | 'people'
  | 'trust'
  | 'premium'
  | 'steps'
  | 'identifyPhoto'
  | 'identifyResult'
  | 'identifyOfficial'
  | 'assistantAsk'
  | 'assistantAnswer'
  | 'assistantLimits'
  | 'voiceRead'
  | 'emergencyAlert'
  | 'emergencyChat'
  | 'emergencyLocation'
  | 'emergencyRepeat'
  | 'emergency112'
  | 'emergencyCall'
  | 'emergencyLimits';

export interface TourChapter {
  id: TourChapterId;
  title: string;
  /** Lo que dice la voz (idéntico a la lista permitida del servidor para poder regenerarlo). */
  narration: string;
  icon: IconName;
  color: string;
  soft: string;
}

export interface TourScene {
  id: TourSceneId;
  chapter: TourChapterId;
  /** Frase del texto con la que aparece la imagen (null = al empezar la parte). */
  anchor: string | null;
  caption: string;
  detail: string;
}

export interface TimedChapter {
  id: TourChapterId;
  /** Segundo en que empieza la parte (imagen y barra), un poco antes de que hable la voz. */
  start: number;
  speechStart: number;
  speechEnd: number;
  end: number;
}

export interface TimedScene {
  id: TourSceneId;
  /** Segundo de la pista en que aparece la imagen. */
  at: number;
}

export interface TourTimeline {
  file: string;
  sha256: string;
  duration: number;
  chapters: TimedChapter[];
  scenes: TimedScene[];
}

const CHAPTER_STYLE: Record<TourChapterId, Pick<TourChapter, 'icon' | 'color' | 'soft'>> = {
  overview: { icon: 'sparkles', color: '#1D4ED8', soft: '#E6F0FF' },
  identify: { icon: 'camera', color: '#059669', soft: '#E3F8EF' },
  assistant: { icon: 'chatbubbles', color: '#2563EB', soft: '#E8EEFF' },
  voice: { icon: 'volume-high', color: '#7C3AED', soft: '#F1ECFF' },
  emergency: { icon: 'location', color: '#D97706', soft: '#FFF3E0' },
};

export const TOUR_CHAPTERS: TourChapter[] = (script.chapters as { id: TourChapterId; title: string; narration: string }[]).map((c) => ({
  ...c,
  ...CHAPTER_STYLE[c.id],
}));

export const TOUR_SCENES: TourScene[] = script.scenes as TourScene[];

const SCENE_BY_ID = new Map(TOUR_SCENES.map((s) => [s.id, s]));
const CHAPTER_BY_ID = new Map(TOUR_CHAPTERS.map((c) => [c.id, c]));

export function tourScene(id: TourSceneId): TourScene {
  const scene = SCENE_BY_ID.get(id);
  if (!scene) throw new Error(`Escena desconocida: ${id}`);
  return scene;
}

export function tourChapter(id: TourChapterId): TourChapter {
  const chapter = CHAPTER_BY_ID.get(id);
  if (!chapter) throw new Error(`Parte desconocida: ${id}`);
  return chapter;
}

/** Única voz de la explicación (la del principio): Sulafat. La pista está en config/tourAudio.ts. */
export const TOUR_VOICE = 'Sulafat' as const;

/** Línea de tiempo de la única pista de la explicación. */
export const TOUR_TIMELINE: TourTimeline = (timeline as { voices: Record<typeof TOUR_VOICE, TourTimeline> }).voices[TOUR_VOICE];

/** Imagen que toca en el segundo `t` (la última que ya ha empezado). */
export function sceneIndexAt(tl: TourTimeline, t: number): number {
  let index = 0;
  for (let i = 0; i < tl.scenes.length; i += 1) if (tl.scenes[i].at <= t) index = i;
  return index;
}

/** Cuánto se ha recorrido de la explicación (0–1), para la barra de progreso. */
export function tourProgress(tl: TourTimeline, t: number): number {
  return Math.max(0, Math.min(1, t / Math.max(0.1, tl.duration)));
}
