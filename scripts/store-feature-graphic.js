// Gráfico destacado de Google Play (1024×500, sin transparencia). SOLO DESARROLLO.
// Requisitos: Playwright con Chromium. Uso: node scripts/store-feature-graphic.js /carpeta/salida
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const icon = fs.readFileSync(path.join(__dirname, '..', 'assets', 'icon.png')).toString('base64');
const out = process.argv[2] || '.';
const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><style>
html,body{margin:0;padding:0}
body{width:1024px;height:500px;overflow:hidden;background:linear-gradient(135deg,#D9E8FC 0%,#EEF5FE 55%,#FFFFFF 100%);
  font-family:'Liberation Sans',Arial,Helvetica,sans-serif;display:flex;align-items:center;gap:48px;padding:0 64px;box-sizing:border-box}
.icon{width:208px;height:208px;border-radius:46px;overflow:hidden;box-shadow:0 18px 44px rgba(15,36,99,.22);flex:none;background:#fff}
.icon img{width:100%;height:100%;display:block}
h1{margin:0;font-size:88px;line-height:1;font-weight:700;letter-spacing:-1px}
.medi{color:#15338F}.claro{color:#12958C}
p{margin:20px 0 0;font-size:38px;white-space:nowrap;line-height:1.2;color:#16307E;font-weight:700}
small{display:block;margin-top:16px;font-size:27px;white-space:nowrap;color:#4A5B7A;font-weight:400}
</style></head><body><div class="icon"><img src="data:image/png;base64,${icon}"></div>
<div><h1><span class="medi">Medi</span><span class="claro">Claro</span></h1><p>Foto a la caja y te lo explica</p>
<small>Información oficial, clara y en voz alta</small></div></body></html>`;
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1024, height: 500 }, deviceScaleFactor: 1 });
  await page.setContent(html, { waitUntil: 'load' });
  await page.waitForTimeout(200);
  await page.screenshot({ path: out + '/google-play-grafico-destacado.png', clip: { x: 0, y: 0, width: 1024, height: 500 } });
  await browser.close();
})();
