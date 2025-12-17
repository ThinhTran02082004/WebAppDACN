import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiService } from '../services/api';

type User = any;

type AuthContextData = {
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string, rememberMe?: boolean) => Promise<void>;
  signInWithGoogle: (token: string, tokenType?: 'idToken' | 'accessToken', rememberMe?: boolean) => Promise<void>;
  signInWithFacebook: (accessToken: string, userID: string, rememberMe?: boolean) => Promise<void>;
  signOut: () => Promise<void>;
  signUp: (data: any) => Promise<void>;
  resendVerification: (email: string) => Promise<void>;
  updateUser: (userData: User) => void;
};

const AuthContext = createContext<AuthContextData>({} as AuthContextData);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadFromStorage = async () => {
      try {
        const token = await AsyncStorage.getItem('token');
        if (token) {
          // set token in apiService so subsequent requests include Authorization header
          apiService.setToken(token);
          // Optionally fetch current user
          try {
            const res = await apiService.getCurrentUser();
            if (res.success) {
              setUser(res.data || null);
            } else {
              // Token may be invalid, clear it
              await AsyncStorage.removeItem('token');
              apiService.setToken(null);
              setUser(null);
            }
          } catch (error: any) {
            // If getCurrentUser fails with 401, token is expired
            if (error?.response?.status === 401) {
              await AsyncStorage.removeItem('token');
              apiService.setToken(null);
            }
            setUser(null);
          }
        }
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    };
    loadFromStorage();
  }, []);

  const signIn = async (email: string, password: string, rememberMe = false) => {
    try {
      const res = await apiService.login(email, password, rememberMe);
      if (res.success && res.data?.token) {
        // Persist token only when rememberMe is true
        if (rememberMe) await AsyncStorage.setItem('token', res.data.token);
        // always set in-memory token for immediate requests
        apiService.setToken(res.data.token);

        // fetch user
        const me = await apiService.getCurrentUser();
        if (me.success) setUser(me.data || null);
      } else {
        // server sometimes returns needVerification flag
        const err: any = new Error((res as any)?.message || 'Login failed');
        if ((res as any)?.needVerification) err.needVerification = true;
        throw err;
      }
    } catch (e: any) {
      // Handle different types of errors
      if (e?.response?.data) {
        // Server returned an error response
        const serverError = e.response.data;
        const err: any = new Error(serverError.message || 'Login failed');
        if (serverError.needVerification) err.needVerification = true;
        if (serverError.field) err.field = serverError.field;
        throw err;
      } else if (e?.message) {
        // Network or other error
        throw e;
      } else {
        // Unknown error
        throw new Error('Đăng nhập thất bại');
      }
    }
  };

  const signOut = async () => {
    await AsyncStorage.removeItem('token');
    apiService.setToken(null);
    setUser(null);
  };

  const signUp = async (data: any) => {
    const res = await apiService.register(data);
    if (!res.success) throw new Error(res.message || 'Register failed');
  };

  const signInWithGoogle = async (token: string, tokenType: 'idToken' | 'accessToken' = 'idToken', rememberMe = false) => {
    try {
      const res = await apiService.googleLogin(token, tokenType);
      if (res.success && res.data?.token) {
        if (rememberMe) await AsyncStorage.setItem('token', res.data.token);
        apiService.setToken(res.data.token);
        const me = await apiService.getCurrentUser();
        if (me.success) setUser(me.data || null);
      } else {
        throw new Error(res.message || 'Google login failed');
      }
    } catch (e) {
      throw e;
    }
  };

  const signInWithFacebook = async (accessToken: string, userID: string, rememberMe = false) => {
    try {
      // Validate inputs
      if (!accessToken || !userID) {
        throw new Error('Access token hoặc User ID không hợp lệ');
      }
      
      console.log('[AuthContext] Starting Facebook login with userID:', userID);
      const res = await apiService.facebookLogin(accessToken, userID);
      
      if (!res) {
        throw new Error('Không nhận được phản hồi từ server');
      }
      
      if (res.success && res.data?.token) {
        console.log('[AuthContext] Facebook login successful, setting token');
        try {
          if (rememberMe) {
            await AsyncStorage.setItem('token', res.data.token);
          }
          apiService.setToken(res.data.token);
        } catch (tokenError: any) {
          console.error('[AuthContext] Error setting token:', tokenError);
          // Continue even if token setting fails
        }
        
        console.log('[AuthContext] Fetching current user info');
        try {
          const me = await apiService.getCurrentUser();
          if (me.success && me.data) {
            console.log('[AuthContext] User info fetched, setting user:', me.data._id);
            setUser(me.data);
          } else {
            console.warn('[AuthContext] Failed to fetch user info, but login was successful');
            // Still consider login successful even if we can't fetch user info
          }
        } catch (userError: any) {
          console.error('[AuthContext] Error fetching user info:', userError);
          // Continue even if user fetch fails - token is set
        }
      } else {
        const errorMessage = res.message || 'Facebook login failed';
        console.error('[AuthContext] Facebook login failed:', errorMessage);
        throw new Error(errorMessage);
      }
    } catch (e: any) {
      console.error('[AuthContext] Facebook login error:', {
        message: e?.message,
        stack: e?.stack,
        response: e?.response?.data
      });
      // Re-throw with more context if needed
      if (e?.response?.data?.message) {
        throw new Error(e.response.data.message);
      } else if (e?.message) {
        throw e;
      } else {
        throw new Error('Đăng nhập Facebook thất bại. Vui lòng thử lại.');
      }
    }
  };

  const resendVerification = async (email: string) => {
    const res = await apiService.resendVerification(email);
    if (!res.success) throw new Error(res.message || 'Resend verification failed');
  };

  const updateUser = (userData: User) => {
    setUser(userData);
  };

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signOut, signUp, resendVerification, signInWithGoogle, signInWithFacebook, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
