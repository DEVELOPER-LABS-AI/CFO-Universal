# API Contracts: RLS Policy Implementation

**Feature**: 8-rls-policies
**Date**: 2026-02-28

---

## Overview

This feature has NO new API endpoints. RLS policies are applied directly at the database layer and are transparent to existing API routes. This document defines the behavioral contracts that existing APIs must continue to satisfy after RLS is enabled.

---

## Behavioral Contracts

### Contract 1: Organization-Scoped Queries

**Affected**: All API routes that query tables with organization_id

**Before RLS**: Application code filters by organization_id in WHERE clause.
**After RLS**: Database enforces org filtering automatically. Application WHERE clause is redundant but harmless.

**Contract**:
- Queries with correct org_id: Return same results as before.
- Queries missing org_id filter: Return org-scoped results (RLS prevents cross-tenant leak).
- Queries with wrong org_id: Return empty results (RLS blocks access).

---

### Contract 2: Service Role Operations

**Affected**: Mercury sync, Xero sync, auto-association engine, cron jobs

**Contract**:
- Service role key bypasses ALL RLS policies automatically.
- No code changes needed in any sync or background job.
- Service role can read/write across all organizations.

**Verification**: Run full Mercury sync + Xero sync after RLS deployment. Compare row counts before/after.

---

### Contract 3: Agency Portal API Routes

**Affected**: `/api/agency-portal/*`, agency invoice endpoints

**Contract**:
- AGENCY_ADMIN users: API returns only their agency's data.
- ADMIN/ANALYST/EXECUTIVE users: API returns all agency data within org.
- Cross-agency access: Returns empty results (not an error).

---

### Contract 4: Contractor Portal API Routes

**Affected**: `/api/contractor-portal/*`, contractor invoice endpoints

**Contract**:
- CONTRACTOR users: API returns only their own invoices/documents/payments.
- ADMIN/ANALYST/EXECUTIVE users: API returns all contractor data within org.
- Cross-contractor access: Returns empty results (not an error).

---

### Contract 5: User Profile Access

**Affected**: `/api/user/profile`, profile settings endpoints

**Contract**:
- Users can only read/update their own profile.
- Users cannot delete their own profile (service role only).
- No user can access another user's profile directly.

---

### Contract 6: Audit Log Access

**Affected**: Audit log viewing (if exposed via API)

**Contract**:
- Users can only see audit entries where they are the actor.
- Organization-wide audit viewing requires service role.

---

## Error Behavior

### RLS Denial on SELECT
- Returns empty result set (0 rows).
- No error thrown. Application sees normal empty response.

### RLS Denial on INSERT/UPDATE/DELETE
- PostgreSQL raises: `new row violates row-level security policy`
- Application should handle this as a 403 Forbidden response.
- This should only occur if application code has a bug (missing org_id, wrong org_id).

---

## Migration Contract

### Idempotency
- Script uses `DROP POLICY IF EXISTS` before every `CREATE POLICY`.
- Script uses `CREATE OR REPLACE FUNCTION` for helper functions.
- Safe to run 1, 2, or N times with identical results.

### Rollback
- To disable RLS on a table: `ALTER TABLE {table} DISABLE ROW LEVEL SECURITY;`
- To remove all policies: `DROP POLICY IF EXISTS {policy_name} ON {table};`
- Rollback script will be generated alongside the migration.
