import { Platform } from 'react-native';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

// For Android emulator, use 10.0.2.2 to access host machine's localhost
// For iOS simulator, use localhost
// For physical devices via WiFi, use your computer's IP address (e.g., http://192.168.1.xxx:5000/api)
const BASE_URL = Platform.OS === 'android' 
  ? "http://10.0.2.2:5000/api" 
  : "http://localhost:5000/api";

export interface Hospital {
  _id: string;
  name: string;
  address: string;
  description?: string;
  imageUrl?: string;
  image?: {
    secureUrl: string;
  };
  contactInfo?: {
    phone?: string;
    email?: string;
  };
  workingHours?: {
    monday?: { open: string; close: string; isOpen: boolean };
    tuesday?: { open: string; close: string; isOpen: boolean };
    wednesday?: { open: string; close: string; isOpen: boolean };
    thursday?: { open: string; close: string; isOpen: boolean };
    friday?: { open: string; close: string; isOpen: boolean };
    saturday?: { open: string; close: string; isOpen: boolean };
    sunday?: { open: string; close: string; isOpen: boolean };
  };
  specialties?: Array<{
    _id: string;
    name: string;
    description?: string;
    icon?: string;
    imageUrl?: string;
    image?: { secureUrl: string };
  }>;
  services?: Array<{
    _id: string;
    name: string;
    description?: string;
    price?: number;
  }>;
  isActive?: boolean;
}

export interface Doctor {
  _id: string;
  user: {
    _id: string;
    fullName: string;
    email: string;
    phoneNumber?: string;
    avatarUrl?: string;
    gender?: string;
    dateOfBirth?: string;
    address?: string;
  };
  specialtyId: {
    _id: string;
    name: string;
    description?: string;
    icon?: string;
  };
  hospitalId: {
    _id: string;
    name: string;
    address: string;
  };
  title: string;
  description?: string;
  education: string;
  experience: number;
  certifications?: string[];
  languages?: string[];
  consultationFee: number;
  isAvailable: boolean;
  averageRating?: number;
  services?: Array<{
    _id: string;
    name: string;
    price: number;
  }>;
}

export interface Specialty {
  _id: string;
  name: string;
  description?: string;
  icon?: string;
  imageUrl?: string;
  image?: string | { secureUrl: string };
  isActive?: boolean;
  // Client-enriched fields
  doctorCount?: number;
  serviceCount?: number;
}

export interface ServiceItem {
  _id: string;
  name: string;
  shortDescription?: string;
  description?: string;
  price: number;
  specialtyId?: { _id: string; name: string } | string;
  imageUrl?: string;
  image?: { secureUrl: string };
  isActive?: boolean;
  duration?: string; // Thời gian thực hiện dịch vụ
}

export interface NewsItem {
  _id: string;
  title: string;
  summary?: string;
  content?: string;
  category?: string;
  image?: { secureUrl?: string };
  publishDate?: string;
  createdAt?: string;
  author?: string | { fullName: string };
  isPublished?: boolean;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

class ApiService {
  // Increase default timeout to 15s to accommodate slower endpoints on dev machines
  private client = axios.create({ baseURL: BASE_URL, headers: { 'Content-Type': 'application/json' }, timeout: 15000 });
  // Cache last successful reachability check for a short period to avoid repeated probes
  private _lastReachableAt: number | null = null;
  private _reachabilityTtl = 30 * 1000; // 30 seconds

  constructor() {
    console.log('[api] ApiService initialized with baseURL:', this.client.defaults.baseURL);
    this.client.interceptors.request.use(async (config) => {
        // attach token - prioritize in-memory token first, then fallback to AsyncStorage
      try {
        const inMemoryToken = (this.client.defaults.headers as any).Authorization;
        if (inMemoryToken && config.headers) {
          // Token already set in memory, use it
          (config.headers as any).Authorization = inMemoryToken;
        } else {
          // Fallback to AsyncStorage
          const token = await AsyncStorage.getItem('token');
          if (token && config.headers) {
            (config.headers as any).Authorization = `Bearer ${token}`;
          }
        }
      } catch {
        // ignore
      }
      // add start time for logging
      (config as any).__startTime = Date.now();
      console.log(`[api] -> ${config.method?.toUpperCase() || 'GET'} ${config.baseURL || ''}${config.url}`);
      return config;
    });

    // Add response interceptor to handle 401 errors (unauthorized)
    this.client.interceptors.response.use(
      (response) => response,
      async (error) => {
        if (error?.response?.status === 401) {
          // Token expired or invalid, clear it
          try {
            await AsyncStorage.removeItem('token');
            (this.client.defaults.headers as any).Authorization = undefined;
            console.log('[api] Token expired, cleared from storage');
          } catch {
            // ignore
          }
        }
        return Promise.reject(error);
      }
    );
  }

