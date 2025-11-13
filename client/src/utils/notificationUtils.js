/**
 * Request browser notification permission
 * @returns {Promise<string>} - 'granted', 'denied', or 'default'
 */
export const requestNotificationPermission = async () => {
  if (!('Notification' in window)) {
    console.log('This browser does not support notifications');
    return 'denied';
  }

  if (Notification.permission === 'granted') {
    return 'granted';
  }

  if (Notification.permission !== 'denied') {
    const permission = await Notification.requestPermission();
    return permission;
  }

  return Notification.permission;
};

/**
 * Show browser notification
 * @param {string} title - Notification title
 * @param {string} body - Notification body
 * @param {Object} options - Additional options
 */
export const showBrowserNotification = (title, body, options = {}) => {
  if (!('Notification' in window)) {
    console.log('This browser does not support notifications');
    return null;
  }

  if (Notification.permission === 'granted') {
    const notification = new Notification(title, {
      body,
      icon: '/logo192.png',
      badge: '/logo192.png',
      tag: options.tag || 'default',
      requireInteraction: options.requireInteraction || false,
      silent: options.silent || false,
      data: options.data || {},
      ...options
    });

    // Auto close after 5 seconds if not require interaction
    if (!options.requireInteraction) {
      setTimeout(() => notification.close(), 5000);
    }

    // Handle click
    notification.onclick = () => {
      window.focus();
      if (options.onClick) {
        options.onClick(options.data);
      }
      notification.close();
    };

    return notification;
  } else {
    console.log('Notification permission not granted');
    return null;
  }
};

/**
 * Play notification sound
 * @param {string} soundType - 'message', 'video_call', 'default'
 */
export const playNotificationSound = (soundType = 'default') => {
  try {
    // You can add custom sound files in public folder
    // For now, using a simple beep
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    // Different frequencies for different notification types
    const frequencies = {
      message: 800,
      video_call: 1000,
      default: 600
    };

    oscillator.frequency.value = frequencies[soundType] || frequencies.default;
    oscillator.type = 'sine';

    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);

    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.3);
  } catch (error) {
    console.error('Error playing notification sound:', error);
  }
};

/**
 * Check if notifications are supported
 * @returns {boolean}
 */
export const isNotificationSupported = () => {
  return 'Notification' in window;
};

/**
 * Get notification permission status
 * @returns {string} - 'granted', 'denied', 'default'
 */
export const getNotificationPermission = () => {
  if (!isNotificationSupported()) {
    return 'denied';
  }
  return Notification.permission;
};

/**
 * Format notification content for display
 * @param {Object} notification - Notification object
 * @returns {Object} - Formatted notification
 */
export const formatNotification = (notification) => {
  const { type, title, content, data, createdAt } = notification;

  let icon = '💬';
  let color = 'blue';

  switch (type) {
    case 'message':
      icon = '💬';
      color = 'blue';
      break;
    case 'video_call':
      icon = '📹';
      color = 'green';
      break;
    case 'appointment':
      icon = '📅';
      color = 'purple';
      break;
    case 'system':
      icon = '🔔';
      color = 'gray';
      break;
    default:
      icon = '🔔';
      color = 'gray';
  }

  return {
    ...notification,
    icon,
    color,
    formattedTime: formatNotificationTime(createdAt)
  };
};

/**
 * Format notification time
 * @param {string|Date} time
 * @returns {string}
 */
const formatNotificationTime = (time) => {
  if (!time) return '';

  const date = new Date(time);
  const now = new Date();
  const diff = now - date;

  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (seconds < 60) {
    return 'Vừa xong';
  } else if (minutes < 60) {
    return `${minutes} phút trước`;
  } else if (hours < 24) {
    return `${hours} giờ trước`;
  } else if (days < 7) {
    return `${days} ngày trước`;
  } else {
    return date.toLocaleDateString('vi-VN');
  }
};

