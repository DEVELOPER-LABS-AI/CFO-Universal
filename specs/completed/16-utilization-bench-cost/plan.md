# Feature 16: Utilization & Bench Cost Visibility - Implementation Plan

**Created**: 2026-03-06
**Branch**: `16-utilization-bench-cost`
**Spec**: `specs/16-utilization-bench-cost/spec.md`
**Status**: Ready for Implementation

---

## Technical Context

### Stack (from Constitution v1.1.0)
- **Database**: Supabase PostgreSQL 15+ with Prisma ORM
- **Frontend**: Next.js 15 App Router, React 19, Tailwind CSS, shadcn/ui
- **Charts**: Recharts for financial visualizations
- **Backend**: Next.js API Routes for reads, Server Actions for mutations
- **Validation**: Zod schemas on all inputs
- **Auth**: Supabase Auth with `requireAuth()` + `getOrganizationId()` pattern

### Key Existing Models
- `Staff`: id, organization_id, name, staff_type (dynamic string), rate, rate_type (HOURLY/DAILY/MONTHLY/VARIABLE), true_cost, true_cost_rate_type, engagement_type (FULL_TIME/PART_TIME/PROJECT/OWNER/AGENCY), status (ACTIVE/TERMINATED)
- `StaffAssignment`: id, staff_id, client_id, allocation_percentage, start_date, end_date
- `MonthlyAllocationOverride`: assignment_id, month, year, allocation_percentage
- `ClientMetrics`: snapshot pattern with period_start/period_end (reference for UtilizationSnapshot)
- `Notification`: organization_id, user_id, type (NotificationType), priority, status, title, message, metadata (JSON)
- `StaffRole`: dynamic staff type configuration per organization

### Key Existing Utilities
- `lib/utils/currency.ts`: `toMonthlyCost(rate, rateType)` -- 22 working days, 8 hours/day, 176 hours/month
- `lib/calculations/allocation-utils.ts`: `getEffectiveAllocationsForMonth()`, `resolveAllocation()` -- handles MonthlyAllocationOverride
- `lib/calculations/trend-reporter.ts`: `computeTrend()`, `buildPeriodWindow()` -- MoM trend computation
- `lib/calculations/agency-costs.ts`: Rate conversion and allocation-based cost attribution patterns
- `lib/cfo-strategist/analyzers/staffing-analyzer.ts`: Existing staffing efficiency analysis
- `app/api/cfo-strategist/nightly/route.ts`: Cron-secured batch processing pattern
- `app/api/notifications/route.ts`: Notification listing with auth pattern

### Dependency Status
- **Spec 15 (Timesheets)**: NOT YET IMPLEMENTED. No `Timesheet` or `TimeEntry` models in schema. Feature must work with allocation fallback only, and be designed to adopt timesheet data when available.
- **Spec 14 (Agency Markup)**: IN PROGRESS. `true_cost` and `true_cost_rate_type` fields exist on `Staff` model. Bench cost calculation can use these fields.
- **Spec 3 (Staff Management)**: IMPLEMENTED. All staff models, assignments, and roles available.
- **Notification System**: IMPLEMENTED. Full model and API routes available.

---

## Constitution Check

| Requirement | Status | Notes |
|-------------|--------|-------|
| Supabase PostgreSQL 15+ with Prisma | COMPLIANT | New models follow existing Prisma patterns |
| Multi-tenancy (organization_id + RLS) | COMPLIANT | Both new models scoped by organization_id |
| UUIDs for PKs | COMPLIANT | `@id @default(uuid())` on all new models |
| Soft deletes (deleted_at) | COMPLIANT | UtilizationTarget has deleted_at; Snapshots are immutable (no delete) |
| created_at/updated_at timestamps | COMPLIANT | Both models include standard timestamps |
| Zod validation on inputs | COMPLIANT | Validation schemas defined in data-model.md |
| Pooler URLs for DB connection | COMPLIANT | No direct DB URL usage |
| Verify DB connection before schema changes | COMPLIANT | Phase 1 starts with `npx prisma migrate status` |
| Server Actions for mutations | COMPLIANT | Target configuration uses server action |
| API Routes for reads | COMPLIANT | All GET endpoints are API routes |
| TypeScript strict mode, no implicit any | COMPLIANT | All interfaces fully typed |
| @@map annotations | COMPLIANT | `utilization_snapshots`, `utilization_targets` |
| Index on foreign keys | COMPLIANT | Indexes defined in data-model.md |

---

## Implementation Phases

### Phase 1: Schema & Migration

**Objective**: Add new database models and enum values.

**Pre-flight**:
1. Verify database connection: `npx prisma migrate status`
2. Verify `.env` has correct pooler URLs

