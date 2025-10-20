import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiService } from '../services/api';

type User = any;

type AuthContextData = {
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string, rememberMe?: boolean) => Promise<void>;
  signInWithGoogle: (token: string, tokenType?: 'idToken' | 'accessToken', rememberMe?: boolean) => Promise<void>;
  signOut: () => Promise<void>;
  signUp: (data: any) => Promise<void>;
  resendVerification: (email: string) => Promise<void>;
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
          const res = await apiService.getCurrentUser();
          if (res.success) setUser(res.data || null);
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

  const resendVerification = async (email: string) => {
    const res = await apiService.resendVerification(email);
    if (!res.success) throw new Error(res.message || 'Resend verification failed');
  };

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signOut, signUp, resendVerification, signInWithGoogle }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
