import React, { useState, useRef, useEffect } from 'react';
import { FaComments, FaTimes, FaPaperPlane } from 'react-icons/fa';
import api from '../utils/api';

const ChatWidget = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState(() => [
    {
      role: 'assistant',
      content: 'Xin chào! Tôi có thể giúp gì cho bạn?',
      createdAt: new Date().toISOString()
    }
  ]);
  const [sending, setSending] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const messagesEndRef = useRef(null);

  const formatTimestamp = (timestamp) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleString('vi-VN', {
      hour: '2-digit',
      minute: '2-digit',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  // Load lịch sử chat khi mở widget lần đầu (nếu user đã đăng nhập)
  useEffect(() => {
    const loadChatHistory = async () => {
      // Chỉ load nếu chưa load và widget đang mở
      if (!historyLoaded && isOpen) {
        setLoadingHistory(true);
        try {
          const { data } = await api.get('/ai/chat-history');
          if (data.success && Array.isArray(data.data) && data.data.length > 0) {
            setMessages(data.data);
          }
          setHistoryLoaded(true);
        } catch (err) {
          // Nếu lỗi (có thể do chưa đăng nhập), giữ nguyên tin nhắn mặc định
          console.log('Không thể tải lịch sử chat:', err.message);
          setHistoryLoaded(true);
        } finally {
          setLoadingHistory(false);
        }
      }
    };

    loadChatHistory();
  }, [isOpen, historyLoaded]);

  useEffect(() => {
    if (isOpen && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [isOpen, messages]);

  const handleToggle = () => {
    setIsOpen((prev) => {
      // Khi đóng widget, reset historyLoaded để load lại khi mở lại
      if (prev) {
        setHistoryLoaded(false);
      }
      return !prev;
    });
  };

  const handleSend = async (e) => {
    e.preventDefault();
    const text = message.trim();
    if (!text || sending) return;
    const timestamp = new Date().toISOString();
    const newUserMsg = { role: 'user', content: text, createdAt: timestamp };
    setMessages((prev) => [...prev, newUserMsg]);
    setMessage('');
    setSending(true);

    try {
      const { data } = await api.post('/ai/gemini-chat', {
        messages: [...messages, newUserMsg]
          .slice(-10)
          .map(({ role, content }) => ({ role, content }))
      });
      const reply = data?.data?.text || 'Xin lỗi, hiện không nhận được phản hồi.';
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: reply, createdAt: new Date().toISOString() }
      ]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: 'Có lỗi khi kết nối máy chủ AI.',
          createdAt: new Date().toISOString()
        }
      ]);
    } finally {
      setSending(false);
      if (messagesEndRef.current) messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div>
      {/* Floating chat button */}
      <button
        aria-label="Chatbot"
        onClick={handleToggle}
        className="fixed bottom-4 right-20 sm:bottom-8 sm:right-24 z-[1100] bg-blue-600 hover:bg-blue-700 text-white w-14 h-14 sm:w-16 sm:h-16 rounded-full shadow-lg flex items-center justify-center transition-colors"
        title="Chat với chúng tôi"
      >
        {isOpen ? <FaTimes className="w-6 h-6" /> : <FaComments className="w-7 h-7" />}
      </button>

      {/* Chat panel */}
      {isOpen && (
        <div className="fixed bottom-24 right-20 sm:bottom-28 sm:right-24 z-[1100] w-[92vw] max-w-sm sm:max-w-md bg-white rounded-xl shadow-2xl border border-gray-100 overflow-hidden">
          {/* Header */}
          <div className="bg-blue-600 text-white px-4 py-3 flex items-center justify-between">
            <div className="font-semibold">Trợ lý tư vấn</div>
            <button
              aria-label="Đóng"
              onClick={handleToggle}
              className="p-1 rounded hover:bg-white/10"
            >
              <FaTimes />
            </button>
          </div>

          {/* Messages area */}
          <div className="h-72 p-4 bg-gray-50 overflow-y-auto space-y-3">
            {loadingHistory ? (
              <div className="flex justify-center items-center py-4">
                <div className="text-sm text-gray-500">Đang tải lịch sử chat...</div>
              </div>
            ) : (
              <>
                {messages.map((m, idx) => {
                  const isUser = m.role === 'user';
                  return (
                    <div
                      key={`${m.createdAt || idx}-${idx}`}
                      className={`max-w-[85%] px-3 py-2 rounded-lg text-sm ${
                        isUser
                          ? 'bg-blue-600 text-white ml-auto'
                          : 'bg-white text-gray-800 border border-gray-200'
                      }`}
                    >
                      <div>{m.content}</div>
                      {m.createdAt && (
                        <div
                          className={`mt-1 text-xs ${isUser ? 'text-blue-100 text-right' : 'text-gray-400'}`}
                        >
                          {formatTimestamp(m.createdAt)}
                        </div>
                      )}
                    </div>
                  );
                })}
                {sending && (
                  <div className="max-w-[70%] px-3 py-2 rounded-lg text-sm bg-white text-gray-800 border border-gray-200">
                    Đang soạn phản hồi...
                  </div>
                )}
              </>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <form onSubmit={handleSend} className="border-t border-gray-200 p-3 flex items-center gap-2 bg-white">
            <input
              type="text"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Nhập tin nhắn..."
              className="flex-1 px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button 
              type="submit"
              className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-lg flex items-center gap-2"
            >
              <FaPaperPlane />
              <span className="hidden sm:inline">Gửi</span>
            </button>
          </form>
        </div>
      )}
    </div>
  );
};

export default ChatWidget;