**Tasks**:
1. Add `UtilizationDataSource` enum to `prisma/schema.prisma`
2. Add `UTILIZATION_WARNING` and `UTILIZATION_CRITICAL` to `NotificationType` enum
3. Add `UtilizationSnapshot` model to `prisma/schema.prisma`
4. Add `UtilizationTarget` model to `prisma/schema.prisma`
5. Add `utilization_snapshots` relation to `Organization` model
6. Add `utilization_targets` relation to `Organization` model
7. Add `utilization_snapshots` relation to `Staff` model
8. Run `npx prisma migrate dev --name add_utilization_tracking`
9. Run `npx prisma generate`
10. Verify migration applied: `npx prisma migrate status`

**Acceptance Criteria**:
- [ ] Migration applies without errors
- [ ] `npx prisma generate` completes successfully
- [ ] New models visible in Prisma Client types
- [ ] Unique constraint `(staff_id, period_start, period_end)` enforced on UtilizationSnapshot
- [ ] Unique constraint `(organization_id, staff_type)` enforced on UtilizationTarget

**Rollback**: `npx prisma migrate resolve --rolled-back add_utilization_tracking`

---

### Phase 2: Calculation Engine

**Objective**: Build pure calculation functions for utilization rate, bench cost, and rate conversion.

**Tasks**:

1. **Extend `lib/utils/currency.ts`**: Add `toHourlyCost(rate, rateType)` inverse function
   - HOURLY: passthrough
   - DAILY: rate / 8
   - MONTHLY: rate / 176
   - VARIABLE: treat as MONTHLY (rate / 176)

2. **Create `lib/calculations/utilization.ts`**:
   - `calculateAvailableHours(workingDays: number, dailyHours: number): number`
   - `calculateUtilizationRate(billableHours: number, availableHours: number): number`
   - `calculateBillableHoursFromAllocation(allocationPct: number, availableHours: number): number`
   - `getWorkingDaysInPeriod(start: Date, end: Date): number` -- count weekdays
   - `getStaffUtilization(staffId, periodStart, periodEnd, orgId)` -- orchestrator function
   - `getOrganizationUtilization(orgId, periodStart, periodEnd)` -- weighted average across staff

3. **Create `lib/calculations/bench-cost.ts`**:
   - `calculateBenchHours(availableHours, billableHours, nonBillableHours): number`
   - `calculateBenchCost(benchHours, hourlyCostRate): number`
   - `resolveStaffHourlyCost(staff: { rate, rate_type, true_cost, true_cost_rate_type }): { hourlyRate: number, source: 'true_cost' | 'rate' }`
   - `calculateStaffBenchCost(staffId, periodStart, periodEnd, orgId)` -- full bench cost for a staff member

4. **Create `lib/calculations/utilization-targets.ts`**:
   - `resolveEffectiveTarget(orgId, staffType): Promise<EffectiveTarget>`
   - `classifyUtilizationStatus(rate, target): 'on_target' | 'warning' | 'critical'`
   - System fallback constants: `DEFAULT_TARGET_RATE = 80`, `DEFAULT_WARNING = 70`, `DEFAULT_CRITICAL = 50`

5. **Create `lib/validations/utilization.ts`**: Zod schemas for all inputs

6. **Write unit tests**: `lib/calculations/__tests__/utilization.test.ts`, `bench-cost.test.ts`, `utilization-targets.test.ts`

**Acceptance Criteria**:
- [ ] `toHourlyCost()` correctly converts all rate types
- [ ] Utilization rate = billable / available * 100, capped at 0-100
- [ ] Bench hours = available - billable - non_billable (never negative)
- [ ] Bench cost uses true_cost when available, falls back to rate
- [ ] OWNER engagement type excluded from calculations
- [ ] Target resolution follows priority chain: staff_type override > org default > system fallback
- [ ] All unit tests pass

---

### Phase 3: Snapshot Generation

**Objective**: Build the batch process that generates UtilizationSnapshot records and checks alert thresholds.

**Tasks**:

1. **Create `lib/utilization/snapshot-generator.ts`**:
   - `generateSnapshots(orgId, periodStart, periodEnd, force?): Promise<GenerationResult>`
   - Fetches all eligible staff (ACTIVE, non-OWNER engagement types)
   - For each staff member:
     a. Resolve effective target (for standard_daily_hours)
     b. Calculate working days in period
     c. Calculate available hours
     d. Attempt to load timesheet data (if Spec 15 exists); fall back to allocation
     e. Calculate billable hours, non-billable hours, bench hours
     f. Calculate utilization rate and bench cost
     g. Determine alert level based on target thresholds
   - Uses Prisma `createMany` with `skipDuplicates: true` (or upsert loop for update semantics when `force=true`)
   - Returns count of generated, skipped, and errored snapshots

