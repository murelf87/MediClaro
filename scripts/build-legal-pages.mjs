/**
 * Páginas públicas de MediClaro para las tiendas (GitHub Pages, carpeta docs/): privacidad, condiciones, aviso legal y
 * soporte. Usan EXACTAMENTE los mismos textos que la app (src/content/legal.ts), para que la web y la app digan lo mismo.
 *
 * - Los datos del titular se leen de las mismas variables que la app: EXPO_PUBLIC_COMPANY_NAME,
 *   EXPO_PUBLIC_COMPANY_TAX_ID, EXPO_PUBLIC_COMPANY_ADDRESS y EXPO_PUBLIC_SUPPORT_EMAIL. Nunca se inventan: si faltan,
 *   los textos dicen «el titular de MediClaro», igual que la app.
 * - Precios: los del catálogo del servidor (app_config.plans). Si cambian allí, cámbialos en PLANS y vuelve a generar.
 *
 * Uso: node scripts/build-legal-pages.mjs   (escribe docs/*.html; no publica nada por sí solo)
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const ts = require('typescript');
const root = process.cwd();
const out = path.join(root, 'docs');

/** Igual que app_config.plans (migración 20260929090400_v6_store_billing_premium_only.sql). */
const PLANS = [
  { period: 'monthly', priceCents: 499 },
  { period: 'quarterly', priceCents: 1299 },
  { period: 'annual', priceCents: 3999 },
];
const periodName = (p) => (p === 'annual' ? 'Anual' : p === 'quarterly' ? 'Trimestral' : 'Mensual');
const perPeriodPhrase = (p) => (p === 'annual' ? 'al año' : p === 'quarterly' ? 'cada 3 meses' : 'al mes');
const price = (cents) => `${Math.floor(cents / 100)},${String(cents % 100).padStart(2, '0')} €`;

// ── Cargar los textos de la app (TypeScript → JavaScript, en una carpeta temporal) ─────────────────────
function loadLegal() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mediclaro-legal-'));
  for (const rel of ['src/content/legal.ts', 'src/config/assistant.ts']) {
    const source = fs.readFileSync(path.join(root, rel), 'utf8');
    const { outputText } = ts.transpileModule(source, {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
    });
    const dest = path.join(tmp, rel.replace(/\.ts$/, '.js'));
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, outputText);
  }
  return require(path.join(tmp, 'src/content/legal.js'));
}

const legal = loadLegal();
const env = (k) => (process.env[k] ?? '').trim();
const ctx = {
  company: { name: env('EXPO_PUBLIC_COMPANY_NAME'), taxId: env('EXPO_PUBLIC_COMPANY_TAX_ID'), address: env('EXPO_PUBLIC_COMPANY_ADDRESS') },
  supportEmail: env('EXPO_PUBLIC_SUPPORT_EMAIL'),
  purchases: true,
  planLines: PLANS.map((p) => `${periodName(p.period)}: ${price(p.priceCents)} ${perPeriodPhrase(p.period)} (IVA incluido)`),
};

// ── HTML ────────────────────────────────────────────────────────────────────────────────────────────
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function blocksHtml(blocks) {
  return blocks
    .map((b) => {
      if ('h' in b) return `<h2>${esc(b.h)}</h2>`;
      if ('p' in b) return `<p>${esc(b.p)}</p>`;
      return `<ul>${b.list.map((li) => `<li>${esc(li)}</li>`).join('')}</ul>`;
    })
    .join('\n');
}

const PAGES = [
  { file: 'privacidad.html', nav: 'Privacidad', title: 'Política de privacidad' },
  { file: 'condiciones.html', nav: 'Condiciones', title: 'Condiciones de uso' },
  { file: 'aviso-legal.html', nav: 'Aviso legal', title: 'Aviso legal' },
  { file: 'eliminar-cuenta.html', nav: 'Eliminar cuenta', title: 'Eliminar tu cuenta' },
  { file: 'soporte.html', nav: 'Ayuda', title: 'Ayuda y contacto' },
];

// ── Guardia de versión ──────────────────────────────────────────────────────────────────────────────
// Un texto legal aprobado y publicado NO se puede perder por volver a ejecutar este script. Cada página
// lleva su versión en una etiqueta <meta>; si la que hay en disco es POSTERIOR a la de src/content/legal.ts,
// el script no escribe nada y avisa. Para publicar un cambio nuevo, sube LEGAL_VERSION en ese archivo.
const VERSION_META = 'mediclaro-legal-version';

