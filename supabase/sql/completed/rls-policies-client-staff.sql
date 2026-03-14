-- ============================================================================
-- RLS POLICIES: Feature 3 - Client Portfolio & Staff Management
-- ============================================================================
-- All policies enforce organization-scoped data isolation
-- Users can only access data for organizations they belong to

-- ============================================================================
-- STAFF TABLE
-- ============================================================================

-- Enable RLS
ALTER TABLE staff ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only view staff from their organizations
CREATE POLICY "staff_org_isolation_select" ON staff
  FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id
      FROM user_organizations
      WHERE user_id = auth.uid()::text
    )
  );

-- Policy: Users can insert staff into their organizations
CREATE POLICY "staff_org_isolation_insert" ON staff
  FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT organization_id
      FROM user_organizations
      WHERE user_id = auth.uid()::text
    )
  );

-- Policy: Users can update staff from their organizations
CREATE POLICY "staff_org_isolation_update" ON staff
  FOR UPDATE
  USING (
    organization_id IN (
      SELECT organization_id
      FROM user_organizations
      WHERE user_id = auth.uid()::text
    )
  );

-- Policy: Users can delete (soft delete) staff from their organizations
CREATE POLICY "staff_org_isolation_delete" ON staff
  FOR DELETE
  USING (
    organization_id IN (
      SELECT organization_id
      FROM user_organizations
      WHERE user_id = auth.uid()::text
    )
  );

-- ============================================================================
-- STAFF ASSIGNMENTS TABLE
-- ============================================================================

-- Enable RLS
ALTER TABLE staff_assignments ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only view assignments where staff belongs to their org
CREATE POLICY "staff_assignments_org_isolation_select" ON staff_assignments
  FOR SELECT
  USING (
    staff_id IN (
      SELECT id FROM staff
      WHERE organization_id IN (
        SELECT organization_id
        FROM user_organizations
        WHERE user_id = auth.uid()::text
      )
    )
  );

-- Policy: Users can insert assignments where staff belongs to their org
CREATE POLICY "staff_assignments_org_isolation_insert" ON staff_assignments
  FOR INSERT
  WITH CHECK (
    staff_id IN (
      SELECT id FROM staff
      WHERE organization_id IN (
        SELECT organization_id
        FROM user_organizations
        WHERE user_id = auth.uid()::text
      )
    )
  );

-- Policy: Users can update assignments where staff belongs to their org
CREATE POLICY "staff_assignments_org_isolation_update" ON staff_assignments
  FOR UPDATE
  USING (
    staff_id IN (
      SELECT id FROM staff
      WHERE organization_id IN (
        SELECT organization_id
        FROM user_organizations
        WHERE user_id = auth.uid()::text
      )
    )
  );

-- Policy: Users can delete assignments where staff belongs to their org
CREATE POLICY "staff_assignments_org_isolation_delete" ON staff_assignments
  FOR DELETE
  USING (
    staff_id IN (
      SELECT id FROM staff
      WHERE organization_id IN (
        SELECT organization_id
        FROM user_organizations
        WHERE user_id = auth.uid()::text
      )
    )
  );

-- ============================================================================
-- SUBSCRIPTIONS TABLE
-- ============================================================================

-- Enable RLS
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only view subscriptions from their organizations
CREATE POLICY "subscriptions_org_isolation_select" ON subscriptions
  FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id
      FROM user_organizations
      WHERE user_id = auth.uid()::text
    )
  );

-- Policy: Users can insert subscriptions into their organizations
CREATE POLICY "subscriptions_org_isolation_insert" ON subscriptions
  FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT organization_id
      FROM user_organizations
      WHERE user_id = auth.uid()::text
    )
  );

-- Policy: Users can update subscriptions from their organizations
CREATE POLICY "subscriptions_org_isolation_update" ON subscriptions
  FOR UPDATE
  USING (
    organization_id IN (
      SELECT organization_id
      FROM user_organizations
      WHERE user_id = auth.uid()::text
    )
  );

-- Policy: Users can delete subscriptions from their organizations
CREATE POLICY "subscriptions_org_isolation_delete" ON subscriptions
  FOR DELETE
  USING (
    organization_id IN (
      SELECT organization_id
      FROM user_organizations
      WHERE user_id = auth.uid()::text
    )
  );

-- ============================================================================
-- SUBSCRIPTION ALLOCATIONS TABLE
-- ============================================================================

-- Enable RLS
ALTER TABLE subscription_allocations ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view allocations where subscription belongs to their org
CREATE POLICY "subscription_allocations_org_isolation_select" ON subscription_allocations
  FOR SELECT
  USING (
    subscription_id IN (
      SELECT id FROM subscriptions
      WHERE organization_id IN (
        SELECT organization_id
        FROM user_organizations
        WHERE user_id = auth.uid()::text
      )
    )
  );

