-- ============================================================================
-- 008_comprehensive_rls_policies.sql
-- Feature: 8-rls-policies
-- Date: 2026-02-28
-- Description: Comprehensive RLS policies for all remaining unprotected tables.
--   Adds per-operation (SELECT/INSERT/UPDATE/DELETE) policies to 24 tables,
--   replacing any existing FOR ALL policies with granular per-operation ones.
--   Creates 3 new helper functions for portal scoping.
--
-- Idempotency: Safe to run multiple times. Uses DROP POLICY IF EXISTS before
--   every CREATE POLICY, and CREATE OR REPLACE FUNCTION for helpers.
--
-- Service Role: Supabase service role automatically bypasses all RLS policies.
-- ============================================================================

-- ============================================================================
-- Section 0: Helper Functions
-- ============================================================================

-- get_user_organization_id(): Returns the organization_id for the authenticated user
-- (Originally defined in 002_xero_rls_policies.sql — included here so this
--  migration is self-contained and can be applied to a fresh database.)
CREATE OR REPLACE FUNCTION public.get_user_organization_id()
RETURNS TEXT AS $$
  SELECT organization_id
  FROM public.user_organizations
  WHERE user_id = auth.uid()::text
  LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

GRANT EXECUTE ON FUNCTION public.get_user_organization_id() TO authenticated;

-- get_user_agency_id(): Returns the agency_id for the authenticated user
CREATE OR REPLACE FUNCTION public.get_user_agency_id()
RETURNS TEXT AS $$
  SELECT agency_id
  FROM public.user_profiles
  WHERE user_id = auth.uid()::text
  LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

GRANT EXECUTE ON FUNCTION public.get_user_agency_id() TO authenticated;

-- get_user_contractor_id(): Returns the contractor_id for the authenticated user
CREATE OR REPLACE FUNCTION public.get_user_contractor_id()
RETURNS TEXT AS $$
  SELECT contractor_id
  FROM public.user_profiles
  WHERE user_id = auth.uid()::text
  LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

GRANT EXECUTE ON FUNCTION public.get_user_contractor_id() TO authenticated;

-- get_user_role(): Returns the role for the authenticated user in their org
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS TEXT AS $$
  SELECT role::text
  FROM public.user_organizations
  WHERE user_id = auth.uid()::text
  LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

GRANT EXECUTE ON FUNCTION public.get_user_role() TO authenticated;


-- ============================================================================
-- Section 1: Mercury Integration Tables (4 tables)
-- Tables: mercury_connections, mercury_sync_logs, merchant_mapping_cache,
--         account_balance_history
-- Pattern: mercury_connections uses direct org_id match;
--          others use EXISTS via connection_id -> mercury_connections.organization_id
-- ============================================================================

-- --- mercury_connections ---
ALTER TABLE mercury_connections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "mercury_connections_org_isolation" ON mercury_connections;
DROP POLICY IF EXISTS "mercury_connections_select" ON mercury_connections;
DROP POLICY IF EXISTS "mercury_connections_insert" ON mercury_connections;
DROP POLICY IF EXISTS "mercury_connections_update" ON mercury_connections;
DROP POLICY IF EXISTS "mercury_connections_delete" ON mercury_connections;

CREATE POLICY "mercury_connections_select" ON mercury_connections
  FOR SELECT TO authenticated
  USING (organization_id = public.get_user_organization_id());

CREATE POLICY "mercury_connections_insert" ON mercury_connections
  FOR INSERT TO authenticated
  WITH CHECK (organization_id = public.get_user_organization_id());

CREATE POLICY "mercury_connections_update" ON mercury_connections
  FOR UPDATE TO authenticated
  USING (organization_id = public.get_user_organization_id())
  WITH CHECK (organization_id = public.get_user_organization_id());

CREATE POLICY "mercury_connections_delete" ON mercury_connections
  FOR DELETE TO authenticated
  USING (organization_id = public.get_user_organization_id());

-- --- mercury_sync_logs ---
ALTER TABLE mercury_sync_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "mercury_sync_logs_org_isolation" ON mercury_sync_logs;
DROP POLICY IF EXISTS "mercury_sync_logs_select" ON mercury_sync_logs;
DROP POLICY IF EXISTS "mercury_sync_logs_insert" ON mercury_sync_logs;
DROP POLICY IF EXISTS "mercury_sync_logs_update" ON mercury_sync_logs;
DROP POLICY IF EXISTS "mercury_sync_logs_delete" ON mercury_sync_logs;

CREATE POLICY "mercury_sync_logs_select" ON mercury_sync_logs
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM mercury_connections
      WHERE mercury_connections.id = mercury_sync_logs.connection_id
        AND mercury_connections.organization_id = public.get_user_organization_id()
    )
  );

CREATE POLICY "mercury_sync_logs_insert" ON mercury_sync_logs
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM mercury_connections
      WHERE mercury_connections.id = mercury_sync_logs.connection_id
        AND mercury_connections.organization_id = public.get_user_organization_id()
    )
  );

CREATE POLICY "mercury_sync_logs_update" ON mercury_sync_logs
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM mercury_connections
      WHERE mercury_connections.id = mercury_sync_logs.connection_id
        AND mercury_connections.organization_id = public.get_user_organization_id()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM mercury_connections
      WHERE mercury_connections.id = mercury_sync_logs.connection_id
        AND mercury_connections.organization_id = public.get_user_organization_id()
    )
  );

CREATE POLICY "mercury_sync_logs_delete" ON mercury_sync_logs
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM mercury_connections
      WHERE mercury_connections.id = mercury_sync_logs.connection_id
        AND mercury_connections.organization_id = public.get_user_organization_id()
    )
  );

-- --- merchant_mapping_cache ---
ALTER TABLE merchant_mapping_cache ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "merchant_mapping_org_isolation" ON merchant_mapping_cache;
DROP POLICY IF EXISTS "merchant_mapping_cache_select" ON merchant_mapping_cache;
DROP POLICY IF EXISTS "merchant_mapping_cache_insert" ON merchant_mapping_cache;
DROP POLICY IF EXISTS "merchant_mapping_cache_update" ON merchant_mapping_cache;
DROP POLICY IF EXISTS "merchant_mapping_cache_delete" ON merchant_mapping_cache;

CREATE POLICY "merchant_mapping_cache_select" ON merchant_mapping_cache
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM mercury_connections
      WHERE mercury_connections.id = merchant_mapping_cache.connection_id
        AND mercury_connections.organization_id = public.get_user_organization_id()
    )
  );

CREATE POLICY "merchant_mapping_cache_insert" ON merchant_mapping_cache
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM mercury_connections
      WHERE mercury_connections.id = merchant_mapping_cache.connection_id
        AND mercury_connections.organization_id = public.get_user_organization_id()
    )
  );

