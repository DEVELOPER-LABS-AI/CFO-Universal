# Tasks: CFO Strategist

**Created**: 2026-02-27
**Feature**: [spec.md](spec.md) | [plan.md](plan.md)
**Branch**: `7-cfo-strategist`

---

## User Story Map

| Story | Spec Scenario | Functional Requirements | Priority |
|-------|--------------|------------------------|----------|
| US1 | Scenario 1: Setting Margin Goals | FR-1, FR-1b | P1 |
| US2 | Scenario 2: Reviewing Daily Recommendations | FR-2, FR-3 | P1 |
| US3 | Scenario 4: Subscription Optimization | FR-4 | P1 |
| US4 | Scenario 5: Staffing Efficiency | FR-5 | P1 |
| US5 | Scenario 6: Daily Briefing | FR-6, FR-7 | P2 |
| US6 | (Overhead analysis) | FR-3 (overhead category) | P2 |
| US7 | Scenario 3: Monthly Strategic Report | FR-7 | P2 |
| US8 | Scenario 7: Responding to Margin Alert | FR-8 | P2 |
| US9 | (Impact Tracking) | FR-9 | P3 |

---

## Phase 1: Setup

**Goal**: Database schema, folder structure, and Prisma client generation.

- [x] T001 Verify database connection by running `npx prisma migrate status`
- [x] T002 Add CfoRecommendation model, CfoRecommendationCategory enum, and CfoRecommendationStatus enum to `prisma/schema.prisma` per data-model.md (includes composite unique constraint, indexes, soft delete, UUID PK, timestamps)
- [x] T003 Add CfoReport model and CfoReportType enum to `prisma/schema.prisma` per data-model.md (includes period unique constraint, indexes, soft delete, UUID PK, timestamps)
- [x] T004 Add `cfo_recommendations` and `cfo_reports` relations to the Organization model in `prisma/schema.prisma`
- [x] T005 Run `npx prisma migrate dev --name add_cfo_strategist_models` to apply migration
- [x] T006 Run `npx prisma generate` to update Prisma Client types
- [x] T007 Create directory structure: `lib/cfo-strategist/`, `lib/cfo-strategist/analyzers/`, `components/cfo-strategist/`, `app/dashboard/strategist/`, `app/dashboard/strategist/recommendations/`, `app/dashboard/strategist/reports/`, `app/dashboard/strategist/reports/[id]/`, `supabase/functions/cfo-strategist-nightly/`

---

## Phase 2: Foundational

**Goal**: Margin goal resolution logic and shared types - blocking prerequisite for all user stories.

- [x] T008 Create margin goal resolver with `getEffectiveMarginTarget(clientId?)`, `getCompanyMarginTarget()`, and `getAllClientMarginTargets()` functions in `lib/cfo-strategist/margin-goals.ts`. Hierarchy: client `custom_margin_target` -> FinancialTarget GLOBAL -> default 25%. Uses `getOrganizationId()` for multi-tenant scoping.
- [x] T009 Create margin forecasting utility with `projectNextMonthMargin(organizationId)` using linear regression on last 3-6 months of CompanyMetrics/ClientROI data in `lib/cfo-strategist/forecasting.ts`
- [x] T010 [P] Create shared TypeScript types for recommendation engine (RecommendationInput, AnalyzerResult, ReportContent, ThresholdConfig interfaces) in `lib/cfo-strategist/types.ts`

---

## Phase 3: Margin Goal & Threshold Configuration [US1]

**Goal**: Users can set company-wide and per-client margin targets, and configure analyzer thresholds in Settings.
**Test criteria**: Company-wide target saves and persists; per-client overrides display and save correctly; default of 25% shown when no target exists; all 6 analyzer thresholds are editable with sensible defaults applied when no custom value is configured.

