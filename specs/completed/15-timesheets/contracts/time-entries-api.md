# Time Entries API Contract

**Feature**: 15 - Timesheets & Time Tracking
**Domain**: Time Entry CRUD
**Pattern**: Server Actions for mutations, embedded in Timesheet reads

---

## Server Actions (Mutations)

All server actions live in `app/actions/timesheet-actions.ts`.

### SA-1: upsertTimeEntry

Creates or updates a time entry within a draft/rejected timesheet.

**File**: `app/actions/timesheet-actions.ts`

```typescript
// Request
interface UpsertTimeEntryInput {
  timesheet_id: string;
  entry_id?: string;       // If provided, updates existing entry; if omitted, creates new
  assignment_id?: string;  // Nullable for bench time
  project_id?: string;     // Optional
  entry_date: string;      // ISO date (YYYY-MM-DD)
  hours: number;           // 0.25 - 24.00 in 0.25 increments
  description?: string;    // Optional in DRAFT, required on submit
  is_billable?: boolean;   // Default: true
}

// Zod Schema
const upsertTimeEntrySchema = z.object({
  timesheet_id: z.string().uuid('Invalid timesheet ID'),
  entry_id: z.string().uuid('Invalid entry ID').optional(),
  assignment_id: z.string().uuid('Invalid assignment ID').optional().nullable(),
  project_id: z.string().uuid('Invalid project ID').optional().nullable(),
  entry_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD format'),
  hours: z.number()
    .min(0.25, 'Minimum 0.25 hours')
    .max(24, 'Maximum 24 hours per entry')
    .refine((v) => v % 0.25 === 0, 'Hours must be in 0.25 increments'),
  description: z.string().max(2000).trim().optional().nullable(),
  is_billable: z.boolean().optional().default(true),
});

// Response (success)
interface UpsertTimeEntryResponse {
  success: true;
  entry: TimeEntryResponse;
  timesheet_totals: {
    total_hours: number;
    billable_hours: number;
    day_total: number; // Total hours for the entry_date across all entries
  };
}

interface TimeEntryResponse {
  id: string;
  timesheet_id: string;
  staff_id: string;
  assignment_id: string | null;
  project_id: string | null;
  entry_date: string;
  hours: number;
  description: string | null;
  is_billable: boolean;
  is_overtime: boolean;
  created_at: string;
  updated_at: string;
  // Joined data for display
  client_name?: string;
  project_name?: string;
}

// Response (error)
interface ErrorResponse {
  error: string;
  code: 'VALIDATION_ERROR' | 'NOT_FOUND' | 'FORBIDDEN' | 'TIMESHEET_LOCKED'
      | 'DAY_LIMIT_EXCEEDED' | 'ASSIGNMENT_INACTIVE' | 'DUPLICATE_ENTRY' | 'SERVER_ERROR';
}
```

**Authorization**: Staff member who owns the parent timesheet.

**Business Rules**:
- Parent timesheet must be in DRAFT or REJECTED status
- `entry_date` must fall within timesheet's `period_start` to `period_end`
- Total hours for the day (across all entries) must not exceed 24
- If `assignment_id` is provided, the assignment must be active on `entry_date`
- If `assignment_id` is null, `is_billable` is forced to `false`
- On successful save, recalculates parent timesheet's `total_hours` and `billable_hours`
- Duplicate check: if entry exists for same `timesheet_id + entry_date + assignment_id`, update it (upsert behavior)

**Errors**:
| Code | Condition |
|---|---|
| `NOT_FOUND` | Timesheet or entry does not exist |
| `FORBIDDEN` | User does not own this timesheet |
| `TIMESHEET_LOCKED` | Timesheet is in SUBMITTED or APPROVED status |
| `DAY_LIMIT_EXCEEDED` | Adding this entry would push daily total over 24 hours |
| `ASSIGNMENT_INACTIVE` | The referenced assignment is not active on entry_date |
| `DUPLICATE_ENTRY` | An entry already exists for this date + assignment (when creating, not upserting) |

---

