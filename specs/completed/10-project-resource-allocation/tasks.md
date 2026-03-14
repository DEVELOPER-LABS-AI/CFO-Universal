# Tasks: Project Resource Allocation & Cost Tracking

**Created**: 2026-03-03
**Feature**: [spec.md](spec.md)
**Plan**: [plan.md](plan.md)
**Branch**: `10-project-resource-allocation`

---

## User Story Map

| Story | Scenario | Functional Reqs | Priority |
|-------|----------|-----------------|----------|
| US1 | Scenario 5: Finance Creates a New Project | FR-1 (Project Entity Management) | P1 |
| US2 | Scenarios 2 & 3: Finance Assigns Resources | FR-2, FR-3 (Subscription/Staff/Contractor Allocation) | P1 |
| US3 | — (calculation layer) | FR-4, FR-5 (Cost Aggregation, ROI & Metrics) | P1 |
| US4 | Scenario 1: Leadership Reviews Portfolio | FR-6 (Portfolio Dashboard) | P1 |
| US5 | Scenario 4: Historical Tracking & Lifecycle | FR-7 (Historical Cost Tracking, Status Management) | P2 |

---

## Phase 1: Setup

- [x] T001 Verify database connection with `npx prisma migrate status`
- [x] T002 Add `ProjectStatus` and `CostSourceType` enums to `prisma/schema.prisma`
- [x] T003 Add `Project` model to `prisma/schema.prisma` per data-model.md (UUID PK, organization_id, name, description, status, client_id, budget_target, start_date, end_date, deleted_at, timestamps, indexes)
- [x] T004 Add `ProjectCostAllocation` model to `prisma/schema.prisma` per data-model.md (project_id, cost_source_type, cost_source_id, allocation_percentage, fixed_amount, effective dates, created_by, indexes)
- [x] T005 Add `ProjectCostSnapshot` model to `prisma/schema.prisma` per data-model.md (project_id, period_month, period_year, cost columns, revenue, roi, unique constraint, indexes)
- [x] T006 Add `projects Project[]` relation to existing `Organization` model in `prisma/schema.prisma`
- [x] T007 Add `projects Project[]` relation to existing `Client` model in `prisma/schema.prisma`
- [x] T008 Run `npx prisma migrate dev --name add_project_resource_allocation` and `npx prisma generate`
- [x] T009 Verify migration with `npx prisma migrate status` — all migrations applied

---

## Phase 2: Foundational

- [x] T010 Create Zod validation schemas (`createProjectSchema`, `updateProjectSchema`, `createAllocationSchema`, `updateAllocationSchema`) in `lib/validations/project.ts` per contracts/server-actions.md
- [x] T011 [P] Add "Projects" navigation item to sidebar in `components/dashboard/Sidebar.tsx` with route `/dashboard/projects`

---

## Phase 3: Project CRUD [US1]

> **Story Goal**: Finance can create, view, edit, and archive projects as top-level entities.
> **Test Criteria**: Create a project with name, description, client, budget → view it in list → edit details → archive it → confirm soft delete preserves data.

- [x] T012 [US1] Implement `createProject` server action in `app/actions/project-management.ts` — validate with createProjectSchema, enforce name uniqueness per org, verify client org match, revalidatePath
- [x] T013 [US1] Implement `getProjects` server action in `app/actions/project-management.ts` — filter by status/client/search, exclude deleted, include current month snapshot data (total_costs, revenue, roi), include allocation count
- [x] T014 [US1] Implement `getProject` server action in `app/actions/project-management.ts` — fetch single project with allocations, current month snapshot, last 12 months snapshots
- [x] T015 [US1] Implement `updateProject` server action in `app/actions/project-management.ts` — validate with updateProjectSchema, enforce status transition rules (ACTIVE→UNDER_REVIEW→SUNSET→ARCHIVED), revalidatePath
- [x] T016 [US1] Implement `archiveProject` server action in `app/actions/project-management.ts` — set deleted_at timestamp, revalidatePath
- [x] T017 [P] [US1] Create `AddProjectModal` component in `components/projects/AddProjectModal.tsx` — form with name, description, client dropdown (from existing clients), budget target, start/end dates, uses createProject action, toast on success/error
- [x] T018 [US1] Create project list page as server component in `app/dashboard/projects/page.tsx` — call getProjects, render AddProjectModal trigger button, render ProjectTable

---

## Phase 4: Cost Allocation Management [US2]

> **Story Goal**: Finance can assign subscriptions, staff, contractors, and other costs to projects with percentage-based allocation.
> **Test Criteria**: Assign a subscription at 50% → assign a staff member at 100% → verify total allocation validation (cannot exceed 100% per source) → end an allocation → verify audit trail (old record preserved).

