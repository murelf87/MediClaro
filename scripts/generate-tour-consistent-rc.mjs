/**
 * Regenera la voz de «Conocer MediClaro» (Google Gemini, función pública tts-preview con los textos permitidos) y
 * vuelve a montar la explicación. Desde el 09/10/2026 la explicación es UNA sola toma con UNA sola voz (Sulafat):
 * el texto entero se pide de una vez, así la voz no cambia de tono ni se corta entre partes.
 * En el PC del propietario, con internet:
 *
 *   node scripts/generate-tour-consistent-rc.mjs --revisar    → solo dice si la grabación actual está bien (sin red)
 *   node scripts/generate-tour-consistent-rc.mjs              → regenera solo si la grabación actual está mal
 *   node scripts/generate-tour-consistent-rc.mjs --todas      → regenera aunque esté bien (otra toma)
 *
 * Antes de regenerar: despliega tts-preview (su lista permitida incluye el texto de la toma única).
 * Escucha la toma nueva antes de publicar la app: si no te gusta, la anterior queda copiada (se indica dónde).
 *
 * Usa EXPO_PUBLIC_SUPABASE_URL y EXPO_PUBLIC_SUPABASE_ANON_KEY (la clave PÚBLICA de la app), del entorno, de
 * .env.qacheck o de .env. Ninguna clave secreta.
 *
 * Cada grabación nueva se comprueba antes de aceptarla: que empiece en silencio (sin restos de otra grabación),
 * que termine en silencio (sin cortar la última palabra) y que dure lo razonable para su texto. Si no, se pide
 * otra vez (hasta 6). La grabación actual solo se sustituye si la nueva sale bien.
 * Al terminar se monta la pista y la línea de tiempo (scripts/build-tour-track.mjs).
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { VOICES, clipProblems, encodeWav, frameRms, parseWav, readWav } from './build-tour-track.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const AUDIO = path.join(ROOT, 'assets/audio');
const SCRIPT = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/config/tourScript.json'), 'utf8'));
const ATTEMPTS = 6;
const REPAIRS = JSON.parse(fs.readFileSync(path.join(ROOT, 'scripts/tour-recording-repairs.json'), 'utf8')).repairs;
const args = new Set(process.argv.slice(2));

function env() {
  const out = {};
  for (const name of ['.env.qacheck', '.env']) {
    const file = path.join(ROOT, name);
    if (!fs.existsSync(file)) continue;
    for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
      const m = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
      if (m && !(m[1] in out)) out[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
    }
  }
  return { ...out, ...Object.fromEntries(Object.entries(process.env).filter(([k]) => k.startsWith('EXPO_PUBLIC_'))) };
}

const fileOf = (chapter, voice) => `tour-${chapter}-${voice.toLowerCase()}.wav`;

function review() {
  const bad = [];
  for (const voice of VOICES) {
    for (const ch of SCRIPT.chapters) {
      const wav = readWav(path.join(AUDIO, fileOf(ch.id, voice)));
      // Una grabación con reparación documentada que deja el texto ENTERO (termina en el final del guion) está bien.
      const fix = REPAIRS.find((r) => r.file === fileOf(ch.id, voice) && r.sha256 === wav.sha256);
      if (fix && typeof fix.cutAt === 'number' && fix.spokenUntil && ch.narration.trim().endsWith(fix.spokenUntil)) {
        console.log(`${(voice + ' · ' + ch.id).padEnd(22)} ✓ bien (se usa hasta «${fix.spokenUntil}», el final del texto)`);
        continue;
      }
      const problems = clipProblems(wav.samples, wav.sampleRate, ch.narration);
      console.log(`${(voice + ' · ' + ch.id).padEnd(22)} ${problems.length ? '✗ ' + problems.join('; ') : '✓ bien'}`);
      if (problems.length) bad.push({ voice, chapter: ch });
    }
  }
  return bad;
}

/** Mismo volumen medio de voz que el resto (la pista continua lo vuelve a igualar al montarla). */
function normalize(samples, sampleRate) {
  const rms = frameRms(samples, sampleRate);
  let sum = 0;
  let n = 0;
  for (const v of rms) if (v > 0.02) { sum += v * v; n += 1; }
  const active = Math.sqrt(sum / Math.max(1, n));
  let peak = 0;
  for (const v of samples) peak = Math.max(peak, Math.abs(v));
  const gain = Math.min(0.13 / Math.max(active, 1e-6), 0.95 / Math.max(peak, 1e-6));
  return samples.map((v) => v * gain);
}

