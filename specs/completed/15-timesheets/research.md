# Feature 15: Timesheets & Time Tracking - Research & Decisions

**Status**: Finalized
**Created**: 2026-03-06
**Spec Reference**: specs/15-timesheets/spec.md

---

## Decision 1: Timesheet Data Model Approach

### Decision

Use a **two-table design**: a parent `Timesheet` table (weekly submission header) and a child `TimeEntry` table (individual hour records per day per assignment).

### Rationale

1. **Separation of concerns**: The Timesheet represents the submission/approval unit (lifecycle, status, reviewer), while TimeEntry represents the granular work data (hours, date, assignment, description). These have different access patterns and update frequencies.
2. **Approval atomicity**: The approval workflow operates on the entire Timesheet, not individual entries. A single-table design would require grouping logic at the application layer for every approval operation.
3. **Query efficiency**: Common queries (approval queue, staff history, billing summaries) primarily need Timesheet-level data. Entry-level queries (daily breakdown, assignment detail) are secondary and benefit from a separate indexed table.
4. **Consistency with existing patterns**: The `ContractorInvoice` + `ContractorInvoiceLineItem` pattern already establishes a header + line-items convention in this codebase.
5. **Validation isolation**: Day-level constraints (max 24h per day, date within period) and week-level constraints (one per staff per week, status transitions) are cleanly separated.

### Alternatives Considered

| Alternative | Pros | Cons |
|---|---|---|
| **Single denormalized table** | Fewer joins, simpler queries for small datasets | No natural grouping for approval; redundant status/reviewer columns per row; harder to enforce one-submission-per-week constraint |
| **Three-table design** (Timesheet + TimesheetDay + TimeEntry) | Explicit day-level aggregation | Over-normalized for this use case; daily totals can be computed from entries; adds complexity with minimal benefit |
| **JSONB entries on Timesheet** | Single table, flexible schema | Loses referential integrity to StaffAssignment/Project; no indexing on entry fields; harder to query for billing reports |

---

## Decision 2: Overtime Calculation Strategy

### Decision

Use a **post-hoc proportional distribution** approach: calculate overtime at the weekly Timesheet level, then distribute overtime hours proportionally across assignments based on each assignment's share of total regular hours.

### Algorithm

```
1. Sum all billable hours for the week across all entries
2. If total > overtime_threshold:
     overtime_hours = total - threshold
     regular_hours = threshold
3. For each assignment:
     assignment_share = assignment_hours / total_hours
     assignment_regular = regular_hours * assignment_share
     assignment_overtime = overtime_hours * assignment_share
4. Billing per assignment:
     billable = (assignment_regular * rate) + (assignment_overtime * rate * multiplier)
```

### Rationale

1. **Spec compliance**: The spec explicitly states "overtime hours are split across assignments in proportion to regular hours logged per client that week."
2. **Fairness**: Proportional distribution ensures no single client bears the full cost of overtime when a staff member works across multiple clients.
3. **Simplicity**: The calculation is deterministic and requires no configuration beyond the threshold and multiplier. No need to track which hours were "first" vs "overtime."
4. **Calculation timing**: Overtime is calculated at submission/approval time, not during individual entry saves. This avoids recalculating on every entry change and ensures consistency with the approved total.

### Alternatives Considered

| Alternative | Pros | Cons |
|---|---|---|
| **First-in-first-out (FIFO)** — overtime applied to last-entered assignments | Simple mental model for staff | Penalizes whichever client's hours are entered last; order-dependent; unfair |
| **Admin-assigned overtime** — manual allocation of OT hours per assignment | Maximum flexibility | Labor-intensive; defeats automation; blocks approval workflow |
| **Per-day overtime** (daily threshold, e.g., >8h/day) | Catches long single days | Spec defines weekly threshold only; daily OT is out of scope for v1 |
| **Weighted by bill rate** — higher-rate assignments absorb more OT | Could optimize revenue | Adds complexity; not requested; could appear unfair to higher-rate clients |

---

## Decision 3: Approval Workflow Pattern

### Decision

**Reuse the ContractorInvoice approval pattern** (DRAFT -> SUBMITTED -> APPROVED | REJECTED -> resubmit) but with a **dedicated TimesheetStatus enum** and timesheet-specific fields.

### Rationale

1. **Proven UX**: The ContractorInvoice workflow (spec 6) is already battle-tested in this codebase with the same status lifecycle: DRAFT -> SUBMITTED -> APPROVED/REJECTED.
2. **Structural similarity**: Both features share: a submission unit, a submitter (staff/contractor), a reviewer (admin), timestamps for each transition, a rejection reason field, and read-only locking on submission.
3. **Dedicated enum**: Use `TimesheetStatus` (not `InvoiceStatus`) because timesheets do not need the `PAID` status. Keeping a separate enum avoids confusion and allows future divergence (e.g., adding `RECALLED` for timesheets).
4. **Pattern reuse, not code reuse**: The implementation pattern (Zod schemas for submit/review, server actions for transitions, notification triggers) will mirror ContractorInvoice, but the actual code will be independent. No shared abstract class needed.

### What to reuse from ContractorInvoice

| Aspect | Reuse Pattern | Adapt For Timesheets |
|---|---|---|
| Status lifecycle | DRAFT -> SUBMITTED -> APPROVED/REJECTED | Same flow, no PAID status |
| Zod validation (submit/review) | `reviewContractorInvoiceSchema` pattern | `reviewTimesheetSchema` with min 10 char rejection reason |
| Server action structure | `contractor-portal-actions.ts` | `timesheet-actions.ts` + `timesheet-admin-actions.ts` |
| Notification triggers | On approve/reject | Same, with `TIMESHEET_APPROVED` / `TIMESHEET_REJECTED` types |
| Reviewer tracking | `reviewed_by`, `reviewed_at` | Same fields on Timesheet model |

