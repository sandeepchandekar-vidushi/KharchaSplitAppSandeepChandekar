/**
 * Database Manager
 * Central manager for coordinating SQLite, API, and Sync services
 */

import { sqliteService } from './sqliteService';
import { apiService } from './apiService';
import { syncService } from './syncService';

class DatabaseManager {
  private isInitialized = false;

  /**
   * Initialize all database services
   */
  async initialize(config?: { apiBaseUrl?: string; autoSync?: boolean }): Promise<void> {
    if (this.isInitialized) {
      console.log('[DatabaseManager] Already initialized');
      return;
    }

    try {
      console.log('[DatabaseManager] Initializing database services...');

      // 1. Initialize SQLite
      console.log('[DatabaseManager] Initializing SQLite...');
      await sqliteService.initialize();

      // 2. Initialize API Service
      console.log('[DatabaseManager] Initializing API Service...');
      await apiService.initialize();

      // Set API base URL if provided
      if (config?.apiBaseUrl) {
        await apiService.setBaseUrl(config.apiBaseUrl);
      }

      // 3. Start auto-sync if enabled
      if (config?.autoSync !== false) {
        console.log('[DatabaseManager] Starting auto-sync...');
        await syncService.startAutoSync();
      }

      this.isInitialized = true;
      console.log('[DatabaseManager] All database services initialized successfully');
    } catch (error) {
      console.error('[DatabaseManager] Failed to initialize:', error);
      throw error;
    }
  }

  /**
   * Get initialization status
   */
  getInitializationStatus(): boolean {
    return this.isInitialized;
  }

  /**
   * Configure API base URL
   */
  async configureApi(baseUrl: string, authToken?: string): Promise<void> {
    await apiService.setBaseUrl(baseUrl);
    if (authToken) {
      await apiService.setAuthToken(authToken);
    }
    console.log('[DatabaseManager] API configured');
  }

  /**
   * Get database statistics
   */
  async getStatistics() {
    const sqliteStats = await sqliteService.getStatistics();
    const syncStatus = await syncService.getSyncStatus();
    const lastSync = await syncService.getLastSyncTime();

    return {
      sqlite: sqliteStats,
      sync: {
        lastSyncTime: lastSync,
        status: syncStatus,
      },
    };
  }

  /**
   * Perform manual sync
   */
  async sync(direction: 'push' | 'pull' | 'both' = 'both'): Promise<void> {
    console.log(`[DatabaseManager] Manual sync: ${direction}`);
    await syncService.syncAll(direction);
  }

  /**
   * Enable/disable auto-sync
   */
  async setAutoSync(enabled: boolean): Promise<void> {
    await syncService.setSyncEnabled(enabled);
    console.log(`[DatabaseManager] Auto-sync ${enabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * Reset local database (WARNING: Destructive operation)
   */
  async resetLocalDatabase(): Promise<void> {
    console.warn('[DatabaseManager] Resetting local database...');
    await sqliteService.resetDatabase();
    await syncService.clearSyncQueue();
    console.log('[DatabaseManager] Local database reset complete');
  }

  /**
   * Shutdown all services
   */
  async shutdown(): Promise<void> {
    console.log('[DatabaseManager] Shutting down...');
    syncService.stopAutoSync();
    await sqliteService.close();
    this.isInitialized = false;
    console.log('[DatabaseManager] Shutdown complete');
  }

  /**
   * Health check for all services
   */
  async healthCheck(): Promise<{
    sqlite: boolean;
    api: boolean;
    sync: boolean;
    online: boolean;
  }> {
    const online = await syncService.checkOnlineStatus();

    return {
      sqlite: this.isInitialized,
      api: true, // API is always "healthy" if initialized
      sync: !syncService['isSyncing'],
      online,
    };
  }
}

// Export singleton instance
export const databaseManager = new DatabaseManager();
export default databaseManager;