async function synthesize(e, text, voice) {
  const key = e.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  const headers = { apikey: key, 'Content-Type': 'application/json' };
  if (key.startsWith('eyJ')) headers.Authorization = `Bearer ${key}`;
  const r = await fetch(`${e.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/tts-preview`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ text, voice, purpose: 'preview' }),
    signal: AbortSignal.timeout(120_000),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`servidor ${r.status}${data?.error ? ': ' + data.error : ''}`);
  if (data.voice && data.voice !== voice) throw new Error(`devolvió la voz ${data.voice}`);
  const buf = Buffer.from(data.audioBase64 ?? '', 'base64');
  return { wav: parseWav(buf, `${voice}`), model: data.model ?? null };
}

async function main() {
  console.log('Grabaciones actuales:');
  const bad = review();
  if (args.has('--revisar')) return;
  const targets = args.has('--todas') ? VOICES.flatMap((voice) => SCRIPT.chapters.map((chapter) => ({ voice, chapter }))) : bad;
  if (!targets.length) {
    console.log('\nTodas las grabaciones están bien. No hace falta regenerar nada.');
    return;
  }
  const e = env();
  if (!e.EXPO_PUBLIC_SUPABASE_URL || !e.EXPO_PUBLIC_SUPABASE_ANON_KEY) {
    throw new Error('Faltan EXPO_PUBLIC_SUPABASE_URL y EXPO_PUBLIC_SUPABASE_ANON_KEY (.env.qacheck, .env o el entorno).');
  }
  console.log(`\nRegenerando ${targets.length} grabaciones con Google Gemini…`);
  const ready = [];
  for (const { voice, chapter } of targets) {
    let accepted = null;
    for (let attempt = 1; attempt <= ATTEMPTS && !accepted; attempt += 1) {
      try {
        const { wav, model } = await synthesize(e, chapter.narration, voice);
        const problems = clipProblems(wav.samples, wav.sampleRate, chapter.narration);
        if (problems.length) {
          console.log(`  ${voice} · ${chapter.id}: intento ${attempt} descartado (${problems.join('; ')})`);
          continue;
        }
        accepted = { voice, chapter, samples: normalize(wav.samples, wav.sampleRate), sampleRate: wav.sampleRate, model };
        console.log(`  ${voice} · ${chapter.id}: ✓ (${(wav.samples.length / wav.sampleRate).toFixed(1)} s${model ? ', ' + model : ''})`);
      } catch (err) {
        console.log(`  ${voice} · ${chapter.id}: intento ${attempt} falló (${err.message})`);
        await new Promise((r) => setTimeout(r, 2000 * attempt));
      }
    }
    if (!accepted) throw new Error(`No se ha conseguido una grabación completa de ${voice} · ${chapter.id}. No se ha cambiado nada.`);
    ready.push(accepted);
  }

  // Copia de seguridad de las actuales (fuera del proyecto) y sustitución.
  const backup = fs.mkdtempSync(path.join(os.tmpdir(), 'mediclaro-voces-'));
  for (const r of ready) {
    const name = fileOf(r.chapter.id, r.voice);
    fs.copyFileSync(path.join(AUDIO, name), path.join(backup, name));
    fs.writeFileSync(path.join(AUDIO, name), encodeWav(r.samples, r.sampleRate));
  }
  console.log(`\nGrabaciones sustituidas (copia de las anteriores en ${backup}).`);
  console.log('Montando la explicación continua…');
  execFileSync(process.execPath, [path.join(ROOT, 'scripts/build-tour-track.mjs')], { stdio: 'inherit' });
  console.log('\nListo. Comprueba con: npx jest --config jest.config.js src/config/__tests__/tourTimeline.test.ts');
}

main().catch((err) => {
  console.error(`\n${err.message}`);
  process.exit(1);
});