### Alternatives Considered

| Alternative | Pros | Cons |
|---|---|---|
| **Share InvoiceStatus enum** | One less enum | Timesheet doesn't need PAID; enum changes would affect both features |
| **Generic approval engine** (polymorphic) | DRY for future features | Over-engineering for two features; harder to debug; abstraction tax |
| **Multi-level approval** | Supports manager -> director chains | Not requested in spec; adds complexity; can be added later |

---

## Decision 4: Rate Snapshot Strategy

### Decision

**Use the staff's current rate at query/calculation time** -- do NOT snapshot rates into the Timesheet or TimeEntry records.

### Rationale

1. **Spec alignment**: The spec states "Calculations use the staff member's current bill rate at the time of the timesheet period." This means reading from `Staff.rate` at billing calculation time, not embedding a frozen rate.
2. **Consistency with existing system**: The existing cost allocation system (`lib/calculations/`) reads `Staff.rate` and `Staff.rate_type` dynamically. Timesheet billing should follow the same pattern for consistency.
3. **Rate changes are rare**: Staff rates change infrequently (quarterly or annually). The risk of a rate change mid-billing-cycle is low, and when it occurs, the correct behavior is to use the current rate.
4. **Simpler schema**: Avoids duplicating `rate`, `rate_type`, `true_cost`, `markup` fields onto every Timesheet record.
5. **Future-proofing**: If rate history tracking is needed later (FR for rate-effective-dating), it should be a dedicated `StaffRateHistory` table, not embedded in timesheets.

### Safeguard

When generating billing reports for past periods, the system should log a warning if a staff member's rate has changed since the timesheet period. This is an informational alert, not a blocker.

### Alternatives Considered

| Alternative | Pros | Cons |
|---|---|---|
| **Snapshot rate on Timesheet** | Immutable billing record; audit-friendly | Duplicates data; schema bloat; what happens when rate is corrected retroactively? |
| **Snapshot rate on TimeEntry** | Most granular; handles mid-week rate changes | Massive data duplication; 7+ entries per week per staff; rate never changes mid-week |
| **Rate history table + lookup** | Best of both worlds; accurate historical rates | Significant additional complexity; not requested; no `StaffRateHistory` model exists yet |

---

## Decision 5: Billing Calculation Integration Point

### Decision

Implement billing calculations as a **dedicated calculation module** (`lib/calculations/timesheet-billing.ts`) that is invoked on-demand when viewing billing summaries or generating reports. Do NOT store pre-computed billing amounts on the Timesheet record.

### Rationale

1. **Consistency**: All existing billing/cost calculations in `lib/calculations/` are computed on-demand (e.g., `agency-costs.ts`, `expected-revenue.ts`, `markup-calculations.ts`). Timesheets should follow this established pattern.
2. **Rate change tolerance**: Since rates are read dynamically (Decision 4), pre-computed billing amounts would become stale if a rate is corrected. On-demand calculation always reflects current data.
3. **Separation of concerns**: The Timesheet model stores hours (the "what happened"). Billing amounts are derived data ("what to charge"). Keeping these separate is cleaner.
4. **Overtime coupling**: Billing calculations depend on `OvertimeConfig`, which can be changed by admins at any time. Pre-computed amounts would need invalidation logic.

### Integration Points

| Consumer | How It Calls Billing Calc | When |
|---|---|---|
| Admin dashboard | `calculateTimesheetBilling(timesheet)` | On page load / filter change |
| Billing summary report | `calculatePeriodBilling(orgId, startDate, endDate)` | On report generation |
| Agency portal | `calculateAgencyStaffBilling(agencyId, period)` | Agency views approved hours |
| CSV export | `calculateTimesheetBilling(timesheet)` per row | On export |

### Module Signature

```typescript
// lib/calculations/timesheet-billing.ts
interface TimesheetBillingResult {
  totalBillable: number;
  totalNonBillable: number;
  totalOvertime: number;
  regularAmount: number;
  overtimeAmount: number;
  totalAmount: number;
  byAssignment: AssignmentBillingBreakdown[];
}

function calculateTimesheetBilling(
  timesheet: TimesheetWithEntries,
  staffRate: StaffRateInfo,
  overtimeConfig: OvertimeConfigData | null
): TimesheetBillingResult;
```

### Alternatives Considered

| Alternative | Pros | Cons |
|---|---|---|
| **Store billing amounts on Timesheet** | Fast reads; no recalculation | Stale data on rate/config changes; requires invalidation triggers; breaks pattern |
| **Materialized view** | DB-level caching; auto-refresh | Supabase materialized views are manual refresh; adds DB complexity |
| **Billing snapshot on approval** | Captures point-in-time billing | Requires re-approval if rate is corrected; contradicts Decision 4 |

---

## Summary of Decisions

| # | Decision Area | Choice | Key Driver |
|---|---|---|---|
| 1 | Data model | Two tables (Timesheet + TimeEntry) | Separation of concerns, existing pattern |
| 2 | Overtime calculation | Proportional distribution, weekly | Spec requirement, fairness |
| 3 | Approval workflow | Reuse ContractorInvoice pattern, new enum | Proven UX, structural fit |
| 4 | Rate snapshot | No snapshot, read current rate | Spec wording, existing pattern, simplicity |
| 5 | Billing integration | On-demand calculation module | Consistency with lib/calculations/, rate tolerance |
