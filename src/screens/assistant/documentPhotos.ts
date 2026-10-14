/**
 * Fotos de un documento para el chat («clip»): se hacen con la cámara o se eligen de la galería (hasta 3) y se
 * preparan para enviar (1280 px, JPEG, base64). No se guardan: las copias temporales se borran al prepararlas.
 *
 * Importante en iPhone: esto abre una ventana nativa (cámara o galería). Hay que llamarlo cuando NO hay ningún `Modal`
 * abierto ni cerrándose; por eso la hoja del clip es una capa de la pantalla y no un `Modal` (ver `DocumentSheet`).
 */
import { Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { AppError } from '../../api/errors';
import { prepareImageForUpload } from '../identify/image';
import { MAX_DOCUMENT_PHOTOS } from '../../services/AssistantService';
import { CAMERA_DENIED_CODE, CAMERA_DENIED_MESSAGE } from './documentFlow';

export type DocumentSource = 'camera' | 'library';

/**
 * @returns las fotos en base64, o [] si la persona cancela.
 * @throws AppError con `code: 'camera_denied'` si falta el permiso de la cámara, o con un mensaje ya escrito para la persona.
 */
export async function pickDocumentPhotos(source: DocumentSource, max = MAX_DOCUMENT_PHOTOS): Promise<string[]> {
  // En el navegador (vista previa) no hay permiso de cámara que pedir: abre el selector de archivos, como en un ordenador.
  if (source === 'camera' && Platform.OS !== 'web') {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) throw new AppError('permission_denied', CAMERA_DENIED_MESSAGE, { code: CAMERA_DENIED_CODE });
  }
  const options: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 0.9, exif: false };
  let result: ImagePicker.ImagePickerResult;
  try {
    result =
      source === 'camera'
        ? await ImagePicker.launchCameraAsync(options)
        : await ImagePicker.launchImageLibraryAsync({ ...options, allowsMultipleSelection: true, selectionLimit: max });
  } catch (e) {
    throw new AppError(
      'unknown',
      source === 'camera' ? 'No se ha podido abrir la cámara. Inténtalo de nuevo.' : 'No se ha podido abrir la galería. Inténtalo de nuevo.',
      { cause: e },
    );
  }
  if (result.canceled || !result.assets?.length) return [];
  const out: string[] = [];
  for (const asset of result.assets.slice(0, max)) {
    try {
      out.push(await prepareImageForUpload(asset.uri, asset.width));
    } catch (e) {
      throw new AppError('unknown', 'No se ha podido preparar la foto. Prueba con otra o hazla de nuevo.', { cause: e });
    }
  }
  return out;
}
