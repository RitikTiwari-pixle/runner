-- Migration: Add Google OAuth Support
-- Purpose: Add fields to support Google OAuth login
-- Date: 2026-04-05

-- Add google_oauth columns to users table
ALTER TABLE users
ADD COLUMN IF NOT EXISTS google_id VARCHAR(255) UNIQUE,
ADD COLUMN IF NOT EXISTS profile_picture_url TEXT;

-- Create index on google_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_users_google_id ON users(google_id) WHERE google_id IS NOT NULL;

-- Log migration handled by runner
