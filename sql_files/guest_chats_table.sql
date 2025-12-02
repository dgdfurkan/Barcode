-- Guest Chats Table for IP-based guest users
-- This table stores chat messages for users who don't have accounts

CREATE TABLE IF NOT EXISTS guest_chats (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    ip_address INET NOT NULL,
    chat_messages TEXT DEFAULT '[]',
    last_chat_update TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_guest_chats_username ON guest_chats(username);
CREATE INDEX IF NOT EXISTS idx_guest_chats_ip ON guest_chats(ip_address);
CREATE INDEX IF NOT EXISTS idx_guest_chats_last_update ON guest_chats(last_chat_update);

-- Add comment for documentation
COMMENT ON TABLE guest_chats IS 'Chat messages for guest users (IP-based users without accounts)';
COMMENT ON COLUMN guest_chats.username IS 'Guest username format: Kullanıcı100, Kullanıcı101, etc.';
COMMENT ON COLUMN guest_chats.ip_address IS 'IP address of the guest user';
COMMENT ON COLUMN guest_chats.chat_messages IS 'JSON array of chat messages';

-- Enable RLS (Row Level Security)
ALTER TABLE guest_chats ENABLE ROW LEVEL SECURITY;

-- Policy: Allow anyone to read their own guest chat (by username)
CREATE POLICY "Users can read their own guest chat"
    ON guest_chats FOR SELECT
    USING (true); -- For now, allow all reads (can be restricted later)

-- Policy: Allow anyone to insert guest chats
CREATE POLICY "Anyone can create guest chat"
    ON guest_chats FOR INSERT
    WITH CHECK (true);

-- Policy: Allow anyone to update their own guest chat
CREATE POLICY "Users can update their own guest chat"
    ON guest_chats FOR UPDATE
    USING (true); -- For now, allow all updates (can be restricted later)

