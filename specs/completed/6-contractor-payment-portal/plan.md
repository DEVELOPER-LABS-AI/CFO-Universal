# Implementation Plan: Contractor Payment Portal

**Branch**: `6-contractor-payment-portal`
**Spec**: [spec.md](./spec.md)
**Data Model**: [data-model.md](./data-model.md)
**Contracts**: [contracts/server-actions.md](./contracts/server-actions.md)
**Research**: [research.md](./research.md)

---

## Technical Context

| Area | Decision | Reference |
|------|----------|-----------|
| Database | Prisma + Supabase PostgreSQL | Constitution Principle #8 |
| Auth | Supabase Auth, magic link, CONTRACTOR role | `lib/auth/helpers.ts` |
| Mercury Payments | `request-send-money` via Lambda proxy | `lib/mercury/lambda-client.ts` |
| Mercury Recipients | GET/POST `/recipients` via Lambda proxy | `lib/mercury/lambda-client.ts` |
| Email | Resend + React Email templates | New: `lib/email/resend-client.ts` |
| File Storage | Supabase Storage, private bucket, signed URLs | `lib/supabase/admin.ts` |
| Scheduling | Vercel Cron, daily at 8 AM UTC | `vercel.json` |
| Frontend | Server Components + shadcn/ui | Constitution Principle #1 |
| Mutations | Next.js Server Actions + Zod validation | Constitution API Design |
| State Caching | TanStack Query | Constitution Frontend Design |

---

## Constitution Compliance Check

| Principle | Status | Notes |
|-----------|--------|-------|
| #1 Technology Stack | PASS | Next.js, Prisma, Supabase, Tailwind, shadcn/ui |
| #2 Data Architecture | PASS | All data scoped by organization_id; soft deletes on core entities |
| #3 Integration Philosophy | PASS | Mercury via existing API key auth; new Resend integration follows same pattern |
| #4 Security Requirements | PASS | RLS for storage; encrypted Mercury keys; contractor data isolation |
| #5 Performance Standards | PASS | Server components for fast render; signed URLs for doc access |
| #6 Code Quality | PASS | TypeScript strict; Zod validation; audit logging |
| #7 Development Workflow | PASS | Feature branch 6-contractor-payment-portal; spec-driven |
| #8 Prisma-Supabase Alignment | PASS | Will use pooler URLs; `prisma migrate dev` for schema changes |

---

## Implementation Phases

### Phase 1: Database & Foundation (Estimated: 8 files)

**Goal**: Schema changes, auth extension, email infrastructure

1. **Prisma Schema Migration**
   - Verify DB connection: `npx prisma migrate status`
   - Add enums: `ContractorLineItemType`, `ContractorDocumentType`, `PaymentMethod`, `PaymentStatus`, `PortalInvitationStatus`
   - Add `CONTRACTOR` to `UserRole` enum
   - Extend `Contractor` model (email, mercury_recipient_id, portal fields, reminder fields)
   - Extend `Organization` model (contractor_reminder_day, contractor_default_doc_types)
   - Extend `UserProfile` model (contractor_id relation)
   - Add `ContractorInvoice` model with unique `[contractor_id, month, year]`
   - Add `ContractorInvoiceLineItem` model
   - Add `ContractorDocument` model
   - Add `ContractorPayment` model
   - Add relations to Organization (contractor_invoices, contractor_documents, contractor_payments)
   - Run: `npx prisma migrate dev --name add_contractor_payment_portal`
   - Run: `npx prisma generate`

   **Files**:
   - `prisma/schema.prisma`
   - `prisma/migrations/YYYYMMDD_add_contractor_payment_portal/migration.sql`

2. **Auth Extension**
   - Add `requireContractor()` to `lib/auth/helpers.ts`
   - Update login redirect logic in `app/actions/auth.ts` for CONTRACTOR role
   - Update `inviteUser` schema to support `contractor_id`

   **Files**:
   - `lib/auth/helpers.ts`
   - `app/actions/auth.ts`
   - `app/actions/user-management.ts`

3. **Email Infrastructure**
   - Install packages: `resend`, `@react-email/components`
   - Create Resend client singleton
   - Create React Email templates (reminder, status notification)

   **Files**:
   - `lib/email/resend-client.ts`
   - `components/emails/contractor-reminder.tsx`
   - `components/emails/invoice-status-notification.tsx`

4. **Validation Schemas**
   - Zod schemas for contractor invoices, line items, documents, settings

   **Files**:
   - `lib/validations/contractor-invoice.ts`

### Phase 2: Mercury Extension (Estimated: 3 files)

**Goal**: Add payment and recipient methods to Mercury client

1. **Extend LambdaMercuryClient**
   - Add `requestSendMoney(accountId, payload)`
   - Add `getRecipients(params?)`
   - Add `createRecipient(payload)`
   - Add TypeScript interfaces for request/response

   **Files**:
   - `lib/mercury/lambda-client.ts`
   - `types/mercury.ts`

2. **Payment & Recipient Server Actions**

   **Files**:
   - `app/actions/mercury-payment-actions.ts`
   - `app/actions/mercury-recipient-actions.ts`

### Phase 3: Contractor Portal (Estimated: 12 files)

**Goal**: Full contractor-facing portal