CREATE POLICY "merchant_mapping_cache_update" ON merchant_mapping_cache
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM mercury_connections
      WHERE mercury_connections.id = merchant_mapping_cache.connection_id
        AND mercury_connections.organization_id = public.get_user_organization_id()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM mercury_connections
      WHERE mercury_connections.id = merchant_mapping_cache.connection_id
        AND mercury_connections.organization_id = public.get_user_organization_id()
    )
  );

CREATE POLICY "merchant_mapping_cache_delete" ON merchant_mapping_cache
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM mercury_connections
      WHERE mercury_connections.id = merchant_mapping_cache.connection_id
        AND mercury_connections.organization_id = public.get_user_organization_id()
    )
  );

-- --- account_balance_history ---
ALTER TABLE account_balance_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "balance_history_org_isolation" ON account_balance_history;
DROP POLICY IF EXISTS "account_balance_history_select" ON account_balance_history;
DROP POLICY IF EXISTS "account_balance_history_insert" ON account_balance_history;
DROP POLICY IF EXISTS "account_balance_history_update" ON account_balance_history;
DROP POLICY IF EXISTS "account_balance_history_delete" ON account_balance_history;

CREATE POLICY "account_balance_history_select" ON account_balance_history
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM mercury_connections
      WHERE mercury_connections.id = account_balance_history.connection_id
        AND mercury_connections.organization_id = public.get_user_organization_id()
    )
  );

CREATE POLICY "account_balance_history_insert" ON account_balance_history
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM mercury_connections
      WHERE mercury_connections.id = account_balance_history.connection_id
        AND mercury_connections.organization_id = public.get_user_organization_id()
    )
  );

CREATE POLICY "account_balance_history_update" ON account_balance_history
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM mercury_connections
      WHERE mercury_connections.id = account_balance_history.connection_id
        AND mercury_connections.organization_id = public.get_user_organization_id()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM mercury_connections
      WHERE mercury_connections.id = account_balance_history.connection_id
        AND mercury_connections.organization_id = public.get_user_organization_id()
    )
  );

CREATE POLICY "account_balance_history_delete" ON account_balance_history
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM mercury_connections
      WHERE mercury_connections.id = account_balance_history.connection_id
        AND mercury_connections.organization_id = public.get_user_organization_id()
    )
  );


-- ============================================================================
-- Section 2: Subscription / Cost Sync Tables (3 tables)
-- Tables: subscription_transaction_records, client_cash_receipts, auto_sync_run_logs
-- Pattern: Direct org_id match
-- ============================================================================

-- --- subscription_transaction_records ---
ALTER TABLE subscription_transaction_records ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sub_tx_records_org_isolation" ON subscription_transaction_records;
DROP POLICY IF EXISTS "subscription_transaction_records_select" ON subscription_transaction_records;
DROP POLICY IF EXISTS "subscription_transaction_records_insert" ON subscription_transaction_records;
DROP POLICY IF EXISTS "subscription_transaction_records_update" ON subscription_transaction_records;
DROP POLICY IF EXISTS "subscription_transaction_records_delete" ON subscription_transaction_records;

CREATE POLICY "subscription_transaction_records_select" ON subscription_transaction_records
  FOR SELECT TO authenticated
  USING (organization_id = public.get_user_organization_id());

CREATE POLICY "subscription_transaction_records_insert" ON subscription_transaction_records
  FOR INSERT TO authenticated
  WITH CHECK (organization_id = public.get_user_organization_id());

CREATE POLICY "subscription_transaction_records_update" ON subscription_transaction_records
  FOR UPDATE TO authenticated
  USING (organization_id = public.get_user_organization_id())
  WITH CHECK (organization_id = public.get_user_organization_id());

CREATE POLICY "subscription_transaction_records_delete" ON subscription_transaction_records
  FOR DELETE TO authenticated
  USING (organization_id = public.get_user_organization_id());

-- --- client_cash_receipts ---
ALTER TABLE client_cash_receipts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ccr_org_isolation" ON client_cash_receipts;
DROP POLICY IF EXISTS "client_cash_receipts_select" ON client_cash_receipts;
DROP POLICY IF EXISTS "client_cash_receipts_insert" ON client_cash_receipts;
DROP POLICY IF EXISTS "client_cash_receipts_update" ON client_cash_receipts;
DROP POLICY IF EXISTS "client_cash_receipts_delete" ON client_cash_receipts;

CREATE POLICY "client_cash_receipts_select" ON client_cash_receipts
  FOR SELECT TO authenticated
  USING (organization_id = public.get_user_organization_id());

CREATE POLICY "client_cash_receipts_insert" ON client_cash_receipts
  FOR INSERT TO authenticated
  WITH CHECK (organization_id = public.get_user_organization_id());

CREATE POLICY "client_cash_receipts_update" ON client_cash_receipts
  FOR UPDATE TO authenticated
  USING (organization_id = public.get_user_organization_id())
  WITH CHECK (organization_id = public.get_user_organization_id());

CREATE POLICY "client_cash_receipts_delete" ON client_cash_receipts
  FOR DELETE TO authenticated
  USING (organization_id = public.get_user_organization_id());

-- --- auto_sync_run_logs ---
ALTER TABLE auto_sync_run_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "asrl_org_isolation" ON auto_sync_run_logs;
DROP POLICY IF EXISTS "auto_sync_run_logs_select" ON auto_sync_run_logs;
DROP POLICY IF EXISTS "auto_sync_run_logs_insert" ON auto_sync_run_logs;
DROP POLICY IF EXISTS "auto_sync_run_logs_update" ON auto_sync_run_logs;
DROP POLICY IF EXISTS "auto_sync_run_logs_delete" ON auto_sync_run_logs;

CREATE POLICY "auto_sync_run_logs_select" ON auto_sync_run_logs
  FOR SELECT TO authenticated
  USING (organization_id = public.get_user_organization_id());

CREATE POLICY "auto_sync_run_logs_insert" ON auto_sync_run_logs
  FOR INSERT TO authenticated
  WITH CHECK (organization_id = public.get_user_organization_id());

CREATE POLICY "auto_sync_run_logs_update" ON auto_sync_run_logs
  FOR UPDATE TO authenticated
  USING (organization_id = public.get_user_organization_id())
  WITH CHECK (organization_id = public.get_user_organization_id());

CREATE POLICY "auto_sync_run_logs_delete" ON auto_sync_run_logs
  FOR DELETE TO authenticated
  USING (organization_id = public.get_user_organization_id());


-- ============================================================================
-- Section 3: Staff Management Tables (4 tables)
-- Tables: staff_roles, staff_bonuses, staff_reimbursements,
--         monthly_allocation_overrides
-- Pattern: staff_roles uses direct org_id; others use EXISTS via FK chains
-- ============================================================================

