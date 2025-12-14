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
import { FaTimes, FaSpinner, FaCopy, FaCheck } from 'react-icons/fa';
import { toast } from 'react-toastify';
import './VideoRoom.css';

const VideoRoom = ({ roomId, onClose, userRole, meetingMode = false, initialToken = null, initialRoomInfo = null }) => {
  const [token, setToken] = useState(initialToken);
  const [roomInfo, setRoomInfo] = useState(initialRoomInfo);
  const [loading, setLoading] = useState(!initialToken);
  const [error, setError] = useState(null);
  const [connected, setConnected] = useState(false);
  const [roomEnded, setRoomEnded] = useState(false);
  const [copied, setCopied] = useState(false);
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
      const apiBaseUrl = import.meta.env?.VITE_API_URL ;

      if (meetingMode) {
        if (attemptKeepAlive) {
          const tokenValue = getStoredToken();
          if (tokenValue) {
            try {
              await fetch(`${apiBaseUrl}/doctor-meetings/${targetRoomId}/leave`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${tokenValue}`
                },
                body: JSON.stringify({ reason: options.reason || 'leave' }),
                keepalive: true
              });
              hasLeftRef.current = true;
              return;
            } catch (keepAliveError) {
              console.error('Keepalive leave request failed (meeting):', keepAliveError);
            }
          }
        }

        try {
          await api.post(`/doctor-meetings/${targetRoomId}/leave`, {
            reason: options.reason || 'leave'
          });
          hasLeftRef.current = true;
        } catch (leaveError) {
          console.error('Error notifying server about leaving meeting:', leaveError);
        }
        return;
      }

      if (attemptKeepAlive) {
        const tokenValue = getStoredToken();
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
    [getStoredToken, meetingMode]
  );

  const joinRoom = useCallback(async () => {
    // Skip if already have token (from meeting join)
    if (initialToken && initialRoomInfo) {
      setLoading(false);
      return;
    }
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
  }, [roomId, initialToken, initialRoomInfo]);

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
    if (meetingMode) {
      const targetMeetingId = roomInfo?.meetingId || roomIdRef.current;

      if (userRole === 'doctor' && roomInfo) {
        // If doctor leaves, optionally end the meeting for everyone
        const confirmEnd = window.confirm('Bạn có muốn kết thúc cuộc gọi cho tất cả người tham gia không?');
        if (confirmEnd && targetMeetingId) {
          try {
            await api.post(`/doctor-meetings/${targetMeetingId}/end`);
            hasLeftRef.current = true;
          } catch (error) {
            console.error('Error ending meeting:', error);
          }
          onClose();
          return;
        }
      }

      await notifyLeave({ reason: 'leave' });
      onClose();
      return;
    }

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

  const handleCopyRoomCode = () => {
    if (roomInfo?.roomCode) {
      navigator.clipboard.writeText(roomInfo.roomCode).then(() => {
        setCopied(true);
        toast.success('Đã sao chép mã phòng!');
        setTimeout(() => setCopied(false), 2000);
      }).catch(err => {
        console.error('Failed to copy:', err);
        toast.error('Không thể sao chép mã phòng');
      });
    }
  };
  const containerClasses = 'fixed inset-0 z-[9999] bg-neutral-950 flex flex-col p-1.5 sm:p-2 gap-1 sm:gap-1.5 overflow-hidden';
  const panelClasses = 'flex-1 bg-neutral-900 border border-neutral-800 rounded-xl p-1.5 sm:p-1.5 shadow-2xl flex flex-col min-h-0';

  if (loading) {
    return (
      <div className={containerClasses}>
        <div className="flex-1 rounded-xl bg-neutral-900 border border-neutral-800 flex items-center justify-center flex-col text-slate-100 gap-3 shadow-2xl">
          <FaSpinner className="animate-spin text-4xl text-blue-400" />
          <p className="text-sm text-slate-300">Đang kết nối với phòng video...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={containerClasses}>
        <div className="flex-1 rounded-xl bg-neutral-900 border border-neutral-800 flex items-center justify-center flex-col text-slate-100 gap-3 shadow-2xl">
          <p className="text-red-400 text-center text-sm">{error}</p>
          <button 
            onClick={onClose}
            className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
          >
            Đóng
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={containerClasses}>
      <div className="flex items-start justify-between rounded-xl px-2 py-1 bg-gradient-to-r from-indigo-500 to-purple-600 shadow-lg gap-1.5">
        <div className="flex flex-col gap-0.5 text-white min-w-0">
          <h3 className="text-[11px] sm:text-xs font-semibold leading-tight truncate">
            {roomInfo?.meetingType === 'internal' ? 'Cuộc họp nội bộ' : 'Phòng video khám bệnh'}
          </h3>
          {roomInfo?.appointmentInfo && (
            <div className="flex items-center flex-wrap gap-1 text-[9px] sm:text-[10px] text-white">
              <span className="truncate">Bác sĩ: {roomInfo.appointmentInfo.doctorName}</span>
              <span className="opacity-70">•</span>
              <span className="truncate">Bệnh nhân: {roomInfo.appointmentInfo.patientName}</span>
            </div>
          )}
          {roomInfo?.roomCode && (
            <div className="flex items-center flex-wrap gap-1 text-[9px] sm:text-[10px] text-white font-medium">
              <span className="truncate">
                Mã phòng: <strong className="text-yellow-300 text-[10px] sm:text-[11px] tracking-wide">{roomInfo.roomCode}</strong>
              </span>
              <button
                onClick={handleCopyRoomCode}
                className="inline-flex items-center gap-1 px-1 py-0.5 rounded bg-white/20 hover:bg-white/30 text-white text-[9px] sm:text-[10px] font-semibold transition-colors"
                title="Sao chép mã phòng"
              >
                {copied ? <FaCheck className="text-green-300" /> : <FaCopy />}
                {copied ? 'Đã sao chép' : 'Sao chép'}
              </button>
            </div>
          )}
        </div>
        <button 
          onClick={handleLeave}
          className="flex items-center justify-center w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-white/20 hover:bg-white/30 text-white transition-transform duration-200 hover:scale-105"
          title="Rời phòng"
        >
          <FaTimes />
        </button>
      </div>
      <div className={panelClasses}>
        {token && roomInfo && !roomEnded && (
          <div className="flex-1 min-h-0 rounded-lg overflow-hidden bg-black">
            <LiveKitRoom
              video={true}
              audio={true}
              token={token}
              serverUrl={roomInfo.wsUrl}
              onConnected={handleConnected}
              onDisconnected={handleDisconnected}
              data-lk-theme="default"
              style={{ height: '100%' }}
            >
              <VideoConference />
              <RoomAudioRenderer />
            </LiveKitRoom>
          </div>
        )}
        {roomEnded && (
          <div className="flex-1 flex items-center justify-center text-slate-100 bg-neutral-900 rounded-lg border border-neutral-800">
            <div className="flex flex-col items-center gap-3">
              <p className="text-base sm:text-lg text-slate-200">Cuộc gọi video đã kết thúc</p>
              <button 
                onClick={onClose}
                className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
              >
                Đóng
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default VideoRoom;
