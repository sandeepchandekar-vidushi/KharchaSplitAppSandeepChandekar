/**
 * Personal Expense API Service
 * Handles all personal expense-related API calls to the PostgreSQL backend
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
export interface PersonalExpense {
  id: string;
  userId: string;
  description: string;
  amount: number;
  currency: string;
  category?: string;
  receiptBase64?: string;
  notes?: string;
  expenseDate: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePersonalExpenseData {
  description: string;
  amount: number;
  currency?: string;
  category?: string;
  receiptBase64?: string;
  notes?: string;
  expenseDate?: string;
}

export interface UpdatePersonalExpenseData {
  description?: string;
  amount?: number;
  currency?: string;
  category?: string;
  receiptBase64?: string;
  notes?: string;
  expenseDate?: string;
}

export interface PersonalExpenseSummary {
  totalExpenses: number;
  totalAmount: number;
  currency: string;
  monthlyExpenses: {
    month: string;
    amount: number;
    count: number;
  }[];
}

// API Service
export const personalExpenseApi = {
  /**
   * Get personal expenses for a user
   */
  async getPersonalExpenses(userId: string, page: number = 1, limit: number = 50): Promise<{
    success: boolean;
    data: PersonalExpense[];
    pagination?: {
      page: number;
      limit: number;
      total: number;
      hasMore: boolean;
    };
  }> {
    try {
      const response = await apiClient.get('/personal-expenses', {
        params: { userId, page, limit },
      });
      return response.data;
    } catch (error: any) {
      throw error;
    }
  },

  /**
   * Get a single personal expense by ID
   */
  async getPersonalExpenseById(expenseId: string): Promise<{
    success: boolean;
    data: PersonalExpense;
  }> {
    try {
      const response = await apiClient.get(`/personal-expenses/${expenseId}`);
      return response.data;
    } catch (error: any) {
      throw error;
    }
  },

  /**
   * Get personal expenses summary for a user
   */
  async getPersonalExpensesSummary(userId: string): Promise<{
    success: boolean;
    data: PersonalExpenseSummary;
  }> {
    try {
      const response = await apiClient.get('/personal-expenses/summary', {
        params: { userId },
      });
      return response.data;
    } catch (error: any) {
      throw error;
    }
  },

  /**
   * Create a new personal expense
   */
  async createPersonalExpense(data: CreatePersonalExpenseData): Promise<{
    success: boolean;
    message: string;
    data: PersonalExpense;
  }> {
    try {
      const response = await apiClient.post('/personal-expenses', data);
      return response.data;
    } catch (error: any) {
      throw error;
    }
  },

  /**
   * Update a personal expense
   */
  async updatePersonalExpense(expenseId: string, data: UpdatePersonalExpenseData): Promise<{
    success: boolean;
    message: string;
    data: PersonalExpense;
  }> {
    try {
      const response = await apiClient.put(`/personal-expenses/${expenseId}`, data);
      return response.data;
    } catch (error: any) {
      throw error;
    }
  },

  /**
   * Delete a personal expense
   */
  async deletePersonalExpense(expenseId: string): Promise<{
    success: boolean;
    message: string;
  }> {
    try {
      const response = await apiClient.delete(`/personal-expenses/${expenseId}`);
      return response.data;
    } catch (error: any) {
      throw error;
    }
  },
};

export default personalExpenseApi;
