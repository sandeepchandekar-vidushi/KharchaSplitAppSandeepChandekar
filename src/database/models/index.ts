/**
 * Database Models and Types
 * Defines TypeScript interfaces for all database entities
 */

// Base model with common fields
export interface BaseModel {
  id: string;
  created_at: number;
  updated_at: number;
  synced_at?: number;
  is_synced: 0 | 1; // SQLite doesn't have boolean
  deleted_at?: number;
}

// User model
export interface UserModel extends BaseModel {
  phone_number: string;
  name: string;
  email?: string;
  profile_image_base64?: string;
}

// Group model
export interface GroupModel extends BaseModel {
  name: string;
  description?: string;
  cover_image_base64?: string;
  created_by: string;
}

// Group member model
export interface GroupMemberModel extends BaseModel {
  group_id: string;
  user_id: string;
  name: string;
  phone_number?: string;
  email?: string;
  role: 'creator' | 'admin' | 'member';
  added_by?: string;
  joined_at: number;
}

// Expense model
export interface ExpenseModel extends BaseModel {
  group_id: string;
  description: string;
  amount: number;
  currency: string;
  category?: string;
  paid_by_id: string;
  paid_by_name: string;
  split_type: 'equal' | 'unequal' | 'percentage' | 'shares';
  receipt_base64?: string;
  notes?: string;
  expense_date: number;
}

// Expense participant model
export interface ExpenseParticipantModel {
  id: string;
  expense_id: string;
  user_id: string;
  name: string;
  amount: number;
  percentage?: number;
  shares?: number;
  created_at: number;
  updated_at: number;
  synced_at?: number;
  is_synced: 0 | 1;
}

// Settlement model
export interface SettlementModel extends BaseModel {
  group_id: string;
  from_user_id: string;
  to_user_id: string;
  amount: number;
  currency: string;
  status: 'pending' | 'confirmed' | 'paid';
  notes?: string;
  confirmed_at?: number;
}

// Personal expense model
export interface PersonalExpenseModel extends BaseModel {
  user_id: string;
  description: string;
  amount: number;
  currency: string;
  category?: string;
  receipt_base64?: string;
  notes?: string;
  expense_date: number;
}

// Sync queue model
export interface SyncQueueModel {
  id?: number; // Auto-increment
  operation_type: 'CREATE' | 'UPDATE' | 'DELETE';
  table_name: string;
  record_id: string;
  data: string; // JSON stringified data
  priority: number;
  retry_count: number;
  created_at: number;
  last_attempt_at?: number;
  error_message?: string;
}

// App metadata model
export interface AppMetadataModel {
  key: string;
  value: string;
  updated_at: number;
}

// Activity model
export interface ActivityModel extends BaseModel {
  group_id?: string;
  user_id: string;
  activity_type: string;
  entity_type: string;
  entity_id: string;
  title: string;
  description?: string;
  metadata?: string; // JSON stringified
  is_read: 0 | 1;
}

// API Response wrapper
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// Pagination
export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

// Sync status
export interface SyncStatus {
  table: string;
  lastSyncedAt?: number;
  pendingCount: number;
  failedCount: number;
}

// Database operation result
export interface DbOperationResult {
  success: boolean;
  rowsAffected?: number;
  insertId?: string;
  error?: string;
}

// Query options
export interface QueryOptions {
  limit?: number;
  offset?: number;
  orderBy?: string;
  orderDirection?: 'ASC' | 'DESC';
  where?: Record<string, any>;
}

// Export types for external use
export type {
  BaseModel as DbBaseModel,
  UserModel as DbUser,
  GroupModel as DbGroup,
  GroupMemberModel as DbGroupMember,
  ExpenseModel as DbExpense,
  ExpenseParticipantModel as DbExpenseParticipant,
  SettlementModel as DbSettlement,
  PersonalExpenseModel as DbPersonalExpense,
  SyncQueueModel as DbSyncQueue,
  AppMetadataModel as DbAppMetadata,
  ActivityModel as DbActivity,
};
