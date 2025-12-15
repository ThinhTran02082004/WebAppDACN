import React, { createContext, useContext, useState, useEffect } from 'react';

const ThemeContext = createContext();

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

export const ThemeProvider = ({ children }) => {
  // Kiểm tra ngày hiện tại để xác định theme mặc định
  const getDefaultTheme = () => {
    const now = new Date();
    const month = now.getMonth() + 1; // 1-12
    const day = now.getDate();
    
    // Trước 31/12: Giáng sinh
    if (month === 12 && day <= 31) {
      return 'christmas';
    }
    return 'normal';
  };

  // Lấy theme từ localStorage hoặc dùng theme mặc định
  const [theme, setTheme] = useState(() => {
    const savedTheme = localStorage.getItem('festiveTheme');
    if (savedTheme) {
      return savedTheme;
    }
    return getDefaultTheme();
  });

  const [isEnabled, setIsEnabled] = useState(() => {
    const saved = localStorage.getItem('festiveThemeEnabled');
    return saved ? saved === 'true' : true;
  });

  // Tự động chuyển đổi theme dựa trên ngày
  useEffect(() => {
    const checkDate = () => {
      const defaultTheme = getDefaultTheme();
      const savedTheme = localStorage.getItem('festiveTheme');
      
      // Nếu không có theme được lưu, tự động chuyển đổi
      if (!savedTheme) {
        setTheme(defaultTheme);
      }
    };

    checkDate();
    // Kiểm tra mỗi ngày
    const interval = setInterval(checkDate, 24 * 60 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const toggleTheme = (newTheme) => {
    setTheme(newTheme);
    localStorage.setItem('festiveTheme', newTheme);
  };

  const toggleEnabled = (enabled) => {
    setIsEnabled(enabled);
    localStorage.setItem('festiveThemeEnabled', enabled.toString());
  };

  const value = {
    theme,
    isEnabled,
    toggleTheme,
    toggleEnabled,
    getDefaultTheme
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};

