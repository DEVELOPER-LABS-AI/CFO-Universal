-- Verification Script: Check User Organization Association
-- Run this in your Supabase SQL Editor

-- Step 1: Find your user
SELECT
  id as user_id,
  email,
  created_at,
  last_sign_in_at
FROM auth.users
WHERE email = 'clance@developerlabs.ai';

-- Copy the user_id from above and use it below

-- Step 2: Check organization association
SELECT
  uo.id,
  uo.user_id,
  uo.organization_id,
  uo.role,
  o.name as organization_name,
  uo.created_at
FROM user_organizations uo
JOIN organizations o ON o.id = uo.organization_id
WHERE uo.user_id = '<PASTE-USER-ID-HERE>';

-- If the above returns no rows, you need to create the association:

-- Step 3: List all organizations (to find the correct one)
SELECT
  id as organization_id,
  name,
  created_at
FROM organizations
ORDER BY created_at DESC;

-- Step 4: Create user-organization association (if needed)
-- Replace <USER-ID> and <ORG-ID> with actual values from above queries

-- INSERT INTO user_organizations (user_id, organization_id, role)
-- VALUES (
--   '<USER-ID>',
--   '<ORG-ID>',
--   'owner'
-- );

-- Step 5: Verify the association was created
SELECT
  uo.user_id,
  u.email,
  uo.organization_id,
  o.name as organization_name,
  uo.role
FROM user_organizations uo
JOIN organizations o ON o.id = uo.organization_id
JOIN auth.users u ON u.id = uo.user_id
WHERE u.email = 'clance@developerlabs.ai';

-- Expected output:
-- user_id | email | organization_id | organization_name | role
-- --------|-------|-----------------|-------------------|------
-- abc123  | clance@developerlabs.ai | xyz789 | DeveloperLabs | owner
