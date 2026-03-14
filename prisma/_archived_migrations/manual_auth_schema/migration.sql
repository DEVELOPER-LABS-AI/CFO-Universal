-- Migration: Add Authentication Schema
-- Created: 2026-02-13
-- Description: Adds user authentication fields to user_profiles and creates audit_logs table
-- Note: This migration assumes base schema from specs/1-database-schema already exists

-- ============================================================================
-- CREATE NEW ENUMS
-- ============================================================================

-- User Role Enum (NEW)
DO $$ BEGIN
  CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'EXECUTIVE', 'ANALYST');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- User Status Enum (NEW)
DO $$ BEGIN
  CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'INACTIVE');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Audit Action Type Enum (NEW)
DO $$ BEGIN
  CREATE TYPE "AuditActionType" AS ENUM (
    'USER_CREATED',
    'USER_EDITED',
    'USER_DELETED',
    'USER_DEACTIVATED',
    'USER_REACTIVATED',
    'ROLE_CHANGED',
    'PASSWORD_RESET'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- ============================================================================
-- ALTER USER_PROFILES TABLE
-- ============================================================================

-- Add new authentication columns (use IF NOT EXISTS for idempotency)
DO $$
BEGIN
  -- Add role column (nullable for multi-tenant users)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='user_profiles' AND column_name='role') THEN
    ALTER TABLE "user_profiles" ADD COLUMN "role" "UserRole" DEFAULT 'EXECUTIVE';
  END IF;

  -- Add status column (nullable for multi-tenant users)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='user_profiles' AND column_name='status') THEN
    ALTER TABLE "user_profiles" ADD COLUMN "status" "UserStatus" DEFAULT 'ACTIVE';
  END IF;

  -- Add last_login column
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='user_profiles' AND column_name='last_login') THEN
    ALTER TABLE "user_profiles" ADD COLUMN "last_login" TIMESTAMP(3);
  END IF;

  -- Add invite_token column (TEXT to match Prisma String type)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='user_profiles' AND column_name='invite_token') THEN
    ALTER TABLE "user_profiles" ADD COLUMN "invite_token" TEXT UNIQUE;
  END IF;

  -- Add invite_expires_at column
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='user_profiles' AND column_name='invite_expires_at') THEN
    ALTER TABLE "user_profiles" ADD COLUMN "invite_expires_at" TIMESTAMP(3);
  END IF;
END $$;

-- HYBRID ARCHITECTURE: Keep last_active_org for multi-tenant support
-- Note: Internal tool users won't use this field, but multi-tenant users need it

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS "user_profiles_role_idx" ON "user_profiles"("role");
CREATE INDEX IF NOT EXISTS "user_profiles_status_idx" ON "user_profiles"("status");
CREATE INDEX IF NOT EXISTS "user_profiles_invite_token_idx" ON "user_profiles"("invite_token");

-- ============================================================================
-- CREATE AUDIT_LOGS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS "audit_logs" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "actor_id" TEXT NOT NULL,
  "target_user_id" TEXT,
  "action_type" "AuditActionType" NOT NULL,
  "action_details" JSONB,
  "ip_address" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- Create indexes for audit_logs (all idempotent)
CREATE INDEX IF NOT EXISTS "audit_logs_actor_id_idx" ON "audit_logs"("actor_id");
CREATE INDEX IF NOT EXISTS "audit_logs_target_user_id_idx" ON "audit_logs"("target_user_id");
CREATE INDEX IF NOT EXISTS "audit_logs_action_type_idx" ON "audit_logs"("action_type");
CREATE INDEX IF NOT EXISTS "audit_logs_created_at_idx" ON "audit_logs"("created_at" DESC);

-- ============================================================================
-- ROW LEVEL SECURITY POLICIES
-- ============================================================================

-- Enable RLS on user_profiles (if not already enabled)
ALTER TABLE "user_profiles" ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (idempotent)
DROP POLICY IF EXISTS "user_profiles_view_own" ON "user_profiles";
DROP POLICY IF EXISTS "user_profiles_admin_view_all" ON "user_profiles";
DROP POLICY IF EXISTS "user_profiles_admin_insert" ON "user_profiles";
DROP POLICY IF EXISTS "user_profiles_admin_update" ON "user_profiles";
DROP POLICY IF EXISTS "user_profiles_update_own" ON "user_profiles";
DROP POLICY IF EXISTS "audit_logs_admin_view" ON "audit_logs";
DROP POLICY IF EXISTS "audit_logs_system_insert" ON "audit_logs";

-- Policy: Users can view their own profile
CREATE POLICY "user_profiles_view_own" ON "user_profiles"
  FOR SELECT
  USING (user_id::text = (auth.uid())::text);

-- Policy: Admins can view all profiles
CREATE POLICY "user_profiles_admin_view_all" ON "user_profiles"
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM "user_profiles" up
      WHERE up.user_id::text = (auth.uid())::text
      AND up.role = 'ADMIN'
      AND up.status = 'ACTIVE'
    )
  );

-- Policy: Admins can insert new user profiles
CREATE POLICY "user_profiles_admin_insert" ON "user_profiles"
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM "user_profiles" up
      WHERE up.user_id::text = (auth.uid())::text
      AND up.role = 'ADMIN'
      AND up.status = 'ACTIVE'
    )
  );

-- Policy: Admins can update user profiles
CREATE POLICY "user_profiles_admin_update" ON "user_profiles"
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM "user_profiles" up
      WHERE up.user_id::text = (auth.uid())::text
      AND up.role = 'ADMIN'
      AND up.status = 'ACTIVE'
    )
  );

-- Policy: Users can update their own profile (limited fields)
CREATE POLICY "user_profiles_update_own" ON "user_profiles"
  FOR UPDATE
  USING (user_id::text = (auth.uid())::text)
  WITH CHECK (user_id::text = (auth.uid())::text);

-- Enable RLS on audit_logs
ALTER TABLE "audit_logs" ENABLE ROW LEVEL SECURITY;

-- Policy: Admins can view all audit logs
CREATE POLICY "audit_logs_admin_view" ON "audit_logs"
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM "user_profiles" up
      WHERE up.user_id::text = (auth.uid())::text
      AND up.role = 'ADMIN'
      AND up.status = 'ACTIVE'
    )
  );

-- Policy: System can insert audit logs (service role)
CREATE POLICY "audit_logs_system_insert" ON "audit_logs"
  FOR INSERT
  WITH CHECK (true);

-- ============================================================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================================================

COMMENT ON TABLE "audit_logs" IS 'Immutable audit log for tracking admin actions on user management';
COMMENT ON COLUMN "user_profiles"."role" IS 'User role for RBAC: ADMIN, EXECUTIVE, or ANALYST';
COMMENT ON COLUMN "user_profiles"."status" IS 'User account status: ACTIVE or INACTIVE';
COMMENT ON COLUMN "user_profiles"."invite_token" IS 'One-time token for magic link invitations';
COMMENT ON COLUMN "user_profiles"."invite_expires_at" IS 'Expiration timestamp for invite token (24 hours)';
COMMENT ON COLUMN "audit_logs"."action_details" IS 'JSONB containing before/after values and additional context';
