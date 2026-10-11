/**
 * Piezas reales (permiso de IA, selector de fotos, avisos y ajustes del teléfono) con las que el chat ejecuta
 * `choosePhotosForDocument`. Aparte de `documentFlow.ts` para que las reglas se puedan probar sin teléfono.
 */
import { AiConsentService } from '../../services/AiConsentService';
import { openAppSettings } from '../../utils/device';
import { confirmAsync, showAlert } from '../../utils/dialogs';
import type { DocumentFlowDeps } from './documentFlow';
import { pickDocumentPhotos } from './documentPhotos';

export const documentFlowDeps: DocumentFlowDeps = {
  aiConsentGranted: () => AiConsentService.isGranted(),
  pick: (source) => pickDocumentPhotos(source),
  alert: (title, message) => showAlert(title, message),
  confirm: (options) => confirmAsync(options),
  openSettings: () => openAppSettings(),
};