-- --- staff_roles ---
ALTER TABLE staff_roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "staff_roles_select" ON staff_roles;
DROP POLICY IF EXISTS "staff_roles_insert" ON staff_roles;
DROP POLICY IF EXISTS "staff_roles_update" ON staff_roles;
DROP POLICY IF EXISTS "staff_roles_delete" ON staff_roles;

CREATE POLICY "staff_roles_select" ON staff_roles
  FOR SELECT TO authenticated
  USING (organization_id = public.get_user_organization_id());

CREATE POLICY "staff_roles_insert" ON staff_roles
  FOR INSERT TO authenticated
  WITH CHECK (organization_id = public.get_user_organization_id());

CREATE POLICY "staff_roles_update" ON staff_roles
  FOR UPDATE TO authenticated
  USING (organization_id = public.get_user_organization_id())
  WITH CHECK (organization_id = public.get_user_organization_id());

CREATE POLICY "staff_roles_delete" ON staff_roles
  FOR DELETE TO authenticated
  USING (organization_id = public.get_user_organization_id());

-- --- staff_bonuses ---
ALTER TABLE staff_bonuses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "staff_bonuses_select" ON staff_bonuses;
DROP POLICY IF EXISTS "staff_bonuses_insert" ON staff_bonuses;
DROP POLICY IF EXISTS "staff_bonuses_update" ON staff_bonuses;
DROP POLICY IF EXISTS "staff_bonuses_delete" ON staff_bonuses;

CREATE POLICY "staff_bonuses_select" ON staff_bonuses
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM staff
      WHERE staff.id = staff_bonuses.staff_id
        AND staff.organization_id = public.get_user_organization_id()
    )
  );

CREATE POLICY "staff_bonuses_insert" ON staff_bonuses
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM staff
      WHERE staff.id = staff_bonuses.staff_id
        AND staff.organization_id = public.get_user_organization_id()
    )
  );

CREATE POLICY "staff_bonuses_update" ON staff_bonuses
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM staff
      WHERE staff.id = staff_bonuses.staff_id
        AND staff.organization_id = public.get_user_organization_id()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM staff
      WHERE staff.id = staff_bonuses.staff_id
        AND staff.organization_id = public.get_user_organization_id()
    )
  );

CREATE POLICY "staff_bonuses_delete" ON staff_bonuses
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM staff
      WHERE staff.id = staff_bonuses.staff_id
        AND staff.organization_id = public.get_user_organization_id()
    )
  );

-- --- staff_reimbursements ---
ALTER TABLE staff_reimbursements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "staff_reimbursements_select" ON staff_reimbursements;
DROP POLICY IF EXISTS "staff_reimbursements_insert" ON staff_reimbursements;
DROP POLICY IF EXISTS "staff_reimbursements_update" ON staff_reimbursements;
DROP POLICY IF EXISTS "staff_reimbursements_delete" ON staff_reimbursements;

CREATE POLICY "staff_reimbursements_select" ON staff_reimbursements
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM staff
      WHERE staff.id = staff_reimbursements.staff_id
        AND staff.organization_id = public.get_user_organization_id()
    )
  );

CREATE POLICY "staff_reimbursements_insert" ON staff_reimbursements
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM staff
      WHERE staff.id = staff_reimbursements.staff_id
        AND staff.organization_id = public.get_user_organization_id()
    )
  );

CREATE POLICY "staff_reimbursements_update" ON staff_reimbursements
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM staff
      WHERE staff.id = staff_reimbursements.staff_id
        AND staff.organization_id = public.get_user_organization_id()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM staff
      WHERE staff.id = staff_reimbursements.staff_id
        AND staff.organization_id = public.get_user_organization_id()
    )
  );

CREATE POLICY "staff_reimbursements_delete" ON staff_reimbursements
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM staff
      WHERE staff.id = staff_reimbursements.staff_id
        AND staff.organization_id = public.get_user_organization_id()
    )
  );

-- --- monthly_allocation_overrides ---
ALTER TABLE monthly_allocation_overrides ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "monthly_allocation_overrides_select" ON monthly_allocation_overrides;
DROP POLICY IF EXISTS "monthly_allocation_overrides_insert" ON monthly_allocation_overrides;
DROP POLICY IF EXISTS "monthly_allocation_overrides_update" ON monthly_allocation_overrides;
DROP POLICY IF EXISTS "monthly_allocation_overrides_delete" ON monthly_allocation_overrides;

CREATE POLICY "monthly_allocation_overrides_select" ON monthly_allocation_overrides
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM staff_assignments
      JOIN staff ON staff.id = staff_assignments.staff_id
      WHERE staff_assignments.id = monthly_allocation_overrides.assignment_id
        AND staff.organization_id = public.get_user_organization_id()
    )
  );

CREATE POLICY "monthly_allocation_overrides_insert" ON monthly_allocation_overrides
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM staff_assignments
      JOIN staff ON staff.id = staff_assignments.staff_id
      WHERE staff_assignments.id = monthly_allocation_overrides.assignment_id
        AND staff.organization_id = public.get_user_organization_id()
    )
  );

CREATE POLICY "monthly_allocation_overrides_update" ON monthly_allocation_overrides
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM staff_assignments
      JOIN staff ON staff.id = staff_assignments.staff_id
      WHERE staff_assignments.id = monthly_allocation_overrides.assignment_id
        AND staff.organization_id = public.get_user_organization_id()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM staff_assignments
      JOIN staff ON staff.id = staff_assignments.staff_id
      WHERE staff_assignments.id = monthly_allocation_overrides.assignment_id
        AND staff.organization_id = public.get_user_organization_id()
    )
  );

CREATE POLICY "monthly_allocation_overrides_delete" ON monthly_allocation_overrides
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM staff_assignments
      JOIN staff ON staff.id = staff_assignments.staff_id
      WHERE staff_assignments.id = monthly_allocation_overrides.assignment_id
        AND staff.organization_id = public.get_user_organization_id()
    )
  );


-- ============================================================================
-- Section 4: Agency Portal Tables (3 tables)
-- Tables: agency_invoices, agency_invoice_line_items, agency_invoice_comments
-- Pattern: Dual-path — AGENCY_ADMIN sees own agency; ADMIN/ANALYST/EXECUTIVE
--          see all org agencies
-- ============================================================================

-- --- agency_invoices ---
ALTER TABLE agency_invoices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "agency_invoices_select" ON agency_invoices;
DROP POLICY IF EXISTS "agency_invoices_insert" ON agency_invoices;
DROP POLICY IF EXISTS "agency_invoices_update" ON agency_invoices;
DROP POLICY IF EXISTS "agency_invoices_delete" ON agency_invoices;

