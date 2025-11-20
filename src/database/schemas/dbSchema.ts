/**
 * SQLite Database Schema
 * Defines all table structures for local database
 */

export const DB_NAME = 'kharchasplit.db';
export const DB_VERSION = '1.0';

/**
 * SQL statements to create tables
 */
export const CREATE_TABLES = {
  // Users table
  users: `
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      phone_number TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      email TEXT,
      profile_image_base64 TEXT,
      preferred_currency TEXT DEFAULT 'INR',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      synced_at INTEGER,
      is_synced INTEGER DEFAULT 0,
      deleted_at INTEGER
    );
  `,

  // Groups table
  groups: `
    CREATE TABLE IF NOT EXISTS groups (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      cover_image_base64 TEXT,
      currency TEXT DEFAULT 'INR',
      created_by TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      synced_at INTEGER,
      is_synced INTEGER DEFAULT 0,
      deleted_at INTEGER,
      FOREIGN KEY (created_by) REFERENCES users(id)
    );
  `,

  // Group members table (junction table)
  group_members: `
    CREATE TABLE IF NOT EXISTS group_members (
      id TEXT PRIMARY KEY,
      group_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      phone_number TEXT,
      email TEXT,
      role TEXT DEFAULT 'member',
      added_by TEXT,
      joined_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      synced_at INTEGER,
      is_synced INTEGER DEFAULT 0,
      deleted_at INTEGER,
      FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (added_by) REFERENCES users(id),
      UNIQUE(group_id, user_id)
    );
  `,

  // Expenses table
  expenses: `
    CREATE TABLE IF NOT EXISTS expenses (
      id TEXT PRIMARY KEY,
      group_id TEXT NOT NULL,
      description TEXT NOT NULL,
      amount REAL NOT NULL,
      currency TEXT DEFAULT 'USD',
      category TEXT,
      paid_by_id TEXT NOT NULL,
      paid_by_name TEXT NOT NULL,
      split_type TEXT DEFAULT 'equal',
      receipt_base64 TEXT,
      notes TEXT,
      expense_date INTEGER NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      synced_at INTEGER,
      is_synced INTEGER DEFAULT 0,
      deleted_at INTEGER,
      FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE,
      FOREIGN KEY (paid_by_id) REFERENCES users(id)
    );
  `,

  // Expense participants table (who owes what)
  expense_participants: `
    CREATE TABLE IF NOT EXISTS expense_participants (
      id TEXT PRIMARY KEY,
      expense_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      amount REAL NOT NULL,
      percentage REAL,
      shares INTEGER,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      synced_at INTEGER,
      is_synced INTEGER DEFAULT 0,
      FOREIGN KEY (expense_id) REFERENCES expenses(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
  `,

  // Settlements table
  settlements: `
    CREATE TABLE IF NOT EXISTS settlements (
      id TEXT PRIMARY KEY,
      group_id TEXT NOT NULL,
      from_user_id TEXT NOT NULL,
      to_user_id TEXT NOT NULL,
      amount REAL NOT NULL,
      currency TEXT DEFAULT 'USD',
      status TEXT DEFAULT 'pending',
      notes TEXT,
      created_at INTEGER NOT NULL,
      confirmed_at INTEGER,
      updated_at INTEGER NOT NULL,
      synced_at INTEGER,
      is_synced INTEGER DEFAULT 0,
      deleted_at INTEGER,
      FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE,
      FOREIGN KEY (from_user_id) REFERENCES users(id),
      FOREIGN KEY (to_user_id) REFERENCES users(id)
    );
  `,

  // Personal expenses table
  personal_expenses: `
    CREATE TABLE IF NOT EXISTS personal_expenses (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      description TEXT NOT NULL,
      amount REAL NOT NULL,
      currency TEXT DEFAULT 'USD',
      category TEXT,
      receipt_base64 TEXT,
      notes TEXT,
      expense_date INTEGER NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      synced_at INTEGER,
      is_synced INTEGER DEFAULT 0,
      deleted_at INTEGER,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
  `,

  // Sync queue table (for offline operations)
  sync_queue: `
    CREATE TABLE IF NOT EXISTS sync_queue (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      operation_type TEXT NOT NULL,
      table_name TEXT NOT NULL,
      record_id TEXT NOT NULL,
      data TEXT NOT NULL,
      priority INTEGER DEFAULT 0,
      retry_count INTEGER DEFAULT 0,
      created_at INTEGER NOT NULL,
      last_attempt_at INTEGER,
      error_message TEXT
    );
  `,

  // App metadata table
  app_metadata: `
    CREATE TABLE IF NOT EXISTS app_metadata (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    );
  `,

  // Activities table (for activity feed/notifications)
  activities: `
    CREATE TABLE IF NOT EXISTS activities (
      id TEXT PRIMARY KEY,
      group_id TEXT,
      user_id TEXT NOT NULL,
      activity_type TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      metadata TEXT,
      is_read INTEGER DEFAULT 0,
      created_at INTEGER NOT NULL,
      synced_at INTEGER,
      is_synced INTEGER DEFAULT 0,
      deleted_at INTEGER,
      FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
  `,
};

