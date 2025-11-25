/**
 * Activity API Service
 * Handles all activity-related API calls to the PostgreSQL backend
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
export interface Activity {
  id: string;
  userId: string;
  groupId?: string;
  activityType: string;
  entityType: string;
  entityId: string;
  title: string;
  description?: string;
  metadata?: Record<string, any>;
  isRead: boolean;
  createdAt: string;
}

// API Service
export const activityApi = {
  /**
   * Get activities for a user
   */
  async getUserActivities(userId: string, page: number = 1, limit: number = 50): Promise<{
    success: boolean;
    data: Activity[];
    pagination?: {
      page: number;
      limit: number;
      total: number;
      hasMore: boolean;
    };
    unreadCount?: number;
  }> {
    try {
      const response = await apiClient.get('/activities', {
        params: { userId, page, limit },
      });
      return response.data;
    } catch (error: any) {
      throw error;
    }
  },

  /**
   * Get activities for a group
   */
  async getGroupActivities(groupId: string, page: number = 1, limit: number = 50): Promise<{
    success: boolean;
    data: Activity[];
    pagination?: {
      page: number;
      limit: number;
      total: number;
      hasMore: boolean;
    };
  }> {
    try {
      const response = await apiClient.get(`/activities/group/${groupId}`, {
        params: { page, limit },
      });
      return response.data;
    } catch (error: any) {
      throw error;
    }
  },

  /**
   * Get a single activity by ID
   */
  async getActivityById(activityId: string): Promise<{
    success: boolean;
    data: Activity;
  }> {
    try {
      const response = await apiClient.get(`/activities/${activityId}`);
      return response.data;
    } catch (error: any) {
      throw error;
    }
  },

  /**
   * Get unread count for a user
   */
  async getUnreadCount(userId: string): Promise<{
    success: boolean;
    data: {
      unreadCount: number;
    };
  }> {
    try {
      const response = await apiClient.get('/activities/unread/count', {
        params: { userId },
      });
      return response.data;
    } catch (error: any) {
      throw error;
    }
  },

  /**
   * Mark an activity as read
   */
  async markAsRead(activityId: string): Promise<{
    success: boolean;
    message: string;
    data: Activity;
  }> {
    try {
      const response = await apiClient.patch(`/activities/${activityId}/read`);
      return response.data;
    } catch (error: any) {
      throw error;
    }
  },

  /**
   * Mark all activities as read
   */
  async markAllAsRead(userId: string): Promise<{
    success: boolean;
    message: string;
  }> {
    try {
      const response = await apiClient.patch('/activities/read-all', { userId });
      return response.data;
    } catch (error: any) {
      throw error;
    }
  },

  /**
   * Mark all group activities as read
   */
  async markGroupActivitiesAsRead(groupId: string): Promise<{
    success: boolean;
    message: string;
  }> {
    try {
      const response = await apiClient.patch(`/activities/group/${groupId}/read-all`);
      return response.data;
    } catch (error: any) {
      throw error;
    }
  },

  /**
   * Delete an activity
   */
  async deleteActivity(activityId: string): Promise<{
    success: boolean;
    message: string;
  }> {
    try {
      const response = await apiClient.delete(`/activities/${activityId}`);
      return response.data;
    } catch (error: any) {
      throw error;
    }
  },

  /**
   * Create a new activity
   */
  async createActivity(data: {
    userId: string;
    activityType: string;
    entityType: string;
    entityId: string;
    title: string;
    description?: string;
    metadata?: Record<string, any>;
    groupId?: string;
  }): Promise<{
    success: boolean;
    message: string;
    data: Activity;
  }> {
    try {
      const response = await apiClient.post('/activities', data);
      return response.data;
    } catch (error: any) {
      throw error;
    }
  },
};

export default activityApi;
