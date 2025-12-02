-- Premium Features Migration Script
-- Adds premium_features column to users table
-- Safe migration: Existing users will have empty object {} by default

-- Add premium_features column to users table
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS premium_features JSONB DEFAULT '{}'::jsonb;

-- Update existing users to have empty premium features object if NULL
UPDATE users 
SET premium_features = '{}'::jsonb 
WHERE premium_features IS NULL;

-- Create index for better performance on premium features queries
CREATE INDEX IF NOT EXISTS idx_users_premium_features ON users USING GIN (premium_features);

-- Add comment for documentation
COMMENT ON COLUMN users.premium_features IS 'JSONB object containing enabled premium features for the user. Example: {"autoPaste": true, "keyboardShortcuts": false}';

