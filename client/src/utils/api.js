import axios from 'axios';
import { toastWarning } from './toast';

// Helper to get API base URL with fallback
export const getApiBaseURL = () => {
  let baseURL = '';
  if (import.meta.env.VITE_API_URL) {
    baseURL = import.meta.env.VITE_API_URL;
  } else if (typeof window !== 'undefined') {
    // Fallback to same origin (for same-domain deployment)
    baseURL = window.location.origin;
  }
  
  // Remove trailing slash if present
  baseURL = baseURL.replace(/\/+$/, '');
  
  // Add /api suffix only if it doesn't already end with /api
  if (!baseURL.endsWith('/api')) {
    baseURL = `${baseURL}/api`;
  }
  
  return baseURL;
};

const apiBaseURL = getApiBaseURL();

// Create a custom axios instance
const api = axios.create({
  baseURL: apiBaseURL,
  withCredentials: true, // Important for cookies with social authentication
  headers: {
    'Content-Type': 'application/json',
  }
});

// Add a request interceptor to attach auth token when available
api.interceptors.request.use(
  (config) => {
    // Skip attaching auth token for public endpoints
    if (config.headers['Skip-Auth'] === 'true') {
      delete config.headers.Authorization;
      delete config.headers['Skip-Auth'];
      return config;
    }
    
    // Get token from storage if it exists
    const userInfo = 
      JSON.parse(localStorage.getItem('userInfo')) || 
      JSON.parse(sessionStorage.getItem('userInfo'));
    
    if (userInfo && userInfo.token) {
      config.headers.Authorization = `Bearer ${userInfo.token}`;
    }
    
    // Log all requests for debugging during development
    console.log(`[API Request] ${config.method?.toUpperCase() || 'GET'} ${config.url}`, config);
    
    return config;
  },
  (error) => Promise.reject(error)
);

// Add a response interceptor to handle errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Only log errors that are not 401 on login page to reduce noise
    if (!(error.response?.status === 401 && window.location.pathname === '/login')) {
      console.error('API Error:', error.response || error.message);
    }

    // Handle 401 Unauthorized errors but check specific cases
    if (error.response && error.response.status === 401) {
      const currentPath = window.location.pathname;
      
      // Skip handling for login, register, forgot-password, and other auth pages
      const authPages = ['/login', '/register', '/forgot-password', '/reset-password', '/verify-email', '/need-verification'];
      const isAuthPage = authPages.some(page => currentPath.startsWith(page));
      
      if (isAuthPage) {
        // Let the auth component handle the error
        return Promise.reject(error);
      }
      
      // For other pages, check if user has a token (meaning they were logged in before)
      const userInfo = JSON.parse(localStorage.getItem('userInfo') || 'null') || 
                      JSON.parse(sessionStorage.getItem('userInfo') || 'null');
      
      if (userInfo && userInfo.token) {
        console.log('Token đã hết hạn - Đang đăng xuất...');
        
        // Clear user data from storage
        localStorage.removeItem('userInfo');
        sessionStorage.removeItem('userInfo');
        
        // Show message to user
        toastWarning('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
        
        // Redirect to login page after a short delay
        setTimeout(() => {
          window.location.href = '/login';
        }, 1000);
      }
    }

    return Promise.reject(error);
  }
);

export default api; 