/**
 * Data Sync Service
 * Manages synchronization between local SQLite and PostgreSQL backend
 * Implements offline-first strategy with conflict resolution
 */

import { sqliteService } from './sqliteService';
import { apiService } from './apiService';
import { SyncQueueModel, SyncStatus } from '../models';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';

// Sync configuration
const SYNC_CONFIG = {
  AUTO_SYNC_INTERVAL: 5 * 60 * 1000, // 5 minutes
  MAX_RETRY_COUNT: 3,
  BATCH_SIZE: 50,
};

// Storage keys for sync metadata
const SYNC_STORAGE_KEYS = {
  LAST_SYNC: '@last_sync_time',
  SYNC_ENABLED: '@sync_enabled',
};

type SyncDirection = 'push' | 'pull' | 'both';
type SyncTable = 'users' | 'groups' | 'group_members' | 'expenses' | 'expense_participants' | 'settlements' | 'personal_expenses';

class SyncService {
  private isSyncing = false;
  private autoSyncInterval: NodeJS.Timeout | null = null;
  private isOnline = true;

  constructor() {
    this.initializeNetworkListener();
  }

  /**
   * Initialize network connectivity listener
   */
  private initializeNetworkListener(): void {
    NetInfo.addEventListener((state) => {
      const wasOffline = !this.isOnline;
      this.isOnline = state.isConnected ?? false;

      console.log(`[SyncService] Network status: ${this.isOnline ? 'Online' : 'Offline'}`);

      // Trigger sync when coming back online
      if (wasOffline && this.isOnline) {
        console.log('[SyncService] Back online, triggering sync...');
        this.syncAll('push').catch((error) => {
          console.error('[SyncService] Auto-sync after reconnect failed:', error);
        });
      }
    });
  }

  /**
   * Check if device is online
   */
  async checkOnlineStatus(): Promise<boolean> {
    const state = await NetInfo.fetch();
    this.isOnline = state.isConnected ?? false;
    return this.isOnline;
  }

  /**
   * Start automatic sync
   */
  async startAutoSync(): Promise<void> {
    const isSyncEnabled = await AsyncStorage.getItem(SYNC_STORAGE_KEYS.SYNC_ENABLED);
    if (isSyncEnabled === 'false') {
      console.log('[SyncService] Auto-sync is disabled');
      return;
    }

    if (this.autoSyncInterval) {
      console.log('[SyncService] Auto-sync already running');
      return;
    }

    console.log('[SyncService] Starting auto-sync...');
    this.autoSyncInterval = setInterval(async () => {
      if (this.isOnline && !this.isSyncing) {
        try {
          await this.syncAll('both');
        } catch (error) {
          console.error('[SyncService] Auto-sync error:', error);
        }
      }
    }, SYNC_CONFIG.AUTO_SYNC_INTERVAL);
  }

  /**
   * Stop automatic sync
   */
  stopAutoSync(): void {
    if (this.autoSyncInterval) {
      clearInterval(this.autoSyncInterval);
      this.autoSyncInterval = null;
      console.log('[SyncService] Auto-sync stopped');
    }
  }

  /**
   * Enable or disable sync
   */
  async setSyncEnabled(enabled: boolean): Promise<void> {
    await AsyncStorage.setItem(SYNC_STORAGE_KEYS.SYNC_ENABLED, enabled.toString());
    if (enabled) {
      await this.startAutoSync();
    } else {
      this.stopAutoSync();
    }
  }

