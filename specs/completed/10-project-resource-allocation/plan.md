# Implementation Plan: Project Resource Allocation & Cost Tracking

**Created**: 2026-03-03
**Feature**: [spec.md](spec.md)
**Branch**: `10-project-resource-allocation`

---

## Technical Context

| Aspect | Details |
|--------|---------|
| **Stack** | Next.js 16 (App Router), React 19, Prisma, Supabase (PostgreSQL), Tailwind CSS, shadcn/ui, Recharts |
| **Data Sources** | Existing models: Staff (rates), Contractor (rates), Subscription (monthly_cost), plus existing calculation engines in `lib/calculations/` |
| **Authentication** | `requireAuth()` + `getOrganizationId()` from `@/lib/auth/` |
| **Data Fetching** | Server Actions with direct Prisma queries (pattern from `app/actions/contractor-management.ts`) |
| **Charts** | Recharts (BarChart, LineChart, PieChart) with shadcn/ui Card wrappers |
| **Validation** | Zod schemas in `lib/validations/` |
| **Cost Calculation** | Reuses rate normalization from `lib/calculations/client-roi.ts` |

---

## Constitution Check

| Principle | Status | Notes |
|-----------|--------|-------|
| 1. Technology Stack | PASS | Uses mandatory stack (Next.js, Prisma, Supabase, Tailwind, shadcn/ui, Recharts) |
| 2. Data Architecture | PASS | All data scoped by `organization_id`; new models include org relation; soft deletes; UUID PKs |
| 3. Integration Philosophy | PASS | No new external integrations; reuses existing staff/contractor/subscription data |
| 4. Security Requirements | PASS | Auth via `requireAuth()`; data isolation via org scoping; RLS policies for new tables |
| 5. Performance Standards | PASS | Dashboard target <2s; cost snapshots pre-calculated for instant loading |
| 6. Code Quality | PASS | TypeScript strict mode; Prisma-generated types; Zod validation; audit trail on allocations |
| 7. Development Workflow | PASS | Feature branch `10-project-resource-allocation`; spec-driven development |
| 8. Prisma-Supabase Alignment | PASS | Pooler URLs; `prisma migrate dev`; `prisma generate`; rollback procedure in quickstart.md |

**Database Design Compliance**:
- UUID primary keys on all new tables
- `created_at`, `updated_at` timestamps on all entities
- Soft deletes with `deleted_at` nullable field on Project
- Indexes on foreign keys and frequently queried columns
- No raw SQL for schema (Prisma models only)
- No database triggers for business logic

---

## Architecture Overview

```
┌──────────────────────────────────────────────────────────────┐
│                        Frontend                               │
│                                                               │
│  Portfolio Dashboard              Project Detail               │
│  ┌─────────────────────┐         ┌──────────────────────────┐│
│  │ Summary KPIs         │         │ Project Header + Status  ││
│  │ Project Table        │         │ Cost Breakdown Cards     ││
│  │ (sort, filter, ROI)  │         │ Allocation Table         ││
│  │ Add Project Modal    │         │ Cost Trend Chart         ││
│  └──────────┬──────────┘         │ Revenue Entry            ││
│             │                     │ Add Allocation Modal     ││
│             │                     └──────────┬───────────────┘│
└─────────────┼────────────────────────────────┼────────────────┘
              │                                │
              ▼                                ▼
┌──────────────────────────────────────────────────────────────┐
│                   Server Actions Layer                         │
│                                                               │
│  project-management.ts    project-allocation.ts                │
│  ┌──────────────────┐    ┌──────────────────────┐            │
│  │ createProject     │    │ createAllocation      │            │
│  │ updateProject     │    │ updateAllocation      │            │
│  │ getProjects       │    │ removeAllocation      │            │
│  │ getProject        │    │ getProjectAllocations  │            │
│  │ archiveProject    │    └──────────┬───────────┘            │
│  └──────────┬───────┘               │                         │
│             │                        │                         │
│             │    project-metrics.ts   │                         │
│             │    ┌──────────────────┐│                         │
│             │    │ calculateSnapshot ││                         │
│             │    │ updateRevenue     ││                         │
│             │    │ getPortfolio      ││                         │
│             │    │   Summary         ││                         │
│             │    └──────────┬───────┘│                         │
└─────────────┼───────────────┼────────┼────────────────────────┘
              │               │        │
              ▼               ▼        ▼
┌──────────────────────────────────────────────────────────────┐
│                     Data Layer                                 │
│                                                               │
│  Prisma Models:                                               │
│  ┌──────────┐  ┌──────────────────┐  ┌──────────────────┐   │
│  │ Project   │──│ ProjectCost      │  │ ProjectCost      │   │
│  │           │  │ Allocation       │  │ Snapshot         │   │
│  └─────┬────┘  └────────┬─────────┘  └──────────────────┘   │
│        │                │                                     │
│        │    References existing:                               │
│        │    Staff, Contractor, Subscription                    │
│        │                                                       │
│  ┌─────┴────┐                                                 │
│  │ Client   │  (optional association)                          │
│  └──────────┘                                                 │
│                                                               │
│  Calculation Engine:                                           │
│  lib/calculations/project-costs.ts                             │
│  (reuses rate normalization from client-roi.ts)                │
└──────────────────────────────────────────────────────────────┘
```

