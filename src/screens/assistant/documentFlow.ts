/**
 * «Explicar un documento» (clip del chat): lo que pasa desde que la persona pulsa «Hacer una foto» o «Elegir de la galería»
 * hasta que las fotos están listas para enviar. Va aparte de la pantalla para poder probar cada caso sin teléfono.
 *
 * Tres reglas que hacen que funcione en el iPhone (antes no se abría ni la cámara ni la galería):
 *  1. El permiso de la IA se pide ANTES de abrir la hoja (`AssistantScreen.openDocSheet`), con nada más abierto: el iPhone no
 *     puede presentar dos ventanas nativas a la vez. Aquí solo se COMPRUEBA, sin mostrar nada.
 *  2. La hoja es una capa de la pantalla, no un `Modal` (ver `DocumentSheet`): se cierra al instante y el selector se abre
 *     sobre una pantalla libre. Con un `Modal` aún cerrándose, el iPhone no presentaba la galería ni la cámara y la llamada se
 *     quedaba esperando para siempre (y no se podía volver a intentar).
 *  3. Si la cámara está denegada se explica con palabras sencillas y se ofrece «Abrir ajustes» (la galería sigue disponible).
 */
import { isAppError } from '../../api/errors';
import type { DocumentSource } from './documentPhotos';

/** Código del error que lanza `pickDocumentPhotos` cuando el permiso de la cámara está denegado. */
export const CAMERA_DENIED_CODE = 'camera_denied';

export const CAMERA_DENIED_TITLE = 'Falta el permiso de la cámara';
export const CAMERA_DENIED_MESSAGE =
  'Para hacer la foto, MediClaro necesita usar la cámara. Puedes permitirlo en los Ajustes del teléfono. Si prefieres, elige una foto de la galería.';
export const PICK_FAILED_TITLE = 'No se ha podido añadir la foto';
export const PICK_FAILED_MESSAGE = 'Inténtalo de nuevo. También puedes elegir una foto de la galería.';
export const SETTINGS_FAILED_TITLE = 'No se han podido abrir los ajustes';
export const SETTINGS_FAILED_MESSAGE = 'Ábrelos desde el teléfono y permite que MediClaro use la cámara.';

export interface DocumentFlowDeps {
  /** ¿Ha dado ya la persona su permiso para usar la IA? Solo lo comprueba: no muestra ninguna pantalla. */
  aiConsentGranted: () => Promise<boolean>;
  /** Abre la cámara o la galería y devuelve las fotos ya preparadas (base64), o [] si la persona cancela. */
  pick: (source: DocumentSource) => Promise<string[]>;
  alert: (title: string, message?: string) => Promise<void>;
  /** Pregunta con dos botones; devuelve true si la persona elige el de confirmar. */
  confirm: (options: { title: string; message: string; confirmText: string; cancelText: string }) => Promise<boolean>;
  openSettings: () => Promise<boolean>;
}

/**
 * @returns las fotos listas para enviar, o [] si la persona cancela o algo falla (en ese caso ya se le ha explicado).
 * Nunca lanza.
 */
export async function choosePhotosForDocument(source: DocumentSource, deps: DocumentFlowDeps): Promise<string[]> {
  // Red de seguridad: sin el permiso de la IA no se abre ni la cámara (la hoja solo se abre una vez concedido).
  if (!(await deps.aiConsentGranted())) return [];
  try {
    return await deps.pick(source);
  } catch (e) {
    if (isAppError(e) && e.code === CAMERA_DENIED_CODE) {
      const openIt = await deps.confirm({
        title: CAMERA_DENIED_TITLE,
        message: CAMERA_DENIED_MESSAGE,
        confirmText: 'Abrir ajustes',
        cancelText: 'Ahora no',
      });
      if (openIt && !(await deps.openSettings())) await deps.alert(SETTINGS_FAILED_TITLE, SETTINGS_FAILED_MESSAGE);
      return [];
    }
    // Solo se enseñan mensajes ya escritos para la persona (nunca el texto técnico de un fallo nativo).
    const message = isAppError(e) && e.message.trim() ? e.message : PICK_FAILED_MESSAGE;
    await deps.alert(PICK_FAILED_TITLE, message);
    return [];
  }
}
