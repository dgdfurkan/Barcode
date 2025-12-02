-- Supabase Storage Bucket Setup for Update Images
-- Run this in Supabase Dashboard -> Storage

-- Note: Storage buckets are created via Supabase Dashboard UI, not SQL
-- But you can use this SQL to set up RLS policies after creating the bucket

-- Steps to create bucket:
-- 1. Go to Supabase Dashboard -> Storage
-- 2. Click "New bucket"
-- 3. Name: update-images
-- 4. Public bucket: YES (so images can be accessed via URL)
-- 5. File size limit: 10MB (or as needed)
-- 6. Allowed MIME types: image/*,video/* (or leave empty for all)

-- After creating the bucket, run these policies:

-- IMPORTANT: Storage RLS works differently than table RLS
-- Storage policies cannot access custom JWT claims or current_setting
-- So we'll use a simpler approach: allow authenticated users to upload
-- You can restrict this further by checking user session in your app code

-- Allow public read access (images need to be publicly accessible)
CREATE POLICY "Public can view update images" ON storage.objects
    FOR SELECT
    USING (bucket_id = 'update-images');

-- Allow authenticated users to upload (we'll check admin status in app code)
-- Note: This is less secure but necessary for Storage RLS limitations
-- Alternative: Use service role key for admin uploads (more secure)
CREATE POLICY "Authenticated users can upload update images" ON storage.objects
    FOR INSERT
    WITH CHECK (
        bucket_id = 'update-images' AND
        auth.role() = 'authenticated'
    );

-- Allow authenticated users to update their own uploads
CREATE POLICY "Users can update their own uploads" ON storage.objects
    FOR UPDATE
    USING (
        bucket_id = 'update-images' AND
        auth.role() = 'authenticated' AND
        (storage.foldername(name))[1] = auth.uid()::text
    );

-- Allow authenticated users to delete their own uploads
CREATE POLICY "Users can delete their own uploads" ON storage.objects
    FOR DELETE
    USING (
        bucket_id = 'update-images' AND
        auth.role() = 'authenticated' AND
        (storage.foldername(name))[1] = auth.uid()::text
    );

-- ALTERNATIVE APPROACH (More Secure):
-- If you want stricter control, disable RLS on storage bucket
-- and handle authentication in your application code before upload
-- Or use service role key for admin operations (recommended for production)

