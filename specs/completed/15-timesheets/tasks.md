# Tasks: Timesheets & Time Tracking

**Feature**: 15-timesheets
**Branch**: `15-timesheets`
**Generated**: 2026-03-06

---

## User Story Mapping

| Story | Scenario | Functional Reqs | Priority |
|-------|----------|----------------|----------|
| US1 | Staff Logs Daily Hours | FR-1, FR-6 | P1 |
| US2 | Staff Submits Weekly Timesheet | FR-2 | P1 |
| US3 | Manager Approves/Rejects Timesheet | FR-3, FR-7 | P1 |
| US4 | Admin Configures Overtime Rules | FR-4 | P2 |
| US5 | Billing Calculation from Approved Hours | FR-5 | P2 |
| US6 | Agency Admin Manages Staff Timesheets | Scenario 5, FR-3, FR-7 | P1 |
| US7 | Timesheet Reporting & Export | FR-8 | P3 |

---

## Phase 1: Setup

- [x] T001 Verify database connection with `npx prisma migrate status` and confirm `.env` uses Supabase pooler URLs (not direct db URLs) per Constitution Principle #8

---

## Phase 2: Foundational (blocking all user stories)

### Schema & Migration

- [x] T002 Add `TimesheetStatus` enum (DRAFT, SUBMITTED, APPROVED, REJECTED) to `prisma/schema.prisma`
- [x] T003 Add `TIMESHEET_SUBMITTED`, `TIMESHEET_APPROVED`, `TIMESHEET_REJECTED`, `TIMESHEET_REMINDER` values to existing `NotificationType` enum in `prisma/schema.prisma`
- [x] T004 Add `OvertimeConfig` model to `prisma/schema.prisma` with fields: `id`, `organization_id`, `agency_id String?` (nullable — null for org-level, set for agency-level override), `weekly_hours_threshold` (Decimal(5,2) @default(40)), `overtime_multiplier` (Decimal(3,2) @default(1.5)), `is_enabled` (Boolean @default(true)), `created_at`, `updated_at`; relation to Organization and optional Agency; `@@unique([organization_id, agency_id])` (one config per org or per agency); `@@map("overtime_configs")`
- [x] T005 Add `Timesheet` model to `prisma/schema.prisma` with all fields per data-model.md: `id`, `organization_id`, `staff_id`, `period_start` (@db.Date), `period_end` (@db.Date), `status` (TimesheetStatus @default(DRAFT)), `total_hours`/`billable_hours`/`overtime_hours` (Decimal(6,2)), submission fields (`submitted_at`, `submitted_by`), review fields (`reviewed_at`, `reviewed_by` FK to UserProfile, `rejection_reason`), `deleted_at`, `created_at`, `updated_at`; `@@unique([staff_id, period_start])`; all indexes per data-model.md; `@@map("timesheets")`
- [x] T006 Add `TimeEntry` model to `prisma/schema.prisma` with all fields per data-model.md: `id`, `timesheet_id`, `staff_id`, `assignment_id?`, `project_id?`, `entry_date` (@db.Date), `hours` (Decimal(4,2)), `description` (@db.Text?), `is_billable` (Boolean @default(true)), `is_overtime` (Boolean @default(false)), `created_at`, `updated_at`; relations to Timesheet (onDelete: Cascade), Staff, StaffAssignment? (onDelete: Restrict), Project? (onDelete: SetNull); `@@unique([timesheet_id, entry_date, assignment_id])`; all indexes per data-model.md; `@@map("time_entries")`
- [x] T007 Add relation fields to existing models in `prisma/schema.prisma`: Organization (`timesheets Timesheet[]`, `overtime_configs OvertimeConfig[]`), Staff (`timesheets Timesheet[]`, `time_entries TimeEntry[]`), StaffAssignment (`time_entries TimeEntry[]`), Project (`time_entries TimeEntry[]`), UserProfile (`reviewed_timesheets Timesheet[] @relation("TimesheetReviewer")`), Agency (`overtime_config OvertimeConfig?`)
- [x] T008 Run Prisma migration (`npx prisma migrate dev --name add_timesheets_time_entries_overtime_config`) and regenerate client (`npx prisma generate`); verify with `npx prisma migrate status`

