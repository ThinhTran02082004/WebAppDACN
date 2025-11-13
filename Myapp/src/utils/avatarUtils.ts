/**
 * Utility functions for handling avatar in React Native
 */

import { API_BASE } from '../config';

/**
 * Get full avatar URL from relative or absolute path
 * @param avatarUrl - Avatar path from API
 * @param userName - User name for generating avatar from UI Avatars
 * @returns Full avatar URL
 */
export const getAvatarUrl = (avatarUrl?: string | null, userName: string = 'User'): string => {
  if (!avatarUrl) {
    // Use UI Avatars as fallback
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(userName)}&background=1AC0FF&color=fff&size=200`;
  }

  // If it's an absolute URL (starts with http or https), return as is
  if (avatarUrl.startsWith('http://') || avatarUrl.startsWith('https://')) {
    return avatarUrl;
  }

  // If it's a relative path, add base URL
  const baseUrl = typeof API_BASE === 'function' ? API_BASE() : API_BASE;
  const apiBase = typeof baseUrl === 'string' ? baseUrl.replace('/api', '') : '';
  return `${apiBase}${avatarUrl}`;
};

/**
 * Handle avatar image load error
 * Returns fallback avatar URI using UI Avatars
 * @param userName - User name for generating avatar
 * @returns Fallback avatar URI
 */
export const handleAvatarError = (userName: string = 'User'): string => {
  // Return UI Avatars URL as fallback
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(userName)}&background=1AC0FF&color=fff&size=200`;
};

