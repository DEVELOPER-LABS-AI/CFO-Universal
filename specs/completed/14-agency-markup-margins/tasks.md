# Tasks: Agency Staff True Cost & Markup Transparency

**Feature**: 14-agency-markup-margins
**Branch**: `14-agency-markup-margins`
**Generated**: 2026-03-05

---

## User Story Mapping

| Story | Scenario | Functional Reqs | Priority |
|-------|----------|----------------|----------|
| US1 | Setting Agency-Level Markup Policy | FR-2 | P1 |
| US2 | Adding Agency Staff with True Cost | FR-1, FR-4 | P1 |
| US3 | Overriding Markup for Individual Staff | FR-3, FR-4 (rate lock) | P2 |
| US4 | Reviewing Agency Margin Dashboard | FR-5, FR-6 | P2 |
| US5 | Monthly Breakdown with Cost Transparency | FR-7 | P3 |

---

## Phase 1: Setup

- [x] T001 Verify database connection with `npx prisma migrate status` and confirm `.env` uses Supabase pooler URLs (not direct db URLs) per Constitution Principle #8

---

## Phase 2: Foundational (blocking all user stories)

### Schema & Migration

- [x] T002 Add `MarkupType` enum (PERCENTAGE, FLAT_RATE) and `MarkupBasis` enum (BASE_PAY, TOTAL_COMPENSATION) to `prisma/schema.prisma`
- [x] T003 Add markup fields (`markup_type MarkupType?`, `markup_value Decimal? @db.Decimal(10, 2)`, `markup_basis MarkupBasis?`) to Agency model in `prisma/schema.prisma`
- [x] T004 Add true cost and markup override fields (`true_cost Decimal? @db.Decimal(10, 2)`, `true_cost_rate_type RateType?`, `markup_override_type MarkupType?`, `markup_override_value Decimal? @db.Decimal(10, 2)`, `rate_locked Boolean @default(false)`) to Staff model in `prisma/schema.prisma`
- [x] T005 Run Prisma migration (`npx prisma migrate dev --name add-agency-markup-fields`) and regenerate client (`npx prisma generate`)

### Validation Schemas

- [x] T006 [P] Extend agency Zod schemas in `lib/validations/agency.ts`: add `markup_type`, `markup_value`, `markup_basis` to `createAgencySchema`/`updateAgencySchema` with cross-field refinement (markup_type required when markup_value is set); add optional `true_cost` field (number >= 0) to `staffBreakdownItemSchema`
- [x] T007 [P] Extend staff Zod schemas in `lib/validations/staff.ts`: add `true_cost`, `true_cost_rate_type`, `markup_override_type`, `markup_override_value`, `rate_locked` to `createStaffSchema`/`updateStaffSchema` with refinement (true_cost required when engagement_type === 'AGENCY' on create; markup_override_type required when markup_override_value is set)

### Calculation Utilities

- [x] T008 [P] Create markup calculation module `lib/calculations/markup-calculations.ts` with three functions: `calculateBillRate(trueCost, trueCostRateType, markupType, markupValue, markupBasis, expenses?, reimbursements?)` returning `{ billRate, billRateType }`; `calculateMargin(billRate, billRateType, trueCost, trueCostRateType)` returning `{ marginDollar, marginPercentage, isNegative }`; `getEffectiveMarkup(staff, agency)` returning `{ markupType, markupValue, markupBasis, source, rateLocked }`. Use existing `toMonthlyCost()` from `lib/utils/currency.ts` for rate conversions (176 hrs/mo, 22 days/mo)
- [x] T009 Create unit tests in `lib/calculations/__tests__/markup-calculations.test.ts` covering: percentage markup on base pay, percentage on total compensation, flat rate markup, rate type conversions (hourly true cost → monthly bill rate), zero markup, negative margin detection, null true cost handling, getEffectiveMarkup priority (staff override > agency default > none), and rate lock behavior

---

## Phase 3: US1 — Agency-Level Markup Configuration

**Story Goal**: Platform owner can set a default markup rule (type, value, basis) on an agency that auto-applies to new staff.

**Independent Test**: Create/update an agency with markup config → verify fields persist and display correctly.

### Server Action

- [x] T010 [US1] Extend `updateAgency()` in `app/actions/agency-management.ts` to accept and validate `markup_type`, `markup_value`, `markup_basis` using the extended `updateAgencySchema`; ensure cross-field validation (all three null or all three set; markup_value >= 0); persist to database

