-- Fix Missing Group Members
-- This script adds the creator as a member to all groups that don't have any members

-- Step 1: Check which groups are missing members
SELECT
    g.id,
    g.name,
    g.created_by,
    COUNT(gm.id) as member_count
FROM groups g
LEFT JOIN group_members gm ON g.id = gm.group_id
WHERE g.deleted_at IS NULL
GROUP BY g.id, g.name, g.created_by
HAVING COUNT(gm.id) = 0;

-- Step 2: Insert creator as admin member for all groups without members
INSERT INTO group_members (group_id, user_id, name, role, joined_at, added_by)
SELECT
    g.id as group_id,
    g.created_by as user_id,
    COALESCE(u.name, 'Group Creator') as name,
    'creator' as role,
    g.created_at as joined_at,
    g.created_by as added_by
FROM groups g
LEFT JOIN users u ON g.created_by = u.id
WHERE g.deleted_at IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM group_members gm
    WHERE gm.group_id = g.id
    AND gm.user_id = g.created_by
  );

-- Step 3: Verify the fix
SELECT
    g.id,
    g.name,
    g.created_by,
    COUNT(gm.id) as member_count,
    STRING_AGG(gm.name, ', ') as members
FROM groups g
LEFT JOIN group_members gm ON g.id = gm.group_id
WHERE g.deleted_at IS NULL
GROUP BY g.id, g.name, g.created_by
ORDER BY g.created_at DESC
LIMIT 20;