2. **Create `lib/utilization/alert-generator.ts`**:
   - `generateAlerts(orgId, snapshots, periodStart, periodEnd): Promise<number>`
   - For each snapshot with an alert_level:
     a. Load the most recent prior snapshot for the same staff member
     b. Compare alert levels
     c. Create notification only if: new breach or worsened
   - Uses existing `Notification` model with `UTILIZATION_WARNING` or `UTILIZATION_CRITICAL` type
   - Notification metadata: `{ staff_id, staff_name, utilization_rate, threshold_breached, bench_cost, period_start, period_end }`
   - Sets `action_url` to staff detail page: `/staff/${staffId}?tab=utilization`

3. **Create `app/api/utilization/snapshots/generate/route.ts`**:
   - POST handler secured by `CRON_SECRET` header (for cron) OR `requireAuth()` with ADMIN/EXECUTIVE role (for manual)
   - Accepts `period_type`, optional `period_start`/`period_end`, `force` flag
   - Calls `generateSnapshots()` then `generateAlerts()`
   - Returns generation summary

**Acceptance Criteria**:
- [ ] Snapshot generation processes all eligible staff (excludes OWNER, TERMINATED)
- [ ] Each snapshot has correct available_hours, billable_hours, bench_hours, utilization_rate, bench_cost
- [ ] Duplicate snapshots prevented by unique constraint (upsert when force=true)
- [ ] Alerts generated only for initial threshold breach or worsening
- [ ] Alerts not generated for staff already below threshold in consecutive periods (same level)
- [ ] CRON_SECRET auth works for scheduled runs
- [ ] Manual trigger requires ADMIN/EXECUTIVE role

---

### Phase 4: API Routes

**Objective**: Implement all read API endpoints.

**Tasks**:

1. **`GET /api/utilization/current`**: On-demand current-period calculation
   - Query active staff with eligible engagement types
   - Calculate per-staff utilization using calculation engine
   - Aggregate org-wide weighted average
   - Include current assignments for each staff member
   - Apply 5-minute server-side caching

2. **`GET /api/utilization/trends`**: Historical from snapshots
   - Query UtilizationSnapshot with period filters
   - Aggregate org-wide averages per period
   - Compute trend using `computeTrend()` from trend-reporter.ts
   - Support staff_id filter for individual trends

3. **`GET /api/utilization/staff/[staffId]`**: Individual detail
   - Current period on-demand calculation
   - Historical snapshots for trend
   - Assignment list with gaps
   - Bench duration calculation (consecutive days without billable assignment)

4. **`GET /api/utilization/snapshots`**: Raw snapshot listing with pagination

5. **`GET /api/utilization/bench`**: Bench report
   - Filter staff below target utilization
   - Include cost impact details
   - Support sorting and filtering
   - Include summary totals

6. **`GET /api/utilization/bench/trends`**: Bench cost historical trends

7. **`GET /api/utilization/bench/export`**: CSV export
   - Stream CSV response with appropriate headers

8. **`GET /api/utilization/targets`**: List targets
   - Include available staff types from StaffRole table

9. **`POST /api/utilization/targets`**: Create/upsert target (server action wrapper)

10. **`PUT /api/utilization/targets/[targetId]`**: Update target

11. **`DELETE /api/utilization/targets/[targetId]`**: Soft-delete target

12. **Create `app/actions/utilization-targets.ts`**: Server action for target mutations

**Acceptance Criteria**:
- [ ] All endpoints require authentication
- [ ] All data scoped to organization_id
- [ ] Bench report and org-wide dashboard restricted to ADMIN/EXECUTIVE
- [ ] Staff can view their own utilization via staff detail endpoint
- [ ] Agency admins can view only their agency's staff
- [ ] Pagination works correctly on snapshot listing
- [ ] CSV export generates valid CSV with correct headers
- [ ] Zod validation on all mutation inputs
- [ ] Error responses follow existing patterns

---

### Phase 5: Utilization Dashboard UI

**Objective**: Build the main utilization dashboard page.

**Page**: `app/(dashboard)/utilization/page.tsx`

**Tasks**:

1. **Create `components/utilization/utilization-gauge.tsx`**:
   - Circular gauge (Recharts RadialBarChart or custom SVG)
   - Shows org-wide utilization rate
   - Color-coded: green (at/above target), yellow (warning), red (critical)
   - Displays target line

