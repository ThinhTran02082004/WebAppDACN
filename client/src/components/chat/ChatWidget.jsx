import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { FaComments, FaTimes, FaMinus } from 'react-icons/fa';
import ConversationList from './ConversationList';
import ChatWindow from './ChatWindow';
import { useNotification } from '../../context/NotificationContext';
import { useSocket } from '../../context/SocketContext';
import api from '../../utils/api';

const ChatWidget = ({ currentUserId }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [conversations, setConversations] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [loading, setLoading] = useState(false);
  const { messageUnreadCount, fetchMessageUnreadCount } = useNotification();
  const { socket, isConnected } = useSocket();
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Fetch conversations when widget opens
  useEffect(() => {
    if (isOpen && !isMinimized) {
      fetchConversations();
      // Refresh unread count when opening widget
      messageUnreadCount > 0 && fetchMessageUnreadCount();
    }
  }, [isOpen, isMinimized]);

  const fetchConversations = async () => {
    try {
      setLoading(true);
      const response = await api.get('/chat/conversations');
      if (response.data.success) {
        setConversations(response.data.data);
      }
    } catch (error) {
      console.error('Error fetching conversations:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectConversation = (conv) => {
    setSelectedConversation(conv);
  };

  const handleClose = () => {
    setIsOpen(false);
    setIsMinimized(false);
    setSelectedConversation(null);
    // Refresh unread count when closing
    fetchMessageUnreadCount();
  };

  const handleMinimize = () => {
    setIsMinimized(!isMinimized);
  };

  const handleBackToList = () => {
    setSelectedConversation(null);
    // Refresh conversations and unread count
    fetchConversations();
    fetchMessageUnreadCount();
  };

  if (!isMounted) return null;

  return createPortal(
    <>
      {/* Floating button */}
      {!isOpen && (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="fixed bottom-20 right-6 w-14 h-14 bg-primary text-white rounded-full shadow-lg hover:bg-primary-dark hover:scale-105 active:scale-95 transition-all duration-300 flex items-center justify-center animate-fade-in"
          style={{ zIndex: 1050 }}
        >
          <FaComments className="w-6 h-6" />
          {messageUnreadCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center animate-bounce">
              {messageUnreadCount > 9 ? '9+' : messageUnreadCount}
            </span>
          )}
        </button>
      )}

      {isOpen && (
        <div
          className={`fixed bottom-6 right-6 bg-white rounded-lg shadow-2xl transition-all duration-300 animate-slide-up max-md:fixed max-md:inset-0 max-md:w-full max-md:h-screen max-md:rounded-none max-md:bottom-0 max-md:right-0 w-[400px] ${
            isMinimized ? 'h-14' : 'h-[600px] max-md:h-screen'
          }`}
          style={{ zIndex: 1050 }}
        >
          {/* Header */}
          <div className="bg-primary text-white px-4 py-3 rounded-t-lg flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <FaComments className="w-5 h-5" />
              <h3 className="font-semibold">
                {selectedConversation ? 'Tin nhắn' : 'Trò chuyện'}
              </h3>
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={handleMinimize}
                className="text-white hover:bg-primary-dark rounded-full p-1 transition-colors"
              >
                <FaMinus className="w-4 h-4" />
              </button>
              <button
                onClick={handleClose}
                className="text-white hover:bg-primary-dark rounded-full p-1 transition-colors"
              >
                <FaTimes className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Content */}
          {!isMinimized && (
            <div className="h-[calc(100%-52px)] overflow-hidden">
              {loading ? (
                <div className="flex items-center justify-center h-full">
                  <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary"></div>
                </div>
              ) : selectedConversation ? (
                <div className="h-full flex flex-col">
                  {/* Back button for mobile */}
                  <button
                    onClick={handleBackToList}
                    className="lg:hidden px-4 py-2 text-primary hover:bg-gray-50 border-b border-gray-200 text-left"
                  >
                    ← Quay lại
                  </button>
                  <div className="flex-1 overflow-hidden">
                    <ChatWindow
                      conversation={selectedConversation}
                      currentUserId={currentUserId}
                      onClose={null} // Don't show close button in widget
                    />
                  </div>
                </div>
              ) : (
                <ConversationList
                  conversations={conversations}
                  onSelectConversation={handleSelectConversation}
                  selectedConversationId={null}
                  currentUserId={currentUserId}
                />
              )}
            </div>
          )}
        </div>
      )}
    </>
    , document.body
  );
};

export default ChatWidget;

