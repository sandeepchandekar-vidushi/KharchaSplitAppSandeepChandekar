-- Clear All Data from PostgreSQL Database
-- This script deletes all data from all tables while preserving the schema
-- WARNING: This is a destructive operation - use with caution!

-- Step 1: Disable foreign key checks temporarily
SET session_replication_role = 'replica';

-- Step 2: Clear all data from tables (in reverse dependency order)
-- Clear junction/child tables first

-- Activities
TRUNCATE TABLE activities CASCADE;

-- Expense participants
TRUNCATE TABLE expense_participants CASCADE;

-- Settlements
TRUNCATE TABLE settlements CASCADE;

-- Expenses
TRUNCATE TABLE expenses CASCADE;

-- Group members
TRUNCATE TABLE group_members CASCADE;

-- Groups
TRUNCATE TABLE groups CASCADE;

-- Personal expenses
TRUNCATE TABLE personal_expenses CASCADE;

-- Invites
TRUNCATE TABLE invites CASCADE;

-- FCM tokens
TRUNCATE TABLE fcm_tokens CASCADE;

-- Users (clear last as it's referenced by many tables)
TRUNCATE TABLE users CASCADE;

-- Step 3: Re-enable foreign key checks
SET session_replication_role = 'origin';

-- Step 4: Reset sequences (auto-increment counters)
-- This ensures IDs start from 1 again if you have any SERIAL columns
-- Note: Only add RESTART IDENTITY if your tables have SERIAL/SEQUENCE columns
-- ALTER SEQUENCE users_id_seq RESTART WITH 1;
-- ALTER SEQUENCE groups_id_seq RESTART WITH 1;
-- etc.

-- Step 5: Verification - Count rows in each table
SELECT 'users' as table_name, COUNT(*) as row_count FROM users
UNION ALL
SELECT 'groups', COUNT(*) FROM groups
UNION ALL
SELECT 'group_members', COUNT(*) FROM group_members
UNION ALL
SELECT 'expenses', COUNT(*) FROM expenses
UNION ALL
SELECT 'expense_participants', COUNT(*) FROM expense_participants
UNION ALL
SELECT 'settlements', COUNT(*) FROM settlements
UNION ALL
SELECT 'personal_expenses', COUNT(*) FROM personal_expenses
UNION ALL
SELECT 'invites', COUNT(*) FROM invites
UNION ALL
SELECT 'fcm_tokens', COUNT(*) FROM fcm_tokens
UNION ALL
SELECT 'activities', COUNT(*) FROM activities;

-- Expected result: All tables should show 0 rows
