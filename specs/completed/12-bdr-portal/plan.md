# Implementation Plan: BDR Portal — End-of-Month Reports, Bonus Plans & Expense Reimbursement

**Branch**: `12-bdr-portal`
**Spec**: [spec.md](./spec.md)
**Data Model**: [data-model.md](./data-model.md)
**Contracts**: [contracts/server-actions.md](./contracts/server-actions.md)
**Research**: [research.md](./research.md)

---

## Technical Context

| Area | Decision | Reference |
|------|----------|-----------|
| Database | Prisma + Supabase PostgreSQL | Constitution Principle #8 |
| Auth | Supabase Auth, `BDR` UserRole, `requireBDR()` helper | `lib/auth/helpers.ts` |
| BDR Identity | Staff with `staff_type = 'BDR'`; UserProfile linked via `bdr_staff_id` | `prisma/schema.prisma` |
| File Storage | Supabase Storage, `bdr-receipts` bucket, 10MB max, signed URLs | `lib/supabase/admin.ts` |
| Frontend (Portal) | Server Components + shadcn/ui at `/bdr-portal` | Contractor portal pattern |
| Frontend (Admin) | Server Components + shadcn/ui at `/dashboard/bdr` | Dashboard pattern |
| Mutations | Next.js Server Actions + Zod validation | Constitution API Design |
| Bonus Calculation | Tiered cumulative engine (pure function) | `lib/calculations/bdr-bonus.ts` |
| Notifications | In-app status changes (no email for MVP) | Deferred from clarify |

---

## Constitution Compliance Check

| Principle | Status | Notes |
|-----------|--------|-------|
| #1 Technology Stack | PASS | Next.js, Prisma, Supabase, Tailwind, shadcn/ui |
| #2 Data Architecture | PASS | All data scoped by `organization_id`; soft deletes; RLS policies |
| #3 Integration Philosophy | PASS | Supabase Storage for file uploads; no new external integrations |
| #4 Security Requirements | PASS | RLS for storage bucket; BDR data isolation; compensation privacy |
| #5 Performance Standards | PASS | Server components for fast render; signed URLs for receipt access |
| #6 Code Quality | PASS | TypeScript strict; Zod validation; Prisma-generated types |
| #7 Development Workflow | PASS | Feature branch `12-bdr-portal`; spec-driven |
| #8 Prisma-Supabase Alignment | PASS | Pooler URLs; `prisma db push` for schema changes; `prisma generate` |

---

## Implementation Phases

### Phase 1: Database & Foundation (Estimated: 7 files)

**Goal**: Schema changes, auth extension, validation schemas, bonus calculation engine

1. **Prisma Schema Migration**
   - Verify DB connection: `npx prisma migrate status`
   - Add `BDR` to `UserRole` enum
   - Add `bdr_staff_id` to `UserProfile` model (nullable, links BDR user to Staff record)
   - Add `BDRPayPlan` model (name, description, base_metric, effective_start, effective_end, org_id)
   - Add `BDRBonusTier` model (pay_plan_id, min_threshold, max_threshold, payout_rate, sort_order)
   - Add `BDRMonthlyReport` model (bdr_staff_id, month, year, meetings_booked, meetings_showed, calculated_bonus, pay_plan_id, status, notes, admin_notes)
   - Add `BDRExpenseCategory` model (name, description, org_id, is_active)
   - Add `BDRExpenseClaim` model (bdr_staff_id, date, category_id, amount, description, receipt_path, status, admin_notes)
   - Add `BDRPayPlanAssignment` model (pay_plan_id, staff_id, effective_from, effective_to)
   - Run: `npx prisma db push`
   - Run: `npx prisma generate`

   **Files**:
   - `prisma/schema.prisma`

2. **Auth Extension**
   - Add `requireBDR()` to `lib/auth/helpers.ts` — validates UserRole = BDR, returns `bdrStaffId`
   - Update login redirect logic in `app/actions/auth.ts` for BDR role → `/bdr-portal`

   **Files**:
   - `lib/auth/helpers.ts`
   - `app/actions/auth.ts`

3. **Validation Schemas**
   - Pay plan CRUD schemas (create, update, assign)
   - Bonus tier schemas (create, update, reorder)
   - Monthly report schemas (submit, update)
   - Expense claim schemas (create, update)
   - Expense category schemas (create, update)

   **Files**:
   - `lib/validations/bdr-pay-plan.ts`
   - `lib/validations/bdr-report.ts`
   - `lib/validations/bdr-expense.ts`

4. **Bonus Calculation Engine**
   - Pure function: `calculateTieredBonus(metricValue, tiers)` → `{ total, breakdown[] }`
   - Breakdown returns per-tier: `{ tier, meetingsInRange, rate, subtotal }`
   - Handles zero meetings, single tier, uncapped top tier

   **Files**:
   - `lib/calculations/bdr-bonus.ts`

### Phase 2: BDR Portal (Estimated: 12 files)

**Goal**: Full BDR-facing self-service portal

1. **Portal Layout & Navigation**
   - Layout with `requireBDR()` auth
   - Sidebar: Dashboard, Monthly Report, Expenses
   - Header with BDR name and pay plan info

   **Files**:
   - `app/bdr-portal/layout.tsx`
   - `components/bdr-portal/Sidebar.tsx`
   - `components/bdr-portal/Header.tsx`

2. **Dashboard Page**
   - Current month report status (Draft/Submitted/Approved)
   - Current bonus calculation preview
   - Recent expenses summary
   - Quick action buttons

   **Files**:
   - `app/bdr-portal/page.tsx`

