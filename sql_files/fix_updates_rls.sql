-- FIX RLS Policies for updates and user_update_status tables
-- Run this in Supabase SQL Editor to fix the RLS errors
-- This is needed because the app doesn't use Supabase Auth

-- ============================================
-- FIX updates TABLE RLS POLICIES
-- ============================================

-- Drop existing policies
DROP POLICY IF EXISTS "Admins can view all updates" ON updates;
DROP POLICY IF EXISTS "Admins can insert updates" ON updates;
DROP POLICY IF EXISTS "Admins can update updates" ON updates;
DROP POLICY IF EXISTS "Admins can delete updates" ON updates;
DROP POLICY IF EXISTS "Users can view active updates" ON updates;

-- Create new policies that work without Supabase Auth
-- Admin check is done in application code (admin-updates.js)

-- Allow anyone to view all updates (for admin panel)
CREATE POLICY "Anyone can view all updates" ON updates
    FOR SELECT USING (true);

-- Allow anyone to insert (admin check done in app code)
CREATE POLICY "Anyone can insert updates" ON updates
    FOR INSERT WITH CHECK (true);

-- Allow anyone to update (admin check done in app code)
CREATE POLICY "Anyone can update updates" ON updates
    FOR UPDATE USING (true)
    WITH CHECK (true);

-- Allow anyone to delete (admin check done in app code)
CREATE POLICY "Anyone can delete updates" ON updates
    FOR DELETE USING (true);

-- ============================================
-- FIX user_update_status TABLE RLS POLICIES
-- ============================================

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view own update status" ON user_update_status;
DROP POLICY IF EXISTS "Users can update own status" ON user_update_status;
DROP POLICY IF EXISTS "Users can insert own status" ON user_update_status;
DROP POLICY IF EXISTS "Admins can view all update status" ON user_update_status;

-- Create new policies that work without Supabase Auth

-- Allow anyone to view (for admin panel and user checks)
CREATE POLICY "Anyone can view update status" ON user_update_status
    FOR SELECT USING (true);

-- Allow anyone to insert (username check done in app code)
CREATE POLICY "Anyone can insert update status" ON user_update_status
    FOR INSERT WITH CHECK (true);

-- Allow anyone to update (username check done in app code)
CREATE POLICY "Anyone can update update status" ON user_update_status
    FOR UPDATE USING (true)
    WITH CHECK (true);

-- After running this:
-- 1. Try saving an update again
-- 2. Admin check is still done in application code (admin-updates.js)
-- 3. For production, consider using service role key for admin operations

