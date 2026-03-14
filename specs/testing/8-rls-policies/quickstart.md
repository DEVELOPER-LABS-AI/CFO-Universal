# Quickstart: RLS Policy Implementation

**Feature**: 8-rls-policies
**Date**: 2026-02-28

---

## Prerequisites

1. Supabase project with PostgreSQL 15+
2. Existing `get_user_organization_id()` helper function deployed
3. `user_organizations` table populated with user-org-role mappings
4. `user_profiles` table with `agency_id` and `contractor_id` columns
5. Access to Supabase SQL Editor or psql connection

---

## Quick Apply

### Step 1: Verify existing RLS state
```sql
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;
```

### Step 2: Apply the migration
Run `supabase/sql/completed/008_comprehensive_rls_policies.sql` via:
- Supabase Dashboard → SQL Editor → paste and run
- OR: `psql -f supabase/sql/completed/008_comprehensive_rls_policies.sql`

### Step 3: Verify all tables have RLS enabled
```sql
SELECT tablename
FROM pg_tables
WHERE schemaname = 'public' AND rowsecurity = false;
-- Should return 0 rows
```

### Step 4: Test org isolation
```sql
-- As an authenticated user, verify org scoping works:
SELECT count(*) FROM core_clients; -- Should only see own org's clients
SELECT count(*) FROM subscriptions; -- Should only see own org's subscriptions
SELECT count(*) FROM mercury_connections; -- Should only see own org's connection
```

### Step 5: Test service role bypass
```sql
-- Using service role key, verify full access:
SELECT count(*) FROM core_clients; -- Should see ALL clients across orgs
```

---

## Rollback

To disable all new RLS policies:
```sql
-- Run the rollback section at the bottom of the migration file
-- Or manually disable RLS on specific tables:
ALTER TABLE {table_name} DISABLE ROW LEVEL SECURITY;
```

---

## Key Files

| File | Purpose |
|------|---------|
| `supabase/sql/completed/008_comprehensive_rls_policies.sql` | Main migration |
| `specs/8-rls-policies/data-model.md` | Policy-to-table mapping |
| `specs/8-rls-policies/research.md` | Design decisions |

---

## Technology

- **PostgreSQL RLS**: Native row-level security
- **Supabase Auth**: `auth.uid()` for user identification
- **Helper Functions**: `get_user_organization_id()`, `get_user_agency_id()`, `get_user_contractor_id()`
- **No application code changes**: RLS is transparent to the Next.js application
