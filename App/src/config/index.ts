import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
// Import environment variables
// Note: Myapp only needs public IDs (not secrets) for SDK initialization
// Secrets (CLIENT_SECRET, APP_SECRET) are only needed on the server
// Using VITE_ prefix to match client naming convention
import { 
  ENV_GOOGLE_CLIENT_ID,
  ENV_FACEBOOK_APP_ID,
} from './env';

const DEFAULT_HOST = Platform.OS === 'android' ? 'localhost' : 'localhost';
const DEFAULT_PORT = 5000;

// If you need to override these for production or device testing,
// replace the values below or create a small config setup to inject them.
let API_HOST = 'localhost'; // Use localhost when connected via USB with adb reverse
let API_PORT = '5000';

const STORAGE_KEY = 'api_host_config_v1';

export const initApiHostFromStorage = async (): Promise<boolean> => {
  try {
    // Use localhost for USB connection with adb reverse
    API_HOST = 'localhost';
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
    // Force reset to localhost for USB connection
    API_HOST = 'localhost';
    API_PORT = '5000';
    console.log('[config] Cleared API host cache, reset to:', API_HOST, 'port:', API_PORT);
  } catch {
    // ignore
  }
};

// Force reset to default host (useful for debugging network issues)
export const resetApiHost = () => {
  API_HOST = 'localhost';
  API_PORT = '5000';
  console.log('[config] Reset API host to default:', API_HOST, 'port:', API_PORT);
};

export const API_BASE = () => `http://${API_HOST}:${API_PORT}/api`;

// Social auth keys from environment variables
// Myapp only needs public IDs for SDK initialization (not secrets)
// Secrets are only used on the server for token verification
export const GOOGLE_CLIENT_ID = ENV_GOOGLE_CLIENT_ID || '';
export const FACEBOOK_APP_ID = ENV_FACEBOOK_APP_ID || '';

// These are not needed in Myapp (only server needs them)
// export const GOOGLE_CLIENT_SECRET = ''; // Only server needs this
// export const FACEBOOK_APP_SECRET = ''; // Only server needs this

export default {
  API_BASE,
  setApiHost,
  clearApiHost,
  resetApiHost,
  GOOGLE_CLIENT_ID,
  FACEBOOK_APP_ID,
};
