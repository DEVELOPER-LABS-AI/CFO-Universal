# Timesheets API Contract

**Feature**: 15 - Timesheets & Time Tracking
**Domain**: Timesheet CRUD + Lifecycle
**Pattern**: Server Actions for mutations, API Routes for reads

---

## Server Actions (Mutations)

All server actions live in `app/actions/timesheet-actions.ts` (staff-facing) and `app/actions/timesheet-admin-actions.ts` (admin-facing).

### SA-1: getOrCreateDraftTimesheet

Creates a new DRAFT timesheet for the given week, or returns the existing one.

**File**: `app/actions/timesheet-actions.ts`

```typescript
// Request
interface GetOrCreateDraftTimesheetInput {
  period_start: string; // ISO date string, must be a Monday (YYYY-MM-DD)
}

// Zod Schema
const getOrCreateDraftTimesheetSchema = z.object({
  period_start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD format'),
});

// Response (success)
interface TimesheetResponse {
  id: string;
  organization_id: string;
  staff_id: string;
  period_start: string;
  period_end: string;
  status: 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED';
  total_hours: number;
  billable_hours: number;
  overtime_hours: number;
  submitted_at: string | null;
  reviewed_at: string | null;
  reviewed_by: string | null;
  rejection_reason: string | null;
  created_at: string;
  updated_at: string;
  entries: TimeEntryResponse[];
}

// Response (error)
interface ErrorResponse {
  error: string;
  code: 'VALIDATION_ERROR' | 'NOT_FOUND' | 'FORBIDDEN' | 'LOOKBACK_EXCEEDED' | 'SERVER_ERROR';
}
```

**Authorization**: Authenticated staff member. `staff_id` is derived from the session user.

**Business Rules**:
- `period_start` must be a Monday
- Staff can only create timesheets for current week + prior 2 weeks
- If timesheet already exists for the week, returns it regardless of status
- Auto-calculates `period_end` as `period_start + 6 days`

**Errors**:
| Code | Condition |
|---|---|
| `VALIDATION_ERROR` | `period_start` is not a Monday or invalid format |
| `LOOKBACK_EXCEEDED` | Period is more than 2 weeks in the past |
| `FORBIDDEN` | User is not a staff member or not authorized |

---

### SA-2: submitTimesheet

Transitions a DRAFT or REJECTED timesheet to SUBMITTED status.

**File**: `app/actions/timesheet-actions.ts`

```typescript
// Request
interface SubmitTimesheetInput {
  timesheet_id: string;
}

// Zod Schema
const submitTimesheetSchema = z.object({
  timesheet_id: z.string().uuid('Invalid timesheet ID'),
});

// Response (success)
interface SubmitTimesheetResponse {
  success: true;
  timesheet: TimesheetResponse;
}

// Response (error)
interface ErrorResponse {
  error: string;
  code: 'VALIDATION_ERROR' | 'NOT_FOUND' | 'FORBIDDEN' | 'INVALID_STATUS' | 'MISSING_DESCRIPTIONS' | 'SERVER_ERROR';
}
```

**Authorization**: Staff member who owns the timesheet.

**Business Rules**:
- Timesheet must be in DRAFT or REJECTED status
- All time entries must have non-empty `description` fields
- Sets `submitted_at` to current timestamp
- Sets `submitted_by` to current user's auth.users.id
- Recalculates `overtime_hours` based on OvertimeConfig
- Creates notification for org admins

**Errors**:
| Code | Condition |
|---|---|
| `NOT_FOUND` | Timesheet does not exist or belongs to different org |
| `FORBIDDEN` | User does not own this timesheet |
| `INVALID_STATUS` | Timesheet is not in DRAFT or REJECTED status |
| `MISSING_DESCRIPTIONS` | One or more entries have blank descriptions |

---

### SA-3: reviewTimesheet

Approves or rejects a submitted timesheet (admin action).

**File**: `app/actions/timesheet-admin-actions.ts`

```typescript
// Request
interface ReviewTimesheetInput {
  timesheet_id: string;
  action: 'approve' | 'reject';
  rejection_reason?: string; // Required when action = 'reject'
}

// Zod Schema
const reviewTimesheetSchema = z.object({
  timesheet_id: z.string().uuid('Invalid timesheet ID'),
  action: z.enum(['approve', 'reject'], { message: 'Action must be approve or reject' }),
  rejection_reason: z.string()
    .min(10, 'Rejection reason must be at least 10 characters')
    .max(1000)
    .trim()
    .optional(),
}).refine(
  (d) => d.action !== 'reject' || d.rejection_reason,
  { message: 'Rejection reason is required when rejecting', path: ['rejection_reason'] }
);

// Response (success)
interface ReviewTimesheetResponse {
  success: true;
  timesheet: TimesheetResponse;
}

// Response (error)
interface ErrorResponse {
  error: string;
  code: 'VALIDATION_ERROR' | 'NOT_FOUND' | 'FORBIDDEN' | 'INVALID_STATUS' | 'SERVER_ERROR';
}
```

**Authorization**: Organization admin or manager (UserRole: ADMIN or EXECUTIVE).

**Business Rules**:
- Timesheet must be in SUBMITTED status
- Sets `reviewed_at` to current timestamp
- Sets `reviewed_by` to current user's UserProfile.id
- On rejection: sets `rejection_reason` and transitions to REJECTED
- On approval: transitions to APPROVED, clears any previous `rejection_reason`
- Creates notification for the staff member (TIMESHEET_APPROVED or TIMESHEET_REJECTED)

