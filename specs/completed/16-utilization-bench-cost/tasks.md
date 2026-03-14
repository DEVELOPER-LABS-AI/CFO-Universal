# Feature 16: Utilization & Bench Cost Visibility - Tasks

**Created**: 2026-03-06
**Feature**: Utilization & Bench Cost Visibility
**Total Tasks**: 52

---

## Phase 1: Setup

- [x] T001 Add `UtilizationDataSource` enum, `UtilizationSnapshot` model, `UtilizationTarget` model, `UTILIZATION_WARNING`/`UTILIZATION_CRITICAL` to `NotificationType` enum, and relations on `Organization`/`Staff` in `prisma/schema.prisma`
- [x] T002 Run Prisma migration `add_utilization_tracking` and generate client via `npx prisma migrate dev --name add_utilization_tracking && npx prisma generate`

---

## Phase 2: Foundational (blocking prerequisites)

- [x] T003 [P] Create Zod validation schemas for `UtilizationSnapshot` and `UtilizationTarget` in `lib/validations/utilization.ts`
- [x] T004 [P] Add `toHourlyCost()` function (inverse of existing `toMonthlyCost()`) to `lib/utils/currency.ts`
- [x] T005 [P] Create core utilization calculation functions (`calculateUtilizationRate`, `calculateAvailableHours`, `calculateBillableHours`, `getWorkingDaysInPeriod`, `isEligibleForUtilization`) in `lib/calculations/utilization.ts`
- [x] T006 [P] Create bench cost calculation functions (`calculateBenchHours`, `calculateBenchCost`, `getHourlyCostRate`, `calculateBenchDuration`) in `lib/calculations/bench-cost.ts`
- [x] T007 [P] Create utilization target resolution logic (`resolveEffectiveTarget`, `determineAlertLevel`, `SYSTEM_FALLBACK` constants) in `lib/calculations/utilization-targets.ts`

---

## Phase 3: US1 - Executive Reviews Organization Utilization Dashboard

**Story Goal**: As a platform admin/executive, I can view organization-wide utilization rates on a dashboard so I see overall workforce deployment efficiency at a glance.

**Independent Test Criteria**: Dashboard page loads, shows org utilization gauge, staff table with utilization rates, color-coded status indicators.

- [x] T008 [US1] Create `GET /api/utilization/current` route with on-demand calculation for org + staff utilization in `app/api/utilization/current/route.ts`
- [x] T009 [P] [US1] Create utilization status badge component (green/yellow/red) in `components/utilization/status-badge.tsx`
- [x] T010 [P] [US1] Create org-wide utilization gauge component in `components/utilization/utilization-gauge.tsx`
- [x] T011 [P] [US1] Create bench cost summary card component in `components/utilization/bench-cost-card.tsx`
- [x] T012 [US1] Create sortable/filterable staff utilization table component in `components/utilization/staff-utilization-table.tsx`
- [x] T013 [US1] Create utilization dashboard page at `app/dashboard/utilization/page.tsx`

---

## Phase 4: US2 - Manager Identifies Bench Resources

**Story Goal**: As a manager, I can view a bench report listing all under-utilized staff with cost impact so I can take action to deploy idle resources.

**Independent Test Criteria**: Bench report page loads, shows bench staff with cost columns, CSV export downloads, sort/filter works.

- [x] T014 [US2] Create `GET /api/utilization/bench` route with bench report data and cost impact in `app/api/utilization/bench/route.ts`
- [x] T015 [US2] Create `GET /api/utilization/bench/export` route for CSV export in `app/api/utilization/bench/export/route.ts`
- [x] T016 [P] [US2] Create bench staff table component with cost impact columns in `components/utilization/bench-staff-table.tsx`
- [x] T017 [US2] Create bench report page at `app/dashboard/utilization/bench/page.tsx`

---

## Phase 5: US3 - Admin Sets Utilization Targets

**Story Goal**: As an admin, I can configure utilization target thresholds (default + per staff type) so the system knows what constitutes warning/critical utilization levels.