- [x] T011 [US1] Implement `getMarginGoals()` server action in `app/actions/cfo-strategist.ts` - queries FinancialTarget (scope=GLOBAL) and Client.custom_margin_target, returns company target + client overrides array per api-contracts.md
- [x] T012 [US1] Implement `updateMarginGoal()` server action in `app/actions/cfo-strategist.ts` - handles GLOBAL scope (upsert FinancialTarget) and CLIENT scope (update Client.custom_margin_target), validates 0-100 range, calls `revalidatePath('/dashboard/settings')`
- [x] T013 [US1] Create `components/settings/MarginGoalSettings.tsx` client component with: company-wide target input (number, 0-100%), save button with loading/toast pattern, client override table showing all active clients with editable margin target column, per-client save with optimistic update
- [x] T014 [US1] Add MarginGoalSettings Card section to `app/dashboard/settings/page.tsx` - new Card with title "Margin Goals", description "Set target profit margins", fetch `getMarginGoals()` and pass to MarginGoalSettings component
- [x] T014b [US1] Create threshold resolver in `lib/cfo-strategist/thresholds.ts` with `getEffectiveThresholds(organizationId)` returning typed ThresholdConfig with defaults merged with stored overrides. Defaults: subscription_allocation_pct=5, subscription_cost_increase_pct=10, staffing_utilization_min_assignments=2, staffing_cost_ratio_multiplier=1.5, revenue_margin_gap_pts=10, revenue_decline_months=3. Store overrides as JSONB in Organization `analyzer_thresholds` column (requires migration).
- [x] T014c [US1] Add `analyzer_thresholds` JSONB column to Organization model in `prisma/schema.prisma` and create migration `npx prisma migrate dev --name add_analyzer_thresholds`
- [x] T014d [US1] Implement `getAnalyzerThresholds()` and `updateAnalyzerThresholds()` server actions in `app/actions/cfo-strategist.ts` - get returns current thresholds merged with defaults, update validates numeric ranges and persists to Organization.analyzer_thresholds
- [x] T014e [US1] Create `components/settings/ThresholdSettings.tsx` client component with: labeled number inputs for each of the 6 thresholds, current default shown as placeholder, save button with loading/toast pattern, description text explaining each threshold's effect. Add as a Card section in `app/dashboard/settings/page.tsx` below Margin Goals.

---

## Phase 4: Recommendation Engine Core [US2]

**Goal**: Build the recommendation engine orchestrator that runs all analyzers, deduplicates results, and upserts into the database.
**Test criteria**: Engine generates recommendations across 4 categories; recommendations include title, description, category, estimated impact, confidence; deduplication preserves dismissed/deferred/acted_on status by composite identity key; configurable thresholds are loaded and passed to each analyzer; conflicting recommendations are flagged with trade-off indicators.

