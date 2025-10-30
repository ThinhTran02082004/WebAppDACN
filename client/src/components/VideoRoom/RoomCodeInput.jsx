import React, { useState } from 'react';
import { FaVideo, FaCheck, FaTimes } from 'react-icons/fa';
import api from '../../utils/api';
import { toast } from 'react-toastify';

const RoomCodeInput = ({ onJoinRoom, compact = false }) => {
  const [roomCode, setRoomCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [validating, setValidating] = useState(false);
  const [roomInfo, setRoomInfo] = useState(null);
  const [showInput, setShowInput] = useState(compact); // Auto show if compact

  const handleValidate = async (code) => {
    if (!code || code.length < 6) {
      setRoomInfo(null);
      return;
    }

    try {
      setValidating(true);
      const response = await api.get(`/video-rooms/validate-code/${code}`);
      if (response.data.success) {
        setRoomInfo(response.data.data);
      }
    } catch (error) {
      setRoomInfo(null);
    } finally {
      setValidating(false);
    }
  };

  const handleInputChange = (e) => {
    const value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
    setRoomCode(value);
    
    // Auto-validate when code reaches 6 characters
    if (value.length === 6) {
      handleValidate(value);
    } else {
      setRoomInfo(null);
    }
  };

  const handleJoin = async () => {
    if (!roomCode || roomCode.length !== 6) {
      toast.error('Vui lòng nhập mã phòng hợp lệ (6 ký tự)');
      return;
    }

    try {
      setLoading(true);
      const response = await api.post('/video-rooms/join-by-code', {
        roomCode: roomCode
      });

      if (response.data.success) {
        toast.success('Tham gia phòng thành công!');
        // Call parent callback with room data
        if (onJoinRoom) {
          onJoinRoom(response.data.data);
        }
        // Reset form
        setRoomCode('');
        setRoomInfo(null);
        setShowInput(false);
      }
    } catch (error) {
      console.error('Error joining room:', error);
      toast.error(error.response?.data?.message || 'Không thể tham gia phòng');
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && roomCode.length === 6 && !loading) {
      handleJoin();
    }
  };

  if (!showInput) {
    return (
      <div className="mb-4">
        <button
          onClick={() => setShowInput(true)}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg hover:from-blue-600 hover:to-blue-700 transition-all shadow-md hover:shadow-lg"
        >
          <FaVideo />
          <span>Tham gia phòng bằng mã</span>
        </button>
      </div>
    );
  }

  // Compact mode - inline form
  if (compact) {
    return (
      <div className="space-y-2">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <input
              type="text"
              value={roomCode}
              onChange={handleInputChange}
              onKeyPress={handleKeyPress}
              placeholder="Nhập mã 6 ký tự"
              maxLength={6}
              className="w-full px-3 py-2 border border-blue-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent uppercase font-mono text-sm tracking-wider"
              disabled={loading}
            />
            {validating && (
              <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
              </div>
            )}
            {roomInfo && (
              <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                <FaCheck className="text-green-500 text-sm" />
              </div>
            )}
          </div>
          <button
            onClick={handleJoin}
            disabled={loading || !roomInfo || roomCode.length !== 6}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center gap-2 text-sm"
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                <span>Đang join...</span>
              </>
            ) : (
              <>
                <FaVideo className="text-sm" />
                <span>Tham gia</span>
              </>
            )}
          </button>
        </div>

        {roomInfo && (
          <div className="bg-green-50 border border-green-200 rounded-md p-2">
            <p className="text-xs font-medium text-green-800">
              {roomInfo.meetingType === 'internal' ? '🎯 Cuộc họp nội bộ' : '🏥 Phòng khám'} • {roomInfo.participantCount}/{roomInfo.maxParticipants} người
            </p>
          </div>
        )}
      </div>
    );
  }

  // Normal mode - full form with toggle
  return (
    <div className="mb-4 bg-white rounded-lg shadow-md border border-gray-200 p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-gray-800 flex items-center gap-2">
          <FaVideo className="text-blue-500" />
          Tham gia cuộc gọi video
        </h3>
        <button
          onClick={() => {
            setShowInput(false);
            setRoomCode('');
            setRoomInfo(null);
          }}
          className="text-gray-400 hover:text-gray-600"
        >
          <FaTimes />
        </button>
      </div>

      <div className="space-y-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Nhập mã phòng (6 ký tự)
          </label>
          <div className="relative">
            <input
              type="text"
              value={roomCode}
              onChange={handleInputChange}
              onKeyPress={handleKeyPress}
              placeholder="Ví dụ: ABC123"
              maxLength={6}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent uppercase font-mono text-lg tracking-widest"
              disabled={loading}
            />
            {validating && (
              <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-500"></div>
              </div>
            )}
            {roomInfo && (
              <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                <FaCheck className="text-green-500" />
              </div>
            )}
          </div>
        </div>

        {roomInfo && (
          <div className="bg-green-50 border border-green-200 rounded-md p-3">
            <p className="text-sm font-medium text-green-800 mb-1">Phòng hợp lệ</p>
            <div className="text-xs text-green-600 space-y-1">
              <p>Loại: {roomInfo.meetingType === 'internal' ? 'Cuộc họp nội bộ' : 'Khám bệnh'}</p>
              {roomInfo.doctorName !== 'N/A' && <p>Bác sĩ: {roomInfo.doctorName}</p>}
              {roomInfo.patientName !== 'N/A' && <p>Bệnh nhân: {roomInfo.patientName}</p>}
              <p>Người tham gia: {roomInfo.participantCount}/{roomInfo.maxParticipants}</p>
            </div>
          </div>
        )}

        <button
          onClick={handleJoin}
          disabled={loading || !roomInfo || roomCode.length !== 6}
          className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              <span>Đang tham gia...</span>
            </>
          ) : (
            <>
              <FaVideo />
              <span>Tham gia ngay</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};

export default RoomCodeInput;

