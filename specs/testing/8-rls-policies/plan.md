# Implementation Plan: Comprehensive RLS Policy Implementation

**Feature**: 8-rls-policies
**Branch**: `8-rls-policies`
**Spec**: [spec.md](./spec.md)
**Date**: 2026-02-28

---

## Technical Context

### Stack
- **Database**: Supabase (PostgreSQL 15+) with native RLS
- **Auth**: Supabase Auth (`auth.uid()`) with JWT tokens
- **ORM**: Prisma (no changes — RLS is database-layer only)
- **Application**: Next.js 16 with App Router (no code changes)

### Key Dependencies
- `get_user_organization_id()` helper function (already deployed)
- `user_organizations` table (user → org → role mapping)
- `user_profiles` table (agency_id, contractor_id for portal scoping)
- Existing RLS policies on ~28 tables (must not conflict)

### Constraints
- No schema changes (no new columns or tables via Prisma)
- No application code changes (RLS is transparent)
- Must be idempotent (safe to run multiple times)
- Service role must bypass all policies (automatic in Supabase)

---

## Constitution Check

### Principle 1: Technology Stack
- **Status**: COMPLIANT
- Using Supabase PostgreSQL, Prisma ORM (unchanged), Next.js (unchanged)

### Principle 2: Data Architecture
- **Status**: COMPLIANT — this feature IMPLEMENTS the constitution's mandate:
  > "Row Level Security (RLS) policies enforce data isolation"
  > "No cross-organization queries permitted at database level"

### Principle 4: Security Requirements
- **Status**: COMPLIANT
  > "Row Level Security (RLS) enforces organization boundaries"
  > "Service role keys NEVER exposed to client"

### Principle 8: Prisma-Supabase Alignment
- **Status**: COMPLIANT
  - No Prisma migrations needed (SQL-only RLS policies)
  - RLS policies applied via Supabase SQL, not Prisma
  - Constitution checklist item: "Verify RLS policies are not affected by schema changes" — this feature creates them

### Gate Evaluation
- All gates PASS. No violations or exceptions needed.

---

## Phase 0: Research Summary

See [research.md](./research.md) for full details.

### Key Decisions
1. **24 tables** need new RLS policies (28 already covered)
2. **Per-operation policies** (SELECT/INSERT/UPDATE/DELETE) — consistent with newer existing policies
3. **Organization-level CRUD** for all tables (no role-based write restrictions in this iteration)
4. **Portal scoping** for AGENCY_ADMIN and CONTRACTOR via new helper functions
5. **Single migration file** organized by domain group
6. **Audit logs** scoped by actor_id (no org_id available)

---

## Phase 1: Design Summary

See [data-model.md](./data-model.md) for complete policy-to-table mapping.

### New Database Objects
- `get_user_agency_id()` — helper function for agency portal scoping
- `get_user_contractor_id()` — helper function for contractor portal scoping
- ~90 RLS policies across 24 tables

### Policy Groups
1. **Mercury Integration** (4 tables): mercury_connections, mercury_sync_logs, merchant_mapping_cache, account_balance_history
2. **Subscription/Cost Sync** (3 tables): subscription_transaction_records, client_cash_receipts, auto_sync_run_logs
3. **Staff Management** (4 tables): staff_roles, staff_bonuses, staff_reimbursements, monthly_allocation_overrides
4. **Agency Portal** (3 tables): agency_invoices, agency_invoice_line_items, agency_invoice_comments
5. **Contractor Portal** (4 tables): contractor_invoices, contractor_invoice_line_items, contractor_documents, contractor_payments
6. **System/Utility** (5 tables): transaction_categorization_rules, vendor_expense_categories, owner_monthly_pay, user_profiles, audit_logs
7. **Junction/Child** (1 table): core_client_services

---

## Phase 2: Implementation Plan

### Task Breakdown

#### Task 1: Create Helper Functions
- Create `get_user_agency_id()` function
- Create `get_user_contractor_id()` function
- Grant EXECUTE to authenticated role
- Test both functions return correct values

#### Task 2: Mercury Integration RLS (4 tables)
- Enable RLS on mercury_connections, mercury_sync_logs, merchant_mapping_cache, account_balance_history
- Add SELECT/INSERT/UPDATE/DELETE policies
- mercury_connections: direct org_id match
- Other 3: EXISTS via connection_id → mercury_connections.organization_id

