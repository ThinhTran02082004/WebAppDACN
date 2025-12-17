import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import Ionicons from '@react-native-vector-icons/ionicons';
// VideoView is deprecated but still functional
// eslint-disable-next-line deprecation/deprecation
import { VideoView } from '@livekit/react-native';
import {
  Permission,
  PERMISSIONS,
  RESULTS,
  openSettings,
  requestMultiple
} from 'react-native-permissions';
import { RootStackParamList } from '../navigation/AppNavigator';
import { apiService } from '../services/api';
import { ensureLivekitGlobals } from '../utils/livekit';

// Import Room and VideoTrack from livekit-client
import { Room, VideoTrack } from 'livekit-client';

type VideoTile = {
  id: string;
  videoTrack: VideoTrack | null;
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

// Hardcoded LiveKit signaling URL (override when backend returns wrong URL)
const HARDCODED_LIVEKIT_URL = 'wss://hospitals-reoykrz5.livekit.cloud';

const VideoCallScreen = () => {
  // Ensure globals are registered when component mounts
  useEffect(() => {
    try {
      ensureLivekitGlobals();
      // Verify WebSocket is available
      const globalObj = globalThis as any;
      if (typeof globalObj.WebSocket === 'undefined') {
        // WebSocket is not available
      }
    } catch (error) {
      // Failed to initialize LiveKit globals
    }
  }, []);

  const navigation = useNavigation();
  const route = useRoute();
  const { roomId, roomName, token, wsUrl, role, appointmentInfo } =
    (route.params as RootStackParamList['VideoCall']) || {};

  const roomRef = useRef<any | null>(null);
  const listenersRef = useRef<Array<{ event: string; handler: (...args: any[]) => void }>>([]);
  const leavingRef = useRef(false);

  const [connectionState, setConnectionState] = useState<ConnectionState>('connecting');
  const [videoTiles, setVideoTiles] = useState<VideoTile[]>([]);
  const [micEnabled, setMicEnabled] = useState(true);
  const [cameraEnabled, setCameraEnabled] = useState(true);
  const [activeSpeakerSid, setActiveSpeakerSid] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [permissionError, setPermissionError] = useState<string | null>(null);
  const [isLeaving, setIsLeaving] = useState(false);

  // Main video: ưu tiên bác sĩ (remote participant), nếu chưa có thì hiển thị bản thân
  const mainVideo = useMemo(() => {
    if (!videoTiles.length) return null;
    // Tìm remote participant (bác sĩ) trước
    const remoteTrack = videoTiles.find(tile => !tile.isLocal);
    // Nếu có bác sĩ thì hiển thị bác sĩ, nếu không thì hiển thị bản thân
    return remoteTrack ?? videoTiles.find(tile => tile.isLocal) ?? videoTiles[0];
  }, [videoTiles]);

  // Thumbnail: chỉ hiển thị bản thân (local participant) ở góc phải trên
  const localVideoThumbnail = useMemo(() => {
    if (!mainVideo) return null;
    // Chỉ hiển thị thumbnail nếu main video là remote (bác sĩ)
    if (mainVideo.isLocal) return null;
    // Tìm local participant (bản thân)
    return videoTiles.find(tile => tile.isLocal);
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
    if (!room) {
      return;
    }

    const tiles: VideoTile[] = [];
    const addedTrackIds = new Set<string>(); // Track IDs to prevent duplicates

    const pushTrack = (track: VideoTrack | null, participant: any, publication: any, trackSid?: string) => {
      if (!track) {
        return;
      }

      // Generate unique ID for this track
      const tileId = trackSid ?? `${participant.sid}-${track.sid ?? 'video'}`;
      
      // Check if this track has already been added by tileId
      if (addedTrackIds.has(tileId)) {
        return;
      }
      
      // Also check by track.sid and participant.sid to avoid duplicates with different IDs
      const trackSidKey = track.sid || '';
      const participantSidKey = participant.sid || '';
      if (trackSidKey && participantSidKey) {
        const existingTrack = tiles.find(t => 
          t.videoTrack?.sid === trackSidKey && t.participantSid === participantSidKey
        );
        if (existingTrack) {
          return;
        }
      }

      addedTrackIds.add(tileId);
      tiles.push({
        id: tileId,
        videoTrack: track,
        participantName:
          participant.name ||
          participant.metadata ||
          participant.identity ||
          (participant.isLocal ? 'Bạn' : 'Thành viên'),
        participantSid: participant.sid,
        isLocal: participant.isLocal,
        isMuted: track.isMuted
      });
    };

    // Local participant video tracks
    // Try multiple ways to get local video tracks
    let localVideoTracks: any = room.localParticipant.videoTracks;
    if (!localVideoTracks) {
      const trackPublications = (room.localParticipant as any).trackPublications;
      if (Array.isArray(trackPublications)) {
        localVideoTracks = trackPublications.filter((p: any) => p.kind === 'video');
      } else if (trackPublications && typeof trackPublications.forEach === 'function') {
        // If it's a Map or similar iterable
        localVideoTracks = trackPublications;
      } else {
        localVideoTracks = [];
      }
    }
    
    if (localVideoTracks && localVideoTracks.size !== undefined) {
      // If it's a Map
      localVideoTracks.forEach((publication: any, trackSid: string) => {
        // For local participant, track should be available directly
        // Try both track and videoTrack properties
        let track = (publication.track || publication.videoTrack) as VideoTrack | null;
        if (track && track.kind === 'video') {
          pushTrack(track, room.localParticipant, publication, trackSid);
        } else if (publication.track && typeof publication.track.kind === 'undefined') {
          // Sometimes track might not have kind property set, but it's still a video track
          track = publication.track as VideoTrack;
          pushTrack(track, room.localParticipant, publication, trackSid);
        }
      });
    } else if (Array.isArray(localVideoTracks)) {
      // If it's an array
      localVideoTracks.forEach((publication: any) => {
        const trackSid = publication.trackSid || publication.sid;
        let track = (publication.track || publication.videoTrack) as VideoTrack | null;
        if (track && track.kind === 'video') {
          pushTrack(track, room.localParticipant, publication, trackSid);
        } else if (publication.track && typeof publication.track.kind === 'undefined') {
          track = publication.track as VideoTrack;
          pushTrack(track, room.localParticipant, publication, trackSid);
        }
      });
    }
    
    // Note: Removed duplicate trackPublications check to avoid adding same tracks twice
    // The tracks should already be handled by videoTracks above

    // Remote participants video tracks
    room.remoteParticipants.forEach((participant: any) => {
      // Try to subscribe to video tracks if not already subscribed
      if (participant.videoTracks) {
        participant.videoTracks.forEach((publication: any, trackSid: string) => {
          // Try to subscribe if not already subscribed
          if (!publication.isSubscribed) {
            try {
              // Try different methods to subscribe
              if (typeof publication.setSubscribed === 'function') {
                publication.setSubscribed(true);
              } else if (typeof publication.subscribe === 'function') {
                publication.subscribe();
              } else if (typeof participant.setTrackSubscribed === 'function') {
                participant.setTrackSubscribed(trackSid, true);
              }
            } catch (err) {
              // Failed to subscribe to track
            }
          }
          
          // For remote participants, try to get track
          // Track should be available if subscribed, but sometimes it's available before subscription completes
          let track = (publication.track || publication.videoTrack) as VideoTrack | null;
          
          if (track && track.kind === 'video') {
            pushTrack(track, participant, publication, trackSid);
          } else if (publication.track && typeof publication.track.kind === 'undefined') {
            // Sometimes track might not have kind property set, but it's still a video track
            track = publication.track as VideoTrack;
            pushTrack(track, participant, publication, trackSid);
          }
        });
      }
      
      // Also try getting tracks from trackPublications
      try {
        const trackPublications = (participant as any).trackPublications;
        if (trackPublications && typeof trackPublications.forEach === 'function') {
          trackPublications.forEach((publication: any) => {
            if (publication.kind === 'video') {
              // Try to subscribe if not already subscribed
              if (!publication.isSubscribed) {
                try {
                  // Try different methods to subscribe
                  if (typeof publication.setSubscribed === 'function') {
                    publication.setSubscribed(true);
                  } else if (typeof publication.subscribe === 'function') {
                    publication.subscribe();
                  } else if (typeof participant.setTrackSubscribed === 'function') {
                    const trackSid = publication.trackSid || publication.sid;
                    participant.setTrackSubscribed(trackSid, true);
                  }
                } catch (err) {
                  // Failed to subscribe to track from trackPublications
                }
              }
              
              const track = publication.track || publication.videoTrack;
              if (track) {
                const trackSid = publication.trackSid || publication.sid || track.sid;
                pushTrack(track, participant, publication, trackSid);
              }
            }
          });
        }
      } catch (err) {
        // Could not get trackPublications from remote participant
      }
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
      setPermissionError('Không thể kiểm tra quyền truy cập camera/micro.');
      return false;
    }
  }, []);

  const attachRoomListeners = useCallback((room: any) => {
    removeRoomListeners();

    const listeners: Array<{ event: string; handler: (...args: any[]) => void }> = [
      {
        event: 'trackSubscribed',
        handler: () => updateVideoTiles()
      },
      {
        event: 'trackUnsubscribed',
        handler: () => updateVideoTiles()
      },
      {
        event: 'trackPublished',
        handler: () => {
          setTimeout(() => updateVideoTiles(), 100);
        }
      },
      {
        event: 'localTrackPublished',
        handler: () => {
          setTimeout(() => updateVideoTiles(), 100);
        }
      },
      {
        event: 'trackUnpublished',
        handler: () => updateVideoTiles()
      },
      {
        event: 'trackMuted',
        handler: () => updateVideoTiles()
      },
      {
        event: 'trackUnmuted',
        handler: () => updateVideoTiles()
      },
      {
        event: 'participantConnected',
        handler: (participant: any) => {
          // Subscribe to all video tracks from the new participant
          if (participant && participant.videoTracks) {
            participant.videoTracks.forEach((publication: any, trackSid: string) => {
              if (!publication.isSubscribed) {
                try {
                  // Try different methods to subscribe
                  if (typeof publication.setSubscribed === 'function') {
                    publication.setSubscribed(true);
                  } else if (typeof publication.subscribe === 'function') {
                    publication.subscribe();
                  } else if (typeof participant.setTrackSubscribed === 'function') {
                    participant.setTrackSubscribed(trackSid, true);
                  }
                } catch (err) {
                  // Failed to subscribe to track
                }
              }
            });
          }
          // Update tiles after a short delay to allow subscription to complete
          setTimeout(() => updateVideoTiles(), 300);
        }
      },
      {
        event: 'participantDisconnected',
        handler: () => updateVideoTiles()
      },
      {
        event: 'activeSpeakersChanged',
        handler: (speakers: any[]) => {
          if (Array.isArray(speakers) && speakers.length > 0) {
            setActiveSpeakerSid(speakers[0]?.sid ?? null);
          } else {
            setActiveSpeakerSid(null);
          }
        }
      },
      {
        event: 'reconnecting',
        handler: () => setConnectionState('reconnecting')
      },
      {
        event: 'reconnected',
        handler: () => setConnectionState('connected')
      },
      {
        event: 'disconnected',
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
      room.on(event as any, handler);
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
      // Error disconnecting room
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

    if (!token) {
      setError('Token không hợp lệ. Vui lòng thử lại.');
      setConnectionState('disconnected');
      return;
    }

    // Check if Room is available - but DON'T check typeof Room !== 'function'
    // Room might be an object with a constructor, not a direct function
    if (!Room) {
      setError('Không thể khởi tạo LiveKit. Vui lòng khởi động lại ứng dụng.');
      setConnectionState('disconnected');
      return;
    }

    let room;
    try {
      // Create Room instance
      room = new Room({
        adaptiveStream: true,
        dynacast: true,
        audioCaptureDefaults: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });

      if (!room) {
        throw new Error('Failed to instantiate Room');
      }

      roomRef.current = room;
      attachRoomListeners(room);
    } catch (err: any) {
      setError('Không thể khởi tạo phòng video. Vui lòng thử lại.');
      setConnectionState('disconnected');
      return;
    }

    // Convert HTTP URL to WebSocket URL if needed
    let effectiveWebSocketUrl = convertToWebSocketUrl(wsUrl || '');
    
    // Validate URL format
    if (!effectiveWebSocketUrl || (!effectiveWebSocketUrl.startsWith('ws://') && !effectiveWebSocketUrl.startsWith('wss://'))) {
      effectiveWebSocketUrl = HARDCODED_LIVEKIT_URL;
    }

    if (effectiveWebSocketUrl.includes('.livekit.cloud')) {
      // Clean up query/fragment first
      effectiveWebSocketUrl = effectiveWebSocketUrl.split('?')[0].split('#')[0];
      
      // Remove any existing paths like /rtc, /ws, etc. and trailing slashes
      // LiveKit SDK will automatically add /rtc path
      const urlMatch = effectiveWebSocketUrl.match(/^(wss?:\/\/[^\/]+)/);
      if (urlMatch) {
        effectiveWebSocketUrl = urlMatch[1];
      }
      
      // Remove trailing slash - LiveKit SDK will add /rtc automatically
      effectiveWebSocketUrl = effectiveWebSocketUrl.replace(/\/+$/, '');
    }

    try {
      // For LiveKit, use the base URL - SDK will handle path
      // Ensure URL is clean base URL (protocol + host, no path)
      let connectUrl = effectiveWebSocketUrl;
      
      // Extract just the base URL (protocol + host)
      const baseUrlMatch = connectUrl.match(/^(wss?:\/\/[^\/]+)/);
      if (baseUrlMatch) {
        connectUrl = baseUrlMatch[1];
      }
      
      // Remove trailing slash
      connectUrl = connectUrl.replace(/\/+$/, '');
      
      // Connect using base URL - LiveKit SDK will automatically add /rtc path
      await room.connect(connectUrl, token, { 
        autoSubscribe: true
      });
      
      // Enable microphone first
      await room.localParticipant.setMicrophoneEnabled(true);
      setMicEnabled(true);
      
      // Enable camera and wait for track to be ready
      await room.localParticipant.setCameraEnabled(true);
      setCameraEnabled(true);
      
      // Wait a bit for tracks to be published
      await new Promise<void>(resolve => setTimeout(() => resolve(), 500));
      
      setConnectionState('connected');
      
      // Update video tiles immediately and then again after a delay
      updateVideoTiles();
      setTimeout(() => {
        updateVideoTiles();
      }, 1000);
      setTimeout(() => {
        updateVideoTiles();
      }, 2000);
    } catch (err: any) {
      // Provide more specific error messages
      let errorMessage = 'Không thể kết nối tới phòng video.';
      if (err?.message?.includes('101')) {
        errorMessage = 'Lỗi kết nối WebSocket. Vui lòng kiểm tra kết nối mạng và thử lại.';
      } else if (err?.message?.includes('token') || err?.message?.includes('unauthorized')) {
        errorMessage = 'Token không hợp lệ. Vui lòng thử lại.';
      } else if (err?.message?.includes('network') || err?.code === 'ENOTFOUND') {
        errorMessage = 'Không thể kết nối tới server. Vui lòng kiểm tra kết nối mạng.';
      }
      
      setError(errorMessage);
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
      // Failed to toggle microphone
    }
  }, [micEnabled]);

  const handleToggleCamera = useCallback(async () => {
    const room = roomRef.current;
    if (!room) return;
    try {
      const nextState = !cameraEnabled;
      await room.localParticipant.setCameraEnabled(nextState);
      setCameraEnabled(nextState);
      // Update tiles immediately and after a delay to ensure track is ready
      updateVideoTiles();
      setTimeout(() => {
        updateVideoTiles();
      }, 300);
    } catch (err) {
      // Failed to toggle camera
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
      if (leavingRef.current || isLeaving) return;
      leavingRef.current = true;
      setIsLeaving(true);

      try {
        await disconnectRoom();
      } finally {
        if (endForAll && role === 'doctor') {
          await apiService.endVideoRoom(roomId).catch(() => {
            // Failed to end room for all
          });
        } else {
          await apiService.leaveVideoRoom(roomId).catch(() => {
            // Failed to notify leave
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
      
      <View style={styles.videoSection}>
        {/* Header overlay trên video */}
        <View style={styles.headerOverlay}>
          <View>
            {appointmentInfo?.doctorName && (
              <Text style={styles.roomName}>{appointmentInfo.doctorName}</Text>
            )}
            <Text style={styles.statusText}>{renderConnectionStatus()}</Text>
          </View>
        </View>
        
        {mainVideo && mainVideo.videoTrack ? (
          <View style={styles.mainVideoWrapper}>
            {/* Kiểm tra nếu camera bị tắt (local) hoặc track bị muted (remote) */}
            {(mainVideo.isLocal && !cameraEnabled) || (!mainVideo.isLocal && mainVideo.isMuted) ? (
              <View style={styles.blackScreen} />
            ) : (
              <>
                {/* eslint-disable-next-line deprecation/deprecation */}
                <VideoView
                  videoTrack={mainVideo.videoTrack}
                  style={styles.mainVideo}
                  objectFit="cover"
                  zOrder={0}
                  mirror={mainVideo.isLocal}
                />
              </>
            )}
          </View>
        ) : (
          <View style={styles.placeholder}>
            <Ionicons name="videocam-off" size={48} color="#9ca3af" />
            <Text style={styles.placeholderText}>
              Đang chờ người tham gia khác bật camera
            </Text>
          </View>
        )}

        {/* Local video thumbnail ở góc phải trên */}
        {localVideoThumbnail && localVideoThumbnail.videoTrack && (
          <View style={styles.localVideoThumbnail}>
            {!cameraEnabled ? (
              <View style={styles.blackScreenThumbnail} />
            ) : (
              <VideoView
                videoTrack={localVideoThumbnail.videoTrack}
                style={styles.localVideoThumbnailVideo}
                objectFit="cover"
                zOrder={1}
                mirror={localVideoThumbnail.isLocal}
              />
            )}
          </View>
        )}

        {/* Controls overlay trên video */}
        <View style={styles.controlsOverlay}>
        <TouchableOpacity
          style={[styles.controlButton, !micEnabled && styles.controlButtonDisabled]}
          onPress={handleToggleMicrophone}
          disabled={isLeaving}
        >
          <Ionicons name={micEnabled ? 'mic' : 'mic-off'} size={28} color="#fff" />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.controlButton, styles.leaveControlButton, isLeaving && styles.controlButtonDisabled]}
          onPress={confirmLeave}
          disabled={isLeaving}
        >
          {isLeaving ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Ionicons name="call" size={28} color="#fff" style={styles.leaveIcon} />
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.controlButton, !cameraEnabled && styles.controlButtonDisabled]}
          onPress={handleToggleCamera}
          disabled={isLeaving}
        >
          <Ionicons name={cameraEnabled ? 'videocam' : 'videocam-off'} size={28} color="#fff" />
        </TouchableOpacity>
        </View>

        {!!permissionError && (
          <View style={styles.alertBoxOverlay}>
            <Ionicons name="warning" size={20} color="#b45309" />
            <Text style={styles.alertText}>{permissionError}</Text>
          </View>
        )}

        {!!error && (
          <View style={styles.alertBoxOverlay}>
            <Ionicons name="information-circle" size={20} color="#b91c1c" />
            <Text style={styles.alertText}>{error}</Text>
          </View>
        )}
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

export default VideoCallScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000'
  },
  headerOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingTop: 12,
    paddingHorizontal: 16,
    paddingBottom: 8,
    zIndex: 10
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
    transform: [{ rotate: '135deg' }]
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
    position: 'relative',
    backgroundColor: '#000000'
  },
  mainVideoWrapper: {
    flex: 1,
    overflow: 'hidden',
    backgroundColor: '#000000'
  },
  mainVideo: {
    flex: 1,
    width: '100%',
    height: '100%'
  },
  blackScreen: {
    flex: 1,
    backgroundColor: '#000000',
    width: '100%',
    height: '100%'
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
    backgroundColor: '#000000'
  },
  placeholderText: {
    color: '#94a3b8',
    marginTop: 12
  },
  localVideoThumbnail: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 120,
    height: 160,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#0f172a',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    zIndex: 5
  },
  localVideoThumbnailVideo: {
    width: '100%',
    height: '100%'
  },
  blackScreenThumbnail: {
    width: '100%',
    height: '100%',
    backgroundColor: '#000000'
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
  alertBoxOverlay: {
    position: 'absolute',
    top: 60,
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fef3c7',
    borderRadius: 12,
    padding: 12,
    gap: 8,
    zIndex: 10
  },
  alertText: {
    color: '#92400e',
    flex: 1,
    fontSize: 13
  },
  controls: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 32,
    gap: 24
  },
  controlsOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: 32,
    paddingHorizontal: 16,
    gap: 24,
    zIndex: 10
  },
  controlButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center'
  },
  controlButtonDisabled: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)'
  },
  leaveControlButton: {
    backgroundColor: 'rgba(185, 28, 28, 0.7)'
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