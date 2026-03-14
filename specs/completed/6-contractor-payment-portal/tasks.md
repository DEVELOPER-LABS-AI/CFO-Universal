# Tasks: Contractor Payment Portal & Automated Invoice Workflow

**Branch**: `6-contractor-payment-portal`
**Total Tasks**: 48
**Generated**: 2026-02-25

---

## User Story Mapping

| Story | Description | Priority | FR Coverage |
|-------|-------------|----------|-------------|
| US1 | Contractor Onboarding & Portal Access | P1 | FR-4, FR-9 |
| US2 | Contractor Invoice & Document Submission | P1 | FR-5, FR-6 |
| US3 | Admin Invoice Review & Approval | P1 | FR-7 |
| US4 | Mercury Payment Integration | P1 | FR-8, FR-9 |
| US5 | Reminder Configuration | P2 | FR-1, FR-2 |
| US6 | Automated Email Reminders | P2 | FR-3, FR-10 |
| US7 | Payment History & Visibility | P2 | Scenario 6 |

---

## Dependencies

```
US1 (Onboarding) ← US2 (Invoice Submission) ← US3 (Review) ← US4 (Payment) ← US7 (History)
US5 (Reminder Config) ← US6 (Automated Reminders)
US1 ← US6 (needs contractors to remind)
```

**Parallel Opportunities**:
- T003–T006 (Phase 2 foundational tasks) can run in parallel
- US5 (Reminder Config) can run in parallel with US2/US3/US4
- US7 (Payment History) can run in parallel with US5/US6 once US4 is done

---

## Phase 1: Setup

- [x] T001 Install `resend` and `@react-email/components` packages via `npm install resend @react-email/components`
- [x] T002 Add `RESEND_API_KEY` and `CRON_SECRET` environment variables to `.env.local` and Vercel project settings

---

## Phase 2: Foundation (blocking — must complete before user stories)

- [x] T003 Verify database connection with `npx prisma migrate status` per Constitution Principle #8
- [x] T004 Add new enums (`ContractorLineItemType`, `ContractorDocumentType`, `PaymentMethod`, `PaymentStatus`, `PortalInvitationStatus`) and add `CONTRACTOR` to `UserRole` enum in `prisma/schema.prisma`
- [x] T005 Extend `Contractor` model with portal fields (email, mercury_recipient_id, portal_invitation_status, reminder_day_override, reminder_enabled, required_doc_types, last_reminder_sent_at, last_reminder_month, last_reminder_year) in `prisma/schema.prisma`
- [x] T006 Extend `Organization` model with `contractor_reminder_day` (Int, default 24) and `contractor_default_doc_types` (Json?) in `prisma/schema.prisma`
- [x] T007 Add `contractor_id` (String?, @db.Uuid) field and Contractor relation to `UserProfile` model in `prisma/schema.prisma`
- [x] T008 Create `ContractorInvoice` model with @@unique([contractor_id, month, year]) and all fields per data-model.md in `prisma/schema.prisma`
- [x] T009 Create `ContractorInvoiceLineItem` model with Cascade delete and @@index([invoice_id]) in `prisma/schema.prisma`
- [x] T010 Create `ContractorDocument` model with SetNull on invoice delete and org/contractor/invoice indexes in `prisma/schema.prisma`
- [x] T011 Create `ContractorPayment` model with @unique invoice_id and status/org/contractor indexes in `prisma/schema.prisma`
- [x] T012 Add all new relations (contractor_invoices, contractor_documents, contractor_payments) to `Organization` model in `prisma/schema.prisma`
- [x] T013 Run `npx prisma migrate dev --name add_contractor_payment_portal` and `npx prisma generate` to apply migration
- [x] T014 [P] Create Zod validation schemas for contractor invoices, line items, documents, settings, and review in `lib/validations/contractor-invoice.ts`
- [x] T015 [P] Create Resend client singleton with RESEND_API_KEY in `lib/email/resend-client.ts`
- [x] T016 [P] Add `requireContractor()` auth helper following `requireAgencyAdmin()` pattern in `lib/auth/helpers.ts`
- [x] T017 [P] Update login redirect logic to route CONTRACTOR role to `/contractor-portal` in `app/actions/auth.ts`
- [x] T018 [P] Increase server action body size limit to `'11mb'` for file uploads in `next.config.js` (or `next.config.ts`)

---

## Phase 3: US1 — Contractor Onboarding & Portal Access

**Goal**: Admin can invite a contractor to the portal; contractor can log in via magic link
**Test Criteria**: Contractor receives magic link, logs in, sees empty dashboard with their name