---

## Implementation Phases

### Phase 1: Database Schema & Models
- Add `ProjectStatus` and `CostSourceType` enums to `prisma/schema.prisma`
- Add `Project`, `ProjectCostAllocation`, `ProjectCostSnapshot` models
- Add relations to `Organization` and `Client` models
- Run `prisma migrate dev` and `prisma generate`
- Verify migration with `prisma migrate status`

### Phase 2: Validation Schemas & Server Actions
- Create `lib/validations/project.ts` with Zod schemas
- Create `app/actions/project-management.ts` (CRUD)
- Create `app/actions/project-allocation.ts` (allocation management)
- Create `app/actions/project-metrics.ts` (cost calculation, revenue, portfolio summary)

### Phase 3: Cost Calculation Engine
- Create `lib/calculations/project-costs.ts`
- Resolve staff costs from `Staff.rate` + rate type normalization
- Resolve contractor costs from `Contractor.rate` + rate type normalization
- Resolve subscription costs from `Subscription.monthly_cost`
- Handle OTHER type via `fixed_amount`
- Aggregate by category and period
- Calculate ROI (handle zero-revenue gracefully)

### Phase 4: Portfolio Dashboard Page
- Create `app/dashboard/projects/page.tsx` (server component)
- Create `components/projects/ProjectPortfolioSummary.tsx` (KPI cards)
- Create `components/projects/ProjectTable.tsx` (sortable, filterable table)
- Create `components/projects/AddProjectModal.tsx` (create project form)
- Add "Projects" to sidebar navigation

### Phase 5: Project Detail Page
- Create `app/dashboard/projects/[id]/page.tsx` (server component)
- Create `components/projects/ProjectHeader.tsx` (name, status, actions)
- Create `components/projects/CostBreakdownCards.tsx` (4 category cards + total)
- Create `components/projects/AllocationTable.tsx` (list active allocations)
- Create `components/projects/AddAllocationModal.tsx` (assign cost sources)
- Create `components/projects/CostTrendChart.tsx` (Recharts line/bar chart)
- Create `components/projects/RevenueEntryForm.tsx` (manual revenue input)

### Phase 6: RLS Policies & Testing
- Add RLS policies for `projects`, `project_cost_allocations`, `project_cost_snapshots`
- Verify organization-scoped data isolation
- End-to-end flow testing: create project → add allocations → view costs → update revenue → check ROI

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Allocation % exceeding 100% across projects | Medium | Medium | Server-side validation on create/update |
| Cost calculation mismatch with client ROI | Low | High | Reuse same rate normalization logic |
| Large number of allocations per project | Low | Low | Pagination + indexes |
| Stale snapshots | Medium | Medium | Recalculate on-demand when viewing; timestamp shows freshness |

---

## Generated Artifacts

| Artifact | Path | Status |
|----------|------|--------|
| Research | [research.md](research.md) | Complete |
| Data Model | [data-model.md](data-model.md) | Complete |
| API Contracts | [contracts/server-actions.md](contracts/server-actions.md) | Complete |
| Quickstart | [quickstart.md](quickstart.md) | Complete |
| Implementation Plan | [plan.md](plan.md) (this file) | Complete |
