-- ============================================================================
-- 011_cap_table_rls_policies.sql
-- Feature: 11-cap-table
-- Date: 2026-03-03
-- Description: RLS policies for cap table tables (cap_table_stakeholders,
--   cap_table_share_classes, cap_table_equity_holdings,
--   cap_table_equity_transactions).
--   Scoped by organization_id matching the authenticated user's org.
--
-- Idempotency: Safe to run multiple times. Uses DROP POLICY IF EXISTS before
--   every CREATE POLICY.
--
-- Service Role: Supabase service role automatically bypasses all RLS policies.
-- ============================================================================

-- ============================================================================
-- Table: cap_table_stakeholders
-- Direct organization_id column for scoping
-- ============================================================================

ALTER TABLE public.cap_table_stakeholders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cap_table_stakeholders_select_org" ON public.cap_table_stakeholders;
CREATE POLICY "cap_table_stakeholders_select_org" ON public.cap_table_stakeholders
  FOR SELECT TO authenticated
  USING (organization_id = public.get_user_organization_id());

DROP POLICY IF EXISTS "cap_table_stakeholders_insert_org" ON public.cap_table_stakeholders;
CREATE POLICY "cap_table_stakeholders_insert_org" ON public.cap_table_stakeholders
  FOR INSERT TO authenticated
  WITH CHECK (organization_id = public.get_user_organization_id());

DROP POLICY IF EXISTS "cap_table_stakeholders_update_org" ON public.cap_table_stakeholders;
CREATE POLICY "cap_table_stakeholders_update_org" ON public.cap_table_stakeholders
  FOR UPDATE TO authenticated
  USING (organization_id = public.get_user_organization_id())
  WITH CHECK (organization_id = public.get_user_organization_id());

DROP POLICY IF EXISTS "cap_table_stakeholders_delete_org" ON public.cap_table_stakeholders;
CREATE POLICY "cap_table_stakeholders_delete_org" ON public.cap_table_stakeholders
  FOR DELETE TO authenticated
  USING (organization_id = public.get_user_organization_id());

-- ============================================================================
-- Table: cap_table_share_classes
-- Direct organization_id column for scoping
-- ============================================================================

ALTER TABLE public.cap_table_share_classes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cap_table_share_classes_select_org" ON public.cap_table_share_classes;
CREATE POLICY "cap_table_share_classes_select_org" ON public.cap_table_share_classes
  FOR SELECT TO authenticated
  USING (organization_id = public.get_user_organization_id());

DROP POLICY IF EXISTS "cap_table_share_classes_insert_org" ON public.cap_table_share_classes;
CREATE POLICY "cap_table_share_classes_insert_org" ON public.cap_table_share_classes
  FOR INSERT TO authenticated
  WITH CHECK (organization_id = public.get_user_organization_id());

DROP POLICY IF EXISTS "cap_table_share_classes_update_org" ON public.cap_table_share_classes;
CREATE POLICY "cap_table_share_classes_update_org" ON public.cap_table_share_classes
  FOR UPDATE TO authenticated
  USING (organization_id = public.get_user_organization_id())
  WITH CHECK (organization_id = public.get_user_organization_id());

DROP POLICY IF EXISTS "cap_table_share_classes_delete_org" ON public.cap_table_share_classes;
CREATE POLICY "cap_table_share_classes_delete_org" ON public.cap_table_share_classes
  FOR DELETE TO authenticated
  USING (organization_id = public.get_user_organization_id());

-- ============================================================================
-- Table: cap_table_equity_holdings
-- Scoped via subquery on stakeholder's organization_id
-- ============================================================================

ALTER TABLE public.cap_table_equity_holdings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cap_table_equity_holdings_select_org" ON public.cap_table_equity_holdings;
CREATE POLICY "cap_table_equity_holdings_select_org" ON public.cap_table_equity_holdings
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.cap_table_stakeholders s
      WHERE s.id = cap_table_equity_holdings.stakeholder_id
        AND s.organization_id = public.get_user_organization_id()
    )
  );

DROP POLICY IF EXISTS "cap_table_equity_holdings_insert_org" ON public.cap_table_equity_holdings;
CREATE POLICY "cap_table_equity_holdings_insert_org" ON public.cap_table_equity_holdings
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.cap_table_stakeholders s
      WHERE s.id = cap_table_equity_holdings.stakeholder_id
        AND s.organization_id = public.get_user_organization_id()
    )
  );

DROP POLICY IF EXISTS "cap_table_equity_holdings_update_org" ON public.cap_table_equity_holdings;
CREATE POLICY "cap_table_equity_holdings_update_org" ON public.cap_table_equity_holdings
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.cap_table_stakeholders s
      WHERE s.id = cap_table_equity_holdings.stakeholder_id
        AND s.organization_id = public.get_user_organization_id()
    )
  );

DROP POLICY IF EXISTS "cap_table_equity_holdings_delete_org" ON public.cap_table_equity_holdings;
CREATE POLICY "cap_table_equity_holdings_delete_org" ON public.cap_table_equity_holdings
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.cap_table_stakeholders s
      WHERE s.id = cap_table_equity_holdings.stakeholder_id
        AND s.organization_id = public.get_user_organization_id()
    )
  );

-- ============================================================================
-- Table: cap_table_equity_transactions
-- Direct organization_id column for scoping
-- ============================================================================

ALTER TABLE public.cap_table_equity_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cap_table_equity_transactions_select_org" ON public.cap_table_equity_transactions;
CREATE POLICY "cap_table_equity_transactions_select_org" ON public.cap_table_equity_transactions
  FOR SELECT TO authenticated
  USING (organization_id = public.get_user_organization_id());

DROP POLICY IF EXISTS "cap_table_equity_transactions_insert_org" ON public.cap_table_equity_transactions;
CREATE POLICY "cap_table_equity_transactions_insert_org" ON public.cap_table_equity_transactions
  FOR INSERT TO authenticated
  WITH CHECK (organization_id = public.get_user_organization_id());

DROP POLICY IF EXISTS "cap_table_equity_transactions_update_org" ON public.cap_table_equity_transactions;
CREATE POLICY "cap_table_equity_transactions_update_org" ON public.cap_table_equity_transactions
  FOR UPDATE TO authenticated
  USING (organization_id = public.get_user_organization_id())
  WITH CHECK (organization_id = public.get_user_organization_id());

DROP POLICY IF EXISTS "cap_table_equity_transactions_delete_org" ON public.cap_table_equity_transactions;
CREATE POLICY "cap_table_equity_transactions_delete_org" ON public.cap_table_equity_transactions
  FOR DELETE TO authenticated
  USING (organization_id = public.get_user_organization_id());
