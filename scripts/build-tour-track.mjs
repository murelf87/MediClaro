#!/usr/bin/env node
/**
 * Construye la narración de «Conocer MediClaro»: UNA sola toma de voz, de principio a fin, y su línea de tiempo.
 *
 *   node scripts/build-tour-track.mjs           → escribe assets/audio/tour-full-sulafat.wav y src/config/tourTimeline.json
 *   node scripts/build-tour-track.mjs --check   → solo comprueba que la línea de tiempo corresponde a la pista
 *
 * Desde el 09/10/2026 la explicación es una sola grabación continua con una sola voz (Sulafat, la del principio):
 * sin partes unidas, así no cambia el tono de la voz ni hay cortes entre una parte y otra. Si en el guion
 * (src/config/tourScript.json) hubiera varias partes, se unirían con una pausa, pero el guion actual tiene una.
 *
 * Entrada: la grabación assets/audio/tour-<parte>-sulafat.wav (Google Gemini TTS, PCM 16 bits, mono) y el texto de
 * src/config/tourScript.json. No usa la red ni ninguna clave.
 *
 * Qué hace:
 *  1. Aplica las reparaciones documentadas en scripts/tour-recording-repairs.json (solo si el archivo coincide).
 *  2. Quita silencios y restos del principio y del final, con fundidos muy cortos (sin «clics»).
 *  3. Ajusta el volumen.
 * Y calcula en qué segundo empieza cada imagen: alinea las pausas reales de la voz con los puntos y comas del texto.
 */
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const AUDIO = path.join(ROOT, 'assets/audio');
const SCRIPT = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/config/tourScript.json'), 'utf8'));
const REPAIRS = JSON.parse(fs.readFileSync(path.join(ROOT, 'scripts/tour-recording-repairs.json'), 'utf8')).repairs;
const TIMELINE_FILE = path.join(ROOT, 'src/config/tourTimeline.json');
/** Una sola voz para toda la explicación. */
export const VOICES = ['Sulafat'];

const LEAD_IN = 0.3; // silencio antes de empezar a hablar
const CHAPTER_GAP = 1.0; // pausa entre partes (como un punto y aparte)
const TAIL = 0.7; // silencio al final
const SCENE_LEAD = 0.2; // la imagen llega un poco antes que las palabras
const FRAME = 0.01; // 10 ms

const sha256 = (buf) => createHash('sha256').update(buf).digest('hex');

// ─── WAV PCM 16 bits mono ────────────────────────────────────────────────────

export function readWav(file) {
  return parseWav(fs.readFileSync(file), file);
}

/** WAV en memoria (por ejemplo, la respuesta del servidor de voz). */
export function parseWav(b, name = 'audio') {
  const file = name;
  if (b.toString('ascii', 0, 4) !== 'RIFF' || b.toString('ascii', 8, 12) !== 'WAVE') throw new Error(`${file}: no es un WAV`);
  let fmt = null;
  let data = null;
  for (let o = 12; o + 8 <= b.length; ) {
    const id = b.toString('ascii', o, o + 4);
    const size = b.readUInt32LE(o + 4);
    if (id === 'fmt ') fmt = o + 8;
    if (id === 'data') data = { start: o + 8, size: Math.min(size, b.length - o - 8) };
    o += 8 + size + (size % 2);
  }
  if (fmt === null || !data) throw new Error(`${file}: WAV incompleto`);
  const format = b.readUInt16LE(fmt);
  const channels = b.readUInt16LE(fmt + 2);
  const sampleRate = b.readUInt32LE(fmt + 4);
  const bits = b.readUInt16LE(fmt + 14);
  if (format !== 1 || channels !== 1 || bits !== 16) throw new Error(`${file}: se esperaba PCM 16 bits mono`);
  const n = Math.floor(data.size / 2);
  const samples = new Float32Array(n);
  for (let i = 0; i < n; i += 1) samples[i] = b.readInt16LE(data.start + i * 2) / 32768;
  return { sampleRate, samples, sha256: sha256(b) };
}

export function encodeWav(samples, sampleRate) {
  const b = Buffer.alloc(44 + samples.length * 2);
  b.write('RIFF', 0, 'ascii');
  b.writeUInt32LE(36 + samples.length * 2, 4);
  b.write('WAVE', 8, 'ascii');
  b.write('fmt ', 12, 'ascii');
  b.writeUInt32LE(16, 16);
  b.writeUInt16LE(1, 20);
  b.writeUInt16LE(1, 22);
  b.writeUInt32LE(sampleRate, 24);
  b.writeUInt32LE(sampleRate * 2, 28);
  b.writeUInt16LE(2, 32);
  b.writeUInt16LE(16, 34);
  b.write('data', 36, 'ascii');
  b.writeUInt32LE(samples.length * 2, 40);
  for (let i = 0; i < samples.length; i += 1) {
    const v = Math.max(-1, Math.min(1, samples[i]));
    b.writeInt16LE(Math.round(v * 32767), 44 + i * 2);
  }
  return b;
}

