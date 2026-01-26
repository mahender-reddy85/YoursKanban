-- Add firebase_uid column to users table
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS firebase_uid VARCHAR(255) UNIQUE,
ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS photo_url TEXT,
ADD COLUMN IF NOT EXISTS last_login TIMESTAMP WITH TIME ZONE;

-- Make email and password_hash nullable for Firebase users
ALTER TABLE users 
ALTER COLUMN password_hash DROP NOT NULL,
ALTER COLUMN name DROP NOT NULL;

-- Add index for faster lookups by firebase_uid
CREATE INDEX IF NOT EXISTS idx_users_firebase_uid ON users(firebase_uid);

-- Update the comment for the users table
COMMENT ON TABLE users IS 'Stores user accounts, supporting both email/password and Firebase authentication';
