# Feature 15: Timesheets & Time Tracking - Implementation Plan

**Status**: Ready for Implementation
**Created**: 2026-03-06
**Branch**: `15-timesheets`
**Spec**: specs/15-timesheets/spec.md
**Research**: specs/15-timesheets/research.md
**Data Model**: specs/15-timesheets/data-model.md
**API Contracts**: specs/15-timesheets/contracts/

---

## Technical Context

### Existing Codebase Integration Points

| System | Location | Integration |
|---|---|---|
| Staff records | `prisma/schema.prisma` (Staff model) | Timesheet.staff_id FK; Staff.rate/rate_type for billing |
| Staff assignments | `prisma/schema.prisma` (StaffAssignment model) | TimeEntry.assignment_id FK; active assignment validation |
| Projects | `prisma/schema.prisma` (Project model) | TimeEntry.project_id FK (optional) |
| Contractor invoice pattern | `lib/validations/contractor-invoice.ts`, `app/actions/contractor-portal-actions.ts` | Approval workflow pattern reuse (DRAFT->SUBMITTED->APPROVED/REJECTED) |
| Calculations | `lib/calculations/` | New `timesheet-billing.ts` module following existing pure-function pattern |
| Notifications | `Notification` model + `NotificationType` enum | New TIMESHEET_* notification types |
| User profiles | `UserProfile` model | Reviewer tracking via `reviewed_by` FK |
| Markup calculations | `lib/calculations/markup-calculations.ts` | Bill rate resolution for billing calculations |
| Agency model | `prisma/schema.prisma` (Agency model) | Agency portal view for agency staff timesheets |

### Key Architecture Decisions

1. **Two-table model** (Timesheet + TimeEntry) -- mirrors ContractorInvoice + LineItems pattern
2. **Dedicated TimesheetStatus enum** -- no PAID state, separate from InvoiceStatus
3. **On-demand billing calculation** -- no stored amounts; `lib/calculations/timesheet-billing.ts`
4. **Current rate at calculation time** -- no rate snapshots on timesheet records
5. **Proportional overtime distribution** -- overtime split by assignment's share of regular hours

See `specs/15-timesheets/research.md` for full decision rationale.

---

## Constitution Compliance Check

| Requirement | Status | Notes |
|---|---|---|
| Supabase PostgreSQL 15+ with Prisma ORM | COMPLIANT | Standard Prisma migration workflow |
| Multi-tenancy: organization_id on all tables | COMPLIANT | Timesheet and OvertimeConfig scoped by organization_id; TimeEntry scoped via parent Timesheet |
| UUIDs for PKs | COMPLIANT | All new models use `@id @default(uuid())` |
| Soft deletes (deleted_at) | COMPLIANT | Timesheet has `deleted_at`; TimeEntry uses cascade from Timesheet |
| created_at/updated_at on all tables | COMPLIANT | All three new models include both timestamps |
| Supabase pooler URLs | COMPLIANT | Existing .env configuration; no changes needed |
| Zod validation on all inputs | COMPLIANT | All server actions validated with Zod schemas |
| Verify DB connection before schema changes | COMPLIANT | Phase 1 step 1: `npx prisma migrate status` |
| Rollback procedures included | COMPLIANT | See data-model.md rollback section |
| Next.js Server Actions for mutations | COMPLIANT | All mutations via server actions in `app/actions/` |
| API Routes for reads | COMPLIANT | GET endpoints in `app/api/timesheets/` |
| shadcn/ui components | COMPLIANT | UI built with shadcn/ui (Table, Card, Button, Dialog, etc.) |
| Indexes for FKs and frequent queries | COMPLIANT | See data-model.md index rationale |
| @@map snake_case table names | COMPLIANT | `timesheets`, `time_entries`, `overtime_configs` |

---

## Implementation Phases

### Phase 1: Schema & Migration

**Goal**: Add database models and verify migration applies cleanly.

**Files**:
- `prisma/schema.prisma` (modify)
- `prisma/migrations/YYYYMMDDHHMMSS_add_timesheets_time_entries_overtime_config/` (generated)

**Tasks**:
1. Verify database connection: `npx prisma migrate status`
2. Add `TimesheetStatus` enum to schema
3. Add `TIMESHEET_SUBMITTED`, `TIMESHEET_APPROVED`, `TIMESHEET_REJECTED`, `TIMESHEET_REMINDER` to `NotificationType` enum
4. Add `OvertimeConfig` model
5. Add `Timesheet` model with all fields, indexes, and unique constraints
6. Add `TimeEntry` model with all fields, indexes, and unique constraints
7. Add relation fields to existing models:
   - `Organization`: `timesheets Timesheet[]`, `overtime_config OvertimeConfig?`
   - `Staff`: `timesheets Timesheet[]`, `time_entries TimeEntry[]`
   - `StaffAssignment`: `time_entries TimeEntry[]`
   - `Project`: `time_entries TimeEntry[]`
   - `UserProfile`: `reviewed_timesheets Timesheet[] @relation("TimesheetReviewer")`
