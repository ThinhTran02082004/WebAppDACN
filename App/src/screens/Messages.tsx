import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, ActivityIndicator, Image, RefreshControl } from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import Ionicons from '@react-native-vector-icons/ionicons';
import { apiService } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { useSocket } from '../contexts/SocketContext';

interface Conversation {
  _id?: string;
  id?: string;
  participants: Array<{
    _id: string;
    fullName: string;
    avatarUrl?: string;
    roleType?: string;
  }>;
  lastMessage?: {
    content: string;
    timestamp: string;
  };
  updatedAt: string;
  unreadCount?: number | { get?: (userId: string) => number } | Record<string, number>;
}

export default function MessagesScreen() {
  const navigation = useNavigation();
  const { user } = useAuth();
  const { socket, isConnected, on, off, isUserOnline } = useSocket();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchConversations = useCallback(async () => {
    try {
      setLoading(true);
      const response = await apiService.getConversations();
      if (response?.success && response?.data) {
        setConversations(Array.isArray(response.data) ? response.data : []);
      } else {
        setConversations([]);
      }
    } catch (error) {
      console.error('Error fetching conversations:', error);
      setConversations([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchConversations();
    }, [fetchConversations])
  );

  // Listen for real-time message updates
  useEffect(() => {
    if (!socket || !isConnected) return;

    const handleNewMessage = (message: any) => {
      // Update conversation list when a new message is received
      setConversations((prev) => {
        const conversationId = message.conversationId || (message as any).conversation?._id;
        if (!conversationId) return prev;

        const updated = prev.map((conv) => {
          const convId = conv._id || conv.id;
          if (convId === conversationId) {
            // Update last message and timestamp
            return {
              ...conv,
              lastMessage: {
                content: message.content,
                timestamp: message.timestamp,
              },
              updatedAt: message.timestamp,
              // Increment unread count if message is not from current user
              unreadCount: (() => {
                const senderId = typeof message.senderId === 'object' 
                  ? message.senderId?._id 
                  : message.senderId;
                const userId = user?._id || user?.id;
                if (senderId !== userId && userId) {
                  if (typeof conv.unreadCount === 'number') {
                    return conv.unreadCount + 1;
                  } else if (typeof conv.unreadCount === 'object' && !('get' in conv.unreadCount)) {
                    const unreadObj = conv.unreadCount as Record<string, number>;
                    return {
                      ...unreadObj,
                      [userId]: (unreadObj[userId] || 0) + 1,
                    };
                  }
                }
                return conv.unreadCount;
              })(),
            };
          }
          return conv;
        });

        // Move updated conversation to top
        const updatedConv = updated.find(
          (conv) => (conv._id || conv.id) === conversationId
        );
        if (updatedConv) {
          const filtered = updated.filter(
            (conv) => (conv._id || conv.id) !== conversationId
          );
          return [updatedConv, ...filtered];
        }

        return updated;
      });
    };

    const handleMessageNotification = (data: any) => {
      // Refresh conversations when receiving notification
      fetchConversations();
    };

    on('new_message', handleNewMessage);
    on('message_notification', handleMessageNotification);

    return () => {
      off('new_message', handleNewMessage);
      off('message_notification', handleMessageNotification);
    };
  }, [socket, isConnected, user, fetchConversations, on, off]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchConversations();
  }, [fetchConversations]);

  const formatTime = (timestamp?: string) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

    if (diffInHours < 24) {
      return date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
    } else if (diffInHours < 48) {
      return 'Hôm qua';
    } else if (diffInHours < 168) {
      return date.toLocaleDateString('vi-VN', { weekday: 'short' });
    } else {
      return date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
    }
  };

  const getUnreadCount = (conv: Conversation) => {
    if (!conv.unreadCount || !user?._id) return 0;
    if (typeof conv.unreadCount === 'number') return conv.unreadCount;
    if (typeof conv.unreadCount === 'object') {
      if (typeof conv.unreadCount.get === 'function') {
        return conv.unreadCount.get(user._id) || 0;
      }
      if (typeof conv.unreadCount === 'object' && !('get' in conv.unreadCount)) {
        return (conv.unreadCount as Record<string, number>)[user._id] || 0;
      }
    }
    return 0;
  };

  const handleSelectConversation = (conv: Conversation) => {
    // Support both _id and id fields
    const conversationId = conv._id || conv.id;
    if (!conversationId) {
      console.error('Cannot navigate: conversation id is missing', conv);
      return;
    }
    console.log('Navigating to ChatDetail with conversationId:', conversationId);
    (navigation as any).navigate('ChatDetail', { 
      conversationId: conversationId, 
      conversation: conv 
    });
  };

  const renderConversationItem = ({ item, index }: { item: Conversation; index: number }) => {
    const otherParticipant = item.participants?.[0];
    const unreadCount = getUnreadCount(item);
    const lastMessage = item.lastMessage?.content || 'Chưa có tin nhắn';
    const time = formatTime(item.lastMessage?.timestamp || item.updatedAt);

    return (
      <TouchableOpacity
        style={styles.conversationItem}
        onPress={() => handleSelectConversation(item)}
        activeOpacity={0.7}
      >
        <View style={styles.avatarContainer}>
          <View style={styles.avatarWrapper}>
            {otherParticipant?.avatarUrl ? (
              <Image
                source={{ uri: otherParticipant.avatarUrl }}
                style={styles.avatar}
              />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Text style={styles.avatarText}>
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
        </View>

        <View style={styles.conversationContent}>
          <View style={styles.conversationHeader}>
            <Text style={styles.conversationName} numberOfLines={1}>
              {otherParticipant?.fullName || 'Unknown'}
            </Text>
            {time && (
              <Text style={styles.conversationTime}>{time}</Text>
            )}
          </View>

          {otherParticipant?.roleType && (
            <View style={styles.roleBadge}>
              <Text style={styles.roleText}>
                {otherParticipant.roleType === 'doctor' ? 'Bác sĩ' : 'Bệnh nhân'}
              </Text>
            </View>
          )}

          <View style={styles.conversationFooter}>
            <Text
              style={[styles.lastMessage, unreadCount > 0 && styles.lastMessageUnread]}
              numberOfLines={1}
            >
              {lastMessage}
            </Text>
            {unreadCount > 0 && (
              <View style={styles.unreadBadge}>
                <Text style={styles.unreadText}>
                  {unreadCount > 9 ? '9+' : unreadCount}
                </Text>
              </View>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Tin nhắn</Text>
          <Text style={styles.headerSubtitle}>Trao đổi nhanh với bác sĩ của bạn</Text>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4c6ef5" />
          <Text style={styles.loadingText}>Đang tải...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Tin nhắn</Text>
        <Text style={styles.headerSubtitle}>Trao đổi nhanh với bác sĩ của bạn</Text>
      </View>

      {conversations.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="chatbubble-ellipses-outline" size={72} color="#a5b4fc" />
          <Text style={styles.emptyTitle}>Chưa có cuộc trò chuyện nào</Text>
          <Text style={styles.emptyText}>
            Tin nhắn sẽ xuất hiện ở đây khi bạn trao đổi với bác sĩ hoặc nhân viên hỗ trợ.
          </Text>
          <TouchableOpacity
            style={styles.exploreButton}
            onPress={() => (navigation as any)?.navigate?.('Home')}
            activeOpacity={0.8}
          >
            <Ionicons name="search" size={18} color="#fff" style={{ marginRight: 6 }} />
            <Text style={styles.exploreButtonText}>Tìm bác sĩ để trò chuyện</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={conversations}
          renderItem={renderConversationItem}
          keyExtractor={(item, index) => item._id || item.id || `conversation-${index}`}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#4c6ef5" />
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f7fb',
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 52,
    paddingBottom: 24,
    backgroundColor: '#4c6ef5',
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#fff',
  },
  headerSubtitle: {
    marginTop: 6,
    fontSize: 14,
    color: '#e0e7ff',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#6b7280',
  },
  listContent: {
    paddingTop: 12,
  },
  conversationItem: {
    flexDirection: 'row',
    padding: 16,
    backgroundColor: '#fff',
    marginHorizontal: 12,
    marginBottom: 8,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  avatarContainer: {
    marginRight: 12,
  },
  avatarWrapper: {
    position: 'relative',
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  avatarPlaceholder: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#4c6ef5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '600',
  },
  onlineIndicator: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#9ca3af',
    borderWidth: 2,
    borderColor: '#fff',
  },
  onlineIndicatorActive: {
    backgroundColor: '#10b981',
  },
  conversationContent: {
    flex: 1,
  },
  conversationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  conversationName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    flex: 1,
  },
  conversationTime: {
    fontSize: 12,
    color: '#6b7280',
    marginLeft: 8,
  },
  roleBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#dbeafe',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    marginBottom: 4,
  },
  roleText: {
    fontSize: 11,
    color: '#1e40af',
    fontWeight: '500',
  },
  conversationFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  lastMessage: {
    fontSize: 14,
    color: '#6b7280',
    flex: 1,
  },
  lastMessageUnread: {
    fontWeight: '600',
    color: '#1f2937',
  },
  unreadBadge: {
    backgroundColor: '#4c6ef5',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
    marginLeft: 8,
  },
  unreadText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    marginTop: -24,
  },
  emptyTitle: {
    marginTop: 18,
    fontSize: 18,
    fontWeight: '700',
    color: '#1f2937',
    textAlign: 'center',
  },
  emptyText: {
    marginTop: 10,
    fontSize: 14,
    color: '#6b7280',
    lineHeight: 20,
    textAlign: 'center',
  },
  exploreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#4c6ef5',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 24,
    marginTop: 24,
    elevation: 2,
  },
  exploreButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
});

