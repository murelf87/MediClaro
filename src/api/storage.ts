/**
 * Almacenamiento local del dispositivo (uso exclusivo de servicios/proveedores).
 *
 * - localStore: preferencias no sensibles (AsyncStorage; localStorage en web).
 * - secureLocalStore: datos personales o de salud que viven en este teléfono
 *   (llavero iOS / Keystore Android, troceado; en web —solo QA— AsyncStorage).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { secureTextStorage } from '../lib/secureChunkedStorage';

async function readJSON<T>(raw: string | null, fallback: T): Promise<T> {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export const localStore = {
  async getJSON<T>(key: string, fallback: T): Promise<T> {
    try {
      return await readJSON<T>(await AsyncStorage.getItem(key), fallback);
    } catch {
      return fallback;
    }
  },
  async setJSON(key: string, value: unknown): Promise<void> {
    try {
      await AsyncStorage.setItem(key, JSON.stringify(value));
    } catch {
      // Mejor esfuerzo: nunca bloquear la UI por el almacenamiento local
    }
  },
  async remove(key: string): Promise<void> {
    try {
      await AsyncStorage.removeItem(key);
    } catch {
      // ignorar
    }
  },
};

/**
 * Datos personales o de salud que viven en este teléfono: cifrados en el
 * llavero / Keystore y troceados (sin límite práctico de tamaño).
 */
export const secureLocalStore = {
  async getJSON<T>(key: string, fallback: T): Promise<T> {
    try {
      return await readJSON<T>(await secureTextStorage.getItem(key), fallback);
    } catch {
      return fallback;
    }
  },
  async setJSON(key: string, value: unknown): Promise<void> {
    await secureTextStorage.setItem(key, JSON.stringify(value));
  },
  async remove(key: string): Promise<void> {
    try {
      await secureTextStorage.removeItem(key);
    } catch {
      // ignorar
    }
  },
};
