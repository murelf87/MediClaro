/**
 * Configuración de Metro (empaquetador de la app).
 *
 * En las compilaciones de tienda (perfil `production` de eas.json → EXPO_PUBLIC_DEMO_ACCESS=off) lo simulado del
 * Modo demostración NO se incluye en el paquete:
 *   - src/mocks/demoBackend.ts   (backend simulado y datos de ejemplo) → src/mocks/demoBackend.disabled.ts
 *   - src/mocks/demoPayments.tsx (pagos simulados)                    → src/mocks/demoPayments.disabled.tsx
 * Así la app publicada no contiene datos ni pagos simulados (en ella el Modo demostración ya está desactivado).
 */
const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

const REPLACEMENTS = new Map([
  [path.resolve(__dirname, 'src/mocks/demoBackend.ts'), path.resolve(__dirname, 'src/mocks/demoBackend.disabled.ts')],
  [path.resolve(__dirname, 'src/mocks/demoPayments.tsx'), path.resolve(__dirname, 'src/mocks/demoPayments.disabled.tsx')],
]);

if (process.env.EXPO_PUBLIC_DEMO_ACCESS === 'off') {
  config.resolver.resolveRequest = (context, moduleName, platform) => {
    const resolution = context.resolveRequest(context, moduleName, platform);
    if (resolution && resolution.type === 'sourceFile') {
      const replacement = REPLACEMENTS.get(path.resolve(resolution.filePath));
      if (replacement) return { type: 'sourceFile', filePath: replacement };
    }
    return resolution;
  };
}

module.exports = config;
