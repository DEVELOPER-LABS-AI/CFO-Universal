# Data Model: BDR Portal — End-of-Month Reports, Bonus Plans & Expense Reimbursement

**Feature**: 12-bdr-portal
**Date**: 2026-03-03

---

## Existing Models (Modified)

### UserProfile (extend)

| Field | Type | Notes |
|-------|------|-------|
| `bdr_staff_id` | `String?` `@unique` | Links BDR user to Staff record (nullable) |
| `bdr_staff` | Relation → Staff | One-to-one relation |

### UserRole Enum (extend)

Add: `BDR`

---

## New Enums

### BDRReportStatus

```
DRAFT
SUBMITTED
APPROVED
NEEDS_CORRECTION
```

### BDRExpenseStatus

```
SUBMITTED
APPROVED
REJECTED
REIMBURSED
```

### BDRBaseMetric

```
MEETINGS_BOOKED
MEETINGS_SHOWED
```

---

## New Models

### BDRPayPlan

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| `id` | `String` (UUID) | PK, auto-generated | |
| `organization_id` | `String` | FK → Organization, NOT NULL | Multi-tenant scope |
| `name` | `String` | NOT NULL, max 200 | e.g. "Standard BDR Plan Q1 2026" |
| `description` | `String?` | Text | Optional plan description |
| `base_metric` | `BDRBaseMetric` | NOT NULL | Which metric drives bonus calc |
| `effective_start` | `DateTime` | NOT NULL | When this plan becomes active |
| `effective_end` | `DateTime?` | Nullable | NULL = indefinitely active |
| `is_active` | `Boolean` | Default: true | Soft deactivation |
| `created_by` | `String` | NOT NULL | user_id who created |
| `created_at` | `DateTime` | Default: now() | |
| `updated_at` | `DateTime` | Auto-updated | |

**Relations**: `tiers` → BDRBonusTier[], `assignments` → BDRPayPlanAssignment[], `reports` → BDRMonthlyReport[]
**Indexes**: `[organization_id]`, `[organization_id, is_active]`
**Validation**: Name required; at least one tier must exist before assignment

---

### BDRBonusTier

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| `id` | `String` (UUID) | PK, auto-generated | |
| `pay_plan_id` | `String` | FK → BDRPayPlan, NOT NULL | Parent plan |
| `min_threshold` | `Int` | NOT NULL, >= 1 | Start of tier range (inclusive) |
| `max_threshold` | `Int?` | Nullable | End of range (inclusive); NULL = uncapped top tier |
| `payout_rate` | `Decimal(10,2)` | NOT NULL, > 0 | Dollar amount per meeting in this tier |
| `sort_order` | `Int` | NOT NULL | Display/calculation order |
| `created_at` | `DateTime` | Default: now() | |
| `updated_at` | `DateTime` | Auto-updated | |

**Relations**: `pay_plan` → BDRPayPlan
**Indexes**: `[pay_plan_id, sort_order]`
**Validation**: No overlapping threshold ranges within a plan; payout_rate must be positive

---

### BDRPayPlanAssignment

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| `id` | `String` (UUID) | PK, auto-generated | |
| `pay_plan_id` | `String` | FK → BDRPayPlan, NOT NULL | |
| `staff_id` | `String` | FK → Staff, NOT NULL | BDR staff member |
| `effective_from` | `DateTime` | NOT NULL | When assignment starts |
| `effective_to` | `DateTime?` | Nullable | NULL = currently active |
| `created_at` | `DateTime` | Default: now() | |
| `updated_at` | `DateTime` | Auto-updated | |

**Relations**: `pay_plan` → BDRPayPlan, `staff` → Staff
**Unique**: `[staff_id, effective_from]` — prevents duplicate assignments for same start date
**Indexes**: `[staff_id]`, `[pay_plan_id]`
**Validation**: Active assignment = `effective_to IS NULL`; only one active assignment per BDR

---

