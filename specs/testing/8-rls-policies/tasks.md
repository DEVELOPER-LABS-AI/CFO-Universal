# Tasks: Comprehensive RLS Policy Implementation

**Feature**: 8-rls-policies
**Branch**: `8-rls-policies`
**Spec**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md) | **Data Model**: [data-model.md](./data-model.md)
**Generated**: 2026-02-28

---

## User Story Map

| ID | Story | FR | Priority |
|---|---|---|---|
| US1 | Enable RLS and org isolation on Mercury integration tables | FR-1, FR-2 | P1 |
| US2 | Enable RLS and org isolation on subscription/cost sync tables | FR-1, FR-2 | P1 |
| US3 | Enable RLS and org isolation on staff management tables | FR-1, FR-2 | P1 |
| US4 | Enable RLS with portal scoping on agency portal tables | FR-1, FR-4 | P1 |
| US5 | Enable RLS with portal scoping on contractor portal tables | FR-1, FR-5 | P1 |
| US6 | Enable RLS on system/utility tables (incl. user_profiles, audit_logs) | FR-1, FR-2 | P2 |
| US7 | Enable RLS on junction/child tables | FR-1, FR-8 | P2 |

---

## Phase 1: Setup & Verification

> Verify database connection and audit current RLS state before any policy work.

- [x] T001 Verify Supabase DB connection: run `npx prisma migrate status` from repo root — must succeed before any RLS work
- [x] T002 Audit current RLS state: run `SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;` via Supabase SQL Editor — document which tables already have RLS enabled vs disabled
- [x] T003 Verify `get_user_organization_id()` helper function exists and returns correct values: run `SELECT public.get_user_organization_id();` as an authenticated user via Supabase
- [x] T004 Create migration file `supabase/sql/completed/008_comprehensive_rls_policies.sql` with file header comment block (feature name, date, description, idempotency note)

---

## Phase 2: Foundation — Helper Functions

> New helper functions required by portal scoping policies (US4, US5). Must complete before those phases.

- [x] T005 Add `get_user_agency_id()` function to `supabase/sql/completed/008_comprehensive_rls_policies.sql` — `CREATE OR REPLACE FUNCTION public.get_user_agency_id() RETURNS TEXT AS $$ SELECT agency_id FROM public.user_profiles WHERE user_id = auth.uid()::text LIMIT 1; $$ LANGUAGE sql SECURITY DEFINER STABLE;` with `GRANT EXECUTE ON FUNCTION public.get_user_agency_id() TO authenticated;`
- [x] T006 Add `get_user_contractor_id()` function to `supabase/sql/completed/008_comprehensive_rls_policies.sql` — `CREATE OR REPLACE FUNCTION public.get_user_contractor_id() RETURNS TEXT AS $$ SELECT contractor_id FROM public.user_profiles WHERE user_id = auth.uid()::text LIMIT 1; $$ LANGUAGE sql SECURITY DEFINER STABLE;` with `GRANT EXECUTE ON FUNCTION public.get_user_contractor_id() TO authenticated;`
- [x] T007 Add `get_user_role()` helper function to `supabase/sql/completed/008_comprehensive_rls_policies.sql` — `CREATE OR REPLACE FUNCTION public.get_user_role() RETURNS TEXT AS $$ SELECT role::text FROM public.user_organizations WHERE user_id = auth.uid()::text LIMIT 1; $$ LANGUAGE sql SECURITY DEFINER STABLE;` with `GRANT EXECUTE ON FUNCTION public.get_user_role() TO authenticated;` — used for portal dual-path policies to check if user has org-level role

---

## Phase 3: US1 — Mercury Integration RLS (4 tables)

> Complete, independently testable: All Mercury integration tables enforce org-level data isolation.

