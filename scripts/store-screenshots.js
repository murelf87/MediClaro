// Capturas para App Store y Google Play a partir de la build web de QA de la versión de TIENDA (sin compras).
// SOLO DESARROLLO. Datos de ejemplo (src/mocks), nunca datos reales.
// 1) Captura cada pantalla como en un iPhone de 393×852 pt a 3x (1179×2556 px).
// 2) Compone la imagen final (titular de store/FICHA_TIENDAS.md + teléfono) en los tamaños de cada tienda.
// Requisitos: Playwright con Chromium (npm i -D playwright && npx playwright install chromium).
// Uso:
//   QA_PAYMENTS_MODE=none bash scripts/qa-web.sh /tmp/qa-tienda
//   node scripts/serve-qa.js /tmp/qa-tienda 9400 &
//   node scripts/store-screenshots.js http://localhost:9400 /tmp/capturas
// Después, convertir a PNG sin transparencia (RGB) si la herramienta de edición la añade.
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const base = process.argv[2] || 'http://localhost:9400';
const OUT = process.argv[3] || 'store-capturas';
const RAW = path.join(OUT, '_raw');

const TARGETS = [
  { dir: 'iphone-6.9', w: 1320, h: 2868 },
  { dir: 'iphone-6.5', w: 1284, h: 2778 },
  { dir: 'android', w: 1080, h: 1920 },
];

/** La lectura en voz alta usa la voz del teléfono; en el navegador de pruebas no hay voces: se simula que habla. */
function fakeSpeech() {
  class FakeUtterance {
    constructor(text) {
      this.text = text || '';
      this.lang = 'es-ES';
      this.rate = 1;
      this.pitch = 1;
      this.volume = 1;
      this.voice = null;
    }
  }
  const voice = { name: 'Español', lang: 'es-ES', localService: true, default: true, voiceURI: 'es-ES' };
  const synth = {
    speaking: false,
    pending: false,
    paused: false,
    onvoiceschanged: null,
    getVoices() {
      return [voice];
    },
    speak(u) {
      this.speaking = true;
      this.current = u;
      setTimeout(() => u.onstart && u.onstart({ type: 'start' }), 20);
    },
    cancel() {
      this.speaking = false;
      this.current = null;
    },
    pause() {
      this.paused = true;
    },
    resume() {
      this.paused = false;
    },
    addEventListener() {},
    removeEventListener() {},
  };
  Object.defineProperty(window, 'speechSynthesis', { value: synth, configurable: true });
  window.SpeechSynthesisUtterance = FakeUtterance;
}

async function click(page, name) {
  for (const role of ['button', 'link', 'tab']) {
    const l = page.getByRole(role, { name, exact: false });
    if (await l.count()) return l.first().click();
  }
  return page.getByText(name, { exact: false }).first().click();
}

const SHOTS = [
  {
    id: '01-identificar',
    title: 'Una foto y sabrás qué medicamento es',
    route: '/result?id=70310&qa=',
    ready: 'Medicamento identificado',
  },
  {
    id: '02-ficha',
    title: 'Información oficial, clara y sencilla',
    route: '/medication/70310?qa=',
    ready: '¿Para qué se utiliza?',
  },
  {
    id: '03-voz',
    title: 'Escúchalo en voz alta, a tu ritmo',
    route: '/voice?id=70310&name=Paracetamol%201%20g&qa=',
    ready: 'Parte 1 de',
  },
  {
    id: '04-asistente',
    title: 'Pregunta tus dudas sobre el prospecto',
    route: '/assistant?medicationId=70310&medicationName=Paracetamol%201%20g&qa=',
    prepare: async (page) => {
      await click(page, '¿Para qué sirve');
      await page.waitForTimeout(800);
      await click(page, 'Aceptar y continuar');
      await page.getByText('El paracetamol sirve', { exact: false }).first().waitFor({ timeout: 10000 });
      await page.waitForTimeout(1200);
    },
  },
  {
    id: '05-mis-medicamentos',
    title: 'Tus medicamentos, siempre a mano',
    route: '/medicines?qa=',
    ready: 'Omeprazol',
  },
  {
    id: '06-emergencia',
    title: 'Emergencia: el 112 siempre a la vista',
    // La persona tiene configurado SU servicio de asistencia (independiente del 112).
    before: async (page) => {
      await page.goto(base + '/private-assistance?qa=', { waitUntil: 'networkidle' });
      await page.waitForTimeout(1500);
      await click(page, 'Usar otro número');
      await page.waitForTimeout(600);
      await page.getByLabel('Nombre del servicio', { exact: false }).first().fill('Mi teleasistencia');
      await page.getByLabel('Teléfono', { exact: false }).first().fill('900 000 000');
      await click(page, 'Guardar');
      await page.waitForTimeout(1200);
    },
    // Sin contacto personal en la captura (no se muestra ningún teléfono que pudiera ser de una persona real).
    route: '/emergency?qa=noprofile',
    ready: 'Llamar a Mi teleasistencia',
  },
];

