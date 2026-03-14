# Feature Specification: Comprehensive RLS Policy Implementation

**Status**: Draft
**Created**: 2026-02-28
**Last Updated**: 2026-02-28

---

## Overview

### Feature Summary

This feature adds Row-Level Security (RLS) policies to all Supabase tables that currently lack them, ensuring complete organization-level data isolation at the database layer. Currently only Xero integration tables, notifications, and webhook events have RLS policies — leaving 40+ tables without database-enforced access control.

### Business Value

Without RLS, data isolation relies entirely on application-layer filtering (WHERE organization_id = ...). A single missed filter, a direct database query, or a compromised API endpoint could expose one organization's data to another. RLS provides defense-in-depth: even if application code has a bug, the database itself refuses to return rows the authenticated user shouldn't see. This is critical for a multi-tenant financial application handling revenue, expenses, contractor payments, and bank transaction data.

### Target Users

- **System Administrator**: Configures and verifies RLS policies are active across all tables.
- **All Application Users (ADMIN, ANALYST, EXECUTIVE)**: Benefit from data isolation without any workflow changes — RLS is transparent to end users.
- **Portal Users (AGENCY_ADMIN, CONTRACTOR)**: Benefit from scoped access — can only see data related to their own agency or contractor record.
- **System Services (Mercury sync, Xero sync, auto-association engine)**: Continue operating via the service role, which automatically bypasses RLS.

---

## User Scenarios

### Primary Use Cases

**Scenario 1: Organization Data Isolation**
- **Actor**: Any authenticated user
- **Goal**: Access only data belonging to their organization, with no possibility of cross-tenant data leakage.
- **Steps**:
  1. User authenticates and receives a session tied to their user ID.
  2. User queries any table (clients, subscriptions, expenses, etc.) through the application.
  3. The database automatically filters results to only include rows matching the user's organization.
- **Expected Outcome**: The user sees only their organization's data. Even if the application omits an organization_id filter, RLS prevents cross-tenant exposure.

**Scenario 2: Admin Write Access**
- **Actor**: ADMIN user
- **Goal**: Create, update, and delete records across all organization tables.
- **Steps**:
  1. Admin creates a new client, contractor, or subscription.
  2. Admin updates an existing record.
  3. Admin deletes (soft or hard) a record.
- **Expected Outcome**: All write operations succeed because the user has ADMIN role. The database enforces that the record's organization_id matches the admin's organization.

**Scenario 3: Read-Only Access for Analysts and Executives**
- **Actor**: ANALYST or EXECUTIVE user
- **Goal**: View all organization data without the ability to modify it.
- **Steps**:
  1. Analyst navigates to any dashboard page (clients, revenue, ROI, subscriptions).
  2. Data loads successfully with full read access.
  3. Analyst attempts to modify a record (if application allows).
- **Expected Outcome**: SELECT operations succeed. INSERT/UPDATE/DELETE operations are denied at the database layer for tables that enforce role-based write restrictions.

**Scenario 4: Agency Portal Data Scoping**
- **Actor**: AGENCY_ADMIN user
- **Goal**: View and manage only data related to their own agency.
- **Steps**:
  1. Agency admin logs in and is directed to the agency portal.
  2. Agency admin views their agency's invoices, staff, and breakdowns.
  3. Agency admin attempts to access another agency's data.
- **Expected Outcome**: Only data linked to the user's agency is visible. Data from other agencies within the same organization is hidden.

**Scenario 5: Contractor Portal Data Scoping**
- **Actor**: CONTRACTOR user
- **Goal**: View and manage only their own invoices, documents, and payments.
- **Steps**:
  1. Contractor logs in and is directed to the contractor portal.
  2. Contractor views their invoices, uploads documents, and checks payment status.
  3. Contractor attempts to access another contractor's data.
- **Expected Outcome**: Only data linked to the user's contractor record is visible.

**Scenario 6: System Service Operations**
- **Actor**: System (Mercury sync, Xero sync, auto-association engine)
- **Goal**: Read and write data across any organization as part of automated sync operations.
- **Steps**:
  1. Scheduled Mercury sync triggers using the Supabase service role key.
  2. Sync engine creates expense records, updates merchant mappings, and logs sync results.
  3. Auto-association engine creates subscription transaction records and updates allocations.
- **Expected Outcome**: All operations succeed because the service role automatically bypasses RLS policies. No code changes needed for existing sync workflows.

### Edge Cases