CREATE POLICY "agency_invoices_select" ON agency_invoices
  FOR SELECT TO authenticated
  USING (
    (agency_id = public.get_user_agency_id())
    OR
    (
      EXISTS (
        SELECT 1 FROM agencies
        WHERE agencies.id = agency_invoices.agency_id
          AND agencies.organization_id = public.get_user_organization_id()
      )
      AND public.get_user_role() IN ('ADMIN', 'ANALYST', 'EXECUTIVE')
    )
  );

CREATE POLICY "agency_invoices_insert" ON agency_invoices
  FOR INSERT TO authenticated
  WITH CHECK (
    (agency_id = public.get_user_agency_id())
    OR
    (
      EXISTS (
        SELECT 1 FROM agencies
        WHERE agencies.id = agency_invoices.agency_id
          AND agencies.organization_id = public.get_user_organization_id()
      )
      AND public.get_user_role() = 'ADMIN'
    )
  );

CREATE POLICY "agency_invoices_update" ON agency_invoices
  FOR UPDATE TO authenticated
  USING (
    (agency_id = public.get_user_agency_id())
    OR
    (
      EXISTS (
        SELECT 1 FROM agencies
        WHERE agencies.id = agency_invoices.agency_id
          AND agencies.organization_id = public.get_user_organization_id()
      )
      AND public.get_user_role() = 'ADMIN'
    )
  )
  WITH CHECK (
    (agency_id = public.get_user_agency_id())
    OR
    (
      EXISTS (
        SELECT 1 FROM agencies
        WHERE agencies.id = agency_invoices.agency_id
          AND agencies.organization_id = public.get_user_organization_id()
      )
      AND public.get_user_role() = 'ADMIN'
    )
  );

CREATE POLICY "agency_invoices_delete" ON agency_invoices
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM agencies
      WHERE agencies.id = agency_invoices.agency_id
        AND agencies.organization_id = public.get_user_organization_id()
    )
    AND public.get_user_role() = 'ADMIN'
  );

-- --- agency_invoice_line_items ---
ALTER TABLE agency_invoice_line_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "agency_invoice_line_items_select" ON agency_invoice_line_items;
DROP POLICY IF EXISTS "agency_invoice_line_items_insert" ON agency_invoice_line_items;
DROP POLICY IF EXISTS "agency_invoice_line_items_update" ON agency_invoice_line_items;
DROP POLICY IF EXISTS "agency_invoice_line_items_delete" ON agency_invoice_line_items;

CREATE POLICY "agency_invoice_line_items_select" ON agency_invoice_line_items
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM agency_invoices
      JOIN agencies ON agencies.id = agency_invoices.agency_id
      WHERE agency_invoices.id = agency_invoice_line_items.invoice_id
        AND (
          (agencies.id = public.get_user_agency_id())
          OR
          (agencies.organization_id = public.get_user_organization_id()
           AND public.get_user_role() IN ('ADMIN', 'ANALYST', 'EXECUTIVE'))
        )
    )
  );

CREATE POLICY "agency_invoice_line_items_insert" ON agency_invoice_line_items
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM agency_invoices
      JOIN agencies ON agencies.id = agency_invoices.agency_id
      WHERE agency_invoices.id = agency_invoice_line_items.invoice_id
        AND (
          (agencies.id = public.get_user_agency_id())
          OR
          (agencies.organization_id = public.get_user_organization_id()
           AND public.get_user_role() = 'ADMIN')
        )
    )
  );

CREATE POLICY "agency_invoice_line_items_update" ON agency_invoice_line_items
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM agency_invoices
      JOIN agencies ON agencies.id = agency_invoices.agency_id
      WHERE agency_invoices.id = agency_invoice_line_items.invoice_id
        AND (
          (agencies.id = public.get_user_agency_id())
          OR
          (agencies.organization_id = public.get_user_organization_id()
           AND public.get_user_role() = 'ADMIN')
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM agency_invoices
      JOIN agencies ON agencies.id = agency_invoices.agency_id
      WHERE agency_invoices.id = agency_invoice_line_items.invoice_id
        AND (
          (agencies.id = public.get_user_agency_id())
          OR
          (agencies.organization_id = public.get_user_organization_id()
           AND public.get_user_role() = 'ADMIN')
        )
    )
  );

CREATE POLICY "agency_invoice_line_items_delete" ON agency_invoice_line_items
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM agency_invoices
      JOIN agencies ON agencies.id = agency_invoices.agency_id
      WHERE agency_invoices.id = agency_invoice_line_items.invoice_id
        AND (
          (agencies.id = public.get_user_agency_id())
          OR
          (agencies.organization_id = public.get_user_organization_id()
           AND public.get_user_role() = 'ADMIN')
        )
    )
  );

-- --- agency_invoice_comments ---
ALTER TABLE agency_invoice_comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "agency_invoice_comments_select" ON agency_invoice_comments;
DROP POLICY IF EXISTS "agency_invoice_comments_insert" ON agency_invoice_comments;
DROP POLICY IF EXISTS "agency_invoice_comments_update" ON agency_invoice_comments;
DROP POLICY IF EXISTS "agency_invoice_comments_delete" ON agency_invoice_comments;

CREATE POLICY "agency_invoice_comments_select" ON agency_invoice_comments
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM agency_invoices
      JOIN agencies ON agencies.id = agency_invoices.agency_id
      WHERE agency_invoices.id = agency_invoice_comments.invoice_id
        AND (
          (agencies.id = public.get_user_agency_id())
          OR
          (agencies.organization_id = public.get_user_organization_id()
           AND public.get_user_role() IN ('ADMIN', 'ANALYST', 'EXECUTIVE'))
        )
    )
  );

CREATE POLICY "agency_invoice_comments_insert" ON agency_invoice_comments
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM agency_invoices
      JOIN agencies ON agencies.id = agency_invoices.agency_id
      WHERE agency_invoices.id = agency_invoice_comments.invoice_id
        AND (
          (agencies.id = public.get_user_agency_id())
          OR
          (agencies.organization_id = public.get_user_organization_id()
           AND public.get_user_role() IN ('ADMIN', 'ANALYST', 'EXECUTIVE'))
        )
    )
  );

CREATE POLICY "agency_invoice_comments_update" ON agency_invoice_comments
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM agency_invoices
      JOIN agencies ON agencies.id = agency_invoices.agency_id
      WHERE agency_invoices.id = agency_invoice_comments.invoice_id
        AND (
          (agencies.id = public.get_user_agency_id())
          OR
          (agencies.organization_id = public.get_user_organization_id()
           AND public.get_user_role() IN ('ADMIN', 'ANALYST', 'EXECUTIVE'))
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM agency_invoices
      JOIN agencies ON agencies.id = agency_invoices.agency_id
      WHERE agency_invoices.id = agency_invoice_comments.invoice_id
        AND (
          (agencies.id = public.get_user_agency_id())
          OR
          (agencies.organization_id = public.get_user_organization_id()
           AND public.get_user_role() IN ('ADMIN', 'ANALYST', 'EXECUTIVE'))
        )
    )
  );

