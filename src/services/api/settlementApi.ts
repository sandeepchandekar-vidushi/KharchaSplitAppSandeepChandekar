/**
 * Settlement API Service
 * Handles all settlement-related API calls to the PostgreSQL backend
 */

import axios, { AxiosInstance } from 'axios';
import { tokenStorage } from '../tokenStorage';

// For local testing, use computer's IP address (not localhost - won't work on device/emulator)
// Your computer's IP: 192.168.1.8
// For production, use: https://api.kharchasplit.com/api/v1
// const API_BASE_URL = 'http://192.168.1.8:3000/api/v1';
const API_BASE_URL = 'https://api.kharchasplit.com/api/v1';


// Create axios instance
const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
apiClient.interceptors.request.use(
  async (config) => {
    const token = await tokenStorage.getAccessToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for token refresh
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const refreshToken = await tokenStorage.getRefreshToken();
        if (refreshToken) {
          const response = await axios.post(`${API_BASE_URL}/auth/refresh`, {
            refreshToken,
          });

          if (response.data.success) {
            const { accessToken } = response.data.data;
            await tokenStorage.saveAccessToken(accessToken);

            originalRequest.headers.Authorization = `Bearer ${accessToken}`;
            return apiClient(originalRequest);
          }
        }
      } catch (refreshError) {
        await tokenStorage.clearAuthData();
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

// Types
export interface Settlement {
  id: string;
  groupId: string;
  fromUserId: string;
  toUserId: string;
  amount: number;
  currency: string;
  status: 'pending' | 'confirmed' | 'paid';
  notes?: string;
  createdAt: string;
  confirmedAt?: string;
  updatedAt: string;
}

export interface CreateSettlementData {
  groupId: string;
  fromUserId: string;
  toUserId: string;
  amount: number;
  currency?: string;
  notes?: string;
}

// API Service
export const settlementApi = {
  /**
   * Get settlements for a group
   */
  async getGroupSettlements(groupId: string): Promise<{
    success: boolean;
    data: Settlement[];
  }> {
    try {
      const response = await apiClient.get('/settlements', {
        params: { groupId },
      });
      return response.data;
    } catch (error: any) {
      throw error;
    }
  },

  /**
   * Create a new settlement
   */
  async createSettlement(data: CreateSettlementData): Promise<{
    success: boolean;
    message: string;
    data: Settlement;
  }> {
    try {
      const response = await apiClient.post('/settlements', data);
      return response.data;
    } catch (error: any) {
      throw error;
    }
  },

  /**
   * Confirm a settlement (receiver confirms they received the payment)
   */
  async confirmSettlement(settlementId: string): Promise<{
    success: boolean;
    message: string;
    data: Settlement;
  }> {
    try {
      const response = await apiClient.patch(`/settlements/${settlementId}/confirm`);
      return response.data;
    } catch (error: any) {
      throw error;
    }
  },

  /**
   * Delete a settlement
   */
  async deleteSettlement(settlementId: string): Promise<{
    success: boolean;
    message: string;
  }> {
    try {
      const response = await apiClient.delete(`/settlements/${settlementId}`);
      return response.data;
    } catch (error: any) {
      throw error;
    }
  },
};

export default settlementApi;
