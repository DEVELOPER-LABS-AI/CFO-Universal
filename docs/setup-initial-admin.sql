-- ============================================================================
-- Initial Admin User Setup
-- ============================================================================
-- 
-- Purpose: Create the first admin user for DevLabs CFO system
-- Run this script ONCE in Supabase SQL Editor after database migrations
--
-- IMPORTANT: 
-- 1. Replace the email and password with your actual admin credentials
-- 2. This script creates a user directly in Supabase Auth
-- 3. Save this file securely - it contains initial password
-- ============================================================================

-- STEP 1: Create user in Supabase Auth
-- Replace these values with your admin credentials:
DO $$
DECLARE
  admin_user_id UUID;
  admin_email TEXT := 'admin@devlabs.com';  -- ⚠️ CHANGE THIS
  admin_password TEXT := 'ChangeMe123!';     -- ⚠️ CHANGE THIS
  admin_name TEXT := 'Admin User';           -- ⚠️ CHANGE THIS
BEGIN
  -- Create auth user (this uses Supabase's internal auth.users table)
  -- Note: Password will be hashed automatically by Supabase
  INSERT INTO auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    created_at,
    updated_at,
    raw_app_meta_data,
    raw_user_meta_data,
    is_super_admin,
    confirmation_token,
    email_change,
    email_change_token_new,
    recovery_token
  ) VALUES (
    '00000000-0000-0000-0000-000000000000',
    gen_random_uuid(),
    'authenticated',
    'authenticated',
    admin_email,
    crypt(admin_password, gen_salt('bf')),
    NOW(),
    NOW(),
    NOW(),
    '{"provider":"email","providers":["email"]}',
    jsonb_build_object('full_name', admin_name),
    false,
    '',
    '',
    '',
    ''
  )
  RETURNING id INTO admin_user_id;

  -- Create corresponding user profile with ADMIN role and ACTIVE status
  INSERT INTO user_profiles (
    user_id,
    full_name,
    role,
    status,
    created_at,
    updated_at
  ) VALUES (
    admin_user_id,
    admin_name,
    'ADMIN',
    'ACTIVE',
    NOW(),
    NOW()
  );

  -- Output success message
  RAISE NOTICE 'Admin user created successfully!';
  RAISE NOTICE 'User ID: %', admin_user_id;
  RAISE NOTICE 'Email: %', admin_email;
  RAISE NOTICE 'You can now login at /login';

EXCEPTION
  WHEN unique_violation THEN
    RAISE NOTICE 'User with email % already exists', admin_email;
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Failed to create admin user: %', SQLERRM;
END $$;

-- ============================================================================
-- Verification Query
-- ============================================================================
-- Run this to verify the admin user was created correctly:

SELECT 
  up.id,
  up.user_id,
  up.full_name,
  up.role,
  up.status,
  au.email,
  up.created_at
FROM user_profiles up
JOIN auth.users au ON au.id = up.user_id
WHERE up.role = 'ADMIN';

-- Expected output:
-- - One row with your admin user details
-- - role = 'ADMIN'
-- - status = 'ACTIVE'
-- - email matches what you set above
