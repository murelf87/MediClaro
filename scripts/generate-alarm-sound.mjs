#!/usr/bin/env node
/**
 * Sonido de ALARMA de «Mis pastillas» (assets/sounds/mediclaro_alarma.wav), creado aquí mismo (sin derechos de
 * terceros):  node scripts/generate-alarm-sound.mjs
 *
 * Pensado para personas mayores:
 *  - tonos medios (Sol 5 – Do 5, 784 y 523 Hz): con la edad se pierden antes los agudos;
 *  - «din-don» de campana repetido 6 veces (10 s): insistente pero no estridente, sin chasquidos;
 *  - WAV PCM 16 bits mono 22 050 Hz: lo que aceptan iOS (sonidos de aviso de hasta 30 s) y Android (res/raw).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { encodeWav } from './build-tour-track.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'assets/sounds/mediclaro_alarma.wav');
const SR = 22050;
const CYCLE = 1.7; // segundos por «din-don, din-don»
const CYCLES = 6;
const DURATION = CYCLE * CYCLES;
const G5 = 783.99;
const C5 = 523.25;

/** Una campanada: fundamental + parciales de campana, ataque de 6 ms y caída exponencial. */
function bell(out, start, freq, gain) {
  const partials = [
    [1, 1],
    [2, 0.42],
    [3, 0.2],
    [4.2, 0.1],
  ];
  const len = Math.round(1.1 * SR);
  const s0 = Math.round(start * SR);
  for (let i = 0; i < len && s0 + i < out.length; i += 1) {
    const t = i / SR;
    const attack = Math.min(1, t / 0.006);
    let v = 0;
    for (const [k, a] of partials) v += a * Math.sin(2 * Math.PI * freq * k * t) * Math.exp(-t / (0.32 / Math.sqrt(k)));
    out[s0 + i] += gain * attack * v;
  }
}

const samples = new Float32Array(Math.round(DURATION * SR));
for (let c = 0; c < CYCLES; c += 1) {
  const t = c * CYCLE;
  bell(samples, t, G5, 1);
  bell(samples, t + 0.34, C5, 0.95);
  bell(samples, t + 0.68, G5, 1);
  bell(samples, t + 1.02, C5, 0.95);
}
// Volumen: pico al 89 % (sin saturar) y fundido final muy corto (sin chasquido).
let peak = 0;
for (const v of samples) peak = Math.max(peak, Math.abs(v));
const gain = 0.89 / peak;
const fade = Math.round(0.05 * SR);
for (let i = 0; i < samples.length; i += 1) {
  const tail = samples.length - 1 - i;
  samples[i] *= gain * (tail < fade ? tail / fade : 1);
}

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, encodeWav(samples, SR));
console.log(`${path.relative(ROOT, OUT)}: ${DURATION.toFixed(1)} s, ${(fs.statSync(OUT).size / 1024).toFixed(0)} KB`);
