/**
 * Expense API Service
 * Handles all expense-related API calls to the PostgreSQL backend
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
export interface ExpenseParticipant {
  userId: string;
  name: string;
  amount: number;
  percentage?: number;
  shares?: number;
}

export interface Expense {
  id: string;
  groupId: string;
  description: string;
  amount: number;
  currency: string;
  category?: string;
  paidById: string;
  paidByName: string;
  splitType: 'equal' | 'unequal' | 'percentage' | 'shares';
  receiptBase64?: string;
  notes?: string;
  expenseDate: string;
  createdAt: string;
  updatedAt: string;
  participants?: ExpenseParticipant[];
}

export interface CreateExpenseData {
  groupId: string;
  description: string;
  amount: number;
  currency?: string;
  category?: string;
  paidById: string;
  paidByName: string;
  splitType?: 'equal' | 'unequal' | 'percentage' | 'shares';
  receiptBase64?: string;
  notes?: string;
  expenseDate?: string;
  participants: ExpenseParticipant[];
}

export interface UpdateExpenseData {
  description?: string;
  amount?: number;
  currency?: string;
  category?: string;
  receiptBase64?: string;
  notes?: string;
  expenseDate?: string;
}

// API Service
export const expenseApi = {
  /**
   * Get expenses for a group
   */
  async getGroupExpenses(groupId: string, page: number = 1, limit: number = 50): Promise<{
    success: boolean;
    data: Expense[];
    pagination?: {
      page: number;
      limit: number;
      total: number;
      hasMore: boolean;
    };
  }> {
    try {
      const response = await apiClient.get('/expenses', {
        params: { groupId, page, limit },
      });
      return response.data;
    } catch (error: any) {
      throw error;
    }
  },

  /**
   * Get a single expense by ID
   */
  async getExpenseById(expenseId: string): Promise<{
    success: boolean;
    data: Expense;
  }> {
    try {
      const response = await apiClient.get(`/expenses/${expenseId}`);
      return response.data;
    } catch (error: any) {
      throw error;
    }
  },

  /**
   * Create a new expense
   */
  async createExpense(data: CreateExpenseData): Promise<{
    success: boolean;
    message: string;
    data: Expense;
  }> {
    try {
      const response = await apiClient.post('/expenses', data);
      return response.data;
    } catch (error: any) {
      throw error;
    }
  },

  /**
   * Update an expense
   */
  async updateExpense(expenseId: string, data: UpdateExpenseData): Promise<{
    success: boolean;
    message: string;
    data: Expense;
  }> {
    try {
      const response = await apiClient.put(`/expenses/${expenseId}`, data);
      return response.data;
    } catch (error: any) {
      throw error;
    }
  },

  /**
   * Delete an expense
   */
  async deleteExpense(expenseId: string): Promise<{
    success: boolean;
    message: string;
  }> {
    try {
      const response = await apiClient.delete(`/expenses/${expenseId}`);
      return response.data;
    } catch (error: any) {
      throw error;
    }
  },
};

export default expenseApi;