  // Allow setting auth token in-memory (useful for session-like behavior when rememberMe is false)
  setToken(token?: string | null) {
    try {
      if (token) {
        (this.client.defaults.headers as any).Authorization = `Bearer ${token}`;
      } else {
        if ((this.client.defaults.headers as any).Authorization) delete (this.client.defaults.headers as any).Authorization;
      }
      console.log('[api] auth token updated (in-memory)');
    } catch {
      console.error('[api] failed to set token');
    }
  }

  // Allow updating baseURL at runtime (useful for device testing)
  setBaseUrl(url: string) {
    try {
      this.client.defaults.baseURL = url;
      console.log('[api] baseURL updated to', url);
    } catch {
      console.error('[api] failed to update baseURL');
    }
  }

  // Quick probe to check if backend is reachable (uses short timeout)
  private async probeBackend(): Promise<void> {
    try {
      const base = this.client.defaults.baseURL || BASE_URL;
      // If base includes the '/api' prefix, probe the server root health endpoint instead
      const serverRoot = String(base).replace(/\/api\/?$/i, '').replace(/\/$/, '');
      // If we recently probed successfully, skip
      if (this._lastReachableAt && Date.now() - this._lastReachableAt < this._reachabilityTtl) return;
      const url = `${serverRoot}/health`;
      console.log('[api] probing backend health endpoint:', url);
      const res = await axios.get(url, { timeout: 3000 });
      if (res && res.status === 200) {
        this._lastReachableAt = Date.now();
        return;
      }
      throw new Error('Health check failed');
    } catch (err) {
      // Normalize error for callers
      const msg = (err as any)?.message || String(err);
      throw new Error(`Cannot reach backend: ${msg}`);
    }
  }

  private handleResponse<T>(resp: any): ApiResponse<T> {
    try {
      // const start = (resp.config as any).__startTime;
      // const dt = start ? Date.now() - start : undefined;
      console.log(`[api] <- ${resp.config.method?.toUpperCase() || 'GET'} ${resp.config.url}`);
    } catch {
      // ignore
    }
    return { success: resp.data?.success ?? true, data: resp.data?.data ?? resp.data, message: resp.data?.message } as ApiResponse<T>;
  }

  private handleError(e: any): never {
    try {
    const conf = e?.config;
    // const start = conf?.__startTime;
    // const dt = start ? `${Date.now() - start}ms` : '';
    } catch {
      console.error('Error logging failed');
    }
    const conf = e?.config;
    // const start = conf?.__startTime;
    // const dt = start ? `${Date.now() - start}ms` : '';

    // Safe logging: don't throw from logging itself
    try {
      const urlInfo = conf?.url ? `${conf.url}` : `${this.client.defaults.baseURL || ''}`;
      console.error(`[api] ERROR ${conf?.method?.toUpperCase() || 'GET'} ${urlInfo}`, e?.response?.data || e?.message || e);
    } catch {
      // Fallback logging
      try {
        console.error('[api] ERROR (logging failed)', e?.message || e);
      } catch {
        // last-resort
        // nothing else to do
      }
    }

    // Common mapped errors
    if (e?.code === 'ECONNABORTED') {
      throw new Error('Request timeout');
    }

    const msg = (e?.message || '').toString().toLowerCase();
    if (msg.includes('cannot reach backend') || msg.includes('network error') || e?.code === 'ENOTFOUND' || e?.code === 'ECONNREFUSED') {
      // If the error message already contains 'cannot reach backend', avoid double-prefixing
      if (msg.includes('cannot reach backend')) {
        throw new Error(e?.message || 'Cannot reach backend');
      }
      // Provide clear guidance for network errors
      throw new Error(`Cannot reach backend: ${e?.message || 'Network Error'}`);
    }

    if (e?.response) throw e.response.data || e;

    throw e;
  }

  async getHospitals(params?: { page?: number; limit?: number; isActive?: boolean; province?: string; search?: string }): Promise<ApiResponse<{ hospitals: Hospital[]; total: number; totalPages: number; currentPage: number }>> {
    try {
      // Probe backend reachability first to fail fast with a helpful message
      await this.probeBackend();
      console.log('[api] GET hospitals using baseURL:', this.client.defaults.baseURL);
      const res = await this.client.get('/hospitals', { params });
      return this.handleResponse(res);
    } catch (e) {
      this.handleError(e);
    }
  }

