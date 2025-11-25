/**
 * Invite API Service
 * Handles all invite-related API calls to the PostgreSQL backend
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
export interface InviteContext {
  groupId?: string;
  groupName?: string;
  message?: string;
}

export interface CreateInviteRequest {
  phoneNumbers: string[];
  context?: InviteContext;
}

export interface InviteData {
  phoneNumber: string;
  inviteCode: string;
  shareUrl: string;
  shareMessage: string;
}

export interface InviteStatus {
  inviteCode: string;
  status: 'pending' | 'accepted' | 'expired';
  phoneNumber: string;
  invitedBy: {
    userId: string;
    name: string;
  };
  invitedAt: string;
  acceptedAt?: string;
  expiresAt?: string;
}

export interface MyInvite {
  id: string;
  phoneNumber: string;
  status: 'pending' | 'accepted' | 'expired';
  invitedAt: string;
  acceptedAt?: string;
  inviteCode: string;
}

export interface MyInvitesResponse {
  totalInvites: number;
  acceptedInvites: number;
  pendingInvites: number;
  expiredInvites: number;
  invites: MyInvite[];
}

// API Service
export const inviteApi = {
  /**
   * Create invites for phone numbers
   */
  async createInvite(data: CreateInviteRequest): Promise<{
    success: boolean;
    data: {
      invites: InviteData[];
    };
  }> {
    try {
      const response = await apiClient.post('/invites/create', data);
      return response.data;
    } catch (error: any) {
      throw error;
    }
  },

  /**
   * Check invite status by invite code
   */
  async checkInviteStatus(inviteCode: string): Promise<{
    success: boolean;
    data: InviteStatus;
  }> {
    try {
      const response = await apiClient.get(`/invites/status`, {
        params: { inviteCode },
      });
      return response.data;
    } catch (error: any) {
      throw error;
    }
  },

  /**
   * Accept an invite (used during registration)
   */
  async acceptInvite(inviteCode: string): Promise<{
    success: boolean;
    message: string;
    data?: {
      referralBonus?: {
        inviter: number;
        invitee: number;
      };
    };
  }> {
    try {
      const response = await apiClient.post('/invites/accept', {
        inviteCode,
      });
      return response.data;
    } catch (error: any) {
      throw error;
    }
  },

  /**
   * Get my invites (sent by current user)
   */
  async getMyInvites(): Promise<{
    success: boolean;
    data: MyInvitesResponse;
  }> {
    try {
      const response = await apiClient.get('/invites/my-invites');
      return response.data;
    } catch (error: any) {
      throw error;
    }
  },

  /**
   * Resend an invite
   */
  async resendInvite(phoneNumber: string): Promise<{
    success: boolean;
    data: InviteData;
  }> {
    try {
      const response = await apiClient.post('/invites/resend', {
        phoneNumber,
      });
      return response.data;
    } catch (error: any) {
      throw error;
    }
  },

  /**
   * Cancel/revoke an invite
   */
  async cancelInvite(inviteCode: string): Promise<{
    success: boolean;
    message: string;
  }> {
    try {
      const response = await apiClient.post('/invites/cancel', {
        inviteCode,
      });
      return response.data;
    } catch (error: any) {
      throw error;
    }
  },
};

export default inviteApi;
