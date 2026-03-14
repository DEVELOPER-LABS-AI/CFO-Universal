-- ============================================================================
-- Clean Up Duplicate Enum Types
-- ============================================================================
-- This script removes duplicate PascalCase enum types created by fix-mercury-schema.sql
-- The database should only have one set of enum types (snake_case from Supabase migration)
--
-- IMPORTANT: Run this in Supabase SQL Editor
-- ============================================================================

-- Drop duplicate PascalCase Mercury enum types (if they exist)
DROP TYPE IF EXISTS "public"."MercuryConnectionStatus" CASCADE;
DROP TYPE IF EXISTS "public"."MercurySyncType" CASCADE;
DROP TYPE IF EXISTS "public"."MercurySyncStatus" CASCADE;
DROP TYPE IF EXISTS "public"."MercurySyncTrigger" CASCADE;
DROP TYPE IF EXISTS "public"."MappingConfidence" CASCADE;
DROP TYPE IF EXISTS "public"."MappingSource" CASCADE;
DROP TYPE IF EXISTS "public"."CategorizationRuleType" CASCADE;
DROP TYPE IF EXISTS "public"."MercuryAccountType" CASCADE;
DROP TYPE IF EXISTS "public"."ExpenseRecordSyncStatus" CASCADE;

-- Verify only snake_case enum types remain
SELECT
  t.typname as enum_name,
  n.nspname as schema_name
FROM pg_type t
JOIN pg_namespace n ON t.typnamespace = n.oid
WHERE t.typtype = 'e'  -- enum types only
  AND t.typname LIKE '%mercury%' OR t.typname LIKE '%mapping%' OR t.typname LIKE '%expense_record%'
ORDER BY t.typname;

-- Expected result: Only these should exist:
-- categorization_rule_type
-- expense_record_sync_status
-- mapping_confidence
-- mapping_source
-- mercury_account_type
-- mercury_connection_status
-- mercury_sync_status
-- mercury_sync_trigger
-- mercury_sync_type