// ─── Análisis ────────────────────────────────────────────────────────────────

/** Energía (RMS) en ventanas de 10 ms. */
export function frameRms(x, sampleRate) {
  const f = Math.round(FRAME * sampleRate);
  const out = new Float32Array(Math.floor(x.length / f));
  for (let i = 0; i < out.length; i += 1) {
    let s = 0;
    for (let j = i * f; j < (i + 1) * f; j += 1) s += x[j] * x[j];
    out[i] = Math.sqrt(s / f);
  }
  return out;
}

/** Principio y final de la voz (ignora clics sueltos y restos de menos de unos 60 ms). */
export function speechBounds(rms) {
  const sustained = (i, dir) => {
    let hits = 0;
    for (let k = 0; k < 8; k += 1) {
      const j = i + k * dir;
      if (j >= 0 && j < rms.length && rms[j] > 0.012) hits += 1;
    }
    return hits >= 6;
  };
  let on = 0;
  while (on < rms.length && !(rms[on] > 0.02 && sustained(on, 1))) on += 1;
  let off = rms.length - 1;
  while (off > on && !(rms[off] > 0.006 && sustained(off, -1))) off -= 1;
  // El final de una palabra se apaga poco a poco: se incluye hasta que la energía cae de verdad.
  while (off + 1 < rms.length && rms[off + 1] > 0.004) off += 1;
  return { on, off };
}

/**
 * ¿La grabación está entera? Problemas reales encontrados en las de Gemini:
 *  - empieza con un resto de OTRA grabación («-macéutico»): hay voz desde el primer instante;
 *  - termina cortada a mitad de palabra («farma-»): sigue habiendo voz en los últimos milisegundos.
 * Devuelve la lista de problemas (vacía si está bien).
 */
export function clipProblems(samples, sampleRate, text) {
  const rms = frameRms(samples, sampleRate);
  const problems = [];
  const head = rms.slice(0, 15); // 150 ms
  if (head.filter((v) => v > 0.02).length > 3) problems.push('empieza con un resto de otra grabación');
  const tail = rms.slice(-10); // 100 ms
  if (tail.filter((v) => v < 0.012).length < 8) problems.push('termina cortada (sin silencio final)');
  const words = text.split(/\s+/).filter(Boolean).length;
  const seconds = samples.length / sampleRate;
  if (seconds < words / 4.2) problems.push(`demasiado corta (${seconds.toFixed(1)} s para ${words} palabras)`);
  if (seconds > words / 1.2 + 3) problems.push(`demasiado larga (${seconds.toFixed(1)} s para ${words} palabras)`);
  return problems;
}

/**
 * Pausas dentro de la voz: tramos de al menos `min` segundos sin voz. Una respiración entre frases cuenta como
 * pausa (es mucho más suave que la voz), así que el umbral es relativo a la voz normalizada (~0,13 de energía).
 */
export function findPauses(rms, on, off, min = 0.12) {
  const pauses = [];
  let start = -1;
  for (let i = on; i <= off; i += 1) {
    const quiet = rms[i] < 0.03;
    if (quiet && start < 0) start = i;
    if ((!quiet || i === off) && start >= 0) {
      const end = quiet ? i + 1 : i;
      if ((end - start) * FRAME >= min) pauses.push({ start: start * FRAME, end: end * FRAME, dur: (end - start) * FRAME });
      start = -1;
    }
  }
  return pauses;
}

/**
 * ¿En qué segundo empieza cada frase del texto? Dos niveles:
 *  1. Frases (punto, dos puntos…): cada final de frase va a una pausa real de la voz. Se elige la combinación de
 *     pausas que mejor encaja con la longitud de cada frase (programación dinámica): así unas comas con pausa
 *     larga («uno, uno, dos») no descolocan el resto.
 *  2. Comas dentro de cada frase: se sitúan en la pausa corta más cercana a donde deberían estar, si la hay.
 * Entre dos puntos conocidos se interpola por número de letras con la velocidad de esa frase.
 */