CREATE POLICY "agency_invoice_comments_delete" ON agency_invoice_comments
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM agency_invoices
      JOIN agencies ON agencies.id = agency_invoices.agency_id
      WHERE agency_invoices.id = agency_invoice_comments.invoice_id
        AND (
          (agencies.id = public.get_user_agency_id())
          OR
          (agencies.organization_id = public.get_user_organization_id()
           AND public.get_user_role() = 'ADMIN')
        )
    )
  );


-- ============================================================================
-- Section 5: Contractor Portal Tables (4 tables)
-- Tables: contractor_invoices, contractor_invoice_line_items,
--         contractor_documents, contractor_payments
-- Pattern: Dual-path — CONTRACTOR sees own data; ADMIN/ANALYST/EXECUTIVE
--          see all org contractors. Payments: contractors can only SELECT.
-- ============================================================================

-- --- contractor_invoices ---
ALTER TABLE contractor_invoices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "contractor_invoices_select" ON contractor_invoices;
DROP POLICY IF EXISTS "contractor_invoices_insert" ON contractor_invoices;
DROP POLICY IF EXISTS "contractor_invoices_update" ON contractor_invoices;
DROP POLICY IF EXISTS "contractor_invoices_delete" ON contractor_invoices;

CREATE POLICY "contractor_invoices_select" ON contractor_invoices
  FOR SELECT TO authenticated
  USING (
    (contractor_id = public.get_user_contractor_id())
    OR
    (organization_id = public.get_user_organization_id()
     AND public.get_user_role() IN ('ADMIN', 'ANALYST', 'EXECUTIVE'))
  );

CREATE POLICY "contractor_invoices_insert" ON contractor_invoices
  FOR INSERT TO authenticated
  WITH CHECK (
    (contractor_id = public.get_user_contractor_id())
    OR
    (organization_id = public.get_user_organization_id()
     AND public.get_user_role() = 'ADMIN')
  );

CREATE POLICY "contractor_invoices_update" ON contractor_invoices
  FOR UPDATE TO authenticated
  USING (
    (contractor_id = public.get_user_contractor_id())
    OR
    (organization_id = public.get_user_organization_id()
     AND public.get_user_role() = 'ADMIN')
  )
  WITH CHECK (
    (contractor_id = public.get_user_contractor_id())
    OR
    (organization_id = public.get_user_organization_id()
     AND public.get_user_role() = 'ADMIN')
  );

CREATE POLICY "contractor_invoices_delete" ON contractor_invoices
  FOR DELETE TO authenticated
  USING (
    (contractor_id = public.get_user_contractor_id())
    OR
    (organization_id = public.get_user_organization_id()
     AND public.get_user_role() = 'ADMIN')
  );

-- --- contractor_invoice_line_items ---
ALTER TABLE contractor_invoice_line_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "contractor_invoice_line_items_select" ON contractor_invoice_line_items;
DROP POLICY IF EXISTS "contractor_invoice_line_items_insert" ON contractor_invoice_line_items;
DROP POLICY IF EXISTS "contractor_invoice_line_items_update" ON contractor_invoice_line_items;
DROP POLICY IF EXISTS "contractor_invoice_line_items_delete" ON contractor_invoice_line_items;

CREATE POLICY "contractor_invoice_line_items_select" ON contractor_invoice_line_items
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM contractor_invoices
      WHERE contractor_invoices.id = contractor_invoice_line_items.invoice_id
        AND (
          (contractor_invoices.contractor_id = public.get_user_contractor_id())
          OR
          (contractor_invoices.organization_id = public.get_user_organization_id()
           AND public.get_user_role() IN ('ADMIN', 'ANALYST', 'EXECUTIVE'))
        )
    )
  );

CREATE POLICY "contractor_invoice_line_items_insert" ON contractor_invoice_line_items
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM contractor_invoices
      WHERE contractor_invoices.id = contractor_invoice_line_items.invoice_id
        AND (
          (contractor_invoices.contractor_id = public.get_user_contractor_id())
          OR
          (contractor_invoices.organization_id = public.get_user_organization_id()
           AND public.get_user_role() = 'ADMIN')
        )
    )
  );

CREATE POLICY "contractor_invoice_line_items_update" ON contractor_invoice_line_items
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM contractor_invoices
      WHERE contractor_invoices.id = contractor_invoice_line_items.invoice_id
        AND (
          (contractor_invoices.contractor_id = public.get_user_contractor_id())
          OR
          (contractor_invoices.organization_id = public.get_user_organization_id()
           AND public.get_user_role() = 'ADMIN')
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM contractor_invoices
      WHERE contractor_invoices.id = contractor_invoice_line_items.invoice_id
        AND (
          (contractor_invoices.contractor_id = public.get_user_contractor_id())
          OR
          (contractor_invoices.organization_id = public.get_user_organization_id()
           AND public.get_user_role() = 'ADMIN')
        )
    )
  );

CREATE POLICY "contractor_invoice_line_items_delete" ON contractor_invoice_line_items
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM contractor_invoices
      WHERE contractor_invoices.id = contractor_invoice_line_items.invoice_id
        AND (
          (contractor_invoices.contractor_id = public.get_user_contractor_id())
          OR
          (contractor_invoices.organization_id = public.get_user_organization_id()
           AND public.get_user_role() = 'ADMIN')
        )
    )
  );

-- --- contractor_documents ---
ALTER TABLE contractor_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "contractor_documents_select" ON contractor_documents;
DROP POLICY IF EXISTS "contractor_documents_insert" ON contractor_documents;
DROP POLICY IF EXISTS "contractor_documents_update" ON contractor_documents;
DROP POLICY IF EXISTS "contractor_documents_delete" ON contractor_documents;

CREATE POLICY "contractor_documents_select" ON contractor_documents
  FOR SELECT TO authenticated
  USING (
    (contractor_id = public.get_user_contractor_id())
    OR
    (organization_id = public.get_user_organization_id()
     AND public.get_user_role() IN ('ADMIN', 'ANALYST', 'EXECUTIVE'))
  );

CREATE POLICY "contractor_documents_insert" ON contractor_documents
  FOR INSERT TO authenticated
  WITH CHECK (
    (contractor_id = public.get_user_contractor_id())
    OR
    (organization_id = public.get_user_organization_id()
     AND public.get_user_role() = 'ADMIN')
  );

CREATE POLICY "contractor_documents_update" ON contractor_documents
  FOR UPDATE TO authenticated
  USING (
    (contractor_id = public.get_user_contractor_id())
    OR
    (organization_id = public.get_user_organization_id()
     AND public.get_user_role() = 'ADMIN')
  )
  WITH CHECK (
    (contractor_id = public.get_user_contractor_id())
    OR
    (organization_id = public.get_user_organization_id()
     AND public.get_user_role() = 'ADMIN')
  );

