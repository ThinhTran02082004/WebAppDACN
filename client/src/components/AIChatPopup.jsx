import React, { useState, useEffect, useRef } from 'react';
import { FaRobot, FaTimes, FaPaperPlane, FaTrash } from 'react-icons/fa';
import api from '../utils/api';
import { toast } from 'react-toastify';
import './AIChatPopup.css';

const AIChatPopup = ({ isOpen: controlledOpen, onClose }) => {
    const isControlled = typeof controlledOpen === 'boolean';
    const [internalOpen, setInternalOpen] = useState(false);
    const isOpen = isControlled ? controlledOpen : internalOpen;
    const createWelcomeMessage = () => ({
        role: 'assistant',
        content: 'Xin chào! Tôi là trợ lý đặt lịch khám. Tôi có thể giúp bạn:\n\n• Tìm bác sĩ và chuyên khoa\n• Đặt lịch khám\n• Tư vấn về dịch vụ y tế\n• Trả lời câu hỏi về sức khỏe\n\nBạn cần hỗ trợ gì?',
        createdAt: new Date().toISOString()
    });
    const [messages, setMessages] = useState(() => [createWelcomeMessage()]);
    const [inputMessage, setInputMessage] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [sessionId, setSessionId] = useState(null);
    const messagesEndRef = useRef(null);
    const inputRef = useRef(null);

    // Auto scroll to bottom when new messages arrive
    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    // Focus input when popup opens
    useEffect(() => {
        if (isOpen && inputRef.current) {
            inputRef.current.focus();
        }
    }, [isOpen]);

    const handleClose = () => {
        if (isControlled) {
            onClose?.();
        } else {
            setInternalOpen(false);
        }
    };

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    // Reset conversation each time popup is opened
    useEffect(() => {
        if (isOpen) {
            setMessages([createWelcomeMessage()]);
            setSessionId(null);
        }
    }, [isOpen]);

    const handleSendMessage = async (e) => {
        e.preventDefault();

        if (!inputMessage.trim() || isLoading) return;

        const userMessage = {
            role: 'user',
            content: inputMessage.trim(),
            createdAt: new Date().toISOString()
        };

        // Add user message to chat
        setMessages(prev => [...prev, userMessage]);
        setInputMessage('');
        setIsLoading(true);

        try {
            const response = await api.post('/ai/gemini-chat', {
                prompt: userMessage.content,
                messages: messages,
                sessionId: sessionId
            });

            if (response.data.success) {
                // Update session ID if provided
                if (response.data.sessionId) {
                    setSessionId(response.data.sessionId);
                }

                // Add AI response to chat
                const aiMessage = {
                    role: 'assistant',
                    content: response.data.data.text,
                    createdAt: new Date().toISOString()
                };
                setMessages(prev => [...prev, aiMessage]);
            } else {
                toast.error('Không thể gửi tin nhắn. Vui lòng thử lại.');
            }
        } catch (error) {
            console.error('Error sending message:', error);
            toast.error(error.response?.data?.message || 'Đã xảy ra lỗi khi gửi tin nhắn');

            // Add error message
            const errorMessage = {
                role: 'assistant',
                content: 'Xin lỗi, đã có lỗi xảy ra. Vui lòng thử lại sau.',
                createdAt: new Date().toISOString()
            };
            setMessages(prev => [...prev, errorMessage]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleClearChat = () => {
        setMessages([createWelcomeMessage()]);
        setSessionId(null);
        toast.success('Đã bắt đầu cuộc trò chuyện mới');
    };

    const formatTime = (timestamp) => {
        const date = new Date(timestamp);
        return date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
    };

    return (
        <>
            {/* Floating Chat Button */}
            {!isOpen && !isControlled && (
                <button
                    onClick={() => setInternalOpen(true)}
                    className="fixed bottom-6 right-6 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-full px-4 py-3 shadow-lg hover:shadow-xl ai-chat-button z-50 flex items-center gap-3"
                    aria-label="Mở trợ lý đặt lịch khám"
                >
                    <span className="relative inline-flex">
                        <FaRobot className="text-2xl" />
                        <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center animate-pulse">
                            AI
                        </span>
                    </span>
                    <span className="text-sm font-semibold text-white whitespace-nowrap">
                        Trợ lý đặt lịch khám
                    </span>
                </button>
            )}

            {/* Chat Popup Window */}
            {isOpen && (
                <div className="fixed bottom-24 right-6 w-96 h-[600px] bg-white rounded-2xl shadow-2xl flex flex-col z-50 ai-chat-popup" data-tour="ai-chat-popup">
                    {/* Header */}
                    <div className="bg-gradient-to-r from-blue-500 to-purple-600 text-white p-4 rounded-t-2xl flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="relative">
                                <FaRobot className="text-2xl" />
                                <span className="absolute -bottom-1 -right-1 w-3 h-3 bg-green-400 rounded-full border-2 border-white"></span>
                            </div>
                            <div>
                                <h3 className="font-semibold text-white">Trợ lý đặt lịch khám</h3>
                                <p className="text-xs opacity-90">Luôn sẵn sàng hỗ trợ</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={handleClearChat}
                                className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                                title="Xóa lịch sử chat"
                            >
                                <FaTrash className="text-sm" />
                            </button>
                            <button
                                onClick={handleClose}
                                className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                                aria-label="Đóng chat"
                            >
                                <FaTimes className="text-xl" />
                            </button>
                        </div>
                    </div>

                    {/* Messages Container */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50 ai-chat-messages" data-tour="ai-chat-messages">
                        {messages.map((message, index) => (
                            <div
                                key={index}
                                className={`flex message-item ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                            >
                                <div
                                    className={`max-w-[80%] rounded-2xl px-4 py-2 ${message.role === 'user'
                                        ? 'bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-br-none'
                                        : 'bg-white text-gray-800 shadow-md rounded-bl-none'
                                        }`}
                                >
                                    {message.role === 'assistant' && (
                                        <div className="flex items-center gap-2 mb-1">
                                            <FaRobot className="text-blue-500 text-sm" />
                                            <span className="text-xs font-semibold text-white bg-gradient-to-r from-blue-500 to-purple-600 px-2 py-0.5 rounded-full">Trợ lý đặt lịch khám</span>
                                        </div>
                                    )}
                                    <p className="text-sm whitespace-pre-wrap break-words">{message.content}</p>
                                    <p className={`text-xs mt-1 ${message.role === 'user' ? 'text-white/70' : 'text-gray-400'}`}>
                                        {formatTime(message.createdAt)}
                                    </p>
                                </div>
                            </div>
                        ))}

                        {/* Loading indicator */}
                        {isLoading && (
                            <div className="flex justify-start">
                                <div className="bg-white rounded-2xl rounded-bl-none px-4 py-3 shadow-md">
                                    <div className="flex items-center gap-2">
                                        <FaRobot className="text-blue-500 text-sm" />
                                        <div className="flex gap-1">
                                            <span className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"></span>
                                            <span className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></span>
                                            <span className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        <div ref={messagesEndRef} />
                    </div>

                    {/* Input Form */}
                    <form onSubmit={handleSendMessage} className="p-4 bg-white border-t rounded-b-2xl">
                        <div className="flex gap-2">
                            <input
                                ref={inputRef}
                                type="text"
                                value={inputMessage}
                                onChange={(e) => setInputMessage(e.target.value)}
                                placeholder="Nhập tin nhắn..."
                                className="flex-1 px-4 py-2 border border-gray-300 rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ai-chat-input"
                                disabled={isLoading}
                                data-tour="ai-chat-input"
                            />
                            <button
                                type="submit"
                                disabled={isLoading || !inputMessage.trim()}
                                className="bg-gradient-to-r from-blue-500 to-purple-600 text-white p-3 rounded-full hover:shadow-lg transform hover:scale-105 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none ai-chat-send-button"
                                aria-label="Gửi tin nhắn"
                                data-tour="ai-chat-send-button"
                            >
                                <FaPaperPlane />
                            </button>
                        </div>
                        <p className="text-xs text-gray-400 mt-2 text-center">
                            AI có thể mắc lỗi. Vui lòng kiểm tra thông tin quan trọng.
                        </p>
                    </form>
                </div>
            )}


        </>
    );
};

export default AIChatPopup;
