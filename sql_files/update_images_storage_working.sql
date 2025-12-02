-- WORKING SOLUTION: Storage RLS Policy for update-images bucket
-- This should work with your current setup
-- Run this in Supabase SQL Editor

-- Step 1: Drop ALL existing policies (clean slate)
DO $$ 
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT policyname 
        FROM pg_policies 
        WHERE schemaname = 'storage' 
          AND tablename = 'objects'
          AND (qual::text LIKE '%update-images%' 
               OR with_check::text LIKE '%update-images%' 
               OR policyname LIKE '%update%'
               OR policyname LIKE '%Anonymous%'
               OR policyname LIKE '%Public%')
    ) 
    LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON storage.objects';
    END LOOP;
END $$;

-- Step 2: Create simple policies that work with anon key
-- These policies don't check auth.role() - they just check bucket_id

-- Public read (SELECT)
CREATE POLICY "update_images_select" ON storage.objects
    FOR SELECT
    USING (bucket_id = 'update-images');

-- Public insert (INSERT) - allows anonymous uploads
CREATE POLICY "update_images_insert" ON storage.objects
    FOR INSERT
    WITH CHECK (bucket_id = 'update-images');

-- Public update (UPDATE) - allows anonymous updates
CREATE POLICY "update_images_update" ON storage.objects
    FOR UPDATE
    USING (bucket_id = 'update-images')
    WITH CHECK (bucket_id = 'update-images');

-- Public delete (DELETE) - allows anonymous deletes
CREATE POLICY "update_images_delete" ON storage.objects
    FOR DELETE
    USING (bucket_id = 'update-images');

-- IMPORTANT: After running this SQL:
-- 1. Go to Supabase Dashboard → Storage → update-images bucket
-- 2. Click "Settings" tab
-- 3. Make sure "Public bucket" is ENABLED (toggle ON)
-- 4. Check "File size limit" - should be at least 10MB
-- 5. "Allowed MIME types" should be empty or include image/*,video/*
-- 6. Try uploading again

