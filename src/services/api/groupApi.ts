/**
 * Group API Service
 * Handles all group-related API calls to the PostgreSQL backend
 */

import axios, { AxiosInstance } from 'axios';
import { tokenStorage } from '../tokenStorage';

// For local testing, use computer's IP address (not localhost - won't work on device/emulator)
// Your computer's IP: 192.168.8.143
// For production, use: https://api.kharchasplit.com/api/v1
const API_BASE_URL = 'http://192.168.8.143:3000/api/v1';

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

          if (response.data.success) {
            const { accessToken } = response.data.data;
            await tokenStorage.saveAccessToken(accessToken);

            // Retry original request with new token
            originalRequest.headers.Authorization = `Bearer ${accessToken}`;
            return apiClient(originalRequest);
          }
        }
      } catch (refreshError) {
        // Refresh failed - clear tokens and redirect to login
        await tokenStorage.clearAuthData();
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

// Types
export interface GroupMember {
  id: string;
  userId: string;
  name: string;
  phoneNumber?: string;
  email?: string;
  role: 'creator' | 'admin' | 'member';
  joinedAt?: string;
}

export interface Group {
  id: string;
  name: string;
  description?: string;
  coverImageBase64?: string;
  currency?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  memberCount?: number;
  expenseCount?: number;
  totalExpenses?: number;
  members?: GroupMember[];
  balances?: any[];
}

export interface CreateGroupData {
  name: string;
  description?: string;
  coverImageBase64?: string;
  currency?: string;
  members?: Array<{
    userId: string;
    name: string;
    phoneNumber?: string;
    email?: string;
  }>;
}

export interface UpdateGroupData {
  name?: string;
  description?: string;
  coverImageBase64?: string;
  currency?: string;
}

export interface AddMemberData {
  userId: string;
  name: string;
  phoneNumber?: string;
  email?: string;
}

// API Service
export const groupApi = {
  /**
   * Get all groups for the authenticated user
   */
  async getUserGroups(userId?: string, page: number = 1, limit: number = 20): Promise<{
    success: boolean;
    data: Group[];
    pagination?: {
      page: number;
      limit: number;
      hasMore: boolean;
    };
  }> {
    try {
      const params: any = { page, limit };
      if (userId) {
        params.userId = userId;
      }

      const response = await apiClient.get('/groups', { params });
      return response.data;
    } catch (error: any) {
      throw error;
    }
  },

  /**
   * Get a single group by ID with full details
   */
  async getGroupById(groupId: string): Promise<{
    success: boolean;
    data: Group;
  }> {
    try {
      const response = await apiClient.get(`/groups/${groupId}`);
      return response.data;
    } catch (error: any) {
      throw error;
    }
  },

  /**
   * Create a new group
   */
  async createGroup(data: CreateGroupData): Promise<{
    success: boolean;
    message: string;
    data: Group;
  }> {
    try {
      const response = await apiClient.post('/groups', data);
      return response.data;
    } catch (error: any) {
      throw error;
    }
  },

  /**
   * Update group details
   */
  async updateGroup(groupId: string, data: UpdateGroupData): Promise<{
    success: boolean;
    message: string;
    data: Group;
  }> {
    try {
      const response = await apiClient.put(`/groups/${groupId}`, data);
      return response.data;
    } catch (error: any) {
      throw error;
    }
  },

  /**
   * Delete a group (soft delete)
   */
  async deleteGroup(groupId: string): Promise<{
    success: boolean;
    message: string;
  }> {
    try {
      const response = await apiClient.delete(`/groups/${groupId}`);
      return response.data;
    } catch (error: any) {
      throw error;
    }
  },

  /**
   * Get group members
   */
  async getGroupMembers(groupId: string): Promise<{
    success: boolean;
    data: GroupMember[];
  }> {
    try {
      const response = await apiClient.get(`/groups/${groupId}/members`);
      return response.data;
    } catch (error: any) {
      throw error;
    }
  },

  /**
   * Add a member to a group
   */
  async addGroupMember(groupId: string, data: AddMemberData): Promise<{
    success: boolean;
    message: string;
    data: GroupMember;
  }> {
    try {
      const response = await apiClient.post(`/groups/${groupId}/members`, data);
      return response.data;
    } catch (error: any) {
      throw error;
    }
  },

  /**
   * Remove a member from a group
   */
  async removeGroupMember(groupId: string, userId: string): Promise<{
    success: boolean;
    message: string;
  }> {
    try {
      const response = await apiClient.delete(`/groups/${groupId}/members/${userId}`);
      return response.data;
    } catch (error: any) {
      throw error;
    }
  },

  /**
   * Update member role (admin/member)
   */
  async updateMemberRole(groupId: string, userId: string, role: 'admin' | 'member'): Promise<{
    success: boolean;
    message: string;
    data: GroupMember;
  }> {
    try {
      const response = await apiClient.put(`/groups/${groupId}/members/${userId}`, { role });
      return response.data;
    } catch (error: any) {
      throw error;
    }
  },
};

export default groupApi;
