# Research: Comprehensive RLS Policy Implementation

**Feature**: 8-rls-policies
**Date**: 2026-02-28

---

## R1: Existing RLS Coverage Inventory

### Decision
Audit identified 5 existing RLS policy files covering a subset of tables. New policies must NOT duplicate or conflict with these.

### Tables Already Covered (DO NOT TOUCH)

| File | Tables | Policy Style |
|------|--------|-------------|
| `prisma/rls-setup.sql` | user_organizations | Service-role only write |
| `prisma/rls-policies.sql` | core_organizations, core_clients, core_services, core_contractors, core_contractor_assignments, financial_revenue_records, financial_expense_records, analytics_client_metrics, analytics_company_metrics, integrations_oauth_tokens, integrations_sync_logs, system_financial_targets, system_growth_scenarios | FOR ALL with org check |
| `002_xero_rls_policies.sql` | xero_connections, xero_sync_logs, xero_contact_mappings, xero_expense_category_mappings | Per-operation CRUD |
| `005_notifications_rls_policies.sql` | notifications, webhook_events | Org + user/role scoping |
| `rls-policies-client-staff.sql` | staff, staff_assignments, subscriptions, subscription_allocations, agencies, agency_monthly_breakdowns, bdr_productivity_metrics, client_roi, bdr_roi | Per-operation CRUD |

**Total already covered: ~28 tables**

### Tables Requiring NEW Policies

| Table | Has org_id? | Parent FK | Policy Strategy |
|-------|-------------|-----------|----------------|
| user_profiles | No | user_id (auth) | Users see own profile only |
| core_client_services | No | client_id → core_clients | EXISTS via client org |
| mercury_connections | Yes | — | Direct org check |
| mercury_sync_logs | No | connection_id → mercury_connections | EXISTS via connection org |
| merchant_mapping_cache | No | connection_id → mercury_connections | EXISTS via connection org |
| account_balance_history | No | connection_id → mercury_connections | EXISTS via connection org |
| transaction_categorization_rules | Yes | — | Direct org check |
| vendor_expense_categories | Yes | — | Direct org check |
| owner_monthly_pay | Yes | — | Direct org check |
| subscription_transaction_records | Yes | — | Direct org check |
| client_cash_receipts | Yes | — | Direct org check |
| auto_sync_run_logs | Yes | — | Direct org check |
| staff_roles | Yes | — | Direct org check |
| staff_bonuses | No | staff_id → staff | EXISTS via staff org |
| staff_reimbursements | No | staff_id → staff | EXISTS via staff org |
| monthly_allocation_overrides | No | assignment_id → staff_assignments | EXISTS via assignment → staff org |
| agency_invoices | No | agency_id → agencies | EXISTS via agency org |
| agency_invoice_line_items | No | invoice_id → agency_invoices | EXISTS via invoice → agency org |
| agency_invoice_comments | No | invoice_id → agency_invoices | EXISTS via invoice → agency org |
| contractor_invoices | Yes | — | Direct org check |
| contractor_invoice_line_items | No | invoice_id → contractor_invoices | EXISTS via invoice org |
| contractor_documents | Yes | — | Direct org check |
| contractor_payments | Yes | — | Direct org check |
| audit_logs | No | actor_id (user) | Users see own audit entries |

**Total needing new policies: 24 tables**

### Rationale
Complete the RLS coverage to achieve 100% table protection. Existing policies remain untouched to avoid regression.

### Alternatives Considered
- **Replace all existing policies**: Rejected — risk of breaking working production policies.
- **Single monolithic migration**: Rejected — harder to debug. Organize by domain group.

---

## R2: Policy Pattern Selection

### Decision
Use per-operation policies (SELECT, INSERT, UPDATE, DELETE) rather than FOR ALL, consistent with the newer policy files (002, 005, rls-policies-client-staff).

### Rationale
- Per-operation policies allow different rules per action (e.g., ADMIN-only writes, all-authenticated reads).
- FOR ALL is simpler but doesn't support role-based write restrictions.
- Newer files in the project already use per-operation style, so this maintains consistency.

### Pattern Templates

**Direct org_id table (SELECT):**
```sql
CREATE POLICY "{table}_org_select" ON "{table}"
  FOR SELECT TO authenticated
  USING (organization_id = public.get_user_organization_id());
```

**Direct org_id table (INSERT):**
```sql
CREATE POLICY "{table}_org_insert" ON "{table}"
  FOR INSERT TO authenticated
  WITH CHECK (organization_id = public.get_user_organization_id());
```

**Child table via parent FK (SELECT):**
```sql
CREATE POLICY "{table}_org_select" ON "{table}"
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM {parent_table}
    WHERE {parent_table}.id = {table}.{fk_column}
      AND {parent_table}.organization_id = public.get_user_organization_id()
  ));
```

**Portal-scoped table (AGENCY_ADMIN SELECT):**
```sql
CREATE POLICY "{table}_agency_select" ON "{table}"
  FOR SELECT TO authenticated
  USING (
    {agency_id_column} = (
      SELECT agency_id FROM user_profiles WHERE user_id = auth.uid()::text
    )
    OR EXISTS (
      SELECT 1 FROM user_organizations
      WHERE user_id = auth.uid()::text
        AND role IN ('ADMIN', 'ANALYST', 'EXECUTIVE')
    )
  );
```