export function alignText(text, pauses, speechStart, speechEnd) {
  const strong = [];
  const commas = [];
  const re = /([.:;?!,])\s+/g;
  let m;
  while ((m = re.exec(text))) (m[1] === ',' ? commas : strong).push(m.index + m[0].length);
  const candidates = pauses.filter((p) => p.dur >= 0.18);
  const S = strong.length;

  const solve = (rate) => {
    if (S === 0 || candidates.length < S) return null;
    const seg = (t0, t1, chars) => {
      const expected = chars / rate;
      const d = t1 - t0 - expected;
      return (d * d) / Math.max(0.6, expected);
    };
    const bonus = (p) => 0.6 * Math.min(p.dur, 1);
    const P = candidates.length;
    const dp = Array.from({ length: S }, () => new Array(P).fill(Infinity));
    const from = Array.from({ length: S }, () => new Array(P).fill(-1));
    for (let j = 0; j < P; j += 1) dp[0][j] = seg(speechStart, candidates[j].start, strong[0]) - bonus(candidates[j]);
    for (let k = 1; k < S; k += 1) {
      for (let j = k; j < P; j += 1) {
        for (let i = k - 1; i < j; i += 1) {
          if (!Number.isFinite(dp[k - 1][i])) continue;
          const c = dp[k - 1][i] + seg(candidates[i].end, candidates[j].start, strong[k] - strong[k - 1]) - bonus(candidates[j]);
          if (c < dp[k][j]) { dp[k][j] = c; from[k][j] = i; }
        }
      }
    }
    let best = -1;
    let bestCost = Infinity;
    for (let j = S - 1; j < P; j += 1) {
      const c = dp[S - 1][j] + seg(candidates[j].end, speechEnd, text.length - strong[S - 1]);
      if (c < bestCost) { bestCost = c; best = j; }
    }
    if (best < 0) return null;
    const chosen = new Array(S);
    for (let k = S - 1, j = best; k >= 0; k -= 1) { chosen[k] = candidates[j]; j = from[k][j]; }
    return chosen;
  };

  // Velocidad inicial: letras / tiempo hablando (sin las pausas más largas); después, la medida con la solución.
  const longest = [...candidates].sort((a, b) => b.dur - a.dur).slice(0, S).reduce((s, p) => s + p.dur, 0);
  let rate = text.length / Math.max(1, speechEnd - speechStart - longest);
  let chosen = solve(rate);
  if (chosen) {
    const voiced = chosen.reduce((s, p, k) => s + (p.start - (k ? chosen[k - 1].end : speechStart)), 0) + (speechEnd - chosen[S - 1].end);
    rate = text.length / Math.max(1, voiced);
    chosen = solve(rate) ?? chosen;
  }

  // Tramos de frase: [inicio letra, fin letra, inicio s, fin s]. Si no se encuentran las pausas (grabación muy
  // seguida), se reparte el tiempo por número de letras.
  const bounds = [0, ...strong, text.length];
  const share = (c) => speechStart + ((speechEnd - speechStart) * c) / text.length;
  const times = chosen ? [speechStart, ...chosen.map((p) => p.end)] : bounds.slice(0, -1).map(share);
  const ends = chosen ? [...chosen.map((p) => p.start), speechEnd] : bounds.slice(1).map(share);
  const sentences = [];
  for (let k = 0; k + 1 < bounds.length && k < times.length; k += 1) {
    const c0 = bounds[k];
    const c1 = bounds[k + 1];
    const t0 = times[k];
    const t1 = ends[k];
    const inside = pauses.filter((p) => p.start > t0 + 0.1 && p.end < t1 - 0.1);
    const own = commas.filter((c) => c > c0 && c < c1);
    let local = (c1 - c0) / Math.max(0.3, t1 - t0 - inside.reduce((s, p) => s + p.dur, 0) * 0.5);
    const points = [{ char: c0, time: t0 }];
    let last = points[0];
    for (const c of own) {
      const expected = last.time + (c - last.char) / local;
      let pick = null;
      for (const p of inside) {
        if (p.start <= last.time + 0.1) continue;
        const d = Math.abs(p.start - expected);
        if (d <= 0.8 && (!pick || d - 0.3 * p.dur < Math.abs(pick.start - expected) - 0.3 * pick.dur)) pick = p;
      }
      if (pick) { last = { char: c, time: pick.end }; points.push(last); }
    }
    const used = points.slice(1).map((pt) => inside.find((p) => p.end === pt.time));
    local = (c1 - c0) / Math.max(0.3, t1 - t0 - used.reduce((s, p) => s + (p ? p.dur : 0), 0));
    sentences.push({ c0, c1, points, rate: local });
  }
  return { sentences, rate, aligned: !!chosen };
}

