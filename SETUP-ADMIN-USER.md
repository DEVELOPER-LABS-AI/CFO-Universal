# Creating Your First Admin User

Since public registration is disabled, you need to create users manually through Supabase Dashboard.

## Step 1: Create User in Supabase Auth

1. Go to **Supabase Dashboard**: https://fqljijavvxkthzozslzx.supabase.co
2. Navigate to **Authentication → Users**
3. Click **"Add user"** button
4. Choose **"Create new user"**
5. Enter:
   - **Email**: your email address
   - **Password**: create a secure password
   - **Auto Confirm Email**: ✅ Check this (skips email verification)
6. Click **"Create user"**
7. **Copy the User ID** (UUID) - you'll need it in the next step

## Step 2: Link User to Organization

Run this SQL in **Supabase SQL Editor**:

```sql
-- Replace these values:
-- YOUR_USER_ID: The UUID you copied from Step 1
-- YOUR_ORG_ID: Get from core_organizations table (use 'org-devlabs-test' or your org ID)

-- First, check available organizations
SELECT id, name FROM public.core_organizations;

-- Create user profile
INSERT INTO public.user_profiles (user_id, full_name)
VALUES (
    'YOUR_USER_ID',
    'Your Full Name'
);

-- Link user to organization with owner role
INSERT INTO public.user_organizations (user_id, organization_id, role)
VALUES (
    'YOUR_USER_ID',
    'org-devlabs-test',  -- Or your organization ID
    'owner'
);
```

## Step 3: Verify Setup

Run this to verify everything is set up correctly:

```sql
-- Check user profile
SELECT * FROM public.user_profiles WHERE user_id = 'YOUR_USER_ID';

-- Check organization membership
SELECT
    uo.user_id,
    uo.role,
    o.name as organization_name
FROM public.user_organizations uo
JOIN public.core_organizations o ON o.id = uo.organization_id
WHERE uo.user_id = 'YOUR_USER_ID';
```

## Step 4: Test Login

1. Go to **http://localhost:3002**
2. You'll be redirected to the login page
3. Enter your email and password
4. You should be logged in and see the **Project Status Dashboard**

## Quick Example

If your user ID is `550e8400-e29b-41d4-a716-446655440000`:

```sql
-- Create profile
INSERT INTO public.user_profiles (user_id, full_name)
VALUES (
    '550e8400-e29b-41d4-a716-446655440000',
    'John Doe'
);

-- Link to organization
INSERT INTO public.user_organizations (user_id, organization_id, role)
VALUES (
    '550e8400-e29b-41d4-a716-446655440000',
    'org-devlabs-test',
    'owner'
);
```

## Troubleshooting

**Error: "No organization access"**
- Make sure you ran the SQL to link user to organization
- Check that the organization ID exists in `core_organizations`

**Error: "Please verify your email"**
- Go back to Supabase Dashboard → Authentication → Users
- Click on your user → Click "Send confirmation" OR manually set `email_confirmed_at` to current timestamp

**Can't see dashboard after login:**
- Check browser console for errors
- Verify user_profile was created
- Verify user_organizations link exists
