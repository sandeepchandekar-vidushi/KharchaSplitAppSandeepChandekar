-- Migration: 006_add_fcm_token_to_users
-- Description: Add FCM token column to users table for push notifications
-- Date: 2025-11-27

-- Add fcm_token column to users table
ALTER TABLE users
ADD COLUMN IF NOT EXISTS fcm_token TEXT,
ADD COLUMN IF NOT EXISTS fcm_token_updated_at TIMESTAMP WITH TIME ZONE;

-- Create index for faster token lookups
CREATE INDEX IF NOT EXISTS idx_users_fcm_token ON users(fcm_token) WHERE fcm_token IS NOT NULL;

-- Add comment
COMMENT ON COLUMN users.fcm_token IS 'Firebase Cloud Messaging token for push notifications';
COMMENT ON COLUMN users.fcm_token_updated_at IS 'Timestamp when FCM token was last updated';
