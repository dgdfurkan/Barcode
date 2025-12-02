-- Check current Storage policies for update-images bucket
-- Run this to see what policies are currently active

SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE schemaname = 'storage' 
  AND tablename = 'objects'
  AND (qual::text LIKE '%update-images%' OR with_check::text LIKE '%update-images%' OR policyname LIKE '%update%')
ORDER BY policyname;

-- Also check if RLS is enabled on storage.objects
SELECT 
    schemaname,
    tablename,
    rowsecurity
FROM pg_tables 
WHERE schemaname = 'storage' 
  AND tablename = 'objects';

