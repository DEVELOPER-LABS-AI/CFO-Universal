-- Quick Script: Find Your User ID and Organization ID
-- Copy and paste this entire script into Supabase SQL Editor

-- ============================================================================
-- STEP 1: Find Your User ID
-- ============================================================================
SELECT
  id as user_id,
  email,
  created_at as account_created
FROM auth.users
WHERE email = 'clance@developerlabs.ai';

-- Copy the 'user_id' from the result above
-- It will look something like: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'


-- ============================================================================
-- STEP 2: Find All Organizations (and their IDs)
-- ============================================================================
SELECT
  id as organization_id,
  name as organization_name,
  created_at
FROM organizations
ORDER BY created_at DESC;

-- Copy the 'organization_id' for your organization (probably 'DeveloperLabs')


-- ============================================================================
-- STEP 3: Check if You're Already Associated
-- ============================================================================
SELECT
  uo.user_id,
  u.email,
  uo.organization_id,
  o.name as organization_name,
  uo.role,
  uo.created_at as associated_on
FROM user_organizations uo
JOIN auth.users u ON u.id = uo.user_id
JOIN organizations o ON o.id = uo.organization_id
WHERE u.email = 'clance@developerlabs.ai';

-- If this returns a row, you're all set! ✓
-- If this returns nothing, continue to Step 4 below


-- ============================================================================
-- STEP 4: Create the Association (if needed)
-- ============================================================================
-- ONLY run this if Step 3 returned no results
-- Replace the placeholders with actual IDs from Steps 1 and 2

-- Example values (REPLACE THESE):
-- user_id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'
-- organization_id: 'xyz789-1234-5678-90ab-cdef12345678'

/*
INSERT INTO user_organizations (user_id, organization_id, role)
VALUES (
  'PASTE-USER-ID-HERE',        -- From Step 1
  'PASTE-ORGANIZATION-ID-HERE', -- From Step 2
  'owner'                        -- Role: owner, admin, or member
);
*/

-- After running the INSERT, run Step 3 again to verify it worked


-- ============================================================================
-- STEP 5: Verify Everything Works
-- ============================================================================
-- This should now return your user info with organization details
SELECT
  u.id as user_id,
  u.email,
  uo.organization_id,
  o.name as organization_name,
  uo.role,
  up.full_name
FROM auth.users u
LEFT JOIN user_organizations uo ON u.id = uo.user_id
LEFT JOIN organizations o ON o.id = uo.organization_id
LEFT JOIN user_profiles up ON u.id = up.user_id
WHERE u.email = 'clance@developerlabs.ai';

-- Expected result:
-- user_id | email | organization_id | organization_name | role | full_name
-- --------|-------|-----------------|-------------------|------|----------
-- abc123  | clance@developerlabs.ai | xyz789 | DeveloperLabs | owner | Clance


-- ============================================================================
-- BONUS: If You Need to Create an Organization First
-- ============================================================================
-- Only run this if Step 2 returned no organizations

/*
INSERT INTO organizations (name, created_at)
VALUES ('DeveloperLabs', NOW())
RETURNING id, name, created_at;
*/

-- Then use the returned 'id' in Step 4 above
