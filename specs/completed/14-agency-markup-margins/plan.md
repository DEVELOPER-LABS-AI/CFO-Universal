# Implementation Plan: Agency Staff True Cost & Markup Transparency

**Created**: 2026-03-05
**Feature**: 14-agency-markup-margins
**Branch**: `14-agency-markup-margins`
**Spec**: [spec.md](spec.md)

---

## Technical Context

### Stack
- **Framework**: Next.js 15 (App Router) + React 19
- **Database**: Supabase PostgreSQL via Prisma ORM
- **Styling**: Tailwind CSS + shadcn/ui
- **Validation**: Zod
- **Mutations**: Next.js Server Actions
- **Auth**: Supabase Auth + custom RBAC (UserRole enum: ADMIN, EXECUTIVE, ANALYST, AGENCY_ADMIN, CONTRACTOR, BDR)

### Key Existing Patterns
- Server Actions in `app/actions/` for all mutations (no API routes for CRUD)
- Zod validation schemas in `lib/validations/`
- Calculation utilities in `lib/calculations/`
- Auth helpers in `lib/auth/helpers.ts` (requireAdmin, requireAdminOrExecutive, requireAgencyAdmin)
- Currency conversion via `toMonthlyCost()` in `lib/utils/currency.ts` (176 hrs/mo, 22 days/mo)
- Soft deletes with `deleted_at` field pattern
- JSONB for flexible breakdown structures with Zod-enforced schemas

### Affected Models
- **Agency** (add 3 fields: markup_type, markup_value, markup_basis)
- **Staff** (add 5 fields: true_cost, true_cost_rate_type, markup_override_type, markup_override_value, rate_locked)
- **AgencyMonthlyBreakdown** (JSONB structure enhanced — no schema migration needed)

---

## Constitution Check

| Principle | Status | Notes |
|-----------|--------|-------|
| P1: Technology Stack | PASS | No new technologies introduced |
| P2: Data Architecture | PASS | Organization-scoped via existing FK chains |
| P3: Integration Philosophy | PASS | No new external integrations |
| P4: Security Requirements | PASS | RBAC via existing helpers; true cost hidden from AGENCY_ADMIN |
| P5: Performance Standards | PASS | Margin calculations are O(1) arithmetic on already-fetched data |
| P6: Code Quality | PASS | TypeScript strict; Prisma types; Zod validation |
| P7: Development Workflow | PASS | Feature branch; spec-driven |
| P8: Prisma-Supabase Alignment | PASS | Standard migration workflow; pooler URLs |

**Gate Result**: ALL PASS — No violations. Proceed to implementation.

---

## Design Artifacts

- [research.md](research.md) — 8 research decisions documented
- [data-model.md](data-model.md) — Schema changes, validation rules, state transitions
- [contracts/server-actions.md](contracts/server-actions.md) — Server action signatures and contracts
- [quickstart.md](quickstart.md) — Implementation order and testing checklist

---

## Implementation Phases

### Phase 1: Data Layer (Foundation)

**Goal**: Schema changes, migration, and validation schemas. Everything else depends on this.

#### Task 1.1: Verify Database Connection
- Run `npx prisma migrate status` to confirm connection
- Verify `.env` uses pooler URLs

#### Task 1.2: Prisma Schema Changes
**File**: `prisma/schema.prisma`

Add enums:
```prisma
enum MarkupType {
  PERCENTAGE
  FLAT_RATE
  @@map("MarkupType")
}

enum MarkupBasis {
  BASE_PAY
  TOTAL_COMPENSATION
  @@map("MarkupBasis")
}
```

Add to Agency model:
```prisma
markup_type   MarkupType?
markup_value  Decimal?    @db.Decimal(10, 2)
markup_basis  MarkupBasis?
```

Add to Staff model:
```prisma
true_cost              Decimal?    @db.Decimal(10, 2)
true_cost_rate_type    RateType?
markup_override_type   MarkupType?
markup_override_value  Decimal?    @db.Decimal(10, 2)
rate_locked            Boolean     @default(false)
```

#### Task 1.3: Run Migration
```bash
npx prisma migrate dev --name add-agency-markup-fields
npx prisma generate
```

#### Task 1.4: Extend Zod Validation Schemas
**File**: `lib/validations/agency.ts`
- Add `markup_type`, `markup_value`, `markup_basis` to `createAgencySchema` and `updateAgencySchema`
- Add cross-field validation: markup_type required when markup_value is set
- Add `true_cost` optional field to `staffBreakdownItemSchema`