### Validation Schemas

- [x] T009 [P] Create `lib/validations/timesheet.ts` with all Zod schemas per contracts: `getOrCreateDraftTimesheetSchema` (period_start YYYY-MM-DD regex), `upsertTimeEntrySchema` (hours 0.25-24 in 0.25 increments, entry_date, assignment_id?, is_billable), `batchUpsertTimeEntriesSchema` (array min 1 max 70), `deleteTimeEntrySchema`, `submitTimesheetSchema` (timesheet_id UUID), `reviewTimesheetSchema` (action enum + rejection_reason refine min 10 chars), `bulkApproveTimesheetsSchema` (array of UUIDs min 1 max 50), `upsertOvertimeConfigSchema` (threshold positive max 168, multiplier min 1.0 max 5.0, is_enabled, optional agency_id UUID), `timesheetListFilterSchema` (status?, staff_id?, client_id?, agency_id?, period_start?, period_end?, page, per_page), `timesheetSummaryFilterSchema` (period_start, period_end, group_by, status?); export all TypeScript inferred types

### Calculation Engine

- [x] T010 [P] Create `lib/calculations/timesheet-billing.ts` with pure functions: `getEffectiveOvertimeConfig(organizationId, agencyId?)` loading agency-level config first, falling back to org-level, then defaults (40/1.5/true); `calculateOvertimeBreakdown(totalHours, config)` returning regularHours/overtimeHours/isOvertime; `distributeOvertimeProportionally(entriesByAssignment, overtimeHours)` returning per-assignment regular/overtime split; `calculateTimesheetBilling(timesheet, staffRate, overtimeConfig)` returning TimesheetBillingResult with totalBillable/totalNonBillable/regularAmount/overtimeAmount/totalAmount/byAssignment; `calculatePeriodBilling(orgId, startDate, endDate, agencyId?)` for aggregated reporting with optional agency scope
- [x] T011 Create unit tests in `lib/calculations/__tests__/timesheet-billing.test.ts` covering: no overtime (under threshold), overtime with single assignment, overtime with multiple assignments (proportional distribution), overtime disabled, exactly at threshold, all hours non-billable, zero hours, decimal precision, default config fallback, agency-level config overriding org-level config

---

## Phase 3: US1 — Staff Time Entry & Portal

**Story Goal**: Staff members can log daily hours against their client assignments in a weekly grid view.

**Independent Test**: Open staff portal → navigate to current week → enter hours for an assignment → save → verify entries persist and totals update.

### Server Actions

- [x] T012 [US1] Create `getOrCreateDraftTimesheet` server action in `app/actions/timesheet-actions.ts`: upsert DRAFT timesheet for given week; validate period_start is a Monday; enforce 2-week lookback for staff; auto-calculate period_end; derive staff_id from authenticated user session; return timesheet with entries
- [x] T013 [US1] Create `upsertTimeEntry` and `deleteTimeEntry` server actions in `app/actions/timesheet-actions.ts`: validate parent timesheet is DRAFT or REJECTED; validate entry_date within period; validate daily total <= 24 hours across all entries; validate assignment is active on entry_date; force is_billable=false when assignment_id is null; recalculate parent timesheet totals on save/delete; handle upsert by timesheet_id+entry_date+assignment_id
- [x] T014 [US1] Create `batchUpsertTimeEntries` server action in `app/actions/timesheet-actions.ts`: validate all entries per upsert rules; validate per-day totals across batch plus existing entries; use transaction with partial success (commit valid entries, report failures in errors array); recalculate timesheet totals once after batch

### API Routes

