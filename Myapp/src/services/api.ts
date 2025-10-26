// import { Platform } from 'react-native';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
// import { API_BASE } from '../config';

const BASE_URL = "http://localhost:5000/api";

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
  image?: { secureUrl: string };
  isActive?: boolean;
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
      // attach token
      try {
        const token = await AsyncStorage.getItem('token');
        if (token && config.headers) {
          (config.headers as any).Authorization = `Bearer ${token}`;
        }
      } catch {
        // ignore
      }
      // add start time for logging
      (config as any).__startTime = Date.now();
      console.log(`[api] -> ${config.method?.toUpperCase() || 'GET'} ${config.baseURL || ''}${config.url}`);
      return config;
    });
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
      this.handleError(e);
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

  async getCurrentUser(): Promise<ApiResponse<any>> {
    try {
      const res = await this.client.get('/auth/profile');
      return this.handleResponse(res);
    } catch (e) {
      this.handleError(e);
    }
  }
}

export const apiService = new ApiService();
