/**
 * Fotos de un documento para el chat («clip»): se hacen con la cámara o se eligen de la galería (hasta 3) y se
 * preparan para enviar (1280 px, JPEG, base64). No se guardan: las copias temporales se borran al prepararlas.
 */
import * as ImagePicker from 'expo-image-picker';
import { AppError } from '../../api/errors';
import { prepareImageForUpload } from '../identify/image';
import { MAX_DOCUMENT_PHOTOS } from '../../services/AssistantService';

export type DocumentSource = 'camera' | 'library';

/** @returns las fotos en base64, o [] si la persona cancela. Lanza AppError si falta el permiso de la cámara. */
export async function pickDocumentPhotos(source: DocumentSource, max = MAX_DOCUMENT_PHOTOS): Promise<string[]> {
  if (source === 'camera') {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      throw new AppError('permission_denied', 'Para hacer la foto, permite que MediClaro use la cámara en los Ajustes del teléfono.');
    }
  }
  const options: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 0.9, exif: false };
  const result =
    source === 'camera'
      ? await ImagePicker.launchCameraAsync(options)
      : await ImagePicker.launchImageLibraryAsync({ ...options, allowsMultipleSelection: true, selectionLimit: max });
  if (result.canceled || !result.assets?.length) return [];
  const out: string[] = [];
  for (const asset of result.assets.slice(0, max)) out.push(await prepareImageForUpload(asset.uri, asset.width));
  return out;
}
