/**
 * Servicio de chat entre cuidador y paciente
 */
import { supabase } from '../lib/supabase';

export interface ChatMessage {
  id: string;
  linkId: string;
  senderId: string;
  senderName?: string;
  senderAvatar?: string;
  content: string;
  locationLatitude?: number;
  locationLongitude?: number;
  createdAt: string;
  updatedAt: string;
}

export interface UserOnlineStatus {
  userId: string;
  isOnline: boolean;
  lastSeenAt: string;
}

/**
 * Obtiene los mensajes del chat entre paciente y cuidador
 */
export async function getChatMessages(linkId: string, limit = 50): Promise<ChatMessage[]> {
  try {
    const { data, error } = await supabase
      .from('care_chat_messages')
      .select(`
        id,
        link_id,
        sender_id,
        content,
        location_latitude,
        location_longitude,
        created_at,
        updated_at,
        sender:sender_id(full_name, avatar_url)
      `)
      .eq('link_id', linkId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error fetching chat messages:', error);
      return [];
    }

    return (data || []).map((msg: any) => ({
      id: msg.id,
      linkId: msg.link_id,
      senderId: msg.sender_id,
      senderName: msg.sender?.full_name,
      senderAvatar: msg.sender?.avatar_url,
      content: msg.content,
      locationLatitude: msg.location_latitude,
      locationLongitude: msg.location_longitude,
      createdAt: msg.created_at,
      updatedAt: msg.updated_at,
    }));
  } catch (error) {
    console.error('Error in getChatMessages:', error);
    return [];
  }
}

/**
 * Envía un mensaje de chat
 */
export async function sendChatMessage(
  linkId: string,
  content: string,
  location?: { latitude: number; longitude: number }
): Promise<ChatMessage | null> {
  try {
    const { data, error } = await supabase.functions.invoke('send-chat-message', {
      body: {
        linkId,
        content,
        locationLatitude: location?.latitude,
        locationLongitude: location?.longitude,
      },
    });

    if (error || !data.success) {
      console.error('Error sending chat message:', error);
      return null;
    }

    return {
      id: data.messageId,
      linkId,
      senderId: (await supabase.auth.getUser()).data.user?.id || '',
      content,
      locationLatitude: location?.latitude,
      locationLongitude: location?.longitude,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  } catch (error) {
    console.error('Error in sendChatMessage:', error);
    return null;
  }
}

/**
 * Se suscribe a nuevos mensajes en tiempo real
 */
export function subscribeToChatMessages(
  linkId: string,
  onNewMessage: (message: ChatMessage) => void
): (() => void) {
  const subscription = supabase
    .from('care_chat_messages')
    .on('INSERT', (payload) => {
      if (payload.new.link_id === linkId) {
        onNewMessage({
          id: payload.new.id,
          linkId: payload.new.link_id,
          senderId: payload.new.sender_id,
          content: payload.new.content,
          locationLatitude: payload.new.location_latitude,
          locationLongitude: payload.new.location_longitude,
          createdAt: payload.new.created_at,
          updatedAt: payload.new.updated_at,
        });
      }
    })
    .subscribe();

  return () => {
    supabase.removeSubscription(subscription);
  };
}

/**
 * Obtiene estado en línea de un usuario
 */
export async function getUserOnlineStatus(userId: string): Promise<UserOnlineStatus | null> {
  try {
    const { data, error } = await supabase
      .from('care_user_online_status')
      .select('is_online, last_seen_at')
      .eq('user_id', userId)
      .single();

    if (error || !data) {
      console.warn('User online status not found:', userId);
      return null;
    }

    return {
      userId,
      isOnline: data.is_online,
      lastSeenAt: data.last_seen_at,
    };
  } catch (error) {
    console.error('Error in getUserOnlineStatus:', error);
    return null;
  }
}

/**
 * Se suscribe a cambios en el estado en línea de un usuario
 */
export function subscribeToOnlineStatus(
  userId: string,
  onStatusChange: (status: UserOnlineStatus) => void
): (() => void) {
  const subscription = supabase
    .from('care_user_online_status')
    .on('UPDATE', (payload) => {
      if (payload.new.user_id === userId) {
        onStatusChange({
          userId,
          isOnline: payload.new.is_online,
          lastSeenAt: payload.new.last_seen_at,
        });
      }
    })
    .subscribe();

  return () => {
    supabase.removeSubscription(subscription);
  };
}

/**
 * Actualiza el estado en línea del usuario actual
 */
export async function updateMyOnlineStatus(isOnline: boolean): Promise<boolean> {
  try {
    const { error } = await supabase.rpc('update_user_online_status', {
      p_is_online: isOnline,
    });

    if (error) {
      console.error('Error updating online status:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error in updateMyOnlineStatus:', error);
    return false;
  }
}

export const CaregiverChatService = {
  getChatMessages,
  sendChatMessage,
  subscribeToChatMessages,
  getUserOnlineStatus,
  subscribeToOnlineStatus,
  updateMyOnlineStatus,
};