  async getHospitalById(id: string): Promise<ApiResponse<Hospital>> {
    try {
      const res = await this.client.get(`/hospitals/${id}`);
      return this.handleResponse(res);
    } catch (e) {
      this.handleError(e);
    }
  }

  async getHospitalSpecialties(hospitalId: string): Promise<ApiResponse<any[]>> {
    try {
      const res = await this.client.get(`/hospitals/${hospitalId}/specialties`);
      return this.handleResponse(res);
    } catch (e) {
      this.handleError(e);
    }
  }

  async getHospitalServices(hospitalId: string): Promise<ApiResponse<any[]>> {
    try {
      const res = await this.client.get(`/hospitals/${hospitalId}/services`);
      return this.handleResponse(res);
    } catch (e) {
      this.handleError(e);
    }
  }

  async searchHospitals(searchTerm: string): Promise<ApiResponse<{ hospitals: Hospital[]; total: number; totalPages: number; currentPage: number }>> {
    return this.getHospitals({ search: searchTerm, limit: 20 });
  }

  async getDoctors(params?: {
    page?: number;
    limit?: number;
    sort?: string;
    search?: string;
    specialtyId?: string;
    hospitalId?: string;
    isAvailable?: boolean;
  }): Promise<ApiResponse<{ doctors: Doctor[]; total: number; totalPages: number; currentPage: number }>> {
    try {
      await this.probeBackend();
      console.log('[api] GET doctors using baseURL:', this.client.defaults.baseURL);
      const res = await this.client.get('/doctors', { params });
      return this.handleResponse(res);
    } catch (e) {
      this.handleError(e);
    }
  }

  async getSpecialties(params?: { page?: number; limit?: number; isActive?: boolean; search?: string }): Promise<ApiResponse<{ specialties: Specialty[]; total: number; totalPages: number; currentPage: number }>> {
    try {
      await this.probeBackend();
      const res = await this.client.get('/specialties', { params });
      // Server returns { success, data: { specialties, total, totalPages, currentPage } }
      return this.handleResponse(res);
    } catch (e) {
      this.handleError(e);
    }
  }

  async getServices(params?: { page?: number; limit?: number; specialtyId?: string; name?: string; minPrice?: number; maxPrice?: number; isActive?: boolean }): Promise<ApiResponse<{ services: ServiceItem[]; total: number; totalPages: number; currentPage: number } | { count: number; total: number; totalPages: number; currentPage: number; data: ServiceItem[] }>> {
    try {
      await this.probeBackend();
      // Public services endpoint mounted at /api/services
      const res = await this.client.get('/services', { params });
      return this.handleResponse(res);
    } catch (e) {
      this.handleError(e);
    }
  }

  async getNews(params?: { page?: number; limit?: number; category?: string; hospitalId?: string; doctorId?: string; isPublished?: boolean; search?: string }): Promise<ApiResponse<{ news: NewsItem[]; pagination: { total: number; page: number; limit: number; pages: number } }>> {
    try {
      await this.probeBackend();
      // News list route defined at /api/news/all
      const res = await this.client.get('/news/all', { params });
      return this.handleResponse(res);
    } catch (e) {
      this.handleError(e);
    }
  }

  async getDoctorById(id: string): Promise<ApiResponse<Doctor>> {
    try {
      const res = await this.client.get(`/doctors/${id}`);
      return this.handleResponse(res);
    } catch (e) {
      // Fallbacks for mis-mounted route paths
      try {
        // Case 1: route registered as /api/doctors/doctors/:id
        const alt1 = await this.client.get(`/doctors/doctors/${id}`);
        return this.handleResponse(alt1);
      } catch (e2) {
        try {
          // Case 2: try without /api prefix entirely (server root)
          const base = this.client.defaults.baseURL || '';
          const serverRoot = String(base).replace(/\/_?api\/?$/i, '').replace(/\/$/, '');
          const alt2 = await axios.get(`${serverRoot}/api/doctors/doctors/${id}`);
          return this.handleResponse(alt2);
        } catch (e3) {
          this.handleError(e3);
        }
      }
    }
  }

  async getDoctorReviews(doctorId: string, params?: { page?: number; limit?: number }): Promise<ApiResponse<any[] | { reviews?: any[]; data?: any[]; count?: number; total?: number; averageRating: number }>> {
    try {
      const res = await this.client.get(`/reviews/doctor/${doctorId}`, { params });
      return this.handleResponse(res);
    } catch (e) {
      this.handleError(e);
    }
  }