8. Run migration: `npx prisma migrate dev --name add_timesheets_time_entries_overtime_config`
9. Generate client: `npx prisma generate`
10. Verify migration: `npx prisma migrate status`

**Acceptance**:
- Migration applies without errors
- `npx prisma migrate status` shows all migrations applied
- Prisma Client generated with new types
- Unique constraints verified (cannot insert duplicate timesheet per staff per week)

**Rollback**:
```sql
DROP TABLE IF EXISTS "time_entries" CASCADE;
DROP TABLE IF EXISTS "timesheets" CASCADE;
DROP TABLE IF EXISTS "overtime_configs" CASCADE;
DROP TYPE IF EXISTS "TimesheetStatus" CASCADE;
```
```bash
npx prisma migrate resolve --rolled-back <migration_name>
```

---

### Phase 2: Validation Schemas

**Goal**: Create all Zod validation schemas for timesheet operations.

**Files**:
- `lib/validations/timesheet.ts` (new)

**Tasks**:
1. Create `getOrCreateDraftTimesheetSchema`
2. Create `upsertTimeEntrySchema` with hours validation (0.25 increments, min/max)
3. Create `batchUpsertTimeEntriesSchema` (array of entries, max 70)
4. Create `deleteTimeEntrySchema`
5. Create `submitTimesheetSchema`
6. Create `reviewTimesheetSchema` with rejection_reason refine (min 10 chars when rejecting)
7. Create `bulkApproveTimesheetsSchema`
8. Create `upsertOvertimeConfigSchema`
9. Create `timesheetListFilterSchema` for GET query params
10. Create `timesheetSummaryFilterSchema` for summary endpoint
11. Export all TypeScript inferred types

**Acceptance**:
- All schemas match API contract definitions
- Type exports available for server actions and API routes
- Unit tests for edge cases (0.25 increments, rejection reason conditional)

---

### Phase 3: Server Actions & API Routes

**Goal**: Implement all CRUD operations, lifecycle transitions, and read endpoints.

**Files**:
- `app/actions/timesheet-actions.ts` (new) -- staff-facing mutations
- `app/actions/timesheet-admin-actions.ts` (new) -- admin mutations
- `app/api/timesheets/route.ts` (new) -- list
- `app/api/timesheets/[id]/route.ts` (new) -- detail
- `app/api/timesheets/approval-queue/route.ts` (new)
- `app/api/overtime-config/route.ts` (new)

**Tasks**:

*Staff Actions (timesheet-actions.ts)*:
1. `getOrCreateDraftTimesheet` -- upsert DRAFT timesheet for a week, enforce 2-week lookback
2. `upsertTimeEntry` -- create/update entry with all validations (day limit, assignment active, date in period)
3. `batchUpsertTimeEntries` -- batch save with partial success
4. `deleteTimeEntry` -- remove entry, recalculate totals
5. `submitTimesheet` -- validate descriptions present, calculate overtime, transition to SUBMITTED, create notification

*Admin Actions (timesheet-admin-actions.ts)*:
6. `reviewTimesheet` -- approve/reject with reason, notification, reviewer tracking
7. `bulkApproveTimesheets` -- batch approve with transaction
8. `upsertOvertimeConfig` -- create/update org overtime settings

*API Routes*:
9. GET `/api/timesheets` -- list with status/staff/client/period filters, pagination
10. GET `/api/timesheets/[id]` -- detail with entries, staff info, assignments, billing summary
11. GET `/api/timesheets/approval-queue` -- SUBMITTED timesheets with stats
12. GET `/api/overtime-config` -- current config or defaults

**Acceptance**:
- All server actions return typed responses matching contracts
- Authorization enforced (staff own timesheets, admins approve)
- Status transitions follow spec lifecycle
- 2-week lookback enforced for staff, unrestricted for admins
- Notifications created on submit/approve/reject

---

### Phase 4: Calculation Engine

**Goal**: Implement billing and overtime calculation logic.

**Files**:
- `lib/calculations/timesheet-billing.ts` (new)