-- Policy: Users can insert allocations where subscription belongs to their org
CREATE POLICY "subscription_allocations_org_isolation_insert" ON subscription_allocations
  FOR INSERT
  WITH CHECK (
    subscription_id IN (
      SELECT id FROM subscriptions
      WHERE organization_id IN (
        SELECT organization_id
        FROM user_organizations
        WHERE user_id = auth.uid()::text
      )
    )
  );

-- Policy: Users can update allocations where subscription belongs to their org
CREATE POLICY "subscription_allocations_org_isolation_update" ON subscription_allocations
  FOR UPDATE
  USING (
    subscription_id IN (
      SELECT id FROM subscriptions
      WHERE organization_id IN (
        SELECT organization_id
        FROM user_organizations
        WHERE user_id = auth.uid()::text
      )
    )
  );

-- Policy: Users can delete allocations where subscription belongs to their org
CREATE POLICY "subscription_allocations_org_isolation_delete" ON subscription_allocations
  FOR DELETE
  USING (
    subscription_id IN (
      SELECT id FROM subscriptions
      WHERE organization_id IN (
        SELECT organization_id
        FROM user_organizations
        WHERE user_id = auth.uid()::text
      )
    )
  );

-- ============================================================================
-- AGENCIES TABLE
-- ============================================================================

-- Enable RLS
ALTER TABLE agencies ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only view agencies from their organizations
CREATE POLICY "agencies_org_isolation_select" ON agencies
  FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id
      FROM user_organizations
      WHERE user_id = auth.uid()::text
    )
  );

-- Policy: Users can insert agencies into their organizations
CREATE POLICY "agencies_org_isolation_insert" ON agencies
  FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT organization_id
      FROM user_organizations
      WHERE user_id = auth.uid()::text
    )
  );

-- Policy: Users can update agencies from their organizations
CREATE POLICY "agencies_org_isolation_update" ON agencies
  FOR UPDATE
  USING (
    organization_id IN (
      SELECT organization_id
      FROM user_organizations
      WHERE user_id = auth.uid()::text
    )
  );

-- Policy: Users can delete agencies from their organizations
CREATE POLICY "agencies_org_isolation_delete" ON agencies
  FOR DELETE
  USING (
    organization_id IN (
      SELECT organization_id
      FROM user_organizations
      WHERE user_id = auth.uid()::text
    )
  );

-- ============================================================================
-- AGENCY MONTHLY BREAKDOWNS TABLE
-- ============================================================================

-- Enable RLS
ALTER TABLE agency_monthly_breakdowns ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view breakdowns where agency belongs to their org
CREATE POLICY "agency_breakdowns_org_isolation_select" ON agency_monthly_breakdowns
  FOR SELECT
  USING (
    agency_id IN (
      SELECT id FROM agencies
      WHERE organization_id IN (
        SELECT organization_id
        FROM user_organizations
        WHERE user_id = auth.uid()::text
      )
    )
  );

-- Policy: Users can insert breakdowns where agency belongs to their org
CREATE POLICY "agency_breakdowns_org_isolation_insert" ON agency_monthly_breakdowns
  FOR INSERT
  WITH CHECK (
    agency_id IN (
      SELECT id FROM agencies
      WHERE organization_id IN (
        SELECT organization_id
        FROM user_organizations
        WHERE user_id = auth.uid()::text
      )
    )
  );

-- Policy: Users can update breakdowns where agency belongs to their org
CREATE POLICY "agency_breakdowns_org_isolation_update" ON agency_monthly_breakdowns
  FOR UPDATE
  USING (
    agency_id IN (
      SELECT id FROM agencies
      WHERE organization_id IN (
        SELECT organization_id
        FROM user_organizations
        WHERE user_id = auth.uid()::text
      )
    )
  );

-- Policy: Users can delete breakdowns where agency belongs to their org
CREATE POLICY "agency_breakdowns_org_isolation_delete" ON agency_monthly_breakdowns
  FOR DELETE
  USING (
    agency_id IN (
      SELECT id FROM agencies
      WHERE organization_id IN (
        SELECT organization_id
        FROM user_organizations
        WHERE user_id = auth.uid()::text
      )
    )
  );

-- ============================================================================
-- BDR PRODUCTIVITY METRICS TABLE
-- ============================================================================

-- Enable RLS
ALTER TABLE bdr_productivity_metrics ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view metrics where BDR belongs to their org
CREATE POLICY "bdr_productivity_org_isolation_select" ON bdr_productivity_metrics
  FOR SELECT
  USING (
    bdr_id IN (
      SELECT id FROM staff
      WHERE organization_id IN (
        SELECT organization_id
        FROM user_organizations
        WHERE user_id = auth.uid()::text
      )
    )
  );

-- Policy: Users can insert metrics where BDR belongs to their org
CREATE POLICY "bdr_productivity_org_isolation_insert" ON bdr_productivity_metrics
  FOR INSERT
  WITH CHECK (
    bdr_id IN (
      SELECT id FROM staff
      WHERE organization_id IN (
        SELECT organization_id
        FROM user_organizations
        WHERE user_id = auth.uid()::text
      )
    )
  );

