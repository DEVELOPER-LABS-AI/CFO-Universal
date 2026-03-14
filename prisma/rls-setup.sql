-- ============================================================================
-- RLS Setup - User-Organization Mapping
-- ============================================================================
-- Run this BEFORE applying rls-policies.sql
-- This creates the user-organization link needed for RLS policies
-- ============================================================================

-- ============================================================================
-- STEP 1: Create user_organizations mapping table
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.user_organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    organization_id TEXT NOT NULL REFERENCES core_organizations(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'member', -- member, admin, owner
    created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT user_organizations_unique UNIQUE(user_id, organization_id)
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS user_organizations_user_id_idx ON public.user_organizations(user_id);
CREATE INDEX IF NOT EXISTS user_organizations_org_id_idx ON public.user_organizations(organization_id);

-- ============================================================================
-- STEP 2: Create helper function to get user's organization
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_user_organization_id()
RETURNS TEXT AS $$
BEGIN
    RETURN (
        SELECT organization_id
        FROM public.user_organizations
        WHERE user_id = auth.uid()
        LIMIT 1
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- STEP 3: Enable RLS on user_organizations table
-- ============================================================================

ALTER TABLE public.user_organizations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own organization memberships"
ON public.user_organizations
FOR SELECT
USING (user_id = auth.uid());

CREATE POLICY "Users cannot modify organization memberships"
ON public.user_organizations
FOR ALL
USING (false); -- Only service_role can modify memberships

-- ============================================================================
-- STEP 4: Insert seed user-organization mapping (for testing)
-- ============================================================================
-- Replace 'your-user-id' with actual auth.users.id after creating a user
-- Replace 'org-id' with actual organization ID from core_organizations

-- Example:
-- INSERT INTO public.user_organizations (user_id, organization_id, role)
-- VALUES (
--     'a1b2c3d4-e5f6-7890-abcd-ef1234567890', -- auth.users.id
--     'seed-org-id',                           -- core_organizations.id
--     'owner'
-- );

-- ============================================================================
-- VERIFICATION
-- ============================================================================

-- Check if function works:
-- SELECT public.get_user_organization_id();

-- Check user-org mappings:
-- SELECT * FROM public.user_organizations;

-- ============================================================================
-- NOTES
-- ============================================================================
--
-- Why this approach:
-- 1. Supabase auth.users table is managed by Supabase and shouldn't be modified
-- 2. This mapping table allows users to belong to multiple organizations (future feature)
-- 3. The helper function simplifies RLS policy syntax
--
-- Next steps:
-- 1. Create a user in Supabase Authentication dashboard
-- 2. Insert a record in user_organizations linking user to an organization
-- 3. Then run rls-policies.sql
--
-- ============================================================================
