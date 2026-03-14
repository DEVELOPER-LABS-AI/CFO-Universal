# Tasks: BDR Portal — End-of-Month Reports, Bonus Plans & Expense Reimbursement

**Branch**: `12-bdr-portal`
**Total Tasks**: 62
**Generated**: 2026-03-03

---

## User Story Mapping

| Story | Description | Priority | FR Coverage |
|-------|-------------|----------|-------------|
| US1 | Admin Configures Pay Plans with Tiered Bonuses | P1 | FR-1 |
| US2 | BDR Submits End-of-Month Report | P1 | FR-2, FR-3 |
| US3 | BDR Submits Expense for Reimbursement | P1 | FR-4 |
| US4 | Admin Reviews & Approves BDR Reports | P1 | FR-5 |
| US5 | Admin Approves/Rejects Expense Claims | P2 | FR-6 |
| US6 | Leadership Views Compensation Dashboard | P2 | FR-7 |

---

## Dependencies

```
US1 (Pay Plans) ← US2 (Monthly Report) ← US4 (Report Review) ← US6 (Dashboard)
US3 (Expenses) ← US5 (Expense Approval) ← US6 (Dashboard)
US2 and US3 can run in parallel (independent)
US4 and US5 can run in parallel (independent)
```

**Parallel Opportunities**:
- T003–T012 (Phase 2 schema tasks) are sequential (same file: prisma/schema.prisma)
- T014–T019 (Phase 2 non-schema tasks) can run in parallel [P] after T013
- US2 and US3 can run in parallel (different files, no dependencies)
- US4 and US5 can run in parallel (different files, no dependencies)

---

## Phase 1: Setup

- [x] T001 Verify database connection with `npx prisma migrate status` per Constitution Principle #8
- [x] T002 Verify `.env` has correct Supabase pooler URLs (port 6543 for DATABASE_URL, port 5432 for DIRECT_URL)

---

## Phase 2: Foundation (blocking — must complete before user stories)

### Schema Changes (sequential — same file)

- [x] T003 Add `BDR` to `UserRole` enum in `prisma/schema.prisma`
- [x] T004 Add new enums `BDRReportStatus` (DRAFT, SUBMITTED, APPROVED, NEEDS_CORRECTION), `BDRExpenseStatus` (SUBMITTED, APPROVED, REJECTED, REIMBURSED), and `BDRBaseMetric` (MEETINGS_BOOKED, MEETINGS_SHOWED) in `prisma/schema.prisma`
- [x] T005 Add `bdr_staff_id` (String?, @unique) field and Staff relation to `UserProfile` model in `prisma/schema.prisma`
- [x] T006 Create `BDRPayPlan` model with fields (id, organization_id, name, description, base_metric, effective_start, effective_end, is_active, created_by, created_at, updated_at) and @@index([organization_id]) in `prisma/schema.prisma`
- [x] T007 Create `BDRBonusTier` model with fields (id, pay_plan_id, min_threshold, max_threshold, payout_rate Decimal(10,2), sort_order, created_at, updated_at) and @@index([pay_plan_id, sort_order]) in `prisma/schema.prisma`
- [x] T008 Create `BDRPayPlanAssignment` model with fields (id, pay_plan_id, staff_id, effective_from, effective_to, created_at, updated_at), @@unique([staff_id, effective_from]), and @@index([staff_id]) in `prisma/schema.prisma`
- [x] T009 Create `BDRMonthlyReport` model with fields (id, organization_id, staff_id, month, year, meetings_booked, meetings_showed, pay_plan_id, calculated_bonus Decimal(10,2), bonus_breakdown Json?, status BDRReportStatus default DRAFT, notes, admin_notes, submitted_at, approved_at, approved_by, created_at, updated_at), @@unique([staff_id, month, year]), and indexes on [organization_id, year, month], [staff_id, year, month], [status] in `prisma/schema.prisma`
- [x] T010 Create `BDRExpenseCategory` model with fields (id, organization_id, name, description, is_active default true, created_at, updated_at), @@unique([organization_id, name]), and @@index([organization_id, is_active]) in `prisma/schema.prisma`
- [x] T011 Create `BDRExpenseClaim` model with fields (id, organization_id, staff_id, expense_date, category_id, amount Decimal(10,2), description, receipt_path, receipt_file_name, receipt_file_size, receipt_mime_type, has_receipt default false, status BDRExpenseStatus default SUBMITTED, admin_notes, approved_at, approved_by, reimbursed_at, created_at, updated_at), and indexes on [organization_id, status], [staff_id, status], [staff_id, expense_date] in `prisma/schema.prisma`
- [x] T012 Add relations to `Staff` model: pay_plan_assignments → BDRPayPlanAssignment[], bdr_reports → BDRMonthlyReport[], bdr_expenses → BDRExpenseClaim[], and add relations to `Organization` model for BDRPayPlan[], BDRMonthlyReport[], BDRExpenseCategory[], BDRExpenseClaim[] in `prisma/schema.prisma`
- [x] T013 Run `npx prisma db push` and `npx prisma generate` to apply all schema changes

