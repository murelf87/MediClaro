/**
 * Vista previa del propietario («Ver la app como…»): rol que se está enseñando, o null si no hay vista previa.
 * Se actualiza al momento en todas las pantallas al entrar o salir de la vista previa.
 */
import { useSyncExternalStore } from 'react';
import { OwnerPreview, type PreviewRole } from '../services/OwnerPreview';

export function useOwnerPreview(): PreviewRole | null {
  return useSyncExternalStore(OwnerPreview.subscribe, OwnerPreview.get, OwnerPreview.get);
}
