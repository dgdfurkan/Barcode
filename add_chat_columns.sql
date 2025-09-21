-- Add chat columns to users table
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS chat_messages TEXT DEFAULT '[]',
ADD COLUMN IF NOT EXISTS last_chat_update TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Update existing users to have empty chat_messages array
UPDATE users 
SET chat_messages = '[]' 
WHERE chat_messages IS NULL;

-- Add comment for documentation
COMMENT ON COLUMN users.chat_messages IS 'JSON array of chat messages for this user';
COMMENT ON COLUMN users.last_chat_update IS 'Last time chat was updated for this user';