CREATE POLICY "contractor_documents_delete" ON contractor_documents
  FOR DELETE TO authenticated
  USING (
    (contractor_id = public.get_user_contractor_id())
    OR
    (organization_id = public.get_user_organization_id()
     AND public.get_user_role() = 'ADMIN')
  );

-- --- contractor_payments ---
-- Note: Contractors can only SELECT their own payments.
-- INSERT/UPDATE/DELETE restricted to org-level roles only.
ALTER TABLE contractor_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "contractor_payments_select" ON contractor_payments;
DROP POLICY IF EXISTS "contractor_payments_insert" ON contractor_payments;
DROP POLICY IF EXISTS "contractor_payments_update" ON contractor_payments;
DROP POLICY IF EXISTS "contractor_payments_delete" ON contractor_payments;

CREATE POLICY "contractor_payments_select" ON contractor_payments
  FOR SELECT TO authenticated
  USING (
    (contractor_id = public.get_user_contractor_id())
    OR
    (organization_id = public.get_user_organization_id()
     AND public.get_user_role() IN ('ADMIN', 'ANALYST', 'EXECUTIVE'))
  );

CREATE POLICY "contractor_payments_insert" ON contractor_payments
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = public.get_user_organization_id()
    AND public.get_user_role() = 'ADMIN'
  );

CREATE POLICY "contractor_payments_update" ON contractor_payments
  FOR UPDATE TO authenticated
  USING (
    organization_id = public.get_user_organization_id()
    AND public.get_user_role() = 'ADMIN'
  )
  WITH CHECK (
    organization_id = public.get_user_organization_id()
    AND public.get_user_role() = 'ADMIN'
  );

CREATE POLICY "contractor_payments_delete" ON contractor_payments
  FOR DELETE TO authenticated
  USING (
    organization_id = public.get_user_organization_id()
    AND public.get_user_role() = 'ADMIN'
  );


-- ============================================================================
-- Section 6: System / Utility Tables (5 tables)
-- Tables: transaction_categorization_rules, vendor_expense_categories,
--         owner_monthly_pay, user_profiles, audit_logs
-- Pattern: First 3 use direct org_id; user_profiles uses user_id = auth.uid();
--          audit_logs uses actor_id = auth.uid() for SELECT only
-- ============================================================================

-- --- transaction_categorization_rules ---
ALTER TABLE transaction_categorization_rules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "categorization_rules_org_isolation" ON transaction_categorization_rules;
DROP POLICY IF EXISTS "transaction_categorization_rules_select" ON transaction_categorization_rules;
DROP POLICY IF EXISTS "transaction_categorization_rules_insert" ON transaction_categorization_rules;
DROP POLICY IF EXISTS "transaction_categorization_rules_update" ON transaction_categorization_rules;
DROP POLICY IF EXISTS "transaction_categorization_rules_delete" ON transaction_categorization_rules;

CREATE POLICY "transaction_categorization_rules_select" ON transaction_categorization_rules
  FOR SELECT TO authenticated
  USING (organization_id = public.get_user_organization_id());

CREATE POLICY "transaction_categorization_rules_insert" ON transaction_categorization_rules
  FOR INSERT TO authenticated
  WITH CHECK (organization_id = public.get_user_organization_id());

CREATE POLICY "transaction_categorization_rules_update" ON transaction_categorization_rules
  FOR UPDATE TO authenticated
  USING (organization_id = public.get_user_organization_id())
  WITH CHECK (organization_id = public.get_user_organization_id());

CREATE POLICY "transaction_categorization_rules_delete" ON transaction_categorization_rules
  FOR DELETE TO authenticated
  USING (organization_id = public.get_user_organization_id());

-- --- vendor_expense_categories ---
ALTER TABLE vendor_expense_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "vendor_expense_categories_select" ON vendor_expense_categories;
DROP POLICY IF EXISTS "vendor_expense_categories_insert" ON vendor_expense_categories;
DROP POLICY IF EXISTS "vendor_expense_categories_update" ON vendor_expense_categories;
DROP POLICY IF EXISTS "vendor_expense_categories_delete" ON vendor_expense_categories;

CREATE POLICY "vendor_expense_categories_select" ON vendor_expense_categories
  FOR SELECT TO authenticated
  USING (organization_id = public.get_user_organization_id());

CREATE POLICY "vendor_expense_categories_insert" ON vendor_expense_categories
  FOR INSERT TO authenticated
  WITH CHECK (organization_id = public.get_user_organization_id());

CREATE POLICY "vendor_expense_categories_update" ON vendor_expense_categories
  FOR UPDATE TO authenticated
  USING (organization_id = public.get_user_organization_id())
  WITH CHECK (organization_id = public.get_user_organization_id());

CREATE POLICY "vendor_expense_categories_delete" ON vendor_expense_categories
  FOR DELETE TO authenticated
  USING (organization_id = public.get_user_organization_id());

-- --- owner_monthly_pay ---
ALTER TABLE owner_monthly_pay ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "owner_monthly_pay_select" ON owner_monthly_pay;
DROP POLICY IF EXISTS "owner_monthly_pay_insert" ON owner_monthly_pay;
DROP POLICY IF EXISTS "owner_monthly_pay_update" ON owner_monthly_pay;
DROP POLICY IF EXISTS "owner_monthly_pay_delete" ON owner_monthly_pay;

CREATE POLICY "owner_monthly_pay_select" ON owner_monthly_pay
  FOR SELECT TO authenticated
  USING (organization_id = public.get_user_organization_id());

CREATE POLICY "owner_monthly_pay_insert" ON owner_monthly_pay
  FOR INSERT TO authenticated
  WITH CHECK (organization_id = public.get_user_organization_id());

CREATE POLICY "owner_monthly_pay_update" ON owner_monthly_pay
  FOR UPDATE TO authenticated
  USING (organization_id = public.get_user_organization_id())
  WITH CHECK (organization_id = public.get_user_organization_id());

CREATE POLICY "owner_monthly_pay_delete" ON owner_monthly_pay
  FOR DELETE TO authenticated
  USING (organization_id = public.get_user_organization_id());

-- --- user_profiles ---
-- Users can only access their own profile. No DELETE for authenticated role.
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_profiles_select" ON user_profiles;
DROP POLICY IF EXISTS "user_profiles_insert" ON user_profiles;
DROP POLICY IF EXISTS "user_profiles_update" ON user_profiles;

CREATE POLICY "user_profiles_select" ON user_profiles
  FOR SELECT TO authenticated
  USING (user_id = auth.uid()::text);

CREATE POLICY "user_profiles_insert" ON user_profiles
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid()::text);