### Non-Schema Foundation (parallelizable after T013)

- [x] T014 [P] Add `requireBDR()` auth helper that validates UserRole = BDR and returns `bdrStaffId` from UserProfile.bdr_staff_id, following `requireContractor()` pattern in `lib/auth/helpers.ts`
- [x] T015 [P] Update login redirect logic to route BDR role to `/bdr-portal` in `app/actions/auth.ts`
- [x] T016 [P] Create Zod validation schemas for pay plan CRUD (createPayPlanSchema, updatePayPlanSchema, assignPayPlanSchema) with tier validation in `lib/validations/bdr-pay-plan.ts`
- [x] T017 [P] Create Zod validation schemas for BDR monthly report (saveBDRReportSchema, submitBDRReportSchema, getBDRReportSchema) in `lib/validations/bdr-report.ts`
- [x] T018 [P] Create Zod validation schemas for BDR expenses (createBDRExpenseSchema, getBDRExpensesSchema) and expense category management in `lib/validations/bdr-expense.ts`
- [x] T019 [P] Create tiered bonus calculation engine as pure function `calculateTieredBonus(metricValue: number, tiers: Tier[])` returning `{ total, breakdown[] }` with cumulative tier logic per research.md in `lib/calculations/bdr-bonus.ts`

---

## Phase 3: US1 — Admin/Agency Admin Configures Pay Plans with Tiered Bonuses

**Goal**: Admin or Agency Admin can create pay plans with tiered bonus structures and assign them to BDRs
**Test Criteria**: Admin creates a 3-tier plan, assigns to a BDR, plan appears in list with correct tiers

- [x] T020 [US1] Create `createPayPlan()` server action (auth: ADMIN or AGENCY_ADMIN) that creates pay plan + tiers in transaction, validates no tier gaps/overlaps, auto-sets sort_order in `app/actions/bdr-admin-actions.ts`
- [x] T021 [US1] Add `updatePayPlan()` server action that updates plan fields and optionally replaces all tiers in transaction in `app/actions/bdr-admin-actions.ts`
- [x] T022 [US1] Add `assignPayPlan()` server action that validates staff is BDR, closes existing active assignment, creates new assignment in `app/actions/bdr-admin-actions.ts`
- [x] T023 [US1] Add `getPayPlans()` server action that returns all pay plans with tiers and assigned BDR count for the organization in `app/actions/bdr-admin-actions.ts`
- [x] T024 [US1] Add `manageExpenseCategories()` server action for creating/updating expense categories in `app/actions/bdr-admin-actions.ts`
- [x] T025 [P] [US1] Create `PayPlanForm` component with name, description, base metric select, effective date range, and inline tier editor with add/remove/reorder in `components/bdr-admin/PayPlanForm.tsx`
- [x] T026 [P] [US1] Create `TierEditor` component for adding/editing/removing bonus tiers with threshold validation (no gaps/overlaps) and payout rate inputs in `components/bdr-admin/TierEditor.tsx`
- [x] T027 [US1] Create pay plans admin page showing all plans in a list/table with create/edit modal and assign-to-BDR dropdown in `app/dashboard/bdr/pay-plans/page.tsx`

---

## Phase 4: US2 — BDR Submits End-of-Month Report

**Goal**: BDR logs into portal, enters meetings metrics, sees auto-calculated tiered bonus, submits report
**Test Criteria**: BDR enters 12 meetings showed with 3-tier plan → bonus = $825 displayed with breakdown, report status changes to SUBMITTED

