# Debugging Login Issues

## Quick Diagnostic

Run this SQL in **Supabase SQL Editor** to check your user setup:

```sql
-- Get the user ID from auth.users
SELECT id, email, email_confirmed_at, created_at
FROM auth.users
ORDER BY created_at DESC
LIMIT 5;

-- Copy a user ID from above, then check their profile and org access:
-- Replace 'YOUR_USER_ID' with actual UUID

-- Check user profile exists
SELECT * FROM public.user_profiles
WHERE user_id = 'YOUR_USER_ID';

-- Check organization access exists
SELECT
    uo.user_id,
    uo.organization_id,
    uo.role,
    o.name as org_name
FROM public.user_organizations uo
LEFT JOIN public.core_organizations o ON o.id = uo.organization_id
WHERE uo.user_id = 'YOUR_USER_ID';

-- List all available organizations
SELECT id, name FROM public.core_organizations;
```

## Common Issues & Fixes

### Issue 1: "No organization access" Error

**Problem**: User exists in Supabase Auth but not linked to organization

**Fix**: Run this SQL (replace placeholders):

```sql
-- Step 1: Create user profile (if missing)
INSERT INTO public.user_profiles (user_id, full_name)
VALUES (
    'YOUR_USER_ID',
    'User Full Name'
)
ON CONFLICT (user_id) DO NOTHING;

-- Step 2: Link user to organization
INSERT INTO public.user_organizations (user_id, organization_id, role)
VALUES (
    'YOUR_USER_ID',
    'org-devlabs-test',  -- or your organization ID
    'owner'
)
ON CONFLICT (user_id, organization_id) DO NOTHING;
```

### Issue 2: "Please verify your email" Error

**Problem**: Email not confirmed in Supabase Auth

**Fix Option 1 - Auto-confirm in Supabase Dashboard**:
1. Go to **Authentication → Users**
2. Click on the user
3. Click **"Send confirmation"** OR
4. Manually set `email_confirmed_at` to current timestamp

**Fix Option 2 - SQL**:
```sql
-- Confirm email manually
UPDATE auth.users
SET email_confirmed_at = NOW()
WHERE id = 'YOUR_USER_ID';
```

### Issue 3: Invalid Credentials

**Problem**: Wrong password or email

**Fix**: Reset the password in Supabase Dashboard:
1. Go to **Authentication → Users**
2. Click on the user
3. Click **"Reset password"** or **"Edit user"**
4. Set a new password

## Quick Setup Script

If you want to create a complete working user from scratch:

```sql
-- 1. First, create the user in Supabase Dashboard → Authentication → Users
--    with email and password, then get the user ID
--    OR use this to find existing user:

SELECT id, email FROM auth.users WHERE email = 'user@example.com';

-- 2. Then run this (replace YOUR_USER_ID):

DO $$
DECLARE
    v_user_id UUID := 'YOUR_USER_ID';  -- Replace with actual user ID
    v_org_id TEXT := 'org-devlabs-test';  -- Replace with your org ID
BEGIN
    -- Create user profile
    INSERT INTO public.user_profiles (user_id, full_name)
    VALUES (v_user_id, 'Your Full Name')
    ON CONFLICT (user_id) DO NOTHING;

    -- Link to organization
    INSERT INTO public.user_organizations (user_id, organization_id, role)
    VALUES (v_user_id, v_org_id, 'owner')
    ON CONFLICT (user_id, organization_id) DO NOTHING;

    -- Confirm email
    UPDATE auth.users
    SET email_confirmed_at = COALESCE(email_confirmed_at, NOW())
    WHERE id = v_user_id;

    RAISE NOTICE 'User setup complete for %', v_user_id;
END $$;
```

## Test Login Flow

1. Go to http://localhost:3002/login
2. Enter email and password
3. Check browser console (F12) for errors
4. Check what error message appears

## Common Error Messages

| Error Message | Cause | Solution |
|---------------|-------|----------|
| "No organization access. Contact administrator." | User not linked to organization | Run SQL to create user_organizations record |
| "Please verify your email before logging in" | email_confirmed_at is NULL | Set email_confirmed_at in Supabase or send confirmation |
| "Invalid email or password" | Wrong credentials or user doesn't exist | Check auth.users table, verify credentials |
| Page redirects to /verify-email | Email not confirmed | Confirm email in Supabase Dashboard |

## Manual Verification Checklist

For a user to log in successfully, they need:

- [ ] Record in `auth.users` table (Supabase Auth)
- [ ] `email_confirmed_at` is NOT NULL
- [ ] Record in `public.user_profiles` table
- [ ] Record in `public.user_organizations` table
- [ ] Organization ID in `user_organizations` exists in `core_organizations`
- [ ] Correct password set in Supabase Dashboard

## Still Not Working?

1. Check the browser console for errors (F12 → Console tab)
2. Check Supabase logs: Dashboard → Logs → Auth Logs
3. Verify the server is running: `npm run dev`
4. Check that `.env.local` has correct Supabase credentials
5. Try creating a completely new test user following this guide

## Example Working Setup

Here's a complete example that should work:

```sql
-- Assume user created in Supabase Auth with:
-- Email: test@example.com
-- Password: Test123!@#
-- User ID: 550e8400-e29b-41d4-a716-446655440000

-- Step 1: Confirm email
UPDATE auth.users
SET email_confirmed_at = NOW()
WHERE id = '550e8400-e29b-41d4-a716-446655440000';

-- Step 2: Create profile
INSERT INTO public.user_profiles (user_id, full_name)
VALUES ('550e8400-e29b-41d4-a716-446655440000', 'Test User');

-- Step 3: Link to org
INSERT INTO public.user_organizations (user_id, organization_id, role)
VALUES ('550e8400-e29b-41d4-a716-446655440000', 'org-devlabs-test', 'owner');

-- Step 4: Verify setup
SELECT
    u.email,
    u.email_confirmed_at,
    up.full_name,
    uo.role,
    o.name as org_name
FROM auth.users u
LEFT JOIN public.user_profiles up ON up.user_id = u.id
LEFT JOIN public.user_organizations uo ON uo.user_id = u.id
LEFT JOIN public.core_organizations o ON o.id = uo.organization_id
WHERE u.id = '550e8400-e29b-41d4-a716-446655440000';
```

This should return one row with all fields populated. If any field is NULL, that's the issue.