- **User belongs to no organization**: The get_user_organization_id() helper returns NULL. All queries return zero rows — no data is exposed.
- **User's organization membership is revoked mid-session**: Active sessions continue until token expiry, but subsequent queries reflect the updated membership (helper function queries live data).
- **Tables without organization_id column**: Some tables (e.g., audit_logs) lack a direct organization_id. Policies must use relationship traversal or alternative access patterns.
- **Soft-deleted records**: RLS does not distinguish between active and soft-deleted rows — it filters by organization_id regardless of deleted_at status. Application logic continues to handle soft-delete filtering.
- **Agency invoice line items and comments**: These tables reference agency_invoices (not organization_id directly). Policies must traverse the relationship to the parent invoice for organization isolation.

---

## Functional Requirements

### Core Requirements

**FR-1: Enable RLS on All Unprotected Tables**
- **Description**: Every table in the database that currently lacks RLS must have it enabled. This is the foundational step — without ENABLE ROW LEVEL SECURITY, no policies take effect.
- **Acceptance Criteria**:
  - [ ] RLS is enabled on all 40+ tables listed in scope.
  - [ ] No table in the public schema remains without RLS enabled.
  - [ ] Enabling RLS does not break existing application queries (service role bypasses RLS automatically).

**FR-2: Organization-Level SELECT Policies**
- **Description**: Every table with an organization_id column must have a SELECT policy that restricts row visibility to the authenticated user's organization.
- **Acceptance Criteria**:
  - [ ] Authenticated users can only SELECT rows where organization_id matches their organization.
  - [ ] The get_user_organization_id() helper function is used consistently for organization resolution.
  - [ ] Tables without a direct organization_id column use relationship traversal (EXISTS subquery) to verify access.
  - [ ] Anonymous (unauthenticated) users cannot SELECT any rows.

**FR-3: Role-Based Write Policies**
- **Description**: INSERT, UPDATE, and DELETE operations on organization data tables are restricted to users with the ADMIN role. Read-only roles (ANALYST, EXECUTIVE) can only SELECT.
- **Acceptance Criteria**:
  - [ ] ADMIN users can INSERT, UPDATE, and DELETE records within their organization.
  - [ ] ANALYST and EXECUTIVE users are denied INSERT, UPDATE, and DELETE operations at the database layer.
  - [ ] Role checking uses the user_organizations table to verify the user's role within their organization.
  - [ ] WITH CHECK clauses on INSERT/UPDATE ensure the organization_id on new/modified records matches the user's organization.

**FR-4: Agency Portal Data Scoping**
- **Description**: AGENCY_ADMIN users can only access data linked to their specific agency. This applies to agency invoices, invoice line items, invoice comments, and agency monthly breakdowns.
- **Acceptance Criteria**:
  - [ ] AGENCY_ADMIN users can SELECT only rows linked to their own agency.
  - [ ] AGENCY_ADMIN users can INSERT and UPDATE records for their own agency (e.g., submit invoices, add comments).
  - [ ] Agency identity is derived from the user_profiles.agency_id linked to the authenticated user.
  - [ ] Cross-agency data within the same organization is invisible to AGENCY_ADMIN users.

**FR-5: Contractor Portal Data Scoping**
- **Description**: CONTRACTOR users can only access their own invoices, documents, and payments. They cannot see other contractors' data.
- **Acceptance Criteria**:
  - [ ] CONTRACTOR users can SELECT only contractor_invoices, contractor_documents, and contractor_payments linked to their contractor_id.
  - [ ] CONTRACTOR users can INSERT records for their own contractor (e.g., submit invoices, upload documents).
  - [ ] Contractor identity is derived from user_profiles.contractor_id linked to the authenticated user.
  - [ ] Cross-contractor data within the same organization is invisible to CONTRACTOR users.

**FR-6: Service Role Bypass**
- **Description**: The Supabase service role must continue to bypass all RLS policies so that automated system operations (Mercury sync, Xero sync, auto-association engine, scheduled jobs) function without interruption.
- **Acceptance Criteria**:
  - [ ] Service role key operations are unaffected by newly added RLS policies.
  - [ ] No existing sync, cron, or background job breaks after RLS is enabled.
  - [ ] Service role access is verified by testing that system operations can read/write across all organizations.