### SA-2: deleteTimeEntry

Removes a time entry from a draft/rejected timesheet.

**File**: `app/actions/timesheet-actions.ts`

```typescript
// Request
interface DeleteTimeEntryInput {
  entry_id: string;
}

// Zod Schema
const deleteTimeEntrySchema = z.object({
  entry_id: z.string().uuid('Invalid entry ID'),
});

// Response (success)
interface DeleteTimeEntryResponse {
  success: true;
  timesheet_totals: {
    total_hours: number;
    billable_hours: number;
  };
}

// Response (error)
interface ErrorResponse {
  error: string;
  code: 'NOT_FOUND' | 'FORBIDDEN' | 'TIMESHEET_LOCKED' | 'SERVER_ERROR';
}
```

**Authorization**: Staff member who owns the parent timesheet.

**Business Rules**:
- Parent timesheet must be in DRAFT or REJECTED status
- On successful delete, recalculates parent timesheet's `total_hours` and `billable_hours`

**Errors**:
| Code | Condition |
|---|---|
| `NOT_FOUND` | Entry does not exist |
| `FORBIDDEN` | User does not own this timesheet |
| `TIMESHEET_LOCKED` | Timesheet is in SUBMITTED or APPROVED status |

---

### SA-3: batchUpsertTimeEntries

Creates or updates multiple time entries at once (for grid save).

**File**: `app/actions/timesheet-actions.ts`

```typescript
// Request
interface BatchUpsertTimeEntriesInput {
  timesheet_id: string;
  entries: Array<{
    entry_id?: string;
    assignment_id?: string | null;
    project_id?: string | null;
    entry_date: string;
    hours: number;
    description?: string | null;
    is_billable?: boolean;
  }>;
}

// Zod Schema
const batchUpsertTimeEntriesSchema = z.object({
  timesheet_id: z.string().uuid(),
  entries: z.array(
    z.object({
      entry_id: z.string().uuid().optional(),
      assignment_id: z.string().uuid().optional().nullable(),
      project_id: z.string().uuid().optional().nullable(),
      entry_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      hours: z.number().min(0.25).max(24).refine((v) => v % 0.25 === 0, 'Hours must be in 0.25 increments'),
      description: z.string().max(2000).trim().optional().nullable(),
      is_billable: z.boolean().optional().default(true),
    })
  ).min(1).max(70), // Max: 7 days * 10 assignments
});

// Response (success)
interface BatchUpsertResponse {
  success: true;
  entries: TimeEntryResponse[];
  timesheet_totals: {
    total_hours: number;
    billable_hours: number;
  };
  errors: Array<{
    index: number;
    entry_date: string;
    assignment_id: string | null;
    error: string;
  }>;
}
```

**Authorization**: Staff member who owns the parent timesheet.

**Business Rules**:
- Same validation rules as single upsert, applied per entry
- Validates per-day totals across all entries in the batch plus existing entries
- Uses database transaction: if any entry fails validation, reports it in `errors` array but commits valid entries (partial success)
- Recalculates timesheet totals once after all entries are processed

---

## Read Patterns

Time entries are **not** exposed via standalone API routes. They are always loaded as part of the parent Timesheet:

- **GET /api/timesheets/[id]** returns `entries[]` nested in the timesheet response
- Entries are sorted by `entry_date ASC, assignment_id ASC`

### Computed Views (not persisted)

The following computed views are returned by the Timesheet detail endpoint:

```typescript
// Daily totals view (for the weekly grid)
interface DailyTotalsView {
  date: string;
  day_name: string; // 'Monday', 'Tuesday', etc.
  total_hours: number;
  billable_hours: number;
  entries: TimeEntryResponse[];
}

// Assignment totals view (for the row summaries)
interface AssignmentTotalsView {
  assignment_id: string | null;
  client_name: string;
  total_hours: number;
  billable_hours: number;
  entries_by_date: Record<string, TimeEntryResponse>;
}
```

These views are computed server-side and included in the Timesheet detail response to support the grid UI without additional round-trips.