### UI Component

- [x] T011 [US1] Add markup configuration section to `components/agencies/EditAgencyModal.tsx`: Markup Type select (Percentage / Flat Rate / None), Markup Value number input (conditional on type), Markup Basis select (Base Pay Only / Total Compensation, conditional on type), and a preview label (e.g., "30% markup on base pay"). When "None" is selected, clear all markup fields to null

---

## Phase 4: US2 — Adding Agency Staff with True Cost

**Story Goal**: When adding agency staff, capture true cost and auto-calculate the bill rate from markup.

**Independent Test**: Add new agency staff with true cost → verify bill rate auto-calculated → verify both values stored.

### Server Action

- [x] T012 [US2] Extend `createStaff()` in `app/actions/staff-management.ts` to accept `true_cost`, `true_cost_rate_type`, `markup_override_type`, `markup_override_value`, `rate_locked`; when `engagement_type === 'AGENCY'` and `rate_locked === false`, fetch agency markup config via `getEffectiveMarkup()` and auto-calculate `rate` using `calculateBillRate()`; strip true cost fields for non-agency staff

### UI Component

- [x] T013 [US2] Add true cost section to `components/staff/AddStaffModal.tsx` (conditional on `association === 'agency'`): "True Cost" number input (required), "True Cost Rate Type" select (HOURLY/DAILY/MONTHLY), computed bill rate preview using agency markup, optional "Lock Rate" toggle (default off), and optional expandable "Override Markup" section with type/value inputs. Pass new fields to `createStaff()` action

---

## Phase 5: US3 — Staff Markup Override & Rate Lock

**Story Goal**: Edit existing agency staff to override markup or lock the bill rate independently.

**Independent Test**: Edit agency staff → set markup override → verify bill rate recalculates; toggle rate lock → change markup → verify rate unchanged.

### Server Action

- [x] T014 [US3] Extend `updateStaff()` in `app/actions/staff-management.ts` to handle `true_cost`, `true_cost_rate_type`, `markup_override_type`, `markup_override_value`, `rate_locked` updates; when `rate_locked` changes from true→false, recalculate rate from current true_cost + effective markup; when true_cost or markup changes and rate is not locked, recalculate rate; use `getEffectiveMarkup()` and `calculateBillRate()` from markup-calculations module

### UI Component

- [x] T015 [US3] Add true cost editing, markup override, and rate lock to `components/staff/EditStaffModal.tsx` for agency staff: pre-populate "True Cost" and "True Cost Rate Type" from staff record (empty for existing staff without data), "Rate Lock" toggle with lock icon indicator, expandable "Override Markup" section showing type/value and indicating "Agency Default" vs "Staff Override" source badge, computed margin display ($ and %) when true cost is available, and negative margin warning

---

## Phase 6: US4 — Margin Visibility Dashboards

**Story Goal**: View margin metrics at staff detail, agency detail, and aggregate agency dashboard levels.

**Independent Test**: Navigate to each dashboard level → verify margin data displays correctly for staff with true cost and shows "N/A" for staff without.

### Dashboard Pages

- [x] T016 [P] [US4] Add margin display card to `app/dashboard/staff/[id]/page.tsx` for agency staff: show Monthly Margin ($ and %), markup source badge ("Agency Default" / "Staff Override" / "Locked Rate"), and negative margin warning indicator using `calculateMargin()` from markup-calculations; show "N/A" when true_cost is null; hide entirely for non-agency staff
- [x] T017 [P] [US4] Add per-staff margin breakdown to `app/dashboard/agencies/[id]/page.tsx`: extend staff table with True Cost, Bill Rate, Margin ($), Margin (%) columns; show "N/A" for staff without true cost; add agency summary card with Total True Cost, Total Billed, Total Margin ($), Avg Margin (%) computed from active non-deleted staff with true cost data
- [x] T018 [P] [US4] Add aggregate margin metrics to `app/dashboard/agencies/page.tsx`: add "Total True Cost" card (monthly sum of all agency staff true costs), "Total Margin" card (total billed - total true cost, $ amount), "Avg Margin %" card (weighted average); per-agency cards should show margin % alongside existing metrics; exclude staff without true cost from calculations

---

## Phase 7: US5 — Enhanced Monthly Breakdowns

**Story Goal**: Monthly agency breakdowns include true cost per staff line item with margin visibility.

**Independent Test**: Create monthly breakdown → verify true cost column present → verify margin calculations per line item and in totals.

