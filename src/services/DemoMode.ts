/**
 * Modo demostración: toda la app funcionando con datos de ejemplo, sin servidor
 * y sin verificar el móvil. Solo disponible si DEMO_ACCESS_ENABLED (desarrollo y
 * preview); en las compilaciones de tienda está desactivado.
 * La interfaz muestra SIEMPRE el aviso "Modo demostración · datos de ejemplo".
 */
import { isBackendConfigured, isDemoClientActive, switchToDemoClient, switchToRealClient } from '../lib/supabase';
import { AppError } from '../api/errors';
import { localStore } from '../api/storage';
import { DEMO_ACCESS_ENABLED } from '../config/app';
import { createDemoBackend, type DemoBackend } from '../mocks/demoBackend';

const FLAG_KEY = 'mediclaro.demo.v1';
let backend: DemoBackend | null = null;

function activate(opts?: { anonymous?: boolean }): void {
  backend = createDemoBackend({ startSignedIn: true, anonymous: opts?.anonymous === true });
  switchToDemoClient(backend);
}

export const DemoMode = {
  /** ¿Se puede usar en esta compilación? */
  available(): boolean {
    return DEMO_ACCESS_ENABLED;
  },

  isActive(): boolean {
    return isDemoClientActive();
  },

  /** Backend simulado activo (para acciones propias de la demostración). */
  backend(): DemoBackend | null {
    return isDemoClientActive() ? backend : null;
  },

  /** `anonymous`: cuenta de demostración sin teléfono (pago antes de registrarse). */
  async enable(opts?: { anonymous?: boolean }): Promise<void> {
    if (!DEMO_ACCESS_ENABLED) throw new AppError('not_available', 'Esta opción no está disponible.');
    activate(opts);
    await localStore.setJSON(FLAG_KEY, true);
  },

  async disable(): Promise<void> {
    backend = null;
    switchToRealClient();
    await localStore.remove(FLAG_KEY);
  },

  /**
   * Compilaciones de prueba SIN servidor configurado: la app arranca con el backend simulado y SIN sesión,
   * para poder recorrer la bienvenida, los planes y el pago simulado. Nunca en compilaciones de tienda.
   */
  async startWithoutServer(): Promise<boolean> {
    if (!DEMO_ACCESS_ENABLED || isBackendConfigured || isDemoClientActive()) return false;
    backend = createDemoBackend({ startSignedIn: false });
    switchToDemoClient(backend);
    return true;
  },

  /** Al abrir la app: si se salió con la demostración activa, se recupera. */
  async restore(): Promise<boolean> {
    const on = await localStore.getJSON<boolean>(FLAG_KEY, false);
    if (!on) return false;
    if (!DEMO_ACCESS_ENABLED) {
      await localStore.remove(FLAG_KEY);
      return false;
    }
    activate();
    return true;
  },
};
