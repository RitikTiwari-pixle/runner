-- Migration 003: Add password_hash column to users table for local authentication
-- Nullable to preserve Firebase-authenticated users

ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255) NULL;

-- Create index for faster lookups during login
CREATE INDEX IF NOT EXISTS idx_users_firebase_uid ON users(firebase_uid) WHERE firebase_uid IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
