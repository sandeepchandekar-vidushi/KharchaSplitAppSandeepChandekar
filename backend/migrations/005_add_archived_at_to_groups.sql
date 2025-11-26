-- Add archived_at column to groups table
-- This allows groups to be archived separately from deletion

ALTER TABLE groups
ADD COLUMN IF NOT EXISTS archived_at TIMESTAMP WITH TIME ZONE;

-- Add index for archived groups
CREATE INDEX IF NOT EXISTS idx_groups_archived ON groups(archived_at);

-- Add comment
COMMENT ON COLUMN groups.archived_at IS 'Timestamp when the group was archived. Archived groups are hidden from active view but not deleted.';
