# Feature 15: Timesheets & Time Tracking - Data Model

**Status**: Finalized
**Created**: 2026-03-06
**Research Reference**: specs/15-timesheets/research.md

---

## New Enums

```prisma
// ============================================================================
// FEATURE 15: TIMESHEETS & TIME TRACKING ENUMS
// ============================================================================

enum TimesheetStatus {
  DRAFT
  SUBMITTED
  APPROVED
  REJECTED

  @@map("TimesheetStatus")
}
```

### Enum Notes

- **Separate from InvoiceStatus**: Timesheets do not have a `PAID` state. Using a dedicated enum avoids coupling with the contractor invoice lifecycle and allows future divergence (e.g., adding `RECALLED`).
- **@@map convention**: Follows existing codebase pattern (PascalCase map name matching enum name).

---

## New Models

### Timesheet

The weekly submission unit grouping time entries for a single staff member.

```prisma
model Timesheet {
  id              String          @id @default(uuid())
  organization_id String
  staff_id        String
  period_start    DateTime        @db.Date // Monday of the week
  period_end      DateTime        @db.Date // Sunday of the week
  status          TimesheetStatus @default(DRAFT)

  // Aggregated totals (denormalized for query performance, updated on entry save)
  total_hours     Decimal         @default(0) @db.Decimal(6, 2)
  billable_hours  Decimal         @default(0) @db.Decimal(6, 2)
  overtime_hours  Decimal         @default(0) @db.Decimal(6, 2)

  // Submission fields
  submitted_at    DateTime?
  submitted_by    String?         // user_id of the submitter (auth.users.id)

  // Review fields
  reviewed_at     DateTime?
  reviewed_by     String?         // UserProfile.id of the reviewer
  rejection_reason String?

  // Standard fields
  deleted_at      DateTime?       // Soft delete
  created_at      DateTime        @default(now())
  updated_at      DateTime        @updatedAt

  // Relations
  organization Organization @relation(fields: [organization_id], references: [id], onDelete: Cascade)
  staff        Staff        @relation(fields: [staff_id], references: [id], onDelete: Restrict)
  reviewer     UserProfile? @relation("TimesheetReviewer", fields: [reviewed_by], references: [id])
  entries      TimeEntry[]

  // Constraints
  @@unique([staff_id, period_start]) // One timesheet per staff per week
  @@index([organization_id])
  @@index([organization_id, status])
  @@index([staff_id])
  @@index([staff_id, period_start])
  @@index([status])
  @@index([period_start, period_end])
  @@index([reviewed_by])
  @@map("timesheets")
}
```

#### Field Details

| Field | Type | Description |
|---|---|---|
| `period_start` | `Date` | Always a Monday. Validated at application layer. |
| `period_end` | `Date` | Always the following Sunday (period_start + 6 days). |
| `total_hours` | `Decimal(6,2)` | Sum of all TimeEntry hours. Max realistic value: 168 (24*7). |
| `billable_hours` | `Decimal(6,2)` | Sum of hours where `is_billable = true`. |
| `overtime_hours` | `Decimal(6,2)` | Hours exceeding OvertimeConfig threshold. Calculated on submit. |
| `submitted_by` | `String?` | The auth.users.id of the staff member who submitted. Nullable for drafts. |
| `reviewed_by` | `String?` | FK to UserProfile.id. Follows ContractorInvoice pattern. |
| `rejection_reason` | `String?` | Required when status transitions to REJECTED. Min 10 chars enforced at app layer. |

---

### TimeEntry

An individual record of hours worked on a specific date for a specific assignment.

```prisma
model TimeEntry {
  id              String   @id @default(uuid())
  timesheet_id    String
  staff_id        String   // Denormalized from Timesheet for query convenience
  assignment_id   String?  // Nullable for non-assigned (bench) time
  project_id      String?  // Optional project reference
  entry_date      DateTime @db.Date
  hours           Decimal  @db.Decimal(4, 2) // 0.25 - 24.00
  description     String?  @db.Text // Optional in DRAFT, required on SUBMITTED
  is_billable     Boolean  @default(true)
  is_overtime     Boolean  @default(false) // Set during overtime calculation

  // Standard fields
  created_at      DateTime @default(now())
  updated_at      DateTime @updatedAt

  // Relations
  timesheet  Timesheet       @relation(fields: [timesheet_id], references: [id], onDelete: Cascade)
  staff      Staff           @relation(fields: [staff_id], references: [id], onDelete: Restrict)
  assignment StaffAssignment? @relation(fields: [assignment_id], references: [id], onDelete: Restrict)
  project    Project?        @relation(fields: [project_id], references: [id], onDelete: SetNull)

  // Constraints: prevent duplicate entries for same day + assignment
  @@unique([timesheet_id, entry_date, assignment_id])
  @@index([timesheet_id])
  @@index([staff_id])
  @@index([assignment_id])
  @@index([project_id])
  @@index([entry_date])
  @@index([timesheet_id, entry_date])
  @@map("time_entries")
}
```