- [x] T019 [US2] Implement `createAllocation` server action in `app/actions/project-allocation.ts` — validate with createAllocationSchema, check total allocation ≤ 100% per (cost_source_type, cost_source_id) across all projects, verify source exists in org, revalidatePath
- [x] T020 [US2] Implement `getProjectAllocations` server action in `app/actions/project-allocation.ts` — fetch active allocations for project, resolve source names (Staff.name, Contractor.name, Subscription.name), calculate monthly_cost per allocation
- [x] T021 [US2] Implement `updateAllocation` server action in `app/actions/project-allocation.ts` — soft-end old allocation (set effective_end_date), create new record with updated values (append-only audit trail), revalidatePath
- [x] T022 [US2] Implement `removeAllocation` server action in `app/actions/project-allocation.ts` — set effective_end_date to today, revalidatePath
- [x] T023 [P] [US2] Create `AllocationTable` component in `components/projects/AllocationTable.tsx` — display allocations with source name, type badge, allocation %, monthly cost, effective dates, remove button
- [x] T024 [US2] Create `AddAllocationModal` component in `components/projects/AddAllocationModal.tsx` — step 1: select cost_source_type (tabs or radio), step 2: pick source from dropdown (Staff/Contractor/Subscription filtered by org), step 3: set allocation %, dates, notes. Uses createAllocation action, show remaining available % for selected source

---

## Phase 5: Cost Calculation Engine & Metrics [US3]

> **Story Goal**: System aggregates all allocated costs into per-project financial snapshots with ROI calculation.
> **Test Criteria**: Project with 2 staff (50%, 100%), 1 subscription (75%), 1 OTHER ($500) → calculate snapshot → verify total matches sum of categories → set revenue → verify ROI = (revenue - cost) / cost → zero-revenue project shows null ROI.

- [x] T025 [US3] Create cost resolution functions in `lib/calculations/project-costs.ts` — `resolveStaffMonthlyCost(staffId)`, `resolveContractorMonthlyCost(contractorId)`, `resolveSubscriptionMonthlyCost(subscriptionId)` reusing rate normalization patterns from `lib/calculations/client-roi.ts`
- [x] T026 [US3] Implement `calculateProjectCosts(projectId, month, year)` in `lib/calculations/project-costs.ts` — fetch active allocations for period, resolve each cost, aggregate by category (subscription_costs, staff_costs, contractor_costs, other_costs), return totals
- [x] T027 [US3] Implement `calculateProjectSnapshot` server action in `app/actions/project-metrics.ts` — call calculateProjectCosts, compute ROI (null when revenue=0, (revenue-total)/total otherwise), upsert ProjectCostSnapshot record
- [x] T028 [US3] Implement `updateProjectRevenue` server action in `app/actions/project-metrics.ts` — upsert snapshot with manual revenue value, recalculate ROI, revalidatePath
- [x] T029 [US3] Implement `getPortfolioSummary` server action in `app/actions/project-metrics.ts` — aggregate across all active projects: total_projects, active_projects, total_investment, total_revenue, overall_roi, projects_over_budget, projects_negative_roi

---

## Phase 6: Portfolio Dashboard [US4]

> **Story Goal**: Leadership can view all projects with financial health at a glance, sort/filter, and identify underperformers.
> **Test Criteria**: Dashboard shows KPI summary cards → project table with all metrics → sort by ROI → filter by status → negative ROI projects flagged with color → drill into project detail.

- [x] T030 [US4] Create `ProjectPortfolioSummary` component in `components/projects/ProjectPortfolioSummary.tsx` — KPI cards showing: total projects, total investment, total revenue, overall ROI, projects over budget (red), projects with negative ROI (amber). Use shadcn/ui Card pattern
- [x] T031 [US4] Create `ProjectTable` component in `components/projects/ProjectTable.tsx` — sortable columns (name, status, total cost, revenue, ROI, budget utilization), filterable by status and client, color-coded ROI (green positive, red negative), budget exceeded warning, click row → navigate to `/dashboard/projects/[id]`
- [x] T032 [US4] Update `app/dashboard/projects/page.tsx` to fetch portfolio summary via getPortfolioSummary, render ProjectPortfolioSummary + ProjectTable with data from getProjects

---

## Phase 7: Project Detail Page [US5]

> **Story Goal**: Leadership can drill into a project, review cost breakdown by category, view trends over time, enter revenue, and manage project lifecycle status.
> **Test Criteria**: Detail page shows all cost categories with subtotals → trend chart displays 12-month history → revenue entry updates ROI → status change to "Under Review" or "Sunset" works → cost history visible for any past period.