/** Segundo (dentro de la parte) en que se empieza a decir el carácter `char` del texto. */
export function timeOfChar(alignment, char) {
  const s = alignment.sentences.find((x) => char >= x.c0 && char < x.c1) ?? alignment.sentences[alignment.sentences.length - 1];
  let base = s.points[0];
  for (const p of s.points) if (p.char <= char) base = p;
  return base.time + (char - base.char) / s.rate;
}

// ─── Montaje ─────────────────────────────────────────────────────────────────

function concat(parts) {
  const n = parts.reduce((s, p) => s + p.length, 0);
  const out = new Float32Array(n);
  let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}

function fade(x, sampleRate, inSec, outSec) {
  const fi = Math.min(x.length, Math.round(inSec * sampleRate));
  for (let i = 0; i < fi; i += 1) x[i] *= 0.5 - 0.5 * Math.cos((Math.PI * i) / fi);
  const fo = Math.min(x.length, Math.round(outSec * sampleRate));
  for (let i = 0; i < fo; i += 1) x[x.length - 1 - i] *= 0.5 - 0.5 * Math.cos((Math.PI * i) / fo);
}

function loadChapter(chapterId, narration, voice, report) {
  const file = `tour-${chapterId}-${voice.toLowerCase()}.wav`;
  const wav = readWav(path.join(AUDIO, file));
  let x = wav.samples;
  const sr = wav.sampleRate;
  const fix = REPAIRS.find((r) => r.file === file && r.sha256 === wav.sha256);
  if (fix) {
    if (typeof fix.cutAt === 'number') x = x.slice(0, Math.round(fix.cutAt * sr));
    if (typeof fix.dropHead === 'number') x = x.slice(Math.round(fix.dropHead * sr));
    if (fix.appendFrom) {
      const src = readWav(path.join(AUDIO, fix.appendFrom.file));
      if (src.sha256 !== fix.appendFrom.sha256) throw new Error(`${file}: la reparación espera otra versión de ${fix.appendFrom.file}`);
      x = concat([x, src.samples.slice(Math.round(fix.appendFrom.from * sr), Math.round(fix.appendFrom.to * sr))]);
    }
    report.push(`${file}: reparada (${fix.why})`);
  }
  // Texto que de verdad se oye (si la grabación se ha recortado, las imágenes de lo que falta no se muestran).
  let spoken = narration;
  if (fix?.spokenUntil) {
    const at = narration.indexOf(fix.spokenUntil);
    if (at < 0) throw new Error(`${file}: «${fix.spokenUntil}» no está en el texto`);
    spoken = narration.slice(0, at + fix.spokenUntil.length);
  }
  const rms = frameRms(x, sr);
  const { on, off } = speechBounds(rms);
  const start = Math.max(0, on - 6); // 60 ms antes de la voz
  const end = Math.min(rms.length, off + 13); // 130 ms después
  const f = Math.round(FRAME * sr);
  const y = x.slice(start * f, end * f);
  fade(y, sr, 0.008, 0.04);
  // Volumen: misma energía media de voz en todas las partes (sin pasar del 95 % de pico).
  const yr = frameRms(y, sr);
  let sum = 0;
  let count = 0;
  for (const v of yr) if (v > 0.02) { sum += v * v; count += 1; }
  const active = Math.sqrt(sum / Math.max(1, count));
  let peak = 0;
  for (const v of y) peak = Math.max(peak, Math.abs(v));
  const gain = Math.min(0.13 / active, 0.95 / peak);
  for (let i = 0; i < y.length; i += 1) y[i] *= gain;
  const yr2 = frameRms(y, sr);
  const b = speechBounds(yr2);
  return {
    file,
    sha256: wav.sha256,
    sampleRate: sr,
    samples: y,
    speechStart: b.on * FRAME,
    speechEnd: (b.off + 1) * FRAME,
    pauses: findPauses(yr2, b.on, b.off),
    repaired: !!fix,
    spoken,
  };
}