**Independent Test Criteria**: Settings page loads, target form creates/updates/deletes targets, threshold validation enforced, per-staff-type overrides work.

- [x] T018 [US3] Create `GET/POST /api/utilization/targets` route for listing and upserting targets in `app/api/utilization/targets/route.ts`
- [x] T019 [US3] Create `PUT/DELETE /api/utilization/targets/[targetId]` route for updating and soft-deleting targets in `app/api/utilization/targets/[targetId]/route.ts`
- [x] T020 [US3] Create server action for utilization target mutations in `app/actions/utilization-targets.ts`
- [x] T021 [P] [US3] Create target configuration form component with threshold validation in `components/utilization/target-form.tsx`
- [x] T022 [US3] Create utilization settings page at `app/dashboard/settings/utilization/page.tsx`

---

## Phase 6: US4 - Manager Reviews Individual Staff Utilization

**Story Goal**: As a manager, I can view a staff member's utilization detail including history, hours breakdown, and assignment timeline to understand their deployment patterns.

**Independent Test Criteria**: Staff detail page shows utilization tab, individual trend chart renders, hours breakdown displays, assignment timeline shows gaps.

- [x] T023 [US4] Create `GET /api/utilization/staff/[staffId]` route with individual utilization detail in `app/api/utilization/staff/[staffId]/route.ts`
- [x] T024 [P] [US4] Create hours breakdown visualization component (billable/non-billable/bench) in `components/utilization/hours-breakdown.tsx`
- [x] T025 [P] [US4] Create assignment timeline component showing assignment gaps in `components/utilization/assignment-timeline.tsx`
- [x] T026 [US4] Add utilization tab to existing staff detail page at `app/dashboard/staff/[id]/utilization/page.tsx`

---

## Phase 7: US5 - System Generates Utilization Alerts

**Story Goal**: As the system, I generate periodic utilization snapshots and create alert notifications when staff drop below configured thresholds, with deduplication to avoid noise.

**Independent Test Criteria**: Snapshot generation creates records for all eligible staff, alerts fire on threshold breach, deduplication prevents duplicate alerts, manual trigger works via API.

- [x] T027 [US5] Create snapshot generator with batch snapshot creation for all eligible staff in `lib/utilization/snapshot-generator.ts`
- [x] T028 [US5] Create alert generator with threshold comparison and notification creation in `lib/utilization/alert-generator.ts`
- [x] T029 [US5] Create `POST /api/utilization/snapshots/generate` route (cron + manual trigger) in `app/api/utilization/snapshots/generate/route.ts`
- [x] T030 [US5] Add cron configuration for weekly snapshot generation in `vercel.json` or cron config

---

## Phase 8: US6 - Executive Reviews Bench Cost Trends

**Story Goal**: As an executive, I can view utilization and bench cost trends over time to identify patterns and forecast staffing needs.

**Independent Test Criteria**: Trend chart renders 12 months of data, bench cost trends show direction indicators, snapshot list displays raw data.

- [x] T031 [US6] Create `GET /api/utilization/trends` route for historical utilization trends from snapshots in `app/api/utilization/trends/route.ts`
- [x] T032 [US6] Create `GET /api/utilization/bench/trends` route for bench cost trends over time in `app/api/utilization/bench/trends/route.ts`
- [x] T033 [US6] Create `GET /api/utilization/snapshots` route for raw snapshot data with filtering in `app/api/utilization/snapshots/route.ts`
- [x] T034 [P] [US6] Create utilization trend chart component (Recharts line chart) in `components/utilization/utilization-trend-chart.tsx`
- [x] T035 [US6] Integrate trend chart into utilization dashboard page at `app/dashboard/utilization/page.tsx`
- [x] T036 [US6] Integrate bench cost trend chart into bench report page at `app/dashboard/utilization/bench/page.tsx`

---

## Phase 9: US7 & US8 - Agency Admin Utilization & Targets

**Story Goal**: As an agency admin, I can view utilization data scoped to my agency's staff and configure agency-level utilization targets.

**Independent Test Criteria**: Agency admin sees only their agency staff on dashboard/bench report, agency-level targets apply correctly, all queries respect agency scoping.

