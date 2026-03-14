# Feature 15: Timesheets & Time Tracking - Quickstart Reference

---

## Feature Overview

A weekly timesheet system where staff log hours against client assignments, submit for manager approval, and approved hours drive billable amount calculations with automatic overtime distribution.

---

## Key Models & Relationships

```
Timesheet (1) ──> (*) TimeEntry
    |                    |
    v                    v
  Staff           StaffAssignment? ──> Client
    |                    |
    v                    v
 Organization       Project? (optional)

OvertimeConfig (0..1) ──> Organization
```

| Model | Purpose | Key Fields |
|---|---|---|
| `Timesheet` | Weekly submission unit per staff | `staff_id`, `period_start`, `period_end`, `status`, `total_hours`, `overtime_hours` |
| `TimeEntry` | Individual hours record per day per assignment | `entry_date`, `hours`, `assignment_id?`, `project_id?`, `is_billable`, `description` |
| `OvertimeConfig` | Org-level overtime settings | `weekly_hours_threshold`, `overtime_multiplier`, `is_enabled` |

---

## API Endpoint Summary

### Server Actions (Mutations)

| Action | File | Description |
|---|---|---|
| `getOrCreateDraftTimesheet` | `timesheet-actions.ts` | Get/create DRAFT timesheet for a week |
| `submitTimesheet` | `timesheet-actions.ts` | DRAFT/REJECTED -> SUBMITTED |
| `upsertTimeEntry` | `timesheet-actions.ts` | Create or update a single time entry |
| `batchUpsertTimeEntries` | `timesheet-actions.ts` | Save multiple entries at once (grid save) |
| `deleteTimeEntry` | `timesheet-actions.ts` | Remove a time entry |
| `reviewTimesheet` | `timesheet-admin-actions.ts` | Approve or reject a submitted timesheet |
| `bulkApproveTimesheets` | `timesheet-admin-actions.ts` | Approve multiple timesheets at once |
| `upsertOvertimeConfig` | `timesheet-admin-actions.ts` | Set overtime threshold and multiplier |

### API Routes (Reads)

| Endpoint | Method | Description |
|---|---|---|
| `/api/timesheets` | GET | List timesheets with filters & pagination |
| `/api/timesheets/[id]` | GET | Timesheet detail with entries & billing |
| `/api/timesheets/approval-queue` | GET | SUBMITTED timesheets pending review |
| `/api/timesheets/summary` | GET | Aggregated hours & billing by staff/client/project |
| `/api/timesheets/export` | GET | CSV export of timesheet data |
| `/api/overtime-config` | GET | Current overtime settings (or defaults) |

---

## Implementation Order

### Phase 1: Schema & Migration
1. Add `TimesheetStatus` enum to `prisma/schema.prisma`
2. Add `TIMESHEET_*` values to `NotificationType` enum
3. Add `Timesheet`, `TimeEntry`, `OvertimeConfig` models
4. Add relation fields to `Organization`, `Staff`, `StaffAssignment`, `Project`, `UserProfile`
5. Run migration: `npx prisma migrate dev --name add_timesheets_time_entries_overtime_config`
6. Run `npx prisma generate`

### Phase 2: Validation Schemas
7. Create `lib/validations/timesheet.ts` with all Zod schemas

### Phase 3: Server Actions & API Routes
8. Create `app/actions/timesheet-actions.ts` (staff-facing: CRUD, submit)
9. Create `app/actions/timesheet-admin-actions.ts` (admin: review, bulk approve, overtime config)
10. Create `app/api/timesheets/route.ts` (list)
11. Create `app/api/timesheets/[id]/route.ts` (detail)
12. Create `app/api/timesheets/approval-queue/route.ts`
13. Create `app/api/overtime-config/route.ts`

### Phase 4: Calculation Engine
14. Create `lib/calculations/timesheet-billing.ts` (billing amounts, overtime distribution)

### Phase 5: Staff Portal UI
15. Create `app/staff-portal/timesheets/page.tsx` (list view)
16. Create `app/staff-portal/timesheets/[id]/page.tsx` (weekly grid entry)

### Phase 6: Admin Dashboard UI
17. Create `app/(protected)/timesheets/page.tsx` (admin dashboard with approval queue)
18. Create `app/(protected)/timesheets/[id]/page.tsx` (admin detail view)
19. Create `app/(protected)/settings/overtime/page.tsx` (overtime config)

### Phase 7: Agency Portal
20. Add timesheet tab to `app/agency-portal/` (approved timesheets for agency staff)

### Phase 8: Reporting & Export
21. Create `app/api/timesheets/summary/route.ts`
22. Create `app/api/timesheets/export/route.ts`

### Phase 9: Testing & Validation
23. Unit tests for `lib/calculations/timesheet-billing.ts`
24. Unit tests for `lib/validations/timesheet.ts`
25. Integration tests for server actions (lifecycle transitions)
26. E2E test: staff logs time -> submits -> admin approves -> billing calculated

---

## Testing Checklist

### Data Model
- [ ] Migration applies cleanly on fresh database
- [ ] Unique constraint prevents duplicate timesheets per staff per week
- [ ] Unique constraint prevents duplicate entries per day per assignment
- [ ] Soft delete works on Timesheet
- [ ] Cascade delete removes entries when timesheet is deleted

### Timesheet Lifecycle
- [ ] DRAFT timesheet auto-created on first access
- [ ] DRAFT -> SUBMITTED transition succeeds with valid data
- [ ] DRAFT -> SUBMITTED fails when entries have blank descriptions
- [ ] SUBMITTED -> APPROVED transitions correctly
- [ ] SUBMITTED -> REJECTED requires rejection_reason (min 10 chars)
- [ ] REJECTED -> SUBMITTED (resubmission) works
- [ ] Cannot edit entries on SUBMITTED or APPROVED timesheets
- [ ] Can edit entries on REJECTED timesheets

### Time Entries
- [ ] Hours validated: min 0.25, max 24, 0.25 increments
- [ ] Daily total across entries cannot exceed 24 hours
- [ ] Entry date must fall within timesheet period
- [ ] Assignment must be active on entry date
- [ ] Bench time (null assignment) forces is_billable = false
- [ ] Batch upsert handles partial success correctly

### Overtime
- [ ] Overtime calculated when total billable hours exceed threshold
- [ ] Overtime distributed proportionally across assignments
- [ ] Overtime disabled when config.is_enabled = false
- [ ] Default config (40h, 1.5x) used when no OvertimeConfig record exists
- [ ] Overtime multiplier applied correctly in billing calculation

### Authorization
- [ ] Staff can only access their own timesheets
- [ ] Admins can access all org timesheets
- [ ] Agency admins can only view approved timesheets for their staff
- [ ] Only admins can approve/reject
- [ ] Only admins can modify overtime config

### Lookback
- [ ] Staff can create timesheets for current week
- [ ] Staff can create timesheets for 1 week ago
- [ ] Staff can create timesheets for 2 weeks ago
- [ ] Staff cannot create timesheets for 3+ weeks ago
- [ ] Admin can create timesheets for any period

### Billing Calculation
- [ ] Regular amount = billable_hours * rate
- [ ] Overtime amount = overtime_hours * rate * multiplier
- [ ] Non-billable hours excluded from billing
- [ ] Billing by assignment matches proportional distribution
- [ ] CSV export includes correct billing amounts

### Notifications
- [ ] Staff notified on approval
- [ ] Staff notified on rejection (with reason)
- [ ] Admins notified on submission
