/**
 * API Service
 * Handles all HTTP requests to PostgreSQL backend
 */

import axios, { AxiosInstance, AxiosRequestConfig, AxiosError } from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ApiResponse, PaginatedResponse } from '../models';

// API Configuration
const API_CONFIG = {
  BASE_URL: '', // Will be set by user - e.g., 'https://api.kharchasplit.com'
  TIMEOUT: 30000,
  RETRY_ATTEMPTS: 3,
  RETRY_DELAY: 1000,
};

// Storage keys
const STORAGE_KEYS = {
  API_BASE_URL: '@api_base_url',
  AUTH_TOKEN: '@auth_token',
  REFRESH_TOKEN: '@refresh_token',
  USER_ID: '@user_id',
};

class ApiService {
  private client: AxiosInstance;
  private baseUrl: string = '';
  private authToken: string | null = null;

  constructor() {
    this.client = axios.create({
      timeout: API_CONFIG.TIMEOUT,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Request interceptor
    this.client.interceptors.request.use(
      async (config) => {
        // Add auth token if available
        if (this.authToken) {
          config.headers.Authorization = `Bearer ${this.authToken}`;
        }

        // Set base URL
        if (this.baseUrl) {
          config.baseURL = this.baseUrl;
        }

        console.log(`[ApiService] ${config.method?.toUpperCase()} ${config.url}`);
        return config;
      },
      (error) => {
        console.error('[ApiService] Request interceptor error:', error);
        return Promise.reject(error);
      }
    );

    // Response interceptor
    this.client.interceptors.response.use(
      (response) => {
        console.log(`[ApiService] Response ${response.status} from ${response.config.url}`);
        return response;
      },
      async (error: AxiosError) => {
        console.error('[ApiService] Response error:', error.message);

        // Handle 401 Unauthorized - token expired
        if (error.response?.status === 401) {
          console.log('[ApiService] Token expired, attempting refresh...');
          // TODO: Implement token refresh logic
          // await this.refreshAuthToken();
        }

        return Promise.reject(error);
      }
    );
  }

  /**
   * Initialize API service with configuration
   */
  async initialize(): Promise<void> {
    try {
      // Load saved configuration
      const savedBaseUrl = await AsyncStorage.getItem(STORAGE_KEYS.API_BASE_URL);
      const savedToken = await AsyncStorage.getItem(STORAGE_KEYS.AUTH_TOKEN);

      if (savedBaseUrl) {
        this.baseUrl = savedBaseUrl;
        console.log('[ApiService] Loaded base URL:', this.baseUrl);
      }

      if (savedToken) {
        this.authToken = savedToken;
        console.log('[ApiService] Loaded auth token');
      }

      console.log('[ApiService] Initialized successfully');
    } catch (error) {
      console.error('[ApiService] Failed to initialize:', error);
    }
  }

  /**
   * Set API base URL
   */
  async setBaseUrl(url: string): Promise<void> {
    this.baseUrl = url;
    await AsyncStorage.setItem(STORAGE_KEYS.API_BASE_URL, url);
    console.log('[ApiService] Base URL set to:', url);
  }

  /**
   * Set authentication token
   */
  async setAuthToken(token: string): Promise<void> {
    this.authToken = token;
    await AsyncStorage.setItem(STORAGE_KEYS.AUTH_TOKEN, token);
    console.log('[ApiService] Auth token set');
  }

  /**
   * Clear authentication
   */
  async clearAuth(): Promise<void> {
    this.authToken = null;
    await AsyncStorage.multiRemove([
      STORAGE_KEYS.AUTH_TOKEN,
      STORAGE_KEYS.REFRESH_TOKEN,
      STORAGE_KEYS.USER_ID,
    ]);
    console.log('[ApiService] Auth cleared');
  }

  /**
   * Generic GET request
   */
  async get<T>(endpoint: string, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
    try {
      const response = await this.client.get<T>(endpoint, config);
      return {
        success: true,
        data: response.data,
      };
    } catch (error: any) {
      return this.handleError(error);
    }
  }

  /**
   * Generic POST request
   */
  async post<T>(
    endpoint: string,
    data?: any,
    config?: AxiosRequestConfig
  ): Promise<ApiResponse<T>> {
    try {
      const response = await this.client.post<T>(endpoint, data, config);
      return {
        success: true,
        data: response.data,
      };
    } catch (error: any) {
      return this.handleError(error);
    }
  }

  /**
   * Generic PUT request
   */
  async put<T>(
    endpoint: string,
    data?: any,
    config?: AxiosRequestConfig
  ): Promise<ApiResponse<T>> {
    try {
      const response = await this.client.put<T>(endpoint, data, config);
      return {
        success: true,
        data: response.data,
      };
    } catch (error: any) {
      return this.handleError(error);
    }
  }

  /**
   * Generic PATCH request
   */
  async patch<T>(
    endpoint: string,
    data?: any,
    config?: AxiosRequestConfig
  ): Promise<ApiResponse<T>> {
    try {
      const response = await this.client.patch<T>(endpoint, data, config);
      return {
        success: true,
        data: response.data,
      };
    } catch (error: any) {
      return this.handleError(error);
    }
  }

  /**
   * Generic DELETE request
   */
  async delete<T>(endpoint: string, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
    try {
      const response = await this.client.delete<T>(endpoint, config);
      return {
        success: true,
        data: response.data,
      };
    } catch (error: any) {
      return this.handleError(error);
    }
  }

  /**
   * Handle API errors
   */
  private handleError(error: AxiosError): ApiResponse<never> {
    if (error.response) {
      // Server responded with error
      const message = (error.response.data as any)?.message || error.message;
      console.error('[ApiService] Server error:', message);
      return {
        success: false,
        error: message,
      };
    } else if (error.request) {
      // Request made but no response
      console.error('[ApiService] Network error:', error.message);
      return {
        success: false,
        error: 'Network error. Please check your internet connection.',
      };
    } else {
      // Error setting up request
      console.error('[ApiService] Request setup error:', error.message);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Retry a failed request
   */
  private async retryRequest<T>(
    requestFn: () => Promise<ApiResponse<T>>,
    attempts: number = API_CONFIG.RETRY_ATTEMPTS
  ): Promise<ApiResponse<T>> {
    for (let i = 0; i < attempts; i++) {
      try {
        const result = await requestFn();
        if (result.success) {
          return result;
        }
      } catch (error) {
        if (i === attempts - 1) {
          throw error;
        }
        // Wait before retry
        await new Promise((resolve) => setTimeout(resolve, API_CONFIG.RETRY_DELAY * (i + 1)));
      }
    }
    return {
      success: false,
      error: 'Max retry attempts reached',
    };
  }

  // ===== AUTHENTICATION ENDPOINTS =====

  async login(phoneNumber: string, password: string) {
    return this.post('/auth/login', { phoneNumber, password });
  }

  async register(phoneNumber: string, name: string, email?: string) {
    return this.post('/auth/register', { phoneNumber, name, email });
  }

  async verifyOTP(phoneNumber: string, otp: string) {
    return this.post('/auth/verify-otp', { phoneNumber, otp });
  }

  async refreshToken(refreshToken: string) {
    return this.post('/auth/refresh', { refreshToken });
  }

  // ===== USER ENDPOINTS =====

  async getUser(userId: string) {
    return this.get(`/users/${userId}`);
  }

  async updateUser(userId: string, data: any) {
    return this.put(`/users/${userId}`, data);
  }

  async deleteUser(userId: string) {
    return this.delete(`/users/${userId}`);
  }

  // ===== GROUP ENDPOINTS =====

  async getGroups(userId: string, page = 1, limit = 20) {
    return this.get<PaginatedResponse<any>>(`/groups?userId=${userId}&page=${page}&limit=${limit}`);
  }

  async getGroup(groupId: string) {
    return this.get(`/groups/${groupId}`);
  }

  async createGroup(data: any) {
    return this.post('/groups', data);
  }

  async updateGroup(groupId: string, data: any) {
    return this.put(`/groups/${groupId}`, data);
  }

  async deleteGroup(groupId: string) {
    return this.delete(`/groups/${groupId}`);
  }

  // ===== GROUP MEMBER ENDPOINTS =====

  async addGroupMember(groupId: string, data: any) {
    return this.post(`/groups/${groupId}/members`, data);
  }

  async removeGroupMember(groupId: string, userId: string) {
    return this.delete(`/groups/${groupId}/members/${userId}`);
  }

  async updateGroupMember(groupId: string, userId: string, data: any) {
    return this.put(`/groups/${groupId}/members/${userId}`, data);
  }

  // ===== EXPENSE ENDPOINTS =====

  async getExpenses(groupId: string, page = 1, limit = 50) {
    return this.get<PaginatedResponse<any>>(`/expenses?groupId=${groupId}&page=${page}&limit=${limit}`);
  }

  async getExpense(expenseId: string) {
    return this.get(`/expenses/${expenseId}`);
  }

  async createExpense(data: any) {
    return this.post('/expenses', data);
  }

  async updateExpense(expenseId: string, data: any) {
    return this.put(`/expenses/${expenseId}`, data);
  }

  async deleteExpense(expenseId: string) {
    return this.delete(`/expenses/${expenseId}`);
  }

  // ===== SETTLEMENT ENDPOINTS =====

  async getSettlements(groupId: string) {
    return this.get(`/settlements?groupId=${groupId}`);
  }

  async createSettlement(data: any) {
    return this.post('/settlements', data);
  }

  async confirmSettlement(settlementId: string) {
    return this.patch(`/settlements/${settlementId}/confirm`, {});
  }

  // ===== PERSONAL EXPENSE ENDPOINTS =====

  async getPersonalExpenses(userId: string, page = 1, limit = 50) {
    return this.get<PaginatedResponse<any>>(`/personal-expenses?userId=${userId}&page=${page}&limit=${limit}`);
  }

  async createPersonalExpense(data: any) {
    return this.post('/personal-expenses', data);
  }

  async updatePersonalExpense(expenseId: string, data: any) {
    return this.put(`/personal-expenses/${expenseId}`, data);
  }

  async deletePersonalExpense(expenseId: string) {
    return this.delete(`/personal-expenses/${expenseId}`);
  }

  // ===== SYNC ENDPOINTS =====

  async syncData(data: any) {
    return this.post('/sync', data);
  }

  async getLastSyncTime(userId: string) {
    return this.get(`/sync/last?userId=${userId}`);
  }
}

// Export singleton instance
export const apiService = new ApiService();
export default apiService;
