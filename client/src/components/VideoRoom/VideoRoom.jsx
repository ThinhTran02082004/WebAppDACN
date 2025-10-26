import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  LiveKitRoom,
  VideoConference,
  RoomAudioRenderer,
  ControlBar,
  GridLayout,
  ParticipantTile,
  useTracks
} from '@livekit/components-react';
import '@livekit/components-styles';
import { Track } from 'livekit-client';
import api from '../../utils/api';
import { FaTimes, FaSpinner } from 'react-icons/fa';
import './VideoRoom.css';

const VideoRoom = ({ roomId, onClose, userRole }) => {
  const [token, setToken] = useState(null);
  const [roomInfo, setRoomInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [connected, setConnected] = useState(false);
  const [roomEnded, setRoomEnded] = useState(false);
  const hasLeftRef = useRef(false);
  const roomIdRef = useRef(roomId);
  const cleanupReadyRef = useRef(false);

  useEffect(() => {
    roomIdRef.current = roomId;
  }, [roomId]);

  const getStoredToken = useCallback(() => {
    try {
      const localInfo = localStorage.getItem('userInfo');
      if (localInfo) {
        const parsed = JSON.parse(localInfo);
        if (parsed?.token) return parsed.token;
      }
      const sessionInfo = sessionStorage.getItem('userInfo');
      if (sessionInfo) {
        const parsed = JSON.parse(sessionInfo);
        if (parsed?.token) return parsed.token;
      }
    } catch (err) {
      console.error('Error parsing stored auth token:', err);
    }
    return null;
  }, []);

  const notifyLeave = useCallback(
    async (options = {}) => {
      const targetRoomId = roomIdRef.current;
      if (!targetRoomId || hasLeftRef.current) return;

      const attemptKeepAlive = options.keepalive && typeof fetch === 'function';
      if (attemptKeepAlive) {
        const tokenValue = getStoredToken();
        const apiBaseUrl = import.meta.env?.VITE_API_URL || 'http://localhost:5000/api';
        if (tokenValue) {
          try {
            await fetch(`${apiBaseUrl}/video-rooms/${targetRoomId}/leave`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${tokenValue}`
              },
              body: JSON.stringify({ reason: options.reason || 'unload' }),
              keepalive: true
            });
            hasLeftRef.current = true;
            return;
          } catch (keepAliveError) {
            console.error('Keepalive leave request failed:', keepAliveError);
          }
        }
      }

      try {
        await api.post(`/video-rooms/${targetRoomId}/leave`);
        hasLeftRef.current = true;
      } catch (leaveError) {
        console.error('Error notifying server about leaving video room:', leaveError);
      }
    },
    [getStoredToken]
  );

  const joinRoom = useCallback(async () => {
    try {
      setLoading(true);
      const response = await api.get(`/video-rooms/join/${roomId}`);
      
      if (response.data.success) {
        setToken(response.data.data.token);
        setRoomInfo(response.data.data);
      } else {
        setError(response.data.message || 'Không thể tham gia phòng');
      }
    } catch (err) {
      console.error('Error joining room:', err);
      setError('Không thể kết nối với phòng video');
    } finally {
      setLoading(false);
    }
  }, [roomId]);

  useEffect(() => {
    hasLeftRef.current = false;
    joinRoom();
  }, [roomId, joinRoom]);

  useEffect(() => {
    const handleBeforeUnload = () => {
      notifyLeave({ keepalive: true, reason: 'beforeunload' });
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);

      if (!cleanupReadyRef.current) {
        cleanupReadyRef.current = true;
        return;
      }

      notifyLeave({ reason: 'unmount' });
    };
  }, [notifyLeave]);

  const handleDisconnected = () => {
    setConnected(false);
    setRoomEnded(true);
    notifyLeave();
    console.log('Disconnected from room');
  };

  const handleConnected = () => {
    setConnected(true);
    console.log('Connected to room');
  };

  const handleLeave = async () => {
    if (userRole === 'doctor' && roomInfo) {
      // If doctor leaves, optionally end the room
      const confirmEnd = window.confirm('Bạn có muốn kết thúc cuộc gọi cho tất cả người tham gia không?');
      if (confirmEnd) {
        try {
          await api.post(`/video-rooms/${roomId}/end`);
          hasLeftRef.current = true;
        } catch (error) {
          console.error('Error ending room:', error);
        }
        onClose();
        return;
      }
    }
    await notifyLeave();
    onClose();
  };

  if (loading) {
    return (
      <div className="video-room-container">
        <div className="video-room-loading">
          <FaSpinner className="animate-spin text-4xl text-blue-500 mb-4" />
          <p className="text-gray-600">Đang kết nối với phòng video...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="video-room-container">
        <div className="video-room-error">
          <p className="text-red-600 mb-4">{error}</p>
          <button 
            onClick={onClose}
            className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600"
          >
            Đóng
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="video-room-container">
      <div className="video-room-header">
        <div className="room-info">
          <h3 className="text-lg font-semibold text-white">Phòng video khám bệnh</h3>
          {roomInfo?.appointmentInfo && (
            <div className="text-sm text-gray-200">
              <span>Bác sĩ: {roomInfo.appointmentInfo.doctorName}</span>
              <span className="mx-2">•</span>
              <span>Bệnh nhân: {roomInfo.appointmentInfo.patientName}</span>
            </div>
          )}
        </div>
        <button 
          onClick={handleLeave}
          className="close-button"
          title="Rời phòng"
        >
          <FaTimes />
        </button>
      </div>

      {token && roomInfo && !roomEnded && (
        <LiveKitRoom
          video={true}
          audio={true}
          token={token}
          serverUrl={roomInfo.wsUrl}
          onConnected={handleConnected}
          onDisconnected={handleDisconnected}
          data-lk-theme="default"
          style={{ height: 'calc(100% - 60px)' }}
        >
          <VideoConference />
          <RoomAudioRenderer />
        </LiveKitRoom>
      )}
      {roomEnded && (
        <div className="video-room-ended">
          <p className="text-lg text-gray-600 mb-4">Cuộc gọi video đã kết thúc</p>
          <button 
            onClick={onClose}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
          >
            Đóng
          </button>
        </div>
      )}
    </div>
  );
};

export default VideoRoom;