#### Task 3: Subscription/Cost Sync RLS (3 tables)
- Enable RLS on subscription_transaction_records, client_cash_receipts, auto_sync_run_logs
- Add SELECT/INSERT/UPDATE/DELETE policies with direct org_id match

#### Task 4: Staff Management RLS (4 tables)
- Enable RLS on staff_roles, staff_bonuses, staff_reimbursements, monthly_allocation_overrides
- staff_roles: direct org_id match
- staff_bonuses/reimbursements: EXISTS via staff_id → staff.organization_id
- monthly_allocation_overrides: EXISTS via assignment_id → staff_assignments → staff.organization_id

#### Task 5: Agency Portal RLS (3 tables)
- Enable RLS on agency_invoices, agency_invoice_line_items, agency_invoice_comments
- Dual-path policies: agency_id match (for AGENCY_ADMIN) OR org-level role check
- agency_invoices: agency_id via direct FK
- line_items/comments: EXISTS via invoice_id → agency_invoices → agencies

#### Task 6: Contractor Portal RLS (4 tables)
- Enable RLS on contractor_invoices, contractor_invoice_line_items, contractor_documents, contractor_payments
- Dual-path policies: contractor_id match (for CONTRACTOR) OR org-level role check
- contractor_invoices/documents/payments: direct contractor_id or org_id
- line_items: EXISTS via invoice_id → contractor_invoices

#### Task 7: System/Utility RLS (5 tables)
- Enable RLS on transaction_categorization_rules, vendor_expense_categories, owner_monthly_pay
  - Direct org_id match for all
- Enable RLS on user_profiles
  - Users can only access their own profile (user_id = auth.uid())
- Enable RLS on audit_logs
  - Users can only see entries where actor_id = auth.uid()
  - INSERT/UPDATE/DELETE restricted to service role

#### Task 8: Junction/Child Table RLS (1 table)
- Enable RLS on core_client_services
- EXISTS via client_id → core_clients.organization_id

#### Task 9: Verification & Testing
- Query every table as authenticated user — confirm org scoping works
- Query every table as service role — confirm full access
- Run idempotency test (apply migration 3 times)
- Verify no table in public schema lacks RLS:
  ```sql
  SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND rowsecurity = false;
  ```

#### Task 10: Rollback Script
- Generate rollback SQL that:
  - Drops all newly created policies
  - Drops new helper functions
  - Disables RLS on newly protected tables
  - Does NOT touch existing policies

---

## Dependency Graph

```
Task 1 (Helper Functions)
  ├── Task 5 (Agency Portal — uses get_user_agency_id)
  └── Task 6 (Contractor Portal — uses get_user_contractor_id)

Tasks 2, 3, 4, 7, 8 are independent of each other and Task 1.

Task 9 (Verification) depends on ALL Tasks 1-8.
Task 10 (Rollback) depends on ALL Tasks 1-8.
```

### Parallelizable Tasks
- Tasks 2, 3, 4, 7, 8 can all run in parallel (no interdependencies)
- Tasks 5, 6 depend only on Task 1 (helper functions)
- Tasks 9, 10 run after everything else

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| RLS breaks existing queries | Low | High | Service role used for sync; app queries already filter by org_id |
| Portal scoping too restrictive | Medium | Medium | Dual-path policies allow org-level users full access |
| Performance degradation from RLS | Low | Low | PostgreSQL RLS uses index scans; org_id already indexed |
| Migration conflicts with existing policies | Low | High | Research phase confirmed no overlapping tables |
| Idempotency failure | Low | Medium | DROP POLICY IF EXISTS before every CREATE POLICY |

---

## Artifacts Generated

| Artifact | Path | Status |
|----------|------|--------|
| Spec | [spec.md](./spec.md) | Complete |
| Research | [research.md](./research.md) | Complete |
| Data Model | [data-model.md](./data-model.md) | Complete |
| API Contracts | [contracts/api-contracts.md](./contracts/api-contracts.md) | Complete |
| Quickstart | [quickstart.md](./quickstart.md) | Complete |
| Plan | [plan.md](./plan.md) | Complete |
| Tasks | tasks.md | Pending — run `/speckit.tasks` |

---

## Next Step

Run `/speckit.tasks` to generate the detailed task breakdown with SQL for each policy group.
