/**
 * Funciones Edge para VoIP y geolocalización en tiempo real.
 */
import { supabase, isBackendConfigured } from '../lib/supabase';
import { AppError } from './errors';

interface LocationData {
  latitude: number;
  longitude: number;
  accuracy?: number;
  altitude?: number;
  heading?: number;
  speed?: number;
}

interface CallLocationData extends LocationData {
  user_id: string;
  user_name?: string;
  updated_at: string;
}

interface InitiateCallResponse {
  success: boolean;
  callId: string;
  tokensSent: number;
  tokensFailed: number;
}

/**
 * Inicia una llamada VoIP
 */
export async function initiateVoIPCall(
  receiverId: string,
  linkId: string
): Promise<InitiateCallResponse> {
  if (!isBackendConfigured) {
    throw new AppError('not_configured', 'Backend no configurado');
  }

  try {
    const { data, error } = await supabase.functions.invoke('initiate-voip-call', {
      body: {
        callerId: (await supabase.auth.getUser()).data.user?.id,
        callerName: 'Tu nombre', // TODO: Obtener del perfil
        receiverId,
        linkId,
      },
    });

    if (error) {
      throw error;
    }

    return data as InitiateCallResponse;
  } catch (error) {
    console.error('Error initiating VoIP call:', error);
    throw new AppError(
      'unknown',
      'Error al iniciar la llamada'
    );
  }
}

/**
 * Obtiene la ubicación en tiempo real del otro usuario en la llamada
 */
export async function getCallLocation(callId: string): Promise<CallLocationData | null> {
  if (!isBackendConfigured) {
    throw new AppError('not_configured', 'Backend no configurado');
  }

  try {
    const { data, error } = await supabase.functions.invoke('get-call-location', {
      body: { callId },
    });

    if (error) {
      console.error('Error fetching call location:', error);
      return null;
    }

    return data as CallLocationData;
  } catch (error) {
    console.error('Error in getCallLocation:', error);
    return null;
  }
}

/**
 * Actualiza la ubicación del usuario actual
 * Se llama periódicamente durante una llamada
 */
export async function updateUserLocation(location: LocationData): Promise<boolean> {
  if (!isBackendConfigured) {
    console.warn('Backend no configurado, ubicación no actualizada');
    return false;
  }

  try {
    const { data, error } = await supabase.functions.invoke('update-patient-location', {
      body: location,
    });

    if (error) {
      console.error('Error updating location:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error in updateUserLocation:', error);
    return false;
  }
}

/**
 * Obtiene la ubicación actual del usuario
 */
export async function getUserLocation(): Promise<LocationData | null> {
  if (!isBackendConfigured) {
    console.warn('Backend no configurado, ubicación no disponible');
    return null;
  }

  try {
    const { data, error } = await supabase.functions.invoke('get-user-location', {
      body: {},
    });

    if (error) {
      console.error('Error fetching user location:', error);
      return null;
    }

    return data as LocationData;
  } catch (error) {
    console.error('Error in getUserLocation:', error);
    return null;
  }
}

/**
 * Registra un token VoIP para recibir llamadas
 */
export async function registerVoIPToken(token: string, platform: 'ios' | 'android'): Promise<boolean> {
  if (!isBackendConfigured) {
    console.warn('Backend no configurado, token VoIP no registrado');
    return false;
  }

  try {
    const { data, error } = await supabase.from('care_voip_tokens').insert({
      token,
      platform,
      enabled: true,
    });

    if (error) {
      console.error('Error registering VoIP token:', error);
      return false;
    }

    console.log(`VoIP token registered: ${token.substring(0, 20)}...`);
    return true;
  } catch (error) {
    console.error('Error in registerVoIPToken:', error);
    return false;
  }
}

/**
 * Desactiva un token VoIP
 */
export async function disableVoIPToken(token: string): Promise<boolean> {
  if (!isBackendConfigured) {
    return false;
  }

  try {
    const { error } = await supabase
      .from('care_voip_tokens')
      .update({ enabled: false })
      .eq('token', token);

    if (error) {
      console.error('Error disabling VoIP token:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error in disableVoIPToken:', error);
    return false;
  }
}

/**
 * Marca que la ubicación se está compartiendo en una llamada
 */
export async function startCallLocationSharing(callId: string): Promise<boolean> {
  if (!isBackendConfigured) {
    return false;
  }

  try {
    const userId = (await supabase.auth.getUser()).data.user?.id;
    if (!userId) return false;

    const { error } = await supabase
      .from('care_call_location_sharing')
      .insert({
        call_id: callId,
        user_id: userId,
        sharing_enabled: true,
      });

    if (error) {
      console.error('Error starting location sharing:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error in startCallLocationSharing:', error);
    return false;
  }
}

/**
 * Detiene la compartición de ubicación en una llamada
 */
export async function stopCallLocationSharing(callId: string): Promise<boolean> {
  if (!isBackendConfigured) {
    return false;
  }

  try {
    const userId = (await supabase.auth.getUser()).data.user?.id;
    if (!userId) return false;

    const { error } = await supabase
      .from('care_call_location_sharing')
      .update({
        sharing_enabled: false,
        ended_at: new Date().toISOString(),
      })
      .eq('call_id', callId)
      .eq('user_id', userId);

    if (error) {
      console.error('Error stopping location sharing:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error in stopCallLocationSharing:', error);
    return false;
  }
}
