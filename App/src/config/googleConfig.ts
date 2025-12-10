// Google Sign-In configuration for Expo
// Using expo-auth-session for Expo Go compatibility

import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';
import { getGoogleClientId } from './index';

// Complete the auth session properly
WebBrowser.maybeCompleteAuthSession();

// Google OAuth configuration
const discovery = {
  authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
  tokenEndpoint: 'https://www.googleapis.com/oauth2/v4/token',
  revocationEndpoint: 'https://oauth2.googleapis.com/revoke',
};

export const configureGoogleSignIn = () => {
  // No configuration needed for expo-auth-session
  console.log('[Google Sign-In] Using expo-auth-session for Google OAuth');
};

export interface GoogleSignInResult {
  idToken?: string;
  accessToken?: string;
  userInfo?: {
    email?: string;
    name?: string;
    picture?: string;
  };
}

export const signInWithGoogle = async (): Promise<GoogleSignInResult> => {
  try {
    // Make redirect URI - Expo will handle the proxy automatically
    const redirectUri = AuthSession.makeRedirectUri({
      scheme: 'app',
      path: 'auth',
    });

    // Get the correct client ID for the current platform
    const clientId = getGoogleClientId();

    console.log('[Google Sign-In] Platform:', Platform.OS);
    console.log('[Google Sign-In] Redirect URI:', redirectUri);
    console.log('[Google Sign-In] Client ID:', clientId);

    // Use code flow (recommended by Google)
    const request = new AuthSession.AuthRequest({
      clientId: clientId,
      scopes: ['openid', 'profile', 'email'],
      responseType: AuthSession.ResponseType.Code,
      redirectUri,
      extraParams: {
        access_type: 'offline',
        prompt: 'consent',
      },
    });

    // Get the authorization URL
    const authUrl = await request.makeAuthUrlAsync(discovery);
    console.log('[Google Sign-In] Full Auth URL:', authUrl);

    // Open the browser for authentication
    const result = await WebBrowser.openAuthSessionAsync(
      authUrl,
      redirectUri
    );

    console.log('[Google Sign-In] Result type:', result.type);
    console.log('[Google Sign-In] Result:', JSON.stringify(result, null, 2));

    if (result.type === 'success') {
      // Get URL from result - it might be in different properties depending on the result type
      const resultUrl = (result as any).url || (result as any).targetUrl;
      
      if (!resultUrl) {
        throw new Error('No URL in authentication result');
      }

      console.log('[Google Sign-In] Result URL:', resultUrl);

      // Parse the URL to get the authorization code
      const url = new URL(resultUrl);
      const code = url.searchParams.get('code');
      const error = url.searchParams.get('error');
      const errorDescription = url.searchParams.get('error_description');

      if (error) {
        throw new Error(`Google OAuth error: ${error} - ${errorDescription || ''}`);
      }

      if (!code) {
        throw new Error('No authorization code received from Google');
      }

      console.log('[Google Sign-In] Received authorization code, exchanging for tokens...');

      // Exchange authorization code for tokens
      // Note: For mobile apps without client secret, we need to use Expo's proxy
      // or send the code to backend to exchange
      try {
        // Try using Expo's proxy first (if available)
        const tokenResponse = await AuthSession.exchangeCodeAsync(
          {
            clientId: clientId,
            code: code,
            redirectUri,
            extraParams: {},
          },
          discovery
        );

        console.log('[Google Sign-In] Token exchange successful');

        const { idToken, accessToken } = tokenResponse;

        if (!idToken && !accessToken) {
          throw new Error('No tokens received from Google');
        }

        // If we have an access token, we can fetch user info
        let userInfo;
        if (accessToken) {
          try {
            const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
              headers: {
                Authorization: `Bearer ${accessToken}`,
              },
            });
            userInfo = await userInfoResponse.json();
          } catch (e) {
            console.warn('Failed to fetch user info:', e);
          }
        }

        return {
          idToken: idToken || undefined,
          accessToken: accessToken || undefined,
          userInfo: userInfo ? {
            email: userInfo.email,
            name: userInfo.name,
            picture: userInfo.picture,
          } : undefined,
        };
      } catch (exchangeError: any) {
        console.error('[Google Sign-In] Token exchange error:', exchangeError);
        // If token exchange fails, it might be because we need client secret
        // For mobile apps, try using the code directly with backend
        throw new Error(`Token exchange failed: ${exchangeError.message || exchangeError}. You may need to configure client secret or use backend proxy.`);
      }
    } else if (result.type === 'cancel') {
      throw new Error('User cancelled Google Sign-In');
    } else {
      throw new Error(`Google Sign-In failed: ${result.type}`);
    }
  } catch (error: any) {
    console.error('Google Sign-In Error:', error);
    throw error;
  }
};

export const signOutGoogle = async () => {
  // expo-auth-session doesn't maintain a session, so no sign out needed
  console.log('[Google Sign-In] Sign out completed');
};

export const isGoogleSignInEnabled = () => true; // Always available with expo-auth-session