CREATE POLICY "user_profiles_update" ON user_profiles
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid()::text)
  WITH CHECK (user_id = auth.uid()::text);

-- No DELETE policy: only service role can delete user profiles

-- --- audit_logs ---
-- Users can only see audit entries where they are the actor.
-- No INSERT/UPDATE/DELETE for authenticated role (service role only writes).
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "audit_logs_select" ON audit_logs;

CREATE POLICY "audit_logs_select" ON audit_logs
  FOR SELECT TO authenticated
  USING (actor_id = auth.uid()::text);

-- No INSERT/UPDATE/DELETE policies: service role only writes audit logs


-- ============================================================================
-- Section 7: Junction / Child Tables (1 table)
-- Tables: core_client_services
-- Pattern: EXISTS via client_id -> core_clients.organization_id
-- ============================================================================

-- --- core_client_services ---
ALTER TABLE core_client_services ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "core_client_services_select" ON core_client_services;
DROP POLICY IF EXISTS "core_client_services_insert" ON core_client_services;
DROP POLICY IF EXISTS "core_client_services_update" ON core_client_services;
DROP POLICY IF EXISTS "core_client_services_delete" ON core_client_services;

CREATE POLICY "core_client_services_select" ON core_client_services
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM core_clients
      WHERE core_clients.id = core_client_services.client_id
        AND core_clients.organization_id = public.get_user_organization_id()
    )
  );

CREATE POLICY "core_client_services_insert" ON core_client_services
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM core_clients
      WHERE core_clients.id = core_client_services.client_id
        AND core_clients.organization_id = public.get_user_organization_id()
    )
  );

CREATE POLICY "core_client_services_update" ON core_client_services
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM core_clients
      WHERE core_clients.id = core_client_services.client_id
        AND core_clients.organization_id = public.get_user_organization_id()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM core_clients
      WHERE core_clients.id = core_client_services.client_id
        AND core_clients.organization_id = public.get_user_organization_id()
    )
  );

CREATE POLICY "core_client_services_delete" ON core_client_services
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM core_clients
      WHERE core_clients.id = core_client_services.client_id
        AND core_clients.organization_id = public.get_user_organization_id()
    )
  );


-- ============================================================================
-- Section 8: Verification Queries
-- Run after applying migration to confirm 100% RLS coverage
-- ============================================================================

-- Check for any public tables WITHOUT RLS enabled (should return 0 rows):
-- SELECT tablename FROM pg_tables
-- WHERE schemaname = 'public' AND rowsecurity = false
-- ORDER BY tablename;

-- Count total policies per table (for verification):
-- SELECT tablename, count(*) as policy_count
-- FROM pg_policies
-- WHERE schemaname = 'public'
-- GROUP BY tablename
-- ORDER BY tablename;


-- ============================================================================
-- Section 9: Rollback Script (COMMENTED OUT)
-- Uncomment and run to remove all policies created by this migration.
-- Does NOT touch policies from other migrations (002, 005, rls-policies-client-staff).
-- ============================================================================