#### Field Details

| Field | Type | Description |
|---|---|---|
| `staff_id` | `String` | Denormalized from parent Timesheet for efficient per-staff queries without joins. |
| `assignment_id` | `String?` | Nullable to allow bench/non-billable time for unassigned staff. When null, `is_billable` defaults to `false`. |
| `project_id` | `String?` | Optional project link. A staff member may log time against a client assignment without specifying a project. |
| `entry_date` | `Date` | Must fall within parent Timesheet's `period_start` to `period_end` range. |
| `hours` | `Decimal(4,2)` | Minimum 0.25, maximum 24.00. Validated in 0.25 increments at app layer. |
| `description` | `Text?` | Optional while timesheet is DRAFT. Required on all entries when timesheet is submitted. |
| `is_billable` | `Boolean` | Defaults to `true`. Set to `false` for internal work, bench time, or PTO-equivalent. |
| `is_overtime` | `Boolean` | Calculated field. Set to `true` during overtime distribution when total weekly hours exceed threshold. |

#### Unique Constraint Note

The `@@unique([timesheet_id, entry_date, assignment_id])` constraint prevents duplicate entries for the same day and assignment. For bench time (null assignment_id), PostgreSQL treats each null as unique, so multiple null-assignment entries on the same day are allowed. This is acceptable because bench time may be logged against different projects or descriptions.

---

### OvertimeConfig

Organization-level overtime settings.

```prisma
model OvertimeConfig {
  id                    String   @id @default(uuid())
  organization_id       String   @unique // One config per org
  weekly_hours_threshold Decimal @default(40) @db.Decimal(5, 2)
  overtime_multiplier   Decimal  @default(1.5) @db.Decimal(3, 2) // e.g., 1.5x
  is_enabled            Boolean  @default(true)
  created_at            DateTime @default(now())
  updated_at            DateTime @updatedAt

  // Relations
  organization Organization @relation(fields: [organization_id], references: [id], onDelete: Cascade)

  @@index([organization_id])
  @@map("overtime_configs")
}
```

#### Field Details

| Field | Type | Description |
|---|---|---|
| `weekly_hours_threshold` | `Decimal(5,2)` | Hours per week before overtime kicks in. Default: 40.00. Must be > 0. |
| `overtime_multiplier` | `Decimal(3,2)` | Multiplier applied to the bill rate for overtime hours. Default: 1.50. Must be >= 1.00. |
| `is_enabled` | `Boolean` | When `false`, no overtime calculation is performed regardless of hours. |

---

## Relation Additions to Existing Models

### Organization

```prisma
model Organization {
  // ... existing fields ...

  // Feature 15: Timesheets & Time Tracking
  timesheets       Timesheet[]
  overtime_config  OvertimeConfig?
}
```

### Staff

```prisma
model Staff {
  // ... existing fields ...

  // Feature 15: Timesheets & Time Tracking
  timesheets   Timesheet[]
  time_entries TimeEntry[]
}
```

### StaffAssignment

```prisma
model StaffAssignment {
  // ... existing fields ...

  // Feature 15: Timesheets & Time Tracking
  time_entries TimeEntry[]
}
```

### Project

```prisma
model Project {
  // ... existing fields ...

  // Feature 15: Timesheets & Time Tracking
  time_entries TimeEntry[]
}
```

### UserProfile

```prisma
model UserProfile {
  // ... existing fields ...

  // Feature 15: Timesheets & Time Tracking
  reviewed_timesheets Timesheet[] @relation("TimesheetReviewer")
}
```

### NotificationType enum

Add new values to the existing enum:

```prisma
enum NotificationType {
  // ... existing values ...
  TIMESHEET_SUBMITTED
  TIMESHEET_APPROVED
  TIMESHEET_REJECTED
  TIMESHEET_REMINDER
}
```

---

## Entity Relationship Diagram (Text)

