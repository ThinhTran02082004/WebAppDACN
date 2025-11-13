import React, { createContext, useState, useEffect, useContext, useCallback } from 'react';
import io from 'socket.io-client';
import { useAuth } from './AuthContext';

const SocketContext = createContext();

export const useSocket = () => useContext(SocketContext);

export const SocketProvider = ({ children }) => {
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState(new Set());
  const { user, isAuthenticated } = useAuth();

  // Initialize socket connection
  useEffect(() => {
    if (!isAuthenticated || !user) {
      // Disconnect socket if user logs out
      if (socket) {
        socket.disconnect();
        setSocket(null);
        setIsConnected(false);
      }
      setOnlineUsers(new Set());
      return;
    }

    const apiBaseUrl = import.meta.env?.VITE_API_URL ;
    const socketUrl = apiBaseUrl.replace(/\/api$/, '');

    console.log('[SocketContext] Connecting to:', socketUrl);

    // Get JWT token
    const userInfo = JSON.parse(localStorage.getItem('userInfo')) || 
                     JSON.parse(sessionStorage.getItem('userInfo'));
    const token = userInfo?.token;

    if (!token) {
      console.error('[SocketContext] No token found');
      return;
    }

    // Create socket instance
    const socketInstance = io(socketUrl, {
      auth: { token },
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      transports: ['polling', 'websocket'],
      path: '/socket.io',
      autoConnect: true
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

    socketInstance.on('connect_error', (error) => {
      console.error('[SocketContext] Connection error:', error.message);
      setIsConnected(false);
    });

    socketInstance.on('reconnect', (attemptNumber) => {
      console.log('[SocketContext] Reconnected after', attemptNumber, 'attempts');
      setIsConnected(true);
    });

    // Online status events
    socketInstance.on('online_users', (users) => {
      setOnlineUsers(new Set(users));
    });

    socketInstance.on('user_online', ({ userId }) => {
      setOnlineUsers(prev => new Set([...prev, userId]));
    });

    socketInstance.on('user_offline', ({ userId }) => {
      setOnlineUsers(prev => {
        const newSet = new Set(prev);
        newSet.delete(userId);
        return newSet;
      });
    });

    setSocket(socketInstance);

    // Cleanup on unmount
    return () => {
      if (socketInstance) {
        socketInstance.disconnect();
      }
    };
  }, [isAuthenticated, user]);

  // Helper functions
  const emit = useCallback((event, data) => {
    if (socket && isConnected) {
      socket.emit(event, data);
    } else {
      console.warn('[SocketContext] Cannot emit - socket not connected');
    }
  }, [socket, isConnected]);

  const on = useCallback((event, callback) => {
    if (socket) {
      socket.on(event, callback);
    }
  }, [socket]);

  const off = useCallback((event, callback) => {
    if (socket) {
      socket.off(event, callback);
    }
  }, [socket]);

  const isUserOnline = useCallback((userId) => {
    return onlineUsers.has(userId);
  }, [onlineUsers]);

  const value = {
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