### BDRMonthlyReport

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| `id` | `String` (UUID) | PK, auto-generated | |
| `organization_id` | `String` | FK → Organization, NOT NULL | Multi-tenant scope |
| `staff_id` | `String` | FK → Staff, NOT NULL | BDR who submitted |
| `month` | `Int` | 1-12, NOT NULL | Report month |
| `year` | `Int` | NOT NULL | Report year |
| `meetings_booked` | `Int` | NOT NULL, >= 0 | Self-reported meetings booked |
| `meetings_showed` | `Int` | NOT NULL, >= 0 | Self-reported meetings showed |
| `pay_plan_id` | `String?` | FK → BDRPayPlan | Snapshot of assigned plan at submission |
| `calculated_bonus` | `Decimal(10,2)` | NOT NULL, default 0 | Auto-calculated from tiers |
| `bonus_breakdown` | `Json?` | | Tier-by-tier calculation detail |
| `status` | `BDRReportStatus` | Default: DRAFT | Report lifecycle status |
| `notes` | `String?` | Text | BDR's notes |
| `admin_notes` | `String?` | Text | Admin feedback (esp. for NEEDS_CORRECTION) |
| `submitted_at` | `DateTime?` | | When BDR submitted |
| `approved_at` | `DateTime?` | | When admin approved |
| `approved_by` | `String?` | | user_id who approved |
| `created_at` | `DateTime` | Default: now() | |
| `updated_at` | `DateTime` | Auto-updated | |

**Relations**: `staff` → Staff, `organization` → Organization, `pay_plan` → BDRPayPlan
**Unique**: `[staff_id, month, year]` — one report per BDR per month
**Indexes**: `[organization_id, year, month]`, `[staff_id, year, month]`, `[status]`

**State transitions**:
- DRAFT → SUBMITTED (BDR submits)
- SUBMITTED → APPROVED (Admin approves)
- SUBMITTED → NEEDS_CORRECTION (Admin flags)
- NEEDS_CORRECTION → SUBMITTED (BDR re-submits)

---

### BDRExpenseCategory

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| `id` | `String` (UUID) | PK, auto-generated | |
| `organization_id` | `String` | FK → Organization, NOT NULL | Multi-tenant scope |
| `name` | `String` | NOT NULL, max 100 | e.g. "Travel", "Meals" |
| `description` | `String?` | Text | |
| `is_active` | `Boolean` | Default: true | Soft deactivation |
| `created_at` | `DateTime` | Default: now() | |
| `updated_at` | `DateTime` | Auto-updated | |

**Relations**: `organization` → Organization, `expenses` → BDRExpenseClaim[]
**Unique**: `[organization_id, name]` — unique category name per org
**Indexes**: `[organization_id, is_active]`

---

### BDRExpenseClaim

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| `id` | `String` (UUID) | PK, auto-generated | |
| `organization_id` | `String` | FK → Organization, NOT NULL | Multi-tenant scope |
| `staff_id` | `String` | FK → Staff, NOT NULL | BDR who submitted |
| `expense_date` | `DateTime` | NOT NULL | Date of expense |
| `category_id` | `String` | FK → BDRExpenseCategory, NOT NULL | |
| `amount` | `Decimal(10,2)` | NOT NULL, > 0 | Expense amount |
| `description` | `String?` | Text | What the expense was for |
| `receipt_path` | `String?` | | Supabase Storage path; NULL = no receipt (flagged) |
| `receipt_file_name` | `String?` | | Original file name |
| `receipt_file_size` | `Int?` | | File size in bytes |
| `receipt_mime_type` | `String?` | | MIME type |
| `has_receipt` | `Boolean` | Default: false | Quick flag for admin queue filtering |
| `status` | `BDRExpenseStatus` | Default: SUBMITTED | Expense lifecycle status |
| `admin_notes` | `String?` | Text | Rejection reason or approval notes |
| `approved_at` | `DateTime?` | | |
| `approved_by` | `String?` | | user_id |
| `reimbursed_at` | `DateTime?` | | When marked as paid |
| `created_at` | `DateTime` | Default: now() | |
| `updated_at` | `DateTime` | Auto-updated | |

**Relations**: `staff` → Staff, `organization` → Organization, `category` → BDRExpenseCategory
**Indexes**: `[organization_id, status]`, `[staff_id, status]`, `[staff_id, expense_date]`

**State transitions**:
- SUBMITTED → APPROVED (Admin approves)
- SUBMITTED → REJECTED (Admin rejects with reason)
- APPROVED → REIMBURSED (Admin marks as paid)

---

## Entity Relationship Diagram (Text)

```
Organization ─────┬──── BDRPayPlan ──── BDRBonusTier
                   │         │
                   │    BDRPayPlanAssignment
                   │         │
Staff (BDR) ──────┼─────────┘
    │              │
    ├── BDRMonthlyReport
    │
    ├── BDRExpenseClaim ──── BDRExpenseCategory
    │
    └── UserProfile (bdr_staff_id)
```

---

## Existing Relations (Extended on Staff)

Add to Staff model:
- `pay_plan_assignments` → BDRPayPlanAssignment[]
- `bdr_reports` → BDRMonthlyReport[]
- `bdr_expenses` → BDRExpenseClaim[]
- `bdr_user_profile` → UserProfile? (via bdr_staff_id)
