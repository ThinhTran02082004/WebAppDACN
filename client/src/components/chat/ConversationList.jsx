import React, { useState, useEffect } from 'react';
import { FaSearch, FaCircle, FaDoorOpen } from 'react-icons/fa';
import { useSocket } from '../../context/SocketContext';
import RoomCodeInput from '../VideoRoom/RoomCodeInput';
import VideoRoom from '../VideoRoom/VideoRoom';
import { useAuth } from '../../context/AuthContext';

const ConversationList = ({ conversations, onSelectConversation, selectedConversationId, currentUserId }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredConversations, setFilteredConversations] = useState(conversations);
  const [showRoomCodeInput, setShowRoomCodeInput] = useState(false);
  const [activeVideoRoom, setActiveVideoRoom] = useState(null);
  const { isUserOnline } = useSocket();
  const { user: authUser } = useAuth();

  useEffect(() => {
    if (searchTerm.trim()) {
      const filtered = conversations.filter(conv => {
        const otherParticipant = conv.participants[0];
        return otherParticipant?.fullName?.toLowerCase().includes(searchTerm.toLowerCase());
      });
      setFilteredConversations(filtered);
    } else {
      setFilteredConversations(conversations);
    }
  }, [searchTerm, conversations]);

  const formatTime = (timestamp) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    const now = new Date();
    const diffInHours = (now - date) / (1000 * 60 * 60);

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

  const getUnreadCount = (conv) => {
    if (!conv.unreadCount || !currentUserId) return 0;
    return conv.unreadCount.get ? conv.unreadCount.get(currentUserId) : conv.unreadCount[currentUserId] || 0;
  };

  const handleJoinRoom = (roomData) => {
    setActiveVideoRoom(roomData.roomId);
    setShowRoomCodeInput(false);
  };

  const handleCloseVideoRoom = () => {
    setActiveVideoRoom(null);
  };

  // Show video room if active
  if (activeVideoRoom) {
    return <VideoRoom roomId={activeVideoRoom} onClose={handleCloseVideoRoom} userRole={authUser?.role} />;
  }

  return (
    <div className="flex flex-col h-full bg-white border-r border-gray-200">
      {/* Room Code Input Section - Above Search */}
      <div className="p-4 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50">
        <button
          onClick={() => setShowRoomCodeInput(!showRoomCodeInput)}
          className="w-full flex items-center justify-between px-4 py-3 bg-white border-2 border-blue-300 rounded-lg hover:bg-blue-50 hover:border-blue-400 transition-all duration-200 shadow-sm hover:shadow-md group"
        >
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-blue-100 rounded-lg group-hover:bg-blue-200 transition-colors">
              <FaDoorOpen className="text-blue-600 text-lg" />
            </div>
            <div className="text-left">
              <p className="font-semibold text-gray-800 text-sm">Tham gia phòng video</p>
              <p className="text-xs text-gray-500">Nhập mã phòng để tham gia</p>
            </div>
          </div>
          <svg 
            className={`w-5 h-5 text-blue-600 transition-transform duration-200 ${showRoomCodeInput ? 'rotate-180' : ''}`}
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {/* Room Code Input Form */}
        {showRoomCodeInput && (
          <div className="mt-3 p-3 bg-white border border-blue-200 rounded-lg shadow-sm animate-slideDown">
            <RoomCodeInput 
              onJoinRoom={handleJoinRoom}
              compact={true}
            />
          </div>
        )}
      </div>

      {/* Search bar */}
      <div className="p-4 border-b border-gray-200">
        <div className="relative">
          <FaSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Tìm kiếm cuộc trò chuyện..."
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {/* Conversations list */}
      <div className="flex-1 overflow-y-auto">
        {filteredConversations.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-500">
            <div className="text-center">
              <p className="text-lg font-semibold mb-2">Chưa có cuộc trò chuyện</p>
              <p className="text-sm">Bắt đầu trò chuyện với bác sĩ hoặc bệnh nhân</p>
            </div>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {filteredConversations.map((conv) => {
              const otherParticipant = conv.participants[0];
              const unreadCount = getUnreadCount(conv);
              const isSelected = conv.id === selectedConversationId || conv._id === selectedConversationId;
              const isOnline = otherParticipant ? isUserOnline(otherParticipant._id) : false;

              return (
                <div
                  key={conv.id || conv._id}
                  className={`p-4 cursor-pointer hover:bg-gray-50 transition-colors ${
                    isSelected ? 'bg-primary-light bg-opacity-10' : ''
                  }`}
                  onClick={() => onSelectConversation(conv)}
                >
                  <div className="flex items-start space-x-3">
                    {/* Avatar with online indicator */}
                    <div className="relative flex-shrink-0">
                      {otherParticipant?.avatarUrl || otherParticipant?.avatar?.url ? (
                        <img
                          src={otherParticipant.avatarUrl || otherParticipant.avatar.url}
                          alt={otherParticipant.fullName}
                          className="w-12 h-12 rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-full bg-primary text-white flex items-center justify-center font-semibold">
                          {otherParticipant?.fullName?.charAt(0) || 'U'}
                        </div>
                      )}
                      {isOnline && (
                        <FaCircle className="absolute bottom-0 right-0 w-3 h-3 text-green-500 bg-white rounded-full" />
                      )}
                    </div>

                    {/* Conversation info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-baseline mb-1">
                        <h3 className="font-semibold text-gray-900 truncate">
                          {otherParticipant?.fullName || 'Unknown'}
                        </h3>
                        <span className="text-xs text-gray-500 ml-2 flex-shrink-0">
                          {formatTime(conv.lastMessage?.timestamp || conv.updatedAt)}
                        </span>
                      </div>
                      
                      {/* Role badge */}
                      {otherParticipant?.roleType && (
                        <span className={`inline-block text-xs px-2 py-0.5 rounded-full mb-1 ${
                          otherParticipant.roleType === 'doctor' 
                            ? 'bg-blue-100 text-blue-700' 
                            : 'bg-gray-100 text-gray-700'
                        }`}>
                          {otherParticipant.roleType === 'doctor' ? 'Bác sĩ' : 'Bệnh nhân'}
                        </span>
                      )}

                      {/* Last message */}
                      <div className="flex justify-between items-center">
                        <p className={`text-sm truncate ${unreadCount > 0 ? 'font-semibold text-gray-900' : 'text-gray-600'}`}>
                          {conv.lastMessage?.content || 'Chưa có tin nhắn'}
                        </p>
                        {unreadCount > 0 && (
                          <span className="ml-2 bg-primary text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center flex-shrink-0">
                            {unreadCount > 9 ? '9+' : unreadCount}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default ConversationList;

