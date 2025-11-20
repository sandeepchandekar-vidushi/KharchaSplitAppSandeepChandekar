/**
 * SQLite Database Service
 * Handles all local database operations using react-native-sqlite-storage
 */

import SQLite, { SQLiteDatabase, ResultSet } from 'react-native-sqlite-storage';
import { CREATE_TABLES, CREATE_INDEXES, DB_NAME, DROP_TABLES } from '../schemas/dbSchema';
import { DbOperationResult, QueryOptions } from '../models';

// Enable promise API and debugging
SQLite.enablePromise(true);
SQLite.DEBUG(__DEV__);

class SQLiteService {
  private db: SQLiteDatabase | null = null;
  private isInitialized = false;

  /**
   * Initialize database connection and create tables
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      console.log('[SQLiteService] Already initialized');
      return;
    }

    try {
      console.log('[SQLiteService] Opening database...');
      this.db = await SQLite.openDatabase({
        name: DB_NAME,
        location: 'default',
      });

      console.log('[SQLiteService] Creating tables...');
      await this.createTables();

      console.log('[SQLiteService] Creating indexes...');
      await this.createIndexes();

      this.isInitialized = true;
      console.log('[SQLiteService] Database initialized successfully');
    } catch (error) {
      console.error('[SQLiteService] Failed to initialize database:', error);
      throw error;
    }
  }

  /**
   * Get database instance
   */
  private getDb(): SQLiteDatabase {
    if (!this.db) {
      throw new Error('Database not initialized. Call initialize() first.');
    }
    return this.db;
  }

  /**
   * Create all tables
   */
  private async createTables(): Promise<void> {
    const db = this.getDb();

    for (const [tableName, createSQL] of Object.entries(CREATE_TABLES)) {
      try {
        await db.executeSql(createSQL);
        console.log(`[SQLiteService] Created table: ${tableName}`);
      } catch (error) {
        console.error(`[SQLiteService] Error creating table ${tableName}:`, error);
        throw error;
      }
    }
  }

  /**
   * Create all indexes
   */
  private async createIndexes(): Promise<void> {
    const db = this.getDb();

    for (const [indexName, createSQL] of Object.entries(CREATE_INDEXES)) {
      try {
        await db.executeSql(createSQL);
        console.log(`[SQLiteService] Created index: ${indexName}`);
      } catch (error) {
        console.error(`[SQLiteService] Error creating index ${indexName}:`, error);
        // Don't throw on index errors, just log
      }
    }
  }

  /**
   * Execute a SQL query
   */
  async executeSql(sql: string, params: any[] = []): Promise<ResultSet> {
    const db = this.getDb();
    try {
      const [result] = await db.executeSql(sql, params);
      return result;
    } catch (error) {
      console.error('[SQLiteService] SQL execution error:', error);
      console.error('[SQLiteService] SQL:', sql);
      console.error('[SQLiteService] Params:', params);
      throw error;
    }
  }

  /**
   * Execute multiple SQL statements in a transaction
   */
  async executeTransaction(statements: Array<{ sql: string; params?: any[] }>): Promise<void> {
    const db = this.getDb();

    return new Promise((resolve, reject) => {
      db.transaction(
        (tx) => {
          statements.forEach(({ sql, params = [] }) => {
            tx.executeSql(sql, params);
          });
        },
        (error) => {
          console.error('[SQLiteService] Transaction error:', error);
          reject(error);
        },
        () => {
          resolve();
        }
      );
    });
  }