- [x] T037 [US7] Add agency scoping to `GET /api/utilization/current` for AGENCY_ADMIN role in `app/api/utilization/current/route.ts`
- [x] T038 [US7] Add agency scoping to `GET /api/utilization/bench` for AGENCY_ADMIN role in `app/api/utilization/bench/route.ts`
- [x] T039 [US7] Add agency scoping to `GET /api/utilization/staff/[staffId]` for AGENCY_ADMIN role in `app/api/utilization/staff/[staffId]/route.ts`
- [x] T040 [US8] Add agency-level target support to `GET/POST /api/utilization/targets` in `app/api/utilization/targets/route.ts`
- [x] T041 [US8] Add agency-level target support to `PUT/DELETE /api/utilization/targets/[targetId]` in `app/api/utilization/targets/[targetId]/route.ts`
- [x] T042 [US7] Update utilization dashboard page to handle AGENCY_ADMIN view at `app/dashboard/utilization/page.tsx`

---

## Phase 10: Polish & Cross-Cutting Concerns

- [x] T043 Extend `NotificationType` handling in notification UI components for utilization alert rendering in `components/notifications/`
- [x] T044 Add utilization summary widget to main dashboard at `app/dashboard/page.tsx`
- [x] T045 Extend `lib/cfo-strategist/analyzers/staffing-analyzer.ts` to consume utilization data for CFO Strategist integration
- [x] T046 Update nightly CFO Strategist run to include utilization metrics in `app/api/cfo-strategist/nightly/route.ts`
- [x] T047 Add utilization KPIs to analytics page at `app/dashboard/analytics/page.tsx`
- [x] T048 Add navigation links for utilization pages in sidebar/navigation component
- [x] T049 Run TypeScript type check: `npx tsc --noEmit`
- [x] T050 Run unit tests: `npx vitest run` (129/135 passed; 6 pre-existing failures in token-crypto unrelated to feature 16)
- [x] T051 Run build verification: `npx next build`
- [x] T052 Security audit: verify all utilization routes enforce org scoping and role checks, agency admin can only see own agency data

---

## Dependencies

```
Phase 1 (Setup) → Phase 2 (Foundational) → All User Story Phases

Phase 2 → Phase 3 (US1: Dashboard)
Phase 2 → Phase 4 (US2: Bench Report)
Phase 2 → Phase 5 (US3: Targets)
Phase 2 → Phase 6 (US4: Staff Detail)
Phase 2 → Phase 7 (US5: Alerts/Snapshots)

Phase 3 → Phase 8 (US6: Trends - extends dashboard)
Phase 4 → Phase 8 (US6: Trends - extends bench report)
Phase 7 → Phase 8 (US6: Trends - depends on snapshot data)

Phase 3 + Phase 4 + Phase 5 → Phase 9 (US7/US8: Agency scoping)

All User Story Phases → Phase 10 (Polish)
```

## Parallel Execution Opportunities

**Within Phase 2**: T003, T004, T005, T006, T007 can all run in parallel (different files, no dependencies).

**Phases 3, 4, 5, 6, 7**: These can run in parallel after Phase 2 (independent user stories). Within each phase, components marked [P] can run in parallel with other [P] tasks.

**Phase 9**: Must wait for Phases 3, 4, 5 (adds agency scoping to existing routes).

**Phase 8**: Must wait for Phases 3, 4, 7 (extends dashboard/bench pages and depends on snapshots).

## Implementation Strategy

**MVP (Phase 1-3)**: Schema + calculation engine + org utilization dashboard. Delivers the core value of seeing utilization rates at a glance.

**Increment 2 (Phase 4-5)**: Bench report + target configuration. Adds cost visibility and configurability.

**Increment 3 (Phase 6-7)**: Staff detail + automated snapshots/alerts. Enables drill-down and automation.

**Increment 4 (Phase 8-9)**: Trends + agency scoping. Adds historical context and multi-tenant support.

**Increment 5 (Phase 10)**: Polish, integrations, and verification.
