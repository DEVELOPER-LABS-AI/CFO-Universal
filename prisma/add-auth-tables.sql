-- ============================================================================
-- Add User Authentication Tables
-- ============================================================================
-- Run this in Supabase SQL Editor to add user_organizations and user_profiles
-- ============================================================================

-- Create user_organizations table
CREATE TABLE IF NOT EXISTS public.user_organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL, -- Links to auth.users.id
    organization_id UUID NOT NULL REFERENCES public.core_organizations(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'member', -- owner, admin, member
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT user_organizations_user_id_organization_id_key UNIQUE (user_id, organization_id)
);

-- Create indexes for user_organizations
CREATE INDEX IF NOT EXISTS user_organizations_user_id_idx ON public.user_organizations(user_id);
CREATE INDEX IF NOT EXISTS user_organizations_organization_id_idx ON public.user_organizations(organization_id);

-- Create user_profiles table
CREATE TABLE IF NOT EXISTS public.user_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE, -- Links to auth.users.id
    full_name TEXT NOT NULL,
    avatar_url TEXT,
    preferences JSONB,
    last_active_org UUID, -- FK to core_organizations.id
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Create indexes for user_profiles
CREATE INDEX IF NOT EXISTS user_profiles_user_id_idx ON public.user_profiles(user_id);

-- Enable RLS on both tables
ALTER TABLE public.user_organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

-- RLS Policy for user_organizations: Users can only see their own organization memberships
CREATE POLICY "user_organizations_policy" ON public.user_organizations
    FOR ALL
    USING (user_id = auth.uid());

-- RLS Policy for user_profiles: Users can only access their own profile
CREATE POLICY "user_profiles_policy" ON public.user_profiles
    FOR ALL
    USING (user_id = auth.uid());

-- ============================================================================
-- Verification Queries
-- ============================================================================
-- Run these to verify the tables were created correctly

-- Check that tables exist
SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename IN ('user_organizations', 'user_profiles');

-- Check RLS is enabled
SELECT tablename, rowsecurity FROM pg_tables
WHERE schemaname = 'public' AND tablename IN ('user_organizations', 'user_profiles');

-- Check policies exist
SELECT tablename, policyname FROM pg_policies
WHERE schemaname = 'public' AND tablename IN ('user_organizations', 'user_profiles');
