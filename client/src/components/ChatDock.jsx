import React, { useState } from 'react';
import { FaChevronUp, FaRobot, FaComments, FaCalendarAlt, FaPhoneAlt } from 'react-icons/fa';
import AIChatPopup from './AIChatPopup';
import ChatWidget from './chat/ChatWidget';

const ChatDock = ({ showSupportChat, currentUserId }) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [activePanel, setActivePanel] = useState(null); // 'ai' | 'support' | null
  const [showSchedulePopup, setShowSchedulePopup] = useState(false);
  const [showHotlinePopup, setShowHotlinePopup] = useState(false);

  const toggleMenu = () => {
    setMenuOpen((prev) => !prev);
  };

  const openPanel = (panel) => {
    if (panel === 'schedule') {
      setShowSchedulePopup(true);
      setActivePanel(null);
    } else if (panel === 'hotline') {
      setShowHotlinePopup(true);
      setActivePanel(null);
    } else {
      setActivePanel(panel);
    }
    setMenuOpen(false);
  };

  const closePanels = () => {
    setActivePanel(null);
  };

  const renderMenu = () => (
    <div className="flex flex-col gap-2 mb-3 bg-white shadow-2xl rounded-2xl p-3 border border-gray-100 animate-slide-up">
      <button
        onClick={() => openPanel('ai')}
        className="flex items-center gap-3 px-4 py-2 rounded-xl hover:bg-gray-100 transition-colors text-left"
      >
        <span className="inline-flex items-center justify-center w-9 h-9 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 text-white shadow">
          <FaRobot />
        </span>
        <div>
          <p className="font-semibold text-gray-800">Trợ lý đặt lịch khám</p>
          <p className="text-xs text-gray-500">Hỏi đáp & đặt lịch tự động</p>
        </div>
      </button>

      {showSupportChat && (
        <button
          onClick={() => openPanel('support')}
          className="flex items-center gap-3 px-4 py-2 rounded-xl hover:bg-gray-100 transition-colors text-left"
        >
          <span className="inline-flex items-center justify-center w-9 h-9 rounded-full bg-primary text-white shadow">
            <FaComments />
          </span>
          <div>
            <p className="font-semibold text-gray-800">Chat với nhân viên</p>
            <p className="text-xs text-gray-500">Trao đổi trực tiếp với CSKH</p>
          </div>
        </button>
      )}

      <button
        onClick={() => openPanel('schedule')}
        className="flex items-center gap-3 px-4 py-2 rounded-xl hover:bg-gray-100 transition-colors text-left"
      >
        <span className="inline-flex items-center justify-center w-9 h-9 rounded-full bg-emerald-500 text-white shadow">
          <FaCalendarAlt />
        </span>
        <div>
          <p className="font-semibold text-gray-800">Đặt lịch khám nhanh</p>
          <p className="text-xs text-gray-500">Chọn kênh đặt lịch phù hợp</p>
        </div>
      </button>

      <button
        onClick={() => openPanel('hotline')}
        className="flex items-center gap-3 px-4 py-2 rounded-xl hover:bg-gray-100 transition-colors text-left"
      >
        <span className="inline-flex items-center justify-center w-9 h-9 rounded-full bg-rose-500 text-white shadow">
          <FaPhoneAlt />
        </span>
        <div>
          <p className="font-semibold text-gray-800">Hotline 24/7</p>
          <p className="text-xs text-gray-500">Gọi trực tiếp hoặc nhắn Zalo</p>
        </div>
      </button>
    </div>
  );

  return (
    <>
      <div className="fixed bottom-6 right-6 z-[1200] flex flex-col items-end space-y-2">
        {menuOpen && renderMenu()}

        <button
          onClick={toggleMenu}
          className="w-14 h-14 rounded-full bg-white border border-gray-200 shadow-xl flex items-center justify-center hover:bg-gray-50 transition-all"
          aria-label="Mở menu chat"
        >
          <FaChevronUp className={`text-gray-700 transition-transform ${menuOpen ? 'rotate-180' : ''}`} />
        </button>
      </div>

      <AIChatPopup
        isOpen={activePanel === 'ai'}
        onClose={closePanels}
      />

      {showSupportChat && (
        <ChatWidget
          currentUserId={currentUserId}
          isOpen={activePanel === 'support'}
          onClose={closePanels}
        />
      )}

      {showSchedulePopup && (
        <QuickModal
          title="Đặt lịch khám nhanh"
          onClose={() => setShowSchedulePopup(false)}
        >
          <p className="text-sm text-gray-600">
            Chọn một cách để đặt lịch khám tiện lợi nhất cho bạn. Đội ngũ chăm sóc sẽ phản hồi ngay khi nhận được thông tin.
          </p>
          <div className="mt-4 space-y-3">
            <a
              href="/appointment"
              className="flex items-center justify-between border rounded-xl px-4 py-3 hover:border-emerald-500 transition-colors"
            >
              <div>
                <p className="font-semibold text-gray-800">Đặt lịch online</p>
                <p className="text-xs text-gray-500">Chọn bác sĩ, giờ khám và thanh toán</p>
              </div>
              <span className="text-emerald-500 text-sm font-semibold">Mở trang</span>
            </a>
            <button
              onClick={() => {
                navigator.clipboard?.writeText('booking@medpro.vn').catch(() => {});
              }}
              className="w-full text-left border rounded-xl px-4 py-3 hover:border-emerald-500 transition-colors"
            >
              <p className="font-semibold text-gray-800">Gửi yêu cầu qua email</p>
              <p className="text-xs text-gray-500">booking@medpro.vn</p>
            </button>
          </div>
        </QuickModal>
      )}

      {showHotlinePopup && (
        <QuickModal
          title="Hotline hỗ trợ 24/7"
          onClose={() => setShowHotlinePopup(false)}
        >
          <div className="space-y-4">
            <div className="border rounded-xl p-4">
              <p className="text-sm text-gray-500 uppercase">Tư vấn khám</p>
              <p className="text-2xl font-bold text-gray-800 mt-1">1900 636 373</p>
              <p className="text-xs text-gray-500 mt-1">Bấm phím 1</p>
            </div>
            <div className="border rounded-xl p-4">
              <p className="text-sm text-gray-500 uppercase">Hỗ trợ khẩn</p>
              <p className="text-2xl font-bold text-gray-800 mt-1">0909 123 456</p>
              <p className="text-xs text-gray-500 mt-1">Trực 24/7</p>
            </div>
            <button
              onClick={() => {
                window.open('https://zalo.me/0909123456', '_blank', 'noopener');
              }}
              className="w-full border border-rose-200 text-rose-600 font-semibold rounded-xl px-4 py-3 hover:bg-rose-50 transition-colors"
            >
              Nhắn Zalo hỗ trợ
            </button>
          </div>
        </QuickModal>
      )}
    </>
  );
};

const QuickModal = ({ title, onClose, children }) => (
  <div className="fixed inset-0 z-[1250] flex items-end md:items-center justify-center">
    <div className="absolute inset-0 bg-black/40" onClick={onClose} />
    <div className="relative bg-white w-full md:max-w-md rounded-t-3xl md:rounded-2xl p-6 shadow-2xl animate-slide-up">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
        <button
          onClick={onClose}
          className="text-gray-500 hover:text-gray-900 transition-colors"
          aria-label="Đóng"
        >
          ✕
        </button>
      </div>
      {children}
    </div>
  </div>
);

export default ChatDock;