- [x] T008 [P] [US1] Add RLS policies for `mercury_connections` to `supabase/sql/completed/008_comprehensive_rls_policies.sql` — ENABLE ROW LEVEL SECURITY; DROP POLICY IF EXISTS + CREATE POLICY for SELECT/INSERT/UPDATE/DELETE using `organization_id = public.get_user_organization_id()` direct match, all TO authenticated
- [x] T009 [P] [US1] Add RLS policies for `mercury_sync_logs` to `supabase/sql/completed/008_comprehensive_rls_policies.sql` — ENABLE ROW LEVEL SECURITY; DROP POLICY IF EXISTS + CREATE POLICY for SELECT/INSERT/UPDATE/DELETE using `EXISTS (SELECT 1 FROM mercury_connections WHERE mercury_connections.id = mercury_sync_logs.connection_id AND mercury_connections.organization_id = public.get_user_organization_id())`, all TO authenticated
- [x] T010 [P] [US1] Add RLS policies for `merchant_mapping_cache` to `supabase/sql/completed/008_comprehensive_rls_policies.sql` — ENABLE ROW LEVEL SECURITY; same EXISTS pattern via connection_id → mercury_connections.organization_id
- [x] T011 [P] [US1] Add RLS policies for `account_balance_history` to `supabase/sql/completed/008_comprehensive_rls_policies.sql` — ENABLE ROW LEVEL SECURITY; same EXISTS pattern via connection_id → mercury_connections.organization_id

**Independent Test Criteria (US1)**:
- Authenticated user: `SELECT count(*) FROM mercury_connections` returns only their org's connection
- Authenticated user: `SELECT count(*) FROM merchant_mapping_cache` returns only mappings for their org's connection
- Service role: `SELECT count(*) FROM mercury_connections` returns all connections across orgs
- Cross-org user: `SELECT * FROM mercury_sync_logs` returns 0 rows for other org's sync logs

---

## Phase 4: US2 — Subscription/Cost Sync RLS (3 tables)

> Complete, independently testable: All dynamic cost sync tables enforce org-level data isolation.

- [x] T012 [P] [US2] Add RLS policies for `subscription_transaction_records` to `supabase/sql/completed/008_comprehensive_rls_policies.sql` — ENABLE ROW LEVEL SECURITY; SELECT/INSERT/UPDATE/DELETE using `organization_id = public.get_user_organization_id()` direct match
- [x] T013 [P] [US2] Add RLS policies for `client_cash_receipts` to `supabase/sql/completed/008_comprehensive_rls_policies.sql` — ENABLE ROW LEVEL SECURITY; same direct org_id match pattern
- [x] T014 [P] [US2] Add RLS policies for `auto_sync_run_logs` to `supabase/sql/completed/008_comprehensive_rls_policies.sql` — ENABLE ROW LEVEL SECURITY; same direct org_id match pattern

**Independent Test Criteria (US2)**:
- Authenticated user: `SELECT count(*) FROM subscription_transaction_records` returns only their org's records
- Authenticated user: `SELECT count(*) FROM client_cash_receipts` returns only their org's receipts
- Service role: Full access to all records across orgs (auto-association engine uses service role)

---

## Phase 5: US3 — Staff Management RLS (4 tables)

> Complete, independently testable: Staff management tables enforce org-level data isolation including child tables.

- [x] T015 [P] [US3] Add RLS policies for `staff_roles` to `supabase/sql/completed/008_comprehensive_rls_policies.sql` — ENABLE ROW LEVEL SECURITY; SELECT/INSERT/UPDATE/DELETE using `organization_id = public.get_user_organization_id()` direct match
- [x] T016 [P] [US3] Add RLS policies for `staff_bonuses` to `supabase/sql/completed/008_comprehensive_rls_policies.sql` — ENABLE ROW LEVEL SECURITY; SELECT/INSERT/UPDATE/DELETE using `EXISTS (SELECT 1 FROM staff WHERE staff.id = staff_bonuses.staff_id AND staff.organization_id = public.get_user_organization_id())`
- [x] T017 [P] [US3] Add RLS policies for `staff_reimbursements` to `supabase/sql/completed/008_comprehensive_rls_policies.sql` — ENABLE ROW LEVEL SECURITY; same EXISTS via staff_id → staff.organization_id pattern
- [x] T018 [US3] Add RLS policies for `monthly_allocation_overrides` to `supabase/sql/completed/008_comprehensive_rls_policies.sql` — ENABLE ROW LEVEL SECURITY; SELECT/INSERT/UPDATE/DELETE using `EXISTS (SELECT 1 FROM staff_assignments JOIN staff ON staff.id = staff_assignments.staff_id WHERE staff_assignments.id = monthly_allocation_overrides.assignment_id AND staff.organization_id = public.get_user_organization_id())`

**Independent Test Criteria (US3)**:
- Authenticated user: `SELECT count(*) FROM staff_roles` returns only their org's roles
- Authenticated user: `SELECT count(*) FROM staff_bonuses` returns only bonuses for their org's staff
- Cross-org user: `SELECT * FROM monthly_allocation_overrides` returns 0 rows for other org's overrides