**File**: `lib/validations/staff.ts`
- Add `true_cost`, `true_cost_rate_type`, `markup_override_type`, `markup_override_value`, `rate_locked` to `createStaffSchema` and `updateStaffSchema`
- Add refinement: true_cost required when engagement_type === 'AGENCY' (for create only)
- Add refinement: markup_override_type required when markup_override_value is set

---

### Phase 2: Calculation Logic

**Goal**: Pure utility functions for markup/margin math. Testable independently.

#### Task 2.1: Create Markup Calculations Module
**File**: `lib/calculations/markup-calculations.ts` (NEW)

Functions:
- `calculateBillRate(trueCost, trueCostRateType, markupType, markupValue, markupBasis, expenses?, reimbursements?)` → `{ billRate, billRateType }`
- `calculateMargin(billRate, billRateType, trueCost, trueCostRateType)` → `{ marginDollar, marginPercentage, isNegative }`
- `getEffectiveMarkup(staff, agency)` → `{ markupType, markupValue, markupBasis, source, rateLocked }`

Uses existing `toMonthlyCost()` for rate type conversions.

#### Task 2.2: Unit Tests for Calculations
**File**: `lib/calculations/__tests__/markup-calculations.test.ts` (NEW)

Test cases:
- Percentage markup on base pay (e.g., $5000 × 1.30 = $6500)
- Percentage markup on total compensation (e.g., ($5000 + $200 + $100) × 1.30 = $6890)
- Flat rate markup (e.g., $30/hr + $15/hr = $45/hr)
- Rate type conversion (hourly true cost with monthly bill rate)
- Zero markup (bill rate = true cost)
- Negative margin detection
- Null true cost handling (returns null margin)
- getEffectiveMarkup priority: staff override > agency default > none

---

### Phase 3: Server Actions

**Goal**: Backend logic for CRUD operations with markup awareness.

#### Task 3.1: Extend Agency Management Actions
**File**: `app/actions/agency-management.ts`

- `updateAgency()`: Accept and validate markup_type, markup_value, markup_basis
- `createAgencyMonthlyBreakdown()`: Accept true_cost in staff breakdown items; include true_cost_total, margin_total, margin_percentage in response summary

#### Task 3.2: Extend Staff Management Actions
**File**: `app/actions/staff-management.ts`

- `createStaff()`: Accept true_cost fields; auto-calculate rate from true_cost + markup when not rate_locked
- `updateStaff()`: Handle true_cost updates; recalculate rate if not locked; handle lock/unlock transitions

#### Task 3.3: Ensure Agency Portal Exclusion
**File**: `app/actions/agency-portal-actions.ts`

- Verify `getAgencyStaff()` does NOT include true_cost, markup_override_*, or rate_locked in select/response
- If it uses `select: *` or no select, add explicit field exclusion

---

### Phase 4: UI Components

**Goal**: User-facing forms and displays.

#### Task 4.1: Agency Markup Configuration
**File**: `components/agencies/EditAgencyModal.tsx`

Add markup configuration section below existing fields:
- Markup Type: Select (Percentage / Flat Rate / None)
- Markup Value: Number input (conditional on type selected)
- Markup Basis: Select (Base Pay Only / Total Compensation) (conditional on type selected)
- Show preview: "30% markup on base pay" or "$15/hr flat rate"

#### Task 4.2: Staff True Cost in Add Modal
**File**: `components/staff/AddStaffModal.tsx`

When `association === 'agency'`:
- Add "True Cost" number input (required)
- Add "True Cost Rate Type" select (HOURLY/DAILY/MONTHLY)
- Show calculated bill rate based on agency's markup config
- Add "Lock Rate" toggle (default off)
- Add optional "Markup Override" section (expandable)

#### Task 4.3: Staff True Cost in Edit Modal
**File**: `components/staff/EditStaffModal.tsx`

For agency staff:
- Add "True Cost" field (pre-populated or empty for existing staff)
- Add "True Cost Rate Type" select
- Add "Rate Lock" toggle with visual indicator
- Add "Override Markup" expandable section
- Show computed margin when true cost is available

#### Task 4.4: Enhanced Monthly Breakdown
**File**: `components/agencies/AddBreakdownModal.tsx`

Staff line item table:
- Add "True Cost" column (pre-populated from staff record)
- Add "Margin" column (computed: base_pay - true_cost)
- Add totals row showing total true cost, total billed, total margin

