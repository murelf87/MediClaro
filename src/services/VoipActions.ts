/**
 * Servicio de Caregiver — maneja todas las acciones de cuidado, llamadas VoIP y geolocalización.
 * Expone `careAction` como punto único de acceso a todas las operaciones.
 */
import {
  initiateVoIPCall,
  getCallLocation,
  updateUserLocation,
  getUserLocation,
  registerVoIPToken,
  disableVoIPToken,
  startCallLocationSharing,
  stopCallLocationSharing,
} from '../api/voipFunctions';
import { supabase } from '../lib/supabase';

type CareActionType =
  | 'voip_token'
  | 'initiate_call'
  | 'get_call_location'
  | 'update_location'
  | 'get_my_location'
  | 'start_location_sharing'
  | 'stop_location_sharing';

interface CareActionPayload {
  voip_token?: {
    token: string;
    platform: 'ios' | 'android';
  };
  initiate_call?: {
    receiverId: string;
    linkId: string;
  };
  get_call_location?: {
    callId: string;
  };
  update_location?: {
    latitude: number;
    longitude: number;
    accuracy?: number;
    altitude?: number;
    heading?: number;
    speed?: number;
  };
  get_my_location?: Record<string, never>;
  start_location_sharing?: {
    callId: string;
  };
  stop_location_sharing?: {
    callId: string;
  };
}

/**
 * Punto único de acceso a todas las acciones de cuidado.
 * Maneja VoIP, geolocalización, y todas las operaciones relacionadas.
 *
 * @example
 * // Registrar token VoIP
 * await careAction('voip_token', { token: '...', platform: 'ios' });
 *
 * @example
 * // Iniciar una llamada
 * const result = await careAction('initiate_call', {
 *   receiverId: '...',
 *   linkId: '...'
 * });
 *
 * @example
 * // Obtener ubicación en la llamada
 * const location = await careAction('get_call_location', { callId: '...' });
 *
 * @example
 * // Actualizar ubicación durante la llamada
 * await careAction('update_location', {
 *   latitude: 40.4168,
 *   longitude: -3.7038,
 *   accuracy: 10
 * });
 */
export async function voipAction<T extends CareActionType>(
  action: T,
  params?: CareActionPayload[T]
): Promise<any> {
  try {
    switch (action) {
      // ==================== VoIP Tokens ====================
      case 'voip_token': {
        if (!params) throw new Error('Missing params');
        const { token, platform } = params as CareActionPayload['voip_token'];
        const success = await registerVoIPToken(token, platform);
        return { success };
      }

      // ==================== Call Initiation ====================
      case 'initiate_call': {
        if (!params) throw new Error('Missing params');
        const { receiverId, linkId } = params as CareActionPayload['initiate_call'];
        return await initiateVoIPCall(receiverId, linkId);
      }

      // ==================== Location During Call ====================
      case 'get_call_location': {
        if (!params) throw new Error('Missing params');
        const { callId } = params as CareActionPayload['get_call_location'];
        return await getCallLocation(callId);
      }

      case 'update_location': {
        if (!params) throw new Error('Missing params');
        const locationData = params as CareActionPayload['update_location'];
        const success = await updateUserLocation(locationData);
        return { success };
      }

      case 'get_my_location': {
        return await getUserLocation();
      }

      // ==================== Location Sharing ====================
      case 'start_location_sharing': {
        if (!params) throw new Error('Missing params');
        const { callId } = params as CareActionPayload['start_location_sharing'];
        const success = await startCallLocationSharing(callId);
        return { success };
      }

      case 'stop_location_sharing': {
        if (!params) throw new Error('Missing params');
        const { callId } = params as CareActionPayload['stop_location_sharing'];
        const success = await stopCallLocationSharing(callId);
        return { success };
      }

      default:
        throw new Error(`Unknown action: ${action}`);
    }
  } catch (error) {
    console.error(`Error in voipAction('${action}'):`, error);
    throw error;
  }
}

/**
 * Servicio de Caregiver — exporta todas las funciones necesarias
 */
export const VoipService = {
  voipAction,
  initiateVoIPCall,
  getCallLocation,
  updateUserLocation,
  getUserLocation,
  registerVoIPToken,
  disableVoIPToken,
  startCallLocationSharing,
  stopCallLocationSharing,
};
