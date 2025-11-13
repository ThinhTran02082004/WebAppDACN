import React, { createContext, useState, useEffect, useContext, useCallback } from 'react';
import { toast } from 'react-toastify';
import { useSocket } from './SocketContext';
import { useAuth } from './AuthContext';
import api from '../utils/api';
import {
  requestNotificationPermission,
  showBrowserNotification,
  playNotificationSound,
  formatNotification
} from '../utils/notificationUtils';

const NotificationContext = createContext();

export const useNotification = () => useContext(NotificationContext);

export const NotificationProvider = ({ children }) => {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [messageUnreadCount, setMessageUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const { socket, isConnected } = useSocket();
  const { isAuthenticated, user } = useAuth();

  // Request notification permission on mount
  useEffect(() => {
    if (isAuthenticated) {
      requestNotificationPermission();
    }
  }, [isAuthenticated]);

  // Fetch initial notifications and unread counts
  useEffect(() => {
    if (isAuthenticated) {
      fetchNotifications();
      fetchUnreadCount();
      fetchMessageUnreadCount();
    }
  }, [isAuthenticated]);

  // Listen to socket events for real-time notifications
  useEffect(() => {
    if (!socket || !isConnected) return;

    // New notification
    const onNewNotification = (notification) => {
      handleNewNotification(notification);
    };

    // New message notification
    const onNewMessageNotification = (data) => {
      handleNewMessageNotification(data);
    };

    // Messages marked as read - refresh unread count
    const onMessagesRead = (data) => {
      console.log('[NotificationContext] Messages marked as read event received');
      // Refresh unread count immediately
      fetchMessageUnreadCount();
    };

    socket.on('new_notification', onNewNotification);
    socket.on('message_notification', onNewMessageNotification);
    socket.on('messages_read', onMessagesRead);

    return () => {
      socket.off('new_notification', onNewNotification);
      socket.off('message_notification', onNewMessageNotification);
      socket.off('messages_read', onMessagesRead);
    };
  }, [socket, isConnected]);

  // Fetch notifications from server
  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const response = await api.get('/notifications?limit=50');
      if (response.data.success) {
        setNotifications(response.data.data);
      }
    } catch (error) {
      console.error('Error fetching notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  // Fetch unread count
  const fetchUnreadCount = async () => {
    try {
      const response = await api.get('/notifications/unread-count');
      if (response.data.success) {
        setUnreadCount(response.data.data.unreadCount);
      }
    } catch (error) {
      console.error('Error fetching unread count:', error);
    }
  };

  // Fetch message unread count
  const fetchMessageUnreadCount = async () => {
    try {
      const response = await api.get('/chat/unread-count');
      if (response.data.success) {
        const newCount = response.data.data.unreadCount;
        // Only update if changed to avoid unnecessary re-renders
        setMessageUnreadCount(prev => {
          if (prev !== newCount) {
            console.log('[NotificationContext] Message unread count updated:', prev, '->', newCount);
            return newCount;
          }
          return prev;
        });
      }
    } catch (error) {
      console.error('Error fetching message unread count:', error);
    }
  };

  // Handle new notification
  const handleNewNotification = useCallback((notification) => {
    const formatted = formatNotification(notification);
    
    // Add to notifications list
    setNotifications(prev => [formatted, ...prev]);
    setUnreadCount(prev => prev + 1);

    // Message notifications have their own dedicated handler (to avoid duplicate toasts)
    if (formatted.type === 'message') {
      return;
    }

    // Show toast notification
    toast.info(
      <div>
        <div className="font-bold">{formatted.title}</div>
        <div className="text-sm">{formatted.content}</div>
      </div>,
      {
        icon: formatted.icon
      }
    );

    // Show browser notification
    showBrowserNotification(formatted.title, formatted.content, {
      data: formatted.data,
      tag: formatted.type,
      onClick: (data) => {
        // Handle notification click based on type
        if (data.conversationId) {
          window.location.href = `/chat/${data.conversationId}`;
        }
      }
    });

    // Play sound
    playNotificationSound(formatted.type);
  }, []);

  // Handle new message notification
  const handleNewMessageNotification = useCallback((data) => {
    const { message, senderName, conversationId } = data;
    
    setMessageUnreadCount(prev => prev + 1);

    // Show toast notification only (không hiển thị browser notification để tránh double)
    toast.info(
      <div>
        <div className="font-bold">Tin nhắn mới</div>
        <div className="text-sm">{senderName}: {message.content.substring(0, 50)}{message.content.length > 50 ? '...' : ''}</div>
      </div>,
      {
        icon: '💬',
        onClick: () => {
          if (user?.roleType === 'doctor') {
            window.location.href = `/doctor/chat/${conversationId}`;
          } else {
            window.location.href = `/chat/${conversationId}`;
          }
        }
      }
    );

    // Play sound
    playNotificationSound('message');
  }, [user]);

  // Mark notification as read
  const markAsRead = async (notificationId) => {
    try {
      await api.put(`/notifications/${notificationId}/read`);
      setNotifications(prev =>
        prev.map(n => n._id === notificationId ? { ...n, isRead: true } : n)
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  // Mark all as read
  const markAllAsRead = async () => {
    try {
      await api.put('/notifications/read-all');
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch (error) {
      console.error('Error marking all as read:', error);
    }
  };

  // Delete notification
  const deleteNotification = async (notificationId) => {
    try {
      await api.delete(`/notifications/${notificationId}`);
      setNotifications(prev => prev.filter(n => n._id !== notificationId));
    } catch (error) {
      console.error('Error deleting notification:', error);
    }
  };

  const value = {
    notifications,
    unreadCount,
    messageUnreadCount,
    loading,
    fetchNotifications,
    fetchUnreadCount,
    fetchMessageUnreadCount,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    setMessageUnreadCount // Allow manual update from chat components
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
};

export default NotificationContext;