3. **Monthly Report Page**
   - Month selector (current month default, allow previous months)
   - Meetings booked / meetings showed inputs
   - Auto-calculated bonus with tier breakdown display
   - Notes field
   - Submit button (Draft → Submitted)
   - Status indicator (Draft/Submitted/Approved/Needs Correction)
   - Admin feedback display when status = Needs Correction

   **Files**:
   - `app/bdr-portal/reports/page.tsx`
   - `components/bdr-portal/MonthlyReportForm.tsx`
   - `components/bdr-portal/BonusTierBreakdown.tsx`

4. **Expenses Page**
   - Expense list with status badges
   - New expense form: date, category, amount, description, receipt upload
   - Receipt upload via Supabase Storage (10MB max, PDF/JPG/PNG)
   - Expense history with filter by status

   **Files**:
   - `app/bdr-portal/expenses/page.tsx`
   - `components/bdr-portal/ExpenseForm.tsx`
   - `components/bdr-portal/ReceiptUpload.tsx`

5. **Server Actions (BDR Portal)**

   **Files**:
   - `app/actions/bdr-portal-actions.ts`
   - `app/actions/bdr-receipt-actions.ts`

### Phase 3: Admin Dashboard (Estimated: 10 files)

**Goal**: Admin-side BDR management, pay plan config, report review, expense approval

1. **Pay Plan Management**
   - Create/edit pay plan with name, description, base metric, date range
   - Add/edit/remove bonus tiers with threshold validation (no gaps/overlaps)
   - Assign pay plans to BDRs
   - View plan history

   **Files**:
   - `app/dashboard/bdr/pay-plans/page.tsx`
   - `components/bdr-admin/PayPlanForm.tsx`
   - `components/bdr-admin/TierEditor.tsx`

2. **Report Review**
   - Queue of submitted BDR reports for current month
   - Each report shows: BDR name, metrics, calculated bonus, tier breakdown
   - Approve or mark "Needs Correction" with feedback notes
   - Monthly summary: total bonuses, per-BDR breakdown

   **Files**:
   - `app/dashboard/bdr/reports/page.tsx`
   - `components/bdr-admin/ReportReviewCard.tsx`

3. **Expense Approval**
   - Queue of pending expenses with receipt preview (signed URLs)
   - Approve/reject with reason
   - Expense summary: totals by category, by BDR

   **Files**:
   - `app/dashboard/bdr/expenses/page.tsx`
   - `components/bdr-admin/ExpenseApprovalCard.tsx`

4. **BDR Compensation Dashboard**
   - Monthly summary: total bonuses + total expenses = grand total
   - Per-BDR breakdown with drill-down
   - Month-over-month comparison
   - Filter by month, BDR, pay plan

   **Files**:
   - `app/dashboard/bdr/page.tsx`
   - `components/bdr-admin/CompensationSummary.tsx`

5. **Admin Server Actions**

   **Files**:
   - `app/actions/bdr-admin-actions.ts`

### Phase 4: Storage & Polish (Estimated: 4 files)

**Goal**: Supabase storage setup, sidebar navigation, edge cases

1. **Supabase Storage Setup**
   - Create `bdr-receipts` bucket (private)
   - RLS policies: BDR can upload/read own receipts; admins can read all within org
   - Max 10MB per file

   **Files**:
   - SQL migration for storage bucket + RLS policies

2. **Dashboard Sidebar Update**
   - Add "BDR Management" section to admin sidebar
   - Sub-items: Dashboard, Pay Plans, Reports, Expenses

   **Files**:
   - Existing sidebar component (modify)

3. **BDR Onboarding**
   - Invite BDR to portal (set UserRole = BDR, link bdr_staff_id)
   - Admin assigns pay plan during onboarding

   **Files**:
   - `app/actions/user-management.ts` (modify)
   - `components/bdr-admin/InviteBDRModal.tsx`

---

## Database Migration Checklist (Constitution Principle #8)

- [ ] Verify `.env` has correct pooler URLs (not direct db URLs)
- [ ] Test connection: `npx prisma migrate status`
- [ ] Apply schema: `npx prisma db push`
- [ ] Run: `npx prisma generate`
- [ ] Verify schema sync: `npx prisma migrate status`
- [ ] Test rollback plan documented

---

## Verification Plan

### Unit Tests
- Tiered bonus calculation engine (zero meetings, single tier, multi-tier, uncapped top tier)
- Zod validation schemas (pay plan, report, expense)
- Tier threshold validation (no gaps, no overlaps)

### Integration Tests
- BDR monthly report lifecycle: Draft → Submitted → Approved
- BDR monthly report lifecycle: Draft → Submitted → Needs Correction → Submitted → Approved
- Expense claim lifecycle: Submitted → Approved/Rejected
- Pay plan assignment and effective date logic
- Supabase storage upload/download (mock storage)

### E2E Tests
- BDR login → submit monthly report → view bonus breakdown
- BDR login → submit expense with receipt → view status
- Admin login → create pay plan with tiers → assign to BDR
- Admin login → review and approve BDR report
- Admin login → approve/reject expense with reason
- Admin login → view compensation dashboard with filters

### Manual Verification
- [ ] Bonus calculation matches manual tier math (100% accuracy)
- [ ] File upload respects 10MB limit
- [ ] BDR cannot access another BDR's data
- [ ] Admin can see all BDR data within their organization
- [ ] Approved reports cannot be modified by BDR
- [ ] One report per BDR per month enforced
- [ ] Zero-meeting report submittable with $0 bonus
