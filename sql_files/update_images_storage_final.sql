-- FINAL FIX: Storage RLS Policy for Update Images
-- This fixes the RLS error when uploading images
-- Run this in Supabase SQL Editor

-- IMPORTANT: Your app doesn't use Supabase Auth, so auth.role() checks won't work
-- Solution: Make bucket public and allow all operations, or disable RLS

-- Option 1: Disable RLS completely (EASIEST - Recommended for now)
-- This allows anyone to upload, but you're checking admin status in app code
ALTER TABLE storage.objects DISABLE ROW LEVEL SECURITY WHERE bucket_id = 'update-images';

-- If the above doesn't work, try this instead:
-- Drop all existing policies
DROP POLICY IF EXISTS "Public can view update images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload update images" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own uploads" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own uploads" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update update images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete update images" ON storage.objects;
DROP POLICY IF EXISTS "Admins can upload update images" ON storage.objects;
DROP POLICY IF EXISTS "Admins can update update images" ON storage.objects;
DROP POLICY IF EXISTS "Admins can delete update images" ON storage.objects;

-- Option 2: Create policies that allow everything (if RLS must stay enabled)
-- Allow public read
CREATE POLICY "Public can view update images" ON storage.objects
    FOR SELECT
    USING (bucket_id = 'update-images');

-- Allow anyone to upload (no auth check since your app doesn't use Supabase Auth)
CREATE POLICY "Anyone can upload update images" ON storage.objects
    FOR INSERT
    WITH CHECK (bucket_id = 'update-images');

-- Allow anyone to update
CREATE POLICY "Anyone can update update images" ON storage.objects
    FOR UPDATE
    USING (bucket_id = 'update-images');

-- Allow anyone to delete
CREATE POLICY "Anyone can delete update images" ON storage.objects
    FOR DELETE
    USING (bucket_id = 'update-images');

-- After running this:
-- 1. Make sure bucket 'update-images' is PUBLIC in Supabase Dashboard
-- 2. Try uploading an image again
-- 3. If still not working, check bucket settings in Dashboard -> Storage

