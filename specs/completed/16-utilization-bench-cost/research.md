# Feature 16: Utilization & Bench Cost Visibility - Research & Decisions

**Created**: 2026-03-06
**Status**: Final

---

## Decision 1: Snapshot Generation Strategy

**Decision**: Hybrid approach -- scheduled weekly cron + on-demand manual trigger.

**Rationale**:
- Weekly snapshots via a Vercel Cron / Supabase Edge Function align with the existing cron patterns in the project (see `app/api/mercury/sync/cron/route.ts`, `app/api/cron/contractor-reminders/route.ts`, `app/api/cfo-strategist/nightly/route.ts`).
- The CFO Strategist nightly run already follows this pattern: an API route secured by a `CRON_SECRET` header check that performs batch computation.
- On-demand triggers allow admins to force a snapshot before a board meeting or after a staffing change, without waiting for the next scheduled run.
- Snapshots are append-only (immutable once generated), so re-triggering for the same period performs an upsert keyed on `(staff_id, period_start, period_end)`.

**Alternatives Considered**:
1. **Scheduled-only (cron)**: Simpler but prevents ad-hoc analysis. Users reported needing "now" data when making staffing decisions.
2. **On-demand-only (lazy computation)**: Eliminates cron complexity but means historical trend data only exists after someone requests it, creating gaps.
3. **Real-time materialized views**: PostgreSQL materialized views refreshed via triggers. Rejected due to constitution constraint against database triggers for business logic (must use Edge Functions).

---

## Decision 2: Utilization Calculation Approach

**Decision**: Timesheet-first with allocation fallback. A `data_source` field on each snapshot records which method was used.

**Rationale**:
- Spec 15 (Timesheets) may not be implemented yet. The Prisma schema has no `Timesheet` or `TimeEntry` models, confirming this dependency is not yet available.
- The allocation fallback uses `StaffAssignment.allocation_percentage` (with `MonthlyAllocationOverride` support via existing `allocation-utils.ts`) to estimate billable hours as `allocation_percentage / 100 * available_hours`.
- When timesheet data is present, billable hours come from approved `TimeEntry` records tagged as billable.
- The `data_source` enum (`TIMESHEET`, `ALLOCATION`, `BLENDED`) on `UtilizationSnapshot` makes the data provenance explicit, allowing dashboards to show a "data quality" indicator.

**Calculation Formula**:
```
available_hours = working_days_in_period * standard_daily_hours
billable_hours  = SUM(approved timesheet billable entries) OR (total_allocation_pct / 100 * available_hours)
non_billable_hours = SUM(approved timesheet non-billable entries) OR 0 (allocation cannot distinguish)
bench_hours     = available_hours - billable_hours - non_billable_hours
utilization_rate = billable_hours / available_hours * 100
```

**Alternatives Considered**:
1. **Allocation-only**: Simpler, but loses granularity when timesheets are available. Cannot distinguish non-billable productive work from bench time.
2. **Timesheet-required**: Blocks the feature behind Spec 15 completion. Unacceptable given business need for utilization visibility now.
3. **External time tracking integration (Harvest, Toggl)**: Out of scope per spec. Would add external dependency.

---

## Decision 3: Rate Conversion for Bench Cost

**Decision**: Reuse the existing `toMonthlyCost()` from `lib/utils/currency.ts` and add an inverse `toHourlyCost()` utility. Bench cost is always computed at hourly granularity.

**Rationale**:
- The existing `toMonthlyCost()` function already handles `HOURLY -> *176`, `DAILY -> *22`, `MONTHLY -> passthrough` conversions using 22 working days and 8-hour days.
- Bench cost formula requires hourly rate: `bench_cost = bench_hours * hourly_rate_equivalent`.
- For `MONTHLY` rate staff: `hourly_rate = monthly_rate / 176` (22 days * 8 hours).
- For `DAILY` rate staff: `hourly_rate = daily_rate / 8`.
- For `HOURLY` rate staff: passthrough.
- For `VARIABLE` rate staff: use the current `rate` field value, treating it as monthly (per spec assumption: "most recent known rate is used").
- Bench cost uses `true_cost` when available, falls back to `rate`. Bill rate is never used for bench cost (per spec).

