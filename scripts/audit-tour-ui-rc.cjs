// Auditoría de «Conocer MediClaro» (presentación continua): UNA sola pista y UNA sola voz de principio a fin (sin
// partes), las imágenes cambian con la voz, la pausa para el audio, «Empezar de nuevo» vuelve al principio y al
// final aparece el botón para seguir.
// Mismo entorno que antes: build web de QA en http://127.0.0.1:8765 (scripts/serve-qa.js) y Edge en Windows.
// FULL_TOUR=1 escucha la explicación entera (1 min y 20 s); si no, salta al final.
const path = require('path'), os = require('os'), fs = require('fs'), assert = require('assert/strict');
const { chromium } = require(path.join(os.tmpdir(), 'mediclaro-visual-tools/node_modules/playwright'));
const timeline = JSON.parse(fs.readFileSync(path.join(__dirname, '../src/config/tourTimeline.json'), 'utf8')).voices.Sulafat;
let browser;
(async () => {
  browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true, args: ['--autoplay-policy=no-user-gesture-required'] });
  const context = await browser.newContext({ viewport: { width: 393, height: 852 }, isMobile: true, hasTouch: true });
  await context.addInitScript(() => { const Original = window.Audio; window.__tourAudio = []; window.Audio = function (...args) { const a = new Original(...args); window.__tourAudio.push(a); return a; }; window.Audio.prototype = Original.prototype; });
  const page = await context.newPage(); const errors = []; page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('http://127.0.0.1:8765/tour?qa=premium', { waitUntil: 'networkidle' });
  const track = () => page.evaluate(() => { const a = window.__tourAudio.filter((x) => x.src.includes('tour-full-')).pop(); return a ? { src: a.src, t: a.currentTime, d: a.duration, paused: a.paused, ended: a.ended } : null; });
  const scene = () => page.evaluate(() => document.querySelector('[data-testid^="tour-scene-"]')?.getAttribute('data-testid'));
  await page.waitForFunction(() => window.__tourAudio.some((a) => a.src.includes('tour-full-') && a.currentTime > 0.3 && !a.paused), null, { timeout: 20000 });
  assert.equal(await page.evaluate(() => window.__tourAudio.filter((a) => a.src.includes('tour-')).length), 1, 'Una sola pista para toda la explicación');
  assert.equal(await page.getByTestId('tour-next').count(), 0, 'Sin botón Siguiente');
  console.log(JSON.stringify({ track: await track(), scene: await scene() }));

  // Pausa: el audio se detiene de verdad; continuar sigue donde estaba.
  await page.getByTestId('tour-pause').click();
  const before = (await track()).t; await page.waitForTimeout(600); const after = (await track()).t;
  assert(Math.abs(after - before) < 0.1, 'La pausa detiene la voz');
  await page.getByTestId('tour-pause').click(); await page.waitForTimeout(800);
  assert(!(await track()).paused, 'Continuar vuelve a sonar');

  // Sin partes: una sola barra de progreso y ningún «1 de 5».
  assert.equal(await page.locator('[data-testid^="tour-chapter-"]').count(), 0, 'Sin partes');
  assert.equal(await page.getByTestId('tour-progress').count(), 1, 'Una barra de progreso');
  assert(!/\d de \d/.test(await page.locator('body').innerText()), 'Sin «x de 5»');

  // «Empezar de nuevo»: vuelve al principio, con la primera imagen.
  await page.evaluate(() => { const a = window.__tourAudio.filter((x) => x.src.includes('tour-full-')).pop(); a.currentTime = 30; });
  await page.waitForTimeout(900);
  await page.getByTestId('tour-replay').click(); await page.waitForTimeout(900);
  assert((await track()).t < 2.5, 'Empezar de nuevo vuelve al principio');
  assert.equal(await scene(), `tour-scene-${timeline.scenes[0].id}`);

  // Final: o se escucha entera (FULL_TOUR=1) o se salta a los últimos segundos.
  if (process.env.FULL_TOUR === '1') {
    await page.getByTestId('tour-replay').click();
    await page.waitForFunction(() => window.__tourAudio.some((a) => a.src.includes('tour-full-') && a.ended), null, { timeout: (timeline.duration + 60) * 1000 });
  } else {
    await page.evaluate(() => { const a = window.__tourAudio.filter((x) => x.src.includes('tour-full-')).pop(); a.currentTime = Math.max(0, a.duration - 0.5); });
  }
  await page.getByTestId('tour-finish').waitFor({ timeout: 15000 });
  assert.equal(await scene(), 'tour-scene-final');
  assert.equal(errors.length, 0, JSON.stringify(errors));
  await page.screenshot({ path: 'qa-ui-rc/tour-automatic.png' });
  console.log('CONTINUOUS_TOUR_REAL_PLAYBACK=PASS');
  await browser.close();
})().catch((e) => { console.error(e); process.exitCode = 1; }).finally(async () => { await browser?.close(); });
