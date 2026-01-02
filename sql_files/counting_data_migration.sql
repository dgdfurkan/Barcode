-- Counting Data Migration Script
-- Adds counting_data column to users table
-- Safe migration: Existing users will have empty object {} by default

-- Add counting_data column to users table
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS counting_data JSONB DEFAULT '{}'::jsonb;

-- Update existing users to have empty counting data object if NULL
UPDATE users 
SET counting_data = '{}'::jsonb 
WHERE counting_data IS NULL;

-- Create index for better performance on counting data queries
CREATE INDEX IF NOT EXISTS idx_users_counting_data ON users USING GIN (counting_data);

-- Add comment for documentation
COMMENT ON COLUMN users.counting_data IS 'JSONB object containing stock counting data. Structure: {"products": [{"id": "...", "warehouseStock": 10, "systemStock": 8, "history": [...]}], "lastSync": "2024-01-01T12:00:00Z"}';