**Tasks**:
1. `getEffectiveOvertimeConfig(organizationId)` -- load config or return defaults
2. `calculateOvertimeBreakdown(totalHours, config)` -- split into regular + overtime
3. `distributeOvertimeProportionally(entriesByAssignment, overtimeHours)` -- proportional distribution
4. `calculateTimesheetBilling(timesheet, staffRate, overtimeConfig)` -- full billing result
5. `calculatePeriodBilling(orgId, startDate, endDate)` -- aggregated billing for reporting
6. Unit tests for all functions:
   - No overtime (under threshold)
   - Overtime with single assignment
   - Overtime with multiple assignments (proportional split)
   - Overtime disabled
   - Edge case: exactly at threshold
   - Edge case: all hours non-billable

**Acceptance**:
- Pure functions with no side effects
- Matches algorithm defined in research.md
- 100% test coverage on calculation logic
- Billing amounts within 1% tolerance of expected values (spec success criteria)

---

### Phase 5: Staff Portal UI

**Goal**: Build the staff-facing timesheet entry interface.

**Files**:
- `app/staff-portal/timesheets/page.tsx` (new) -- timesheet list
- `app/staff-portal/timesheets/[id]/page.tsx` (new) -- weekly grid entry
- `components/timesheets/timesheet-grid.tsx` (new) -- weekly grid component
- `components/timesheets/timesheet-status-badge.tsx` (new) -- status indicator
- `components/timesheets/week-navigator.tsx` (new) -- week selection

**Tasks**:
1. Create timesheet list view (all timesheets with status badges, week navigation)
2. Create weekly grid component:
   - Rows = assignments (+ bench row for unassigned time)
   - Columns = Monday through Sunday
   - Cells = hours input (0.25 increment stepper)
   - Row totals, column (day) totals, weekly grand total
3. Create description input (per entry, shown on cell focus/click)
4. Create billable/non-billable toggle per entry
5. Create submission flow:
   - Pre-submit validation (descriptions filled)
   - Confirmation dialog with summary
   - Submit action call
6. Create rejection view (show rejection reason, allow editing, resubmit)
7. Overtime visual indicators (highlight cells/rows contributing to overtime)
8. Week navigator with lookback enforcement (disable weeks > 2 ago)

**Acceptance**:
- Grid renders correctly for 1-10 assignments
- Hours input enforces 0.25 increments
- Daily totals update in real-time
- Cannot edit submitted/approved timesheets
- Can edit and resubmit rejected timesheets
- Clear overtime visual indicators
- < 5 minutes to complete a full week (spec success criteria)

---

### Phase 6: Admin Dashboard UI

**Goal**: Build the admin approval queue and timesheet management interface.

**Files**:
- `app/(protected)/timesheets/page.tsx` (new) -- admin dashboard
- `app/(protected)/timesheets/[id]/page.tsx` (new) -- admin detail/review
- `app/(protected)/settings/overtime/page.tsx` (new) -- overtime config
- `components/timesheets/approval-queue.tsx` (new) -- queue table
- `components/timesheets/timesheet-review-dialog.tsx` (new) -- approve/reject dialog
- `components/timesheets/overtime-config-form.tsx` (new) -- settings form

**Tasks**:
1. Create approval queue dashboard:
   - Table of SUBMITTED timesheets
   - Filter by staff, client, period
   - Summary stats (pending count, total hours)
2. Create bulk approve functionality:
   - Checkbox selection
   - Bulk approve button
   - Progress/result feedback
3. Create individual timesheet review:
   - Read-only view of entries in grid format
   - Staff info and rate display
   - Billing summary
   - Approve/Reject buttons
   - Rejection reason dialog (min 10 chars)
4. Create all-timesheets view (filterable by any status)
5. Create overtime config settings page:
   - Threshold input
   - Multiplier input
   - Enable/disable toggle
   - Save with confirmation

**Acceptance**:
- Approval queue shows only SUBMITTED timesheets
- Bulk approve processes correctly with feedback
- Rejection requires reason >= 10 characters
- Overtime config changes save and take effect immediately
- Dashboard loads in < 2 seconds (spec performance target)

---

### Phase 7: Agency Portal Integration

**Goal**: Allow agency admins to view approved timesheets for their staff.

**Files**:
- `app/agency-portal/timesheets/page.tsx` (new) -- agency timesheet view

**Tasks**:
1. Add timesheets tab/section to agency portal navigation
2. Create filtered view showing only APPROVED timesheets for agency's staff
3. Display hours, billing amounts, and period information
4. Filter by staff member, period
5. Authorization: agency admin can only see their agency's staff timesheets

**Acceptance**:
- Agency admin sees only their staff's approved timesheets
- Billing amounts displayed correctly
- Cannot approve/reject (read-only view)
- Supports invoice reconciliation use case

---

### Phase 8: Reporting & Export

**Goal**: Add aggregated reporting and CSV export.

