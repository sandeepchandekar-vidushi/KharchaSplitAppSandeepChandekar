-- Migration: Add currency field to groups table
-- Version: 1.0.1

-- Add currency column to groups table with default 'INR'
ALTER TABLE groups ADD COLUMN IF NOT EXISTS currency VARCHAR(3) DEFAULT 'INR';

-- Update existing groups to have INR currency
UPDATE groups SET currency = 'INR' WHERE currency IS NULL;

-- Add comment for documentation
COMMENT ON COLUMN groups.currency IS 'Default currency for the group (ISO 4217 code)';
