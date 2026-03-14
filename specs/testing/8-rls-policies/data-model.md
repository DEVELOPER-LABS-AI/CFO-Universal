# Data Model: Comprehensive RLS Policy Implementation

**Feature**: 8-rls-policies
**Date**: 2026-02-28

---

## Overview

This feature does NOT create new tables or columns. It adds PostgreSQL RLS policies and two helper functions to existing tables. This document maps the policy-to-table relationships.

---

## New Database Objects

### Helper Functions

**get_user_agency_id()**
- Returns: TEXT (nullable)
- Purpose: Retrieve the authenticated user's agency_id from user_profiles
- Used by: Agency portal scoping policies
- Security: SECURITY DEFINER, STABLE

**get_user_contractor_id()**
- Returns: TEXT (nullable)
- Purpose: Retrieve the authenticated user's contractor_id from user_profiles
- Used by: Contractor portal scoping policies
- Security: SECURITY DEFINER, STABLE

### Existing Helper (No Changes)

**get_user_organization_id()**
- Already deployed and used by existing RLS policies
- Returns the authenticated user's organization_id from user_organizations

---

## Policy Coverage Map

### Group 1: Mercury Integration Tables (4 tables)

| Table | Has org_id | Access Pattern | SELECT | INSERT | UPDATE | DELETE |
|-------|-----------|----------------|--------|--------|--------|--------|
| mercury_connections | Yes | Direct org | Org match | Org match | Org match | Org match |
| mercury_sync_logs | No | Via connection | EXISTS → connection.org | EXISTS → connection.org | EXISTS → connection.org | EXISTS → connection.org |
| merchant_mapping_cache | No | Via connection | EXISTS → connection.org | EXISTS → connection.org | EXISTS → connection.org | EXISTS → connection.org |
| account_balance_history | No | Via connection | EXISTS → connection.org | EXISTS → connection.org | EXISTS → connection.org | EXISTS → connection.org |

**Relationship Chain**: mercury_sync_logs.connection_id → mercury_connections.id → mercury_connections.organization_id

---

### Group 2: Subscription / Cost Sync Tables (3 tables)

| Table | Has org_id | Access Pattern | SELECT | INSERT | UPDATE | DELETE |
|-------|-----------|----------------|--------|--------|--------|--------|
| subscription_transaction_records | Yes | Direct org | Org match | Org match | Org match | Org match |
| client_cash_receipts | Yes | Direct org | Org match | Org match | Org match | Org match |
| auto_sync_run_logs | Yes | Direct org | Org match | Org match | Org match | Org match |

---

### Group 3: Staff Management Tables (4 tables)

| Table | Has org_id | Access Pattern | SELECT | INSERT | UPDATE | DELETE |
|-------|-----------|----------------|--------|--------|--------|--------|
| staff_roles | Yes | Direct org | Org match | Org match | Org match | Org match |
| staff_bonuses | No | Via staff | EXISTS → staff.org | EXISTS → staff.org | EXISTS → staff.org | EXISTS → staff.org |
| staff_reimbursements | No | Via staff | EXISTS → staff.org | EXISTS → staff.org | EXISTS → staff.org | EXISTS → staff.org |
| monthly_allocation_overrides | No | Via assignment → staff | EXISTS → assignment → staff.org | EXISTS chain | EXISTS chain | EXISTS chain |

**Relationship Chains**:
- staff_bonuses.staff_id → staff.id → staff.organization_id
- staff_reimbursements.staff_id → staff.id → staff.organization_id
- monthly_allocation_overrides.assignment_id → staff_assignments.id → staff_assignments.staff_id → staff.organization_id

---

### Group 4: Agency Portal Tables (3 tables)

| Table | Has org_id | Access Pattern | SELECT | INSERT | UPDATE | DELETE |
|-------|-----------|----------------|--------|--------|--------|--------|
| agency_invoices | No | Via agency + portal | Agency match OR org role | Agency match | Agency match | Agency match (ADMIN only) |
| agency_invoice_line_items | No | Via invoice → agency | Agency match OR org role | Agency match | Agency match | Agency match |
| agency_invoice_comments | No | Via invoice → agency | Agency match OR org role | Agency match | Agency match | Agency match |

**Relationship Chains**:
- agency_invoices.agency_id → agencies.id → agencies.organization_id
- agency_invoice_line_items.invoice_id → agency_invoices.id → agency_invoices.agency_id → agencies
- agency_invoice_comments.invoice_id → agency_invoices.id → agency_invoices.agency_id → agencies

**Portal Scoping Logic**:
- AGENCY_ADMIN: Can only access rows where agency matches user_profiles.agency_id
- ADMIN/ANALYST/EXECUTIVE: Can access all rows in their organization

---

### Group 5: Contractor Portal Tables (2 tables)

| Table | Has org_id | Access Pattern | SELECT | INSERT | UPDATE | DELETE |
|-------|-----------|----------------|--------|--------|--------|--------|
| contractor_invoice_line_items | No | Via invoice + portal | Contractor match OR org role | Contractor match | Contractor match | Contractor match |
| contractor_documents | Yes | Direct org + portal | Contractor match OR org role | Contractor match | Contractor match | Contractor match |

**Note**: contractor_invoices and contractor_payments have org_id and are also contractor-portal-scoped:

| Table | Has org_id | Access Pattern | SELECT | INSERT | UPDATE | DELETE |
|-------|-----------|----------------|--------|--------|--------|--------|
| contractor_invoices | Yes | Direct org + portal | Contractor match OR org role | Contractor match | Contractor match | Contractor match |
| contractor_payments | Yes | Direct org + portal | Contractor match OR org role | Org match only | Org match only | Org match only |

**Relationship Chains**:
- contractor_invoice_line_items.invoice_id → contractor_invoices.id → contractor_invoices.contractor_id
- contractor_documents.contractor_id → core_contractors.id

**Portal Scoping Logic**:
- CONTRACTOR: Can only access rows where contractor matches user_profiles.contractor_id
- ADMIN/ANALYST/EXECUTIVE: Can access all rows in their organization

---

### Group 6: System / Utility Tables (5 tables)

| Table | Has org_id | Access Pattern | SELECT | INSERT | UPDATE | DELETE |
|-------|-----------|----------------|--------|--------|--------|--------|
| transaction_categorization_rules | Yes | Direct org | Org match | Org match | Org match | Org match |
| vendor_expense_categories | Yes | Direct org | Org match | Org match | Org match | Org match |
| owner_monthly_pay | Yes | Direct org | Org match | Org match | Org match | Org match |
| user_profiles | No | user_id = auth | Own profile only | Own profile only | Own profile only | Denied |
| audit_logs | No | actor_id = auth | Own entries only | Service role only | Service role only | Service role only |

---

### Group 7: Junction / Child Tables (1 table)

| Table | Has org_id | Access Pattern | SELECT | INSERT | UPDATE | DELETE |
|-------|-----------|----------------|--------|--------|--------|--------|
| core_client_services | No | Via client | EXISTS → client.org | EXISTS → client.org | EXISTS → client.org | EXISTS → client.org |

**Relationship Chain**: core_client_services.client_id → core_clients.id → core_clients.organization_id

---

## Summary

| Group | Tables | New Policies |
|-------|--------|-------------|
| Mercury Integration | 4 | 16 |
| Subscription/Cost Sync | 3 | 12 |
| Staff Management | 4 | 16 |
| Agency Portal | 3 | 12 |
| Contractor Portal | 4 | 16 |
| System/Utility | 5 | 14 |
| Junction/Child | 1 | 4 |
| **Total** | **24** | **~90** |

Plus 2 new helper functions.