---

## Phase 6: US4 — Agency Portal RLS (3 tables)

> Complete, independently testable: Agency tables enforce portal-level scoping — AGENCY_ADMIN sees only their agency; ADMIN/ANALYST/EXECUTIVE see all org agencies.

- [x] T019 [US4] Add RLS policies for `agency_invoices` to `supabase/sql/completed/008_comprehensive_rls_policies.sql` — ENABLE ROW LEVEL SECURITY; SELECT policy uses dual-path: `(agency_id = public.get_user_agency_id()) OR (EXISTS (SELECT 1 FROM agencies WHERE agencies.id = agency_invoices.agency_id AND agencies.organization_id = public.get_user_organization_id()) AND public.get_user_role() IN ('ADMIN', 'ANALYST', 'EXECUTIVE'))`; INSERT/UPDATE/DELETE use agency_id match OR org admin check
- [x] T020 [US4] Add RLS policies for `agency_invoice_line_items` to `supabase/sql/completed/008_comprehensive_rls_policies.sql` — ENABLE ROW LEVEL SECURITY; SELECT/INSERT/UPDATE/DELETE using `EXISTS (SELECT 1 FROM agency_invoices JOIN agencies ON agencies.id = agency_invoices.agency_id WHERE agency_invoices.id = agency_invoice_line_items.invoice_id AND ((agencies.id = public.get_user_agency_id()) OR (agencies.organization_id = public.get_user_organization_id() AND public.get_user_role() IN ('ADMIN', 'ANALYST', 'EXECUTIVE'))))`
- [x] T021 [US4] Add RLS policies for `agency_invoice_comments` to `supabase/sql/completed/008_comprehensive_rls_policies.sql` — ENABLE ROW LEVEL SECURITY; same dual-path pattern via invoice_id → agency_invoices → agencies

**Independent Test Criteria (US4)**:
- AGENCY_ADMIN user (agency A): `SELECT count(*) FROM agency_invoices` returns only agency A's invoices
- AGENCY_ADMIN user (agency A): `SELECT * FROM agency_invoices WHERE agency_id = '{agency_B_id}'` returns 0 rows
- ADMIN user: `SELECT count(*) FROM agency_invoices` returns ALL invoices in org
- ADMIN user: `SELECT count(*) FROM agency_invoice_line_items` returns ALL line items in org

---

## Phase 7: US5 — Contractor Portal RLS (4 tables)

> Complete, independently testable: Contractor tables enforce portal-level scoping — CONTRACTOR sees only their data; ADMIN/ANALYST/EXECUTIVE see all org contractors.

- [x] T022 [US5] Add RLS policies for `contractor_invoices` to `supabase/sql/completed/008_comprehensive_rls_policies.sql` — ENABLE ROW LEVEL SECURITY; SELECT policy uses dual-path: `(contractor_id = public.get_user_contractor_id()) OR (organization_id = public.get_user_organization_id() AND public.get_user_role() IN ('ADMIN', 'ANALYST', 'EXECUTIVE'))`; INSERT uses contractor_id match only; UPDATE/DELETE use same dual-path
- [x] T023 [US5] Add RLS policies for `contractor_invoice_line_items` to `supabase/sql/completed/008_comprehensive_rls_policies.sql` — ENABLE ROW LEVEL SECURITY; SELECT/INSERT/UPDATE/DELETE using `EXISTS (SELECT 1 FROM contractor_invoices WHERE contractor_invoices.id = contractor_invoice_line_items.invoice_id AND ((contractor_invoices.contractor_id = public.get_user_contractor_id()) OR (contractor_invoices.organization_id = public.get_user_organization_id() AND public.get_user_role() IN ('ADMIN', 'ANALYST', 'EXECUTIVE'))))`
- [x] T024 [US5] Add RLS policies for `contractor_documents` to `supabase/sql/completed/008_comprehensive_rls_policies.sql` — ENABLE ROW LEVEL SECURITY; dual-path: `(contractor_id = public.get_user_contractor_id()) OR (organization_id = public.get_user_organization_id() AND public.get_user_role() IN ('ADMIN', 'ANALYST', 'EXECUTIVE'))`
- [x] T025 [US5] Add RLS policies for `contractor_payments` to `supabase/sql/completed/008_comprehensive_rls_policies.sql` — ENABLE ROW LEVEL SECURITY; SELECT uses contractor dual-path; INSERT/UPDATE/DELETE restricted to org-level roles only (contractors cannot modify payment records)

