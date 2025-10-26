import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import ConversationList from '../../components/chat/ConversationList';
import ChatWindow from '../../components/chat/ChatWindow';
import { useAuth } from '../../context/AuthContext';
import api from '../../utils/api';

const DoctorChat = () => {
  const { conversationId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [conversations, setConversations] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showMobileList, setShowMobileList] = useState(!conversationId);

  useEffect(() => {
    fetchConversations();
  }, []);

  useEffect(() => {
    if (conversationId && conversations.length > 0) {
      const conv = conversations.find(c => c.id === conversationId || c._id === conversationId);
      if (conv) {
        setSelectedConversation(conv);
        setShowMobileList(false);
      }
    }
  }, [conversationId, conversations]);

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
    setShowMobileList(false);
    navigate(`/doctor/chat/${conv.id || conv._id}`);
  };

  const handleBackToList = () => {
    setShowMobileList(true);
    setSelectedConversation(null);
    navigate('/doctor/chat');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Conversations list */}
      <div className={`w-full md:w-1/3 lg:w-1/4 bg-white ${showMobileList ? 'block' : 'hidden md:block'}`}>
        <div className="h-full flex flex-col">
          <div className="px-6 py-4 border-b border-gray-200">
            <h1 className="text-2xl font-bold text-gray-900">Tin nhắn</h1>
            <p className="text-sm text-gray-600">Trò chuyện với bệnh nhân</p>
          </div>
          <div className="flex-1 overflow-hidden">
            <ConversationList
              conversations={conversations}
              onSelectConversation={handleSelectConversation}
              selectedConversationId={conversationId}
              currentUserId={user?.id}
            />
          </div>
        </div>
      </div>

      {/* Chat window */}
      <div className={`flex-1 ${showMobileList ? 'hidden md:block' : 'block'}`}>
        {selectedConversation ? (
          <div className="h-full flex flex-col bg-white">
            {/* Mobile back button */}
            <button
              onClick={handleBackToList}
              className="md:hidden px-4 py-3 text-primary hover:bg-gray-50 border-b border-gray-200 text-left font-semibold"
            >
              ← Quay lại danh sách
            </button>
            <div className="flex-1 overflow-hidden">
              <ChatWindow
                conversation={selectedConversation}
                currentUserId={user?.id}
                onClose={null}
              />
            </div>
          </div>
        ) : (
          <div className="hidden md:flex items-center justify-center h-full bg-white">
            <div className="text-center text-gray-500">
              <svg
                className="mx-auto h-24 w-24 text-gray-400 mb-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                />
              </svg>
              <p className="text-xl font-semibold mb-2">Chọn một cuộc trò chuyện</p>
              <p className="text-sm">Chọn từ danh sách bên trái để bắt đầu trò chuyện với bệnh nhân</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DoctorChat;

