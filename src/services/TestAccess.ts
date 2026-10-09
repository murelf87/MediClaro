/**
 * «Entrar sin verificar» (acceso de PRUEBA, solo compilaciones de desarrollo/preview).
 * Recuerda si la sesión sin teléfono es de prueba, para mostrar el aviso «Acceso de prueba…».
 * Una cuenta sin teléfono creada AL PAGAR no es de prueba: es una cuenta real a la que falta el teléfono
 * («Completa tu cuenta»), y no muestra ese aviso.
 */
import { localStore } from '../api/storage';

const KEY = 'mediclaro.testAccess.v1';
let active = false;
const listeners = new Set<() => void>();

function notify(): void {
  listeners.forEach((l) => l());
}

export const TestAccess = {
  isActive(): boolean {
    return active;
  },
  async mark(): Promise<void> {
    active = true;
    notify();
    await localStore.setJSON(KEY, true).catch(() => undefined);
  },
  async clear(): Promise<void> {
    active = false;
    notify();
    await localStore.remove(KEY).catch(() => undefined);
  },
  async restore(): Promise<void> {
    active = await localStore.getJSON<boolean>(KEY, false).catch(() => false);
    notify();
  },
  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
};