- [ ] T019 [US1] Add `requestSendMoney()`, `getRecipients()`, and `createRecipient()` methods to `LambdaMercuryClient` in `lib/mercury/lambda-client.ts`
- [ ] T020 [P] [US1] Add Mercury payment/recipient TypeScript interfaces (MercuryRecipient, RequestSendMoneyPayload, SendMoneyResponse) in `types/mercury.ts`
- [ ] T021 [US1] Create `getMercuryRecipients()`, `linkMercuryRecipient()`, and `createMercuryRecipient()` server actions in `app/actions/mercury-recipient-actions.ts`
- [ ] T022 [US1] Update `inviteUser` schema to support `contractor_id` and CONTRACTOR role, add contractor invitation logic in `app/actions/user-management.ts`
- [ ] T023 [US1] Create `inviteContractor()` and `updateContractorPortalSettings()` server actions in `app/actions/contractor-admin-actions.ts`
- [ ] T024 [US1] Create contractor portal layout with `requireContractor()` auth guard in `app/contractor-portal/layout.tsx`
- [ ] T025 [P] [US1] Create contractor portal Sidebar component (Dashboard, Invoices, Payments nav) in `components/contractor-portal/Sidebar.tsx`
- [ ] T026 [P] [US1] Create contractor portal Header component with contractor name in `components/contractor-portal/Header.tsx`
- [ ] T027 [US1] Create `getContractorDashboard()` server action in `app/actions/contractor-portal-actions.ts`
- [ ] T028 [US1] Create contractor dashboard page with quick stats and current invoice status in `app/contractor-portal/page.tsx`
- [ ] T029 [US1] Create MercuryRecipientPicker component for linking/creating Mercury recipients in `components/admin/MercuryRecipientPicker.tsx`
- [ ] T030 [US1] Create InviteContractorModal component with email input and magic link generation in `components/admin/InviteContractorModal.tsx`

---

## Phase 4: US2 — Contractor Invoice & Document Submission

**Goal**: Contractor can view/create monthly invoices, add line items, upload documents, and submit
**Test Criteria**: Draft invoice auto-created with pre-populated base amount; line items add/edit/remove; docs upload (PDF ≤ 10MB); submit blocked without required docs

- [ ] T031 [US2] Create Supabase Storage bucket `contractor-documents` (private, 10MB limit) and RLS policies via SQL migration
- [ ] T032 [US2] Create `getOrCreateDraftInvoice()`, `addInvoiceLineItem()`, `updateInvoiceLineItem()`, `removeInvoiceLineItem()`, `submitInvoice()`, `getInvoiceHistory()`, `getInvoice()` server actions in `app/actions/contractor-portal-actions.ts`
- [ ] T033 [US2] Create `uploadDocument()`, `deleteDocument()`, `getDocumentUrl()` server actions with Supabase Storage integration in `app/actions/contractor-document-actions.ts`
- [ ] T034 [US2] Create InvoiceStatusBadge component for Draft/Submitted/Approved/Rejected/Paid states in `components/contractor-portal/InvoiceStatusBadge.tsx`
- [ ] T035 [P] [US2] Create DocumentUpload component with drag-and-drop, file type validation (PDF/DOCX/PNG/JPG), and 10MB size check in `components/contractor-portal/DocumentUpload.tsx`
- [ ] T036 [US2] Create InvoiceForm component with base amount display, line item CRUD, document upload section, and submit button in `components/contractor-portal/InvoiceForm.tsx`
- [ ] T037 [US2] Create invoice list page showing all invoices with status badges in `app/contractor-portal/invoices/page.tsx`
- [ ] T038 [US2] Create invoice detail page with InvoiceForm and DocumentUpload integration in `app/contractor-portal/invoices/[id]/page.tsx`

---

## Phase 5: US3 — Admin Invoice Review & Approval

**Goal**: Admin can view submitted invoices, review documents inline, approve or reject with notes
**Test Criteria**: Admin sees pending queue; can view docs inline; approve sets status=APPROVED; reject reverts to DRAFT with required reason; contractor gets email + in-portal notification

- [ ] T039 [US3] Create React Email template for invoice status notifications (approval/rejection with notes) in `components/emails/invoice-status-notification.tsx`
- [ ] T040 [US3] Create `getAllContractorInvoices()`, `getContractorInvoiceForReview()`, `reviewContractorInvoice()` server actions in `app/actions/contractor-admin-actions.ts`
- [ ] T041 [US3] Create ContractorInvoiceReview component with document viewer, approve/reject buttons, and rejection notes textarea in `components/admin/ContractorInvoiceReview.tsx`
- [ ] T042 [US3] Create contractor invoice review list page with status filters in `app/dashboard/admin/contractor-invoices/page.tsx`
- [ ] T043 [US3] Create contractor invoice detail review page with inline document viewing in `app/dashboard/admin/contractor-invoices/[id]/page.tsx`
- [ ] T044 [US3] Add "Contractor Invoices" link to admin sidebar navigation under Expenses section in existing sidebar component

