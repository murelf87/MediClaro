/**
 * Sustituto de `demoBackend` en las compilaciones de tienda (ver metro.config.js).
 * En ellas el Modo demostración está desactivado (DEMO_ACCESS_ENABLED = false), así que
 * estas funciones nunca se usan; si se llamaran, fallan de forma explícita.
 */
import type { DemoBackend, DemoBackendOptions } from './demoBackend';

export type { DemoBackend, DemoBackendOptions };

export function createDemoBackend(_opts?: DemoBackendOptions): DemoBackend {
  throw new Error('El Modo demostración no está incluido en esta compilación.');
}

export function readQaScenario(): Set<string> {
  return new Set();
}