- [ ] T015 [US2] Create subscription analyzer in `lib/cfo-strategist/analyzers/subscription-analyzer.ts` - queries active subscriptions via Prisma, uses `computeSubscriptionPeriodCost()` and `getSubscriptionTrend()` from existing `lib/calculations/subscription-cost-calculator.ts` and `lib/calculations/trend-reporter.ts`. Loads thresholds via `getEffectiveThresholds()`. Generates recommendations for: (1) zero/below-threshold allocation subs (using `subscription_allocation_pct` threshold), (2) MoM cost increases above `subscription_cost_increase_pct` threshold, (3) similar-named consolidation candidates. Confidence scoring per research.md Decision 8 (3 tiers based on data months). Returns array of RecommendationInput.
- [ ] T016 [P] [US2] Create staffing analyzer in `lib/cfo-strategist/analyzers/staffing-analyzer.ts` - queries contractors/staff with client assignments via Prisma, uses `calculateClientCosts()` from `lib/calculations/client-roi.ts`, `calculateAttributedRevenue()` and `calculateBDRTotalCost()` from `lib/calculations/bdr-roi.ts`. Loads thresholds via `getEffectiveThresholds()`. Generates recommendations for: (1) low utilization (fewer than `staffing_utilization_min_assignments` active assignments), (2) cost-to-revenue outliers (above `staffing_cost_ratio_multiplier` x company average), (3) clients where contractor costs > revenue, (4) reallocation opportunities. Distinguishes engagement_type (FULL_TIME, PART_TIME, PROJECT). Returns array of RecommendationInput.
- [ ] T017 [P] [US2] Create revenue analyzer in `lib/cfo-strategist/analyzers/revenue-analyzer.ts` - queries ClientROI data via Prisma, uses `getClientRevenue()` from `lib/calculations/client-roi.ts` and `computeTrend()` from `lib/calculations/trend-reporter.ts`. Uses `getEffectiveMarginTarget()` from `lib/cfo-strategist/margin-goals.ts`. Loads thresholds via `getEffectiveThresholds()`. Generates recommendations for: (1) clients below margin target by more than `revenue_margin_gap_pts` threshold, (2) declining revenue for `revenue_decline_months` or more consecutive months, (3) high-margin upsell candidates, (4) underpriced services. Excludes new clients with <2 months of data (T018c). Returns array of RecommendationInput.
- [ ] T018 [P] [US2] Create overhead analyzer in `lib/cfo-strategist/analyzers/overhead-analyzer.ts` - uses `calculateOverheadAllocation()` from `lib/calculations/overhead-allocation.ts` and `getAllAgencyAvgMonthlySpend()` from `lib/calculations/agency-costs.ts`. Generates recommendations for: (1) disproportionate overhead vs revenue, (2) agency spend trending up without proportional revenue, (3) internal project cost reduction. Returns array of RecommendationInput.
- [ ] T018b [P] [US2] Add seasonal comparison logic to revenue analyzer - when prior-year data for the same month is available, compare current metrics to YoY values instead of only MoM. When prior-year data is unavailable, include a `limited_comparison_window: true` flag in the recommendation's `supporting_data` JSON so the UI can display a caveat. Modifies `lib/cfo-strategist/analyzers/revenue-analyzer.ts`.
- [ ] T018c [P] [US2] Add new client exclusion across all analyzers - clients with fewer than 2 months of data are excluded from trend analysis and flagged with `is_new_client: true` in supporting_data. They may still appear in point-in-time margin analysis but not in decline/trend recommendations. Create shared helper `isNewClient(clientId, organizationId)` in `lib/cfo-strategist/types.ts`.
- [ ] T018d [P] [US2] Add zero-revenue classification to revenue analyzer - distinguish between clients with no revenue due to project gaps (no active services in the period) and clients with active services but zero collected revenue. Only the latter triggers declining-revenue recommendations. Check for active service assignments in the period to differentiate. Modifies `lib/cfo-strategist/analyzers/revenue-analyzer.ts`.
- [ ] T019 [US2] Create recommendation engine orchestrator in `lib/cfo-strategist/recommendation-engine.ts` - `generateRecommendations(organizationId, month, year)` that: (1) loads configurable thresholds via `getEffectiveThresholds()` and passes to each analyzer, (2) runs all 4 analyzers in parallel with Promise.allSettled, (3) collects all RecommendationInput results, (4) detects conflicting recommendations (same entity appearing as both cost-cut target and revenue-generator) and tags conflicts with `has_trade_off: true` + cross-reference in `supporting_data`, (5) for each result, upserts CfoRecommendation by composite key (org_id + category + target_entity_type + target_entity_id) preserving existing status (dismissed/deferred/acted_on), (6) reactivates deferred recommendations where `deferred_until < now()`, (7) checks dismissed recommendations for 15%+ metric change from `dismissed_metric_snapshot` and reactivates if threshold exceeded. Returns summary counts: `{ generated, updated, reactivated, conflicts_flagged }`.

---

## Phase 5: Financial Health Dashboard [US2]

**Goal**: Dashboard page with KPI cards, margin trend chart, top recommendations, and per-client breakdown.
**Test criteria**: Dashboard loads within 2 seconds; displays current margin vs target; shows 6-month trend chart; lists top 3 recommendations; client table is color-coded (green/yellow/red); new clients display "New" badge.

