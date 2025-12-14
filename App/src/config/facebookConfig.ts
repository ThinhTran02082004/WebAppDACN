import { Platform } from 'react-native';
import { Settings } from 'react-native-fbsdk-next';
import { FACEBOOK_APP_ID } from './index';

export const configureFacebookSDK = () => {
  try {
    if (!FACEBOOK_APP_ID) {
      console.warn('[FacebookConfig] Facebook App ID is not configured. Please set VITE_FACEBOOK_APP_ID in your .env file.');
      return;
    }

    // ❗️ LƯU Ý QUAN TRỌNG: FACEBOOK_APP_ID phải được thiết lập trong AndroidManifest.xml và Info.plist.
    // Loại bỏ Settings.setAppID(FACEBOOK_APP_ID);

    // ✅ Bắt đầu thiết lập các tùy chọn khác an toàn
    // Cho phép tự động ghi lại các sự kiện (rất nên dùng)
    Settings.setAutoLogAppEventsEnabled(true);
    
    // Cho phép theo dõi quảng cáo (tùy chọn)
    Settings.setAdvertiserTrackingEnabled(true);

    console.log('[FacebookConfig] Facebook SDK đã được cấu hình các tùy chọn.');
    console.log('[FacebookConfig] App ID được cấu hình trong native (AndroidManifest.xml/Info.plist):', FACEBOOK_APP_ID);
  } catch (error) {
    // Nếu lỗi, khả năng cao là do native module không load được hoặc lỗi native.
    console.error('[FacebookConfig] Failed to configure Facebook SDK:', error);
  }
};