**Errors**:
| Code | Condition |
|---|---|
| `NOT_FOUND` | Timesheet does not exist or belongs to different org |
| `FORBIDDEN` | User is not an admin/executive for this org |
| `INVALID_STATUS` | Timesheet is not in SUBMITTED status |
| `VALIDATION_ERROR` | Missing rejection_reason when rejecting |

---

### SA-4: bulkApproveTimesheets

Approves multiple submitted timesheets at once (admin action).

**File**: `app/actions/timesheet-admin-actions.ts`

```typescript
// Request
interface BulkApproveTimesheetsInput {
  timesheet_ids: string[];
}

// Zod Schema
const bulkApproveTimesheetsSchema = z.object({
  timesheet_ids: z.array(z.string().uuid()).min(1).max(50),
});

// Response (success)
interface BulkApproveResponse {
  success: true;
  approved_count: number;
  failed: Array<{ timesheet_id: string; error: string }>;
}
```

**Authorization**: Organization admin or manager.

**Business Rules**:
- Only processes timesheets in SUBMITTED status
- Skips non-SUBMITTED timesheets and reports them in `failed` array
- Each approval creates individual notifications
- Uses a database transaction for atomicity

---

## API Routes (Reads)

### GET /api/timesheets

List timesheets with filtering and pagination.

**File**: `app/api/timesheets/route.ts`

```typescript
// Query Parameters
interface TimesheetListParams {
  status?: 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED';
  staff_id?: string;  // UUID
  client_id?: string; // UUID - filter timesheets containing entries for this client
  period_start?: string; // ISO date - filter by period
  period_end?: string;   // ISO date - filter by period
  page?: number;     // Default: 1
  per_page?: number; // Default: 20, max: 100
}

// Response
interface TimesheetListResponse {
  data: TimesheetSummary[];
  pagination: {
    page: number;
    per_page: number;
    total: number;
    total_pages: number;
  };
}

interface TimesheetSummary {
  id: string;
  staff_id: string;
  staff_name: string;
  period_start: string;
  period_end: string;
  status: TimesheetStatus;
  total_hours: number;
  billable_hours: number;
  overtime_hours: number;
  submitted_at: string | null;
  reviewed_at: string | null;
  entry_count: number;
}
```

**Authorization**:
- Staff members: automatically scoped to their own timesheets (`staff_id` forced to session user)
- Admins/Executives: can view all timesheets in their organization
- Agency admins: can view approved timesheets for their agency's staff

---

### GET /api/timesheets/[id]

Get a single timesheet with all entries.

**File**: `app/api/timesheets/[id]/route.ts`

```typescript
// Response
interface TimesheetDetailResponse {
  timesheet: TimesheetResponse; // Includes entries[]
  staff: {
    id: string;
    name: string;
    rate: number;
    rate_type: string;
    staff_type: string;
  };
  assignments: Array<{
    id: string;
    client_id: string;
    client_name: string;
    assignment_type: string;
    allocation_percentage: number;
  }>;
  billing_summary: {
    regular_hours: number;
    overtime_hours: number;
    regular_amount: number;
    overtime_amount: number;
    total_amount: number;
    by_assignment: Array<{
      assignment_id: string;
      client_name: string;
      regular_hours: number;
      overtime_hours: number;
      regular_amount: number;
      overtime_amount: number;
      total_amount: number;
    }>;
  } | null; // null if timesheet has no approved hours
}
```

**Authorization**: Same as list endpoint scoping.

---

### GET /api/timesheets/approval-queue

Get timesheets pending approval for the current org.

**File**: `app/api/timesheets/approval-queue/route.ts`

```typescript
// Query Parameters
interface ApprovalQueueParams {
  staff_id?: string;
  client_id?: string;
  period_start?: string;
  period_end?: string;
  page?: number;
  per_page?: number;
}

// Response
interface ApprovalQueueResponse {
  data: TimesheetSummary[]; // Only SUBMITTED status
  pagination: {
    page: number;
    per_page: number;
    total: number;
    total_pages: number;
  };
  stats: {
    pending_count: number;
    total_hours_pending: number;
  };
}
```

**Authorization**: Admins and Executives only.

---

### GET /api/timesheets/summary

Aggregated hours and billing data for reporting.

**File**: `app/api/timesheets/summary/route.ts`

```typescript
// Query Parameters
interface TimesheetSummaryParams {
  period_start: string; // Required: ISO date
  period_end: string;   // Required: ISO date
  group_by?: 'staff' | 'client' | 'project'; // Default: 'staff'
  status?: 'APPROVED'; // Only approved hours for billing reports
}

// Response
interface TimesheetSummaryResponse {
  period: { start: string; end: string };
  totals: {
    total_hours: number;
    billable_hours: number;
    non_billable_hours: number;
    overtime_hours: number;
    total_billing_amount: number;
  };
  breakdown: Array<{
    group_id: string;
    group_name: string;
    total_hours: number;
    billable_hours: number;
    non_billable_hours: number;
    overtime_hours: number;
    billing_amount: number;
  }>;
}
```

**Authorization**: Admins and Executives only.

---

### GET /api/timesheets/export

Export timesheet data as CSV.

**File**: `app/api/timesheets/export/route.ts`

```typescript
// Query Parameters
interface TimesheetExportParams {
  period_start: string; // Required
  period_end: string;   // Required
  status?: 'APPROVED' | 'SUBMITTED';
  staff_id?: string;
  client_id?: string;
  format?: 'csv'; // Only CSV for v1
}

// Response
// Content-Type: text/csv
// Content-Disposition: attachment; filename="timesheets-{start}-{end}.csv"
// CSV columns: Staff Name, Week, Date, Client, Project, Hours, Billable, Overtime, Description, Rate, Amount
```

**Authorization**: Admins and Executives only.