function layout(t) {
  const aspect = 1179 / 2556;
  const padX = Math.round(t.w * 0.08);
  const fontSize = Math.round(t.w * (t.dir === 'android' ? 0.066 : 0.071));
  const top = Math.round(t.h * (t.dir === 'android' ? 0.05 : 0.052));
  const headH = Math.round(fontSize * 1.18 * 2);
  const gap = Math.round(t.h * (t.dir === 'android' ? 0.03 : 0.028));
  const bottom = Math.round(t.h * 0.03);
  const bezel = Math.round(t.w * 0.013);
  let innerH = t.h - top - headH - gap - bottom - 2 * bezel;
  let innerW = Math.round(innerH * aspect);
  const maxInnerW = t.w - 2 * Math.round(t.w * 0.09) - 2 * bezel;
  if (innerW > maxInnerW) {
    innerW = maxInnerW;
    innerH = Math.round(innerW / aspect);
  }
  const radius = Math.round(innerW * 0.085);
  return { padX, fontSize, top, headH, gap, bezel, innerW, innerH, radius };
}

function html(t, title, imgB64) {
  const L = layout(t);
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><style>
  html,body{margin:0;padding:0}
  body{width:${t.w}px;height:${t.h}px;overflow:hidden;
    background:linear-gradient(180deg,#D9E8FC 0%,#EEF5FE 42%,#FFFFFF 100%);
    font-family:'Liberation Sans',Arial,Helvetica,sans-serif;display:flex;flex-direction:column;align-items:center}
  h1{box-sizing:border-box;width:100%;height:${L.headH}px;margin:${L.top}px 0 ${L.gap}px;padding:0 ${L.padX}px;
    color:#16307E;font-size:${L.fontSize}px;line-height:1.18;font-weight:700;text-align:center;letter-spacing:-0.5px;
    text-wrap:balance;display:flex;align-items:center;justify-content:center}
  .phone{background:#0F2463;padding:${L.bezel}px;border-radius:${L.radius + L.bezel}px;
    box-shadow:0 ${Math.round(L.bezel * 1.6)}px ${L.bezel * 4}px rgba(15,36,99,.28)}
  .screen{width:${L.innerW}px;height:${L.innerH}px;border-radius:${L.radius}px;overflow:hidden;background:#fff}
  .screen img{width:100%;height:100%;display:block}
  </style></head><body><h1>${title}</h1><div class="phone"><div class="screen"><img src="data:image/png;base64,${imgB64}"></div></div></body></html>`;
}

(async () => {
  fs.mkdirSync(RAW, { recursive: true });
  const browser = await chromium.launch();
  const report = [];
  for (const s of SHOTS) {
    const ctx = await browser.newContext({
      viewport: { width: 393, height: 852 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, locale: 'es-ES', colorScheme: 'light',
    });
    await ctx.addInitScript(fakeSpeech);
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('dialog', (d) => d.accept().catch(() => {}));
    try {
      if (s.before) await s.before(page);
      await page.goto(base + s.route, { waitUntil: 'networkidle' });
      await page.waitForTimeout(1800);
      if (s.prepare) await s.prepare(page);
      if (s.ready) await page.getByText(s.ready, { exact: false }).first().waitFor({ timeout: 10000 });
      await page.waitForTimeout(900);
      const file = path.join(RAW, `${s.id}.png`);
      await page.screenshot({ path: file });
      report.push({ id: s.id, ok: true, errors });
    } catch (e) {
      await page.screenshot({ path: path.join(RAW, `FALLO-${s.id}.png`) }).catch(() => {});
      report.push({ id: s.id, ok: false, error: String(e.message).slice(0, 300), errors });
    }
    await ctx.close();
  }

  for (const t of TARGETS) {
    fs.mkdirSync(path.join(OUT, t.dir), { recursive: true });
    const ctx = await browser.newContext({ viewport: { width: t.w, height: t.h }, deviceScaleFactor: 1 });
    const page = await ctx.newPage();
    for (const s of SHOTS) {
      const raw = path.join(RAW, `${s.id}.png`);
      if (!fs.existsSync(raw)) continue;
      await page.setContent(html(t, s.title, fs.readFileSync(raw).toString('base64')), { waitUntil: 'load' });
      await page.waitForTimeout(150);
      await page.screenshot({ path: path.join(OUT, t.dir, `${s.id}.png`), clip: { x: 0, y: 0, width: t.w, height: t.h } });
    }
    await ctx.close();
  }
  await browser.close();
  for (const r of report) console.log(`${r.ok ? 'OK  ' : 'FALLO'} ${r.id}${r.ok ? '' : ` — ${r.error}`}${r.errors.length ? ` · errores: ${r.errors.join(' | ')}` : ''}`);
  process.exit(report.every((r) => r.ok && r.errors.length === 0) ? 0 : 1);
})();
