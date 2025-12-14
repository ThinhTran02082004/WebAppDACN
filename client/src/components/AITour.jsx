import React, { useState, useEffect, createContext, useContext } from 'react';
import { TourProvider, useTour } from '@reactour/tour';
import { FaRobot, FaQuestionCircle, FaTimes } from 'react-icons/fa';
import { useAuth } from '../context/AuthContext';

// Create context for tour controls
const TourContext = createContext(null);

export const useTourContext = () => {
  const context = useContext(TourContext);
  return context;
};

// Tour steps configuration - using data-tour attributes
const getTourSteps = () => [
  {
    selector: '[data-tour="chat-dock-button"]',
    content: (
      <div className="p-4">
        <h3 className="font-bold text-lg mb-2 flex items-center gap-2">
          <FaRobot className="text-blue-500" />
          Chào mừng đến với Trợ lý AI
        </h3>
        <p className="text-gray-700 mb-2">
          Đây là nút mở menu chat. Bạn có thể truy cập nhiều dịch vụ hỗ trợ từ đây.
        </p>
        <p className="text-sm text-gray-600">
          Nhấn vào nút này để xem các tùy chọn có sẵn.
        </p>
      </div>
    ),
    position: 'top',
  },
  {
    selector: '[data-tour="ai-chat-menu-item"]',
    content: (
      <div className="p-4">
        <h3 className="font-bold text-lg mb-2 flex items-center gap-2">
          <FaRobot className="text-blue-500" />
          Trợ lý đặt lịch khám AI
        </h3>
        <p className="text-gray-700 mb-2">
          Tính năng này giúp bạn:
        </p>
        <ul className="list-disc list-inside text-sm text-gray-600 space-y-1 mb-2">
          <li>Tìm bác sĩ và chuyên khoa phù hợp</li>
          <li>Đặt lịch khám tự động</li>
          <li>Tư vấn về dịch vụ y tế</li>
          <li>Trả lời câu hỏi về sức khỏe</li>
        </ul>
        <p className="text-sm text-blue-600 font-medium">
          Nhấn vào đây để mở trợ lý AI!
        </p>
      </div>
    ),
    position: 'left',
  },
  {
    selector: '[data-tour="ai-chat-popup"]',
    content: ({ setIsOpen }) => (
      <div className="p-4">
        <h3 className="font-bold text-lg mb-2 flex items-center gap-2">
          <FaRobot className="text-blue-500" />
          Cửa sổ trò chuyện AI
        </h3>
        <p className="text-gray-700 mb-3">
          Đây là nơi bạn tương tác với trợ lý AI. Hãy thử gửi một câu hỏi đầu tiên.
        </p>
        <div className="bg-gray-50 rounded-lg p-3 mb-4">
          <p className="text-xs text-gray-500 mb-1">Gợi ý câu hỏi:</p>
          <p className="text-sm text-gray-700 font-medium">
            "Tôi muốn đặt lịch khám tim mạch"
          </p>
          <p className="text-sm text-gray-600 mt-1">
            hoặc "Tìm bác sĩ nội khoa"
          </p>
        </div>
        <button
          className="w-full px-4 py-2.5 rounded-lg bg-gradient-to-r from-blue-500 to-purple-600 text-white font-semibold hover:shadow-lg transform hover:scale-105 transition-all duration-200"
          onClick={() => {
            // Đóng tour
            setIsOpen(false);
            localStorage.setItem('ai-tour-completed', 'true');

            // Focus vào ô input và auto chèn câu mẫu
            setTimeout(() => {
              const input = document.querySelector('[data-tour="ai-chat-input"]');
              if (input) {
                const inputElement = input;
                inputElement.focus();
                // Chỉ chèn nếu input đang trống
                if (!inputElement.value || inputElement.value.trim() === '') {
                  inputElement.value = 'Tôi muốn đặt lịch khám';
                  // Trigger input event để React cập nhật state
                  const event = new Event('input', { bubbles: true });
                  inputElement.dispatchEvent(event);
                }
              }
            }, 200);
          }}
        >
          Bắt đầu chat
        </button>
      </div>
    ),
    position: 'center',
  },
];

