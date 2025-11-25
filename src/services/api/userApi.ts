/**
 * User API Service
 * Handles all user-related API calls to the PostgreSQL backend
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
        await tokenStorage.clearTokens();
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

// Types
export interface User {
  id: string;
  phoneNumber: string;
  name: string;
  email?: string;
  profileImage?: string;
  preferredCurrency?: string;
  createdAt: string;
  updatedAt: string;
}

export interface UpdateUserData {
  name?: string;
  email?: string;
  profileImageBase64?: string;
  preferredCurrency?: string;
}

// API Service
export const userApi = {
  /**
   * Get user by ID
   */
  async getUserById(userId: string): Promise<{
    success: boolean;
    data: User;
  }> {
    try {
      const response = await apiClient.get(`/users/${userId}`);
      return response.data;
    } catch (error: any) {
      throw error;
    }
  },

  /**
   * Update user profile
   */
  async updateUser(userId: string, data: UpdateUserData): Promise<{
    success: boolean;
    message: string;
    data: User;
  }> {
    try {
      const response = await apiClient.put(`/users/${userId}`, data);
      return response.data;
    } catch (error: any) {
      throw error;
    }
  },

  /**
   * Delete user account
   */
  async deleteUser(userId: string): Promise<{
    success: boolean;
    message: string;
  }> {
    try {
      const response = await apiClient.delete(`/users/${userId}`);
      return response.data;
    } catch (error: any) {
      throw error;
    }
  },

  /**
   * Check if users are registered by phone numbers
   * Returns array of registered users with their profiles
   */
  async checkRegisteredUsers(phoneNumbers: string[]): Promise<{
    success: boolean;
    data: {
      registered: Array<{
        phoneNumber: string;
        userId: string;
        name: string;
        email?: string;
        profileImage?: string;
      }>;
      unregistered: string[];
    };
  }> {
    try {
      const response = await apiClient.post('/users/check-registration', {
        phoneNumbers,
      });
      return response.data;
    } catch (error: any) {
      throw error;
    }
  },
};

export default userApi;