2. **Create `components/utilization/bench-cost-card.tsx`**:
   - Summary card showing total bench cost
   - Bench headcount
   - Bench cost as % of payroll
   - MoM trend indicator (up/down arrow with color)

3. **Create `components/utilization/staff-utilization-table.tsx`**:
   - Sortable table with columns: Name, Type, Engagement, Rate, Utilization %, Status, Bench Cost
   - Color-coded status badge (green/yellow/red)
   - Filterable by staff_type, engagement_type, status
   - Click row to navigate to staff detail
   - Uses shadcn/ui DataTable pattern

4. **Create `components/utilization/utilization-trend-chart.tsx`**:
   - Recharts LineChart showing utilization rate over time
   - Optional overlay: bench cost as secondary axis
   - 12-month default view
   - Target line overlay
   - Tooltip with period details

5. **Create `components/utilization/status-badge.tsx`**:
   - Reusable badge component for on_target/warning/critical
   - Uses Tailwind color classes

6. **Assemble dashboard page**:
   - Layout: gauge + bench cost card (top row), trend chart (mid), staff table (bottom)
   - Period selector (month/year picker)
   - Loading skeletons for async data
   - Error boundary

**Acceptance Criteria**:
- [ ] Dashboard loads within 2 seconds
- [ ] Utilization gauge accurately reflects org-wide rate
- [ ] Bench cost card shows current period total
- [ ] Staff table is sortable and filterable
- [ ] Trend chart shows 12 months of data
- [ ] Color-coded status indicators match configured thresholds
- [ ] Responsive layout (desktop + tablet)

---

### Phase 6: Bench Report UI

**Objective**: Build the focused bench report page.

**Page**: `app/(dashboard)/utilization/bench/page.tsx`

**Tasks**:

1. **Create `components/utilization/bench-staff-table.tsx`**:
   - Columns: Name, Type, Agency, Utilization %, Bench Hours, Bench Cost, Days on Bench, Last Assignment
   - Default sort: bench cost descending
   - Filter by staff_type, engagement_type
   - Row actions: view staff detail, view assignments

2. **Build summary cards row**:
   - Total bench headcount
   - Total bench cost
   - Average bench duration (days)
   - Bench cost as % of payroll

3. **Add CSV export button**: Calls `/api/utilization/bench/export`

4. **Add bench cost trend mini-chart**: Small line chart showing last 6 months of bench cost trend

**Acceptance Criteria**:
- [ ] Bench report lists all staff below target utilization
- [ ] Default sort shows most expensive bench resources first
- [ ] Summary totals are accurate
- [ ] CSV export includes all displayed data
- [ ] Page restricted to ADMIN/EXECUTIVE roles

---

### Phase 7: Staff Detail Utilization Tab

**Objective**: Add utilization tab to existing staff detail page.

**Tasks**:

1. **Extend existing staff detail page** with new "Utilization" tab

2. **Create utilization tab content**:
   - Current period utilization rate + status badge
   - Hours breakdown: donut chart (billable/non-billable/bench)
   - Utilization trend chart (last 6 months)
   - Bench cost for current period
   - Assignment timeline showing placements and gaps
   - Target comparison (show which target applies to this staff member)

3. **Create `components/utilization/hours-breakdown.tsx`**: Recharts PieChart or stacked bar

4. **Create `components/utilization/assignment-timeline.tsx`**:
   - Horizontal timeline showing assignment periods
   - Gaps highlighted in red/orange
   - Start/end dates labeled

**Acceptance Criteria**:
- [ ] Utilization tab appears on staff detail page
- [ ] Current utilization rate shown with correct status
- [ ] Trend chart shows historical data from snapshots
- [ ] Hours breakdown accurately reflects billable/non-billable/bench split
- [ ] Assignment timeline correctly identifies gaps
- [ ] Data source indicator shows whether timesheet or allocation was used

---

### Phase 8: Alert System Integration

**Objective**: Connect utilization alerts to the existing notification system.

**Tasks**:

1. **Extend notification UI** to render `UTILIZATION_WARNING` and `UTILIZATION_CRITICAL` notification types
   - Custom icon for utilization alerts
   - Rich rendering using metadata (staff name, rate, bench cost)
   - Action URL links to staff detail utilization tab

2. **Extend notification list filters** to include utilization alert types

3. **Test alert deduplication** end-to-end:
   - Generate snapshots for period 1: staff drops below warning -> alert created
   - Generate snapshots for period 2: staff still below warning -> no new alert
   - Generate snapshots for period 3: staff drops below critical -> alert created (worsened)
   - Generate snapshots for period 4: staff recovers above warning -> no alert (improvement)

