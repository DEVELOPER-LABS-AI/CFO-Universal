-- ============================================================================
-- Row Level Security (RLS) Policies for DevLabs CFO
-- ============================================================================
--
-- This file contains all RLS policies to enforce organization-level
-- data isolation for multi-tenant SaaS deployment.
--
-- PREREQUISITES:
-- 1. Run manual-migration.sql first (creates all tables)
-- 2. Run rls-setup.sql second (creates user_organizations mapping)
-- 3. Run this file last (applies RLS policies)
--
-- ============================================================================

-- ============================================================================
-- CORE SCHEMA POLICIES
-- ============================================================================

-- Organizations Table
-- Note: Users can only see and modify their own organization
ALTER TABLE core_organizations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_isolation_select" ON core_organizations
  FOR SELECT
  USING (
    id = public.get_user_organization_id()
  );

CREATE POLICY "org_isolation_update" ON core_organizations
  FOR UPDATE
  USING (
    id = public.get_user_organization_id()
  );

-- Clients Table
ALTER TABLE core_clients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_isolation_clients" ON core_clients
  FOR ALL
  USING (
    organization_id = public.get_user_organization_id()
  );

-- Services Table
ALTER TABLE core_services ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_isolation_services" ON core_services
  FOR ALL
  USING (
    organization_id = public.get_user_organization_id()
  );

-- Contractors Table
ALTER TABLE core_contractors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_isolation_contractors" ON core_contractors
  FOR ALL
  USING (
    organization_id = public.get_user_organization_id()
  );

-- Contractor Assignments Table
-- Note: Access controlled via client and contractor relationships
ALTER TABLE core_contractor_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_isolation_assignments" ON core_contractor_assignments
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM core_clients
      WHERE core_clients.id = core_contractor_assignments.client_id
        AND core_clients.organization_id = public.get_user_organization_id()
    )
  );

-- ============================================================================
-- FINANCIAL SCHEMA POLICIES
-- ============================================================================

-- Revenue Records Table
ALTER TABLE financial_revenue_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_isolation_revenue" ON financial_revenue_records
  FOR ALL
  USING (
    organization_id = public.get_user_organization_id()
  );

-- Expense Records Table
ALTER TABLE financial_expense_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_isolation_expenses" ON financial_expense_records
  FOR ALL
  USING (
    organization_id = public.get_user_organization_id()
  );

-- ============================================================================
-- ANALYTICS SCHEMA POLICIES
-- ============================================================================

-- Client Metrics Table
-- Note: Access controlled via client relationship
ALTER TABLE analytics_client_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_isolation_client_metrics" ON analytics_client_metrics
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM core_clients
      WHERE core_clients.id = analytics_client_metrics.client_id
        AND core_clients.organization_id = public.get_user_organization_id()
    )
  );

-- Company Metrics Table
ALTER TABLE analytics_company_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_isolation_company_metrics" ON analytics_company_metrics
  FOR ALL
  USING (
    organization_id = public.get_user_organization_id()
  );

-- ============================================================================
-- INTEGRATIONS SCHEMA POLICIES
-- ============================================================================

-- OAuth Tokens Table
-- CRITICAL: OAuth tokens contain sensitive credentials
ALTER TABLE integrations_oauth_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_isolation_oauth_tokens" ON integrations_oauth_tokens
  FOR ALL
  USING (
    organization_id = public.get_user_organization_id()
  );

-- Sync Logs Table
ALTER TABLE integrations_sync_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_isolation_sync_logs" ON integrations_sync_logs
  FOR ALL
  USING (
    organization_id = public.get_user_organization_id()
  );

-- ============================================================================
-- SYSTEM SCHEMA POLICIES
-- ============================================================================

-- Financial Targets Table
ALTER TABLE system_financial_targets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_isolation_financial_targets" ON system_financial_targets
  FOR ALL
  USING (
    organization_id = public.get_user_organization_id()
  );

-- Growth Scenarios Table
ALTER TABLE system_growth_scenarios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_isolation_growth_scenarios" ON system_growth_scenarios
  FOR ALL
  USING (
    organization_id = public.get_user_organization_id()
  );

-- ============================================================================
-- SERVICE ROLE BYPASS (for Edge Functions & Admin Operations)
-- ============================================================================
--
-- The Supabase service_role key automatically bypasses RLS policies.
-- Use service_role connections only in:
-- - Supabase Edge Functions for scheduled jobs (Xero/Mercury sync)
-- - Admin operations that need cross-organization access
-- - Bulk data operations (migrations, backups)
--
-- NEVER expose service_role key to client-side code!
-- ============================================================================

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================
--
-- Run these queries to verify RLS is working correctly:
--
-- 1. Check all tables have RLS enabled:
-- SELECT schemaname, tablename, rowsecurity
-- FROM pg_tables
-- WHERE schemaname = 'public'
--   AND tablename LIKE 'core_%'
--    OR tablename LIKE 'financial_%'
--    OR tablename LIKE 'analytics_%'
--    OR tablename LIKE 'integrations_%'
--    OR tablename LIKE 'system_%';
--
-- 2. Check policies exist for each table:
-- SELECT schemaname, tablename, policyname
-- FROM pg_policies
-- WHERE schemaname = 'public'
-- ORDER BY tablename, policyname;
--
-- 3. Test cross-organization access (should return 0 rows):
-- -- Login as user from org A, try to access org B's data
-- SELECT * FROM core_clients
-- WHERE organization_id = '<org-b-id>';
--
-- ============================================================================

-- ============================================================================
-- NOTES & TROUBLESHOOTING
-- ============================================================================
--
-- If RLS policies are blocking legitimate queries:
--
-- 1. Verify user-organization mapping exists:
--    SELECT * FROM public.user_organizations WHERE user_id = auth.uid();
--
-- 2. Check current user's organization:
--    SELECT public.get_user_organization_id();
--
-- 3. For Edge Functions, use service_role connection:
--    const { data } = await supabase
--      .from('core_clients')
--      .select('*')
--    // With service_role client, RLS is bypassed
--
-- 4. To temporarily disable RLS (dev only):
--    ALTER TABLE table_name DISABLE ROW LEVEL SECURITY;
--
-- 5. To re-enable RLS:
--    ALTER TABLE table_name ENABLE ROW LEVEL SECURITY;
--
-- ============================================================================