- [ ] T020 [US2] Implement `getStrategistDashboard()` server action in `app/actions/cfo-strategist.ts` per api-contracts.md - fetches current/target margin via `getCompanyMarginTarget()`, margin history from ClientROI/CompanyMetrics (last 6 months), active recommendation counts by category, top 3 recommendations, per-client margins with color status (above/near/below target using 5pt threshold) and `is_new_client` flag for clients with <2 months data, projected margin via `projectNextMonthMargin()`, accuracy score, active alert count
- [ ] T021 [P] [US2] Create `components/cfo-strategist/MarginKPICards.tsx` - 4 KPI cards in grid (md:grid-cols-2 lg:grid-cols-4): Current Margin (with trend badge vs prior period), Target Margin, Projected Next Month, Accuracy Score (or "N/A" if null). Follow KPISummaryCards pattern from analytics page. Use `formatCurrency` and percentage formatting.
- [ ] T022 [P] [US2] Create `components/cfo-strategist/MarginTrendChart.tsx` - Recharts AreaChart showing 6-month margin history with target line overlay (ReferenceLine). X-axis: month labels, Y-axis: percentage. Gradient fill. Follow existing chart patterns with custom tooltip showing margin %, revenue, expenses for each month.
- [ ] T023 [P] [US2] Create `components/cfo-strategist/RecommendationCategoryCounts.tsx` - 4 Badge/pill components showing active recommendation count per category (subscription, staffing, revenue, overhead) with total count. Use Tremor BarList for category breakdown. Use category-specific colors.
- [ ] T024 [P] [US2] Create `components/cfo-strategist/TopRecommendations.tsx` - list of top 3 recommendation Card components showing title, category badge, estimated monthly impact in dollars, confidence indicator (high/medium/low), trade-off badge if `has_trade_off` is true. Each card links to full recommendations page.
- [ ] T025 [P] [US2] Create `components/cfo-strategist/ClientMarginTable.tsx` - Table component with columns: Client Name, Current Margin %, Target %, Status (Badge: green "Above"/yellow "Near"/red "Below"), Revenue, Costs. "New" badge for clients with <2 months data. Sortable by margin. Color-coded rows. Uses existing Table components from shadcn/ui.
- [ ] T026 [US2] Create dashboard page `app/dashboard/strategist/page.tsx` as 'use client' component - uses TanStack Query (`useQuery`) for data fetching with automatic refetching and cache invalidation via `getStrategistDashboard()`, loading state with spinner, layout: header with title "CFO Strategist" + refresh button placeholder, KPI cards, trend chart (full width), category counts (Tremor BarList) + top recommendations (side by side grid), client margin table. Follow analytics page pattern.
- [ ] T027 [US2] Add CFO Strategist nav item to Sidebar in `components/dashboard/Sidebar.tsx` - add `{ label: 'CFO Strategist', href: '/dashboard/strategist', icon: Target }` to the "Insights" navGroup items array. Import `Target` from `lucide-react`.

---

## Phase 6: Recommendation Management [US2, US3, US4]

**Goal**: Full recommendations page with filtering, detail view, and status action modals.
**Test criteria**: Recommendations list loads with all categories; filter by category and status works; act-on/dismiss/defer modals open, validate input, and save status change; toast confirmation on success; trade-off recommendations display cross-reference context.

- [ ] T028 [US2] Implement `getRecommendations(filters?)` server action in `app/actions/cfo-strategist.ts` per api-contracts.md - queries CfoRecommendation with optional category/status filters, resolves `targetEntityName` by querying the referenced entity (Subscription.name, Contractor.name, Client.name, etc. based on target_entity_type), includes `has_trade_off` and cross-reference data from supporting_data, orders by estimated_monthly_impact DESC
- [ ] T029 [US2] Implement `updateRecommendationStatus(id, action)` server action in `app/actions/cfo-strategist.ts` per api-contracts.md - validates status is ACTIVE before transition, handles 3 action types: (1) act: sets acted_on_at, acted_on_expected_savings, captures baseline_metric_value, (2) dismiss: sets dismissed_reason, captures dismissed_metric_snapshot from current metric, (3) defer: validates deferred_until is future date, sets deferred_until. Calls `revalidatePath('/dashboard/strategist')`.
- [ ] T030 [P] [US2] Create `components/cfo-strategist/ActOnModal.tsx` - Dialog with number input for expected monthly savings, confirm button. Uses shadcn/ui Dialog, Input, Button. Calls `updateRecommendationStatus(id, { type: 'act', expectedSavings })`. Toast on success/error.
- [ ] T031 [P] [US2] Create `components/cfo-strategist/DismissModal.tsx` - Dialog with textarea for reason, confirm button. Uses shadcn/ui Dialog, Textarea, Button. Calls `updateRecommendationStatus(id, { type: 'dismiss', reason })`. Toast on success/error.
- [ ] T032 [P] [US2] Create `components/cfo-strategist/DeferModal.tsx` - Dialog with date picker for defer-until date (must be future), confirm button. Uses shadcn/ui Dialog, Calendar/DatePicker, Button. Calls `updateRecommendationStatus(id, { type: 'defer', until })`. Toast on success/error.
- [ ] T033 [US2] Create recommendations page `app/dashboard/strategist/recommendations/page.tsx` as 'use client' component - uses TanStack Query for data fetching, header with title "Recommendations", filter bar (Select for category: all/subscription/staffing/revenue/overhead, Select for status: all/active/acted_on/dismissed/deferred), recommendation list as Card grid showing: title, description, category badge, entity name, estimated impact ($), confidence badge (High/Medium/Low), trade-off badge with tooltip showing conflicting recommendation context, status badge, action buttons (Act On/Dismiss/Defer for ACTIVE items). Integrates ActOnModal, DismissModal, DeferModal. Refetches data after status changes.