- [x] T028 [US2] Create `getBDRDashboard()` server action returning current pay plan, current month report status, recent expenses, and monthly stats in `app/actions/bdr-portal-actions.ts`
- [x] T029 [US2] Add `getBDRMonthlyReport()` server action returning report for a given month/year with bonus breakdown, or null if no report exists in `app/actions/bdr-portal-actions.ts`
- [x] T030 [US2] Add `saveBDRReport()` server action that upserts report (only if DRAFT or NEEDS_CORRECTION), auto-calculates bonus using `calculateTieredBonus()`, stores breakdown as JSON in `app/actions/bdr-portal-actions.ts`
- [x] T031 [US2] Add `submitBDRReport()` server action that transitions status DRAFT/NEEDS_CORRECTION → SUBMITTED, sets submitted_at, snapshots pay_plan_id in `app/actions/bdr-portal-actions.ts`
- [x] T032 [US2] Create BDR portal layout with `requireBDR()` auth guard in `app/bdr-portal/layout.tsx`
- [x] T033 [P] [US2] Create BDR portal Sidebar component with navigation (Dashboard, Monthly Report, Expenses) following contractor portal Sidebar pattern in `components/bdr-portal/Sidebar.tsx`
- [x] T034 [P] [US2] Create BDR portal Header component with BDR name in `components/bdr-portal/Header.tsx`
- [x] T035 [US2] Create BDR portal dashboard page with current month report status card, bonus preview, recent expenses, and quick action buttons in `app/bdr-portal/page.tsx`
- [x] T036 [P] [US2] Create `BonusTierBreakdown` component displaying per-tier calculation (tier range, meetings in range, rate, subtotal) and total bonus in `components/bdr-portal/BonusTierBreakdown.tsx`
- [x] T037 [US2] Create `MonthlyReportForm` component with month selector, meetings booked/showed inputs, auto-calculated bonus with BonusTierBreakdown, notes field, status indicator, admin feedback display, and save/submit buttons in `components/bdr-portal/MonthlyReportForm.tsx`
- [x] T038 [US2] Create monthly reports page that loads current month report and pay plan, renders MonthlyReportForm in `app/bdr-portal/reports/page.tsx`

---

## Phase 5: US3 — BDR Submits Expense for Reimbursement

**Goal**: BDR submits expenses with receipt uploads; expenses appear in their history
**Test Criteria**: BDR creates expense with receipt upload → expense appears with SUBMITTED status, receipt retrievable via signed URL

**Prerequisites** (must complete before receipt upload tasks):
- [x] T039 [US3] Create Supabase Storage bucket `bdr-receipts` (private) with RLS policies: BDR can upload/read own files, admins can read all within org — document SQL in a migration file or setup script
- [x] T040 [US3] Increase server action body size limit if needed for 10MB file uploads in `next.config.js` or `next.config.ts`

- [x] T041 [US3] Add `getExpenseCategories()` server action returning active categories for the BDR's organization in `app/actions/bdr-portal-actions.ts`
- [x] T042 [US3] Add `createBDRExpense()` server action accepting FormData, validating category, uploading receipt to Supabase Storage `bdr-receipts` bucket (10MB max, PDF/JPG/PNG), creating BDRExpenseClaim in `app/actions/bdr-portal-actions.ts`
- [x] T043 [US3] Add `getBDRExpenses()` server action with status filter and pagination in `app/actions/bdr-portal-actions.ts`
- [x] T044 [US3] Add `getReceiptUrl()` server action generating 1-hour signed URL from Supabase Storage, validating expense belongs to BDR in `app/actions/bdr-portal-actions.ts`
- [x] T045 [P] [US3] Create `ReceiptUpload` component with file input, drag-and-drop, file type/size validation (10MB max, PDF/JPG/PNG), preview in `components/bdr-portal/ReceiptUpload.tsx`
- [x] T046 [US3] Create `ExpenseForm` component with date picker, category select, amount input, description, ReceiptUpload, and submit button in `components/bdr-portal/ExpenseForm.tsx`
- [x] T047 [US3] Create expenses page with expense list (status badges, receipt indicator), new expense form/modal, and status filter in `app/bdr-portal/expenses/page.tsx`

---

## Phase 6: US4 — Admin Reviews & Approves BDR Reports

**Goal**: Admin sees queue of submitted reports, reviews metrics and bonus calculation, approves or flags for correction
**Test Criteria**: Admin approves report → status APPROVED; admin flags → status NEEDS_CORRECTION with feedback visible to BDR