export function buildVoice(voice) {
  const report = [];
  const chapters = SCRIPT.chapters.map((ch) => ({ ...ch, audio: loadChapter(ch.id, ch.narration, voice, report) }));
  const sr = chapters[0].audio.sampleRate;
  if (chapters.some((c) => c.audio.sampleRate !== sr)) throw new Error(`${voice}: las partes tienen distinta frecuencia`);
  const pieces = [new Float32Array(Math.round(LEAD_IN * sr))];
  let t = LEAD_IN;
  const spans = [];
  chapters.forEach((ch, i) => {
    if (i > 0) {
      pieces.push(new Float32Array(Math.round(CHAPTER_GAP * sr)));
      t += CHAPTER_GAP;
    }
    spans.push({ id: ch.id, offset: t, audio: ch.audio, narration: ch.audio.spoken });
    pieces.push(ch.audio.samples);
    t += ch.audio.samples.length / sr;
  });
  pieces.push(new Float32Array(Math.round(TAIL * sr)));
  const track = concat(pieces);
  const duration = track.length / sr;
  const round = (v) => Math.round(v * 100) / 100;

  const chaptersOut = spans.map((s, i) => ({
    id: s.id,
    // La parte «empieza» (imagen y barra) en mitad de la pausa anterior; la primera, al principio.
    start: i === 0 ? 0 : round(s.offset - CHAPTER_GAP / 2),
    speechStart: round(s.offset + s.audio.speechStart),
    speechEnd: round(s.offset + s.audio.speechEnd),
  }));
  chaptersOut.forEach((c, i) => { c.end = i + 1 < chaptersOut.length ? chaptersOut[i + 1].start : round(duration); });

  const scenes = [];
  for (const s of spans) {
    const al = alignText(s.narration, s.audio.pauses, s.audio.speechStart, s.audio.speechEnd);
    const chapter = chaptersOut.find((c) => c.id === s.id);
    for (const scene of SCRIPT.scenes.filter((x) => x.chapter === s.id)) {
      let at;
      if (!scene.anchor) at = chapter.start;
      else {
        const full = SCRIPT.chapters.find((c) => c.id === s.id).narration;
        if (!full.includes(scene.anchor)) throw new Error(`La escena ${scene.id} no encuentra «${scene.anchor}» en el texto`);
        const char = s.narration.indexOf(scene.anchor);
        // Esa frase no se oye en esta grabación (recortada hasta regenerarla): su imagen no se muestra.
        if (char < 0) continue;
        at = s.offset + timeOfChar(al, char) - SCENE_LEAD;
      }
      scenes.push({ id: scene.id, at: round(Math.max(chapter.start, at)) });
    }
  }
  for (let i = 1; i < scenes.length; i += 1) {
    if (scenes[i].at < scenes[i - 1].at + 0.8) throw new Error(`${voice}: las imágenes ${scenes[i - 1].id} y ${scenes[i].id} quedan demasiado juntas`);
  }
  return {
    voice,
    sampleRate: sr,
    track,
    duration: round(duration),
    chapters: chaptersOut,
    scenes,
    report,
    parts: spans.map((s) => ({ file: s.audio.file, sha256: s.audio.sha256, repaired: s.audio.repaired, complete: s.narration === SCRIPT.chapters.find((c) => c.id === s.id).narration })),
  };
}

function main() {
  const check = process.argv.includes('--check');
  const timeline = { generatedBy: 'scripts/build-tour-track.mjs', voices: {} };
  for (const voice of VOICES) {
    const built = buildVoice(voice);
    const file = `tour-full-${voice.toLowerCase()}.wav`;
    const wav = encodeWav(built.track, built.sampleRate);
    timeline.voices[voice] = { file, sha256: sha256(wav), duration: built.duration, parts: built.parts, chapters: built.chapters, scenes: built.scenes };
    if (!check) fs.writeFileSync(path.join(AUDIO, file), wav);
    for (const line of built.report) console.log(`  · ${line}`);
    console.log(`${voice}: ${built.duration.toFixed(1)} s, ${built.scenes.length} imágenes → ${file}`);
  }
  const json = JSON.stringify(timeline, null, 2) + '\n';
  if (check) {
    const current = fs.readFileSync(TIMELINE_FILE, 'utf8');
    if (current !== json) {
      console.error('La línea de tiempo no corresponde a las grabaciones. Ejecuta: node scripts/build-tour-track.mjs');
      process.exit(1);
    }
    for (const voice of VOICES) {
      const v = timeline.voices[voice];
      if (sha256(fs.readFileSync(path.join(AUDIO, v.file))) !== v.sha256) {
        console.error(`${v.file} no corresponde a la línea de tiempo. Ejecuta: node scripts/build-tour-track.mjs`);
        process.exit(1);
      }
    }
    console.log('Línea de tiempo y pistas al día.');
    return;
  }
  fs.writeFileSync(TIMELINE_FILE, json);
  console.log('Línea de tiempo → src/config/tourTimeline.json');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
