import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Alert,
  Platform
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Ionicons from '@react-native-vector-icons/ionicons';
import { useSocket } from '../contexts/SocketContext';
import { apiService } from '../services/api';

interface IncomingCall {
  roomId: string;
  roomName: string;
  roomCode?: string;
  callerName: string;
  callerRole: 'doctor' | 'patient';
  appointmentId: string;
  timestamp: number;
}

const VideoCallNotification = () => {
  const navigation = useNavigation();
  const { socket, isConnected, on, off } = useSocket();
  const [incomingCall, setIncomingCall] = useState<IncomingCall | null>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const autoRejectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Play ringtone (optional - can be implemented with react-native-sound or expo-av)
  const playRingtone = async () => {
    try {
      // TODO: Implement ringtone playback if needed
      // You can use react-native-sound or expo-av for this
      // For now, we'll just log - implement audio playback as needed
    } catch (error) {
      }
  };

  // Stop ringtone
  const stopRingtone = async () => {
    try {
      // TODO: Stop ringtone if implemented
      } catch (error) {
      }
  };

  // Animation
  useEffect(() => {
    if (incomingCall) {
      // Fade in
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true
      }).start();

      // Pulse animation
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.1,
            duration: 1000,
            useNativeDriver: true
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true
          })
        ])
      ).start();

      // Play ringtone
      playRingtone();

      // Auto-reject after 60 seconds
      autoRejectTimeoutRef.current = setTimeout(() => {
        handleReject();
      }, 60000);
    } else {
      // Fade out
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true
      }).start();

      // Stop ringtone
      stopRingtone();

      // Clear timeout
      if (autoRejectTimeoutRef.current) {
        clearTimeout(autoRejectTimeoutRef.current);
        autoRejectTimeoutRef.current = null;
      }
    }
  }, [incomingCall]);

  // Listen to socket events
  useEffect(() => {
    if (!socket || !isConnected) return;

    const handleIncomingCall = (data: IncomingCall) => {
      setIncomingCall({
        roomId: data.roomId,
        roomName: data.roomName,
        roomCode: data.roomCode,
        callerName: data.callerName,
        callerRole: data.callerRole,
        appointmentId: data.appointmentId,
        timestamp: Date.now()
      });
    };

    const handleCallCancelled = (data: { roomId: string }) => {
      if (incomingCall && incomingCall.roomId === data.roomId) {
        setIncomingCall(null);
        Alert.alert('Thông báo', 'Cuộc gọi đã bị hủy');
      }
    };

    on('incoming_video_call', handleIncomingCall);
    on('video_call_cancelled', handleCallCancelled);

    return () => {
      off('incoming_video_call', handleIncomingCall);
      off('video_call_cancelled', handleCallCancelled);
    };
  }, [socket, isConnected, incomingCall, on, off]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopRingtone();
      if (autoRejectTimeoutRef.current) {
        clearTimeout(autoRejectTimeoutRef.current);
      }
    };
  }, []);

  const handleAccept = async () => {
    if (!incomingCall) return;

    try {
      // Stop ringtone
      await stopRingtone();

      // Clear auto-reject timeout
      if (autoRejectTimeoutRef.current) {
        clearTimeout(autoRejectTimeoutRef.current);
        autoRejectTimeoutRef.current = null;
      }

      // Join the video room
      const response = await apiService.joinVideoRoom(incomingCall.roomId);

      if (!response?.success || !response.data) {
        Alert.alert('Lỗi', response?.message || 'Không thể tham gia phòng video. Vui lòng thử lại.');
        setIncomingCall(null);
        return;
      }

      const { token, wsUrl, roomName, role, appointmentInfo } = response.data;

      if (!token || !wsUrl) {
        Alert.alert('Lỗi', 'Thiếu thông tin kết nối phòng video.');
        setIncomingCall(null);
        return;
      }

      // Notify caller that call was accepted
      if (socket && isConnected) {
        socket.emit('video_call_accepted', {
          roomId: incomingCall.roomId,
          roomName: incomingCall.roomName
        });
      }

      // Navigate to VideoCall screen
      setIncomingCall(null);
      (navigation as any).navigate('VideoCall', {
        roomId: incomingCall.roomId,
        roomName: roomName || incomingCall.roomName,
        token,
        wsUrl,
        role,
        appointmentInfo
      });
    } catch (error: any) {
      const message = error?.response?.data?.message || error?.message || 'Không thể tham gia cuộc gọi';
      Alert.alert('Lỗi', message);
      setIncomingCall(null);
    }
  };

  const handleReject = () => {
    if (!incomingCall) return;

    // Stop ringtone
    stopRingtone();

    // Clear timeout
    if (autoRejectTimeoutRef.current) {
      clearTimeout(autoRejectTimeoutRef.current);
      autoRejectTimeoutRef.current = null;
    }

    // Notify caller that call was rejected
    if (socket && isConnected) {
      socket.emit('video_call_rejected', {
        roomId: incomingCall.roomId,
        roomName: incomingCall.roomName
      });
    }

    setIncomingCall(null);
    Alert.alert('Thông báo', 'Đã từ chối cuộc gọi');
  };

  if (!incomingCall) return null;

  return (
    <Modal
      visible={!!incomingCall}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={handleReject}
    >
      <Animated.View
        style={[
          styles.overlay,
          {
            opacity: fadeAnim
          }
        ]}
      >
        <View style={styles.container}>
          {/* Caller Avatar */}
          <View style={styles.avatarContainer}>
            <Animated.View
              style={[
                styles.avatar,
                {
                  transform: [{ scale: pulseAnim }]
                }
              ]}
            >
              <Ionicons name="videocam" size={48} color="#fff" />
            </Animated.View>
            <View style={styles.avatarRing} />
          </View>

          {/* Caller Info */}
          <View style={styles.infoContainer}>
            <Text style={styles.title}>Cuộc gọi video đến</Text>
            <Text style={styles.callerName}>{incomingCall.callerName}</Text>
            <Text style={styles.callerRole}>
              {incomingCall.callerRole === 'doctor' ? '👨‍⚕️ Bác sĩ' : '👤 Bệnh nhân'}
            </Text>
            {incomingCall.roomCode && (
              <View style={styles.roomCodeContainer}>
                <Text style={styles.roomCodeLabel}>Mã phòng:</Text>
                <Text style={styles.roomCode}>{incomingCall.roomCode}</Text>
              </View>
            )}
          </View>

          {/* Action Buttons */}
          <View style={styles.actionsContainer}>
            {/* Reject Button */}
            <TouchableOpacity
              style={[styles.button, styles.rejectButton]}
              onPress={handleReject}
            >
              <Ionicons name="call" size={24} color="#fff" style={{ transform: [{ rotate: '135deg' }] }} />
              <Text style={styles.buttonText}>Từ chối</Text>
            </TouchableOpacity>

            {/* Accept Button */}
            <TouchableOpacity
              style={[styles.button, styles.acceptButton]}
              onPress={handleAccept}
            >
              <Ionicons name="call" size={24} color="#fff" />
              <Text style={styles.buttonText}>Trả lời</Text>
            </TouchableOpacity>
          </View>

          {/* Timer */}
          <Text style={styles.timerText}>
            Cuộc gọi sẽ tự động kết thúc sau 60 giây
          </Text>
        </View>
      </Animated.View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'center',
    alignItems: 'center'
  },
  container: {
    width: '85%',
    maxWidth: 400,
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 32,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10
  },
  avatarContainer: {
    marginBottom: 24,
    alignItems: 'center',
    justifyContent: 'center'
  },
  avatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#3b82f6',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2
  },
  avatarRing: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 3,
    borderColor: '#3b82f6',
    opacity: 0.5
  },
  infoContainer: {
    alignItems: 'center',
    marginBottom: 32
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 8
  },
  callerName: {
    fontSize: 24,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4
  },
  callerRole: {
    fontSize: 16,
    color: '#6b7280',
    marginBottom: 12
  },
  roomCodeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#eff6ff',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginTop: 8
  },
  roomCodeLabel: {
    fontSize: 12,
    color: '#1e40af',
    marginRight: 4
  },
  roomCode: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1e40af',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace'
  },
  actionsContainer: {
    flexDirection: 'row',
    gap: 16,
    width: '100%',
    marginBottom: 16
  },
  button: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8
  },
  rejectButton: {
    backgroundColor: '#ef4444'
  },
  acceptButton: {
    backgroundColor: '#10b981'
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600'
  },
  timerText: {
    fontSize: 12,
    color: '#9ca3af',
    textAlign: 'center'
  }
});

export default VideoCallNotification;