/** Versión publicada en un HTML ya escrito, o null si no la declara (páginas anteriores a esta guardia). */
function publishedVersion(html) {
  const m = html.match(new RegExp(`<meta name="${VERSION_META}" content="([^"]+)">`));
  return m ? m[1] : null;
}

/** Compara versiones con formato `AAAA-MM-DD` o `AAAA-MM-DD.N`: <0, 0 o >0. */
function compareVersions(a, b) {
  const parse = (v) => {
    const [date, rev = '0'] = String(v).split('.');
    return { date, rev: Number.parseInt(rev, 10) || 0 };
  };
  const pa = parse(a);
  const pb = parse(b);
  if (pa.date !== pb.date) return pa.date < pb.date ? -1 : 1;
  return pa.rev - pb.rev;
}

const CSS = `
:root{--bg:#f7fafc;--card:#ffffff;--text:#172033;--muted:#4b5565;--brand:#0f4c81;--line:#dce7f0;--accent:#0f6cbd}
@media (prefers-color-scheme:dark){:root{--bg:#0d1520;--card:#142131;--text:#e8eef5;--muted:#a9b6c6;--brand:#8cc4ff;--line:#24364b;--accent:#8cc4ff}}
*{box-sizing:border-box}
html{-webkit-text-size-adjust:100%}
body{margin:0;background:var(--bg);color:var(--text);font:19px/1.65 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif}
a{color:var(--accent)}
header{background:var(--card);border-bottom:1px solid var(--line)}
.wrap{max-width:760px;margin:0 auto;padding-left:18px;padding-right:18px}
.top{display:flex;flex-wrap:wrap;align-items:center;gap:10px 18px;padding-top:16px;padding-bottom:16px}
.brand{font-weight:800;font-size:1.25rem;color:var(--brand);text-decoration:none;margin-right:auto}
nav a{text-decoration:none;font-weight:600;padding:6px 2px}
nav a[aria-current="page"]{color:var(--text);border-bottom:3px solid var(--brand)}
main{padding-top:28px;padding-bottom:40px}
h1{font-size:1.9rem;line-height:1.25;color:var(--brand);margin:0 0 8px}
h2{font-size:1.25rem;margin:30px 0 8px}
p,li{max-width:70ch}
ul{padding-left:1.2em}
li{margin:6px 0}
.note{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:14px 18px;margin:18px 0}
footer{border-top:1px solid var(--line);color:var(--muted);font-size:.9rem;padding-top:18px;padding-bottom:34px}
`;

function page({ file, title }, body) {
  const nav = PAGES.map(
    (p) => `<a href="${p.file}"${p.file === file ? ' aria-current="page"' : ''}>${esc(p.nav)}</a>`,
  ).join('\n        ');
  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)} · MediClaro</title>
<meta name="description" content="${esc(title)} de MediClaro, la app que explica tus medicamentos con palabras sencillas.">
<meta name="${VERSION_META}" content="${esc(legal.LEGAL_VERSION)}">
<style>${CSS}</style>
</head>
<body>
<header>
  <div class="wrap top">
    <a class="brand" href="index.html">MediClaro</a>
    <nav aria-label="Páginas">
        ${nav}
    </nav>
  </div>
</header>
<main class="wrap">
<h1>${esc(title)}</h1>
${body}
</main>
<footer class="wrap">
  <p>Versión ${esc(legal.LEGAL_VERSION)}, en vigor desde el ${esc(legal.LEGAL_UPDATED)}. Los mismos textos se pueden leer dentro de la app: Perfil › Información legal.</p>
