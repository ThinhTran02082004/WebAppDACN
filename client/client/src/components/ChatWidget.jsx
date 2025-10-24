import React, { useState, useRef, useEffect } from 'react';
import { FaComments, FaTimes, FaPaperPlane } from 'react-icons/fa';
import api from '../utils/api';

const ChatWidget = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState([
    { role: 'assistant', content: 'Xin chào! Tôi có thể giúp gì cho bạn?' }
  ]);
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    if (isOpen && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [isOpen, messages]);

  const handleToggle = () => setIsOpen((prev) => !prev);

  const handleSend = async (e) => {
    e.preventDefault();
    const text = message.trim();
    if (!text || sending) return;
    const newUserMsg = { role: 'user', content: text };
    setMessages((prev) => [...prev, newUserMsg]);
    setMessage('');
    setSending(true);

    try {
      const { data } = await api.post('/ai/gemini-chat', {
        messages: [...messages, newUserMsg].slice(-10)
      });
      const reply = data?.data?.text || 'Xin lỗi, hiện không nhận được phản hồi.';
      setMessages((prev) => [...prev, { role: 'assistant', content: reply }]);
    } catch (err) {
      setMessages((prev) => [...prev, { role: 'assistant', content: 'Có lỗi khi kết nối máy chủ AI.' }]);
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
            {messages.map((m, idx) => (
              <div
                key={idx}
                className={`max-w-[85%] px-3 py-2 rounded-lg text-sm ${
                  m.role === 'user'
                    ? 'bg-blue-600 text-white ml-auto'
                    : 'bg-white text-gray-800 border border-gray-200'
                }`}
              >
                {m.content}
              </div>
            ))}
            {sending && (
              <div className="max-w-[70%] px-3 py-2 rounded-lg text-sm bg-white text-gray-800 border border-gray-200">
                Đang soạn phản hồi...
              </div>
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


