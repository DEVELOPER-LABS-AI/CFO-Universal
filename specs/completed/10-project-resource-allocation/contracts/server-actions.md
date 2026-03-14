# API Contracts: Project Resource Allocation

**Created**: 2026-03-03
**Feature**: [../spec.md](../spec.md)

All mutations use Next.js Server Actions. All actions require authentication via `requireAuth()` and organization scoping via `getOrganizationId()`.

---

## File: `app/actions/project-management.ts`

### `getProjects(filters?)`

Fetch all projects for the current organization.

**Input**:
```typescript
{
  status?: ProjectStatus;          // Filter by status
  client_id?: string;              // Filter by client association
  search?: string;                 // Search by name
}
```

**Output**:
```typescript
{
  projects: Array<{
    id: string;
    name: string;
    description: string | null;
    status: ProjectStatus;
    client: { id: string; name: string } | null;
    budget_target: number | null;
    start_date: string;
    end_date: string | null;
    total_costs: number;           // Current month total
    total_revenue: number;         // Current month revenue
    roi: number | null;            // Current month ROI
    allocation_count: number;      // Number of active allocations
  }>;
}
```

---

### `getProject(projectId)`

Fetch a single project with full details.

**Input**: `projectId: string`

**Output**:
```typescript
{
  project: {
    id: string;
    name: string;
    description: string | null;
    status: ProjectStatus;
    client: { id: string; name: string } | null;
    budget_target: number | null;
    start_date: string;
    end_date: string | null;
    created_at: string;
    updated_at: string;
    allocations: Array<ProjectCostAllocationWithSource>;
    current_month_snapshot: ProjectCostSnapshot | null;
    monthly_snapshots: ProjectCostSnapshot[];  // Last 12 months
  };
}
```

---

### `createProject(data)`

Create a new project.

**Input** (Zod schema: `createProjectSchema`):
```typescript
{
  name: string;                    // Required, 1-200 chars
  description?: string;            // Optional
  client_id?: string;              // Optional UUID
  budget_target?: number;          // Optional, >= 0
  start_date: string;              // Required, ISO date
  end_date?: string;               // Optional, must be >= start_date
}
```

**Output**: `{ project: Project }`

**Validation**:
- Name unique within organization
- Client must belong to same organization if provided

**Side Effects**: `revalidatePath('/dashboard/projects')`

---

### `updateProject(projectId, data)`

Update project details.

**Input** (Zod schema: `updateProjectSchema`):
```typescript
{
  name?: string;
  description?: string;
  client_id?: string | null;       // null to remove association
  budget_target?: number | null;   // null to remove target
  status?: ProjectStatus;
  end_date?: string | null;
}
```

**Output**: `{ project: Project }`

**Validation**:
- Status transitions enforced (see data-model state machine)
- Name unique within organization if changed

**Side Effects**: `revalidatePath('/dashboard/projects')`, `revalidatePath('/dashboard/projects/[id]')`

---

### `archiveProject(projectId)`

Soft-delete a project (set `deleted_at`).

**Input**: `projectId: string`

**Output**: `{ success: boolean }`

**Side Effects**: `revalidatePath('/dashboard/projects')`

---

## File: `app/actions/project-allocation.ts`

### `getProjectAllocations(projectId)`

Fetch all active allocations for a project with resolved source names.

**Input**: `projectId: string`

**Output**:
```typescript
{
  allocations: Array<{
    id: string;
    cost_source_type: CostSourceType;
    cost_source_id: string;
    source_name: string;             // Resolved: staff name, subscription name, etc.
    allocation_percentage: number;
    fixed_amount: number | null;
    effective_start_date: string;
    effective_end_date: string | null;
    monthly_cost: number;            // Calculated: rate × allocation %
    notes: string | null;
  }>;
}
```

---

### `createAllocation(data)`

Assign a cost source to a project.

**Input** (Zod schema: `createAllocationSchema`):
```typescript
{
  project_id: string;              // Required UUID
  cost_source_type: CostSourceType; // STAFF | CONTRACTOR | SUBSCRIPTION | OTHER
  cost_source_id: string;          // Required UUID (ignored for OTHER if fixed_amount set)
  allocation_percentage: number;   // 1-100
  fixed_amount?: number;           // Required for OTHER type, >= 0
  effective_start_date: string;    // Required, ISO date
  effective_end_date?: string;     // Optional
  notes?: string;
}
```

