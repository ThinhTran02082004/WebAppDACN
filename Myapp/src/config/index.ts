import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Safely import environment variables with fallback to undefined
let ENV_GOOGLE_CLIENT_ID: string | undefined;
let ENV_FACEBOOK_APP_ID: string | undefined;

try {
  // Use require that works with babel plugin react-native-dotenv
  // The babel plugin will transform this at build time
  const envModule = require('@env');
  ENV_GOOGLE_CLIENT_ID = envModule.VITE_GOOGLE_CLIENT_ID;
  ENV_FACEBOOK_APP_ID = envModule.VITE_FACEBOOK_APP_ID;
} catch (error: any) {
  // If module can't be resolved (e.g., .env file missing or babel plugin not working),
  // set to undefined - app will still work but auth features may not function
  ENV_GOOGLE_CLIENT_ID = undefined;
  ENV_FACEBOOK_APP_ID = undefined;
}


const DEFAULT_HOST = Platform.OS === 'android' ? 'localhost' : 'localhost';
const DEFAULT_PORT = 5000;
let API_HOST = 'localhost'; 
let API_PORT = '5000';

const STORAGE_KEY = 'api_host_config_v1';

export const initApiHostFromStorage = async (): Promise<boolean> => {
  try {
    // Use localhost for USB connection with adb reverse
    API_HOST = 'localhost';
    API_PORT = '5000';
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
  } catch {
    // ignore
  }
};

// Force reset to default host (useful for debugging network issues)
export const resetApiHost = () => {
  API_HOST = 'localhost';
  API_PORT = '5000';
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
