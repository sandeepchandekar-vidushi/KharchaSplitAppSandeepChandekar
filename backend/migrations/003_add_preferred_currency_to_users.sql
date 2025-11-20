-- Migration: Add preferred_currency field to users table
-- Version: 1.0.2

-- Add preferred_currency column to users table with default 'INR'
ALTER TABLE users ADD COLUMN IF NOT EXISTS preferred_currency VARCHAR(3) DEFAULT 'INR';

-- Update existing users to have INR as preferred currency
UPDATE users SET preferred_currency = 'INR' WHERE preferred_currency IS NULL;

-- Add comment for documentation
COMMENT ON COLUMN users.preferred_currency IS 'User preferred currency for expenses (ISO 4217 code)';
