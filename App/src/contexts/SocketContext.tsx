import React, { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react';
import io, { Socket } from 'socket.io-client';
import { useAuth } from './AuthContext';
import { apiService } from '../services/api';
import { API_BASE } from '../config';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

// Get socket URL from API base URL
const getSocketUrl = (): string => {
  try {
    // Get API base URL from config
    const apiBase = typeof API_BASE === 'function' ? API_BASE() : API_BASE as string;
    // Remove /api suffix and return base URL for socket
    const socketUrl = apiBase.replace(/\/api\/?$/, '');
    console.log('[SocketContext] Socket URL from config:', socketUrl);
    return socketUrl;
  } catch (error) {
    // Fallback to default
    const baseUrl = Platform.OS === 'android' 
      ? "http://10.0.2.2:5000" 
      : "http://localhost:5000";
    console.log('[SocketContext] Using fallback socket URL:', baseUrl);
    return baseUrl;
  }
};

interface SocketContextData {
  socket: Socket | null;
  isConnected: boolean;
  emit: (event: string, data?: any) => void;
  on: (event: string, callback: (...args: any[]) => void) => void;
  off: (event: string, callback?: (...args: any[]) => void) => void;
  isUserOnline: (userId: string) => boolean;
  onlineUsers: string[];
}

const SocketContext = createContext<SocketContextData>({} as SocketContextData);

export const useSocket = () => useContext(SocketContext);

export const SocketProvider = ({ children }: { children: ReactNode }) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());
  const { user, loading: authLoading } = useAuth();
  const socketRef = useRef<Socket | null>(null);

  // Initialize socket connection
  useEffect(() => {
    // Wait for auth to finish loading
    if (authLoading) return;

    // Disconnect if user logs out
    if (!user) {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
        setSocket(null);
        setIsConnected(false);
      }
      setOnlineUsers(new Set());
      return;
    }

    const socketUrl = getSocketUrl();
    console.log('[SocketContext] Connecting to:', socketUrl);

    // Cleanup existing socket first
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
      setSocket(null);
      setIsConnected(false);
    }

    // Get JWT token
    const initializeSocket = async () => {
      try {
        // Try to get token from memory first (apiService), then fallback to AsyncStorage
        let token: string | null = null;
        
        // Check if token is in memory (apiService)
        const apiHeaders = (apiService as any).client?.defaults?.headers;
        const authHeader = apiHeaders?.Authorization;
        if (authHeader && typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
          token = authHeader.replace('Bearer ', '');
        }
        
        // Fallback to AsyncStorage if not in memory
        if (!token) {
          token = await AsyncStorage.getItem('token');
        }
        
        if (!token) {
          console.error('[SocketContext] No token found');
          return;
        }

        // Create socket instance
        // Use polling first, then upgrade to websocket if possible
        // This is more reliable on Android emulators and mobile devices
        const socketInstance = io(socketUrl, {
          auth: { token },
          reconnectionAttempts: 5,
          reconnectionDelay: 1000,
          reconnectionDelayMax: 5000,
          timeout: 20000, // 20 seconds timeout
          transports: ['polling', 'websocket'],
          path: '/socket.io',
          autoConnect: true,
          forceNew: false,
          // Add extra options for better connection
          upgrade: true,
          rememberUpgrade: false
        });

        // Connection events
        socketInstance.on('connect', () => {
          console.log('[SocketContext] Connected:', socketInstance.id);
          setIsConnected(true);
        });

        socketInstance.on('disconnect', (reason) => {
          console.log('[SocketContext] Disconnected:', reason);
          setIsConnected(false);
        });

        socketInstance.on('connect_error', (error: any) => {
          console.error('[SocketContext] Connection error:', error.message);
          console.error('[SocketContext] Error details:', {
            type: error?.type,
            description: error?.description,
            context: error?.context,
            socketUrl
          });
          setIsConnected(false);
        });

        socketInstance.on('reconnect', (attemptNumber) => {
          console.log('[SocketContext] Reconnected after', attemptNumber, 'attempts');
          setIsConnected(true);
        });

        // Online status events
        socketInstance.on('online_users', (users: string[]) => {
          setOnlineUsers(new Set(users));
        });

        socketInstance.on('user_online', ({ userId }: { userId: string }) => {
          setOnlineUsers(prev => new Set([...prev, userId]));
        });

        socketInstance.on('user_offline', ({ userId }: { userId: string }) => {
          setOnlineUsers(prev => {
            const newSet = new Set(prev);
            newSet.delete(userId);
            return newSet;
          });
        });

        socketRef.current = socketInstance;
        setSocket(socketInstance);
      } catch (error) {
        console.error('[SocketContext] Error initializing socket:', error);
      }
    };

    initializeSocket();

    // Cleanup on unmount or when user/auth changes
    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, [user, authLoading]);

  // Helper functions
  const emit = useCallback((event: string, data?: any) => {
    if (socket && isConnected) {
      socket.emit(event, data);
    } else {
      console.warn('[SocketContext] Cannot emit - socket not connected');
    }
  }, [socket, isConnected]);

  const on = useCallback((event: string, callback: (...args: any[]) => void) => {
    if (socket) {
      socket.on(event, callback);
    }
  }, [socket]);

  const off = useCallback((event: string, callback?: (...args: any[]) => void) => {
    if (socket) {
      if (callback) {
        socket.off(event, callback);
      } else {
        socket.off(event);
      }
    }
  }, [socket]);

  const isUserOnline = useCallback((userId: string) => {
    return onlineUsers.has(userId);
  }, [onlineUsers]);

  const value: SocketContextData = {
    socket,
    isConnected,
    emit,
    on,
    off,
    isUserOnline,
    onlineUsers: Array.from(onlineUsers)
  };

  return (
    <SocketContext.Provider value={value}>
      {children}
    </SocketContext.Provider>
  );
};

export default SocketContext;

