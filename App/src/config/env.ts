// Environment variables loader
// This file loads environment variables from .env file using react-native-dotenv
// The babel plugin will transform the @env import at build time

// Import from @env - react-native-dotenv babel plugin transforms this
// @ts-ignore - @env is provided by babel plugin transformation
import {
  VITE_GOOGLE_CLIENT_ID,
  VITE_FACEBOOK_APP_ID,
} from '@env';

// Export with fallback to empty strings
export const ENV_GOOGLE_CLIENT_ID = VITE_GOOGLE_CLIENT_ID || '';
export const ENV_FACEBOOK_APP_ID = VITE_FACEBOOK_APP_ID || '';

