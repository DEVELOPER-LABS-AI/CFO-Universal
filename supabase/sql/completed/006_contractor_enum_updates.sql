-- Migration: Add new enum values + make contractor pricing fields nullable
--
-- IMPORTANT: This migration must be run OUTSIDE of a transaction block.
-- In Supabase Dashboard SQL Editor, this runs automatically without transaction wrapping.
-- If running via psql, do NOT wrap in BEGIN/COMMIT.
--
-- These are ADDITIVE changes only — no existing data is modified.

-- ============================================================================
-- 1. Add VARIABLE to RateType enum
--    Used by: core_contractors, staff, core_client_services
--    Impact: Additive only, no existing rows affected
-- ============================================================================
ALTER TYPE "RateType" ADD VALUE IF NOT EXISTS 'VARIABLE';

-- ============================================================================
-- 2. Add OWNER and AGENCY to EngagementType enum
--    Used by: core_contractors, staff
--    Impact: Additive only, no existing rows affected
-- ============================================================================
ALTER TYPE "EngagementType" ADD VALUE IF NOT EXISTS 'OWNER';
ALTER TYPE "EngagementType" ADD VALUE IF NOT EXISTS 'AGENCY';

-- ============================================================================
-- 3. Make rate, rate_type, and engagement_type nullable on core_contractors
--    Vendor mapping only needs a name — pricing details can be filled in later.
--    Actual costs come from bank transactions, not manually entered rates.
--    Does NOT affect the staff table (staff columns remain NOT NULL).
-- ============================================================================
ALTER TABLE "core_contractors" ALTER COLUMN "rate" DROP NOT NULL;
ALTER TABLE "core_contractors" ALTER COLUMN "rate_type" DROP NOT NULL;
ALTER TABLE "core_contractors" ALTER COLUMN "engagement_type" DROP NOT NULL;

-- ============================================================================
-- Verification queries (uncomment to verify after running)
-- ============================================================================
-- SELECT enum_range(NULL::"RateType");
-- SELECT enum_range(NULL::"EngagementType");
-- SELECT column_name, is_nullable FROM information_schema.columns
--   WHERE table_name = 'core_contractors' AND column_name IN ('rate', 'rate_type', 'engagement_type');