---

## Phase 7: Reports & Forecasting [US5, US7]

**Goal**: Report generation engine and reports viewer pages.
**Test criteria**: Daily report generates with margin snapshot and top 3 actions; weekly report includes trend and acted recommendations; monthly report includes MoM comparison, forecast, and category deep dive; reports list page shows historical reports with type filter; report detail page renders full content.

- [ ] T034 [US5, US7] Create report generator in `lib/cfo-strategist/report-generator.ts` with three functions: (1) `generateDailyReport(organizationId)` - margin snapshot, active alerts, top 3 recommendations by impact, (2) `generateWeeklyReport(organizationId)` - daily content + weekly margin trend, acted recommendations progress, new recommendations count, cost breakdown changes vs prior week, (3) `generateMonthlyReport(organizationId)` - weekly content + full MoM comparison (revenue/expenses/margin/profit), recommendation effectiveness review (acted vs impact using realized_savings), next month forecast via `projectNextMonthMargin()`, category-by-category deep dive (total cost, % of total, change, related recommendations). All functions upsert CfoReport by (org_id, report_type, period_start) unique constraint.
- [ ] T035 [US5, US7] Implement `getCfoReports(type?, limit?)` server action in `app/actions/cfo-strategist.ts` per api-contracts.md - queries CfoReport with optional type filter, orders by period_start DESC, default limit 10
- [ ] T036 [US5, US7] Implement `getCfoReportDetail(id)` server action in `app/actions/cfo-strategist.ts` per api-contracts.md - fetches single CfoReport with full report_content JSON, validates organization ownership
- [ ] T037 [P] [US5, US7] Create `components/cfo-strategist/ReportRenderer.tsx` - renders report_content JSON based on report_type. Daily: alerts list + top actions. Weekly: adds margin trend mini-chart (Tremor SparkChart) + acted recommendations + cost breakdown table. Monthly: adds MoM comparison cards + impact review table + forecast section + category deep dive accordion with per-category charts.
- [ ] T038 [US5, US7] Create reports list page `app/dashboard/strategist/reports/page.tsx` as 'use client' component - uses TanStack Query for data fetching, header with title "Reports", filter bar (Select for report type: all/daily/weekly/monthly), table with columns: Date Range, Type (badge), Margin, Revenue, Potential Savings. Rows link to detail page.
- [ ] T039 [US5, US7] Create report detail page `app/dashboard/strategist/reports/[id]/page.tsx` as 'use client' component - fetches report via TanStack Query calling `getCfoReportDetail(id)`, breadcrumb navigation back to reports list, report header (type badge, date range, summary metrics), body rendered by ReportRenderer component

---

## Phase 8: Alerts & Edge Function [US8]

**Goal**: Margin alert system and Supabase Edge Function with pg_cron for automated nightly computation.
**Test criteria**: Alerts created when margin drops below target; alerts created for 2+ month decline; alerts visible in existing notification center; Edge Function authenticates via Supabase service role key; nightly job runs engine + generates reports + creates alerts.

