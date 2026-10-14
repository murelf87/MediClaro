#!/usr/bin/env bash
# Prueba las Edge Functions PROPUESTAS frente a las ORIGINALES con Deno 2 (sin red de Stripe/Supabase ni claves).
#   1) Comprobación de tipos de las funciones propuestas con los módulos reales (supabase-js y stripe).
#   2) Pruebas de comportamiento con dobles en memoria (tests/functions/fakes).
# Uso:  bash backend-patches/tests/run-function-tests.sh      (DENO=/ruta/a/deno si no está en el PATH)
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$HERE/../.." && pwd)"
DENO="${DENO:-deno}"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
mkdir -p "$WORK/original" "$WORK/patched" "$WORK/tests"
cp -R "$ROOT/supabase/functions/." "$WORK/original/"
cp -R "$ROOT/supabase/functions/." "$WORK/patched/"
cp -R "$ROOT/backend-patches/functions/." "$WORK/patched/"
cp -R "$HERE/functions/." "$WORK/tests/"
echo "1) Tipos de las funciones propuestas"
(cd "$WORK/patched" && "$DENO" check stripe-webhook/index.ts stripe-webhook/mapping.ts account/index.ts)
echo "2) Comportamiento: original frente a propuesta"
(cd "$WORK/tests" && "$DENO" test --no-check --allow-env --allow-read --import-map=import_map.json .)