- [x] T033 [US5] Create `ProjectHeader` component in `components/projects/ProjectHeader.tsx` — project name, status badge (color-coded), description, client link, budget target, edit button (opens inline edit or modal), status change dropdown
- [x] T034 [P] [US5] Create `CostBreakdownCards` component in `components/projects/CostBreakdownCards.tsx` — 5 cards: Subscriptions, Staff, Contractors, Other, Total. Each shows current month amount. Total card shows budget utilization % if budget_target set. Color indicators for over-budget
- [x] T035 [P] [US5] Create `CostTrendChart` component in `components/projects/CostTrendChart.tsx` — Recharts BarChart or LineChart showing monthly costs (stacked by category) and revenue line over last 12 months. Follow pattern from `components/cfo-strategist/MarginTrendChart.tsx`
- [x] T036 [US5] Create `RevenueEntryForm` component in `components/projects/RevenueEntryForm.tsx` — month/year picker, revenue amount input, save button calling updateProjectRevenue action, displays current saved revenue, toast feedback
- [x] T037 [US5] Create project detail page as server component in `app/dashboard/projects/[id]/page.tsx` — call getProject, render ProjectHeader, CostBreakdownCards, AllocationTable + AddAllocationModal, CostTrendChart, RevenueEntryForm. Trigger calculateProjectSnapshot on load for current month if stale (>24h)

---

## Phase 8: Polish & Cross-Cutting Concerns

- [x] T038 Add RLS policies for `projects` table — SELECT/INSERT/UPDATE/DELETE scoped by `organization_id` matching authenticated user's org
- [x] T039 Add RLS policies for `project_cost_allocations` table — scoped via join to `projects.organization_id`
- [x] T040 Add RLS policies for `project_cost_snapshots` table — scoped via join to `projects.organization_id`
- [x] T041 Handle edge case: zero-revenue projects display "N/A" for ROI instead of error in `ProjectTable` and `CostBreakdownCards`
- [x] T042 Handle edge case: shared resources — display remaining available allocation % in `AddAllocationModal` source picker
- [x] T043 Add empty states for `ProjectTable` (no projects yet) and `AllocationTable` (no allocations yet) using existing `EmptyState` component pattern
- [x] T044 Verify Decimal → number serialization for all server actions returning Prisma Decimal fields (follow pattern from `app/actions/contractor-management.ts`)
- [x] T045 Run `npm run build` to verify no TypeScript errors and clean production build

---

## Dependencies

```
Phase 1 (Setup)
  └─→ Phase 2 (Foundational)
        ├─→ Phase 3 (US1: Project CRUD)
        │     └─→ Phase 4 (US2: Allocation) ─→ Phase 5 (US3: Calculation)
        │                                           └─→ Phase 6 (US4: Dashboard)
        │                                           └─→ Phase 7 (US5: Detail Page)
        └─→ Phase 8 (Polish) — after all US phases complete
```

**Story Dependencies**:
- US1 (Project CRUD) is independent — MVP
- US2 (Allocation) depends on US1 (needs project to allocate to)
- US3 (Calculation) depends on US2 (needs allocations to calculate)
- US4 (Dashboard) depends on US3 (needs metrics data)
- US5 (Detail Page) depends on US2 + US3 (needs allocations + metrics)

---

## Parallel Execution Opportunities

**Within Phase 1** (Setup):
- T002-T007 can be done in a single schema edit session (sequential within file)

**Within Phase 3** (US1):
- T017 (AddProjectModal component) can be built in parallel with T012-T016 (server actions)

**Within Phase 4** (US2):
- T023 (AllocationTable component) can be built in parallel with T019-T022 (server actions)

**Within Phase 5** (US3):
- T025-T026 (calculation engine) are independent of T029 (portfolio summary)

**Within Phase 7** (US5):
- T034 (CostBreakdownCards) and T035 (CostTrendChart) can be built in parallel

---

## Implementation Strategy

**MVP Scope**: Phases 1-3 (US1: Project CRUD)
- Delivers: ability to create, list, edit, and archive projects
- Validates: schema, migrations, basic server actions, and page routing

**Increment 2**: Phase 4 (US2: Allocation)
- Delivers: full cost assignment capability
- Validates: allocation validation, source resolution, audit trail

**Increment 3**: Phases 5-6 (US3 + US4: Calculation + Dashboard)
- Delivers: financial visibility at portfolio level
- Validates: cost aggregation accuracy, ROI calculations, KPI summary

**Increment 4**: Phase 7 (US5: Detail Page)
- Delivers: deep project-level financial analysis
- Validates: trend charts, revenue entry, status lifecycle

**Final**: Phase 8 (Polish)
- Delivers: production readiness
- Validates: RLS, edge cases, build success
