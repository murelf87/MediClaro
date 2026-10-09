/**
 * NotificationService — preferencias de avisos.
 *
 * El backend actual NO tiene tabla de preferencias ni envía notificaciones
 * (BACKEND_REQUIREMENTS.md → "Notificaciones"). Mientras tanto, las preferencias
 * se guardan en este teléfono para cada cuenta y la pantalla lo indica con claridad.
 */
import { supabase } from '../api';
import { localStore } from '../api/storage';
import type { NotificationPreference, NotificationPreferenceKey } from '../types';

const DEFINITIONS: Omit<NotificationPreference, 'enabled'>[] = [
  {
    key: 'accountAlerts',
    label: 'Avisos de tu cuenta',
    description: 'Pagos, renovaciones y cambios importantes en tu suscripción.',
  },
  {
    key: 'safetyAlerts',
    label: 'Avisos de seguridad de tus medicamentos',
    description: 'Si hay una alerta oficial sobre un medicamento que tienes guardado.',
  },
  {
    key: 'tips',
    label: 'Consejos para usar MediClaro',
    description: 'Pequeñas ayudas para sacar partido a la aplicación.',
  },
];

let writeQueue: Promise<void> = Promise.resolve();

const DEFAULTS: Record<NotificationPreferenceKey, boolean> = {
  accountAlerts: true,
  safetyAlerts: true,
  tips: false,
};

async function storageKey(): Promise<string> {
  const { data } = await supabase.auth.getSession().catch(() => ({ data: { session: null } }));
  return `mediclaro.notifications.v1.${data.session?.user.id ?? 'device'}`;
}

export const NotificationService = {
  /** Indica si el backend ya envía notificaciones (hoy: no). */
  isDeliveryAvailable(): boolean {
    return false;
  },

  async getPreferences(): Promise<NotificationPreference[]> {
    const stored = await localStore.getJSON<Partial<Record<NotificationPreferenceKey, boolean>>>(await storageKey(), {});
    return DEFINITIONS.map((d) => ({ ...d, enabled: stored[d.key] ?? DEFAULTS[d.key] }));
  },

  /** Al eliminar la cuenta: borra sus preferencias guardadas en este teléfono. */
  async forgetAccountLocalData(userId: string): Promise<void> {
    await localStore.remove(`mediclaro.notifications.v1.${userId}`);
  },

  /** Las escrituras se encolan para que dos cambios seguidos no se pisen. */
  updatePreferences(patch: Partial<Record<NotificationPreferenceKey, boolean>>): Promise<NotificationPreference[]> {
    const run = async () => {
      const key = await storageKey();
      const stored = await localStore.getJSON<Partial<Record<NotificationPreferenceKey, boolean>>>(key, {});
      const next = { ...stored, ...patch };
      await localStore.setJSON(key, next);
      return DEFINITIONS.map((d) => ({ ...d, enabled: next[d.key] ?? DEFAULTS[d.key] }));
    };
    const result = writeQueue.then(run, run);
    writeQueue = result.then(() => undefined, () => undefined);
    return result;
  },
};