- [x] T048 [US4] Add `getBDRReportsForReview()` server action returning submitted reports with bonus breakdowns and monthly summary in `app/actions/bdr-admin-actions.ts`
- [x] T049 [US4] Add `approveReport()` server action transitioning SUBMITTED → APPROVED with approved_at/approved_by in `app/actions/bdr-admin-actions.ts`
- [x] T050 [US4] Add `flagReportForCorrection()` server action transitioning SUBMITTED → NEEDS_CORRECTION with required admin_notes in `app/actions/bdr-admin-actions.ts`
- [x] T051 [P] [US4] Create `ReportReviewCard` component showing BDR name, metrics, tier breakdown, bonus total, approve/flag buttons, and admin notes input in `components/bdr-admin/ReportReviewCard.tsx`
- [x] T052 [US4] Create admin report review page with month/year selector, list of ReportReviewCards, and monthly summary totals in `app/dashboard/bdr/reports/page.tsx`

---

## Phase 7: US5 — Admin Approves/Rejects Expense Claims

**Goal**: Admin sees pending expenses with receipt preview, approves or rejects with reason
**Test Criteria**: Admin approves expense → status APPROVED; admin rejects → status REJECTED with reason visible to BDR

- [x] T053 [US5] Add `getExpensesForApproval()` server action returning pending expenses with summary stats, and `getAdminReceiptUrl()` for signed receipt URLs in `app/actions/bdr-admin-actions.ts`
- [x] T054 [US5] Add `approveExpense()`, `rejectExpense()` (requires admin_notes), and `markExpenseReimbursed()` server actions in `app/actions/bdr-admin-actions.ts`
- [x] T055 [P] [US5] Create `ExpenseApprovalCard` component showing expense details, receipt preview link, approve/reject buttons, and rejection reason input in `components/bdr-admin/ExpenseApprovalCard.tsx`
- [x] T056 [US5] Create admin expense approval page with status filter, list of ExpenseApprovalCards, and summary totals (pending/approved/rejected amounts) in `app/dashboard/bdr/expenses/page.tsx`

---

## Phase 8: US6 — Leadership Views Compensation Dashboard

**Goal**: Leadership sees monthly summary of all BDR bonuses and expenses with per-BDR drill-down
**Test Criteria**: Dashboard shows accurate total bonuses + expenses = grand total, per-BDR breakdown matches approved records

- [x] T057 [US6] Add `getBDRCompensationSummary()` server action returning monthly totals, per-BDR breakdown (bonus + expenses), and grand total in `app/actions/bdr-admin-actions.ts`
- [x] T058 [P] [US6] Create `CompensationSummary` component with summary cards (total bonuses, total expenses, grand total), per-BDR breakdown table with drill-down in `components/bdr-admin/CompensationSummary.tsx`
- [x] T059 [US6] Create BDR management dashboard page with month selector, CompensationSummary, and navigation to pay plans/reports/expenses sub-pages in `app/dashboard/bdr/page.tsx`

---

## Phase 9: Polish & Cross-Cutting Concerns

- [x] T060 Add "BDR Management" section to admin dashboard sidebar with sub-items: Dashboard (/dashboard/bdr), Pay Plans (/dashboard/bdr/pay-plans), Reports (/dashboard/bdr/reports), Expenses (/dashboard/bdr/expenses) in the existing sidebar component
- [x] T061 Update `inviteUser` logic in `app/actions/user-management.ts` to support BDR role with `bdr_staff_id` linking (mirror contractor invite pattern)
- [x] T062 [P] Create `InviteBDRModal` component for inviting a BDR to the portal (select staff member with staff_type='BDR', send invite, link bdr_staff_id) in `components/bdr-admin/InviteBDRModal.tsx`

---

## Implementation Strategy

### MVP Scope (US1 + US2)
1. Complete Phase 1 (Setup) and Phase 2 (Foundation)
2. Implement US1 (Pay Plan Configuration) — admin can create tiered plans
3. Implement US2 (Monthly Report) — BDR can submit reports with auto-calculated bonuses
4. This gives the core loop: admin configures → BDR reports → bonus calculated

### Incremental Delivery
- **Increment 1**: US1 + US2 (core bonus workflow)
- **Increment 2**: US3 (expenses) — independent, adds expense submission
- **Increment 3**: US4 + US5 (admin review) — adds approval workflow
- **Increment 4**: US6 (dashboard) — adds leadership visibility
- **Increment 5**: Polish (sidebar, invites, storage setup)

### Parallel Execution Guide
```
Phase 2: T014, T015, T016, T017, T018, T019 can all run in parallel (after T013)
Phase 4 + Phase 5: US2 and US3 can run in parallel (different files); US3 requires T039-T040 (storage/body limit) first
Phase 6 + Phase 7: US4 and US5 can run in parallel (different files)
Within any phase: [P]-marked tasks can run in parallel with other [P] tasks in the same phase
```