**Independent Test Criteria (US5)**:
- CONTRACTOR user (contractor A): `SELECT count(*) FROM contractor_invoices` returns only contractor A's invoices
- CONTRACTOR user: Cannot see another contractor's documents
- CONTRACTOR user: Cannot INSERT/UPDATE/DELETE contractor_payments (only ADMIN can)
- ADMIN user: `SELECT count(*) FROM contractor_invoices` returns ALL invoices in org

---

## Phase 8: US6 — System/Utility RLS (5 tables)

> Complete, independently testable: System tables, user profiles, and audit logs all enforce appropriate access control.

- [x] T026 [P] [US6] Add RLS policies for `transaction_categorization_rules` to `supabase/sql/completed/008_comprehensive_rls_policies.sql` — ENABLE ROW LEVEL SECURITY; SELECT/INSERT/UPDATE/DELETE using `organization_id = public.get_user_organization_id()` direct match
- [x] T027 [P] [US6] Add RLS policies for `vendor_expense_categories` to `supabase/sql/completed/008_comprehensive_rls_policies.sql` — ENABLE ROW LEVEL SECURITY; same direct org_id match
- [x] T028 [P] [US6] Add RLS policies for `owner_monthly_pay` to `supabase/sql/completed/008_comprehensive_rls_policies.sql` — ENABLE ROW LEVEL SECURITY; same direct org_id match
- [x] T029 [US6] Add RLS policies for `user_profiles` to `supabase/sql/completed/008_comprehensive_rls_policies.sql` — ENABLE ROW LEVEL SECURITY; SELECT uses `user_id = auth.uid()::text`; INSERT/UPDATE uses same `user_id = auth.uid()::text` WITH CHECK; no DELETE policy (service role only can delete profiles)
- [x] T030 [US6] Add RLS policies for `audit_logs` to `supabase/sql/completed/008_comprehensive_rls_policies.sql` — ENABLE ROW LEVEL SECURITY; SELECT uses `actor_id = auth.uid()::text`; no INSERT/UPDATE/DELETE policies for authenticated role (service role only writes audit logs)

**Independent Test Criteria (US6)**:
- Authenticated user: `SELECT count(*) FROM transaction_categorization_rules` returns only their org's rules
- Authenticated user: `SELECT * FROM user_profiles` returns only their own profile
- Authenticated user: `SELECT * FROM audit_logs` returns only entries where they are the actor
- Authenticated user: `DELETE FROM user_profiles WHERE user_id = '{other_user}'` fails (no DELETE policy)

---

## Phase 9: US7 — Junction/Child Table RLS (1 table)

> Complete, independently testable: core_client_services table inherits org scoping from parent.

- [x] T031 [US7] Add RLS policies for `core_client_services` to `supabase/sql/completed/008_comprehensive_rls_policies.sql` — ENABLE ROW LEVEL SECURITY; SELECT/INSERT/UPDATE/DELETE using `EXISTS (SELECT 1 FROM core_clients WHERE core_clients.id = core_client_services.client_id AND core_clients.organization_id = public.get_user_organization_id())`

**Independent Test Criteria (US7)**:
- Authenticated user: `SELECT count(*) FROM core_client_services` returns only services for their org's clients
- Cross-org user: cannot see client_services for other org's clients

---

## Phase 10: Verification & Polish

> Apply migration, verify 100% coverage, test idempotency, generate rollback script.

- [x] T032 Add verification queries section to end of `supabase/sql/completed/008_comprehensive_rls_policies.sql` — `SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public' AND rowsecurity = false ORDER BY tablename;` (should return 0 rows)
- [x] T033 Add rollback script section to end of `supabase/sql/completed/008_comprehensive_rls_policies.sql` as commented-out SQL — DROP POLICY IF EXISTS for all ~90 policies; DROP FUNCTION IF EXISTS for get_user_agency_id, get_user_contractor_id, get_user_role; ALTER TABLE DISABLE ROW LEVEL SECURITY for all 24 tables
- [ ] T034 Apply the complete migration `supabase/sql/completed/008_comprehensive_rls_policies.sql` via Supabase SQL Editor — verify no errors
- [ ] T035 Run idempotency test: apply the migration a second time — verify no errors and identical state
- [ ] T036 Run full verification query: confirm 0 tables in public schema without RLS enabled
- [ ] T037 Test service role access: verify Mercury sync and Xero sync can still read/write all data using service role key
- [ ] T038 Test authenticated user access: verify org scoping works on every newly protected table
- [ ] T039 Test portal scoping: verify AGENCY_ADMIN sees only their agency data; CONTRACTOR sees only their data

