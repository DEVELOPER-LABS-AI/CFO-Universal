# Implementation Plan: CFO Strategist

**Created**: 2026-02-27
**Feature**: [spec.md](spec.md)
**Branch**: `7-cfo-strategist`

---

## Technical Context

| Aspect | Details |
|--------|---------|
| **Stack** | Next.js 16 (App Router), React 19, Prisma, Supabase (PostgreSQL), Tailwind CSS, shadcn/ui, Recharts |
| **Data Sources** | Existing calculation engines in `lib/calculations/` (client-roi, bdr-roi, overhead-allocation, subscription-cost-calculator, trend-reporter, agency-costs) |
| **Authentication** | `requireAuth()` + `getOrganizationId()` from `@/lib/auth/` |
| **Data Fetching** | Server Actions (no TanStack Query) with direct Prisma queries |
| **Charts** | Recharts (AreaChart, PieChart, BarChart) with shadcn/ui Card wrappers |
| **Notifications** | Existing Notification model with source field for categorization |
| **Cron** | Vercel cron via `vercel.json`, auth via `CRON_SECRET` header |
| **Settings** | Server Actions in `app/actions/organization-settings.ts` pattern |

---

## Constitution Check

| Principle | Status | Notes |
|-----------|--------|-------|
| 1. Technology Stack | PASS | Uses mandatory stack (Next.js, Prisma, Supabase, Tailwind, shadcn/ui, Recharts) |
| 2. Data Architecture | PASS | All data scoped by `organization_id`; new models include org relation and cascade delete |
| 3. Integration Philosophy | PASS | No new external integrations; reuses existing Mercury/Xero data |
| 4. Security Requirements | PASS | Auth via `requireAuth()`; data isolation via org scoping; no new API key exposure |
| 5. Performance Standards | PASS | Dashboard target <2s; pre-computed recommendations for instant loading |
| 6. Code Quality | PASS | TypeScript strict mode; Prisma-generated types; error handling with graceful degradation |
| 7. Development Workflow | PASS | Feature branch `7-cfo-strategist`; spec-driven development |
| 8. Prisma-Supabase Alignment | PASS | Pooler URLs; `prisma migrate dev`; `prisma generate`; rollback procedure documented |

**Database Design Compliance**:
- UUID primary keys on all new tables
- `created_at`, `updated_at` timestamps on all entities
- Soft deletes with `deleted_at` nullable field
- Indexes on foreign keys and frequently queried columns
- No raw SQL for schema (Prisma models only)
- No database triggers for business logic

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────┐
│                    Frontend                          │
│                                                      │
│  Settings Page          CFO Strategist Pages         │
│  ┌──────────────┐      ┌──────────────────────────┐ │
│  │ MarginGoal   │      │ Dashboard  │ Recommend-  │ │
│  │ Settings     │      │ (KPIs,     │ ations List │ │
│  └──────┬───────┘      │  Charts,   │ (Filter,    │ │
│         │              │  Clients)  │  Actions)   │ │
│         │              └─────┬──────┴──────┬──────┘ │
│         │                    │             │        │
│         │              ┌─────┴─────────────┴──────┐ │
│         │              │    Reports Page           │ │
│         │              │  (List + Detail View)     │ │
│         │              └──────────┬────────────────┘ │
└─────────┼────────────────────────┼──────────────────┘
          │                        │
          ▼                        ▼
┌─────────────────────────────────────────────────────┐
│              Server Actions Layer                    │
│  app/actions/cfo-strategist.ts                       │
│  ┌─────────────┐ ┌─────────────┐ ┌──────────────┐  │
│  │ Margin Goals│ │ Dashboard   │ │ Recommend-   │  │
│  │ CRUD        │ │ Data Fetch  │ │ ation Status │  │
│  └──────┬──────┘ └──────┬──────┘ └──────┬───────┘  │
└─────────┼───────────────┼───────────────┼───────────┘
          │               │               │
          ▼               ▼               ▼
