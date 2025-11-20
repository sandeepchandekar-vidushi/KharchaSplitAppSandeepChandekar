/**
 * Token Storage Service
 * Handles secure storage and retrieval of JWT tokens
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const TOKEN_KEYS = {
  ACCESS_TOKEN: '@kharchasplit_access_token',
  REFRESH_TOKEN: '@kharchasplit_refresh_token',
  USER_ID: '@kharchasplit_user_id',
};

export const tokenStorage = {
  /**
   * Save access token
   */
  async saveAccessToken(token: string): Promise<void> {
    try {
      await AsyncStorage.setItem(TOKEN_KEYS.ACCESS_TOKEN, token);
    } catch (error) {
      console.error('Error saving access token:', error);
      throw error;
    }
  },

  /**
   * Get access token
   */
  async getAccessToken(): Promise<string | null> {
    try {
      return await AsyncStorage.getItem(TOKEN_KEYS.ACCESS_TOKEN);
    } catch (error) {
      console.error('Error getting access token:', error);
      return null;
    }
  },

  /**
   * Save refresh token
   */
  async saveRefreshToken(token: string): Promise<void> {
    try {
      await AsyncStorage.setItem(TOKEN_KEYS.REFRESH_TOKEN, token);
    } catch (error) {
      console.error('Error saving refresh token:', error);
      throw error;
    }
  },

  /**
   * Get refresh token
   */
  async getRefreshToken(): Promise<string | null> {
    try {
      return await AsyncStorage.getItem(TOKEN_KEYS.REFRESH_TOKEN);
    } catch (error) {
      console.error('Error getting refresh token:', error);
      return null;
    }
  },

  /**
   * Save user ID
   */
  async saveUserId(userId: string): Promise<void> {
    try {
      await AsyncStorage.setItem(TOKEN_KEYS.USER_ID, userId);
    } catch (error) {
      console.error('Error saving user ID:', error);
      throw error;
    }
  },

  /**
   * Get user ID
   */
  async getUserId(): Promise<string | null> {
    try {
      return await AsyncStorage.getItem(TOKEN_KEYS.USER_ID);
    } catch (error) {
      console.error('Error getting user ID:', error);
      return null;
    }
  },

  /**
   * Save all auth data at once
   */
  async saveAuthData(accessToken: string, refreshToken: string, userId: string): Promise<void> {
    try {
      await AsyncStorage.multiSet([
        [TOKEN_KEYS.ACCESS_TOKEN, accessToken],
        [TOKEN_KEYS.REFRESH_TOKEN, refreshToken],
        [TOKEN_KEYS.USER_ID, userId],
      ]);
    } catch (error) {
      console.error('Error saving auth data:', error);
      throw error;
    }
  },

  /**
   * Get all auth data at once
   */
  async getAuthData(): Promise<{
    accessToken: string | null;
    refreshToken: string | null;
    userId: string | null;
  }> {
    try {
      const values = await AsyncStorage.multiGet([
        TOKEN_KEYS.ACCESS_TOKEN,
        TOKEN_KEYS.REFRESH_TOKEN,
        TOKEN_KEYS.USER_ID,
      ]);

      return {
        accessToken: values[0][1],
        refreshToken: values[1][1],
        userId: values[2][1],
      };
    } catch (error) {
      console.error('Error getting auth data:', error);
      return {
        accessToken: null,
        refreshToken: null,
        userId: null,
      };
    }
  },

  /**
   * Clear all tokens
   */
  async clearTokens(): Promise<void> {
    try {
      await AsyncStorage.multiRemove([
        TOKEN_KEYS.ACCESS_TOKEN,
        TOKEN_KEYS.REFRESH_TOKEN,
        TOKEN_KEYS.USER_ID,
      ]);
    } catch (error) {
      console.error('Error clearing tokens:', error);
      throw error;
    }
  },

  /**
   * Clear all auth data (alias for clearTokens for compatibility)
   */
  async clearAuthData(): Promise<void> {
    return this.clearTokens();
  },

  /**
   * Check if user is authenticated
   */
  async isAuthenticated(): Promise<boolean> {
    try {
      const accessToken = await this.getAccessToken();
      return accessToken !== null;
    } catch (error) {
      console.error('Error checking authentication:', error);
      return false;
    }
  },
};
