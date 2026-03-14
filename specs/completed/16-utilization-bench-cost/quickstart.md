# Feature 16: Utilization & Bench Cost Visibility - Quickstart

**Created**: 2026-03-06

---

## Feature Overview

Utilization & Bench Cost Visibility provides real-time insight into how effectively staff are deployed, identifies idle (bench) resources, and quantifies the cost of unallocated staff time in monetary terms. It introduces two new database models, a calculation engine, scheduled snapshot generation, and dashboard/report UI components.

**Core capabilities**:
- Calculate utilization rate per staff member (billable hours / available hours)
- Identify bench (idle) staff and compute their cost impact
- Track utilization trends over time via periodic snapshots
- Configure utilization targets with warning/critical thresholds
- Generate automated alerts when staff drop below thresholds
- Integrate utilization data into the CFO Strategist and main dashboard

---

## Key Models and Relationships

### New Models

| Model | Table Name | Purpose |
|-------|-----------|---------|
| `UtilizationSnapshot` | `utilization_snapshots` | Immutable periodic utilization metrics per staff member |
| `UtilizationTarget` | `utilization_targets` | Configurable utilization thresholds per organization |

### New Enum

| Enum | Values | Purpose |
|------|--------|---------|
| `UtilizationDataSource` | `TIMESHEET`, `ALLOCATION`, `BLENDED` | Track how billable hours were determined |

### Modified Enum

| Enum | New Values | Purpose |
|------|-----------|---------|
| `NotificationType` | `UTILIZATION_WARNING`, `UTILIZATION_CRITICAL` | Alert types for threshold breaches |

### Relationships

```
Organization 1---M UtilizationSnapshot
Organization 1---M UtilizationTarget
Staff        1---M UtilizationSnapshot
```

### Key Existing Models Used

| Model | Usage |
|-------|-------|
| `Staff` | Source for rate, true_cost, engagement_type, staff_type, status |
| `StaffAssignment` | Allocation percentages for utilization fallback calculation |
| `MonthlyAllocationOverride` | Month-specific allocation overrides |
| `Notification` | Target for utilization alert notifications |
| `StaffRole` | Available staff types for target configuration dropdown |

---

## API Endpoint Summary

### Utilization Queries

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `GET` | `/api/utilization/current` | Current-period org + staff utilization (on-demand calc) |
| `GET` | `/api/utilization/trends` | Historical utilization trends from snapshots |
| `GET` | `/api/utilization/staff/[staffId]` | Individual staff utilization detail |
| `GET` | `/api/utilization/snapshots` | Raw snapshot data with filtering |
| `POST` | `/api/utilization/snapshots/generate` | Trigger snapshot generation (cron + manual) |

### Bench Reporting

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `GET` | `/api/utilization/bench` | Bench report with cost impact |
| `GET` | `/api/utilization/bench/trends` | Bench cost trends over time |
| `GET` | `/api/utilization/bench/export` | CSV export of bench report |

### Target Configuration

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `GET` | `/api/utilization/targets` | List all targets (default + overrides) |
| `POST` | `/api/utilization/targets` | Create/upsert target |
| `PUT` | `/api/utilization/targets/[targetId]` | Update existing target |
| `DELETE` | `/api/utilization/targets/[targetId]` | Soft-delete target override |

---

## Implementation Order

### Phase 1: Schema & Foundation
1. Add `UtilizationDataSource` enum to Prisma schema
2. Add `UTILIZATION_WARNING` and `UTILIZATION_CRITICAL` to `NotificationType`
3. Create `UtilizationSnapshot` model with all fields, constraints, and indexes
4. Create `UtilizationTarget` model with all fields, constraints, and indexes
5. Add relations to `Organization` and `Staff` models
6. Run migration: `npx prisma migrate dev --name add_utilization_tracking`
7. Run `npx prisma generate`

### Phase 2: Calculation Engine
1. Add `toHourlyCost()` to `lib/utils/currency.ts`
2. Create `lib/calculations/utilization.ts` with core calculation functions
3. Create `lib/calculations/bench-cost.ts` with bench cost calculation
4. Create `lib/calculations/utilization-targets.ts` with target resolution logic
5. Write unit tests for all calculation functions

### Phase 3: Snapshot Generation
1. Create `lib/utilization/snapshot-generator.ts` -- batch snapshot creation
2. Create `lib/utilization/alert-generator.ts` -- threshold comparison and notification creation
3. Create `app/api/utilization/snapshots/generate/route.ts` -- cron + manual trigger endpoint
4. Add cron configuration for weekly runs

### Phase 4: API Routes
1. Create `app/api/utilization/current/route.ts`
2. Create `app/api/utilization/trends/route.ts`
3. Create `app/api/utilization/staff/[staffId]/route.ts`
4. Create `app/api/utilization/snapshots/route.ts`
5. Create `app/api/utilization/bench/route.ts`
6. Create `app/api/utilization/bench/trends/route.ts`
7. Create `app/api/utilization/bench/export/route.ts`
8. Create `app/api/utilization/targets/route.ts`
9. Create `app/api/utilization/targets/[targetId]/route.ts`
10. Create server action `app/actions/utilization-targets.ts`