```
Organization (1) ──── (*) Timesheet ──── (*) TimeEntry
     |                      |                   |
     |                      |                   ├── StaffAssignment (?)
     |                      |                   ├── Project (?)
     |                      |                   └── Staff (1)
     |                      |
     |                      ├── Staff (1)
     |                      └── UserProfile (? as reviewer)
     |
     └──── (0..1) OvertimeConfig
```

---

## Indexes Rationale

### Timesheet Indexes

| Index | Purpose |
|---|---|
| `[organization_id]` | Multi-tenant filtering (all queries scoped by org) |
| `[organization_id, status]` | Approval queue: "show all SUBMITTED timesheets in my org" |
| `[staff_id]` | Staff portal: "show my timesheets" |
| `[staff_id, period_start]` | Unique constraint support + week lookup |
| `[status]` | Global status filtering |
| `[period_start, period_end]` | Period range queries for reporting |
| `[reviewed_by]` | "Timesheets I've reviewed" queries |

### TimeEntry Indexes

| Index | Purpose |
|---|---|
| `[timesheet_id]` | Load all entries for a timesheet (primary read pattern) |
| `[staff_id]` | Per-staff entry queries across timesheets |
| `[assignment_id]` | Per-assignment hour summaries for billing |
| `[project_id]` | Per-project hour summaries |
| `[entry_date]` | Date range queries |
| `[timesheet_id, entry_date]` | Daily view within a timesheet |

---

## Validation Rules Summary

### Timesheet-Level

| Rule | Enforcement | Location |
|---|---|---|
| One timesheet per staff per week | DB unique constraint | `@@unique([staff_id, period_start])` |
| `period_start` must be a Monday | Zod schema + app logic | `lib/validations/timesheet.ts` |
| `period_end` = `period_start` + 6 days | Auto-calculated | Server action on create |
| Status transitions follow DRAFT->SUBMITTED->APPROVED/REJECTED | App logic | Server action |
| 2-week lookback for staff creation | App logic | Server action |
| `rejection_reason` required (min 10 chars) on rejection | Zod refine | `lib/validations/timesheet.ts` |
| Total hours = sum of entry hours | App logic | Recalculated on entry save |

### TimeEntry-Level

| Rule | Enforcement | Location |
|---|---|---|
| Hours: 0.25 - 24.00 | Zod schema | `lib/validations/timesheet.ts` |
| Hours in 0.25 increments | Zod refine | `lib/validations/timesheet.ts` |
| Max 24 hours per day (sum across entries) | App logic | Server action |
| `entry_date` within timesheet period | Zod + app logic | Server action |
| `description` required when submitting | App logic (pre-submit check) | Server action |
| No duplicates per day+assignment | DB unique constraint | `@@unique([timesheet_id, entry_date, assignment_id])` |
| Assignment must be active on entry_date | App logic | Server action |
| Entries only editable in DRAFT or REJECTED status | App logic | Server action |

### OvertimeConfig-Level

| Rule | Enforcement | Location |
|---|---|---|
| One config per organization | DB unique constraint | `@unique` on `organization_id` |
| Threshold > 0 | Zod schema | `lib/validations/timesheet.ts` |
| Multiplier >= 1.0 | Zod schema | `lib/validations/timesheet.ts` |

---

## Migration Notes

### Migration Name

```
prisma/migrations/YYYYMMDDHHMMSS_add_timesheets_time_entries_overtime_config/
```

### Steps

1. Verify database connection: `npx prisma migrate status`
2. Add enum `TimesheetStatus` to schema
3. Add new `NotificationType` values
4. Add models: `OvertimeConfig`, `Timesheet`, `TimeEntry`
5. Add relation fields to `Organization`, `Staff`, `StaffAssignment`, `Project`, `UserProfile`
6. Run migration: `npx prisma migrate dev --name add_timesheets_time_entries_overtime_config`
7. Generate client: `npx prisma generate`
8. Verify: `npx prisma migrate status`

### Rollback Procedure

```sql
-- Rollback: Drop tables and enum in reverse order
DROP TABLE IF EXISTS "time_entries" CASCADE;
DROP TABLE IF EXISTS "timesheets" CASCADE;
DROP TABLE IF EXISTS "overtime_configs" CASCADE;
DROP TYPE IF EXISTS "TimesheetStatus" CASCADE;
-- Remove new NotificationType values (ALTER TYPE ... cannot DROP VALUE in PG15;
-- safe to leave values in place as they are unused until feature code is deployed)
```

After manual rollback, sync Prisma tracking:
```bash
npx prisma migrate resolve --rolled-back <migration_name>
```