// Tour button component
const TourButton = () => {
  const tourContext = useTourContext();
  const { isAuthenticated } = useAuth();

  const handleStartTour = async () => {
    // Reset tour completion status so user can see it again
    localStorage.removeItem('ai-tour-completed');
    
    // 1. Reset UI về trạng thái ban đầu trước (đợi hoàn thành)
    if (tourContext?.resetUIForTour) {
      await tourContext.resetUIForTour();
    }
    
    // 2. Reset về bước đầu tiên (QUAN TRỌNG!)
    if (tourContext?.setCurrentStep) {
      tourContext.setCurrentStep(0);
    }
    
    // 3. Mở tour sau một chút để đảm bảo UI đã reset xong
    setTimeout(() => {
      if (tourContext?.setIsOpen) {
        tourContext.setIsOpen(true);
      }
    }, 100);
  };

  // Chỉ hiển thị nút khi user đã đăng nhập
  if (!tourContext || !isAuthenticated) {
    return null; // Don't render if context not available or user not logged in
  }

  return (
    <button
      onClick={handleStartTour}
      className="fixed bottom-24 left-6 z-[1100] bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-full p-3 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-110 flex items-center gap-2 group"
      aria-label="Bắt đầu tour hướng dẫn"
      title="Hướng dẫn sử dụng AI"
    >
      <FaQuestionCircle className="text-xl" />
      <span className="text-sm font-medium pr-2 whitespace-nowrap">
        Hướng dẫn AI
      </span>
    </button>
  );
};

// Inner component that has access to tour controls
const TourContentInner = ({ children }) => {
  const { currentStep, setCurrentStep, setIsOpen, isOpen } = useTour();

  // Hàm reset UI về trạng thái ban đầu cho tour
  const resetUIForTour = async () => {
    // 1. Đóng AI chat popup trước (nếu đang mở)
    const aiPopup = document.querySelector('[data-tour="ai-chat-popup"]');
    if (aiPopup && aiPopup.offsetParent !== null) { // Kiểm tra popup có visible không
      // Tìm nút đóng trong popup - ưu tiên aria-label chính xác
      let closeButton = aiPopup.querySelector('button[aria-label="Đóng chat"]');
      
      // Fallback: tìm nút có FaTimes icon (thường là nút đóng)
      if (!closeButton) {
        const header = aiPopup.querySelector('.bg-gradient-to-r'); // Header của popup
        if (header) {
          const buttons = header.querySelectorAll('button');
          // Tìm nút có icon Times (thường là nút cuối cùng trong header)
          closeButton = Array.from(buttons).find(btn => {
            const svg = btn.querySelector('svg');
            return svg && (svg.getAttribute('data-icon') === 'times' || 
                          btn.getAttribute('aria-label')?.includes('Đóng'));
          });
        }
      }
      
      if (closeButton) {
        closeButton.click();
        // Đợi popup đóng xong
        await new Promise(resolve => setTimeout(resolve, 300));
      }
    }

    // 2. Đóng menu chat dock (nếu đang mở)
    const menuButton = document.querySelector('[data-tour="chat-dock-button"]');
    if (menuButton) {
      const menuContainer = menuButton.closest('.fixed');
      const menu = menuContainer?.querySelector('.animate-slide-up');
      if (menu && menu.offsetParent !== null) { // Kiểm tra menu có visible không
        // Menu đang mở, click để đóng
        menuButton.click();
        await new Promise(resolve => setTimeout(resolve, 300));
      }
    }

    // 3. Scroll về đầu trang để đảm bảo các element tour visible
    window.scrollTo({ top: 0, behavior: 'smooth' });

    // 4. Đợi thêm một chút để UI hoàn toàn ổn định
    await new Promise(resolve => setTimeout(resolve, 100));
  };

  // Listen for user interactions to auto-advance tour
  useEffect(() => {
    if (!isOpen) return;

    const handleChatDockClick = (e) => {
      const button = e.target.closest('[data-tour="chat-dock-button"]');
      if (button && currentStep === 0) {
        // User clicked the chat dock button, advance to next step after menu opens
        setTimeout(() => {
          setCurrentStep(1);
        }, 400);
      }
    };

    const handleAIMenuItemClick = (e) => {
      const button = e.target.closest('[data-tour="ai-chat-menu-item"]');
      if (button && currentStep === 1) {
       
        // User clicked the AI menu item, advance to next step after chat opens
        setTimeout(() => {
          setCurrentStep(2);
        }, 600);
      }
    };

    // Đóng tour khi user gửi tin nhắn đầu tiên
    const handleSendClick = (e) => {
      const sendBtn = e.target.closest('[data-tour="ai-chat-send-button"]');
      if (sendBtn && isOpen) {
        // Đóng tour và đánh dấu đã hoàn thành
        setIsOpen(false);
        localStorage.setItem('ai-tour-completed', 'true');
      }
    };

    // Lắng nghe sự kiện submit form (khi user nhấn Enter)
    const handleFormSubmit = (e) => {
      const form = e.target.closest('form');
      const input = form?.querySelector('[data-tour="ai-chat-input"]');
      if (input && input.value.trim() && isOpen) {
        // User đã nhập và gửi tin nhắn, đóng tour
        setIsOpen(false);
        localStorage.setItem('ai-tour-completed', 'true');
      }
    };

    // Add event listeners with capture to catch events early
    document.addEventListener('click', handleChatDockClick, true);
    document.addEventListener('click', handleAIMenuItemClick, true);
    document.addEventListener('click', handleSendClick, true);
    document.addEventListener('submit', handleFormSubmit, true);

    return () => {
      document.removeEventListener('click', handleChatDockClick, true);
      document.removeEventListener('click', handleAIMenuItemClick, true);
      document.removeEventListener('click', handleSendClick, true);
      document.removeEventListener('submit', handleFormSubmit, true);
    };
  }, [isOpen, currentStep, setCurrentStep, setIsOpen]);

  // Provide tour context to children
  const tourContextValue = {
    currentStep,
    setCurrentStep,
    isOpen,
    setIsOpen,
    resetUIForTour,
  };

  return (
    <TourContext.Provider value={tourContextValue}>
      {children}
      <TourButton />
    </TourContext.Provider>
  );
};

