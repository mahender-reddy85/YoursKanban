-- Add pinned column to tasks table
ALTER TABLE tasks ADD COLUMN pinned BOOLEAN DEFAULT FALSE;

-- Create index for pinned tasks (for sorting)
CREATE INDEX IF NOT EXISTS idx_tasks_pinned ON tasks(pinned DESC, created_at DESC);
