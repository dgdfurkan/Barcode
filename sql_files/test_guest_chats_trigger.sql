-- Test script to verify guest_chats telegram trigger is working
-- Run this in Supabase SQL Editor to test the trigger

-- 1. Check if trigger exists
SELECT trigger_name, event_manipulation, event_object_table, action_statement
FROM information_schema.triggers 
WHERE trigger_name = 'trg_notify_telegram_on_guest_chat';

-- 2. Check if function exists
SELECT routine_name, routine_type
FROM information_schema.routines 
WHERE routine_name = 'notify_telegram_on_guest_chat';

-- 3. Check if pg_net extension is enabled
SELECT * FROM pg_extension WHERE extname = 'pg_net';

-- 4. Test trigger manually (update a guest chat to trigger notification)
-- Replace 'Kullanıcı100' with an actual guest username
UPDATE guest_chats 
SET chat_messages = '[]'::text
WHERE username = 'Kullanıcı100';

-- Then add a test message
UPDATE guest_chats 
SET chat_messages = '[{"message":"test message","sender":"user","timestamp":"2024-01-01T00:00:00Z"}]'::text
WHERE username = 'Kullanıcı100';

-- Check Supabase Logs for any errors or notifications

