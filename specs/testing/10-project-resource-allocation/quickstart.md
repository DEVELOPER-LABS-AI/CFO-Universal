# Quickstart: Project Resource Allocation & Cost Tracking

**Created**: 2026-03-03
**Feature**: [spec.md](spec.md)

---

## Prerequisites

- Node.js 18+
- Supabase project with pooler URLs configured in `.env`
- Existing data: at least one organization, client, staff member, and subscription

## Setup Steps

### 1. Verify Database Connection

```bash
npx prisma migrate status
```

Must return successfully before proceeding.

### 2. Apply Schema Migration

```bash
npx prisma migrate dev --name add_project_resource_allocation
npx prisma generate
```

This adds:
- `ProjectStatus` enum
- `CostSourceType` enum
- `projects` table
- `project_cost_allocations` table
- `project_cost_snapshots` table

### 3. Verify Migration

```bash
npx prisma migrate status
```

All migrations should show as applied.

### 4. Add RLS Policies

Apply RLS policies via Supabase dashboard or migration SQL for the three new tables. Scope all policies by `organization_id` (direct on `projects`, via join on the other two).

### 5. Start Development Server

```bash
npm run dev
```

Navigate to `/dashboard/projects` to see the empty project portfolio dashboard.

## Quick Verification

1. Create a project via the "Add Project" button
2. Assign a staff member or subscription via the project detail page
3. Verify the cost shows up in the project's financial summary
4. Check the portfolio dashboard shows the project with correct totals

## Key Files

| File | Purpose |
|------|---------|
| `prisma/schema.prisma` | New models: Project, ProjectCostAllocation, ProjectCostSnapshot |
| `app/actions/project-management.ts` | CRUD for projects |
| `app/actions/project-allocation.ts` | Allocation management |
| `app/actions/project-metrics.ts` | Cost calculation and snapshots |
| `lib/validations/project.ts` | Zod schemas |
| `lib/calculations/project-costs.ts` | Cost aggregation logic |
| `app/dashboard/projects/page.tsx` | Portfolio dashboard |
| `app/dashboard/projects/[id]/page.tsx` | Project detail view |
| `components/projects/` | UI components |

## Rollback

If schema changes need to be reverted:

```bash
# Check current migration state
npx prisma migrate status

# Rollback by reverting the migration file and running:
npx prisma migrate dev
```

For production, use `npx prisma migrate resolve` if manual intervention is needed.
