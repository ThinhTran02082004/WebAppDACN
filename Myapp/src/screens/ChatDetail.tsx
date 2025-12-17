import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
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

interface AppointmentMessageData {
  appointmentId?: string | { _id?: string; id?: string };
  bookingCode?: string;
  doctorName?: string;
  patientName?: string;
  hospitalName?: string;
  serviceName?: string;
  appointmentDate?: string;
  timeSlot?: {
    startTime?: string;
    endTime?: string;
  };
  status?: string;
}

interface Message {
  _id: string;
  content: string;
  senderId: string | { _id: string; fullName: string; avatarUrl?: string };
  timestamp: string;
  type?: string;
  messageType?: string;
  appointmentData?: AppointmentMessageData;
}

const appointmentStatusStyles: Record<
  string,
  { label: string; background: string; border: string; color: string }
> = {
  pending: { label: 'Chờ xác nhận', background: '#fff7ed', border: '#fed7aa', color: '#c2410c' },
  confirmed: { label: 'Đã xác nhận', background: '#eff6ff', border: '#bfdbfe', color: '#1d4ed8' },
  completed: { label: 'Hoàn thành', background: '#ecfdf5', border: '#bbf7d0', color: '#047857' },
  cancelled: { label: 'Đã hủy', background: '#fef2f2', border: '#fecaca', color: '#b91c1c' },
  rejected: { label: 'Từ chối', background: '#f3f4f6', border: '#e5e7eb', color: '#374151' },
};

const getAppointmentStatusInfo = (status?: string) => {
  if (!status) {
    return { label: 'Không xác định', background: '#e0e7ff', border: '#c7d2fe', color: '#3730a3' };
  }
  const normalized = status.toLowerCase();
  return appointmentStatusStyles[normalized] || {
    label: status,
    background: '#e0f2fe',
    border: '#bae6fd',
    color: '#0369a1',
  };
};