/*
-- Drop helper functions
DROP FUNCTION IF EXISTS public.get_user_agency_id();
DROP FUNCTION IF EXISTS public.get_user_contractor_id();
DROP FUNCTION IF EXISTS public.get_user_role();

-- Mercury Integration
DROP POLICY IF EXISTS "mercury_connections_select" ON mercury_connections;
DROP POLICY IF EXISTS "mercury_connections_insert" ON mercury_connections;
DROP POLICY IF EXISTS "mercury_connections_update" ON mercury_connections;
DROP POLICY IF EXISTS "mercury_connections_delete" ON mercury_connections;

DROP POLICY IF EXISTS "mercury_sync_logs_select" ON mercury_sync_logs;
DROP POLICY IF EXISTS "mercury_sync_logs_insert" ON mercury_sync_logs;
DROP POLICY IF EXISTS "mercury_sync_logs_update" ON mercury_sync_logs;
DROP POLICY IF EXISTS "mercury_sync_logs_delete" ON mercury_sync_logs;

DROP POLICY IF EXISTS "merchant_mapping_cache_select" ON merchant_mapping_cache;
DROP POLICY IF EXISTS "merchant_mapping_cache_insert" ON merchant_mapping_cache;
DROP POLICY IF EXISTS "merchant_mapping_cache_update" ON merchant_mapping_cache;
DROP POLICY IF EXISTS "merchant_mapping_cache_delete" ON merchant_mapping_cache;

DROP POLICY IF EXISTS "account_balance_history_select" ON account_balance_history;
DROP POLICY IF EXISTS "account_balance_history_insert" ON account_balance_history;
DROP POLICY IF EXISTS "account_balance_history_update" ON account_balance_history;
DROP POLICY IF EXISTS "account_balance_history_delete" ON account_balance_history;

-- Subscription / Cost Sync
DROP POLICY IF EXISTS "subscription_transaction_records_select" ON subscription_transaction_records;
DROP POLICY IF EXISTS "subscription_transaction_records_insert" ON subscription_transaction_records;
DROP POLICY IF EXISTS "subscription_transaction_records_update" ON subscription_transaction_records;
DROP POLICY IF EXISTS "subscription_transaction_records_delete" ON subscription_transaction_records;

DROP POLICY IF EXISTS "client_cash_receipts_select" ON client_cash_receipts;
DROP POLICY IF EXISTS "client_cash_receipts_insert" ON client_cash_receipts;
DROP POLICY IF EXISTS "client_cash_receipts_update" ON client_cash_receipts;
DROP POLICY IF EXISTS "client_cash_receipts_delete" ON client_cash_receipts;

DROP POLICY IF EXISTS "auto_sync_run_logs_select" ON auto_sync_run_logs;
DROP POLICY IF EXISTS "auto_sync_run_logs_insert" ON auto_sync_run_logs;
DROP POLICY IF EXISTS "auto_sync_run_logs_update" ON auto_sync_run_logs;
DROP POLICY IF EXISTS "auto_sync_run_logs_delete" ON auto_sync_run_logs;

-- Staff Management
DROP POLICY IF EXISTS "staff_roles_select" ON staff_roles;
DROP POLICY IF EXISTS "staff_roles_insert" ON staff_roles;
DROP POLICY IF EXISTS "staff_roles_update" ON staff_roles;
DROP POLICY IF EXISTS "staff_roles_delete" ON staff_roles;

DROP POLICY IF EXISTS "staff_bonuses_select" ON staff_bonuses;
DROP POLICY IF EXISTS "staff_bonuses_insert" ON staff_bonuses;
DROP POLICY IF EXISTS "staff_bonuses_update" ON staff_bonuses;
DROP POLICY IF EXISTS "staff_bonuses_delete" ON staff_bonuses;

DROP POLICY IF EXISTS "staff_reimbursements_select" ON staff_reimbursements;
DROP POLICY IF EXISTS "staff_reimbursements_insert" ON staff_reimbursements;
DROP POLICY IF EXISTS "staff_reimbursements_update" ON staff_reimbursements;
DROP POLICY IF EXISTS "staff_reimbursements_delete" ON staff_reimbursements;

DROP POLICY IF EXISTS "monthly_allocation_overrides_select" ON monthly_allocation_overrides;
DROP POLICY IF EXISTS "monthly_allocation_overrides_insert" ON monthly_allocation_overrides;
DROP POLICY IF EXISTS "monthly_allocation_overrides_update" ON monthly_allocation_overrides;
DROP POLICY IF EXISTS "monthly_allocation_overrides_delete" ON monthly_allocation_overrides;

-- Agency Portal
DROP POLICY IF EXISTS "agency_invoices_select" ON agency_invoices;
DROP POLICY IF EXISTS "agency_invoices_insert" ON agency_invoices;
DROP POLICY IF EXISTS "agency_invoices_update" ON agency_invoices;
DROP POLICY IF EXISTS "agency_invoices_delete" ON agency_invoices;

DROP POLICY IF EXISTS "agency_invoice_line_items_select" ON agency_invoice_line_items;
DROP POLICY IF EXISTS "agency_invoice_line_items_insert" ON agency_invoice_line_items;
DROP POLICY IF EXISTS "agency_invoice_line_items_update" ON agency_invoice_line_items;
DROP POLICY IF EXISTS "agency_invoice_line_items_delete" ON agency_invoice_line_items;

DROP POLICY IF EXISTS "agency_invoice_comments_select" ON agency_invoice_comments;
DROP POLICY IF EXISTS "agency_invoice_comments_insert" ON agency_invoice_comments;
DROP POLICY IF EXISTS "agency_invoice_comments_update" ON agency_invoice_comments;
DROP POLICY IF EXISTS "agency_invoice_comments_delete" ON agency_invoice_comments;

-- Contractor Portal
DROP POLICY IF EXISTS "contractor_invoices_select" ON contractor_invoices;
DROP POLICY IF EXISTS "contractor_invoices_insert" ON contractor_invoices;
DROP POLICY IF EXISTS "contractor_invoices_update" ON contractor_invoices;
DROP POLICY IF EXISTS "contractor_invoices_delete" ON contractor_invoices;

DROP POLICY IF EXISTS "contractor_invoice_line_items_select" ON contractor_invoice_line_items;
DROP POLICY IF EXISTS "contractor_invoice_line_items_insert" ON contractor_invoice_line_items;
DROP POLICY IF EXISTS "contractor_invoice_line_items_update" ON contractor_invoice_line_items;
DROP POLICY IF EXISTS "contractor_invoice_line_items_delete" ON contractor_invoice_line_items;

DROP POLICY IF EXISTS "contractor_documents_select" ON contractor_documents;
DROP POLICY IF EXISTS "contractor_documents_insert" ON contractor_documents;
DROP POLICY IF EXISTS "contractor_documents_update" ON contractor_documents;
DROP POLICY IF EXISTS "contractor_documents_delete" ON contractor_documents;

DROP POLICY IF EXISTS "contractor_payments_select" ON contractor_payments;
DROP POLICY IF EXISTS "contractor_payments_insert" ON contractor_payments;
DROP POLICY IF EXISTS "contractor_payments_update" ON contractor_payments;
DROP POLICY IF EXISTS "contractor_payments_delete" ON contractor_payments;

-- System / Utility
DROP POLICY IF EXISTS "transaction_categorization_rules_select" ON transaction_categorization_rules;
DROP POLICY IF EXISTS "transaction_categorization_rules_insert" ON transaction_categorization_rules;
DROP POLICY IF EXISTS "transaction_categorization_rules_update" ON transaction_categorization_rules;
DROP POLICY IF EXISTS "transaction_categorization_rules_delete" ON transaction_categorization_rules;

DROP POLICY IF EXISTS "vendor_expense_categories_select" ON vendor_expense_categories;
DROP POLICY IF EXISTS "vendor_expense_categories_insert" ON vendor_expense_categories;
DROP POLICY IF EXISTS "vendor_expense_categories_update" ON vendor_expense_categories;
DROP POLICY IF EXISTS "vendor_expense_categories_delete" ON vendor_expense_categories;

DROP POLICY IF EXISTS "owner_monthly_pay_select" ON owner_monthly_pay;
DROP POLICY IF EXISTS "owner_monthly_pay_insert" ON owner_monthly_pay;
DROP POLICY IF EXISTS "owner_monthly_pay_update" ON owner_monthly_pay;
DROP POLICY IF EXISTS "owner_monthly_pay_delete" ON owner_monthly_pay;

DROP POLICY IF EXISTS "user_profiles_select" ON user_profiles;
DROP POLICY IF EXISTS "user_profiles_insert" ON user_profiles;
DROP POLICY IF EXISTS "user_profiles_update" ON user_profiles;

DROP POLICY IF EXISTS "audit_logs_select" ON audit_logs;

-- Junction / Child
DROP POLICY IF EXISTS "core_client_services_select" ON core_client_services;
DROP POLICY IF EXISTS "core_client_services_insert" ON core_client_services;
DROP POLICY IF EXISTS "core_client_services_update" ON core_client_services;
DROP POLICY IF EXISTS "core_client_services_delete" ON core_client_services;

-- Disable RLS on newly protected tables (does NOT affect tables with pre-existing RLS)
ALTER TABLE staff_roles DISABLE ROW LEVEL SECURITY;
ALTER TABLE staff_bonuses DISABLE ROW LEVEL SECURITY;
ALTER TABLE staff_reimbursements DISABLE ROW LEVEL SECURITY;
ALTER TABLE monthly_allocation_overrides DISABLE ROW LEVEL SECURITY;
ALTER TABLE agency_invoices DISABLE ROW LEVEL SECURITY;
ALTER TABLE agency_invoice_line_items DISABLE ROW LEVEL SECURITY;
ALTER TABLE agency_invoice_comments DISABLE ROW LEVEL SECURITY;
ALTER TABLE contractor_invoices DISABLE ROW LEVEL SECURITY;
ALTER TABLE contractor_invoice_line_items DISABLE ROW LEVEL SECURITY;
ALTER TABLE contractor_documents DISABLE ROW LEVEL SECURITY;
ALTER TABLE contractor_payments DISABLE ROW LEVEL SECURITY;
ALTER TABLE vendor_expense_categories DISABLE ROW LEVEL SECURITY;
ALTER TABLE owner_monthly_pay DISABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs DISABLE ROW LEVEL SECURITY;
ALTER TABLE core_client_services DISABLE ROW LEVEL SECURITY;
*/