#### Task 4.5: Staff Detail Page — Margin Display
**File**: `app/dashboard/staff/[id]/page.tsx`

For agency staff with true cost:
- Add margin card: Monthly Margin ($X / Y%)
- Show markup source badge: "Agency Default" or "Staff Override" or "Locked Rate"
- Negative margin: warning indicator

#### Task 4.6: Agency Detail Page — Margin Breakdown
**File**: `app/dashboard/agencies/[id]/page.tsx`

- Add margin columns to staff table: True Cost, Bill Rate, Margin ($), Margin (%)
- Staff without true cost show "N/A"
- Add agency summary card: Total True Cost, Total Billed, Total Margin, Avg Margin %

#### Task 4.7: Agencies Dashboard — Aggregate Metrics
**File**: `app/dashboard/agencies/page.tsx`

Add/modify metric cards:
- "Total True Cost" card (sum of all agency staff true costs, monthly)
- "Total Margin" card (total billed - total true cost)
- "Avg Margin %" card (weighted average across all agencies)
- Per-agency cards: show margin % alongside existing metrics

---

### Phase 5: Access Control & Testing

**Goal**: Verify data isolation and end-to-end flows.

#### Task 5.1: Agency Portal Data Isolation
- Verify agency portal pages don't display true cost or margin data
- Verify agency portal actions don't return markup/true cost fields
- Test with AGENCY_ADMIN user login

#### Task 5.2: Integration Testing
- End-to-end flow: Create agency with markup → Add staff with true cost → Verify bill rate → Check margins on dashboard
- Edge cases: rate lock, markup change, existing staff without true cost
- Role-based: verify AGENCY_ADMIN cannot see margin data

---

## Dependency Graph

```
Phase 1: Data Layer
  ├── 1.1 Verify DB Connection
  ├── 1.2 Prisma Schema Changes
  ├── 1.3 Run Migration (depends on 1.1, 1.2)
  └── 1.4 Zod Schemas (depends on 1.3)

Phase 2: Calculation Logic (depends on Phase 1)
  ├── 2.1 Markup Calculations Module
  └── 2.2 Unit Tests (depends on 2.1)

Phase 3: Server Actions (depends on Phase 1, Phase 2)
  ├── 3.1 Agency Actions (depends on 1.4, 2.1)
  ├── 3.2 Staff Actions (depends on 1.4, 2.1)
  └── 3.3 Agency Portal Exclusion (depends on 3.2)

Phase 4: UI Components (depends on Phase 3)
  ├── 4.1 Agency Markup Config
  ├── 4.2 Add Staff Modal (depends on 3.2)
  ├── 4.3 Edit Staff Modal (depends on 3.2)
  ├── 4.4 Monthly Breakdown (depends on 3.1)
  ├── 4.5 Staff Detail Page (depends on 2.1)
  ├── 4.6 Agency Detail Page (depends on 2.1)
  └── 4.7 Agencies Dashboard (depends on 2.1)

Phase 5: Access Control & Testing (depends on Phase 4)
  ├── 5.1 Agency Portal Isolation
  └── 5.2 Integration Testing
```

---

## Rollback Procedure

If migration needs to be rolled back:
1. `npx prisma migrate resolve --rolled-back add-agency-markup-fields`
2. Manually drop added columns via Supabase SQL editor:
   ```sql
   ALTER TABLE agencies DROP COLUMN IF EXISTS markup_type, DROP COLUMN IF EXISTS markup_value, DROP COLUMN IF EXISTS markup_basis;
   ALTER TABLE staff DROP COLUMN IF EXISTS true_cost, DROP COLUMN IF EXISTS true_cost_rate_type, DROP COLUMN IF EXISTS markup_override_type, DROP COLUMN IF EXISTS markup_override_value, DROP COLUMN IF EXISTS rate_locked;
   ```
3. `npx prisma migrate resolve --applied` to resync migration state
4. Revert code changes on branch

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Existing agency staff queries break | Low | High | All new fields nullable/defaulted; existing queries unchanged |
| Agency portal leaks true cost data | Low | High | Explicit field exclusion in portal actions; test with AGENCY_ADMIN login |
| Rate recalculation on markup change affects live data | Medium | Medium | rate_locked prevents unwanted changes; bulk update is opt-in only |
| JSONB schema mismatch on old breakdowns | Low | Low | true_cost optional in Zod; UI shows "N/A" for missing data |