---

## Dependency Graph

```
Phase 1 (Setup)
  └── Phase 2 (Helper Functions)
        ├── Phase 6 (US4: Agency Portal — uses get_user_agency_id + get_user_role)
        └── Phase 7 (US5: Contractor Portal — uses get_user_contractor_id + get_user_role)

Phase 1 (Setup)
  ├── Phase 3 (US1: Mercury — independent)
  ├── Phase 4 (US2: Subscription — independent)
  ├── Phase 5 (US3: Staff — independent)
  ├── Phase 8 (US6: System — independent)
  └── Phase 9 (US7: Junction — independent)

Phase 10 (Verification) depends on ALL Phases 1–9
```

**Stories that can start in parallel once Phase 1 is done**:
- US1 (Phase 3), US2 (Phase 4), US3 (Phase 5), US6 (Phase 8), US7 (Phase 9) — all independent, no shared state

**Stories that require Phase 2 first**:
- US4 (Phase 6) and US5 (Phase 7) — need helper functions

---

## Parallel Execution Examples

**After Phase 1 completes** — run simultaneously:
```
Agent A: Phase 2 (Foundation) — helper functions
Agent B: Phase 3 (US1) T008–T011 — Mercury tables
Agent C: Phase 4 (US2) T012–T014 — Subscription tables
Agent D: Phase 5 (US3) T015–T018 — Staff tables
```

**After Phase 2 completes** — run simultaneously:
```
Agent E: Phase 6 (US4) T019–T021 — Agency portal
Agent F: Phase 7 (US5) T022–T025 — Contractor portal
```

**Independent at any time after Phase 1**:
```
Agent G: Phase 8 (US6) T026–T030 — System/utility tables
Agent H: Phase 9 (US7) T031 — Junction table
```

**Within Phases** — all tasks marked [P] are parallelizable:
- Phase 3: T008, T009, T010, T011 — all 4 tables independent
- Phase 4: T012, T013, T014 — all 3 tables independent
- Phase 5: T015, T016, T017 — 3 of 4 parallelizable (T018 depends on schema understanding)
- Phase 8: T026, T027, T028 — 3 of 5 parallelizable (T029, T030 are special cases)

---

## Implementation Strategy (Single File, Incremental Sections)

**All tasks write to ONE file**: `supabase/sql/completed/008_comprehensive_rls_policies.sql`

Each phase appends a clearly labeled section to the file:

```sql
-- ============================================================
-- Section N: [Domain Group Name]
-- Tables: table1, table2, ...
-- Pattern: [direct org / EXISTS / portal scoping]
-- ============================================================
```

**MVP (Phases 1–5)**: Core org isolation on Mercury, subscription, and staff tables (15 tables, ~60 policies)

**Increment 2 (Phases 6–7)**: Portal scoping for agency and contractor tables (7 tables, ~28 policies)

**Increment 3 (Phases 8–9)**: System tables, user profiles, audit logs, junction table (6 tables, ~18 policies)

**Final (Phase 10)**: Verification, idempotency test, rollback script

---

## Summary

| Metric | Count |
|---|---|
| Total tasks | 39 |
| Phase 1 (Setup) | 4 |
| Phase 2 (Foundation) | 3 |
| Phase 3 (US1: Mercury) | 4 |
| Phase 4 (US2: Subscription) | 3 |
| Phase 5 (US3: Staff) | 4 |
| Phase 6 (US4: Agency Portal) | 3 |
| Phase 7 (US5: Contractor Portal) | 4 |
| Phase 8 (US6: System) | 5 |
| Phase 9 (US7: Junction) | 1 |
| Phase 10 (Verification) | 8 |
| Parallelizable tasks [P] | 15 |
| User story phases | 7 |
| New helper functions | 3 |
| Tables receiving new policies | 24 |
| Estimated total policies | ~90 |