- [ ] T040 [US8] Create alert system in `lib/cfo-strategist/alerts.ts` - `checkAndCreateAlerts(organizationId, month, year)` that: (1) checks company margin vs target (creates notification if below), (2) checks for 2+ consecutive months of margin decline (creates notification), (3) checks each client's margin vs their target (creates notification per client below target). Uses existing Notification model with `source: 'CFO_STRATEGIST'`, `action_url` linking to `/dashboard/strategist`, `related_entity_type: 'cfo_recommendation'`. Avoids duplicate alerts by checking for existing unread notifications with same source + entity.
- [ ] T041 [US8] Create Supabase Edge Function `supabase/functions/cfo-strategist-nightly/index.ts` - Deno-based handler authenticated via Supabase service role key, fetches all organizations with active Mercury/Xero connections, for each org: (1) calls recommendation engine `generateRecommendations()`, (2) calls `generateDailyReport()`, (3) calls `generateWeeklyReport()` if Monday, (4) calls `generateMonthlyReport()` if 1st of month, (5) calls `checkAndCreateAlerts()`. Uses Promise.allSettled for org-level parallelism with 60s timeout. Returns summary JSON per api-contracts.md.
- [ ] T042 [US8] Create pg_cron migration to schedule nightly Edge Function - add migration SQL that registers a pg_cron job (`SELECT cron.schedule('cfo-strategist-nightly', '0 3 * * *', ...)`) to invoke the Edge Function at 3 AM UTC daily. Include unschedule in rollback procedure.
- [ ] T042b [US8] Verify notification UI integration - confirm that alerts created with `source: 'CFO_STRATEGIST'` appear in the existing notification center/bell icon, that `action_url` links navigate correctly to the CFO Strategist dashboard, and that marking notifications as read works. Add CFO_STRATEGIST source icon/color to notification renderer if needed.

---

## Phase 9: Impact Tracking & Polish [US9]

**Goal**: Close the feedback loop on acted-on recommendations and polish the UI with empty states and manual refresh.
**Test criteria**: Acted-on recommendations show realized vs expected savings after next computation cycle; accuracy score displays on dashboard; manual refresh recomputes recommendations with toast feedback; empty states display appropriate messages for all zero-data scenarios.

- [ ] T043 [US9] Add impact tracking logic to recommendation engine in `lib/cfo-strategist/recommendation-engine.ts` - during `generateRecommendations()`, for each recommendation with status=ACTED_ON that has a `baseline_metric_value`, compare current metric value to baseline, calculate `realized_savings`, and update the CfoRecommendation record
- [ ] T044 [US9] Implement `refreshRecommendations()` server action in `app/actions/cfo-strategist.ts` per api-contracts.md - calls `generateRecommendations()` for the current org, returns counts (new, updated, removed, conflicts_flagged). Used by manual refresh button.
- [ ] T045 [US9] Add manual refresh button to dashboard page `app/dashboard/strategist/page.tsx` - Button with RefreshCw icon in header, loading state (spinning icon), calls `refreshRecommendations()`, shows toast with "Refreshed: X new, Y updated, Z conflicts" on success or error toast on failure. Invalidates TanStack Query cache to refetch dashboard data.
- [ ] T046 [P] [US9] Add empty states to dashboard page `app/dashboard/strategist/page.tsx` - (1) no Mercury/Xero connection: show Card with message "Connect Mercury or Xero to get started" and link to Settings, (2) <2 months data: show Banner "Limited data available - recommendations will improve with more historical data", (3) no recommendations: show positive Card "Your margins are healthy! No optimization recommendations at this time.", (4) no reports: show Card "Reports will be generated automatically each day at 3 AM UTC."
- [ ] T047 [P] [US9] Add recommendation accuracy score calculation to `getStrategistDashboard()` in `app/actions/cfo-strategist.ts` - query ACTED_ON recommendations where `realized_savings IS NOT NULL`, calculate (count where realized_savings >= acted_on_expected_savings) / total acted count, return as accuracyScore percentage (null if no acted recommendations exist)

---

## Dependencies