### Phase 5: Dashboard UI
1. Create utilization dashboard page at `app/(dashboard)/utilization/page.tsx`
2. Build org-wide utilization gauge component
3. Build bench cost summary card
4. Build staff utilization table (sortable, filterable)
5. Build utilization trend chart (Recharts)
6. Build status indicators (color-coded green/yellow/red)

### Phase 6: Bench Report UI
1. Create bench report page at `app/(dashboard)/utilization/bench/page.tsx`
2. Build bench staff table with cost impact columns
3. Build bench cost summary cards
4. Build CSV export button
5. Add sort/filter controls

### Phase 7: Staff Detail Integration
1. Add utilization tab to existing staff detail page
2. Build individual utilization trend chart
3. Build hours breakdown visualization (billable/non-billable/bench)
4. Build assignment timeline component

### Phase 8: Settings & Targets UI
1. Create utilization settings page at `app/(dashboard)/settings/utilization/page.tsx`
2. Build target configuration form (default + per staff type)
3. Build threshold visualization (preview what green/yellow/red looks like)

### Phase 9: Alert System & CFO Strategist
1. Extend `NotificationType` handling in notification UI components
2. Add alert rendering for utilization notifications
3. Extend `staffing-analyzer.ts` to consume utilization data
4. Update nightly CFO Strategist run

### Phase 10: Analytics & Dashboard Widget
1. Add utilization summary widget to main dashboard
2. Add utilization KPIs to analytics page
3. Integration testing with full data flow

---

## Testing Checklist

### Unit Tests
- [ ] `toHourlyCost()` rate conversion (HOURLY, DAILY, MONTHLY, VARIABLE)
- [ ] Utilization rate calculation with known inputs
- [ ] Bench cost calculation with true_cost vs rate fallback
- [ ] Bench hours = available - billable - non_billable
- [ ] Target resolution: staff_type override > org default > system fallback
- [ ] Alert deduplication: only alert on initial breach or worsening
- [ ] Working days calculation for weekly/monthly periods
- [ ] New staff proration (started mid-period)
- [ ] OWNER engagement type excluded from calculations
- [ ] TERMINATED staff excluded from current period

### Integration Tests
- [ ] Snapshot generation creates correct records for all eligible staff
- [ ] Snapshot upsert (re-generation) updates existing records
- [ ] Alert notifications created for threshold breaches
- [ ] Alert deduplication prevents duplicate notifications
- [ ] API routes return correct data shapes
- [ ] Organization scoping prevents cross-tenant data leakage
- [ ] Allocation fallback works when no timesheet data exists

### E2E Tests
- [ ] Admin configures utilization targets
- [ ] Dashboard displays current utilization metrics
- [ ] Bench report shows all under-utilized staff
- [ ] Utilization trend chart renders 12 months of history
- [ ] Staff detail page shows utilization tab
- [ ] Manual snapshot generation triggers and completes
- [ ] CSV export downloads correctly

---

## Key Constants

```typescript
// From existing currency.ts
const WORKING_DAYS_PER_MONTH = 22;
const STANDARD_DAILY_HOURS = 8;  // Overridable via UtilizationTarget
const HOURS_PER_MONTH = 176;     // 22 * 8

// Working days per week (for weekly snapshots)
const WORKING_DAYS_PER_WEEK = 5;

// System fallback targets (when no UtilizationTarget configured)
const DEFAULT_TARGET_RATE = 80;
const DEFAULT_WARNING_THRESHOLD = 70;
const DEFAULT_CRITICAL_THRESHOLD = 50;

// Eligible engagement types (OWNER excluded)
const ELIGIBLE_ENGAGEMENT_TYPES = ['FULL_TIME', 'PART_TIME', 'PROJECT', 'AGENCY'];
```

---

## File Structure

```
lib/
  calculations/
    utilization.ts              # Core utilization calculation functions
    bench-cost.ts               # Bench cost calculation
    utilization-targets.ts      # Target resolution logic
  utilization/
    snapshot-generator.ts       # Batch snapshot creation
    alert-generator.ts          # Threshold comparison + notification creation
  utils/
    currency.ts                 # (extend) Add toHourlyCost()

app/
  api/
    utilization/
      current/route.ts
      trends/route.ts
      staff/[staffId]/route.ts
      snapshots/
        route.ts                # GET list
        generate/route.ts       # POST trigger
      bench/
        route.ts                # GET bench report
        trends/route.ts
        export/route.ts
      targets/
        route.ts                # GET/POST
        [targetId]/route.ts     # PUT/DELETE
  actions/
    utilization-targets.ts      # Server action for mutations
  (dashboard)/
    utilization/
      page.tsx                  # Main utilization dashboard
      bench/
        page.tsx                # Bench report page
    settings/
      utilization/
        page.tsx                # Target configuration
    staff/
      [id]/
        utilization/            # Staff detail utilization tab

components/
  utilization/
    utilization-gauge.tsx       # Circular gauge for org utilization
    bench-cost-card.tsx         # Summary card for bench cost
    staff-utilization-table.tsx # Sortable/filterable staff table
    utilization-trend-chart.tsx # Recharts line chart
    hours-breakdown.tsx         # Stacked bar or donut chart
    status-badge.tsx            # Green/yellow/red indicator
    bench-staff-table.tsx       # Bench report table
    target-form.tsx             # Target configuration form
    assignment-timeline.tsx     # Assignment gap visualization
```