// Main tour component
const AITourContent = ({ children }) => {
  const handleTourComplete = () => {
    localStorage.setItem('ai-tour-completed', 'true');
  };

  return (
    <TourProvider
      steps={getTourSteps()}
      onRequestClose={handleTourComplete}
      onClickClose={({ setCurrentStep, currentStep, steps, setIsOpen }) => {
        if (currentStep === steps.length - 1) {
          handleTourComplete();
        }
        setIsOpen(false);
      }}
      onClickMask={({ setCurrentStep, currentStep, steps, setIsOpen }) => {
        if (currentStep === steps.length - 1) {
          handleTourComplete();
        }
        setIsOpen(false);
      }}
      beforeStep={async (stepIndex) => {
        // Open menu before showing AI menu item (step 1)
        if (stepIndex === 1) {
          const menuButton = document.querySelector('[data-tour="chat-dock-button"]');
          if (menuButton) {
            const menuContainer = menuButton.closest('.fixed');
            const menu = menuContainer?.querySelector('.animate-slide-up');
            if (!menu) {
              menuButton.click();
              await new Promise(resolve => setTimeout(resolve, 300));
            }
          }
        }
        
        // Open AI chat before showing final step (step 2 - bước cuối cùng)
        if (stepIndex === 2) {
          const aiMenuItem = document.querySelector('[data-tour="ai-chat-menu-item"]');
          if (aiMenuItem) {
            const popup = document.querySelector('[data-tour="ai-chat-popup"]');
            if (!popup) {
              aiMenuItem.click();
              await new Promise(resolve => setTimeout(resolve, 500));
            }
          }
        }
      }}
      styles={{
        popover: (base) => ({
          ...base,
          '--reactour-accent': '#3b82f6',
          borderRadius: '12px',
          padding: '0',
          maxWidth: '400px',
        }),
        maskArea: (base) => ({ ...base, rx: 8 }),
        badge: (base) => ({
          ...base,
          display: 'none', // Ẩn badge hiển thị số bước
        }),
        controls: (base) => ({
          ...base,
          marginTop: '1rem',
        }),
        close: (base) => ({
          ...base,
          right: '1rem',
          top: '1rem',
        }),
      }}
      className="reactour-tour"
    >
      <TourContentInner>
        {children}
      </TourContentInner>
    </TourProvider>
  );
};

// Export hook to access tour from outside
export const useAITour = () => {
  return useTourContext();
};

// Export wrapper component
const AITour = ({ children }) => {
  return (
    <AITourContent>
      {children}
    </AITourContent>
  );
};

export default AITour;

