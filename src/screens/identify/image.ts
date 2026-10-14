/**
 * Preparación de la foto de la caja antes de enviarla a identificar:
 * 1280 px de ancho, JPEG al 70 % y en base64 (lo que espera el servicio).
 *
 * La foto no se guarda: las copias temporales que crean la cámara, el selector de
 * fotos y el redimensionado (siempre dentro de la caché privada de la app) se borran
 * en cuanto se ha preparado el envío. Nunca se toca la foto original de la galería.
 */
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { File, Paths } from 'expo-file-system';

const TARGET_WIDTH = 1280;
const JPEG_COMPRESS = 0.7;

/** Borra un archivo solo si está dentro de la caché privada de la app. Nunca lanza. */
function deleteTemporaryFile(uri: string | null | undefined): void {
  if (!uri || !uri.startsWith('file:')) return;
  try {
    const cacheUri = Paths.cache.uri;
    if (!cacheUri || !uri.startsWith(cacheUri)) return;
    const file = new File(uri);
    if (file.exists) file.delete();
  } catch {
    // Mejor esfuerzo: el sistema limpia la caché igualmente
  }
}

/**
 * @param uri    Foto de la cámara o de la galería.
 * @param width  Ancho original si se conoce (evita ampliar fotos pequeñas).
 * @returns JPEG en base64 sin prefijo `data:`.
 */
export async function prepareImageForUpload(uri: string, width?: number): Promise<string> {
  const context = ImageManipulator.manipulate(uri);
  try {
    if (!width || width > TARGET_WIDTH) context.resize({ width: TARGET_WIDTH });
    const image = await context.renderAsync();
    try {
      const saved = await image.saveAsync({ compress: JPEG_COMPRESS, format: SaveFormat.JPEG, base64: true });
      deleteTemporaryFile(saved.uri);
      if (!saved.base64) throw new Error('La foto no se ha podido preparar.');
      return saved.base64.replace(/^data:[^,]+,/, '');
    } finally {
      image.release();
    }
  } finally {
    context.release();
    // Copia temporal de la cámara o del selector de fotos (en la caché de la app)
    deleteTemporaryFile(uri);
  }
}
