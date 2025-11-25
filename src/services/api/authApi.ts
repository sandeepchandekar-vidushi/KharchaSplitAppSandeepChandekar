/**
 * Authentication API Service
 * Handles all authentication-related API calls to PostgreSQL backend
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

    // If 401 and we haven't retried yet
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const refreshToken = await tokenStorage.getRefreshToken();
        if (refreshToken) {
          const response = await axios.post(`${API_BASE_URL}/auth/refresh`, {
            refreshToken,
          });

          const { accessToken } = response.data.data;
          await tokenStorage.saveAccessToken(accessToken);

          // Retry original request with new token
          originalRequest.headers.Authorization = `Bearer ${accessToken}`;
          return apiClient(originalRequest);
        }
      } catch (refreshError) {
        // Refresh failed, logout user
        await tokenStorage.clearTokens();
        throw refreshError;
      }
    }

    return Promise.reject(error);
  }
);

export interface RegisterUserRequest {
  phoneNumber: string;
  name: string;
  email?: string;
  profileImageBase64?: string;
}

export interface RegisterUserResponse {
  success: boolean;
  message: string;
  data: {
    userId: string;
  };
}

export interface VerifyOTPRequest {
  phoneNumber: string;
  otp: string;
}

export interface VerifyOTPResponse {
  success: boolean;
  data: {
    user: {
      id: string;
      phoneNumber: string;
      name: string;
      email?: string;
      profileImageBase64?: string;
      createdAt: string;
    };
    accessToken: string;
    refreshToken: string;
  };
}

export interface SendOTPRequest {
  phoneNumber: string;
}

export interface SendOTPResponse {
  success: boolean;
  message: string;
}

export interface UserProfile {
  id: string;
  phoneNumber: string;
  name: string;
  email?: string;
  profileImageBase64?: string;
  createdAt: string;
  updatedAt: string;
}

export const authApi = {
  /**
   * Register a new user
   */
  async register(data: RegisterUserRequest): Promise<RegisterUserResponse> {
    try {
      const response = await apiClient.post<RegisterUserResponse>('/auth/register', {
        phoneNumber: `+91${data.phoneNumber}`,
        name: data.name,
        email: data.email,
        profileImageBase64: data.profileImageBase64,
      });
      return response.data;
    } catch (error: any) {
      throw error;
    }
  },

  /**
   * Send OTP to backend (optional - for backend verification)
   * Note: We're still using WATI for actual SMS sending
   */
  async sendOTP(phoneNumber: string): Promise<SendOTPResponse> {
    try {
      const response = await apiClient.post<SendOTPResponse>('/auth/send-otp', {
        phoneNumber: `+91${phoneNumber}`,
      });
      return response.data;
    } catch (error: any) {
      throw error;
    }
  },

  /**
   * Verify OTP and login
   * This will be called after WATI OTP verification succeeds
   */
  async verifyOTPAndLogin(phoneNumber: string, otp: string): Promise<VerifyOTPResponse> {
    try {
      const response = await apiClient.post<VerifyOTPResponse>('/auth/verify-otp', {
        phoneNumber: `+91${phoneNumber}`,
        otp: otp,
      });
      return response.data;
    } catch (error: any) {
      throw error;
    }
  },

  /**
   * Check if user exists in backend by phone number
   */
  async checkUserExists(phoneNumber: string): Promise<boolean> {
    try {
      const response = await apiClient.get(`/users/check/${phoneNumber}`);
      return response.data.exists;
    } catch (error: any) {
      // If endpoint doesn't exist or error, fallback to false
      return false;
    }
  },

  /**
   * Simple login with just phone number (no OTP)
   * This will check if user exists and return user data + tokens
   */
  async simpleLogin(phoneNumber: string): Promise<{
    success: boolean;
    userExists: boolean;
    data?: {
      user: {
        id: string;
        phoneNumber: string;
        name: string;
        email?: string;
        profileImageBase64?: string;
        createdAt: string;
      };
      accessToken: string;
      refreshToken: string;
    };
  }> {
    try {
      const response = await apiClient.post('/auth/simple-login', {
        phoneNumber: `+91${phoneNumber}`,
      });
      return {
        success: true,
        userExists: true,
        data: response.data.data,
      };
    } catch (error: any) {
      // If user doesn't exist, return userExists: false
      if (error.response?.status === 404 ||
          error.response?.data?.error?.includes('not found')) {
        return {
          success: false,
          userExists: false,
        };
      }

      throw error;
    }
  },

  /**
   * Get user profile
   */
  async getUserProfile(userId: string): Promise<UserProfile> {
    try {
      const response = await apiClient.get<{ success: boolean; data: UserProfile }>(
        `/users/${userId}`
      );
      return response.data.data;
    } catch (error: any) {
      throw error;
    }
  },

  /**
   * Refresh access token
   */
  async refreshAccessToken(refreshToken: string): Promise<string> {
    try {
      const response = await apiClient.post<{ success: boolean; data: { accessToken: string } }>(
        '/auth/refresh',
        { refreshToken }
      );
      return response.data.data.accessToken;
    } catch (error: any) {
      throw error;
    }
  },

  /**
   * Logout
   */
  async logout(refreshToken: string): Promise<void> {
    try {
      await apiClient.post('/auth/logout', { refreshToken });
    } catch (error: any) {
      // Don't throw error on logout, just clear local tokens
    }
  },
};
