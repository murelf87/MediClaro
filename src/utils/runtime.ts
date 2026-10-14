/**
 * ¿Dónde se está ejecutando MediClaro?
 * En Expo Go (la app de pruebas de Expo) no existen los módulos nativos propios de MediClaro: compras de la
 * App Store / Google Play y llamadas de audio por internet (WebRTC). Esas funciones muestran un aviso claro
 * en lugar de un error técnico; en la app instalada (build de EAS) funcionan con normalidad.
 */
import Constants from 'expo-constants';

export const IS_EXPO_GO: boolean = String(Constants.executionEnvironment ?? '') === 'storeClient';

export const EXPO_GO_NATIVE_ONLY_MESSAGE =
  'Esta función necesita la app MediClaro instalada. En la vista previa de Expo Go no está disponible.';