- [x] T015 [P] [US1] Create GET `/api/timesheets` route in `app/api/timesheets/route.ts`: list timesheets with status/staff_id/client_id/agency_id/period filters and pagination (default 20, max 100); scope by auth role (staff: own only, admin: all in org, agency_admin: all statuses for their agency's staff); return TimesheetSummary[] with staff_name and entry_count
- [x] T016 [P] [US1] Create GET `/api/timesheets/[id]` route in `app/api/timesheets/[id]/route.ts`: return timesheet detail with entries (sorted by entry_date ASC, assignment_id ASC), staff info (name, rate, rate_type, staff_type), active assignments (client names), computed daily and assignment totals views; enforce auth scoping (staff: own only, admin: all, agency_admin: their agency's staff)

### UI Components & Pages

- [x] T017 [P] [US1] Create `components/timesheets/timesheet-status-badge.tsx` (status indicator using Badge with color variants: DRAFT=secondary, SUBMITTED=warning, APPROVED=success, REJECTED=destructive) and `components/timesheets/week-navigator.tsx` (week selection with prev/next buttons, current week highlight, 2-week lookback limit display, date range label)
- [x] T018 [US1] Create `components/timesheets/timesheet-grid.tsx`: weekly grid component with rows=assignments (+ bench row for unassigned time), columns=Mon-Sun, cells=hours input (0.25 increment stepper), per-cell description input on focus/click, per-cell billable/non-billable toggle, row totals, column (day) totals, weekly grand total, auto-save on blur via batchUpsertTimeEntries; read-only mode when timesheet is SUBMITTED or APPROVED; editable when DRAFT or REJECTED
- [x] T019 [US1] Create staff portal timesheet list page `app/staff-portal/timesheets/page.tsx`: list all staff timesheets with status badges, week navigator for period selection, link to weekly grid entry page; fetch from GET /api/timesheets
- [x] T020 [US1] Create staff portal weekly grid entry page `app/staff-portal/timesheets/[id]/page.tsx`: render timesheet-grid component for the selected week; call getOrCreateDraftTimesheet on mount; show rejection reason banner when status is REJECTED; display overtime indicators

---

## Phase 4: US2 — Timesheet Submission

**Story Goal**: Staff can submit completed timesheets for manager approval after validating all entries have descriptions.

**Independent Test**: Fill out timesheet entries → click Submit → verify status changes to SUBMITTED → verify timesheet becomes read-only → verify notification created for approvers.

### Server Action

- [x] T021 [US2] Create `submitTimesheet` server action in `app/actions/timesheet-actions.ts`: validate timesheet is DRAFT or REJECTED; validate all entries have non-empty descriptions; recalculate overtime_hours using `getEffectiveOvertimeConfig(orgId, staff.agency_id)` and `calculateOvertimeBreakdown`; set submitted_at and submitted_by; transition status to SUBMITTED; create TIMESHEET_SUBMITTED notification for org admins and (if agency staff) agency admins; return updated timesheet

### UI

- [x] T022 [US2] Add submission flow to staff portal timesheet grid (`app/staff-portal/timesheets/[id]/page.tsx` and `components/timesheets/timesheet-grid.tsx`): pre-submit validation (highlight entries missing descriptions), confirmation dialog showing summary (total hours, billable/non-billable split, overtime hours), Submit button (disabled when no entries or validation fails), success/error toast feedback, grid locks to read-only on successful submit

---

## Phase 5: US3 — Approval Workflow & Platform Admin Dashboard

**Story Goal**: Platform admins can review, approve, or reject submitted timesheets from an approval queue covering all staff across the organization.

**Independent Test**: Submit a timesheet → admin opens approval queue → reviews timesheet detail → approves or rejects with reason → verify status changes → verify staff notification created.

### Server Actions

- [x] T023 [US3] Create `reviewTimesheet` server action in `app/actions/timesheet-admin-actions.ts`: validate timesheet is SUBMITTED; on approve: transition to APPROVED, clear rejection_reason, set reviewed_at/reviewed_by, create TIMESHEET_APPROVED notification; on reject: require rejection_reason (min 10 chars), transition to REJECTED, set rejection_reason, create TIMESHEET_REJECTED notification; enforce authorization: platform admin can review any org timesheet, agency admin can only review timesheets for their agency's staff
- [x] T024 [US3] Create `bulkApproveTimesheets` server action in `app/actions/timesheet-admin-actions.ts`: accept array of timesheet_ids (max 50); use database transaction; only process SUBMITTED timesheets; skip non-SUBMITTED and report in failed array; enforce same authorization rules (platform admin: any, agency admin: their staff only); create individual notifications per approval; return approved_count and failed array

### API Route

- [x] T025 [US3] Create GET `/api/timesheets/approval-queue` route in `app/api/timesheets/approval-queue/route.ts`: return only SUBMITTED timesheets with filters (staff_id, client_id, period) and pagination; include stats (pending_count, total_hours_pending); scoped by auth: platform admin sees all, agency admin sees their agency's staff only

### UI Components & Pages

- [x] T026 [P] [US3] Create `components/timesheets/approval-queue.tsx` (table of SUBMITTED timesheets with staff name, period, hours, checkbox selection, bulk approve button) and `components/timesheets/timesheet-review-dialog.tsx` (approve/reject dialog with rejection reason textarea min 10 chars, confirm button)
- [x] T027 [US3] Create platform admin timesheet dashboard `app/dashboard/timesheets/page.tsx`: approval queue component, filter by staff/client/agency/period/status, summary stats (pending count, total hours submitted/approved), link to individual timesheet detail; tabbed view for "Pending Approval" and "All Timesheets"
- [x] T028 [US3] Create platform admin timesheet detail page `app/dashboard/timesheets/[id]/page.tsx`: read-only grid view of entries, staff info and rate display, approve/reject buttons with review dialog, rejection reason display for rejected timesheets, status history

---

## Phase 6: US6 — Agency Admin Timesheet Management

**Story Goal**: Agency admins have full timesheet management for their agency's staff — approval queue, detail review, billing summaries, and reporting — accessible from the agency portal.

**Independent Test**: Agency admin logs in → sees approval queue for their staff → approves a timesheet → views billing summary → exports CSV for their agency.

### Server Actions (Agency-Scoped)

- [x] T029 [US6] Create `getAgencyTimesheets` server action in `app/actions/agency-portal-actions.ts`: return timesheets for agency's staff with status/staff_id/period filters and pagination; all statuses visible (DRAFT, SUBMITTED, APPROVED, REJECTED); use `requireAgencyAdmin()` for auth; convert Decimal fields to Number for RSC serialization
- [x] T030 [US6] Create `reviewAgencyTimesheet` and `bulkApproveAgencyTimesheets` server actions in `app/actions/agency-portal-actions.ts`: same logic as platform admin review but scoped to agency's staff only; validate timesheet's staff.agency_id matches user's agency_id; create appropriate notifications

### UI Pages

- [x] T031 [US6] Add "Timesheets" nav item to agency portal sidebar in `components/agency-portal/Sidebar.tsx`
- [x] T032 [US6] Create agency portal timesheet dashboard `app/agency-portal/timesheets/page.tsx`: approval queue for agency's submitted timesheets, filter by staff/period/status, summary stats (pending count, total hours), bulk approve, link to individual detail; reuse `components/timesheets/approval-queue.tsx` and `timesheet-status-badge.tsx`
- [x] T033 [US6] Create agency portal timesheet detail page `app/agency-portal/timesheets/[id]/page.tsx`: read-only grid view of entries, staff info, approve/reject with review dialog, billing summary display, reuse shared timesheet components

---

## Phase 7: US4 — Overtime Configuration (Multi-Level)

**Story Goal**: Both platform admins and agency admins can configure overtime rules appropriate to their scope.

**Independent Test**: Platform admin sets org-level OT at 40hrs/1.5x → Agency admin sets agency OT at 45hrs/1.25x → Agency staff submits 48hrs → verify agency config used (3hrs OT at 1.25x, not 8hrs at 1.5x). Direct staff submits 48hrs → verify org config used (8hrs OT at 1.5x).

### Server Actions

- [x] T034 [US4] Create `upsertOvertimeConfig` server action in `app/actions/timesheet-admin-actions.ts`: upsert OvertimeConfig by organization_id + agency_id (null for org-level); validate threshold > 0 (max 168), multiplier >= 1.0 (max 5.0); platform admin can set org-level and any agency-level config; return saved config with Number() conversions for Decimal fields
- [x] T035 [US4] Create `upsertAgencyOvertimeConfig` server action in `app/actions/agency-portal-actions.ts`: same as T034 but uses `requireAgencyAdmin()` and forces agency_id to user's agency; agency admin can only set config for their own agency

### API Route

- [x] T036 [US4] Create GET `/api/overtime-config` route in `app/api/overtime-config/route.ts`: accept optional `agency_id` query param; return OvertimeConfig for the specified scope or default values (threshold: 40, multiplier: 1.5, enabled: true) with `is_default` flag; any authenticated org user

### UI

- [x] T037 [US4] Create `components/timesheets/overtime-config-form.tsx` (threshold input, multiplier input, enable/disable toggle, save button with confirmation) and platform admin overtime settings page `app/dashboard/settings/overtime/page.tsx`; display overtime visual indicators in timesheet grid
- [x] T038 [US4] Create agency portal overtime settings page `app/agency-portal/settings/page.tsx` (or add overtime section to existing settings): reuse `overtime-config-form.tsx` component, agency admin can set agency-specific overtime rules

---

## Phase 8: US5 — Billing Calculation

**Story Goal**: Approved timesheet hours drive billing amount calculations per client assignment with overtime multiplier applied.

**Independent Test**: Approve a timesheet with 45 hours (40 regular + 5 overtime) at $100/hr rate with 1.5x multiplier → verify billing total = $4,000 (regular) + $750 (overtime) = $4,750.

### Integration

- [x] T039 [US5] Integrate billing summary into GET `/api/timesheets/[id]` response in `app/api/timesheets/[id]/route.ts`: call `calculateTimesheetBilling()` with staff rate info and `getEffectiveOvertimeConfig(orgId, staff.agency_id)`; return billing_summary with regular/overtime hours and amounts, by_assignment breakdown; return null when timesheet is DRAFT
- [x] T040 [US5] Add billing summary display to platform admin timesheet detail `app/dashboard/timesheets/[id]/page.tsx` and agency portal timesheet detail `app/agency-portal/timesheets/[id]/page.tsx`: billing breakdown card with regular amount, overtime amount, total amount; per-assignment billing table; only display for APPROVED or SUBMITTED timesheets

---

## Phase 9: US7 — Reporting & Export

**Story Goal**: Admins can view aggregated hours data and export timesheet data as CSV, scoped to their authority.

**Independent Test**: Platform admin exports all org timesheets → Agency admin exports their agency timesheets only → verify each CSV contains correct scoped data.

### API Routes

- [x] T041 [P] [US7] Create GET `/api/timesheets/summary` route in `app/api/timesheets/summary/route.ts`: accept required period_start/period_end, optional group_by (staff/client/project), status filter, and agency_id filter; return period totals and breakdown array; use calculatePeriodBilling; scoped by auth (platform admin: all, agency admin: their staff only)
- [x] T042 [P] [US7] Create GET `/api/timesheets/export` route in `app/api/timesheets/export/route.ts`: accept required period_start/period_end, optional status/staff_id/client_id/agency_id filters; return CSV with headers: Staff Name, Week, Date, Client, Project, Hours, Billable, Overtime, Description, Rate, Amount; scoped by auth (platform admin: all, agency admin: their staff only)

### UI

- [x] T043 [US7] Add reporting section to platform admin timesheet dashboard `app/dashboard/timesheets/page.tsx`: date range picker, group_by selector, agency filter, summary stats cards, breakdown table, CSV export button
- [x] T044 [US7] Add reporting section to agency portal timesheet dashboard `app/agency-portal/timesheets/page.tsx`: date range picker, summary stats cards (scoped to agency staff), breakdown table, CSV export button

---

## Phase 10: Polish & Cross-Cutting Concerns

### Access Control & Build Verification

- [x] T045 [P] Verify access control across all timesheet server actions and API routes: staff can only access own timesheets; platform admins can access all org timesheets; agency admins can view all statuses and approve/reject only for their agency's staff; agency admins cannot see timesheets for staff outside their agency; ensure Decimal fields are converted to Number before crossing RSC → Client Component boundaries
- [x] T046 [P] Run build verification: `npx next build` passes without errors; `npx vitest run` passes all timesheet-billing tests; verify no TypeScript errors in new files

---

## Dependencies

```
T001 → T002 → T003 → T004 + T005 + T006 → T007 → T008 → T009 + T010 (parallel) → T011

T009 + T010 → T012 → T013 → T014
                                    } US1 server actions
T009 → T015 + T016 (parallel)
                                    } US1 API routes
T012 → T017 + T018 → T019 → T020
                                    } US1 UI

T014 + T010 → T021 → T022
                                    } US2 complete

T009 → T023 → T024
T009 → T025
T023 → T026 → T027 → T028
                                    } US3 complete (platform admin)

T023 → T029 → T030 → T031 → T032 → T033
                                    } US6 complete (agency admin — depends on shared review logic)

T009 → T034 + T035 (parallel)
T009 → T036
T034 → T037
T035 → T038
                                    } US4 complete (multi-level overtime)

T010 + T016 → T039 → T040
                                    } US5 complete

T010 → T041 + T042 (parallel) → T043 + T044 (parallel)
                                    } US7 complete

T033 + T040 → T045 + T046 (parallel)
                                    } Polish
```

### Story Independence

| Story | Can start after | Independent test? |
|-------|----------------|-------------------|
| US1 | Phase 2 complete | Yes — time entry CRUD + grid standalone |
| US2 | US1 server actions (T014) | Partial — needs time entries to submit |
| US3 | Phase 2 complete (T009) | Yes — approval actions standalone |
| US6 | US3 review action (T023) | Partial — reuses review logic, scoped to agency |
| US4 | Phase 2 complete (T009) | Yes — overtime config standalone |
| US5 | US1 API route (T016) + calc engine (T010) | Partial — needs timesheet detail endpoint |
| US7 | Calc engine (T010) | Yes — reporting queries standalone |

**US1 and US3 can run in parallel** after Phase 2.
**US4 can run in parallel** with US1/US2/US3 (standalone config).
**US6 follows US3** (reuses review logic but scoped to agency portal).
**US7 can run in parallel** once calc engine exists.

---

## Parallel Execution Examples

### Maximum parallelism after Phase 2:

```
Agent A: T012 → T013 → T014 → T021 → T022 (US1 actions + US2)
Agent B: T015 + T016 (US1 API routes) → T039 → T040 (US5)
Agent C: T017 + T018 → T019 → T020 (US1 UI)
Agent D: T023 → T024 → T025 → T026 → T027 → T028 (US3 platform admin)
Agent E: T034 + T035 → T036 → T037 + T038 (US4 multi-level overtime)

Then:
Agent D: T029 → T030 → T031 → T032 → T033 (US6 agency admin)
Agent B: T041 + T042 → T043 + T044 (US7 reporting)
Finally: T045 + T046 (parallel, Polish)
```

### Within Phase 2:

```
After T008 (migration):
  Agent A: T009 (Zod validation schemas)
  Agent B: T010 (calculation engine)
Then: T011 (tests, depends on T010)
```

---

## Implementation Strategy

### MVP Scope (Recommended)
**US1 + US2 + US3 + US6**: Staff time entry, submission, platform admin approval, and agency admin approval. This delivers the core dual-authority timesheet workflow for both platform and agency admins.

### Incremental Delivery Order
1. **Phase 1-2**: Foundation (schema, validation, calculations) — required for everything
2. **US1**: Time entry and staff portal — the entry point for all users
3. **US2**: Submission flow — enables the approval workflow
4. **US3**: Platform admin approval workflow and dashboard — completes the platform side
5. **US6**: Agency admin timesheet management — completes the agency portal side
6. **US4**: Multi-level overtime configuration — enhances billing accuracy
7. **US5**: Billing calculations — financial visibility
8. **US7**: Reporting and export — operational reporting for both platform and agency
9. **Phase 10**: Access control verification — security hardening

### Total Tasks: 46
| Phase | Tasks | Parallelizable |
|-------|-------|---------------|
| Setup | 1 | — |
| Foundational | 10 | T009, T010 (2 parallel) |
| US1 | 9 | T015, T016, T017 (3 parallel) |
| US2 | 2 | — |
| US3 (Platform Admin) | 6 | T026 (parallel component) |
| US6 (Agency Admin) | 5 | — |
| US4 (Overtime) | 5 | T034, T035 (2 parallel) |
| US5 (Billing) | 2 | — |
| US7 (Reporting) | 4 | T041, T042 + T043, T044 (2+2 parallel) |
| Polish | 2 | T045, T046 (2 parallel) |
