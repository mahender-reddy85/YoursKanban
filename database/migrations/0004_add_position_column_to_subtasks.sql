-- Add position column to subtasks table
ALTER TABLE subtasks ADD COLUMN position INTEGER DEFAULT 0 NOT NULL;