**FR-7: Idempotent Migration Script**
- **Description**: The RLS policy migration must be safe to run multiple times without errors or duplicate policies.
- **Acceptance Criteria**:
  - [ ] The migration script uses DROP POLICY IF EXISTS before CREATE POLICY for every policy.
  - [ ] The script uses CREATE OR REPLACE for any helper functions.
  - [ ] Running the migration script twice produces identical results with no errors.
  - [ ] The script is organized by table group for readability and maintenance.

**FR-8: Child Table Access via Parent Relationship**
- **Description**: Tables that lack a direct organization_id column must derive access from their parent table's organization membership.
- **Acceptance Criteria**:
  - [ ] agency_invoice_line_items and agency_invoice_comments derive access through agency_invoices.
  - [ ] contractor_invoice_line_items and contractor_documents derive access through contractor_invoices.
  - [ ] monthly_allocation_overrides derive access through staff_assignments.
  - [ ] All relationship traversal policies use efficient EXISTS subqueries.

---

## Success Criteria

### Measurable Outcomes

- [ ] **Coverage**: 100% of tables in the public schema have RLS enabled with at least a SELECT policy.
- [ ] **Data Isolation**: No authenticated user can access rows belonging to a different organization, verified by querying each table with different user contexts.
- [ ] **Role Enforcement**: ANALYST and EXECUTIVE users are unable to INSERT, UPDATE, or DELETE records on role-restricted tables.
- [ ] **Portal Scoping**: AGENCY_ADMIN users see only their agency's data; CONTRACTOR users see only their own data.
- [ ] **Zero Regression**: All existing application features (dashboard, integrations, portals, sync jobs) continue to function identically after RLS deployment.
- [ ] **Service Continuity**: Mercury sync, Xero sync, and auto-association engine complete successfully with service role after RLS is enabled.
- [ ] **Idempotency**: The migration script can be run 3 consecutive times without errors or side effects.

---

## Dependencies

### External Dependencies

- **Supabase**: RLS is a Supabase/PostgreSQL feature. The Supabase project must support RLS (all plans do).

### Internal Dependencies

- **get_user_organization_id() helper function**: Already exists and is used by existing RLS policies. Must be verified as functional before expanding usage.
- **user_organizations table**: Maps users to organizations with roles. This is the foundation for all organization-scoped policies.
- **user_profiles table**: Contains agency_id and contractor_id fields used for portal-scoped policies.
- **Existing RLS policies**: Policies on Xero tables, notifications, and webhook events must remain unchanged.

---

## Assumptions

- The get_user_organization_id() helper function is already deployed and returns the correct organization_id for any authenticated user.
- Users belong to exactly one organization (the helper uses LIMIT 1).
- The Supabase service role key is used for all system operations (sync jobs, cron tasks, background processing) and automatically bypasses RLS.
- Application code already filters by organization_id in most queries — RLS serves as a safety net, not the primary access control mechanism.
- The ADMIN role is the only role that needs write access to most tables. Portal roles (AGENCY_ADMIN, CONTRACTOR) have write access scoped to their own records.
- The audit_logs table does not have an organization_id column and uses actor_id for access control instead.
- All tables listed in scope exist and are actively used by the application.

---

## Out of Scope

- Modifying existing RLS policies on Xero tables, notifications, or webhook events.
- Implementing column-level security (all columns are accessible if row-level access is granted).
- Adding new database columns or modifying the schema to support RLS.
- Implementing application-layer authorization changes (the app already handles this).
- Fine-grained field-level permissions (e.g., hiding salary data from certain roles).
- Multi-organization user support (users currently belong to one organization).
- Revoking or rotating the Supabase service role key.

---

## Security & Privacy Considerations

- **Multi-Tenant Isolation**: This feature is the primary defense against cross-tenant data exposure. Every table holding organization-specific data must be protected.
- **Defense in Depth**: RLS complements application-layer authorization. Even if application code has a bug that omits an organization filter, RLS prevents data leakage.
- **Financial Data Protection**: Tables containing revenue, expenses, bank transactions, and payment data are particularly sensitive. RLS ensures these are organization-isolated.
- **Portal Isolation**: Agency and contractor portal users must not see data from other agencies/contractors, even within the same organization.
- **Service Role Security**: The service role key must be kept server-side only. It should never be exposed to client-side code, as it bypasses all RLS policies.

---

## Future Enhancements

- Column-level security to restrict sensitive fields (e.g., payment amounts, bank details) from certain roles.
- Multi-organization user support with role-per-organization scoping.
- Automated RLS policy testing as part of the CI/CD pipeline.
- Audit logging of RLS policy violations (denied queries).
