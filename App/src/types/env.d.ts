declare module '@env' {
  // Myapp only needs public IDs (not secrets)
  // Secrets are only used on the server
  // Using VITE_ prefix to match client naming convention
  export const VITE_GOOGLE_CLIENT_ID: string;
  export const VITE_FACEBOOK_APP_ID: string;
}