**Conversion Constants** (matching existing `currency.ts`):
```
WORKING_DAYS_PER_MONTH = 22
STANDARD_DAILY_HOURS = 8  (configurable via UtilizationTarget.standard_daily_hours)
HOURS_PER_MONTH = 176     (22 * 8)
```

**Alternatives Considered**:
1. **Always convert to monthly then back**: Introduces unnecessary rounding. Direct hourly conversion is more precise.
2. **Use calendar days instead of working days**: Overestimates available hours. 22 working days/month is the industry standard and matches existing `currency.ts`.
3. **Use a separate rate conversion library**: Overkill. A simple `toHourlyCost()` inverse function alongside the existing `toMonthlyCost()` is sufficient.

---

## Decision 4: Dashboard Data Fetching Strategy

**Decision**: Cached snapshots for historical/trend views; on-demand calculation for "current period" metrics with short-lived server-side caching.

**Rationale**:
- Historical utilization trends (past 12 months) are served directly from `UtilizationSnapshot` records -- no recalculation needed. This matches the `ClientMetrics` snapshot pattern already in the codebase.
- The "current period" gauge/metric (org-wide utilization, current bench cost) is calculated on-demand from live assignment data because snapshots may be up to a week old.
- Server-side caching via Next.js `unstable_cache` or TanStack Query's `staleTime` (existing pattern) prevents recalculation on every page load. A 5-minute stale window balances freshness with performance.
- API routes follow the existing pattern: `app/api/` routes for reads, server actions for mutations.

**Data Flow**:
```
Dashboard Load:
  1. GET /api/utilization/current  -> on-demand calc from Staff + StaffAssignment (cached 5min)
  2. GET /api/utilization/trends   -> read from UtilizationSnapshot table (period filters)
  3. GET /api/utilization/bench    -> on-demand calc for current bench list + costs

Snapshot Generation (cron or manual):
  1. POST /api/utilization/snapshots/generate -> batch calc + insert snapshots + check alerts
```

**Alternatives Considered**:
1. **All real-time calculation**: Expensive for organizations with 100+ staff. Each dashboard load would query all assignments, timesheets, and compute rates.
2. **All snapshot-based**: Stale current-period data. Users expect to see assignment changes reflected immediately on the dashboard.
3. **WebSocket real-time**: Constitution mentions WebSocket for <200ms updates, but utilization doesn't need sub-second freshness. Polling with 5-minute cache is sufficient.

---

## Decision 5: Alert Deduplication Strategy

**Decision**: Track alert state per staff member using `last_alert_level` and `last_alert_snapshot_id` fields on `UtilizationSnapshot`. Only alert on initial threshold breach or worsening.

**Rationale**:
- The spec requires: "Duplicate alerts for the same staff member in consecutive periods are suppressed (alert only on initial threshold breach and if the situation worsens)."
- During snapshot generation, for each staff member:
  1. Look up the most recent prior snapshot for this staff member.
  2. Determine current alert level: `NONE`, `WARNING`, `CRITICAL`.
  3. Compare to prior snapshot's alert level.
  4. Generate notification only if: (a) prior level was `NONE` and current is `WARNING` or `CRITICAL`, or (b) prior level was `WARNING` and current is `CRITICAL`.
- This approach uses the snapshot data itself for deduplication rather than maintaining a separate alert tracking table, reducing schema complexity.
- Notifications use the existing `Notification` model with new `NotificationType` values: `UTILIZATION_WARNING` and `UTILIZATION_CRITICAL`.
- The `metadata` JSON field on `Notification` stores `{ staff_id, utilization_rate, threshold_breached, bench_cost }` for rich alert rendering.