  async getDoctorSchedules(doctorId: string): Promise<ApiResponse<any[]>> {
    try {
      await this.probeBackend();
      const res = await this.client.get(`/appointments/doctors/${doctorId}/schedules`);
      return this.handleResponse(res);
    } catch (e) {
      this.handleError(e);
    }
  }
  
  async searchDoctors(searchTerm: string): Promise<ApiResponse<{ doctors: Doctor[]; total: number; totalPages: number; currentPage: number }>> {
    return this.getDoctors({ search: searchTerm, limit: 20 });
  }

  async login(email: string, password: string, rememberMe?: boolean): Promise<ApiResponse<{ user: any; token: string }>> {
    try {
      const payload: any = { email, password };
      if (typeof rememberMe !== 'undefined') payload.rememberMe = rememberMe;
      const res = await this.client.post('/auth/login', payload);
      return this.handleResponse(res);
    } catch (e) {
      this.handleError(e);
    }
  }

  async register(userData: any): Promise<ApiResponse<{ user: any; token: string }>> {
    try {
      const res = await this.client.post('/auth/register', userData);
      return this.handleResponse(res);
    } catch (e) {
      this.handleError(e);
    }
  }

  async googleLogin(googleToken: string, tokenType: 'idToken' | 'accessToken' = 'idToken'): Promise<ApiResponse<{ user: any; token: string }>> {
    try {
  const payload: any = { token: googleToken, tokenType };
  const res = await this.client.post('/auth/google/token', payload);
      return this.handleResponse(res);
    } catch (e) {
      this.handleError(e);
    }
  }

  async facebookLogin(facebookToken: string): Promise<ApiResponse<{ user: any; token: string }>> {
    try {
      const res = await this.client.post('/auth/facebook', { token: facebookToken });
      return this.handleResponse(res);
    } catch (e) {
      this.handleError(e);
    }
  }

  async getFavoriteDoctors(): Promise<ApiResponse<{ doctors: Doctor[] } | Doctor[]>> {
    try {
      const res = await this.client.get('/doctors/favorites');
      return this.handleResponse(res);
    } catch (e) {
      this.handleError(e);
    }
  }

  async addFavoriteDoctor(doctorId: string): Promise<ApiResponse<any>> {
    try {
      const res = await this.client.post(`/doctors/${doctorId}/favorite`);
      return this.handleResponse(res);
    } catch (e) {
      this.handleError(e);
    }
  }

  async removeFavoriteDoctor(doctorId: string): Promise<ApiResponse<any>> {
    try {
      const res = await this.client.delete(`/doctors/${doctorId}/favorite`);
      return this.handleResponse(res);
    } catch (e) {
      this.handleError(e);
    }
  }

  async resendVerification(email: string): Promise<ApiResponse<any>> {
    try {
      const res = await this.client.post('/auth/resend-verification', { email });
      return this.handleResponse(res);
    } catch (e) {
      this.handleError(e);
    }
  }

  async logout(): Promise<ApiResponse<any>> {
    try {
      const res = await this.client.post('/auth/logout');
      return this.handleResponse(res);
    } catch (e) {
      this.handleError(e);
    }
  }

  async changePassword(currentPassword: string, newPassword: string): Promise<ApiResponse<any>> {
    try {
      const res = await this.client.post('/auth/change-password', { currentPassword, newPassword });
      return this.handleResponse(res);
    } catch (e) {
      this.handleError(e);
    }
  }

  async getCurrentUser(): Promise<ApiResponse<any>> {
    try {
      const res = await this.client.get('/auth/profile');
      return this.handleResponse(res);
    } catch (e) {
      this.handleError(e);
    }
  }

  async updateProfile(profileData: any): Promise<ApiResponse<any>> {
    try {
      const res = await this.client.put('/auth/profile', profileData);
      return this.handleResponse(res);
    } catch (e) {
      this.handleError(e);
    }
  }

  async uploadAvatar(uri: string, type: string = 'image/jpeg', name: string = 'avatar.jpg'): Promise<ApiResponse<any>> {
    try {
      // Create FormData for multipart/form-data upload
      const formData = new FormData();
      formData.append('avatar', {
        uri: uri,
        type: type,
        name: name,
      } as any);

      // Don't set Content-Type header - axios will set it automatically with boundary
      const res = await this.client.post('/auth/profile/avatar', formData);
      return this.handleResponse(res);
    } catch (e) {
      this.handleError(e);
    }
  }

  async createAppointment(payload: any): Promise<ApiResponse<any>> {
    try {
      await this.probeBackend();
      const res = await this.client.post('/appointments', payload);
      return this.handleResponse(res);
    } catch (e) {
      this.handleError(e);
    }
  }

