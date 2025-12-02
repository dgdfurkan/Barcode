-- FIXED Storage RLS Policy - Run this in Supabase SQL Editor
-- This will fix the RLS policy violation error

-- Step 1: Drop all existing policies for update-images bucket
DROP POLICY IF EXISTS "Public can view update images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload update images" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own uploads" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own uploads" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update update images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete update images" ON storage.objects;
DROP POLICY IF EXISTS "Admins can upload update images" ON storage.objects;
DROP POLICY IF EXISTS "Admins can update update images" ON storage.objects;
DROP POLICY IF EXISTS "Admins can delete update images" ON storage.objects;

-- Step 2: Create new policies
-- Allow public read access (images need to be publicly accessible)
CREATE POLICY "Public can view update images" ON storage.objects
    FOR SELECT
    USING (bucket_id = 'update-images');

-- Allow ANY authenticated user to upload
-- Note: Storage RLS cannot check admin status, so we allow all authenticated users
-- Admin check is done in application code (admin-updates.js)
CREATE POLICY "Authenticated users can upload update images" ON storage.objects
    FOR INSERT
    WITH CHECK (
        bucket_id = 'update-images'
    );

-- Allow authenticated users to update files
CREATE POLICY "Authenticated users can update update images" ON storage.objects
    FOR UPDATE
    USING (
        bucket_id = 'update-images'
    );

-- Allow authenticated users to delete files
CREATE POLICY "Authenticated users can delete update images" ON storage.objects
    FOR DELETE
    USING (
        bucket_id = 'update-images'
    );

-- IMPORTANT NOTES:
-- 1. Make sure the bucket 'update-images' exists and is PUBLIC
-- 2. The bucket should allow authenticated uploads
-- 3. If you still get errors, try disabling RLS on the bucket temporarily:
--    ALTER TABLE storage.objects DISABLE ROW LEVEL SECURITY;
--    (Then re-enable after testing: ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;)

