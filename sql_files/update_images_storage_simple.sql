-- SIMPLE Storage RLS Policy (Recommended)
-- This is a simpler approach that works better with Storage

-- Step 1: Create bucket in Supabase Dashboard -> Storage
-- Name: update-images
-- Public: YES (so images can be accessed via URL)
-- File size limit: 10MB
-- Allowed MIME types: image/*,video/*

-- Step 2: After creating bucket, run this SQL:

-- Drop existing policies if any
DROP POLICY IF EXISTS "Public can view update images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload update images" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own uploads" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own uploads" ON storage.objects;

-- Allow public read access (images need to be publicly accessible)
CREATE POLICY "Public can view update images" ON storage.objects
    FOR SELECT
    USING (bucket_id = 'update-images');

-- Allow ANY authenticated user to upload (we check admin status in app code)
-- This is necessary because Storage RLS cannot access custom JWT claims
CREATE POLICY "Authenticated users can upload update images" ON storage.objects
    FOR INSERT
    WITH CHECK (
        bucket_id = 'update-images' AND
        auth.role() = 'authenticated'
    );

-- Allow authenticated users to update files in update-images bucket
CREATE POLICY "Authenticated users can update update images" ON storage.objects
    FOR UPDATE
    USING (
        bucket_id = 'update-images' AND
        auth.role() = 'authenticated'
    );

-- Allow authenticated users to delete files in update-images bucket
CREATE POLICY "Authenticated users can delete update images" ON storage.objects
    FOR DELETE
    USING (
        bucket_id = 'update-images' AND
        auth.role() = 'authenticated'
    );

-- NOTE: For production, consider:
-- 1. Using service role key for admin uploads (more secure)
-- 2. Creating a backend API endpoint for file uploads
-- 3. Implementing file size and type validation server-side