</footer>
</body>
</html>
`;
}

const contactLine = ctx.supportEmail
  ? `<p>Correo: <a href="mailto:${esc(ctx.supportEmail)}">${esc(ctx.supportEmail)}</a></p>`
  : '';

const support = `
<p>MediClaro explica la información oficial de los medicamentos con palabras sencillas. Si algo no funciona o tienes una duda, estamos para ayudarte.</p>
<h2>Desde la app</h2>
<ul>
<li><strong>Preguntas frecuentes:</strong> Perfil › Ayuda.</li>
<li><strong>Notifícanos un error:</strong> Perfil › Ayuda › «Notifícanos un error». Cuéntanos qué ha pasado (también puedes dictarlo) y, si quieres respuesta, deja un teléfono o un correo. Te daremos una referencia para que puedas citarla.</li>
</ul>
${contactLine ? `<h2>Escríbenos</h2>\n${contactLine}` : ''}
<h2>Tu suscripción</h2>
<ul>
<li>Para cancelar: Perfil › MediClaro Premium › Gestionar suscripción. Si la contrataste con Apple, también en Ajustes del iPhone › tu nombre › Suscripciones.</li>
<li>Si cambias de teléfono: en la primera pantalla, «Ya soy Premium», o «Restaurar compra».</li>
</ul>
<h2>Tus datos</h2>
<ul>
<li>Perfil › Privacidad y datos: revisar permisos, retirar el permiso para la inteligencia artificial, descargar tus datos o eliminar tu cuenta.</li>
<li>Más información en la <a href="privacidad.html">Política de privacidad</a>.</li>
</ul>
<div class="note"><strong>MediClaro no es un servicio de urgencias.</strong> Ante una emergencia, llama al <strong>112</strong>. Para dudas sobre tu tratamiento, consulta a tu médico o farmacéutico.</div>
`;

const index = `
<p>MediClaro ayuda a las personas mayores a saber qué medicamento tienen en la mano: con una foto de la caja, explica la información oficial del medicamento con palabras sencillas y en voz alta.</p>
<ul>
<li><a href="privacidad.html">Política de privacidad</a></li>
<li><a href="condiciones.html">Condiciones de uso y de la suscripción</a></li>
<li><a href="aviso-legal.html">Aviso legal</a></li>
<li><a href="eliminar-cuenta.html">Eliminar tu cuenta</a></li>
<li><a href="soporte.html">Ayuda y contacto</a></li>
</ul>
<div class="note">La información de los medicamentos procede del Centro de Información online de Medicamentos (CIMA) de la AEMPS. MediClaro no sustituye a tu médico ni a tu farmacéutico. En una emergencia, llama al 112.</div>
`;

const docs = {
  'privacidad.html': page(PAGES[0], blocksHtml(legal.privacyBlocks(ctx))),
  'condiciones.html': page(
    PAGES[1],
    `${blocksHtml(legal.termsBlocks(ctx))}\n<h2>Condiciones de la suscripción (MediClaro Premium)</h2>\n${blocksHtml(legal.subscriptionBlocks(ctx))}`,
  ),
  'aviso-legal.html': page(
    PAGES[2],
    `${blocksHtml(legal.noticeBlocks(ctx))}\n<h2>Aviso médico</h2>\n${blocksHtml(legal.medicalBlocks())}`,
  ),
  'eliminar-cuenta.html': page(PAGES[3], blocksHtml(legal.accountDeletionBlocks(ctx))),
  'soporte.html': page(PAGES[4], support),
  'index.html': page({ file: 'index.html', title: 'MediClaro' }, index),
};

fs.mkdirSync(out, { recursive: true });

// Guardia: nunca se pisa una versión publicada posterior a la del código.
const blocked = [];
for (const name of Object.keys(docs)) {
  const dest = path.join(out, name);
  if (!fs.existsSync(dest)) continue;
  const current = publishedVersion(fs.readFileSync(dest, 'utf8'));
  if (current && compareVersions(current, legal.LEGAL_VERSION) > 0) blocked.push({ name, current });
}
if (blocked.length) {
  console.error('NO SE HA ESCRITO NADA: hay páginas publicadas con una versión POSTERIOR a la del código.');
  for (const b of blocked) console.error(`  · docs/${b.name}: publicada ${b.current} · código ${legal.LEGAL_VERSION}`);
  console.error('Esas páginas llevan un cambio aprobado que este script borraría. Revisa qué versión debe quedar y,');
  console.error('si la del código es la correcta, sube LEGAL_VERSION en src/content/legal.ts por encima de la publicada.');
  process.exit(1);
}

for (const [name, html] of Object.entries(docs)) fs.writeFileSync(path.join(out, name), html);
fs.writeFileSync(path.join(out, '.nojekyll'), '');
const missing = ['EXPO_PUBLIC_COMPANY_NAME', 'EXPO_PUBLIC_COMPANY_TAX_ID', 'EXPO_PUBLIC_COMPANY_ADDRESS', 'EXPO_PUBLIC_SUPPORT_EMAIL'].filter((k) => !env(k));
console.log(`Páginas escritas en docs/: ${Object.keys(docs).join(', ')}`);
if (missing.length) console.log(`PENDIENTE: faltan los datos del titular (${missing.join(', ')}); los textos dicen «el titular de MediClaro».`);
