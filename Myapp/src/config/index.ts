import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Default host for development. For Android emulator use 10.0.2.2 to reach host machine.
// For physical devices, use the actual IP address of the development machine
const DEFAULT_HOST = Platform.OS === 'android' ? '10.0.242.205' : 'localhost';
const DEFAULT_PORT = 5000;

// If you need to override these for production or device testing,
// replace the values below or create a small config setup to inject them.
let API_HOST = '10.0.242.205'; // Force use of correct IP address
let API_PORT = '5000';

const STORAGE_KEY = 'api_host_config_v1';

export const initApiHostFromStorage = async (): Promise<boolean> => {
  try {
    // Always use the correct IP address and port, ignore cached values
    API_HOST = '10.0.242.205';
    API_PORT = '5000';
    console.log('[config] Forced API host to:', API_HOST, 'port:', API_PORT);
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
    // Force reset to new IP address and port
    API_HOST = '10.0.242.205';
    API_PORT = '5000';
    console.log('[config] Cleared API host cache, reset to:', API_HOST, 'port:', API_PORT);
  } catch {
    // ignore
  }
};

// Force reset to default host (useful for debugging network issues)
export const resetApiHost = () => {
  API_HOST = '10.0.242.205';
  API_PORT = '5000';
  console.log('[config] Reset API host to default:', API_HOST, 'port:', API_PORT);
};

export const API_BASE = () => `http://${API_HOST}:${API_PORT}/api`;

// Social auth keys (optional). Replace with your keys if available.
// Thay thế bằng Web Client ID từ Google Console
// Must match the Web client (client_type 3) in google-services.json
export const GOOGLE_CLIENT_ID = '268729645043-lk8nqhbiah46aqmqca9154j6gilc0nkb.apps.googleusercontent.com';
export const FACEBOOK_APP_ID = '3561947047432184';

export default {
  API_BASE,
  setApiHost,
  clearApiHost,
  resetApiHost,
  GOOGLE_CLIENT_ID,
  FACEBOOK_APP_ID,
};
