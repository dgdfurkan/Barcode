-- Keyboard Shortcuts Migration Script
-- Adds keyboard_shortcuts column to users table
-- Safe migration: Existing users will have empty object {} by default

-- Add keyboard_shortcuts column to users table
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS keyboard_shortcuts JSONB DEFAULT '{}'::jsonb;

-- Update existing users to have empty keyboard shortcuts object if NULL
UPDATE users 
SET keyboard_shortcuts = '{}'::jsonb 
WHERE keyboard_shortcuts IS NULL;

-- Create index for better performance on keyboard shortcuts queries
CREATE INDEX IF NOT EXISTS idx_users_keyboard_shortcuts ON users USING GIN (keyboard_shortcuts);

-- Add comment for documentation
COMMENT ON COLUMN users.keyboard_shortcuts IS 'JSONB object containing keyboard shortcuts mapped to product searches. Example: {"K": "Sek Quark, Mandalina File", "F1": "Çay, Kahve"}';

