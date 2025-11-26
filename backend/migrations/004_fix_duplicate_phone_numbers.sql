-- Migration: Fix duplicate phone numbers and add UNIQUE constraint
-- This migration:
-- 1. Identifies and removes duplicate phone numbers (keeping the oldest record)
-- 2. Adds UNIQUE constraint to prevent future duplicates

BEGIN;

-- Step 1: Find and log duplicate phone numbers
DO $$
DECLARE
    duplicate_record RECORD;
BEGIN
    RAISE NOTICE 'Checking for duplicate phone numbers...';

    FOR duplicate_record IN
        SELECT phone_number, COUNT(*) as count, MIN(created_at) as first_created
        FROM users
        WHERE deleted_at IS NULL
        GROUP BY phone_number
        HAVING COUNT(*) > 1
    LOOP
        RAISE NOTICE 'Found duplicate phone: % (count: %, first created: %)',
            duplicate_record.phone_number,
            duplicate_record.count,
            duplicate_record.first_created;
    END LOOP;
END $$;

-- Step 2: Delete duplicate records (keep the oldest one for each phone number)
WITH RankedUsers AS (
    SELECT
        id,
        phone_number,
        created_at,
        ROW_NUMBER() OVER (PARTITION BY phone_number ORDER BY created_at ASC) as rn
    FROM users
    WHERE deleted_at IS NULL
)
DELETE FROM users
WHERE id IN (
    SELECT id FROM RankedUsers WHERE rn > 1
);

-- Step 3: Add UNIQUE constraint on phone_number if it doesn't exist
DO $$
BEGIN
    -- Check if constraint already exists
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'users_phone_number_unique'
    ) THEN
        ALTER TABLE users ADD CONSTRAINT users_phone_number_unique UNIQUE (phone_number);
        RAISE NOTICE 'UNIQUE constraint added successfully on phone_number';
    ELSE
        RAISE NOTICE 'UNIQUE constraint already exists on phone_number';
    END IF;
END $$;

-- Step 4: Create index if it doesn't exist (for performance)
-- Note: idx_users_phone already exists from initial schema, so we'll skip duplicate index creation
-- CREATE INDEX IF NOT EXISTS idx_users_phone_number ON users(phone_number) WHERE deleted_at IS NULL;

COMMIT;

-- Verify the fix
SELECT
    'After migration' as status,
    COUNT(*) as total_users,
    COUNT(DISTINCT phone_number) as unique_phones
FROM users
WHERE deleted_at IS NULL;
