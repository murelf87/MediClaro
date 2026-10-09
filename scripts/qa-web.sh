#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# QA visual con datos simulados (SOLO DESARROLLO). La app es solo iOS/Android:
# la web se usa únicamente aquí, en una copia temporal, para hacer capturas.
#
# Construye una COPIA del proyecto en la que src/lib/supabase.ts apunta al
# cliente simulado de src/mocks/. El proyecto real NO se modifica y el bundle
# de producción nunca incluye los mocks.
#
# Uso:  scripts/qa-web.sh <directorio-salida>
# Luego sirve la carpeta (SPA) y abre p. ej. /?qa=empty  /?qa=premium  /?qa=signedout
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="${1:?Indica el directorio de salida}"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

mkdir -p "$WORK/app"
(cd "$ROOT" && tar --exclude=./node_modules --exclude=./.expo --exclude=./dist -cf - .) | (cd "$WORK/app" && tar -xf -)
ln -s "$ROOT/node_modules" "$WORK/app/node_modules"
# En la copia: el "cliente real" se sustituye por el backend simulado (escenarios ?qa=)
# y se habilita la plataforma web SOLO para poder hacer capturas.
node - "$WORK/app" <<'NODE'
const fs = require('fs'); const path = require('path'); const dir = process.argv[2];
const libPath = path.join(dir, 'src/lib/supabase.ts');
let lib = fs.readFileSync(libPath, 'utf8');
lib = lib.replace(/\/\/ @qa-real-client-start[\s\S]*?\/\/ @qa-real-client-end/,
  "import { createDemoBackend, readQaScenario } from '../mocks/demoBackend';\n" +
  "const __qa = readQaScenario();\n" +
  "const realClient = createDemoBackend({ scenario: __qa, startSignedIn: !__qa.has('signedout') }) as unknown as ReturnType<typeof createClient>;");
lib = lib.replace('export const isBackendConfigured =', 'export const isBackendConfigured = true || ');
fs.writeFileSync(libPath, lib);
// Pagos simulados (hoja de la tienda y página de Stripe de src/mocks/demoPayments.tsx): nunca se cobra nada.
const billingPath = path.join(dir, 'src/services/billing/index.ts');
let billing = fs.readFileSync(billingPath, 'utf8');
billing = billing.replace(/\/\/ @qa-billing-start[\s\S]*?\/\/ @qa-billing-end/, 'function simulated(): boolean {\n  return true;\n}');
fs.writeFileSync(billingPath, billing);
const appJsonPath = path.join(dir, 'app.json');
const appJson = JSON.parse(fs.readFileSync(appJsonPath, 'utf8'));
appJson.expo.platforms = ['ios', 'android', 'web'];
appJson.expo.web = { bundler: 'metro', output: 'single' };
fs.writeFileSync(appJsonPath, JSON.stringify(appJson, null, 2));
NODE
cd "$WORK/app"
# Vías de pago de la build de QA: "store,stripe" (por defecto), "store", "stripe" o "none" (app gratuita): QA_PAYMENTS_MODE=none
CI=1 EXPO_PUBLIC_DEMO_ACCESS=on EXPO_PUBLIC_PAYMENTS_MODE="${QA_PAYMENTS_MODE:-store,stripe}" npx expo export --platform web --output-dir "$OUT" --clear
echo "QA web listo en $OUT"
