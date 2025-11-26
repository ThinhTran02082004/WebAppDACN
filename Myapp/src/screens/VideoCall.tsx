import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import Ionicons from '@react-native-vector-icons/ionicons';
import { RTCView } from '@livekit/react-native-webrtc';
import {
  Participant,
  RemoteParticipant,
  Room,
  RoomEvent,
  TrackPublication
} from 'livekit-client';
import {
  Permission,
  PERMISSIONS,
  RESULTS,
  openSettings,
  requestMultiple
} from 'react-native-permissions';
import { RootStackParamList } from '../navigation/AppNavigator';
import { apiService } from '../services/api';

type VideoTile = {
  id: string;
  streamUrl: string;
  participantName: string;
  participantSid: string;
  isLocal: boolean;
  isMuted: boolean;
};

type ConnectionState = 'connecting' | 'connected' | 'reconnecting' | 'disconnected';

const cameraPermission = (Platform.select({
  ios: PERMISSIONS.IOS.CAMERA,
  android: PERMISSIONS.ANDROID.CAMERA
}) ?? PERMISSIONS.ANDROID.CAMERA) as Permission;

const microphonePermission = (Platform.select({
  ios: PERMISSIONS.IOS.MICROPHONE,
  android: PERMISSIONS.ANDROID.RECORD_AUDIO
}) ?? PERMISSIONS.ANDROID.RECORD_AUDIO) as Permission;

const VideoCallScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { roomId, roomName, token, wsUrl, role, appointmentInfo } =
    (route.params as RootStackParamList['VideoCall']) || {};

  const roomRef = useRef<Room | null>(null);
  const listenersRef = useRef<Array<{ event: RoomEvent; handler: (...args: any[]) => void }>>([]);
  const leavingRef = useRef(false);

  const [connectionState, setConnectionState] = useState<ConnectionState>('connecting');
  const [videoTiles, setVideoTiles] = useState<VideoTile[]>([]);
  const [micEnabled, setMicEnabled] = useState(true);
  const [cameraEnabled, setCameraEnabled] = useState(true);
  const [activeSpeakerSid, setActiveSpeakerSid] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [permissionError, setPermissionError] = useState<string | null>(null);

  const mainVideo = useMemo(() => {
    if (!videoTiles.length) return null;
    const remoteTrack = videoTiles.find(tile => !tile.isLocal);
    return remoteTrack ?? videoTiles[0];
  }, [videoTiles]);

  const thumbnails = useMemo(() => {
    if (!mainVideo) return [];
    return videoTiles.filter(tile => tile.id !== mainVideo.id);
  }, [videoTiles, mainVideo]);

  const removeRoomListeners = useCallback(() => {
    const room = roomRef.current;
    if (!room || !listenersRef.current.length) return;

    listenersRef.current.forEach(({ event, handler }) => {
      // @ts-ignore - livekit types expect specific handler signatures
      room.off(event, handler);
    });
    listenersRef.current = [];
  }, []);

  const updateVideoTiles = useCallback(() => {
    const room = roomRef.current;
    if (!room) return;

    const tiles: VideoTile[] = [];

    const pushPublication = (
      publication: TrackPublication,
      participant: Participant,
      isLocal: boolean
    ) => {
      const track = publication.videoTrack;
      if (!track || publication.isMuted) return;

      const stream = track.mediaStream as MediaStream | undefined;
      const streamUrl =
        typeof (stream as any)?.toURL === 'function'
          ? (stream as any).toURL()
          : undefined;
      if (!streamUrl) return;

      tiles.push({
        id: publication.trackSid ?? `${participant.sid}-${publication.trackName}`,
        streamUrl,
        participantName:
          participant.name ||
          (participant as RemoteParticipant).metadata ||
          participant.identity ||
          (isLocal ? 'Bạn' : 'Thành viên'),
        participantSid: participant.sid,
        isLocal,
        isMuted: publication.isMuted
      });
    };

    room.localParticipant.getTrackPublications().forEach(publication => {
      if (publication.kind !== 'video') return;
      pushPublication(publication, room.localParticipant, true);
    });

    room.remoteParticipants.forEach((participant: RemoteParticipant) => {
      participant.getTrackPublications().forEach((publication: TrackPublication) => {
        if (publication.kind !== 'video') return;
        pushPublication(publication, participant, false);
      });
    });

    setVideoTiles(tiles);
  }, []);

  const requestMediaPermissions = useCallback(async (): Promise<boolean> => {
    try {
      const statuses = await requestMultiple([cameraPermission, microphonePermission]);
      const cameraStatus = statuses[cameraPermission];
      const micStatus = statuses[microphonePermission];

      const cameraGranted = cameraStatus === RESULTS.GRANTED || cameraStatus === RESULTS.LIMITED;
      const micGranted = micStatus === RESULTS.GRANTED || micStatus === RESULTS.LIMITED;

      if (cameraGranted && micGranted) {
        setPermissionError(null);
        return true;
      }

      setPermissionError('Ứng dụng cần quyền truy cập camera và micro để tham gia cuộc gọi.');

      if (cameraStatus === RESULTS.BLOCKED || micStatus === RESULTS.BLOCKED) {
        Alert.alert(
          'Yêu cầu quyền',
          'Vui lòng cấp quyền camera và micro trong phần Cài đặt để tiếp tục cuộc gọi.',
          [
            { text: 'Hủy', style: 'cancel' },
            { text: 'Mở cài đặt', onPress: () => openSettings() }
          ]
        );
      }

      return false;
    } catch (err) {
      console.warn('[VideoCall] Failed to request permissions', err);
      setPermissionError('Không thể kiểm tra quyền truy cập camera/micro.');
      return false;
    }
  }, []);

  const attachRoomListeners = useCallback((room: Room) => {
    removeRoomListeners();

    const listeners: Array<{ event: RoomEvent; handler: (...args: any[]) => void }> = [
      {
        event: RoomEvent.TrackSubscribed,
        handler: () => updateVideoTiles()
      },
      {
        event: RoomEvent.TrackUnsubscribed,
        handler: () => updateVideoTiles()
      },
      {
        event: RoomEvent.TrackPublished,
        handler: () => updateVideoTiles()
      },
      {
        event: RoomEvent.TrackUnpublished,
        handler: () => updateVideoTiles()
      },
      {
        event: RoomEvent.TrackMuted,
        handler: () => updateVideoTiles()
      },
      {
        event: RoomEvent.TrackUnmuted,
        handler: () => updateVideoTiles()
      },
      {
        event: RoomEvent.ParticipantConnected,
        handler: () => updateVideoTiles()
      },
      {
        event: RoomEvent.ParticipantDisconnected,
        handler: () => updateVideoTiles()
      },
      {
        event: RoomEvent.ActiveSpeakersChanged,
        handler: speakers => {
          if (Array.isArray(speakers) && speakers.length > 0) {
            setActiveSpeakerSid(speakers[0]?.sid ?? null);
          } else {
            setActiveSpeakerSid(null);
          }
        }
      },
      {
        event: RoomEvent.Reconnecting,
        handler: () => setConnectionState('reconnecting')
      },
      {
        event: RoomEvent.Reconnected,
        handler: () => setConnectionState('connected')
      },
      {
        event: RoomEvent.Disconnected,
        handler: () => {
          setConnectionState('disconnected');
          if (!leavingRef.current) {
            leavingRef.current = true;
            apiService.leaveVideoRoom(roomId).finally(() => {
              navigation.goBack();
            });
          }
        }
      }
    ];

    listeners.forEach(({ event, handler }) => {
      // @ts-ignore
      room.on(event, handler);
    });

    listenersRef.current = listeners;
  }, [navigation, removeRoomListeners, roomId, updateVideoTiles]);

  const disconnectRoom = useCallback(async () => {
    removeRoomListeners();
    const room = roomRef.current;
    if (!room) return;
    try {
      await room.disconnect();
    } catch (err) {
      console.warn('[VideoCall] Error disconnecting room', err);
    } finally {
      roomRef.current = null;
    }
  }, [removeRoomListeners]);

  const convertToWebSocketUrl = useCallback((url: string): string => {
    if (!url) return url;
    
    let webSocketUrl = url.trim();
    
    // Convert HTTP to WebSocket
    if (webSocketUrl.startsWith('https://')) {
      webSocketUrl = webSocketUrl.replace('https://', 'wss://');
    } else if (webSocketUrl.startsWith('http://')) {
      webSocketUrl = webSocketUrl.replace('http://', 'ws://');
    } else if (!webSocketUrl.includes('://')) {
      // If no protocol, assume ws:// for localhost or wss:// for others
      if (webSocketUrl.includes('localhost') || webSocketUrl.includes('127.0.0.1') || webSocketUrl.includes('10.0.2.2')) {
        webSocketUrl = `ws://${webSocketUrl}`;
      } else {
        webSocketUrl = `wss://${webSocketUrl}`;
      }
    }
    
    // Remove trailing slash
    webSocketUrl = webSocketUrl.replace(/\/+$/, '');
    
    // Extract base URL (protocol + host)
    const urlMatch = webSocketUrl.match(/^(wss?:\/\/[^\/]+)/);
    if (urlMatch) {
      const baseUrl = urlMatch[1];
      const remainingPath = webSocketUrl.substring(baseUrl.length);
      
      // Check if this is LiveKit Cloud (doesn't need /rtc path)
      const isLiveKitCloud = baseUrl.includes('.livekit.cloud');
      
      if (isLiveKitCloud) {
        // LiveKit Cloud handles WebSocket routing automatically, no /rtc needed
        // Just ensure no trailing slash
        webSocketUrl = baseUrl + (remainingPath || '');
      } else {
        // For self-hosted LiveKit servers, add /rtc path if not present
        if (!remainingPath || remainingPath === '/') {
          webSocketUrl = baseUrl + '/rtc';
        } else if (remainingPath !== '/rtc' && !remainingPath.startsWith('/rtc/')) {
          // If there's a different path, we still need /rtc for LiveKit
          webSocketUrl = baseUrl + '/rtc';
        }
      }
    }
    
    return webSocketUrl;
  }, []);

  const connectToRoom = useCallback(async () => {
    setError(null);
    setConnectionState('connecting');

    const hasPermission = await requestMediaPermissions();
    if (!hasPermission) {
      setConnectionState('disconnected');
      return;
    }

    const room = new Room({
      adaptiveStream: true,
      dynacast: true,
      audioCaptureDefaults: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
      }
    });

    roomRef.current = room;
    attachRoomListeners(room);

    try {
      // Convert HTTP URL to WebSocket URL if needed
      const webSocketUrl = convertToWebSocketUrl(wsUrl);
      console.log('[VideoCall] Original wsUrl:', wsUrl);
      console.log('[VideoCall] Converted WebSocket URL:', webSocketUrl);
      console.log('[VideoCall] Token present:', !!token);
      
      await room.connect(webSocketUrl, token, { autoSubscribe: true });
      await room.localParticipant.setMicrophoneEnabled(true);
      await room.localParticipant.setCameraEnabled(true);
      setMicEnabled(true);
      setCameraEnabled(true);
      setConnectionState('connected');
      updateVideoTiles();
      console.log('[VideoCall] Successfully connected to room');
    } catch (err: any) {
      console.error('[VideoCall] Failed to connect', err);
      console.error('[VideoCall] Error details:', {
        message: err?.message,
        code: err?.code,
        reason: err?.reason,
        wsUrl: wsUrl,
        convertedUrl: convertToWebSocketUrl(wsUrl)
      });
      setError(err?.message || 'Không thể kết nối tới phòng video. Vui lòng thử lại.');
      setConnectionState('disconnected');
    }
  }, [attachRoomListeners, convertToWebSocketUrl, requestMediaPermissions, token, updateVideoTiles, wsUrl]);

  useEffect(() => {
    connectToRoom();
    return () => {
      disconnectRoom();
    };
  }, [connectToRoom, disconnectRoom]);

  const handleToggleMicrophone = useCallback(async () => {
    const room = roomRef.current;
    if (!room) return;
    try {
      const nextState = !micEnabled;
      await room.localParticipant.setMicrophoneEnabled(nextState);
      setMicEnabled(nextState);
    } catch (err) {
      console.warn('[VideoCall] Failed to toggle microphone', err);
    }
  }, [micEnabled]);

  const handleToggleCamera = useCallback(async () => {
    const room = roomRef.current;
    if (!room) return;
    try {
      const nextState = !cameraEnabled;
      await room.localParticipant.setCameraEnabled(nextState);
      setCameraEnabled(nextState);
      updateVideoTiles();
    } catch (err) {
      console.warn('[VideoCall] Failed to toggle camera', err);
    }
  }, [cameraEnabled, updateVideoTiles]);

  const handleSwitchCamera = useCallback(async () => {
    const room = roomRef.current;
    if (!room) return;
    try {
      const switchFn = (room.localParticipant as any)?.switchCamera;
      if (typeof switchFn === 'function') {
        await switchFn.call(room.localParticipant);
      } else {
        throw new Error('Switch camera not supported');
      }
    } catch (err) {
      Alert.alert('Thông báo', 'Không thể chuyển camera. Vui lòng thử lại.');
    }
  }, []);

  const handleLeaveRoom = useCallback(
    async (endForAll = false) => {
      if (leavingRef.current) return;
      leavingRef.current = true;

      try {
        await disconnectRoom();
      } finally {
        if (endForAll && role === 'doctor') {
          await apiService.endVideoRoom(roomId).catch(err => {
            console.warn('[VideoCall] Failed to end room for all', err);
          });
        } else {
          await apiService.leaveVideoRoom(roomId).catch(err => {
            console.warn('[VideoCall] Failed to notify leave', err);
          });
        }
        navigation.goBack();
      }
    },
    [disconnectRoom, navigation, role, roomId]
  );

  const confirmLeave = useCallback(() => {
    if (role === 'doctor') {
      Alert.alert(
        'Kết thúc cuộc gọi',
        'Bạn muốn kết thúc cuộc gọi cho tất cả hay chỉ rời phòng?',
        [
          { text: 'Hủy', style: 'cancel', onPress: () => {} },
          {
            text: 'Chỉ rời phòng',
            onPress: () => handleLeaveRoom(false)
          },
          {
            text: 'Kết thúc cho tất cả',
            style: 'destructive',
            onPress: () => handleLeaveRoom(true)
          }
        ]
      );
      return;
    }
    Alert.alert('Rời cuộc gọi', 'Bạn có chắc muốn rời phòng video?', [
      { text: 'Hủy', style: 'cancel' },
      { text: 'Rời phòng', style: 'destructive', onPress: () => handleLeaveRoom(false) }
    ]);
  }, [handleLeaveRoom, role]);

  const renderConnectionStatus = () => {
    switch (connectionState) {
      case 'connecting':
        return 'Đang kết nối...';
      case 'reconnecting':
        return 'Đang cố gắng kết nối lại...';
      case 'connected':
        return 'Đang hoạt động';
      default:
        return 'Đã ngắt kết nối';
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      <View style={styles.header}>
        <View>
          <Text style={styles.roomName}>{roomName}</Text>
          <Text style={styles.statusText}>{renderConnectionStatus()}</Text>
        </View>
        <TouchableOpacity style={styles.leaveButton} onPress={confirmLeave}>
          <Ionicons name="call" size={20} color="#fff" style={styles.leaveIcon} />
          <Text style={styles.leaveText}>Kết thúc</Text>
        </TouchableOpacity>
      </View>

      {appointmentInfo && (
        <View style={styles.metaContainer}>
          {appointmentInfo.doctorName && (
            <Text style={styles.metaText}>Bác sĩ: {appointmentInfo.doctorName}</Text>
          )}
          {appointmentInfo.patientName && (
            <Text style={styles.metaText}>Bệnh nhân: {appointmentInfo.patientName}</Text>
          )}
          {appointmentInfo.date && <Text style={styles.metaText}>Thời gian: {appointmentInfo.date}</Text>}
        </View>
      )}

      <View style={styles.videoSection}>
        {mainVideo ? (
          <View style={styles.mainVideoWrapper}>
            <RTCView
              streamURL={mainVideo.streamUrl}
              style={styles.mainVideo}
              objectFit="cover"
              zOrder={0}
            />
            <View style={styles.participantLabel}>
              <Text style={styles.participantText}>
                {mainVideo.participantName}
                {activeSpeakerSid && mainVideo.participantSid === activeSpeakerSid ? ' • Đang nói' : ''}
              </Text>
            </View>
          </View>
        ) : (
          <View style={styles.placeholder}>
            <Ionicons name="videocam-off" size={48} color="#9ca3af" />
            <Text style={styles.placeholderText}>
              Đang chờ người tham gia khác bật camera
            </Text>
          </View>
        )}

        {!!thumbnails.length && (
          <View style={styles.thumbnailRow}>
            {thumbnails.map(tile => (
              <View key={tile.id} style={styles.thumbnail}>
                <RTCView streamURL={tile.streamUrl} style={styles.thumbnailVideo} objectFit="cover" zOrder={1} />
                <View style={styles.thumbnailLabel}>
                  <Text style={styles.thumbnailText}>{tile.participantName}</Text>
                </View>
              </View>
            ))}
          </View>
        )}
      </View>

      {!!permissionError && (
        <View style={styles.alertBox}>
          <Ionicons name="warning" size={20} color="#b45309" />
          <Text style={styles.alertText}>{permissionError}</Text>
        </View>
      )}

      {!!error && (
        <View style={styles.alertBox}>
          <Ionicons name="information-circle" size={20} color="#b91c1c" />
          <Text style={styles.alertText}>{error}</Text>
        </View>
      )}

      <View style={styles.controls}>
        <TouchableOpacity
          style={[styles.controlButton, !micEnabled && styles.controlButtonDisabled]}
          onPress={handleToggleMicrophone}
        >
          <Ionicons name={micEnabled ? 'mic' : 'mic-off'} size={24} color="#fff" />
          <Text style={styles.controlLabel}>{micEnabled ? 'Tắt mic' : 'Bật mic'}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.controlButton, !cameraEnabled && styles.controlButtonDisabled]}
          onPress={handleToggleCamera}
        >
          <Ionicons name={cameraEnabled ? 'videocam' : 'videocam-off'} size={24} color="#fff" />
          <Text style={styles.controlLabel}>{cameraEnabled ? 'Tắt video' : 'Bật video'}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.controlButton} onPress={handleSwitchCamera}>
          <Ionicons name="camera-reverse" size={24} color="#fff" />
          <Text style={styles.controlLabel}>Đổi cam</Text>
        </TouchableOpacity>

      </View>

      {(connectionState === 'connecting' || connectionState === 'reconnecting') && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#fef3c7" />
          <Text style={styles.loadingText}>
            {connectionState === 'connecting' ? 'Đang kết nối tới phòng...' : 'Đang cố gắng kết nối lại...'}
          </Text>
        </View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
    paddingHorizontal: 16,
    paddingTop: 12
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12
  },
  roomName: {
    fontSize: 20,
    color: '#f8fafc',
    fontWeight: '600'
  },
  statusText: {
    fontSize: 13,
    color: '#cbd5f5',
    marginTop: 4
  },
  leaveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#b91c1c',
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 8
  },
  leaveIcon: {
    transform: [{ rotate: '135deg' }],
    marginRight: 6
  },
  leaveText: {
    color: '#fff',
    fontWeight: '600'
  },
  metaContainer: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12
  },
  metaText: {
    color: '#e2e8f0',
    fontSize: 14
  },
  videoSection: {
    flex: 1,
    borderRadius: 16,
    overflow: 'hidden'
  },
  mainVideoWrapper: {
    flex: 1,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#111827'
  },
  mainVideo: {
    flex: 1,
    borderRadius: 16
  },
  participantLabel: {
    position: 'absolute',
    left: 12,
    bottom: 12,
    backgroundColor: 'rgba(15,23,42,0.6)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999
  },
  participantText: {
    color: '#f8fafc',
    fontSize: 13
  },
  placeholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#111827',
    borderRadius: 16
  },
  placeholderText: {
    color: '#94a3b8',
    marginTop: 12
  },
  thumbnailRow: {
    flexDirection: 'row',
    marginTop: 12,
    gap: 12
  },
  thumbnail: {
    flex: 1,
    height: 120,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#0f172a'
  },
  thumbnailVideo: {
    flex: 1
  },
  thumbnailLabel: {
    position: 'absolute',
    left: 8,
    bottom: 8,
    backgroundColor: 'rgba(15,23,42,0.75)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999
  },
  thumbnailText: {
    color: '#f8fafc',
    fontSize: 12
  },
  alertBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fef3c7',
    borderRadius: 12,
    padding: 12,
    marginTop: 12,
    gap: 8
  },
  alertText: {
    color: '#92400e',
    flex: 1,
    fontSize: 13
  },
  controls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16
  },
  controlButton: {
    flex: 1,
    backgroundColor: '#1d4ed8',
    borderRadius: 16,
    paddingVertical: 12,
    marginHorizontal: 4,
    alignItems: 'center',
    gap: 6
  },
  controlButtonDisabled: {
    backgroundColor: '#334155'
  },
  controlLabel: {
    color: '#f8fafc',
    fontSize: 12
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(15,23,42,0.65)',
    alignItems: 'center',
    justifyContent: 'center'
  },
  loadingText: {
    color: '#fef3c7',
    marginTop: 10
  }
});

export default VideoCallScreen;

