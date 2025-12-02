-- ALLOW ANONYMOUS UPLOADS to update-images bucket
-- This allows uploads without Supabase Auth authentication
-- Run this in Supabase SQL Editor

-- Step 1: Drop all existing policies
DROP POLICY IF EXISTS "Public can view update images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload update images" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own uploads" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own uploads" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update update images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete update images" ON storage.objects;
DROP POLICY IF EXISTS "Admins can upload update images" ON storage.objects;
DROP POLICY IF EXISTS "Admins can update update images" ON storage.objects;
DROP POLICY IF EXISTS "Admins can delete update images" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can upload update images" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can update update images" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can delete update images" ON storage.objects;
DROP POLICY IF EXISTS "Allow all operations on update-images" ON storage.objects;

-- Step 2: Create policies that allow anonymous (anon role) operations
-- Public read access
CREATE POLICY "Public can view update images" ON storage.objects
    FOR SELECT
    USING (bucket_id = 'update-images');

-- Allow anonymous uploads (anon role)
CREATE POLICY "Anonymous can upload update images" ON storage.objects
    FOR INSERT
    WITH CHECK (
        bucket_id = 'update-images'
    );

-- Allow anonymous updates
CREATE POLICY "Anonymous can update update images" ON storage.objects
    FOR UPDATE
    USING (bucket_id = 'update-images')
    WITH CHECK (bucket_id = 'update-images');

-- Allow anonymous deletes
CREATE POLICY "Anonymous can delete update images" ON storage.objects
    FOR DELETE
    USING (bucket_id = 'update-images');

-- IMPORTANT NOTES:
-- 1. Make sure bucket 'update-images' is PUBLIC in Supabase Dashboard
-- 2. This allows ANYONE to upload/update/delete - admin check is done in app code
-- 3. For production, consider using service role key instead (more secure)

