import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Default host for development. For Android emulator use 10.0.2.2 to reach host machine.
// For physical devices via USB with adb reverse, use localhost
// For physical devices via WiFi, use the actual IP address of the development machine
// For Expo Go, try 10.0.2.2 for Android emulator, or use your machine's IP for physical devices
const getDefaultHost = () => {
  if (Platform.OS === 'android') {
    // Check if running on Android emulator
    // Expo Go on Android emulator typically needs 10.0.2.2
    // You can also check Constants.executionEnvironment === 'standalone' for production builds
    return '10.0.2.2'; // Android emulator special IP
  }
  return 'localhost'; // iOS simulator or when using adb reverse
};

const DEFAULT_HOST = getDefaultHost();
const DEFAULT_PORT = 5000;

// If you need to override these for production or device testing,
// replace the values below or create a small config setup to inject them.
let API_HOST = DEFAULT_HOST;
let API_PORT = '5000';

const STORAGE_KEY = 'api_host_config_v1';

export const initApiHostFromStorage = async (): Promise<boolean> => {
  try {
    // Use default host based on platform
    API_HOST = DEFAULT_HOST;
    API_PORT = '5000';
    console.log('[config] Initialized API host to:', API_HOST, 'port:', API_PORT, '(Platform:', Platform.OS + ')');
    return true;
  } catch {
    // ignore
    return false;
  }
};

export const setApiHost = (host: string, port?: string) => {
  API_HOST = host;
  if (port) API_PORT = port;
  try {
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ host: API_HOST, port: API_PORT }));
  } catch {
    // ignore
  }
};

export const clearApiHost = async () => {
  try {
    await AsyncStorage.removeItem(STORAGE_KEY);
    // Force reset to default host for platform
    API_HOST = DEFAULT_HOST;
    API_PORT = '5000';
    console.log('[config] Cleared API host cache, reset to:', API_HOST, 'port:', API_PORT, '(Platform:', Platform.OS + ')');
  } catch {
    // ignore
  }
};

// Force reset to default host (useful for debugging network issues)
export const resetApiHost = () => {
  API_HOST = DEFAULT_HOST;
  API_PORT = '5000';
  console.log('[config] Reset API host to default:', API_HOST, 'port:', API_PORT, '(Platform:', Platform.OS + ')');
};

export const API_BASE = () => `http://${API_HOST}:${API_PORT}/api`;

// Social auth keys (optional). Replace with your keys if available.
// Google OAuth Client IDs - tạo riêng cho từng platform trong Google Cloud Console
// iOS: Tạo OAuth client type "iOS" với Bundle ID: com.trant.myapp
// Android: Tạo OAuth client type "Android" với Package name: com.trant.myapp
// Web: Tạo OAuth client type "Web application" (nếu cần)
export const GOOGLE_IOS_CLIENT_ID = '402239772340-emei5hhsjp5tsj0af438ksflfkqci968.apps.googleusercontent.com'; // Thay bằng iOS Client ID từ Google Console
export const GOOGLE_ANDROID_CLIENT_ID = '402239772340-fige4kk3j0idm93g7ueh2htqf89ehc0m.apps.googleusercontent.com'; // Thay bằng Android Client ID từ Google Console
export const GOOGLE_WEB_CLIENT_ID = '268729645043-lk8nqhbiah46aqmqca9154j6gilc0nkb.apps.googleusercontent.com'; // Web Client ID (hiện tại)

// Helper function to get the correct client ID based on platform
export const getGoogleClientId = (): string => {
  if (Platform.OS === 'ios') {
    return GOOGLE_IOS_CLIENT_ID || GOOGLE_WEB_CLIENT_ID;
  } else if (Platform.OS === 'android') {
    return GOOGLE_ANDROID_CLIENT_ID || GOOGLE_WEB_CLIENT_ID;
  }
  return GOOGLE_WEB_CLIENT_ID; // Default to web client ID
};

// Legacy export for backward compatibility (will use web client ID by default)
// Use getGoogleClientId() instead for platform-specific client IDs
export const GOOGLE_CLIENT_ID = GOOGLE_WEB_CLIENT_ID;

export const FACEBOOK_APP_ID = '3561947047432184';

export default {
  API_BASE,
  setApiHost,
  clearApiHost,
  resetApiHost,
  GOOGLE_CLIENT_ID,
  FACEBOOK_APP_ID,
};