/**
 * Indexes for better query performance
 */
export const CREATE_INDEXES = {
  users_phone: 'CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone_number);',
  users_synced: 'CREATE INDEX IF NOT EXISTS idx_users_synced ON users(is_synced);',

  groups_created_by: 'CREATE INDEX IF NOT EXISTS idx_groups_created_by ON groups(created_by);',
  groups_synced: 'CREATE INDEX IF NOT EXISTS idx_groups_synced ON groups(is_synced);',

  group_members_group: 'CREATE INDEX IF NOT EXISTS idx_group_members_group ON group_members(group_id);',
  group_members_user: 'CREATE INDEX IF NOT EXISTS idx_group_members_user ON group_members(user_id);',
  group_members_synced: 'CREATE INDEX IF NOT EXISTS idx_group_members_synced ON group_members(is_synced);',

  expenses_group: 'CREATE INDEX IF NOT EXISTS idx_expenses_group ON expenses(group_id);',
  expenses_paid_by: 'CREATE INDEX IF NOT EXISTS idx_expenses_paid_by ON expenses(paid_by_id);',
  expenses_date: 'CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(expense_date);',
  expenses_synced: 'CREATE INDEX IF NOT EXISTS idx_expenses_synced ON expenses(is_synced);',

  expense_participants_expense: 'CREATE INDEX IF NOT EXISTS idx_expense_participants_expense ON expense_participants(expense_id);',
  expense_participants_user: 'CREATE INDEX IF NOT EXISTS idx_expense_participants_user ON expense_participants(user_id);',

  settlements_group: 'CREATE INDEX IF NOT EXISTS idx_settlements_group ON settlements(group_id);',
  settlements_from: 'CREATE INDEX IF NOT EXISTS idx_settlements_from ON settlements(from_user_id);',
  settlements_to: 'CREATE INDEX IF NOT EXISTS idx_settlements_to ON settlements(to_user_id);',
  settlements_status: 'CREATE INDEX IF NOT EXISTS idx_settlements_status ON settlements(status);',
  settlements_synced: 'CREATE INDEX IF NOT EXISTS idx_settlements_synced ON settlements(is_synced);',

  personal_expenses_user: 'CREATE INDEX IF NOT EXISTS idx_personal_expenses_user ON personal_expenses(user_id);',
  personal_expenses_date: 'CREATE INDEX IF NOT EXISTS idx_personal_expenses_date ON personal_expenses(expense_date);',
  personal_expenses_synced: 'CREATE INDEX IF NOT EXISTS idx_personal_expenses_synced ON personal_expenses(is_synced);',

  sync_queue_priority: 'CREATE INDEX IF NOT EXISTS idx_sync_queue_priority ON sync_queue(priority, created_at);',
  sync_queue_table: 'CREATE INDEX IF NOT EXISTS idx_sync_queue_table ON sync_queue(table_name, record_id);',

  activities_group: 'CREATE INDEX IF NOT EXISTS idx_activities_group ON activities(group_id);',
  activities_user: 'CREATE INDEX IF NOT EXISTS idx_activities_user ON activities(user_id);',
  activities_type: 'CREATE INDEX IF NOT EXISTS idx_activities_type ON activities(activity_type);',
  activities_created: 'CREATE INDEX IF NOT EXISTS idx_activities_created ON activities(created_at);',
  activities_read: 'CREATE INDEX IF NOT EXISTS idx_activities_read ON activities(is_read);',
  activities_synced: 'CREATE INDEX IF NOT EXISTS idx_activities_synced ON activities(is_synced);',
};

/**
 * Drop all tables (for testing/reset purposes)
 */
export const DROP_TABLES = {
  activities: 'DROP TABLE IF EXISTS activities;',
  users: 'DROP TABLE IF EXISTS users;',
  groups: 'DROP TABLE IF EXISTS groups;',
  group_members: 'DROP TABLE IF EXISTS group_members;',
  expenses: 'DROP TABLE IF EXISTS expenses;',
  expense_participants: 'DROP TABLE IF EXISTS expense_participants;',
  settlements: 'DROP TABLE IF EXISTS settlements;',
  personal_expenses: 'DROP TABLE IF EXISTS personal_expenses;',
  sync_queue: 'DROP TABLE IF EXISTS sync_queue;',
  app_metadata: 'DROP TABLE IF EXISTS app_metadata;',
};
