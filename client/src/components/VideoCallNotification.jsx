import React, { useState, useEffect } from 'react';
import { FaVideo, FaPhoneSlash, FaPhone } from 'react-icons/fa';
import { useSocket } from '../context/SocketContext';
import VideoRoom from './VideoRoom/VideoRoom';
import api from '../utils/api';
import { toast } from 'react-toastify';

const VideoCallNotification = () => {
  const { socket } = useSocket();
  const [incomingCall, setIncomingCall] = useState(null);
  const [activeCall, setActiveCall] = useState(null);
  const [ringtone, setRingtone] = useState(null);

  useEffect(() => {
    // Create ringtone audio
    const audio = new Audio('/sounds/ringtone.mp3'); // You can add ringtone file later
    audio.loop = true;
    setRingtone(audio);

    return () => {
      if (audio) {
        audio.pause();
        audio.currentTime = 0;
      }
    };
  }, []);

  useEffect(() => {
    if (!socket) return;

    const handleIncomingCall = (data) => {
      console.log('Incoming video call:', data);
      
      setIncomingCall({
        roomId: data.roomId,
        roomName: data.roomName,
        roomCode: data.roomCode,
        callerName: data.callerName,
        callerRole: data.callerRole,
        appointmentId: data.appointmentId,
        timestamp: Date.now()
      });

      // Play ringtone
      if (ringtone) {
        ringtone.play().catch(err => console.log('Cannot play ringtone:', err));
      }

      // Auto-reject after 60 seconds if not answered
      setTimeout(() => {
        setIncomingCall(prev => {
          if (prev && prev.roomId === data.roomId) {
            handleReject();
            return null;
          }
          return prev;
        });
      }, 60000);
    };

    const handleCallCancelled = (data) => {
      if (incomingCall && incomingCall.roomId === data.roomId) {
        setIncomingCall(null);
        if (ringtone) {
          ringtone.pause();
          ringtone.currentTime = 0;
        }
        toast.info('Cuộc gọi đã bị hủy');
      }
    };

    socket.on('incoming_video_call', handleIncomingCall);
    socket.on('video_call_cancelled', handleCallCancelled);

    return () => {
      socket.off('incoming_video_call', handleIncomingCall);
      socket.off('video_call_cancelled', handleCallCancelled);
    };
  }, [socket, ringtone, incomingCall]);

  const handleAccept = async () => {
    if (!incomingCall) return;

    try {
      // Stop ringtone
      if (ringtone) {
        ringtone.pause();
        ringtone.currentTime = 0;
      }

      // Join the video room
      const response = await api.get(`/video-rooms/join/${incomingCall.roomId}`);
      
      if (response.data.success) {
        setActiveCall({
          roomId: incomingCall.roomId,
          roomInfo: response.data.data
        });
        setIncomingCall(null);

        // Notify caller that call was accepted
        socket.emit('video_call_accepted', {
          roomId: incomingCall.roomId,
          roomName: incomingCall.roomName
        });
      }
    } catch (error) {
      console.error('Error accepting call:', error);
      toast.error('Không thể tham gia cuộc gọi');
      setIncomingCall(null);
    }
  };

  const handleReject = () => {
    if (!incomingCall) return;

    // Stop ringtone
    if (ringtone) {
      ringtone.pause();
      ringtone.currentTime = 0;
    }

    // Notify caller that call was rejected
    if (socket) {
      socket.emit('video_call_rejected', {
        roomId: incomingCall.roomId,
        roomName: incomingCall.roomName
      });
    }

    setIncomingCall(null);
    toast.info('Đã từ chối cuộc gọi');
  };

  const handleCloseCall = () => {
    setActiveCall(null);
  };

  // Show active video call
  if (activeCall) {
    return (
      <VideoRoom
        roomId={activeCall.roomId}
        onClose={handleCloseCall}
        userRole="patient"
      />
    );
  }

  // Show incoming call notification
  if (incomingCall) {
    return (
      <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black bg-opacity-75 animate-fadeIn">
        <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full mx-4 animate-slideDown">
          {/* Caller Avatar */}
          <div className="flex justify-center mb-6">
            <div className="relative">
              <div className="w-24 h-24 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center animate-pulse">
                <FaVideo className="text-white text-4xl" />
              </div>
              <div className="absolute inset-0 rounded-full border-4 border-blue-400 animate-ping"></div>
            </div>
          </div>

          {/* Caller Info */}
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold text-gray-800 mb-2">
              Cuộc gọi video đến
            </h2>
            <p className="text-xl text-gray-700 mb-1">
              {incomingCall.callerName}
            </p>
            <p className="text-sm text-gray-500">
              {incomingCall.callerRole === 'doctor' ? '👨‍⚕️ Bác sĩ' : '👤 Bệnh nhân'}
            </p>
            {incomingCall.roomCode && (
              <div className="mt-3">
                <span className="inline-block px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-mono">
                  Mã: {incomingCall.roomCode}
                </span>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex gap-4">
            {/* Reject Button */}
            <button
              onClick={handleReject}
              className="flex-1 flex items-center justify-center gap-2 px-6 py-4 bg-red-500 hover:bg-red-600 text-white rounded-xl font-semibold transition-all transform hover:scale-105 active:scale-95"
            >
              <FaPhoneSlash className="text-xl" />
              <span>Từ chối</span>
            </button>

            {/* Accept Button */}
            <button
              onClick={handleAccept}
              className="flex-1 flex items-center justify-center gap-2 px-6 py-4 bg-green-500 hover:bg-green-600 text-white rounded-xl font-semibold transition-all transform hover:scale-105 active:scale-95 animate-bounce"
            >
              <FaPhone className="text-xl" />
              <span>Trả lời</span>
            </button>
          </div>

          {/* Timer */}
          <div className="mt-4 text-center">
            <p className="text-xs text-gray-500">
              Cuộc gọi sẽ tự động kết thúc sau 60 giây
            </p>
          </div>
        </div>
      </div>
    );
  }

  return null;
};

export default VideoCallNotification;