  /**
   * Insert a record
   */
  async insert(table: string, data: Record<string, any>): Promise<DbOperationResult> {
    const columns = Object.keys(data);
    const values = Object.values(data);
    const placeholders = columns.map(() => '?').join(', ');

    const sql = `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`;

    try {
      const result = await this.executeSql(sql, values);
      return {
        success: true,
        rowsAffected: result.rowsAffected,
        insertId: result.insertId?.toString(),
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Update records
   */
  async update(
    table: string,
    data: Record<string, any>,
    where: Record<string, any>
  ): Promise<DbOperationResult> {
    const setClause = Object.keys(data)
      .map((key) => `${key} = ?`)
      .join(', ');
    const whereClause = Object.keys(where)
      .map((key) => `${key} = ?`)
      .join(' AND ');

    const values = [...Object.values(data), ...Object.values(where)];
    const sql = `UPDATE ${table} SET ${setClause} WHERE ${whereClause}`;

    try {
      const result = await this.executeSql(sql, values);
      return {
        success: true,
        rowsAffected: result.rowsAffected,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Delete records
   */
  async delete(table: string, where: Record<string, any>): Promise<DbOperationResult> {
    const whereClause = Object.keys(where)
      .map((key) => `${key} = ?`)
      .join(' AND ');
    const values = Object.values(where);

    const sql = `DELETE FROM ${table} WHERE ${whereClause}`;

    try {
      const result = await this.executeSql(sql, values);
      return {
        success: true,
        rowsAffected: result.rowsAffected,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Soft delete (set deleted_at timestamp)
   */
  async softDelete(table: string, where: Record<string, any>): Promise<DbOperationResult> {
    return this.update(table, { deleted_at: Date.now() }, where);
  }

  /**
   * Select records
   */
  async select<T = any>(
    table: string,
    options: QueryOptions = {}
  ): Promise<T[]> {
    const { limit, offset, orderBy, orderDirection = 'ASC', where } = options;

    let sql = `SELECT * FROM ${table}`;
    const params: any[] = [];

    // Add WHERE clause
    if (where && Object.keys(where).length > 0) {
      const whereClause = Object.keys(where)
        .map((key) => `${key} = ?`)
        .join(' AND ');
      sql += ` WHERE ${whereClause}`;
      params.push(...Object.values(where));
    }

    // Add ORDER BY clause
    if (orderBy) {
      sql += ` ORDER BY ${orderBy} ${orderDirection}`;
    }

    // Add LIMIT and OFFSET
    if (limit) {
      sql += ` LIMIT ?`;
      params.push(limit);
    }
    if (offset) {
      sql += ` OFFSET ?`;
      params.push(offset);
    }

    try {
      const result = await this.executeSql(sql, params);
      const rows: T[] = [];

      for (let i = 0; i < result.rows.length; i++) {
        rows.push(result.rows.item(i));
      }

      return rows;
    } catch (error) {
      console.error('[SQLiteService] Select error:', error);
      return [];
    }
  }

  /**
   * Find a single record by ID
   */
  async findById<T = any>(table: string, id: string): Promise<T | null> {
    const results = await this.select<T>(table, { where: { id }, limit: 1 });
    return results.length > 0 ? results[0] : null;
  }

  /**
   * Count records
   */
  async count(table: string, where?: Record<string, any>): Promise<number> {
    let sql = `SELECT COUNT(*) as count FROM ${table}`;
    const params: any[] = [];

    if (where && Object.keys(where).length > 0) {
      const whereClause = Object.keys(where)
        .map((key) => `${key} = ?`)
        .join(' AND ');
      sql += ` WHERE ${whereClause}`;
      params.push(...Object.values(where));
    }

    try {
      const result = await this.executeSql(sql, params);
      return result.rows.item(0).count;
    } catch (error) {
      console.error('[SQLiteService] Count error:', error);
      return 0;
    }
  }

  /**
   * Execute custom query
   */
  async query<T = any>(sql: string, params: any[] = []): Promise<T[]> {
    try {
      const result = await this.executeSql(sql, params);
      const rows: T[] = [];

      for (let i = 0; i < result.rows.length; i++) {
        rows.push(result.rows.item(i));
      }

      return rows;
    } catch (error) {
      console.error('[SQLiteService] Query error:', error);
      return [];
    }
  }

  /**
   * Clear all data from a table
   */
  async clearTable(table: string): Promise<DbOperationResult> {
    const sql = `DELETE FROM ${table}`;

    try {
      const result = await this.executeSql(sql);
      return {
        success: true,
        rowsAffected: result.rowsAffected,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Drop all tables (for testing/reset)
   */
  async dropAllTables(): Promise<void> {
    const db = this.getDb();

    for (const [tableName, dropSQL] of Object.entries(DROP_TABLES)) {
      try {
        await db.executeSql(dropSQL);
        console.log(`[SQLiteService] Dropped table: ${tableName}`);
      } catch (error) {
        console.error(`[SQLiteService] Error dropping table ${tableName}:`, error);
      }
    }
  }

  /**
   * Reset database (drop and recreate all tables)
   */
  async resetDatabase(): Promise<void> {
    console.log('[SQLiteService] Resetting database...');
    await this.dropAllTables();
    await this.createTables();
    await this.createIndexes();
    console.log('[SQLiteService] Database reset complete');
  }

  /**
   * Close database connection
   */
  async close(): Promise<void> {
    if (this.db) {
      await this.db.close();
      this.db = null;
      this.isInitialized = false;
      console.log('[SQLiteService] Database closed');
    }
  }

  /**
   * Get database statistics
   */
  async getStatistics(): Promise<Record<string, number>> {
    const tables = [
      'users',
      'groups',
      'group_members',
      'expenses',
      'expense_participants',
      'settlements',
      'personal_expenses',
      'sync_queue',
    ];

    const stats: Record<string, number> = {};

    for (const table of tables) {
      stats[table] = await this.count(table);
    }

    return stats;
  }
}

// Export singleton instance
export const sqliteService = new SQLiteService();
export default sqliteService;
