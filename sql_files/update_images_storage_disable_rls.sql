-- DISABLE RLS COMPLETELY for update-images bucket
-- This is the most reliable solution when your app doesn't use Supabase Auth
-- Run this in Supabase SQL Editor

-- Step 1: Drop ALL existing policies for update-images bucket
DO $$ 
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT policyname FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname LIKE '%update%') 
    LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON storage.objects';
    END LOOP;
END $$;

-- Step 2: Create a policy that allows EVERYTHING (no restrictions)
-- This effectively disables RLS for this bucket
CREATE POLICY "Allow all operations on update-images" ON storage.objects
    FOR ALL
    USING (bucket_id = 'update-images')
    WITH CHECK (bucket_id = 'update-images');

-- Alternative: If the above doesn't work, try disabling RLS for the entire storage.objects table
-- WARNING: This disables RLS for ALL storage buckets, not just update-images
-- Only use this if the above doesn't work
-- ALTER TABLE storage.objects DISABLE ROW LEVEL SECURITY;

-- After running this:
-- 1. Refresh your browser
-- 2. Try uploading an image again
-- 3. If still not working, check Supabase Dashboard -> Storage -> update-images -> Settings
--    Make sure "Public bucket" is enabled

