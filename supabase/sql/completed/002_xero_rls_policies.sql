-- ============================================================================
-- Xero Integration Row Level Security (RLS) Policies
-- ============================================================================
-- This migration creates RLS policies to enforce organization-level data
-- isolation for all Xero integration tables.
--
-- IMPORTANT: Run this script manually in Supabase SQL Editor AFTER running
-- 001_xero_integration_schema.sql
-- ============================================================================

-- ============================================================================
-- Helper Function: Get Current User's Organization ID
-- ============================================================================
-- This function is used by all RLS policies to determine which organization
-- the authenticated user belongs to.

CREATE OR REPLACE FUNCTION public.get_user_organization_id()
RETURNS TEXT AS $$
  SELECT organization_id
  FROM public.user_organizations
  WHERE user_id = auth.uid()
  LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.get_user_organization_id() TO authenticated;

-- ============================================================================
-- Table: xero_connections
-- Policy: Users can only access Xero connections for their organization
-- ============================================================================

-- Enable RLS on xero_connections
ALTER TABLE "xero_connections" ENABLE ROW LEVEL SECURITY;

-- Policy: SELECT - Users can view their organization's Xero connection
CREATE POLICY "xero_connections_select_policy"
ON "xero_connections"
FOR SELECT
TO authenticated
USING (
  organization_id = public.get_user_organization_id()
);

-- Policy: INSERT - Users can create Xero connection for their organization
CREATE POLICY "xero_connections_insert_policy"
ON "xero_connections"
FOR INSERT
TO authenticated
WITH CHECK (
  organization_id = public.get_user_organization_id()
);

-- Policy: UPDATE - Users can update their organization's Xero connection
CREATE POLICY "xero_connections_update_policy"
ON "xero_connections"
FOR UPDATE
TO authenticated
USING (
  organization_id = public.get_user_organization_id()
)
WITH CHECK (
  organization_id = public.get_user_organization_id()
);

-- Policy: DELETE - Users can delete their organization's Xero connection
CREATE POLICY "xero_connections_delete_policy"
ON "xero_connections"
FOR DELETE
TO authenticated
USING (
  organization_id = public.get_user_organization_id()
);

-- ============================================================================
-- Table: xero_sync_logs
-- Policy: Users can only access sync logs for their organization
-- ============================================================================

-- Enable RLS on xero_sync_logs
ALTER TABLE "xero_sync_logs" ENABLE ROW LEVEL SECURITY;

-- Policy: SELECT - Users can view sync logs for their organization's connection
CREATE POLICY "xero_sync_logs_select_policy"
ON "xero_sync_logs"
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM "xero_connections"
    WHERE "xero_connections".id = "xero_sync_logs".connection_id
    AND "xero_connections".organization_id = public.get_user_organization_id()
  )
);

-- Policy: INSERT - System can create sync logs for organization's connection
CREATE POLICY "xero_sync_logs_insert_policy"
ON "xero_sync_logs"
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM "xero_connections"
    WHERE "xero_connections".id = "xero_sync_logs".connection_id
    AND "xero_connections".organization_id = public.get_user_organization_id()
  )
);

-- Policy: UPDATE - System can update sync logs for organization's connection
CREATE POLICY "xero_sync_logs_update_policy"
ON "xero_sync_logs"
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM "xero_connections"
    WHERE "xero_connections".id = "xero_sync_logs".connection_id
    AND "xero_connections".organization_id = public.get_user_organization_id()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM "xero_connections"
    WHERE "xero_connections".id = "xero_sync_logs".connection_id
    AND "xero_connections".organization_id = public.get_user_organization_id()
  )
);

-- Policy: DELETE - Users can delete sync logs for their organization
CREATE POLICY "xero_sync_logs_delete_policy"
ON "xero_sync_logs"
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM "xero_connections"
    WHERE "xero_connections".id = "xero_sync_logs".connection_id
    AND "xero_connections".organization_id = public.get_user_organization_id()
  )
);

-- ============================================================================
-- Table: xero_contact_mappings
-- Policy: Users can only access contact mappings for their organization
-- ============================================================================

-- Enable RLS on xero_contact_mappings
ALTER TABLE "xero_contact_mappings" ENABLE ROW LEVEL SECURITY;

-- Policy: SELECT - Users can view contact mappings for their organization
CREATE POLICY "xero_contact_mappings_select_policy"
ON "xero_contact_mappings"
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM "xero_connections"
    WHERE "xero_connections".id = "xero_contact_mappings".connection_id
    AND "xero_connections".organization_id = public.get_user_organization_id()
  )
);

-- Policy: INSERT - Users can create contact mappings for their organization
CREATE POLICY "xero_contact_mappings_insert_policy"
ON "xero_contact_mappings"
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM "xero_connections"
    WHERE "xero_connections".id = "xero_contact_mappings".connection_id
    AND "xero_connections".organization_id = public.get_user_organization_id()
  )
  AND
  EXISTS (
    SELECT 1 FROM "core_clients"
    WHERE "core_clients".id = "xero_contact_mappings".client_id
    AND "core_clients".organization_id = public.get_user_organization_id()
  )
);