const formatAppointmentDate = (dateStr?: string) => {
  if (!dateStr) return '—';
  try {
    return new Date(dateStr).toLocaleDateString('vi-VN', {
      weekday: 'short',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
};

const formatAppointmentTimeRange = (slot?: { startTime?: string; endTime?: string }) => {
  if (!slot?.startTime || !slot?.endTime) return '—';
  return `${slot.startTime} - ${slot.endTime}`;
};

const extractAppointmentId = (raw?: string | { _id?: string; id?: string }) => {
  if (!raw) return undefined;
  if (typeof raw === 'string') return raw;
  return raw._id || raw.id;
};

const formatDoctorDisplayName = (rawName?: string) => {
  if (!rawName) return 'Đang cập nhật';
  const name = rawName.trim();
  if (!name) return 'Đang cập nhật';
  const normalized = name.replace(/^bác sĩ\s+/i, '').replace(/^bs\.?\s*/i, '');
  return `BS. ${normalized}`;
};

const formatHospitalDisplayName = (rawName?: string) => {
  if (!rawName) return 'Đang cập nhật';
  const name = rawName.trim();
  if (!name) return 'Đang cập nhật';
  const withoutPrefix = name.replace(/^bv\.?\s*/i, '');
  return `Bv ${withoutPrefix || name}`;
};

export default function ChatDetailScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { socket, isConnected, emit, on, off, isUserOnline } = useSocket();
  
  // Extract params with better error handling
  const params = route.params as { 
    conversationId?: string; 
    conversation?: any;
    doctorInfo?: {
      fullName?: string;
      avatarUrl?: string;
      roleType?: string;
      _id?: string;
    };
  } | undefined;
  const conversationId = params?.conversationId;
  const initialConversation = params?.conversation;
  const doctorInfo = params?.doctorInfo;


  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [conversation, setConversation] = useState(initialConversation);
  const flatListRef = useRef<FlatList>(null);
  const markedMessagesRef = useRef(new Set<string>()); // Track already marked messages
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [fetchedDoctorAvatar, setFetchedDoctorAvatar] = useState<string | undefined>(undefined);

  const otherParticipant = useMemo(() => {
    const baseParticipant = conversation?.participants?.[0] || {};
    const participantId = baseParticipant._id || baseParticipant.id;
    
    if (doctorInfo) {
      // Use doctorInfo._id if provided (real doctor user ID for online status),
      // otherwise fallback to participant ID
      const userIdForOnlineCheck = doctorInfo._id || participantId;
      
      return {
        ...baseParticipant,
        _id: userIdForOnlineCheck, // Use doctor's real user ID for online status check
        fullName: doctorInfo.fullName || baseParticipant.fullName,
        avatarUrl: doctorInfo.avatarUrl || baseParticipant.avatarUrl || fetchedDoctorAvatar || undefined,
        roleType: doctorInfo.roleType || baseParticipant.roleType || 'doctor'
      };
    }
    return {
      ...baseParticipant,
      _id: participantId,
      avatarUrl: baseParticipant.avatarUrl || fetchedDoctorAvatar || undefined
    };
  }, [conversation?.participants, doctorInfo, fetchedDoctorAvatar]);
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

  // Fetch doctor avatar from appointment or doctor list if not provided in doctorInfo
  useEffect(() => {
    if (!doctorInfo?.avatarUrl && conversation) {
      const participant = conversation.participants?.[0];
      
      // Skip if participant already has avatarUrl
      if (participant?.avatarUrl) return;
      
      // Skip if not a doctor
      if (participant?.roleType !== 'doctor' || !participant._id) return;
      
      const appointmentId = typeof conversation.appointmentId === 'object' 
        ? conversation.appointmentId?._id 
        : conversation.appointmentId;
      
      // Helper function to fetch avatar from doctor list
      const fetchDoctorAvatarFromList = async (userId: string) => {
        try {
          // Try to get doctors list and find matching doctor
          const doctorsResponse = await apiService.getDoctors({ limit: 100 });
          if (doctorsResponse?.success && doctorsResponse?.data) {
            let doctorsData: any[] = [];
            if ('doctors' in doctorsResponse.data) {
              doctorsData = doctorsResponse.data.doctors || [];
            } else if (Array.isArray(doctorsResponse.data)) {
              doctorsData = doctorsResponse.data;
            }
            
            // Find doctor by user ID
            const doctor = doctorsData.find((d: any) => {
              const doctorUserId = typeof d.user === 'object' ? d.user?._id : d.user;
              return doctorUserId === userId;
            });
            
            if (doctor?.user?.avatarUrl) {
              setFetchedDoctorAvatar(doctor.user.avatarUrl);
            }
          }
        } catch (err) {
          // Silently fail
        }
      };
      
      // Try to fetch from appointment first if available
      if (appointmentId) {
        apiService.getAppointmentById(appointmentId)
          .then((apptResponse) => {
            if (apptResponse?.success && apptResponse?.data) {
              const appointment = apptResponse.data;
              const doctorAvatarUrl = appointment.doctorId?.user?.avatarUrl || 
                                   (appointment.doctorId as any)?.user?.avatarUrl;
              if (doctorAvatarUrl) {
                setFetchedDoctorAvatar(doctorAvatarUrl);
              } else {
                // If appointment doesn't have avatar, try fetching from doctor list
                fetchDoctorAvatarFromList(participant._id);
              }
            } else {
              // If appointment fetch fails, try fetching from doctor list
              fetchDoctorAvatarFromList(participant._id);
            }
          })
          .catch(() => {
            // If appointment fetch fails, try fetching from doctor list
            fetchDoctorAvatarFromList(participant._id);
          });
      } else {
        // If no appointmentId, try to fetch from doctor list
        fetchDoctorAvatarFromList(participant._id);
      }
    }
  }, [conversation, doctorInfo]);

  // Fetch messages and join conversation room
  useEffect(() => {
    if (conversationId) {
      fetchMessages();
      
      // Join conversation room for real-time updates
      if (isConnected) {
        emit('join_conversation', { conversationId });
      }

      return () => {
        // Leave conversation room on unmount
        if (isConnected) {
          emit('leave_conversation', { conversationId });
        }
      };
    } else {
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
      // Error fetching messages
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
      // Error marking messages as read
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
        return '';
      }
      
      // Check if date is valid
      if (isNaN(date.getTime())) {
        return '';
      }
      
      return date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
    } catch (error) {
      return '';
    }
  };

  const handleOpenAppointmentCard = useCallback(
    (appointmentData?: AppointmentMessageData) => {
      const appointmentId = extractAppointmentId(appointmentData?.appointmentId);
      if (!appointmentId) {
        Alert.alert('Thông báo', 'Không tìm thấy thông tin lịch hẹn để mở.');
        return;
      }
      navigation.navigate('AppointmentDetail' as never, { appointmentId } as never);
    },
    [navigation]
  );

  const renderMessage = ({ item }: { item: Message }) => {
    // Check if this is a system message (video call start/end, system notifications)
    const isSystemMessage = item.messageType === 'video_call_end' || 
                           item.messageType === 'video_call_start' || 
                           item.messageType === 'system';

    if (isSystemMessage) {
      // Render as system notification (centered, no avatar, different styling)
      return (
        <View style={styles.systemMessageContainer}>
          <View style={styles.systemMessageBubble}>
            <Text style={styles.systemMessageText}>
              {item.content}
            </Text>
            <Text style={styles.systemMessageTime}>
              {formatTime(item.timestamp || (item as any).createdAt)}
            </Text>
          </View>
        </View>
      );
    }

    const isMine = isMyMessage(item);
    const senderId = typeof item.senderId === 'object' ? item.senderId?._id : item.senderId;
    const senderName = typeof item.senderId === 'object' ? item.senderId?.fullName : 'Unknown';

    if (item.messageType === 'appointment' && item.appointmentData) {
      const appointmentId = extractAppointmentId(item.appointmentData.appointmentId);
      const statusInfo = getAppointmentStatusInfo(item.appointmentData.status);
      return (
        <View
          style={[
            styles.messageContainer,
            isMine ? styles.myMessageContainer : styles.otherMessageContainer,
          ]}
        >
          {!isMine && (
            <View style={styles.avatarContainer}>
              {(typeof item.senderId === 'object' && item.senderId?.avatarUrl) || otherParticipant?.avatarUrl ? (
                <Image 
                  source={{ uri: (typeof item.senderId === 'object' && item.senderId?.avatarUrl) || otherParticipant?.avatarUrl || '' }} 
                  style={styles.messageAvatar}
                  onError={() => {
                    // Avatar failed to load
                  }}
                />
              ) : (
                <View style={styles.messageAvatarPlaceholder}>
                  <Text style={styles.messageAvatarText}>{senderName.charAt(0).toUpperCase()}</Text>
                </View>
              )}
            </View>
          )}
          <TouchableOpacity
            activeOpacity={0.85}
            style={[
              styles.appointmentCardWrapper,
              isMine && styles.appointmentCardWrapperMine,
            ]}
            onPress={() => handleOpenAppointmentCard(item.appointmentData)}
          >
            <View style={styles.appointmentCardHeader}>
              <View style={styles.appointmentCardTitleRow}>
                <Ionicons name="calendar-outline" size={18} color="#2563eb" />
                <Text style={styles.appointmentCardTitle}>Lịch hẹn</Text>
              </View>
              <View
                style={[
                  styles.appointmentStatusBadge,
                  {
                    backgroundColor: statusInfo.background,
                    borderColor: statusInfo.border,
                  },
                ]}
              >
                <Text style={[styles.appointmentStatusText, { color: statusInfo.color }]}>
                  {statusInfo.label}
                </Text>
              </View>
            </View>
            <View style={styles.appointmentInfoRow}>
              <Text style={styles.appointmentInfoLabel}>Mã</Text>
              <Text style={styles.appointmentInfoValue}>
                {item.appointmentData.bookingCode || (appointmentId ? `#${appointmentId}` : '—')}
              </Text>
            </View>
            <View style={styles.appointmentInfoRow}>
              <Text style={styles.appointmentInfoLabel}>Bác sĩ</Text>
              <Text style={styles.appointmentInfoValue} numberOfLines={1}>
                {formatDoctorDisplayName(item.appointmentData.doctorName)}
              </Text>
            </View>
            <View style={styles.appointmentInfoRow}>
              <Text style={styles.appointmentInfoLabel}>Ngày</Text>
              <Text style={styles.appointmentInfoValue}>
                {formatAppointmentDate(item.appointmentData.appointmentDate)}
              </Text>
            </View>
            <View style={styles.appointmentInfoRow}>
              <Text style={styles.appointmentInfoLabel}>Giờ</Text>
              <Text style={styles.appointmentInfoValue}>
                {formatAppointmentTimeRange(item.appointmentData.timeSlot)}
              </Text>
            </View>
            {item.appointmentData.hospitalName ? (
              <View style={styles.appointmentInfoRow}>
                <Text style={styles.appointmentInfoLabel}>Cơ sở</Text>
                <Text style={styles.appointmentInfoValue} numberOfLines={1}>
                  {formatHospitalDisplayName(item.appointmentData.hospitalName)}
                </Text>
              </View>
            ) : null}
            <Text
              style={[
                styles.messageTime,
                styles.appointmentTimestamp,
                isMine && styles.myMessageTime,
              ]}
            >
              {formatTime(item.timestamp || (item as any).createdAt)}
            </Text>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <View
        style={[
          styles.messageContainer,
          isMine ? styles.myMessageContainer : styles.otherMessageContainer,
        ]}
      >
        {!isMine && (
          <View style={styles.avatarContainer}>
            {(typeof item.senderId === 'object' && item.senderId?.avatarUrl) || otherParticipant?.avatarUrl ? (
              <Image
                source={{ uri: (typeof item.senderId === 'object' && item.senderId?.avatarUrl) || otherParticipant?.avatarUrl || '' }}
                style={styles.messageAvatar}
                onError={() => {
                  // Avatar failed to load
                }}
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
                  onError={() => {
                    // If image fails to load, it will fallback to placeholder
                  }}
                />
              ) : (
                <View style={styles.headerAvatarPlaceholder}>
                  <Text style={styles.headerAvatarText}>
                    {otherParticipant?.fullName?.charAt(0)?.toUpperCase() || 'U'}
                  </Text>
                </View>
              )}
              {/* Online/Offline indicator */}
              {otherParticipant?._id ? (
                (() => {
                  const isOnline = isUserOnline(otherParticipant._id);
                  return (
                    <View style={[
                      styles.onlineIndicator,
                      isOnline && styles.onlineIndicatorActive
                    ]} />
                  );
                })()
              ) : null}
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
                {otherParticipant?._id ? (
                  (() => {
                    const isOnline = isUserOnline(otherParticipant._id);
                    return (
                      <Text style={[
                        styles.statusText,
                        isOnline && styles.statusTextOnline
                      ]}>
                        {isOnline ? '• Đang hoạt động' : '• Offline'}
                      </Text>
                    );
                  })()
                ) : (
                  <Text style={styles.statusText}>• Offline</Text>
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
    fontWeight: '400',
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
    color: '#333',
  },
  appointmentCardWrapper: {
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#dbeafe',
    padding: 14,
    maxWidth: '80%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },
  appointmentCardWrapperMine: {
    backgroundColor: '#f8fafc',
    borderColor: '#bfdbfe',
  },
  appointmentCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  appointmentCardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  appointmentCardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#2563eb',
  },
  appointmentStatusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
  },
  appointmentStatusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  appointmentInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
    gap: 12,
  },
  appointmentInfoLabel: {
    fontSize: 13,
    color: '#6b7280',
    fontWeight: '500',
  },
  appointmentInfoValue: {
    flex: 1,
    textAlign: 'right',
    fontSize: 14,
    color: '#111827',
    fontWeight: '600',
  },
  appointmentCardFooter: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  appointmentCardFooterText: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '500',
  },
  appointmentTimestamp: {
    marginTop: 8,
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
  systemMessageContainer: {
    alignItems: 'center',
    marginVertical: 4,
    marginBottom: 8,
  },
  systemMessageBubble: {
    backgroundColor: '#e5e7eb',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
    maxWidth: '55%',
    alignItems: 'center',
  },
  systemMessageText: {
    fontSize: 13,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 18,
  },
  systemMessageTime: {
    fontSize: 10,
    color: '#9ca3af',
    marginTop: 4,
  },
});

