/**
 * Foto de perfil: se elige de la galería o se hace con la cámara, se recorta cuadrada y se reduce a 512 px
 * (JPEG). Así ocupa poco, se sube rápido y se ve nítida en cualquier pantalla.
 * Solo prepara la imagen: subirla o quitarla es cosa de ProfileService.
 */
import * as ImagePicker from 'expo-image-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { AppError } from '../../api/errors';

const SIZE = 512;

export type PhotoSource = 'library' | 'camera';

export async function pickProfilePhoto(source: PhotoSource): Promise<{ uri: string; mimeType: string } | null> {
  if (source === 'camera') {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      throw new AppError('permission_denied', 'Para hacer la foto, permite que MediClaro use la cámara en los Ajustes del teléfono.');
    }
  }
  const options: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.9, exif: false };
  const result =
    source === 'camera'
      ? await ImagePicker.launchCameraAsync({ ...options, cameraType: ImagePicker.CameraType.front })
      : await ImagePicker.launchImageLibraryAsync(options);
  if (result.canceled || !result.assets?.[0]) return null;
  const asset = result.assets[0];
  try {
    const context = ImageManipulator.manipulate(asset.uri);
    try {
      if (!asset.width || asset.width > SIZE) context.resize({ width: SIZE });
      const image = await context.renderAsync();
      try {
        const saved = await image.saveAsync({ compress: 0.82, format: SaveFormat.JPEG });
        return { uri: saved.uri, mimeType: 'image/jpeg' };
      } finally {
        image.release();
      }
    } finally {
      context.release();
    }
  } catch {
    // Si no se puede reducir, se sube tal cual (el servicio rechaza las de más de 5 MB con un mensaje claro).
    return { uri: asset.uri, mimeType: asset.mimeType || 'image/jpeg' };
  }
}
