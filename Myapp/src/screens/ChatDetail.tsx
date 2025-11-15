import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  Keyboard,
  Alert,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@react-native-vector-icons/ionicons';
import { apiService } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { useSocket } from '../contexts/SocketContext';

interface Message {
  _id: string;
  content: string;
  senderId: string | { _id: string; fullName: string; avatarUrl?: string };
  timestamp: string;
  type?: string;
}

export default function ChatDetailScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { socket, isConnected, emit, on, off, isUserOnline } = useSocket();
  
  // Extract params with better error handling
  const params = route.params as { conversationId?: string; conversation?: any } | undefined;
  const conversationId = params?.conversationId;
  const initialConversation = params?.conversation;

  // Debug log
  console.log('ChatDetail params:', { conversationId, hasConversation: !!initialConversation });

  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [conversation, setConversation] = useState(initialConversation);
  const flatListRef = useRef<FlatList>(null);
  const markedMessagesRef = useRef(new Set<string>()); // Track already marked messages
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  const otherParticipant = conversation?.participants?.[0];
  const currentUserId = user?._id || user?.id;

  // Listen to keyboard events
  useEffect(() => {
    const keyboardWillShow = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      (e) => {
        setKeyboardHeight(e.endCoordinates.height);
        // Scroll to bottom when keyboard appears
        setTimeout(() => {
          flatListRef.current?.scrollToEnd({ animated: true });
        }, 100);
      }
    );

    const keyboardWillHide = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => {
        setKeyboardHeight(0);
      }
    );

    return () => {
      keyboardWillShow.remove();
      keyboardWillHide.remove();
    };
  }, []);

  // Fetch messages and join conversation room
  useEffect(() => {
    if (conversationId) {
      fetchMessages();
      
      // Join conversation room for real-time updates
      if (isConnected) {
        emit('join_conversation', { conversationId });
        console.log('[ChatDetail] Joined conversation room:', conversationId);
      }

      return () => {
        // Leave conversation room on unmount
        if (isConnected) {
          emit('leave_conversation', { conversationId });
          console.log('[ChatDetail] Left conversation room:', conversationId);
        }
      };
    } else {
      console.error('ChatDetail: conversationId is undefined');
      setLoading(false);
    }
  }, [conversationId, isConnected]);

  // Listen for real-time messages
  useEffect(() => {
    if (!socket || !isConnected || !conversationId) return;

    const handleNewMessage = (message: Message) => {
      // Check if message belongs to this conversation
      const messageConvId = (message as any).conversationId || conversationId;
      if (messageConvId === conversationId) {
        // Check if message already exists to avoid duplicates
        setMessages((prev) => {
          const exists = prev.some((msg) => msg._id === message._id);
          if (exists) return prev;
          return [...prev, message];
        });
        
        // Scroll to bottom
        setTimeout(() => {
          flatListRef.current?.scrollToEnd({ animated: true });
        }, 100);
        
        // Mark as read if it's not from current user and not already marked
        const incomingSenderId = typeof message.senderId === 'object' ? message.senderId?._id : message.senderId;
        if (incomingSenderId && currentUserId && incomingSenderId !== currentUserId) {
          if (!markedMessagesRef.current.has(message._id)) {
            markMessagesAsRead([message._id]);
            markedMessagesRef.current.add(message._id);
          }
        }
      }
    };

    on('new_message', handleNewMessage);

    return () => {
      off('new_message', handleNewMessage);
    };
  }, [socket, isConnected, conversationId, currentUserId, on, off]);

  const fetchMessages = async () => {
    if (!conversationId) {
      console.error('Cannot fetch messages: conversationId is undefined');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const response = await apiService.getConversationMessages(conversationId);
      if (response?.success && response?.data) {
        const fetchedMessages = Array.isArray(response.data) ? response.data : [];
        setMessages(fetchedMessages);
        
        // Reset marked messages when fetching
        markedMessagesRef.current.clear();
        
        // Mark unread messages as read
        const unreadMessageIds = fetchedMessages
          .filter((msg) => {
            const messageSenderId = typeof msg.senderId === 'object' ? msg.senderId?._id : msg.senderId;
            const isUnread = messageSenderId !== currentUserId && !(msg as any).isRead;
            return isUnread;
          })
          .map((msg) => msg._id);
        
        if (unreadMessageIds.length > 0) {
          markMessagesAsRead(unreadMessageIds);
          unreadMessageIds.forEach((id) => markedMessagesRef.current.add(id));
        }
        
        // Scroll to bottom after loading
        setTimeout(() => {
          flatListRef.current?.scrollToEnd({ animated: false });
        }, 100);
      }
    } catch (error) {
      console.error('Error fetching messages:', error);
    } finally {
      setLoading(false);
    }
  };

  const markMessagesAsRead = async (messageIds: string[]) => {
    try {
      if (isConnected && conversationId) {
        emit('mark_as_read', { conversationId, messageIds });
      }
    } catch (error) {
      console.error('Error marking messages as read:', error);
    }
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim() || sending || !conversationId) return;

    const messageContent = newMessage.trim();
    setNewMessage('');
    setSending(true);

    try {
      const response = await apiService.sendMessage(conversationId, messageContent);
      if (response?.success && response?.data) {
        // Message will be added via socket event, but add optimistically for better UX
        setMessages((prev) => {
          const exists = prev.some((msg) => msg._id === response.data._id);
          if (exists) return prev;
          return [...prev, response.data];
        });
        // Scroll to bottom
        setTimeout(() => {
          flatListRef.current?.scrollToEnd({ animated: true });
        }, 100);
      } else {
        // Restore message if send failed
        setNewMessage(messageContent);
        Alert.alert('Lỗi', 'Không thể gửi tin nhắn. Vui lòng thử lại.');
      }
    } catch (error: any) {
      console.error('Error sending message:', error);
      setNewMessage(messageContent);
      Alert.alert('Lỗi', error?.response?.data?.message || 'Không thể gửi tin nhắn. Vui lòng thử lại.');
    } finally {
      setSending(false);
    }
  };

  const isMyMessage = (message: Message) => {
    const senderId = typeof message.senderId === 'object' ? message.senderId?._id : message.senderId;
    return senderId === currentUserId;
  };

  const formatTime = (timestamp: string | undefined | null | Date) => {
    if (!timestamp) return '';
    
    try {
      let date: Date;
      
      // Handle different timestamp formats
      if (timestamp instanceof Date) {
        date = timestamp;
      } else if (typeof timestamp === 'string') {
        // Try parsing as ISO string or timestamp
        date = new Date(timestamp);
      } else if (typeof timestamp === 'number') {
        // Handle Unix timestamp (in milliseconds)
        date = new Date(timestamp);
      } else {
        console.warn('Unsupported timestamp format:', timestamp);
        return '';
      }
      
      // Check if date is valid
      if (isNaN(date.getTime())) {
        console.warn('Invalid timestamp:', timestamp);
        return '';
      }
      
      return date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
    } catch (error) {
      console.error('Error formatting time:', error, timestamp);
      return '';
    }
  };

  const renderMessage = ({ item }: { item: Message }) => {
    const isMine = isMyMessage(item);
    const senderId = typeof item.senderId === 'object' ? item.senderId?._id : item.senderId;
    const senderName = typeof item.senderId === 'object' ? item.senderId?.fullName : 'Unknown';

    return (
      <View
        style={[
          styles.messageContainer,
          isMine ? styles.myMessageContainer : styles.otherMessageContainer,
        ]}
      >
        {!isMine && (
          <View style={styles.avatarContainer}>
            {typeof item.senderId === 'object' && item.senderId?.avatarUrl ? (
              <Image
                source={{ uri: item.senderId.avatarUrl }}
                style={styles.messageAvatar}
              />
            ) : (
              <View style={styles.messageAvatarPlaceholder}>
                <Text style={styles.messageAvatarText}>
                  {senderName.charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
          </View>
        )}
        <View
          style={[
            styles.messageBubble,
            isMine ? styles.myMessageBubble : styles.otherMessageBubble,
          ]}
        >
          {!isMine && (
            <Text style={styles.senderName}>{senderName}</Text>
          )}
          <Text style={[styles.messageText, isMine && styles.myMessageText]}>
            {item.content}
          </Text>
          <Text style={[styles.messageTime, isMine && styles.myMessageTime]}>
            {formatTime(item.timestamp || (item as any).createdAt)}
          </Text>
        </View>
      </View>
    );
  };

  if (!conversationId) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Lỗi</Text>
          <View style={styles.placeholder} />
        </View>
        <View style={styles.loadingContainer}>
          <Ionicons name="alert-circle-outline" size={48} color="#ef4444" />
          <Text style={styles.loadingText}>Không tìm thấy cuộc trò chuyện</Text>
          <TouchableOpacity
            style={styles.errorButton}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.errorButtonText}>Quay lại</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (loading && messages.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>
            {otherParticipant?.fullName || 'Chat'}
          </Text>
          <View style={styles.placeholder} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4c6ef5" />
          <Text style={styles.loadingText}>Đang tải tin nhắn...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <View style={styles.headerInfo}>
            <View style={styles.avatarWrapper}>
              {otherParticipant?.avatarUrl ? (
                <Image
                  source={{ uri: otherParticipant.avatarUrl }}
                  style={styles.headerAvatar}
                />
              ) : (
                <View style={styles.headerAvatarPlaceholder}>
                  <Text style={styles.headerAvatarText}>
                    {otherParticipant?.fullName?.charAt(0)?.toUpperCase() || 'U'}
                  </Text>
                </View>
              )}
              {/* Online/Offline indicator */}
              {otherParticipant?._id && (
                <View style={[
                  styles.onlineIndicator,
                  isUserOnline(otherParticipant._id) && styles.onlineIndicatorActive
                ]} />
              )}
            </View>
            <View style={styles.headerTextContainer}>
              <Text style={styles.headerTitle} numberOfLines={1}>
                {otherParticipant?.fullName || 'Chat'}
              </Text>
              <View style={styles.statusContainer}>
                {otherParticipant?.roleType && (
                  <Text style={styles.headerSubtitle}>
                    {otherParticipant.roleType === 'doctor' ? 'Bác sĩ' : 'Bệnh nhân'}
                  </Text>
                )}
                {otherParticipant?._id && (
                  <Text style={[
                    styles.statusText,
                    isUserOnline(otherParticipant._id) && styles.statusTextOnline
                  ]}>
                    {isUserOnline(otherParticipant._id) ? '• Đang hoạt động' : '• Offline'}
                  </Text>
                )}
              </View>
            </View>
          </View>
          <View style={styles.placeholder} />
        </View>

        {/* Messages List */}
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={(item) => item._id}
          contentContainerStyle={styles.messagesList}
          style={{ flex: 1 }}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
          showsVerticalScrollIndicator={true}
          onContentSizeChange={() => {
            flatListRef.current?.scrollToEnd({ animated: false });
          }}
        />

        {/* Input Area */}
        <View style={[
          styles.inputContainer, 
          { 
            paddingBottom: keyboardHeight > 0 
              ? 4 
              : Math.max(insets.bottom, 2)
          }
        ]}>
          <TextInput
            style={styles.input}
            value={newMessage}
            onChangeText={setNewMessage}
            placeholder="Nhập tin nhắn..."
            placeholderTextColor="#9ca3af"
            multiline
            maxLength={1000}
            onFocus={() => {
              // Scroll to bottom when input is focused
              setTimeout(() => {
                flatListRef.current?.scrollToEnd({ animated: true });
              }, 300);
            }}
          />
          <TouchableOpacity
            style={[styles.sendButton, sending && styles.sendButtonDisabled]}
            onPress={handleSendMessage}
            disabled={!newMessage.trim() || sending}
          >
            {sending ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Ionicons name="send" size={20} color="#fff" />
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f7fb',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingTop: 50,
    backgroundColor: '#4c6ef5',
  },
  backButton: {
    padding: 8,
    marginRight: 8,
  },
  headerInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarWrapper: {
    position: 'relative',
    marginRight: 12,
  },
  headerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  headerAvatarPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerAvatarText: {
    color: '#4c6ef5',
    fontSize: 18,
    fontWeight: '600',
  },
  onlineIndicator: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#9ca3af',
    borderWidth: 2,
    borderColor: '#4c6ef5',
  },
  onlineIndicatorActive: {
    backgroundColor: '#10b981',
  },
  headerTextContainer: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
    flexWrap: 'wrap',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#e0e7ff',
    marginRight: 6,
  },
  statusText: {
    fontSize: 12,
    color: '#9ca3af',
  },
  statusTextOnline: {
    color: '#10b981',
  },
  placeholder: {
    width: 40,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
  },
  errorButton: {
    marginTop: 16,
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: '#4c6ef5',
    borderRadius: 8,
  },
  errorButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  messagesList: {
    padding: 16,
    paddingBottom: 8,
  },
  messageContainer: {
    flexDirection: 'row',
    marginBottom: 12,
    alignItems: 'flex-end',
  },
  myMessageContainer: {
    justifyContent: 'flex-end',
  },
  otherMessageContainer: {
    justifyContent: 'flex-start',
  },
  avatarContainer: {
    marginRight: 8,
  },
  messageAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  messageAvatarPlaceholder: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#4c6ef5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  messageAvatarText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  messageBubble: {
    maxWidth: '75%',
    padding: 12,
    borderRadius: 16,
  },
  myMessageBubble: {
    backgroundColor: '#4c6ef5',
    borderBottomRightRadius: 4,
  },
  otherMessageBubble: {
    backgroundColor: '#fff',
    borderBottomLeftRadius: 4,
  },
  senderName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#4c6ef5',
    marginBottom: 4,
  },
  messageText: {
    fontSize: 15,
    color: '#1f2937',
    lineHeight: 20,
  },
  myMessageText: {
    color: '#fff',
  },
  messageTime: {
    fontSize: 11,
    color: '#6b7280',
    marginTop: 4,
    alignSelf: 'flex-end',
  },
  myMessageTime: {
    color: '#e0e7ff',
  },
  inputContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 8,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    alignItems: 'flex-end',
  },
  input: {
    flex: 1,
    maxHeight: 100,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#f3f4f6',
    borderRadius: 20,
    fontSize: 15,
    color: '#1f2937',
    marginRight: 8,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#4c6ef5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
});