**Files**:
- `app/api/timesheets/summary/route.ts` (new)
- `app/api/timesheets/export/route.ts` (new)
- `components/timesheets/timesheet-summary-chart.tsx` (new) -- optional

**Tasks**:
1. Implement summary endpoint (group by staff/client/project)
2. Implement CSV export with all required columns
3. Add summary/reporting section to admin dashboard
4. Billing amount calculations in reports use `lib/calculations/timesheet-billing.ts`

**Acceptance**:
- Summary data matches individual timesheet totals
- CSV export downloads correctly with proper headers
- Reports include billable, non-billable, overtime hours, and billing amounts

---

### Phase 9: Testing & Validation

**Goal**: Comprehensive testing across all layers.

**Files**:
- `lib/validations/__tests__/timesheet.test.ts` (new)
- `lib/calculations/__tests__/timesheet-billing.test.ts` (new)
- `app/actions/__tests__/timesheet-actions.test.ts` (new)
- `app/actions/__tests__/timesheet-admin-actions.test.ts` (new)

**Tasks**:
1. Unit tests: Zod validation schemas (all edge cases)
2. Unit tests: Overtime calculation (proportional distribution, edge cases)
3. Unit tests: Billing calculation (regular, overtime, non-billable)
4. Integration tests: Server action lifecycle (create -> entries -> submit -> approve)
5. Integration tests: Authorization (staff isolation, admin access, agency scoping)
6. Integration tests: 2-week lookback enforcement
7. Integration tests: Notification creation on status transitions

**Acceptance**:
- All tests pass
- Calculation tests cover edge cases from testing checklist (see quickstart.md)
- No regressions in existing features
- `npm run lint` passes
- `npm run build` succeeds

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Performance with large grids (10+ assignments x 7 days) | Medium | Medium | Batch upsert reduces round-trips; consider virtualized grid if needed |
| Race condition on concurrent entry saves | Low | Medium | Prisma upsert with unique constraint handles conflicts; last-write-wins acceptable for single-user timesheets |
| Overtime calculation precision (floating point) | Low | High | Use Decimal type throughout; round to 2 decimal places at display |
| Staff without UserProfile can't submit | Medium | Low | Validate staff-to-user mapping exists before enabling timesheet access |
| NotificationType enum migration on existing data | Low | Medium | Adding enum values is non-destructive in PostgreSQL; no data migration needed |

---

## File Inventory (New Files)

| File | Phase | Type |
|---|---|---|
| `lib/validations/timesheet.ts` | 2 | Validation |
| `app/actions/timesheet-actions.ts` | 3 | Server Action |
| `app/actions/timesheet-admin-actions.ts` | 3 | Server Action |
| `app/api/timesheets/route.ts` | 3 | API Route |
| `app/api/timesheets/[id]/route.ts` | 3 | API Route |
| `app/api/timesheets/approval-queue/route.ts` | 3 | API Route |
| `app/api/overtime-config/route.ts` | 3 | API Route |
| `lib/calculations/timesheet-billing.ts` | 4 | Calculation |
| `app/staff-portal/timesheets/page.tsx` | 5 | UI Page |
| `app/staff-portal/timesheets/[id]/page.tsx` | 5 | UI Page |
| `components/timesheets/timesheet-grid.tsx` | 5 | UI Component |
| `components/timesheets/timesheet-status-badge.tsx` | 5 | UI Component |
| `components/timesheets/week-navigator.tsx` | 5 | UI Component |
| `app/(protected)/timesheets/page.tsx` | 6 | UI Page |
| `app/(protected)/timesheets/[id]/page.tsx` | 6 | UI Page |
| `app/(protected)/settings/overtime/page.tsx` | 6 | UI Page |
| `components/timesheets/approval-queue.tsx` | 6 | UI Component |
| `components/timesheets/timesheet-review-dialog.tsx` | 6 | UI Component |
| `components/timesheets/overtime-config-form.tsx` | 6 | UI Component |
| `app/agency-portal/timesheets/page.tsx` | 7 | UI Page |
| `app/api/timesheets/summary/route.ts` | 8 | API Route |
| `app/api/timesheets/export/route.ts` | 8 | API Route |
| `lib/validations/__tests__/timesheet.test.ts` | 9 | Test |
| `lib/calculations/__tests__/timesheet-billing.test.ts` | 9 | Test |
| `app/actions/__tests__/timesheet-actions.test.ts` | 9 | Test |
| `app/actions/__tests__/timesheet-admin-actions.test.ts` | 9 | Test |

**Modified Files**:
| File | Phase | Change |
|---|---|---|
| `prisma/schema.prisma` | 1 | Add enum, models, and relation fields |