-- Policy: Users can update metrics where BDR belongs to their org
CREATE POLICY "bdr_productivity_org_isolation_update" ON bdr_productivity_metrics
  FOR UPDATE
  USING (
    bdr_id IN (
      SELECT id FROM staff
      WHERE organization_id IN (
        SELECT organization_id
        FROM user_organizations
        WHERE user_id = auth.uid()::text
      )
    )
  );

-- Policy: Users can delete metrics where BDR belongs to their org
CREATE POLICY "bdr_productivity_org_isolation_delete" ON bdr_productivity_metrics
  FOR DELETE
  USING (
    bdr_id IN (
      SELECT id FROM staff
      WHERE organization_id IN (
        SELECT organization_id
        FROM user_organizations
        WHERE user_id = auth.uid()::text
      )
    )
  );

-- ============================================================================
-- CLIENT ROI TABLE
-- ============================================================================

-- Enable RLS
ALTER TABLE client_roi ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view ROI where client belongs to their org
CREATE POLICY "client_roi_org_isolation_select" ON client_roi
  FOR SELECT
  USING (
    client_id IN (
      SELECT id FROM core_clients
      WHERE organization_id IN (
        SELECT organization_id
        FROM user_organizations
        WHERE user_id = auth.uid()::text
      )
    )
  );

-- Policy: Users can insert ROI where client belongs to their org
CREATE POLICY "client_roi_org_isolation_insert" ON client_roi
  FOR INSERT
  WITH CHECK (
    client_id IN (
      SELECT id FROM core_clients
      WHERE organization_id IN (
        SELECT organization_id
        FROM user_organizations
        WHERE user_id = auth.uid()::text
      )
    )
  );

-- Policy: Users can update ROI where client belongs to their org
CREATE POLICY "client_roi_org_isolation_update" ON client_roi
  FOR UPDATE
  USING (
    client_id IN (
      SELECT id FROM core_clients
      WHERE organization_id IN (
        SELECT organization_id
        FROM user_organizations
        WHERE user_id = auth.uid()::text
      )
    )
  );

-- Policy: Users can delete ROI where client belongs to their org
CREATE POLICY "client_roi_org_isolation_delete" ON client_roi
  FOR DELETE
  USING (
    client_id IN (
      SELECT id FROM core_clients
      WHERE organization_id IN (
        SELECT organization_id
        FROM user_organizations
        WHERE user_id = auth.uid()::text
      )
    )
  );

-- ============================================================================
-- BDR ROI TABLE
-- ============================================================================

-- Enable RLS
ALTER TABLE bdr_roi ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view BDR ROI where BDR belongs to their org
CREATE POLICY "bdr_roi_org_isolation_select" ON bdr_roi
  FOR SELECT
  USING (
    bdr_id IN (
      SELECT id FROM staff
      WHERE organization_id IN (
        SELECT organization_id
        FROM user_organizations
        WHERE user_id = auth.uid()::text
      )
    )
  );

-- Policy: Users can insert BDR ROI where BDR belongs to their org
CREATE POLICY "bdr_roi_org_isolation_insert" ON bdr_roi
  FOR INSERT
  WITH CHECK (
    bdr_id IN (
      SELECT id FROM staff
      WHERE organization_id IN (
        SELECT organization_id
        FROM user_organizations
        WHERE user_id = auth.uid()::text
      )
    )
  );

-- Policy: Users can update BDR ROI where BDR belongs to their org
CREATE POLICY "bdr_roi_org_isolation_update" ON bdr_roi
  FOR UPDATE
  USING (
    bdr_id IN (
      SELECT id FROM staff
      WHERE organization_id IN (
        SELECT organization_id
        FROM user_organizations
        WHERE user_id = auth.uid()::text
      )
    )
  );

-- Policy: Users can delete BDR ROI where BDR belongs to their org
CREATE POLICY "bdr_roi_org_isolation_delete" ON bdr_roi
  FOR DELETE
  USING (
    bdr_id IN (
      SELECT id FROM staff
      WHERE organization_id IN (
        SELECT organization_id
        FROM user_organizations
        WHERE user_id = auth.uid()::text
      )
    )
  );

-- ============================================================================
-- VERIFICATION QUERIES (Run these to test RLS policies)
-- ============================================================================

-- Test as authenticated user:
-- SELECT COUNT(*) FROM staff;              -- Should only show user's org data
-- SELECT COUNT(*) FROM subscriptions;      -- Should only show user's org data
-- SELECT COUNT(*) FROM agencies;           -- Should only show user's org data

-- Verify no cross-org leakage:
-- INSERT INTO staff (organization_id, name, staff_type, rate, rate_type, engagement_type)
-- VALUES ('different-org-id', 'Test', 'BDR', 1000, 'MONTHLY', 'FULL_TIME');
-- -- Should fail with RLS violation