**Alternatives Considered**:
1. **Separate AlertHistory table**: More normalized but adds schema complexity for a simple state comparison. The snapshot chain already provides history.
2. **Notification dedup by query**: Check if an unread notification already exists for this staff member. Fragile -- read/archived notifications would re-trigger alerts.
3. **Cooldown period (e.g., suppress for 30 days)**: Too rigid. A staff member could worsen from WARNING to CRITICAL during the cooldown and the alert would be missed.

---

## Decision 6: Integration with CFO Strategist

**Decision**: Extend the existing `staffing-analyzer.ts` to consume utilization data and generate STAFFING_EFFICIENCY recommendations enriched with bench cost impact.

**Rationale**:
- The `staffing-analyzer.ts` already identifies "low utilization" staff based on assignment count. With utilization snapshots, it can now use actual utilization rates and bench cost data for higher-confidence recommendations.
- The `CfoRecommendation` model already supports `STAFFING_EFFICIENCY` category and has `potential_savings` and `details` JSON fields -- perfect for "this bench resource costs $X/month, consider reassigning to Client Y."
- The nightly CFO Strategist run (`app/api/cfo-strategist/nightly/route.ts`) will be extended to call the utilization calculation engine as part of its analysis pass.
- No new recommendation categories needed; existing `STAFFING_EFFICIENCY` covers utilization-based recommendations.

**Data Provided to Strategist**:
```typescript
interface UtilizationContext {
  orgUtilizationRate: number;          // Current org-wide utilization
  totalBenchCost: number;              // Current period total bench cost
  benchStaff: Array<{
    staffId: string;
    name: string;
    utilizationRate: number;
    benchCost: number;
    daysOnBench: number;
    lastAssignmentEnd: Date | null;
  }>;
  utilizationTrend: TrendResult;       // Reuse existing TrendResult type
}
```

**Alternatives Considered**:
1. **New analyzer module**: Would duplicate data loading logic already in `staffing-analyzer.ts`. Extending the existing module is cleaner.
2. **Separate AI prompt chain**: Overengineered. The existing recommendation engine pattern (analyzer -> thresholds -> recommendations) works well and doesn't need a separate AI call.
3. **Real-time CFO alerts separate from snapshot alerts**: Confusing UX. A single alert system (snapshot-driven) with CFO Strategist enrichment is clearer.

---

## Additional Research Notes

### Working Days Calculation
- The existing `currency.ts` uses 22 working days/month and 8 hours/day (176 hours/month).
- For weekly snapshots, working days in a week = 5 (Monday-Friday).
- Public holidays are explicitly out of scope per the spec.
- New staff members: utilization is prorated to their actual active period within the reporting window.

### Existing Patterns to Reuse
| Pattern | Source | Reuse For |
|---------|--------|-----------|
| Snapshot model with period dates | `ClientMetrics` | `UtilizationSnapshot` structure |
| Allocation resolution with overrides | `allocation-utils.ts` | Billable hours fallback calculation |
| Rate conversion | `currency.ts` `toMonthlyCost()` | Bench cost hourly rate derivation |
| Trend computation | `trend-reporter.ts` `computeTrend()` | Utilization trend direction |
| Cron-secured API route | `cfo-strategist/nightly/route.ts` | Snapshot generation cron |
| Notification creation | `Notification` model + existing API | Utilization alerts |
| Auth pattern | `requireAuth()` + `getOrganizationId()` | All new API routes |

### Performance Considerations
- Snapshot generation for 100 staff members: single batch with `createMany` (Prisma). Expected <5s.
- Dashboard current-period calculation: parallel queries for active staff + assignments. Expected <500ms.
- Utilization trend (12 months): indexed query on `UtilizationSnapshot(staff_id, period_start)`. Expected <200ms.
- Bench report: single query with joins. Expected <300ms.
