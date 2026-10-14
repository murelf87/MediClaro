#!/usr/bin/env node
/**
 * Sonidos de las LLAMADAS de voz entre paciente y cuidador/a, creados aquí mismo (sin derechos de terceros):
 *   node scripts/generate-call-sounds.mjs
 *
 *  - assets/sounds/mediclaro_llamada.wav       Llamada ENTRANTE: «tilín-tilín» suave en tonos medios (Mi 5 – La 5),
 *                                               ~1 s sonando y ~0,9 s de pausa, 3 veces (la app lo repite mientras suena).
 *  - assets/sounds/mediclaro_tono_llamada.wav  Quien LLAMA oye el tono de llamada de España (425 Hz: 1,5 s sí, 3 s no).
 *
 * WAV PCM 16 bits mono 22 050 Hz (lo que reproducen iOS, Android y el navegador). Volumen moderado y sin chasquidos.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { encodeWav } from './build-tour-track.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SR = 22050;

/** Nota con ataque corto y caída suave (timbre de marimba: fundamental + 4.ª armónica tenue). */
function note(out, start, freq, length, gain) {
  const s0 = Math.round(start * SR);
  const len = Math.round(length * SR);
  for (let i = 0; i < len && s0 + i < out.length; i += 1) {
    const t = i / SR;
    const env = Math.min(1, t / 0.004) * Math.exp(-t / 0.14);
    out[s0 + i] += gain * env * (Math.sin(2 * Math.PI * freq * t) + 0.18 * Math.sin(2 * Math.PI * freq * 4 * t));
  }
}

function normalize(samples, peakTarget) {
  let peak = 0;
  for (const v of samples) peak = Math.max(peak, Math.abs(v));
  const k = peak ? peakTarget / peak : 1;
  const fade = Math.round(0.02 * SR);
  for (let i = 0; i < samples.length; i += 1) {
    const edge = Math.min(i, samples.length - 1 - i);
    samples[i] *= k * (edge < fade ? edge / fade : 1);
  }
  return samples;
}

function write(rel, samples) {
  const out = path.join(ROOT, rel);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, encodeWav(samples, SR));
  console.log(`${rel}: ${(samples.length / SR).toFixed(1)} s, ${(fs.statSync(out).size / 1024).toFixed(0)} KB`);
}

// Llamada entrante: 3 ciclos de 1,9 s.
{
  const E5 = 659.25;
  const A5 = 880;
  const CYCLE = 1.9;
  const samples = new Float32Array(Math.round(CYCLE * 3 * SR));
  for (let c = 0; c < 3; c += 1) {
    const t0 = c * CYCLE;
    [E5, A5, E5, A5, E5, A5].forEach((f, i) => note(samples, t0 + i * 0.16, f, 0.5, i % 2 ? 0.9 : 1));
  }
  write('assets/sounds/mediclaro_llamada.wav', normalize(samples, 0.8));
}

// Tono de llamada (quien llama): 425 Hz, 1,5 s sonando y 3 s de silencio.
{
  const samples = new Float32Array(Math.round(4.5 * SR));
  const on = Math.round(1.5 * SR);
  const ramp = Math.round(0.02 * SR);
  for (let i = 0; i < on; i += 1) {
    const edge = Math.min(i, on - 1 - i);
    samples[i] = Math.sin(2 * Math.PI * 425 * (i / SR)) * (edge < ramp ? edge / ramp : 1);
  }
  write('assets/sounds/mediclaro_tono_llamada.wav', normalize(samples, 0.35));
}