1. **Portal Layout & Navigation**
   - Layout with `requireContractor()` auth
   - Sidebar: Dashboard, Invoices, Payments, Profile
   - Header with contractor name

   **Files**:
   - `app/contractor-portal/layout.tsx`
   - `components/contractor-portal/Sidebar.tsx`
   - `components/contractor-portal/Header.tsx`

2. **Dashboard Page**
   - Current month invoice status
   - Quick stats (total paid, pending, due)
   - Action buttons (view invoice, upload docs)

   **Files**:
   - `app/contractor-portal/page.tsx`

3. **Invoice Pages**
   - List view: all invoices with status badges
   - Detail view: base amount, line items, document uploads, submit button
   - Line item add/edit/remove
   - Document upload with drag-and-drop

   **Files**:
   - `app/contractor-portal/invoices/page.tsx`
   - `app/contractor-portal/invoices/[id]/page.tsx`
   - `components/contractor-portal/InvoiceForm.tsx`
   - `components/contractor-portal/DocumentUpload.tsx`
   - `components/contractor-portal/InvoiceStatusBadge.tsx`

4. **Payment History Page**

   **Files**:
   - `app/contractor-portal/payments/page.tsx`

5. **Server Actions**

   **Files**:
   - `app/actions/contractor-portal-actions.ts`
   - `app/actions/contractor-document-actions.ts`

### Phase 4: Admin Dashboard (Estimated: 8 files)

**Goal**: Admin-side contractor management and invoice review

1. **Dashboard Settings**
   - Contractor Payment section in existing settings page
   - Global reminder day picker (1-28)
   - Default required document types

   **Files**:
   - `app/dashboard/settings/page.tsx` (modify)
   - `components/admin/ContractorSettingsForm.tsx`

2. **Contractor Invoice Review**
   - Invoice review queue (filtered by status)
   - Detail view with documents inline
   - Approve/reject with notes
   - Payment initiation button

   **Files**:
   - `app/dashboard/admin/contractor-invoices/page.tsx`
   - `app/dashboard/admin/contractor-invoices/[id]/page.tsx`
   - `components/admin/ContractorInvoiceReview.tsx`

3. **Mercury Recipient Management**
   - Link contractor to existing Mercury recipient
   - Create new Mercury recipient from UI

   **Files**:
   - `components/admin/MercuryRecipientPicker.tsx`

4. **Contractor Onboarding**
   - Invite contractor to portal
   - Per-contractor settings (reminder override, required docs)

   **Files**:
   - `components/admin/InviteContractorModal.tsx`

5. **Admin Server Actions**

   **Files**:
   - `app/actions/contractor-admin-actions.ts`

### Phase 5: Automation & Polish (Estimated: 5 files)

**Goal**: Cron jobs, notifications, Supabase storage setup

1. **Cron Job for Reminders**
   - Daily cron route at 8 AM UTC
   - Query contractors whose reminder day matches today
   - Send batch emails via Resend
   - Add to vercel.json

   **Files**:
   - `app/api/contractor/reminders/cron/route.ts`
   - `vercel.json` (modify)

2. **Email Actions**
   - Send individual reminder
   - Send batch reminders
   - Send status notifications (approval, rejection, payment)

   **Files**:
   - `app/actions/email-actions.ts`

3. **Supabase Storage Setup**
   - Create `contractor-documents` bucket
   - Configure RLS policies
   - Increase body size limit in next.config

   **Files**:
   - `next.config.js` (modify)
   - SQL migration for storage bucket + RLS policies

4. **Sidebar Navigation Update**
   - Add Contractor Invoices to admin sidebar under Expenses section

   **Files**:
   - Existing sidebar component (modify)

---

## Database Migration Checklist (Constitution Principle #8)

- [ ] Verify `.env` has correct pooler URLs (not direct db URLs)
- [ ] Test connection: `npx prisma migrate status`
- [ ] Create migration: `npx prisma migrate dev --name add_contractor_payment_portal`
- [ ] Review migration SQL before applying
- [ ] Run: `npx prisma generate`
- [ ] Verify schema sync: `npx prisma migrate status`
- [ ] Test rollback plan documented

---

## Verification Plan

### Unit Tests
- Zod validation schemas (contractor invoice, line items, documents)
- Invoice total calculation (base + line items)
- Rate-to-monthly conversion (hourly × 176, daily × 22)
- Invoice status transition guard logic

### Integration Tests
- Mercury payment initiation (mock Lambda proxy)
- Mercury recipient CRUD (mock Lambda proxy)
- Resend email sending (mock Resend client)
- Supabase storage upload/download (mock storage)

### E2E Tests
- Contractor login via magic link
- Full invoice lifecycle: create → add line items → upload docs → submit → approve → pay
- Rejection and resubmission flow
- Admin settings update → cron sends on new day
- Mercury recipient linking from admin UI

### Manual Verification
- [ ] Cron job triggers at expected time (check Vercel dashboard)
- [ ] Email deliverability (check Resend dashboard for bounce/spam rates)
- [ ] Mercury payment appears in Mercury approval queue
- [ ] Signed URLs expire correctly (test after 1 hour)
- [ ] File upload respects 10MB limit
- [ ] Contractor cannot access another contractor's data