```
Phase 1 (Setup) ──── must complete before all others
    │
    ▼
Phase 2 (Foundational) ──── must complete before Phases 3-9
    │
    ├──► Phase 3 (US1: Margin Goals & Thresholds) ──── independent
    │
    ├──► Phase 4 (US2: Engine Core) ──── depends on Phase 2 (margin goals resolver)
    │         │                           depends on Phase 3 T014b-c (thresholds)
    │         │
    │         ├──► Phase 5 (US2: Dashboard) ──── depends on Phase 4 (needs recommendations data)
    │         │
    │         ├──► Phase 6 (US2,US3,US4: Recommendation Mgmt) ──── depends on Phase 4 (needs recommendations)
    │         │
    │         ├──► Phase 7 (US5,US7: Reports) ──── depends on Phase 4 (needs recommendations for reports)
    │         │
    │         └──► Phase 8 (US8: Alerts & Edge Function) ──── depends on Phase 4 + 7 (engine + report generator)
    │
    └──► Phase 9 (US9: Impact & Polish) ──── depends on Phases 4 + 5 (engine + dashboard)

Phase 3 (US1) can run in parallel with Phase 4 (US2) after T014b-c complete
Phase 5 (US2) + Phase 6 (US2,US3,US4) + Phase 7 (US5,US7) can run in parallel after Phase 4
```

---

## Parallel Execution Opportunities

**Within Phase 3 (Margin Goals & Thresholds)**:
- T014b (threshold resolver) and T014c (migration) can run in parallel with T011-T012 (margin goal server actions)
- T014e (threshold UI) is parallelizable [P] with T013 (margin goal UI) after their respective server actions

**Within Phase 4 (Engine Core)**:
- T016 (staffing analyzer), T017 (revenue analyzer), T018 (overhead analyzer) are parallelizable [P] - they have no dependencies on each other, only on Phase 2 foundational types
- T018b (seasonal comparison), T018c (new client exclusion), T018d (zero-revenue classification) are parallelizable [P] with each other

**Within Phase 5 (Dashboard)**:
- T021-T025 (all dashboard components) are parallelizable [P] - independent UI components in different files

**Within Phase 6 (Recommendation Mgmt)**:
- T030 (ActOnModal), T031 (DismissModal), T032 (DeferModal) are parallelizable [P] - independent modal components

**Within Phase 7 (Reports)**:
- T037 (ReportRenderer) is parallelizable [P] with T035-T036 (server actions)

**Within Phase 9 (Polish)**:
- T046 (empty states) and T047 (accuracy score) are parallelizable [P]

**Cross-phase parallelism**:
- Phase 3 (US1: Margin Goals & Thresholds) can run in parallel with Phase 4 (US2: Engine Core) after T014b-c
- Phases 5, 6, 7 can all start simultaneously once Phase 4 completes

---

## Implementation Strategy

### MVP Scope (Phases 1-5)
The minimum viable CFO Strategist includes:
- Database schema (Phase 1)
- Margin goal and threshold configuration (Phases 2-3)
- Recommendation engine with all 4 analyzers + edge case handling (Phase 4)
- Financial health dashboard (Phase 5)

This delivers the core value: users can set margin targets and analyzer thresholds, the engine generates recommendations with seasonal awareness and conflict detection, and the dashboard shows margin health at a glance. **35 tasks, ~64% of total.**

### Full Scope (Phases 1-9)
Adds recommendation management, reports, alerts, Edge Function automation, and impact tracking. **55 tasks total.**

### Incremental Delivery Order
1. **MVP**: Phases 1-5 (dashboard with live recommendations)
2. **+Management**: Phase 6 (act on/dismiss/defer recommendations)
3. **+Automation**: Phases 7-8 (reports, alerts, Edge Function)
4. **+Feedback Loop**: Phase 9 (impact tracking, polish)

---

## Summary

| Metric | Count |
|--------|-------|
| **Total tasks** | 55 |
| **Phase 1 (Setup)** | 7 |
| **Phase 2 (Foundational)** | 3 |
| **Phase 3 (US1: Margin Goals & Thresholds)** | 8 |
| **Phase 4 (US2: Engine Core)** | 8 |
| **Phase 5 (US2: Dashboard)** | 8 |
| **Phase 6 (US2,US3,US4: Recommendation Mgmt)** | 6 |
| **Phase 7 (US5,US7: Reports)** | 6 |
| **Phase 8 (US8: Alerts & Edge Function)** | 4 |
| **Phase 9 (US9: Impact & Polish)** | 5 |
| **Parallelizable tasks [P]** | 22 |
| **MVP scope** | 35 tasks (Phases 1-5) |
| **New files** | 28 |
| **Modified files** | 4 |