-- Policy: UPDATE - Users can update contact mappings for their organization
CREATE POLICY "xero_contact_mappings_update_policy"
ON "xero_contact_mappings"
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM "xero_connections"
    WHERE "xero_connections".id = "xero_contact_mappings".connection_id
    AND "xero_connections".organization_id = public.get_user_organization_id()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM "xero_connections"
    WHERE "xero_connections".id = "xero_contact_mappings".connection_id
    AND "xero_connections".organization_id = public.get_user_organization_id()
  )
  AND
  EXISTS (
    SELECT 1 FROM "core_clients"
    WHERE "core_clients".id = "xero_contact_mappings".client_id
    AND "core_clients".organization_id = public.get_user_organization_id()
  )
);

-- Policy: DELETE - Users can delete contact mappings for their organization
CREATE POLICY "xero_contact_mappings_delete_policy"
ON "xero_contact_mappings"
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM "xero_connections"
    WHERE "xero_connections".id = "xero_contact_mappings".connection_id
    AND "xero_connections".organization_id = public.get_user_organization_id()
  )
);

-- ============================================================================
-- Table: xero_expense_category_mappings
-- Policy: Users can only access expense mappings for their organization
-- ============================================================================

-- Enable RLS on xero_expense_category_mappings
ALTER TABLE "xero_expense_category_mappings" ENABLE ROW LEVEL SECURITY;

-- Policy: SELECT - Users can view expense mappings for their organization
CREATE POLICY "xero_expense_mappings_select_policy"
ON "xero_expense_category_mappings"
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM "xero_connections"
    WHERE "xero_connections".id = "xero_expense_category_mappings".connection_id
    AND "xero_connections".organization_id = public.get_user_organization_id()
  )
);

-- Policy: INSERT - Users can create expense mappings for their organization
CREATE POLICY "xero_expense_mappings_insert_policy"
ON "xero_expense_category_mappings"
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM "xero_connections"
    WHERE "xero_connections".id = "xero_expense_category_mappings".connection_id
    AND "xero_connections".organization_id = public.get_user_organization_id()
  )
);

-- Policy: UPDATE - Users can update expense mappings for their organization
CREATE POLICY "xero_expense_mappings_update_policy"
ON "xero_expense_category_mappings"
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM "xero_connections"
    WHERE "xero_connections".id = "xero_expense_category_mappings".connection_id
    AND "xero_connections".organization_id = public.get_user_organization_id()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM "xero_connections"
    WHERE "xero_connections".id = "xero_expense_category_mappings".connection_id
    AND "xero_connections".organization_id = public.get_user_organization_id()
  )
);

-- Policy: DELETE - Users can delete expense mappings for their organization
CREATE POLICY "xero_expense_mappings_delete_policy"
ON "xero_expense_category_mappings"
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM "xero_connections"
    WHERE "xero_connections".id = "xero_expense_category_mappings".connection_id
    AND "xero_connections".organization_id = public.get_user_organization_id()
  )
);

-- ============================================================================
-- Update Existing Tables: Add RLS for Xero-synced records
-- ============================================================================

-- Note: Assuming financial_revenue_records and financial_expense_records
-- already have RLS enabled. We're adding additional policies to handle
-- Xero-specific access patterns.

-- Policy: Allow users to read Xero-synced revenue records for their organization
CREATE POLICY "revenue_records_xero_select_policy"
ON "financial_revenue_records"
FOR SELECT
TO authenticated
USING (
  organization_id = public.get_user_organization_id()
  AND xero_invoice_id IS NOT NULL
);

-- Policy: Allow users to read Xero-synced expense records for their organization
CREATE POLICY "expense_records_xero_select_policy"
ON "financial_expense_records"
FOR SELECT
TO authenticated
USING (
  organization_id = public.get_user_organization_id()
  AND xero_expense_id IS NOT NULL
);

-- ============================================================================
-- Service Role Bypass (for background sync jobs)
-- ============================================================================
-- Background sync jobs run with service_role credentials, which bypass RLS.
-- This is necessary for automated sync operations that don't have a user session.
-- The application code must ensure proper organization_id is used in queries.

-- ============================================================================
-- Verification Query
-- ============================================================================
-- Run this query to verify RLS policies are active:
/*
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN (
    'xero_connections',
    'xero_sync_logs',
    'xero_contact_mappings',
    'xero_expense_category_mappings'
  )
ORDER BY tablename, policyname;
*/

-- ============================================================================
-- Success Message
-- ============================================================================
DO $$
BEGIN
    RAISE NOTICE 'Xero integration RLS policies created successfully!';
    RAISE NOTICE 'Next steps:';
    RAISE NOTICE '1. Test policies with authenticated user sessions';
    RAISE NOTICE '2. Verify organization isolation by attempting cross-org access';
    RAISE NOTICE '3. Configure service role credentials for background sync jobs';
    RAISE NOTICE '4. Deploy the application with Xero OAuth endpoints';
END $$;
