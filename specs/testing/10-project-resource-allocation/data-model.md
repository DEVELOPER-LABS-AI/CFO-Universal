# Data Model: Project Resource Allocation & Cost Tracking

**Created**: 2026-03-03
**Feature**: [spec.md](spec.md)

---

## New Enums

### ProjectStatus

```prisma
enum ProjectStatus {
  ACTIVE
  UNDER_REVIEW
  SUNSET
  ARCHIVED

  @@map("ProjectStatus")
}
```

**State Transitions**:
- `ACTIVE` → `UNDER_REVIEW` (leadership flags for review)
- `UNDER_REVIEW` → `ACTIVE` (cleared to continue)
- `UNDER_REVIEW` → `SUNSET` (decision to discontinue)
- `SUNSET` → `ARCHIVED` (all allocations ended, historical only)
- `ACTIVE` → `ARCHIVED` (direct archive for completed projects)

### CostSourceType

```prisma
enum CostSourceType {
  STAFF
  CONTRACTOR
  SUBSCRIPTION
  OTHER

  @@map("CostSourceType")
}
```

---

## New Models

### Project

Top-level entity representing a funded initiative, product, or internal project.

```prisma
model Project {
  id              String        @id @default(uuid()) @db.Uuid
  organization_id String        @db.Uuid
  name            String        @db.VarChar(200)
  description     String?       @db.Text
  status          ProjectStatus @default(ACTIVE)
  client_id       String?       @db.Uuid
  budget_target   Decimal?      @db.Decimal(12, 2)
  start_date      DateTime      @db.Date
  end_date        DateTime?     @db.Date
  created_at      DateTime      @default(now()) @db.Timestamptz(6)
  updated_at      DateTime      @updatedAt @db.Timestamptz(6)
  deleted_at      DateTime?     @db.Timestamptz(6)

  organization     Organization            @relation(fields: [organization_id], references: [id], onDelete: Cascade)
  client           Client?                 @relation(fields: [client_id], references: [id], onDelete: SetNull)
  cost_allocations ProjectCostAllocation[]
  cost_snapshots   ProjectCostSnapshot[]

  @@index([organization_id])
  @@index([client_id])
  @@index([status])
  @@map("projects")
}
```

**Validation Rules**:
- `name` required, unique within organization (enforced at server action level)
- `budget_target` must be >= 0 if provided
- `start_date` required; `end_date` must be >= `start_date` if provided
- `status` transitions enforced at server action level (see state machine above)

**Relationships**:
- Belongs to `Organization` (mandatory, cascade delete)
- Optionally belongs to `Client` (set null on client deletion)
- Has many `ProjectCostAllocation` (cost assignments)
- Has many `ProjectCostSnapshot` (monthly aggregates)

---

### ProjectCostAllocation

Junction record linking a cost source to a project with percentage-based attribution.

```prisma
model ProjectCostAllocation {
  id                    String         @id @default(uuid()) @db.Uuid
  project_id            String         @db.Uuid
  cost_source_type      CostSourceType
  cost_source_id        String         @db.Uuid
  allocation_percentage Decimal        @db.Decimal(5, 2)
  fixed_amount          Decimal?       @db.Decimal(12, 2)
  effective_start_date  DateTime       @db.Date
  effective_end_date    DateTime?      @db.Date
  notes                 String?        @db.Text
  created_by            String         @db.Uuid
  created_at            DateTime       @default(now()) @db.Timestamptz(6)
  updated_at            DateTime       @updatedAt @db.Timestamptz(6)

  project Project @relation(fields: [project_id], references: [id], onDelete: Cascade)

  @@index([project_id])
  @@index([cost_source_type, cost_source_id])
  @@index([effective_start_date, effective_end_date])
  @@map("project_cost_allocations")
}
```

**Validation Rules**:
- `allocation_percentage` must be 1-100
- Total allocation for a single `(cost_source_type, cost_source_id)` across all projects cannot exceed 100% (enforced at server action level)
- `fixed_amount` only used when `cost_source_type = OTHER`; must be >= 0
- `effective_start_date` required; `effective_end_date` must be >= start if provided
- `created_by` references the User who created the allocation (audit trail)
- New records are created for allocation changes (old records are not mutated — append-only audit trail)

**Relationships**:
- Belongs to `Project` (cascade delete)
- References cost source by type + ID (polymorphic — no FK constraint)

---

### ProjectCostSnapshot

Monthly aggregated cost and revenue record for reporting and trend analysis.

```prisma
model ProjectCostSnapshot {
  id                 String   @id @default(uuid()) @db.Uuid
  project_id         String   @db.Uuid
  period_month       Int
  period_year        Int
  subscription_costs Decimal  @default(0) @db.Decimal(12, 2)
  staff_costs        Decimal  @default(0) @db.Decimal(12, 2)
  contractor_costs   Decimal  @default(0) @db.Decimal(12, 2)
  other_costs        Decimal  @default(0) @db.Decimal(12, 2)
  total_costs        Decimal  @default(0) @db.Decimal(12, 2)
  revenue            Decimal  @default(0) @db.Decimal(12, 2)
  roi                Decimal? @db.Decimal(8, 4)
  calculated_at      DateTime @default(now()) @db.Timestamptz(6)

  project Project @relation(fields: [project_id], references: [id], onDelete: Cascade)

  @@unique([project_id, period_month, period_year])
  @@index([period_year, period_month])
  @@map("project_cost_snapshots")
}
```

**Validation Rules**:
- `period_month` must be 1-12
- `period_year` must be >= 2020
- One snapshot per project per period (unique constraint)
- `roi` is null when revenue is 0 (avoids division by zero)
- `roi` calculated as `(revenue - total_costs) / total_costs` when revenue > 0
- `total_costs` = `subscription_costs + staff_costs + contractor_costs + other_costs`

**Relationships**:
- Belongs to `Project` (cascade delete)

---

## Modified Models

### Organization

Add relation to Project:

```prisma
// Add to existing Organization model:
projects Project[]
```

### Client

Add relation to Project:

```prisma
// Add to existing Client model:
projects Project[]
```

---

## Indexes Summary

| Table | Index | Purpose |
|-------|-------|---------|
| `projects` | `organization_id` | Multi-tenant data isolation |
| `projects` | `client_id` | Client association lookups |
| `projects` | `status` | Filter by lifecycle status |
| `project_cost_allocations` | `project_id` | Fetch allocations for a project |
| `project_cost_allocations` | `cost_source_type, cost_source_id` | Validate total allocation per source |
| `project_cost_allocations` | `effective_start_date, effective_end_date` | Period-based queries |
| `project_cost_snapshots` | `project_id, period_month, period_year` | Unique per period (composite unique) |
| `project_cost_snapshots` | `period_year, period_month` | Time-series queries |

---

## RLS Considerations

All three new tables must have RLS policies matching existing patterns:
- `projects`: SELECT/INSERT/UPDATE/DELETE scoped by `organization_id`
- `project_cost_allocations`: Scoped via join to `projects.organization_id`
- `project_cost_snapshots`: Scoped via join to `projects.organization_id`