┌─────────────────────────────────────────────────────┐
│           Recommendation Engine                      │
│  lib/cfo-strategist/                                 │
│  ┌──────────────────────────────────────────┐       │
│  │ recommendation-engine.ts (orchestrator)  │       │
│  └──────┬───────┬───────┬───────┬───────────┘       │
│         ▼       ▼       ▼       ▼                   │
│  ┌─────────┐┌────────┐┌───────┐┌──────────┐        │
│  │Subscrip-││Staffing││Revenue││Overhead  │        │
│  │tion     ││Analyzer││Analyz-││Analyzer  │        │
│  │Analyzer ││        ││er     ││          │        │
│  └────┬────┘└───┬────┘└───┬───┘└────┬─────┘        │
│       │         │         │         │               │
│       ▼         ▼         ▼         ▼               │
│  ┌──────────────────────────────────────────┐       │
│  │ Existing Calculation Engines             │       │
│  │ lib/calculations/                        │       │
│  │ (client-roi, bdr-roi, overhead-alloc,    │       │
│  │  subscription-cost, trend-reporter,      │       │
│  │  agency-costs)                           │       │
│  └──────────────────────────────────────────┘       │
│                                                      │
│  ┌──────────────────────────────────────────┐       │
│  │ report-generator.ts                      │       │
│  │ margin-goals.ts (target resolver)        │       │
│  └──────────────────────────────────────────┘       │
└─────────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────┐
│                   Data Layer                         │
│  ┌──────────────────┐  ┌──────────────────┐         │
│  │ CfoRecommendation│  │ CfoReport        │         │
│  │ (new)            │  │ (new)            │         │
│  └──────────────────┘  └──────────────────┘         │
│  ┌──────────────────┐  ┌──────────────────┐         │
│  │ FinancialTarget  │  │ ClientROI        │         │
│  │ (existing)       │  │ (existing)       │         │
│  └──────────────────┘  └──────────────────┘         │
│  ┌──────────────────┐  ┌──────────────────┐         │
│  │ Notification     │  │ CompanyMetrics   │         │
│  │ (existing)       │  │ (existing)       │         │
│  └──────────────────┘  └──────────────────┘         │
└─────────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────┐
│                   Cron Layer                         │
│  /api/cron/cfo-strategist (3 AM UTC daily)           │
│  1. Refresh ClientROI data                           │
│  2. Run recommendation engine                        │
│  3. Generate reports (daily/weekly/monthly)           │
│  4. Create alerts via Notification system             │
│  5. Reactivate deferred recommendations               │
└─────────────────────────────────────────────────────┘
```

---

## Implementation Phases

### Phase 1: Data Foundation

**Goal**: Schema, margin goals, and core data access layer.

**1.1 Prisma Schema Migration**
- Verify database connection (`npx prisma migrate status`)
- Add `CfoRecommendation` model with enums and indexes
- Add `CfoReport` model with enums and indexes
- Add relations on `Organization` model
- Run migration: `npx prisma migrate dev --name add_cfo_strategist_models`
- Run `npx prisma generate`
- Verify migration in Supabase dashboard

**1.2 Margin Goal Resolver**
- Create `lib/cfo-strategist/margin-goals.ts`
- `getEffectiveMarginTarget(clientId?)` - resolves target using hierarchy: client `custom_margin_target` -> FinancialTarget GLOBAL -> default 25%
- `getCompanyMarginTarget()` - returns GLOBAL FinancialTarget or 25% default
- `getAllClientMarginTargets()` - returns map of clientId -> effective target

**1.3 Margin Goal Settings UI**
- Create `components/settings/MarginGoalSettings.tsx` (client component)
- Add to Settings page under a new "Margin Goals" Card section
- Input for company-wide target percentage with save button
- Table of clients with current margin target (editable per-client override)
- Server actions: `getMarginGoals()`, `updateMarginGoal()`

---

### Phase 2: Recommendation Engine

**Goal**: Core analysis logic producing prioritized recommendations.

**2.1 Engine Orchestrator**
- Create `lib/cfo-strategist/recommendation-engine.ts`
- `generateRecommendations(organizationId, month, year)` - runs all 4 analyzers, deduplicates, upserts
- Handles deferred recommendation reactivation (check `deferred_until < now()`)
- Handles dismissed recommendation reactivation (check 15% metric change from `dismissed_metric_snapshot`)

**2.2 Subscription Analyzer**
- Create `lib/cfo-strategist/analyzers/subscription-analyzer.ts`
- Queries all active subscriptions for the organization
- Uses `computeSubscriptionPeriodCost()` and `getSubscriptionTrend()` from existing engines
- Generates recommendations for:
  - Zero/low allocation subscriptions (potential waste)
  - Cost increases >10% MoM
  - Similar-named subscriptions (consolidation candidates)
- Calculates confidence based on data completeness

**2.3 Staffing Analyzer**
- Create `lib/cfo-strategist/analyzers/staffing-analyzer.ts`
- Queries all contractors, staff, and their client assignments
- Uses `calculateClientCosts()`, `calculateAttributedRevenue()`, `calculateBDRTotalCost()` from existing engines
- Generates recommendations for:
  - Low utilization (few/no client assignments)
  - High cost-to-revenue ratio outliers (>1.5x company average)
  - Clients where contractor costs exceed revenue
  - Reallocation opportunities

**2.4 Revenue Analyzer**
- Create `lib/cfo-strategist/analyzers/revenue-analyzer.ts`
- Queries all ClientROI data and revenue trends
- Uses `getClientRevenue()` and `computeTrend()` from existing engines
- Generates recommendations for:
  - Clients 10+ points below margin target
  - Declining revenue trends (3+ months)
  - High-margin upsell candidates
  - Underpriced services

**2.5 Overhead Analyzer**
- Create `lib/cfo-strategist/analyzers/overhead-analyzer.ts`
- Uses `calculateOverheadAllocation()` and `getAllAgencyAvgMonthlySpend()` from existing engines
- Generates recommendations for:
  - Overhead costs disproportionate to revenue
  - Agency spend trending up without proportional revenue increase
  - Internal project costs that could be reduced

---

### Phase 3: Reports & Alerts

**Goal**: Periodic report generation and margin alert system.

**3.1 Report Generator**
- Create `lib/cfo-strategist/report-generator.ts`
- `generateDailyReport(organizationId)` - margin snapshot, alerts, top 3 actions
- `generateWeeklyReport(organizationId)` - includes weekly trend, acted recommendations, cost breakdown changes
- `generateMonthlyReport(organizationId)` - full deep dive with MoM comparisons, impact review, forecast, category analysis
- Stores report as `CfoReport` with structured JSON content

**3.2 Margin Forecasting**
- Create `lib/cfo-strategist/forecasting.ts`
- `projectNextMonthMargin(organizationId)` - linear regression on last 3-6 months of margin data
- Used by dashboard and monthly reports

**3.3 Alert System**
- Create `lib/cfo-strategist/alerts.ts`
- Uses existing `Notification` model with `source: 'CFO_STRATEGIST'`
- Alert triggers:
  - Margin drops below target threshold
  - 2+ consecutive months of margin decline
  - Individual client margin drops below their target
- Each alert includes `action_url` linking to relevant strategist page
- Each alert links to a recommendation via `related_entity_type: 'cfo_recommendation'`

**3.4 Cron Job**
- Create `app/api/cron/cfo-strategist/route.ts`
- Runs at 3 AM UTC daily (after Mercury/Xero sync at 2 AM)
- Auth via `CRON_SECRET` header
- Steps: refresh ROI -> run engine -> generate reports -> create alerts
- Add to `vercel.json` cron config

---

### Phase 4: Dashboard UI

**Goal**: CFO Strategist dashboard with KPIs, charts, and client breakdown.

**4.1 Dashboard Page**
- Create `app/dashboard/strategist/page.tsx` (client component)
- Follow Analytics page pattern: `useState` + Server Actions
- Server action: `getStrategistDashboard()` in `app/actions/cfo-strategist.ts`
- Layout:
  - KPI summary cards (4 cards: current margin, target, projected, accuracy score)
  - Margin trend chart (6-month AreaChart with target line overlay)
  - Top 3 recommendations (Card list with action buttons)
  - Per-client margin table (color-coded: green/yellow/red)

**4.2 Dashboard Components**
- Create `components/cfo-strategist/MarginKPICards.tsx`
- Create `components/cfo-strategist/MarginTrendChart.tsx` (Recharts AreaChart)
- Create `components/cfo-strategist/TopRecommendations.tsx`
- Create `components/cfo-strategist/ClientMarginTable.tsx`
- Create `components/cfo-strategist/RecommendationCategoryCounts.tsx`

**4.3 Sidebar Navigation**
- Update `components/dashboard/Sidebar.tsx`
- Add to "Insights" navGroup: `{ label: 'CFO Strategist', href: '/dashboard/strategist', icon: Target }`

---

### Phase 5: Recommendations & Reports UI

**Goal**: Detailed recommendations page with actions, and reports viewer.

**5.1 Recommendations Page**
- Create `app/dashboard/strategist/recommendations/page.tsx`
- Full list of recommendations with category/status filters
- Each recommendation shows: title, description, estimated impact, confidence, entity name
- Action buttons: "Mark as Acted On" (with expected savings input), "Dismiss" (with reason input), "Defer" (with date picker)
- Server actions: `getRecommendations()`, `updateRecommendationStatus()`

**5.2 Recommendation Action Modals**
- Create `components/cfo-strategist/ActOnModal.tsx` - input for expected savings
- Create `components/cfo-strategist/DismissModal.tsx` - input for reason
- Create `components/cfo-strategist/DeferModal.tsx` - date picker

**5.3 Reports Page**
- Create `app/dashboard/strategist/reports/page.tsx`
- List of historical reports with type filter (daily/weekly/monthly)
- Summary row: date range, margin, revenue, potential savings
- Click to view detail

**5.4 Report Detail Page**
- Create `app/dashboard/strategist/reports/[id]/page.tsx`
- Renders full report content based on `reportContent` JSON
- Uses Recharts for embedded trend charts
- Shows category deep dives, impact reviews, forecasts

---

### Phase 6: Impact Tracking & Polish

**Goal**: Close the feedback loop and refine the experience.

**6.1 Impact Tracking Logic**
- Add to recommendation engine: when processing acted-on recommendations, compare current metric to `baseline_metric_value`
- Calculate `realized_savings` and update the recommendation record
- Surface in monthly report's "impact review" section

**6.2 Recommendation Accuracy Score**
- Calculate: (recommendations where realized_savings >= acted_on_expected_savings) / total acted recommendations
- Display on dashboard as a percentage

**6.3 Manual Refresh Button**
- Add refresh button to dashboard header
- Calls `refreshRecommendations()` server action
- Shows loading state and toast on completion

**6.4 Empty States**
- Dashboard with no data: show setup guide pointing to Mercury/Xero integration
- Dashboard with <2 months data: show limited analysis notice
- No recommendations: show "healthy margins" positive state
- No reports: show "reports will be generated automatically" message

---

## File Manifest

### New Files

| File | Purpose |
|------|---------|
| `prisma/migrations/*/migration.sql` | Schema migration for CfoRecommendation, CfoReport |
| `lib/cfo-strategist/margin-goals.ts` | Margin target resolution logic |
| `lib/cfo-strategist/recommendation-engine.ts` | Orchestrator for all analyzers |
| `lib/cfo-strategist/analyzers/subscription-analyzer.ts` | Subscription optimization analysis |
| `lib/cfo-strategist/analyzers/staffing-analyzer.ts` | Staffing efficiency analysis |
| `lib/cfo-strategist/analyzers/revenue-analyzer.ts` | Revenue opportunity analysis |
| `lib/cfo-strategist/analyzers/overhead-analyzer.ts` | Overhead reduction analysis |
| `lib/cfo-strategist/report-generator.ts` | Daily/weekly/monthly report generation |
| `lib/cfo-strategist/forecasting.ts` | Linear trend margin forecasting |
| `lib/cfo-strategist/alerts.ts` | Margin alert creation via Notification system |
| `app/actions/cfo-strategist.ts` | Server actions for all CFO Strategist data |
| `app/api/cron/cfo-strategist/route.ts` | Nightly cron endpoint |
| `app/dashboard/strategist/page.tsx` | Dashboard page |
| `app/dashboard/strategist/recommendations/page.tsx` | Recommendations list page |
| `app/dashboard/strategist/reports/page.tsx` | Reports list page |
| `app/dashboard/strategist/reports/[id]/page.tsx` | Report detail page |
| `components/settings/MarginGoalSettings.tsx` | Margin goal settings component |
| `components/cfo-strategist/MarginKPICards.tsx` | KPI summary cards |
| `components/cfo-strategist/MarginTrendChart.tsx` | 6-month margin trend chart |
| `components/cfo-strategist/TopRecommendations.tsx` | Top 3 recommendation cards |
| `components/cfo-strategist/ClientMarginTable.tsx` | Per-client margin breakdown table |
| `components/cfo-strategist/RecommendationCategoryCounts.tsx` | Category summary badges |
| `components/cfo-strategist/ActOnModal.tsx` | Act-on recommendation modal |
| `components/cfo-strategist/DismissModal.tsx` | Dismiss recommendation modal |
| `components/cfo-strategist/DeferModal.tsx` | Defer recommendation modal |
| `components/cfo-strategist/ReportRenderer.tsx` | Report content renderer |

### Modified Files

| File | Change |
|------|--------|
| `prisma/schema.prisma` | Add CfoRecommendation, CfoReport models, enums, Organization relations |
| `components/dashboard/Sidebar.tsx` | Add CFO Strategist nav item under Insights |
| `app/dashboard/settings/page.tsx` | Add MarginGoalSettings Card section |
| `vercel.json` | Add cron schedule for `/api/cron/cfo-strategist` |

---

## Risk Mitigation

| Risk | Impact | Mitigation |
|------|--------|------------|
| Recommendation engine takes too long during cron | Delayed daily briefing | Process organizations in parallel with Promise.allSettled; add timeout per org (60s) |
| Insufficient data produces misleading recommendations | Bad user trust | Confidence scoring tied to data completeness; clear "limited data" indicators |
| Nightly cron conflicts with Mercury/Xero sync | Stale data in recommendations | Schedule 1 hour after sync (3 AM vs 2 AM); verify last sync timestamp before running |
| Schema migration breaks existing features | Downtime | New tables only (no ALTER on existing); additive changes; rollback procedure documented |
| Polymorphic target_entity_id becomes unresolvable | Orphaned recommendations | Soft deletes on source entities; handle missing entity gracefully in UI |

---

## Testing Strategy

| Layer | Tool | Coverage |
|-------|------|----------|
| Recommendation analyzers | Jest unit tests | Each analyzer produces correct recommendations for known data scenarios |
| Margin goal resolver | Jest unit tests | Hierarchy (client -> global -> default) works correctly |
| Report generator | Jest unit tests | Correct report structure for each type |
| Forecasting | Jest unit tests | Linear projection accuracy with known data |
| Server actions | Jest integration tests | Auth, data transformation, error handling |
| Cron endpoint | Jest integration tests | Auth verification, processing pipeline |
| Dashboard UI | Playwright E2E | Page loads, charts render, actions work |
| Recommendation actions | Playwright E2E | Mark as acted on, dismiss, defer flows |

---

## Artifacts

- [Research](research.md)
- [Data Model](data-model.md)
- [API Contracts](contracts/api-contracts.md)
- [Quickstart](quickstart.md)
