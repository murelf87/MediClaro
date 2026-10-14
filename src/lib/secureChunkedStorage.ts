/**
 * Almacenamiento CIFRADO del dispositivo (llavero de iOS / Keystore de Android)
 * mediante expo-secure-store, troceado en fragmentos de < 2 KB para respetar el
 * tamaño recomendado por valor.
 *
 * Se usa para todo lo sensible que vive en el teléfono: la sesión, el perfil de
 * emergencia (datos de salud), los mensajes recientes y los datos privados de
 * asistencia. Solo lo importan la capa de infraestructura (src/lib, src/api) y
 * los servicios; nunca las pantallas.
 *
 * En web (solo QA interno, no es un destino de la app) SecureStore no existe y
 * se usa AsyncStorage.
 */
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

const CHUNK_SIZE = 1800;

export const isSecureStorageAvailable = Platform.OS !== 'web';

/** SecureStore solo admite claves con [A-Za-z0-9._-]. */
export function safeStorageKey(key: string): string {
  return key.replace(/[^A-Za-z0-9._-]/g, '_');
}

async function secureGet(key: string): Promise<string | null> {
  const k = safeStorageKey(key);
  const countRaw = await SecureStore.getItemAsync(`${k}.n`);
  if (!countRaw) {
    // Valores guardados sin trocear (versiones anteriores)
    return SecureStore.getItemAsync(k);
  }
  const count = Number(countRaw);
  if (!Number.isFinite(count) || count <= 0) return null;
  const parts: string[] = [];
  for (let i = 0; i < count; i += 1) {
    const part = await SecureStore.getItemAsync(`${k}.${i}`);
    if (part === null) return null;
    parts.push(part);
  }
  return parts.join('');
}

async function secureRemove(key: string): Promise<void> {
  const k = safeStorageKey(key);
  const countRaw = await SecureStore.getItemAsync(`${k}.n`);
  const count = countRaw ? Number(countRaw) : 0;
  for (let i = 0; i < count; i += 1) {
    await SecureStore.deleteItemAsync(`${k}.${i}`);
  }
  await SecureStore.deleteItemAsync(`${k}.n`);
  await SecureStore.deleteItemAsync(k);
}

async function secureSet(key: string, value: string): Promise<void> {
  const k = safeStorageKey(key);
  await secureRemove(key);
  const count = Math.ceil(value.length / CHUNK_SIZE) || 1;
  for (let i = 0; i < count; i += 1) {
    await SecureStore.setItemAsync(`${k}.${i}`, value.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE));
  }
  await SecureStore.setItemAsync(`${k}.n`, String(count));
}

/** Interfaz compatible con el `storage` de Supabase Auth. */
export const secureTextStorage = {
  getItem(key: string): Promise<string | null> {
    return isSecureStorageAvailable ? secureGet(key) : AsyncStorage.getItem(key);
  },
  setItem(key: string, value: string): Promise<void> {
    return isSecureStorageAvailable ? secureSet(key, value) : AsyncStorage.setItem(key, value);
  },
  removeItem(key: string): Promise<void> {
    return isSecureStorageAvailable ? secureRemove(key) : AsyncStorage.removeItem(key);
  },
};