**Acceptance Criteria**:
- [ ] Utilization alerts appear in notification center
- [ ] Alert shows staff name, utilization rate, threshold breached, bench cost
- [ ] Clicking alert navigates to staff utilization tab
- [ ] Deduplication prevents repeated alerts for same-level breaches
- [ ] Worsening alerts (WARNING -> CRITICAL) do generate new notifications

---

### Phase 9: Analytics & Dashboard Widget Integration

**Objective**: Surface utilization metrics in existing analytics and main dashboard.

**Tasks**:

1. **Create utilization summary widget** for main dashboard:
   - Compact card: org utilization rate, bench cost, bench headcount
   - Click to navigate to full utilization dashboard
   - Follows existing dashboard widget patterns

2. **Add utilization KPIs to analytics page**:
   - Utilization rate alongside margin and revenue KPIs
   - Bench cost as a tracked metric

3. **Extend CFO Strategist** (`lib/cfo-strategist/analyzers/staffing-analyzer.ts`):
   - Consume latest UtilizationSnapshot data
   - Generate `STAFFING_EFFICIENCY` recommendations with bench cost context
   - Example: "John Developer has been on bench for 15 days with $4,200 bench cost. Consider reassigning to Client X (margin gap: -12%)."
   - Use utilization trend to assess confidence level

4. **Update nightly CFO Strategist run** to include utilization analysis

**Acceptance Criteria**:
- [ ] Main dashboard shows utilization summary widget
- [ ] Analytics page includes utilization KPIs
- [ ] CFO Strategist generates utilization-enriched recommendations
- [ ] Recommendations include bench cost impact in potential_savings field

---

### Phase 10: Testing & Validation

**Objective**: Comprehensive testing across all layers.

**Tasks**:

1. **Unit tests** (calculation engine):
   - Rate conversion edge cases (zero rate, VARIABLE type)
   - Utilization with 0% allocation (fully benched)
   - Utilization with 100% allocation (fully utilized)
   - Partial allocation across multiple clients
   - New staff proration
   - Working days calculation across month boundaries

2. **Integration tests** (API routes):
   - Auth enforcement on all endpoints
   - Organization scoping (cannot access other org's data)
   - Snapshot generation end-to-end
   - Alert generation with deduplication
   - Target CRUD operations

3. **E2E tests** (full flows):
   - Admin configures targets -> snapshots generated -> alerts fired -> dashboard updated
   - Bench report data matches individual staff calculations
   - CSV export contains all expected columns and data

4. **Performance testing**:
   - Snapshot generation for 100 staff members completes in <5 seconds
   - Dashboard loads in <2 seconds
   - Trend queries return in <500ms

5. **Data validation**:
   - Cross-check utilization calculations against manual spreadsheet
   - Verify bench cost matches: bench_hours * hourly_cost_rate
   - Verify org utilization is correctly weighted (not simple average)

6. **Run linting and formatting**:
   - `npm run lint`
   - `npm run format` (or equivalent)

**Acceptance Criteria**:
- [ ] All unit tests pass
- [ ] All integration tests pass
- [ ] All E2E tests pass
- [ ] No linting errors
- [ ] Performance targets met
- [ ] Manual calculation cross-check passes within 1% tolerance

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Spec 15 (Timesheets) not available | HIGH | MEDIUM | Allocation fallback is fully implemented; data_source field tracks provenance |
| Large org (200+ staff) slow snapshot generation | LOW | MEDIUM | Batch createMany, parallel calculation, <5s target verified |
| Rate conversion rounding errors | MEDIUM | LOW | Use Decimal types throughout; round only at display layer |
| Alert fatigue from too many notifications | MEDIUM | MEDIUM | Deduplication logic prevents repeated alerts; configurable thresholds |
| Stale current-period data | LOW | LOW | 5-minute cache; manual snapshot trigger available |

---

## Dependencies Graph

```
Phase 1 (Schema) ─────┬──> Phase 2 (Calculation Engine)
                       │
                       └──> Phase 4 (API Routes) ──────> Phase 5 (Dashboard UI)
                                                          Phase 6 (Bench Report UI)
                                                          Phase 7 (Staff Detail Tab)
Phase 2 ──────────────────> Phase 3 (Snapshot Gen) ───> Phase 8 (Alert Integration)
                                                        Phase 9 (Analytics Widget)
Phase 5-9 ─────────────────────────────────────────────> Phase 10 (Testing)
```

Phases 5, 6, 7 can be developed in parallel after Phase 4 is complete.
Phase 8 depends on Phase 3 (snapshot generation creates alerts).
Phase 9 depends on Phases 2 and 3 (CFO Strategist needs calculation engine and snapshot data).
