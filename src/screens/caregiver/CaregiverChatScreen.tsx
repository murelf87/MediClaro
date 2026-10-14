/**
 * Pantalla de chat entre cuidador y paciente
 * - Fotos de perfil
 * - Estado en línea
 * - Mensajes
 * - Botón para compartir ubicación
 */
import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { CaregiverChatService, ChatMessage, UserOnlineStatus } from '../../services/CaregiverChatService';
import { getCurrentLocation } from '../../services/LocationService';
import { useAppTheme } from '../../hooks';

interface CaregiverChatScreenProps {
  route: {
    params: {
      linkId: string;
      otherUserName: string;
      otherUserAvatar?: string;
      otherUserId: string;
    };
  };
}

export function CaregiverChatScreen({ route }: CaregiverChatScreenProps) {
  const { linkId, otherUserName, otherUserAvatar, otherUserId } = route.params;
  const theme = useAppTheme();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [messageText, setMessageText] = useState('');
  const [loading, setLoading] = useState(true);
  const [onlineStatus, setOnlineStatus] = useState<UserOnlineStatus | null>(null);
  const [sendingLocation, setSendingLocation] = useState(false);

  // Cargar mensajes iniciales
  useFocusEffect(
    useCallback(() => {
      const loadMessages = async () => {
        setLoading(true);
        const msgs = await CaregiverChatService.getChatMessages(linkId);
        setMessages(msgs.reverse()); // Invertir para mostrar los más nuevos abajo
        setLoading(false);
      };

      const loadOnlineStatus = async () => {
        const status = await CaregiverChatService.getUserOnlineStatus(otherUserId);
        setOnlineStatus(status);
      };

      loadMessages();
      loadOnlineStatus();

      // Actualizar mi propio estado a en línea
      CaregiverChatService.updateMyOnlineStatus(true);

      // Suscribirse a nuevos mensajes
      const unsubscribeChat = CaregiverChatService.subscribeToChatMessages(linkId, (newMsg) => {
        setMessages((prev) => [...prev, newMsg]);
      });

      // Suscribirse a cambios en estado en línea
      const unsubscribeStatus = CaregiverChatService.subscribeToOnlineStatus(otherUserId, setOnlineStatus);

      return () => {
        unsubscribeChat();
        unsubscribeStatus();
        // Actualizar estado a desconectado cuando salimos
        CaregiverChatService.updateMyOnlineStatus(false);
      };
    }, [linkId, otherUserId])
  );

  const handleSendMessage = async () => {
    if (messageText.trim() === '') return;

    const msg = await CaregiverChatService.sendChatMessage(linkId, messageText.trim());
    if (msg) {
      setMessageText('');
    }
  };

  const handleShareLocation = async () => {
    setSendingLocation(true);
    try {
      const location = await getCurrentLocation();
      if (location) {
        const msg = await CaregiverChatService.sendChatMessage(
          linkId,
          '📍 Ubicación compartida',
          { latitude: location.latitude, longitude: location.longitude }
        );
        if (msg) {
          setMessageText('');
        }
      }
    } finally {
      setSendingLocation(false);
    }
  };

  const renderMessage = ({ item }: { item: ChatMessage }) => {
    const isMe = false; // TODO: Comparar con current user

    return (
      <View style={[styles.messageContainer, isMe && styles.messageContainerMe]}>
        {!isMe && (
          <Image
            source={{ uri: item.senderAvatar || 'https://via.placeholder.com/40' }}
            style={styles.avatar}
          />
        )}
        <View style={[styles.messageBubble, isMe && styles.messageBubbleMe]}>
          {!isMe && <Text style={styles.senderName}>{item.senderName}</Text>}
          <Text style={[styles.messageText, isMe && styles.messageTextMe]}>
            {item.content}
          </Text>
          <Text style={[styles.timestamp, isMe && styles.timestampMe]}>
            {new Date(item.createdAt).toLocaleTimeString()}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        {/* Header con foto y estado */}
        <View style={[styles.header, { backgroundColor: theme.colors.surface }]}>
          <Image
            source={{ uri: otherUserAvatar || 'https://via.placeholder.com/50' }}
            style={styles.headerAvatar}
          />
          <View style={styles.headerInfo}>
            <Text style={styles.headerName}>{otherUserName}</Text>
            {onlineStatus ? (
              <Text style={onlineStatus.isOnline ? styles.onlineText : styles.offlineText}>
                {onlineStatus.isOnline ? '🟢 En línea' : `⚫ Hace ${getTimeAgo(onlineStatus.lastSeenAt)}`}
              </Text>
            ) : (
              <ActivityIndicator />
            )}
          </View>
        </View>

        {/* Mensajes */}
        {loading ? (
          <ActivityIndicator style={{ flex: 1 }} />
        ) : (
          <FlatList
            data={messages}
            renderItem={renderMessage}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.messagesList}
          />
        )}

        {/* Input */}
        <View style={[styles.inputContainer, { backgroundColor: theme.colors.surface }]}>
          <TextInput
            style={[styles.input, { color: theme.colors.text }]}
            placeholder="Escribe un mensaje..."
            placeholderTextColor={theme.colors.textSecondary}
            value={messageText}
            onChangeText={setMessageText}
            multiline
          />
          <TouchableOpacity
            style={styles.locationButton}
            onPress={handleShareLocation}
            disabled={sendingLocation}
          >
            {sendingLocation ? (
              <ActivityIndicator size="small" />
            ) : (
              <Text style={styles.locationButtonText}>📍</Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.sendButton}
            onPress={handleSendMessage}
            disabled={messageText.trim() === ''}
          >
            <Text style={styles.sendButtonText}>Enviar</Text>
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

function getTimeAgo(timestamp: string): string {
  const now = new Date();
  const then = new Date(timestamp);
  const diff = Math.floor((now.getTime() - then.getTime()) / 1000);

  if (diff < 60) return 'hace poco';
  if (diff < 3600) return `hace ${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `hace ${Math.floor(diff / 3600)}h`;
  return `hace ${Math.floor(diff / 86400)}d`;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  headerAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 12,
  },
  headerInfo: {
    flex: 1,
  },
  headerName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  onlineText: {
    fontSize: 12,
    color: '#10b981',
    fontWeight: '500',
  },
  offlineText: {
    fontSize: 12,
    color: '#9ca3af',
  },
  messagesList: {
    padding: 12,
    flexGrow: 1,
    justifyContent: 'flex-end',
  },
  messageContainer: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  messageContainerMe: {
    justifyContent: 'flex-end',
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 8,
  },
  messageBubble: {
    maxWidth: '80%',
    backgroundColor: '#e5e7eb',
    borderRadius: 12,
    padding: 10,
  },
  messageBubbleMe: {
    backgroundColor: '#10b981',
  },
  senderName: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
    color: '#1f2937',
  },
  messageText: {
    fontSize: 14,
    color: '#1f2937',
  },
  messageTextMe: {
    color: '#ffffff',
  },
  timestamp: {
    fontSize: 11,
    color: '#9ca3af',
    marginTop: 4,
  },
  timestampMe: {
    color: '#d1d5db',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    maxHeight: 100,
    marginRight: 8,
  },
  locationButton: {
    padding: 8,
    marginRight: 4,
  },
  locationButtonText: {
    fontSize: 20,
  },
  sendButton: {
    backgroundColor: '#10b981',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
  },
  sendButtonText: {
    color: '#ffffff',
    fontWeight: '600',
  },
});
