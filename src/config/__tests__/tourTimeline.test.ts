/**
 * La línea de tiempo de «Conocer MediClaro» corresponde EXACTAMENTE a la pista de voz incluida en la app y al
 * guion; si alguien regenera la grabación sin reconstruir la pista, este test lo detecta.
 * Desde el 09/10/2026: UNA sola voz y UNA sola toma continua (sin partes unidas).
 */
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import script from '../tourScript.json';
import timeline from '../tourTimeline.json';
import { TOUR_CHAPTERS, TOUR_SCENES, TOUR_TIMELINE, sceneIndexAt, tourProgress, type TourTimeline } from '../tour';

const root = path.resolve(__dirname, '../../..');
const sha = (file: string) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const voices = Object.entries(timeline.voices as Record<string, TourTimeline>);

describe('Una sola voz y una sola toma', () => {
  test('solo hay una voz (Sulafat) y la app solo incluye su pista', () => {
    expect(Object.keys(timeline.voices)).toEqual(['Sulafat']);
    const audio = fs.readFileSync(path.join(root, 'src/config/tourAudio.ts'), 'utf8');
    // Dos grabaciones, las dos de Sulafat: la explicación entera y la de «Cómo funciona» de Cuidador y avisos.
    expect(audio.match(/require\(/g)).toHaveLength(2);
    expect(audio).toContain('tour-full-sulafat.wav');
    expect(audio).toContain('tour-emergency-sulafat.wav');
    expect(audio).not.toMatch(/achird/i);
    expect(fs.existsSync(path.join(root, 'assets/audio/tour-full-achird.wav'))).toBe(false);
  });

  test('la explicación es UNA grabación continua, entera (termina en una frase completa)', () => {
    const v = (timeline.voices as Record<string, { parts: { file: string; complete: boolean }[] }>).Sulafat;
    expect(TOUR_CHAPTERS).toHaveLength(1);
    expect(v.parts).toHaveLength(1);
    expect(v.parts[0].complete).toBe(true);
    expect(TOUR_CHAPTERS[0].narration.trim().endsWith('.')).toBe(true);
  });
});

describe('Pistas y línea de tiempo', () => {
  test.each(voices)('%s: la pista incluida es la que describe la línea de tiempo', (_voice, tl) => {
    expect(sha(path.join(root, 'assets/audio', tl.file))).toBe(tl.sha256);
  });

  test.each(voices)('%s: las grabaciones por partes no han cambiado desde que se montó la pista', (voice) => {
    const parts = (timeline.voices as Record<string, { parts: { file: string; sha256: string }[] }>)[voice].parts;
    expect(parts).toHaveLength(TOUR_CHAPTERS.length);
    for (const part of parts) expect(sha(path.join(root, 'assets/audio', part.file))).toBe(part.sha256);
  });

  test.each(voices)('%s: partes seguidas, en orden y dentro de la duración', (_voice, tl) => {
    expect(tl.chapters.map((c) => c.id)).toEqual(TOUR_CHAPTERS.map((c) => c.id));
    expect(tl.chapters[0].start).toBe(0);
    tl.chapters.forEach((c, i) => {
      expect(c.start).toBeLessThan(c.speechStart);
      expect(c.speechStart).toBeLessThan(c.speechEnd);
      expect(c.speechEnd).toBeLessThanOrEqual(c.end);
      if (i > 0) expect(c.start).toBe(tl.chapters[i - 1].end);
    });
    expect(tl.chapters[tl.chapters.length - 1].end).toBe(tl.duration);
  });

  test.each(voices)('%s: cada parte empieza con su imagen y las imágenes van en orden del guion', (_voice, tl) => {
    const order = TOUR_SCENES.map((s) => s.id);
    let previous = -1;
    let previousAt = -1;
    for (const s of tl.scenes) {
      const index = order.indexOf(s.id);
      expect(index).toBeGreaterThan(previous);
      expect(s.at).toBeGreaterThan(previousAt);
      expect(s.at).toBeLessThan(tl.duration);
      previous = index;
      previousAt = s.at;
    }
    for (const c of tl.chapters) {
      const first = TOUR_SCENES.find((s) => s.chapter === c.id);
      expect(tl.scenes.find((s) => s.id === first?.id)?.at).toBe(c.start);
    }
  });

  test.each(voices)('%s: cada imagen dura lo suficiente para verla', (_voice, tl) => {
    const times = [...tl.scenes.map((s) => s.at), tl.duration];
    for (let i = 1; i < times.length; i += 1) expect(times[i] - times[i - 1]).toBeGreaterThanOrEqual(0.8);
  });
});

describe('Guion', () => {
  const server = fs.readFileSync(path.join(root, 'supabase/functions/tts-preview/index.ts'), 'utf8');
  // Textos EXACTOS de la lista permitida (el servidor compara el texto entero, no un trozo).
  const block = server.slice(server.indexOf('const ALLOWED = new Set(['), server.indexOf(']);', server.indexOf('const ALLOWED = new Set([')));
  const allowed = [...block.matchAll(/"((?:[^"\\]|\\.)*)"|'((?:[^'\\]|\\.)*)'/g)].map((m) => m[1] ?? m[2]);

  test.each(TOUR_CHAPTERS.map((c) => [c.id, c.narration]))('%s: el texto está permitido en tts-preview (se puede regenerar la voz)', (_id, text) => {
    expect(allowed).toContain(text);
  });

  test.each(TOUR_SCENES.filter((s) => s.anchor).map((s) => [s.id, s]))('%s: su frase está en el texto de su parte', (_id, scene) => {
    const chapter = script.chapters.find((c) => c.id === scene.chapter);
    expect(chapter?.narration.includes(scene.anchor ?? '')).toBe(true);
  });

  test('rótulos cortos y claros (para leer de un vistazo)', () => {
    for (const s of TOUR_SCENES) {
      expect(s.caption.length).toBeLessThanOrEqual(38);
      expect(s.detail.length).toBeLessThanOrEqual(90);
    }
  });

  test('el 112 nunca se presenta como automático', () => {
    const all = TOUR_SCENES.map((s) => `${s.caption} ${s.detail}`).join(' ') + TOUR_CHAPTERS.map((c) => c.narration).join(' ');
    expect(all).not.toMatch(/llama(rá)? automáticamente al (112|uno, uno, dos)/i);
  });

  test('no anuncia partes que ya no existen («paso a paso»)', () => {
    expect(TOUR_CHAPTERS[0].narration).not.toMatch(/paso a paso/);
    expect(TOUR_SCENES.map((s) => s.id)).not.toContain('steps');
  });
});

describe('Qué imagen toca en cada segundo', () => {
  const tl = TOUR_TIMELINE;

  test('imagen actual: la última que ya ha empezado', () => {
    expect(tl.scenes[sceneIndexAt(tl, 0)].id).toBe('welcome');
    const third = tl.scenes[2];
    expect(sceneIndexAt(tl, third.at)).toBe(2);
    expect(sceneIndexAt(tl, third.at - 0.01)).toBe(1);
    expect(sceneIndexAt(tl, tl.duration)).toBe(tl.scenes.length - 1);
  });

  test('barra de progreso continua (0 al empezar, 1 al terminar)', () => {
    expect(tourProgress(tl, 0)).toBe(0);
    expect(tourProgress(tl, tl.duration / 2)).toBeCloseTo(0.5, 2);
    expect(tourProgress(tl, tl.duration)).toBe(1);
    expect(tourProgress(tl, tl.duration + 5)).toBe(1);
    expect(tourProgress(tl, -1)).toBe(0);
  });
});
