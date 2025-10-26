import React, { useState, useEffect, useRef } from 'react';
import { FaPaperPlane, FaCircle, FaVideo, FaPaperclip, FaCalendarAlt } from 'react-icons/fa';
import { toast } from 'react-toastify';
import MessageItem from './MessageItem';
import AppointmentSelectorModal from './AppointmentSelectorModal';
import MediaPreviewModal from './MediaPreviewModal';
import { useSocket } from '../../context/SocketContext';
import { useAuth } from '../../context/AuthContext';
import api from '../../utils/api';

const ChatWindow = ({ conversation, currentUserId, onClose }) => {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [showAppointmentModal, setShowAppointmentModal] = useState(false);
  const [showMediaPreview, setShowMediaPreview] = useState(false);
  const [selectedMedia, setSelectedMedia] = useState(null);
  const [mediaCaption, setMediaCaption] = useState('');
  const [uploading, setUploading] = useState(false);
  const messagesContainerRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const fileInputRef = useRef(null);
  const { socket, isConnected, emit, on, off, isUserOnline } = useSocket();
  const { user: authUser } = useAuth();

  const otherParticipant = conversation?.participants?.[0];
  const conversationId = conversation?.id || conversation?._id;
  const receiverId = otherParticipant?._id;
  const resolvedCurrentUserId = currentUserId || authUser?.id || authUser?._id;

  // Fetch messages when conversation changes
  useEffect(() => {
    if (conversationId) {
      fetchMessages();
      
      // Join conversation room for real-time updates
      if (isConnected) {
        emit('join_conversation', { conversationId });
      }

      return () => {
        if (isConnected) {
          emit('leave_conversation', { conversationId });
        }
      };
    }
  }, [conversationId, isConnected]);

  // Listen for real-time messages
  useEffect(() => {
    if (!socket || !isConnected) return;

    const handleNewMessage = (message) => {
      if (message.conversationId === conversationId) {
        setMessages(prev => [...prev, message]);
        scrollToBottom();
        
        // Mark as read if it's not from current user
        const incomingSenderId = typeof message.senderId === 'object' ? message.senderId?._id : message.senderId;
        if (incomingSenderId && resolvedCurrentUserId && incomingSenderId !== resolvedCurrentUserId) {
          markMessagesAsRead([message._id]);
        }
      }
    };

    const handleUserTyping = ({ conversationId: typingConvId, userId }) => {
      if (typingConvId === conversationId && userId !== currentUserId) {
        setIsTyping(true);
        // Auto hide after 3 seconds
        setTimeout(() => setIsTyping(false), 3000);
      }
    };

    const handleUserStopTyping = ({ conversationId: typingConvId }) => {
      if (typingConvId === conversationId) {
        setIsTyping(false);
      }
    };

    on('new_message', handleNewMessage);
    on('user_typing', handleUserTyping);
    on('user_stop_typing', handleUserStopTyping);

    return () => {
      off('new_message', handleNewMessage);
      off('user_typing', handleUserTyping);
      off('user_stop_typing', handleUserStopTyping);
    };
  }, [socket, isConnected, conversationId, resolvedCurrentUserId]);

  // Auto scroll to bottom
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = (behavior = 'smooth') => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTo({
        top: messagesContainerRef.current.scrollHeight,
        behavior
      });
    }
  };

  const fetchMessages = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/chat/conversations/${conversationId}/messages`);
      if (response.data.success) {
        setMessages(response.data.data);
        setTimeout(() => scrollToBottom('auto'), 0);
      }
    } catch (error) {
      console.error('Error fetching messages:', error);
    } finally {
      setLoading(false);
    }
  };

  const markMessagesAsRead = async (messageIds) => {
    try {
      if (isConnected) {
        emit('mark_as_read', { conversationId, messageIds });
      }
    } catch (error) {
      console.error('Error marking messages as read:', error);
    }
  };

  const handleTyping = () => {
    if (isConnected && receiverId) {
      emit('typing_start', { conversationId, receiverId });
      
      // Clear previous timeout
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      
      // Stop typing after 2 seconds of no input
      typingTimeoutRef.current = setTimeout(() => {
        emit('typing_stop', { conversationId, receiverId });
      }, 2000);
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    
    if (!newMessage.trim() || sending) return;

    try {
      setSending(true);
      
      const response = await api.post(`/chat/conversations/${conversationId}/messages`, {
        content: newMessage.trim()
      });

      if (response.data.success) {
        setNewMessage('');
        
        // Stop typing indicator
        if (isConnected && receiverId) {
          emit('typing_stop', { conversationId, receiverId });
        }
      }
    } catch (error) {
      console.error('Error sending message:', error);
      alert('Không thể gửi tin nhắn. Vui lòng thử lại.');
    } finally {
      setSending(false);
    }
  };

  // Handle file selection
  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Check file size (50MB)
    if (file.size > 50 * 1024 * 1024) {
      toast.error('File không được vượt quá 50MB');
      return;
    }

    // Check file type
    const isImage = file.type.startsWith('image/');
    const isVideo = file.type.startsWith('video/');
    
    if (!isImage && !isVideo) {
      toast.error('Chỉ hỗ trợ file ảnh và video');
      return;
    }

    // Create preview
    const preview = URL.createObjectURL(file);
    setSelectedMedia({ file, preview, type: file.type });
    setShowMediaPreview(true);
    
    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Upload and send media
  const handleSendMedia = async () => {
    if (!selectedMedia) return;

    try {
      setUploading(true);

      // Upload to server
      const formData = new FormData();
      formData.append('media', selectedMedia.file);

      const uploadResponse = await api.post('/chat/upload-media', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      const mediaData = uploadResponse.data.data;

      // Send message with attachment
      await api.post(`/chat/conversations/${conversationId}/messages`, {
        content: mediaCaption || (mediaData.resourceType === 'image' ? 'Đã gửi ảnh' : 'Đã gửi video'),
        attachments: [mediaData]
      });

      // Clean up
      URL.revokeObjectURL(selectedMedia.preview);
      setShowMediaPreview(false);
      setSelectedMedia(null);
      setMediaCaption('');
      toast.success('Gửi thành công');
    } catch (error) {
      console.error('Error sending media:', error);
      toast.error(error.response?.data?.message || 'Không thể gửi file');
    } finally {
      setUploading(false);
    }
  };

  // Send appointment
  const handleSendAppointment = async (appointmentId) => {
    try {
      await api.post(`/chat/conversations/${conversationId}/send-appointment`, {
        appointmentId
      });
      toast.success('Đã gửi thông tin lịch hẹn');
    } catch (error) {
      console.error('Error sending appointment:', error);
      toast.error(error.response?.data?.message || 'Không thể gửi lịch hẹn');
    }
  };

  if (!conversation) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-50">
        <div className="text-center text-gray-500">
          <p className="text-lg font-semibold mb-2">Chọn một cuộc trò chuyện</p>
          <p className="text-sm">Bắt đầu trò chuyện từ danh sách bên trái</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200 bg-white flex items-center justify-between">
        <div className="flex items-center space-x-3">
          {/* Avatar */}
          <div className="relative">
            {otherParticipant?.avatarUrl || otherParticipant?.avatar?.url ? (
              <img
                src={otherParticipant.avatarUrl || otherParticipant.avatar.url}
                alt={otherParticipant.fullName}
                className="w-10 h-10 rounded-full object-cover"
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-primary text-white flex items-center justify-center font-semibold">
                {otherParticipant?.fullName?.charAt(0) || 'U'}
              </div>
            )}
            {isUserOnline(otherParticipant?._id) && (
              <FaCircle className="absolute bottom-0 right-0 w-3 h-3 text-green-500 bg-white rounded-full" />
            )}
          </div>

          {/* Info */}
          <div>
            <h2 className="font-semibold text-gray-900">{otherParticipant?.fullName}</h2>
            <p className="text-sm text-gray-500">
              {isUserOnline(otherParticipant?._id) ? 'Đang hoạt động' : 'Offline'}
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center space-x-2">
          {/* Video call button - can be implemented later */}
          {/* <button className="p-2 text-gray-600 hover:bg-gray-100 rounded-full transition-colors">
            <FaVideo className="w-5 h-5" />
          </button> */}
          
          {onClose && (
            <button
              onClick={onClose}
              className="p-2 text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Messages */}
      <div
        className="flex-1 overflow-y-auto px-6 py-4 bg-gray-50 chat-messages"
        ref={messagesContainerRef}
      >
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary"></div>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-500">
            <p>Chưa có tin nhắn. Hãy bắt đầu cuộc trò chuyện!</p>
          </div>
        ) : (
          <>
            {messages.map((message) => {
              // Safely compare senderId with current user
              const messageSenderId = typeof message.senderId === 'object' ? message.senderId?._id : message.senderId;
              const isOwnMessage = resolvedCurrentUserId && messageSenderId === resolvedCurrentUserId;
              
              return (
                <MessageItem
                  key={message._id}
                  message={message}
                  isOwnMessage={!!isOwnMessage}
                  user={otherParticipant}
                  currentUser={authUser}
                />
              );
            })}
            
            {/* Typing indicator */}
            {isTyping && (
              <div className="flex items-center space-x-2 text-gray-500 text-sm mb-4">
                <span>{otherParticipant?.fullName} đang gõ</span>
                <div className="flex space-x-1">
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce-dot"></div>
                  <div
                    className="w-2 h-2 bg-gray-400 rounded-full animate-bounce-dot"
                    style={{ animationDelay: '0.2s' }}
                  ></div>
                  <div
                    className="w-2 h-2 bg-gray-400 rounded-full animate-bounce-dot"
                    style={{ animationDelay: '0.4s' }}
                  ></div>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Input */}
      <div className="px-6 py-4 border-t border-gray-200 bg-white">
        <form onSubmit={handleSendMessage} className="flex items-end space-x-2">
          {/* Attachment button */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="p-2 text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
            title="Gửi ảnh/video"
          >
            <FaPaperclip className="w-5 h-5" />
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,video/*"
            onChange={handleFileSelect}
            className="hidden"
          />

          {/* Appointment button */}
          <button
            type="button"
            onClick={() => setShowAppointmentModal(true)}
            className="p-2 text-blue-600 hover:bg-blue-50 rounded-full transition-colors"
            title="Gửi lịch hẹn"
          >
            <FaCalendarAlt className="w-5 h-5" />
          </button>

          <textarea
            value={newMessage}
            onChange={(e) => {
              setNewMessage(e.target.value);
              handleTyping();
            }}
            onKeyPress={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage(e);
              }
            }}
            placeholder="Nhập tin nhắn..."
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent resize-none"
            rows="1"
            style={{ minHeight: '40px', maxHeight: '120px' }}
          />
          <button
            type="submit"
            disabled={!newMessage.trim() || sending}
            className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
          >
            <FaPaperPlane />
          </button>
        </form>
      </div>

      {/* Modals */}
      <AppointmentSelectorModal
        isOpen={showAppointmentModal}
        onClose={() => setShowAppointmentModal(false)}
        onSelect={handleSendAppointment}
        otherUserId={receiverId}
      />

      <MediaPreviewModal
        isOpen={showMediaPreview}
        media={selectedMedia}
        onClose={() => {
          if (selectedMedia?.preview) {
            URL.revokeObjectURL(selectedMedia.preview);
          }
          setShowMediaPreview(false);
          setSelectedMedia(null);
          setMediaCaption('');
        }}
        onSend={handleSendMedia}
        caption={mediaCaption}
        setCaption={setMediaCaption}
        uploading={uploading}
      />
    </div>
  );
};

export default ChatWindow;