**Output**: `{ allocation: ProjectCostAllocation }`

**Validation**:
- Total allocation for `(cost_source_type, cost_source_id)` across all projects <= 100%
- Source must exist and belong to same organization
- `fixed_amount` required when `cost_source_type = OTHER`

**Side Effects**: `revalidatePath('/dashboard/projects/[id]')`

---

### `updateAllocation(allocationId, data)`

Update an existing allocation. Creates a new record for audit trail (soft-ends the old one).

**Input** (Zod schema: `updateAllocationSchema`):
```typescript
{
  allocation_percentage?: number;
  fixed_amount?: number;
  effective_end_date?: string;
  notes?: string;
}
```

**Output**: `{ allocation: ProjectCostAllocation }`

**Side Effects**: `revalidatePath('/dashboard/projects/[id]')`

---

### `removeAllocation(allocationId)`

End an allocation by setting `effective_end_date` to today.

**Input**: `allocationId: string`

**Output**: `{ success: boolean }`

**Side Effects**: `revalidatePath('/dashboard/projects/[id]')`

---

## File: `app/actions/project-metrics.ts`

### `calculateProjectSnapshot(projectId, month, year)`

Calculate and upsert a cost snapshot for a project for a given period.

**Input**:
```typescript
{
  project_id: string;
  month: number;    // 1-12
  year: number;
}
```

**Output**: `{ snapshot: ProjectCostSnapshot }`

**Logic**:
1. Fetch all active allocations for the project in the given period
2. For each allocation, resolve the monthly cost from the source's rate/cost data
3. Aggregate by category (subscription, staff, contractor, other)
4. Upsert the snapshot record

---

### `updateProjectRevenue(projectId, month, year, revenue)`

Manually set the revenue for a project in a given period.

**Input**:
```typescript
{
  project_id: string;
  month: number;
  year: number;
  revenue: number;   // >= 0
}
```

**Output**: `{ snapshot: ProjectCostSnapshot }`

**Logic**: Upsert the snapshot record with the provided revenue, recalculate ROI.

---

### `getPortfolioSummary()`

Fetch aggregated metrics across all active projects.

**Input**: None (uses current organization)

**Output**:
```typescript
{
  summary: {
    total_projects: number;
    active_projects: number;
    total_investment: number;       // Sum of all project costs (current month)
    total_revenue: number;          // Sum of all project revenue (current month)
    overall_roi: number | null;
    projects_over_budget: number;   // Count of projects exceeding budget_target
    projects_negative_roi: number;  // Count of projects with ROI < 0
  };
}
```

---

## Validation Schemas: `lib/validations/project.ts`

```typescript
import { z } from 'zod';

export const createProjectSchema = z.object({
  name: z.string().min(1, 'Project name is required').max(200).trim(),
  description: z.string().max(2000).optional(),
  client_id: z.string().uuid().optional(),
  budget_target: z.number().min(0).optional(),
  start_date: z.string().date(),
  end_date: z.string().date().optional(),
}).refine(
  (data) => !data.end_date || data.end_date >= data.start_date,
  { message: 'End date must be after start date', path: ['end_date'] }
);

export const updateProjectSchema = z.object({
  name: z.string().min(1).max(200).trim().optional(),
  description: z.string().max(2000).nullable().optional(),
  client_id: z.string().uuid().nullable().optional(),
  budget_target: z.number().min(0).nullable().optional(),
  status: z.nativeEnum(ProjectStatus).optional(),
  end_date: z.string().date().nullable().optional(),
});

export const createAllocationSchema = z.object({
  project_id: z.string().uuid(),
  cost_source_type: z.nativeEnum(CostSourceType),
  cost_source_id: z.string().uuid(),
  allocation_percentage: z.number().min(1).max(100),
  fixed_amount: z.number().min(0).optional(),
  effective_start_date: z.string().date(),
  effective_end_date: z.string().date().optional(),
  notes: z.string().max(1000).optional(),
});

export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;
export type CreateAllocationInput = z.infer<typeof createAllocationSchema>;
```
