/**
 * Fotos PROPIAS de las cajas de medicamentos (las que hace la persona con su móvil).
 *
 * - Se guardan SOLO en este teléfono (carpeta de la app; en la web, en el almacenamiento del navegador), reducidas a
 *   640 px en JPEG. No se suben a ningún servidor ni las ve el cuidador/a.
 * - Claves: `med:<nº de registro>` (la caja de un medicamento identificado) y `pill:<id del tratamiento>` (la foto que
 *   la persona pone en «Mis pastillas»).
 * - Solo se guardan si la persona lo elige (una foto nueva, una de su galería o «Usar la foto que acabo de hacer» al
 *   identificar ese medicamento). La foto enviada para identificar NO se guarda por sí sola.
 * - Al cerrar sesión o eliminar la cuenta se borran (`forgetAll`).
 */
import { Platform } from 'react-native';
import { Directory, File, Paths } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { requireUserId } from '../api';
import { localStore } from '../api/storage';
import { MedicationService } from './MedicationService';

const SIZE = 640;
const WEB = Platform.OS === 'web';
type Index = Record<string, string>; // clave → nombre del archivo (o data URI en la web)

let cache: { uid: string; index: Index } | null = null;
let version = 0;
const listeners = new Set<() => void>();
const emit = () => {
  version += 1;
  listeners.forEach((l) => l());
};
const indexKey = (uid: string) => `mediclaro.photos.v1.${uid}`;

async function load(): Promise<{ uid: string; index: Index }> {
  const uid = await requireUserId();
  if (cache?.uid === uid) return cache;
  const index = await localStore.getJSON<Index>(indexKey(uid), {});
  cache = { uid, index: index && typeof index === 'object' ? index : {} };
  return cache;
}

async function persist(state: { uid: string; index: Index }): Promise<void> {
  await localStore.setJSON(indexKey(state.uid), state.index);
}

function folder(uid: string): Directory {
  const dir = new Directory(Paths.document, 'medicine-photos', uid);
  dir.create({ intermediates: true, idempotent: true });
  return dir;
}

function uriOf(uid: string, stored: string): string | null {
  if (WEB || stored.startsWith('data:')) return stored;
  const file = new File(folder(uid), stored);
  return file.exists ? file.uri : null;
}

/** Reduce la foto a 640 px (JPEG) y devuelve el resultado en base64. */
async function shrink(uri: string): Promise<string> {
  const context = ImageManipulator.manipulate(uri);
  try {
    context.resize({ width: SIZE });
    const image = await context.renderAsync();
    try {
      const saved = await image.saveAsync({ compress: 0.8, format: SaveFormat.JPEG, base64: true });
      return String(saved.base64 ?? '').replace(/^data:[^,]+,/, '');
    } finally {
      image.release();
    }
  } finally {
    context.release();
  }
}

/** Nombre de archivo seguro y estable para una clave. */
function fileNameFor(key: string): string {
  return `${key.replace(/[^A-Za-z0-9-]+/g, '_').slice(0, 80)}-${Date.now()}.jpg`;
}

function removeStored(uid: string, stored: string | undefined): void {
  if (!stored || WEB || stored.startsWith('data:')) return;
  try {
    const file = new File(folder(uid), stored);
    if (file.exists) file.delete();
  } catch {
    // ya no estaba
  }
}

export const MedicinePhotoService = {
  /** Cambia cada vez que se guarda o se quita una foto (para refrescar las imágenes en pantalla). */
  version(): number {
    return version;
  },

  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },

  /** La foto propia de la primera clave que la tenga, o null. Nunca lanza. */
  async get(keys: Array<string | null | undefined>): Promise<string | null> {
    try {
      const state = await load();
      for (const key of keys) {
        if (!key) continue;
        const stored = state.index[key];
        if (!stored) continue;
        const uri = uriOf(state.uid, stored);
        if (uri) return uri;
      }
    } catch {
      // sin sesión o sin acceso a la carpeta: sin foto propia
    }
    return null;
  },

  /** Guarda una foto (de la cámara, la galería o la foto ya enviada a identificar, en base64). */
  async save(key: string, source: { uri?: string; base64?: string }): Promise<string> {
    const state = await load();
    const base64 = source.uri
      ? await shrink(source.uri)
      : String(source.base64 ?? '').replace(/^data:[^,]+,/, '');
    if (!base64) throw new Error('Foto vacía');
    const previous = state.index[key];
    let stored: string;
    if (WEB) {
      stored = `data:image/jpeg;base64,${base64}`;
    } else {
      stored = fileNameFor(key);
      new File(folder(state.uid), stored).write(base64, { encoding: 'base64' });
    }
    state.index = { ...state.index, [key]: stored };
    await persist(state);
    removeStored(state.uid, previous);
    emit();
    return uriOf(state.uid, stored) ?? stored;
  },

  async remove(key: string): Promise<void> {
    const state = await load();
    const previous = state.index[key];
    if (!previous) return;
    const { [key]: _removed, ...rest } = state.index;
    state.index = rest;
    await persist(state);
    removeStored(state.uid, previous);
    emit();
  },

  /**
   * La foto de la caja de la última identificación, si fue de ESTE medicamento y la identificación fue clara (solo en
   * memoria; no se guarda hasta que la persona lo elige). null si no hay.
   */
  recentScanPhotoFor(medicineId: string | null | undefined): string | null {
    if (!medicineId) return null;
    const photo = MedicationService.getLastScanImage();
    const result = MedicationService.getLastResult();
    return photo && result?.status === 'identified' && result.best.id === medicineId ? photo.replace(/^data:[^,]+,/, '') : null;
  },

  /** Al cerrar sesión o eliminar la cuenta: fuera las fotos de esa cuenta de este teléfono. */
  async forgetAll(userId: string): Promise<void> {
    try {
      await localStore.remove(indexKey(userId));
      if (!WEB) {
        const dir = new Directory(Paths.document, 'medicine-photos', userId);
        if (dir.exists) dir.delete();
      }
    } catch {
      // nada que borrar
    }
    if (cache?.uid === userId) cache = null;
    emit();
  },
};
