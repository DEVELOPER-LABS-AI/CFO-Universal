-- Fix: Associate your user with an organization
-- Run this in Supabase SQL Editor

-- Step 1: Check if you have a user account
SELECT id, email FROM auth.users LIMIT 5;

-- Step 2: Check if you have an organization
SELECT id, name FROM core_organizations LIMIT 5;

-- Step 3: Check current user-organization associations
SELECT * FROM core_user_organizations LIMIT 5;

-- Step 4: Create association (replace with your actual IDs)
-- Get your user ID from Step 1 and organization ID from Step 2
-- Then run:
/*
INSERT INTO core_user_organizations (user_id, organization_id, role)
VALUES (
  '<your-user-id-from-step-1>',
  '<your-org-id-from-step-2>',
  'ADMIN'
)
ON CONFLICT (user_id, organization_id) DO NOTHING;
*/

-- Step 5: Verify the association was created
SELECT 
  uo.user_id,
  uo.organization_id,
  uo.role,
  u.email,
  o.name as org_name
FROM core_user_organizations uo
JOIN auth.users u ON u.id = uo.user_id
JOIN core_organizations o ON o.id = uo.organization_id;