---

## Phase 6: US4 — Mercury Payment Integration

**Goal**: Admin can initiate payment for approved invoices via Mercury API; track payment status; retry on failure
**Test Criteria**: Payment only for APPROVED invoices; Mercury request-send-money called via Lambda proxy; payment record created with status tracking; retry works for FAILED payments; blocked if no Mercury recipient linked

- [ ] T045 [US4] Create `initiatePayment()`, `retryPayment()`, `getPaymentStatus()` server actions in `app/actions/mercury-payment-actions.ts`
- [ ] T046 [US4] Add payment initiation UI (payment method selector, confirm button) and retry button to ContractorInvoiceReview component in `components/admin/ContractorInvoiceReview.tsx`

---

## Phase 7: US5 — Reminder Configuration (parallelizable with Phase 4-6)

**Goal**: Admin can set global reminder day and per-contractor overrides
**Test Criteria**: Global day saved to Organization (default 24); per-contractor override saves to Contractor; disabled flag prevents reminders

- [ ] T047 [US5] Create `getGlobalContractorSettings()` and `updateGlobalContractorSettings()` server actions in `app/actions/contractor-admin-actions.ts`
- [ ] T048 [US5] Create ContractorSettingsForm component with day picker (1-28) and default doc types in `components/admin/ContractorSettingsForm.tsx`
- [ ] T049 [US5] Add Contractor Payment settings section to existing dashboard settings page in `app/dashboard/settings/page.tsx`

---

## Phase 8: US6 — Automated Email Reminders (depends on US5 + US1)

**Goal**: Cron sends monthly emails to contractors on their configured reminder day; admin can send manual reminders
**Test Criteria**: Cron at 8 AM UTC checks day-of-month; sends to contractors matching that day; per-contractor override respected; max 3 manual reminders/month; email contains portal link and missing doc list

- [ ] T050 [US6] Create React Email template for contractor reminder with portal link and required docs list in `components/emails/contractor-reminder.tsx`
- [ ] T051 [US6] Create `sendContractorReminder()` and `sendBatchReminders()` email actions in `app/actions/email-actions.ts`
- [ ] T052 [US6] Create `sendManualReminder()` action with 3-per-month guard in `app/actions/contractor-admin-actions.ts`
- [ ] T053 [US6] Create cron route with CRON_SECRET auth that calls `sendBatchReminders(currentDay)` in `app/api/contractor/reminders/cron/route.ts`
- [ ] T054 [US6] Add cron entry `{ "path": "/api/contractor/reminders/cron", "schedule": "0 8 * * *" }` to `vercel.json`

---

## Phase 9: US7 — Payment History & Visibility (depends on US4)

**Goal**: Contractor can view payment status and history for all their invoices
**Test Criteria**: Contractor sees all invoices with payment status; completed payments show date and method; pending/failed visible

- [ ] T055 [US7] Create payment history page with payment status badges and amount/method/date details in `app/contractor-portal/payments/page.tsx`

---

## Phase 10: Polish & Cross-Cutting Concerns

- [ ] T056 Verify all server actions have proper `revalidatePath()` calls after mutations across all action files
- [ ] T057 Verify audit logging is implemented for approve, reject, and payment actions in `app/actions/contractor-admin-actions.ts` and `app/actions/mercury-payment-actions.ts`
- [ ] T058 Run `npx prisma migrate status` to verify schema sync and test database connection per Constitution Principle #8

---

## Implementation Strategy

### MVP Scope (US1 + US2 + US3)
The minimum viable product is Phases 1-5: contractors can be onboarded, submit invoices with documents, and admins can review and approve/reject. This covers the core workflow without Mercury payment or automated reminders.

### Incremental Delivery
1. **MVP**: Phases 1-5 (Foundation + US1 + US2 + US3) — core invoice workflow
2. **Payment**: Phase 6 (US4) — Mercury payment integration
3. **Automation**: Phases 7-8 (US5 + US6) — reminder configuration + cron
4. **Visibility**: Phase 9 (US7) — contractor payment history
5. **Polish**: Phase 10 — cross-cutting validation

### Parallel Execution Opportunities

**Within Phase 2** (after T013 migration):
- T014, T015, T016, T017, T018 can all run in parallel (different files, no dependencies)

**Within Phase 3**:
- T020 (types), T025 (Sidebar), T026 (Header) can run in parallel

**Within Phase 4**:
- T035 (DocumentUpload) can run in parallel with T034 (StatusBadge)

**Cross-phase**:
- Phase 7 (US5 - Reminder Config) can run in parallel with Phases 4-6 since it only touches settings