### Server Action

- [x] T019 [US5] Extend `createAgencyMonthlyBreakdown()` in `app/actions/agency-management.ts` to accept optional `true_cost` per staff breakdown item (using extended `staffBreakdownItemSchema`); add `true_cost_total`, `margin_total`, `margin_percentage` to response summary; historical breakdowns preserve true_cost snapshot at creation time

### UI Component

- [x] T020 [US5] Add true_cost and margin columns to `components/agencies/AddBreakdownModal.tsx`: pre-populate "True Cost" column from staff record's true_cost field, add computed "Margin" column (base_pay - true_cost per line item), add totals row showing total true cost, total billed, total margin ($) and margin (%); show "—" for staff without true cost data

---

## Phase 8: Polish & Cross-Cutting Concerns

### Access Control

- [x] T021 [P] Verify and enforce agency portal data exclusion in `app/actions/agency-portal-actions.ts`: ensure `getAgencyStaff()` and any other agency portal actions do NOT return `true_cost`, `true_cost_rate_type`, `markup_override_type`, `markup_override_value`, or `rate_locked` fields; add explicit `select` or field omission if needed
- [x] T022 [P] Verify agency portal UI pages (`app/agency-portal/`) do not display true cost, markup configuration, or margin data; confirm only the bill rate (`rate`) is visible to AGENCY_ADMIN users

---

## Dependencies

```
T001 → T002 → T003 + T004 → T005 → T006 + T007 + T008 (parallel) → T009

T006 + T008 → T010 → T011
                              } US1 complete

T007 + T008 → T012 → T013
                              } US2 complete

T012 → T014 → T015
                              } US3 complete (depends on US2 action)

T008 → T016 + T017 + T018 (all parallel)
                              } US4 complete

T006 → T019 → T020
                              } US5 complete

T014 → T021 + T022 (parallel)
                              } Access control complete
```

### Story Independence

| Story | Can start after | Independent test? |
|-------|----------------|-------------------|
| US1 | Phase 2 complete | Yes — agency markup config standalone |
| US2 | Phase 2 complete | Yes — add staff with true cost standalone |
| US3 | US2 server action (T012) | Partial — needs createStaff to have test data |
| US4 | Phase 2 complete (T008) | Yes — read-only display of existing data |
| US5 | Phase 2 complete (T006) | Yes — breakdown form standalone |

**US1 and US2 can run in parallel** after Phase 2.
**US4 can run in parallel** with US1/US2/US3 (read-only, only needs calculation utils).
**US5 can run in parallel** with US1/US2 (only needs Zod schema updates).

---

## Parallel Execution Examples

### Maximum parallelism after Phase 2:

```
Agent A: T010 → T011 (US1: Agency Markup Config)
Agent B: T012 → T013 (US2: Add Staff True Cost)
Agent C: T016 + T017 + T018 (US4: Dashboards — all parallel)
Agent D: T019 → T020 (US5: Monthly Breakdowns)

Then sequential:
Agent A or B: T014 → T015 (US3: depends on T012)
Finally: T021 + T022 (parallel, Access Control)
```

### Within Phase 2:

```
After T005 (migration):
  Agent A: T006 (agency Zod)
  Agent B: T007 (staff Zod)
  Agent C: T008 (calculation utils)
Then: T009 (tests, depends on T008)
```

---

## Implementation Strategy

### MVP Scope (Recommended)
**US1 + US2**: Agency markup configuration + staff true cost capture with auto-calculated bill rate. This delivers the core value — cost transparency — without the dashboard and override features.

### Incremental Delivery Order
1. **Phase 1-2**: Foundation (schema, validation, calculations) — required for everything
2. **US1 + US2**: Core markup and true cost — the minimum viable feature
3. **US3**: Markup overrides and rate lock — power user feature
4. **US4**: Margin dashboards — visibility and reporting
5. **US5**: Enhanced breakdowns — historical margin tracking
6. **Phase 8**: Access control verification — security hardening

### Total Tasks: 22
| Phase | Tasks | Parallelizable |
|-------|-------|---------------|
| Setup | 1 | — |
| Foundational | 8 | T006, T007, T008 (3 parallel) |
| US1 | 2 | — |
| US2 | 2 | — |
| US3 | 2 | — |
| US4 | 3 | T016, T017, T018 (3 parallel) |
| US5 | 2 | — |
| Polish | 2 | T021, T022 (2 parallel) |