  async getAvailableSchedules(params: { doctorId: string; date?: string; hospitalId?: string }): Promise<ApiResponse<any[]>> {
    try {
      // Public endpoint: /api/schedules
      const res = await this.client.get('/schedules', { params });
      return this.handleResponse(res);
    } catch (e) {
      this.handleError(e);
    }
  }

  async getUserAppointments(params?: { page?: number; limit?: number; status?: string }): Promise<ApiResponse<any>> {
    try {
      await this.probeBackend();
      const res = await this.client.get('/appointments/user/patient', { params });
      return this.handleResponse(res);
    } catch (e) {
      this.handleError(e);
    }
  }

  async getUserPrescriptionHistory(params?: { page?: number; limit?: number; status?: string }): Promise<ApiResponse<any>> {
    try {
      await this.probeBackend();
      const res = await this.client.get('/prescriptions/user/history', { params });
      return this.handleResponse(res);
    } catch (e) {
      this.handleError(e);
    }
  }

  async getPaymentHistory(params?: {
    page?: number;
    limit?: number;
    status?: string;
    method?: string;
    billType?: string;
    appointmentId?: string;
    startDate?: string;
    endDate?: string;
    search?: string;
  }): Promise<ApiResponse<any>> {
    try {
      await this.probeBackend();
      const res = await this.client.get('/billing/payment-history', { params });
      return this.handleResponse(res);
    } catch (e) {
      this.handleError(e);
    }
  }

  async getAppointmentById(appointmentId: string): Promise<ApiResponse<any>> {
    try {
      await this.probeBackend();
      const res = await this.client.get(`/appointments/${appointmentId}`);
      return this.handleResponse(res);
    } catch (e) {
      this.handleError(e);
    }
  }

  async cancelAppointment(appointmentId: string, reason?: string): Promise<ApiResponse<any>> {
    try {
      await this.probeBackend();
      const config = reason ? { data: { cancellationReason: reason } } : undefined;
      const res = await this.client.delete(`/appointments/${appointmentId}`, config);
      return this.handleResponse(res);
    } catch (e) {
      this.handleError(e);
    }
  }

  async rescheduleAppointment(
    appointmentId: string,
    payload: { scheduleId: string; timeSlot: { startTime: string; endTime: string }; appointmentDate: string; notes?: string }
  ): Promise<ApiResponse<any>> {
    try {
      await this.probeBackend();
      const res = await this.client.put(`/appointments/${appointmentId}/reschedule`, payload);
      return this.handleResponse(res);
    } catch (e) {
      this.handleError(e);
    }
  }

  // Payments - PayPal: create and execute
  async createPaypalPayment(appointmentId: string): Promise<ApiResponse<{ paymentId: string; approvalUrl: string }>> {
    try {
      await this.probeBackend();
      const res = await this.client.post('/payments/paypal/create', { appointmentId });
      return this.handleResponse(res);
    } catch (e) {
      this.handleError(e);
    }
  }

  async executePaypalPayment(paymentId: string, PayerID: string): Promise<ApiResponse<any>> {
    try {
      const res = await this.client.post('/payments/paypal/execute', { paymentId, PayerID });
      return this.handleResponse(res);
    } catch (e) {
      this.handleError(e);
    }
  }

  // Payments - MoMo: create payment session and check status
  async createMomoPayment(params: { appointmentId: string; amount: number; billType?: string; prescriptionId?: string; orderInfo?: string; redirectUrl?: string }): Promise<ApiResponse<{ orderId: string; payUrl: string }>> {
    try {
      await this.probeBackend();
      const res = await this.client.post('/payments/momo/create', params);
      return this.handleResponse(res);
    } catch (e) {
      this.handleError(e);
    }
  }

  async checkMomoStatus(orderId: string): Promise<ApiResponse<{ payment: { status: string; appointmentId: string } }>> {
    try {
      const res = await this.client.get(`/payments/momo/status/${orderId}`);
      return this.handleResponse(res);
    } catch (e) {
      this.handleError(e);
    }
  }

  async verifyMomoPaymentResult(orderId: string, resultCode: string | number): Promise<ApiResponse<{ paymentStatus: string; appointmentId?: string; message?: string }>> {
    try {
      const res = await this.client.get(`/payments/momo/result`, {
        params: { orderId, resultCode },
      });
      return this.handleResponse(res);
    } catch (e) {
      this.handleError(e);
    }
  }
}

export const apiService = new ApiService();
