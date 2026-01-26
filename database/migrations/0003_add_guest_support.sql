-- Add is_guest column to users table
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS is_guest BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS name TEXT;

-- Create an index for guest users if it doesn't exist
CREATE INDEX IF NOT EXISTS idx_users_is_guest ON users(is_guest);