  /**
   * Main sync function
   */
  async syncAll(direction: SyncDirection = 'both'): Promise<void> {
    if (this.isSyncing) {
      console.log('[SyncService] Sync already in progress');
      return;
    }

    if (!this.isOnline) {
      console.log('[SyncService] Device is offline, skipping sync');
      return;
    }

    this.isSyncing = true;
    console.log(`[SyncService] Starting ${direction} sync...`);

    try {
      // Push local changes to server
      if (direction === 'push' || direction === 'both') {
        await this.pushLocalChanges();
      }

      // Pull remote changes from server
      if (direction === 'pull' || direction === 'both') {
        await this.pullRemoteChanges();
      }

      // Update last sync time
      await AsyncStorage.setItem(SYNC_STORAGE_KEYS.LAST_SYNC, Date.now().toString());
      console.log('[SyncService] Sync completed successfully');
    } catch (error) {
      console.error('[SyncService] Sync failed:', error);
      throw error;
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Push local changes to server
   */
  private async pushLocalChanges(): Promise<void> {
    console.log('[SyncService] Pushing local changes...');

    // Get all unsynced records from sync queue
    const queue = await sqliteService.select<SyncQueueModel>('sync_queue', {
      orderBy: 'priority',
      orderDirection: 'DESC',
    });

    if (queue.length === 0) {
      console.log('[SyncService] No local changes to push');
      return;
    }

    console.log(`[SyncService] Found ${queue.length} items in sync queue`);

    // Process queue in batches
    for (let i = 0; i < queue.length; i += SYNC_CONFIG.BATCH_SIZE) {
      const batch = queue.slice(i, i + SYNC_CONFIG.BATCH_SIZE);
      await this.processSyncBatch(batch);
    }
  }

  /**
   * Process a batch of sync queue items
   */
  private async processSyncBatch(batch: SyncQueueModel[]): Promise<void> {
    for (const item of batch) {
      try {
        const data = JSON.parse(item.data);
        let success = false;

        // Execute the operation on server
        switch (item.operation_type) {
          case 'CREATE':
            success = await this.syncCreate(item.table_name, data);
            break;
          case 'UPDATE':
            success = await this.syncUpdate(item.table_name, item.record_id, data);
            break;
          case 'DELETE':
            success = await this.syncDelete(item.table_name, item.record_id);
            break;
        }

        if (success) {
          // Remove from queue
          await sqliteService.delete('sync_queue', { id: item.id! });

          // Mark record as synced
          await sqliteService.update(
            item.table_name,
            { is_synced: 1, synced_at: Date.now() },
            { id: item.record_id }
          );

          console.log(`[SyncService] Synced ${item.operation_type} on ${item.table_name}/${item.record_id}`);
        } else {
          // Increment retry count
          const retryCount = (item.retry_count || 0) + 1;
          if (retryCount >= SYNC_CONFIG.MAX_RETRY_COUNT) {
            console.error(`[SyncService] Max retries reached for ${item.table_name}/${item.record_id}`);
            // Optionally: Move to failed queue or notify user
          } else {
            await sqliteService.update(
              'sync_queue',
              { retry_count: retryCount, last_attempt_at: Date.now() },
              { id: item.id! }
            );
          }
        }
      } catch (error: any) {
        console.error(`[SyncService] Error processing sync item:`, error);
        await sqliteService.update(
          'sync_queue',
          { error_message: error.message, last_attempt_at: Date.now() },
          { id: item.id! }
        );
      }
    }
  }

  /**
   * Sync CREATE operation
   */
  private async syncCreate(table: string, data: any): Promise<boolean> {
    let endpoint = '';

    switch (table) {
      case 'groups':
        endpoint = '/groups';
        break;
      case 'expenses':
        endpoint = '/expenses';
        break;
      case 'settlements':
        endpoint = '/settlements';
        break;
      case 'personal_expenses':
        endpoint = '/personal-expenses';
        break;
      default:
        console.warn(`[SyncService] Unknown table for CREATE: ${table}`);
        return false;
    }

    const result = await apiService.post(endpoint, data);
    return result.success;
  }

  /**
   * Sync UPDATE operation
   */
  private async syncUpdate(table: string, recordId: string, data: any): Promise<boolean> {
    let endpoint = '';

    switch (table) {
      case 'users':
        endpoint = `/users/${recordId}`;
        break;
      case 'groups':
        endpoint = `/groups/${recordId}`;
        break;
      case 'expenses':
        endpoint = `/expenses/${recordId}`;
        break;
      case 'personal_expenses':
        endpoint = `/personal-expenses/${recordId}`;
        break;
      default:
        console.warn(`[SyncService] Unknown table for UPDATE: ${table}`);
        return false;
    }

    const result = await apiService.put(endpoint, data);
    return result.success;
  }

  /**
   * Sync DELETE operation
   */
  private async syncDelete(table: string, recordId: string): Promise<boolean> {
    let endpoint = '';

    switch (table) {
      case 'groups':
        endpoint = `/groups/${recordId}`;
        break;
      case 'expenses':
        endpoint = `/expenses/${recordId}`;
        break;
      case 'personal_expenses':
        endpoint = `/personal-expenses/${recordId}`;
        break;
      default:
        console.warn(`[SyncService] Unknown table for DELETE: ${table}`);
        return false;
    }

    const result = await apiService.delete(endpoint);
    return result.success;
  }

  /**
   * Pull remote changes from server
   */
  private async pullRemoteChanges(): Promise<void> {
    console.log('[SyncService] Pulling remote changes...');

    const lastSync = await AsyncStorage.getItem(SYNC_STORAGE_KEYS.LAST_SYNC);
    const lastSyncTime = lastSync ? parseInt(lastSync, 10) : 0;

    // TODO: Implement pull logic based on your API structure
    // This would typically involve:
    // 1. GET updated records from server since lastSyncTime
    // 2. Resolve conflicts (server wins, client wins, or merge)
    // 3. Update local database

    console.log(`[SyncService] Pull from server (last sync: ${lastSyncTime})`);
  }

  /**
   * Add operation to sync queue
   */
  async queueOperation(
    operation: 'CREATE' | 'UPDATE' | 'DELETE',
    table: SyncTable,
    recordId: string,
    data: any,
    priority = 0
  ): Promise<void> {
    const queueItem: Partial<SyncQueueModel> = {
      operation_type: operation,
      table_name: table,
      record_id: recordId,
      data: JSON.stringify(data),
      priority,
      retry_count: 0,
      created_at: Date.now(),
    };

    await sqliteService.insert('sync_queue', queueItem);
    console.log(`[SyncService] Queued ${operation} on ${table}/${recordId}`);

    // Trigger sync if online
    if (this.isOnline && !this.isSyncing) {
      // Don't await - sync in background
      this.syncAll('push').catch((error) => {
        console.error('[SyncService] Background sync failed:', error);
      });
    }
  }

  /**
   * Get sync status for all tables
   */
  async getSyncStatus(): Promise<SyncStatus[]> {
    const tables: SyncTable[] = [
      'users',
      'groups',
      'group_members',
      'expenses',
      'expense_participants',
      'settlements',
      'personal_expenses',
    ];

    const statuses: SyncStatus[] = [];

    for (const table of tables) {
      const pendingCount = await sqliteService.count('sync_queue', { table_name: table });
      const lastSynced = await sqliteService.query<{ synced_at: number }>(
        `SELECT MAX(synced_at) as synced_at FROM ${table} WHERE is_synced = 1`
      );

      statuses.push({
        table,
        lastSyncedAt: lastSynced[0]?.synced_at,
        pendingCount,
        failedCount: 0, // TODO: Implement failed count
      });
    }

    return statuses;
  }

  /**
   * Get last sync timestamp
   */
  async getLastSyncTime(): Promise<number | null> {
    const lastSync = await AsyncStorage.getItem(SYNC_STORAGE_KEYS.LAST_SYNC);
    return lastSync ? parseInt(lastSync, 10) : null;
  }

  /**
   * Clear sync queue
   */
  async clearSyncQueue(): Promise<void> {
    await sqliteService.clearTable('sync_queue');
    console.log('[SyncService] Sync queue cleared');
  }

  /**
   * Force sync for a specific table
   */
  async syncTable(table: SyncTable, direction: SyncDirection = 'both'): Promise<void> {
    console.log(`[SyncService] Syncing table: ${table} (${direction})`);

    if (direction === 'push' || direction === 'both') {
      const queue = await sqliteService.select<SyncQueueModel>('sync_queue', {
        where: { table_name: table },
      });
      await this.processSyncBatch(queue);
    }

    // TODO: Implement pull for specific table
  }
}

// Export singleton instance
export const syncService = new SyncService();
export default syncService;