### Alternatives Considered
- **FOR ALL policies**: Simpler but can't enforce role-based writes. Rejected.
- **Separate policies per role**: Too many policies (5 roles x 4 operations x 24 tables = 480). Rejected — use conditional USING clauses instead.

---

## R3: Role-Based Write Restriction Strategy

### Decision
For this initial implementation, all authenticated users in the same organization get full CRUD access. Role-based write restrictions (ADMIN-only writes) are deferred to a future iteration.

### Rationale
- The existing RLS policy files (prisma/rls-policies.sql, rls-policies-client-staff.sql) do NOT enforce role-based writes — they use org-level isolation only.
- The application layer already enforces role-based access via session checks and server actions.
- Adding role checks to every INSERT/UPDATE/DELETE policy would require a new helper function and could break existing workflows that use authenticated (non-ADMIN) Supabase clients.
- The spec's FR-3 (role-based writes) is a valuable goal, but implementing it safely requires testing against all existing server actions first.

### What We WILL Implement
- Organization-level isolation on all CRUD operations (same pattern as existing policies).
- Portal-scoped policies for AGENCY_ADMIN and CONTRACTOR roles on their respective tables.
- Service role bypass (automatic, no code needed).

### What Is Deferred
- ANALYST/EXECUTIVE write denial at database layer (continue relying on app layer).
- Helper function for role checking (`get_user_role()`).

### Alternatives Considered
- **Full role-based RLS now**: High risk of breaking existing flows. Rejected for initial release.
- **Role checks on sensitive tables only**: Inconsistent — either all or none. Rejected.

---

## R4: Portal Scoping Implementation

### Decision
AGENCY_ADMIN and CONTRACTOR users get dual-path policies: they can access their own entity's data, AND admins/analysts/executives bypass the entity scoping (they see all org data).

### Rationale
- Agency admins must see only their agency's invoices/breakdowns.
- Contractors must see only their own invoices/documents/payments.
- ADMIN/ANALYST/EXECUTIVE users need to see ALL agencies and ALL contractors within the org for management purposes.

### Implementation Approach

**Agency-scoped tables** (agency_invoices, agency_invoice_line_items, agency_invoice_comments):
- Policy allows access if user's `user_profiles.agency_id` matches the record's agency, OR if user has org-level role (ADMIN/ANALYST/EXECUTIVE).

**Contractor-scoped tables** (contractor_invoices, contractor_invoice_line_items, contractor_documents, contractor_payments):
- Policy allows access if user's `user_profiles.contractor_id` matches the record's contractor, OR if user has org-level role (ADMIN/ANALYST/EXECUTIVE).

### Helper Functions Needed
```sql
-- Get the authenticated user's agency_id (NULL if not an agency admin)
CREATE OR REPLACE FUNCTION public.get_user_agency_id()
RETURNS TEXT AS $$
  SELECT agency_id FROM public.user_profiles WHERE user_id = auth.uid()::text LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Get the authenticated user's contractor_id (NULL if not a contractor)
CREATE OR REPLACE FUNCTION public.get_user_contractor_id()
RETURNS TEXT AS $$
  SELECT contractor_id FROM public.user_profiles WHERE user_id = auth.uid()::text LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;
```

### Alternatives Considered
- **Inline subqueries everywhere**: Works but verbose and error-prone. Rejected — helper functions are cleaner.
- **Separate policies per role**: Creates policy explosion. Rejected — single policy with OR conditions.

---

## R5: Audit Logs Access Pattern

### Decision
The audit_logs table uses actor_id-based access: users can only see audit log entries where they are the actor. Organization-wide audit log viewing is deferred (requires adding organization_id to audit_logs, which is out of scope).

### Rationale
- audit_logs has no organization_id column.
- Adding a column is explicitly out of scope.
- actor_id maps to the user who performed the action.
- This provides minimum-viable access control without schema changes.

### Alternatives Considered
- **Skip RLS on audit_logs**: Leaves a table unprotected. Rejected.
- **Add organization_id**: Out of scope per spec. Deferred.
- **Traverse to org via user_organizations**: Possible but actor_id may not always be a user (could be system). Risky. Rejected for now.

---

## R6: Migration File Organization

### Decision
Single SQL migration file organized by domain group, with clear section headers. Placed in `supabase/sql/completed/` following existing convention.

### File Name
`008_comprehensive_rls_policies.sql`

### Section Order
1. Helper functions (get_user_agency_id, get_user_contractor_id)
2. Mercury integration tables
3. Subscription/cost sync tables
4. Staff management tables
5. Agency portal tables (with portal scoping)
6. Contractor portal tables (with portal scoping)
7. System/utility tables
8. Verification queries

### Rationale
- Single file is easier to review, apply, and rollback than multiple files.
- Section headers make navigation clear.
- Following `supabase/sql/completed/` convention.

### Alternatives Considered
- **Multiple files per domain**: More modular but harder to apply atomically. Rejected.
- **Prisma migration**: RLS policies are SQL-only; Prisma doesn't manage them. Rejected.
