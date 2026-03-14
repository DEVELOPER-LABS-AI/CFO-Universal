# Server Actions Contract: Contractor Payment Portal

All server actions use Next.js `'use server'` directive and follow the existing pattern in `app/actions/`.

---

## 1. Contractor Portal Actions (`app/actions/contractor-portal-actions.ts`)

Actions called from the contractor portal (authenticated as CONTRACTOR role).

### `getContractorDashboard()`
- **Auth**: `requireContractor()`
- **Input**: None
- **Output**: `{ contractor: Contractor, currentInvoice: ContractorInvoice | null, stats: { totalPaid, pendingAmount, invoiceCount } }`
- **Logic**: Fetch contractor profile, current month's invoice (if exists), and summary stats

### `getOrCreateDraftInvoice(month: number, year: number)`
- **Auth**: `requireContractor()`
- **Input**: `{ month: 1-12, year: number }`
- **Output**: `ContractorInvoice` with `line_items` and `documents`
- **Logic**:
  1. Check for existing invoice at `[contractor_id, month, year]`
  2. If exists, return it with relations
  3. If not, create DRAFT with `base_amount` from contractor rate:
     - MONTHLY rate → use as-is
     - HOURLY rate → rate × 176 (standard monthly hours)
     - DAILY rate → rate × 22 (standard monthly days)
  4. Return new invoice

### `addInvoiceLineItem(data)`
- **Auth**: `requireContractor()`
- **Validation Schema**:
  ```typescript
  z.object({
    invoice_id: z.string().uuid(),
    type: z.enum(['REIMBURSEMENT', 'BONUS', 'OTHER']),
    description: z.string().min(2).max(500),
    amount: z.number().positive(),
  })
  ```
- **Output**: `ContractorInvoiceLineItem`
- **Guards**: Invoice must be DRAFT status and belong to this contractor
- **Side Effect**: Recalculate `total_amount` on parent invoice

### `updateInvoiceLineItem(lineItemId: string, data)`
- **Auth**: `requireContractor()`
- **Input**: Line item ID + partial update fields
- **Guards**: Invoice must be DRAFT; line item must belong to contractor's invoice
- **Side Effect**: Recalculate `total_amount`

### `removeInvoiceLineItem(lineItemId: string)`
- **Auth**: `requireContractor()`
- **Guards**: Invoice must be DRAFT
- **Side Effect**: Recalculate `total_amount`

### `submitInvoice(invoiceId: string)`
- **Auth**: `requireContractor()`
- **Validation**:
  - Invoice must be DRAFT status
  - All required document types must be uploaded
  - `total_amount` must be > 0
- **Output**: `ContractorInvoice` with status = SUBMITTED
- **Side Effects**:
  - Set `submitted_at` to now
  - Create admin notification (email + in-portal)
  - `revalidatePath('/contractor-portal/invoices')`

### `getInvoiceHistory()`
- **Auth**: `requireContractor()`
- **Output**: `ContractorInvoice[]` ordered by year DESC, month DESC
- **Includes**: Status, amounts, payment info (no documents/line items for list view)

### `getInvoice(invoiceId: string)`
- **Auth**: `requireContractor()`
- **Output**: `ContractorInvoice` with `line_items`, `documents`, `payment`
- **Guards**: Invoice must belong to this contractor

---

## 2. Contractor Document Actions (`app/actions/contractor-document-actions.ts`)

### `uploadDocument(formData: FormData)`
- **Auth**: `requireContractor()`
- **FormData Fields**: `file` (File), `invoice_id` (string), `document_type` (ContractorDocumentType)
- **Validation**:
  - File size ≤ 10MB
  - MIME type: PDF, DOCX, PNG, JPG
  - Invoice must be DRAFT status
- **Logic**:
  1. Upload to Supabase Storage at `{org_id}/{contractor_id}/{invoice_id}/{timestamp}-{filename}`
  2. Create ContractorDocument record
  3. If replacing existing document of same type, delete old file + record
- **Output**: `ContractorDocument`

### `deleteDocument(documentId: string)`
- **Auth**: `requireContractor()`
- **Guards**: Document belongs to contractor; invoice is DRAFT
- **Logic**: Delete from Supabase Storage + delete DB record

### `getDocumentUrl(documentId: string)`
- **Auth**: `requireContractor()` OR `requireAdmin()`
- **Output**: `{ signedUrl: string }` (1-hour expiry)
- **Guards**: Contractor can only access own docs; admin can access all in their org

---

## 3. Contractor Admin Actions (`app/actions/contractor-admin-actions.ts`)

Actions called from the admin dashboard.

### `getAllContractorInvoices(filters?)`
- **Auth**: `requireAdmin()`
- **Input Schema**:
  ```typescript
  z.object({
    status: z.enum(['DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED', 'PAID']).optional(),
    contractor_id: z.string().uuid().optional(),
    month: z.number().min(1).max(12).optional(),
    year: z.number().optional(),
  }).optional()
  ```
- **Output**: `ContractorInvoice[]` with contractor name, amounts, status
- **Scoped**: `organization_id` from current user

### `getContractorInvoiceForReview(invoiceId: string)`
- **Auth**: `requireAdmin()`
- **Output**: `ContractorInvoice` with `line_items`, `documents`, `contractor`, `payment`

### `reviewContractorInvoice(data)`
- **Auth**: `requireAdmin()`
- **Input Schema**:
  ```typescript
  z.object({
    invoice_id: z.string().uuid(),
    action: z.enum(['approve', 'reject']),
    rejection_reason: z.string().min(5).optional(),
  }).refine(
    (d) => d.action !== 'reject' || d.rejection_reason,
    { message: 'Rejection reason is required' }
  )
  ```
- **Logic**:
  - `approve`: Set status=APPROVED, reviewed_at=now, reviewed_by=admin
  - `reject`: Set status=DRAFT, reviewed_at=now, reviewed_by=admin, rejection_reason
- **Side Effects**:
  - Notify contractor (email + in-portal) with reason
  - Create audit log entry

### `getGlobalContractorSettings()`
- **Auth**: `requireAdmin()`
- **Output**: `{ contractor_reminder_day: number, contractor_default_doc_types: string[] }`

### `updateGlobalContractorSettings(data)`
- **Auth**: `requireAdmin()`
- **Input Schema**:
  ```typescript
  z.object({
    contractor_reminder_day: z.number().min(1).max(28),
    contractor_default_doc_types: z.array(z.enum(['SOW', 'INVOICE', 'TAX_FORM', 'OTHER'])),
  })
  ```

### `inviteContractor(data)`
- **Auth**: `requireAdmin()`
- **Input Schema**:
  ```typescript
  z.object({
    contractor_id: z.string().uuid(),
    email: z.string().email(),
    full_name: z.string().min(2),
  })
  ```
- **Logic**:
  1. Update contractor with email
  2. Create Supabase Auth user with magic link
  3. Create UserProfile with role=CONTRACTOR, contractor_id, status=INACTIVE
  4. Set portal_invitation_status=PENDING
  5. Return magic link URL

### `updateContractorPortalSettings(contractorId: string, data)`
- **Auth**: `requireAdmin()`
- **Input Schema**:
  ```typescript
  z.object({
    reminder_day_override: z.number().min(1).max(28).nullable(),
    reminder_enabled: z.boolean(),
    required_doc_types: z.array(z.enum(['SOW', 'INVOICE', 'TAX_FORM', 'OTHER'])),
  })
  ```

### `sendManualReminder(contractorId: string)`
- **Auth**: `requireAdmin()`
- **Guards**: Max 3 reminders per contractor per month
- **Logic**: Send email via Resend, update `last_reminder_sent_at`

---

## 4. Mercury Payment Actions (`app/actions/mercury-payment-actions.ts`)

### `initiatePayment(data)`
- **Auth**: `requireAdmin()`
- **Input Schema**:
  ```typescript
  z.object({
    invoice_id: z.string().uuid(),
    payment_method: z.enum(['ACH', 'DOMESTIC_WIRE', 'INTERNATIONAL_WIRE']),
  })
  ```
- **Guards**:
  - Invoice must be APPROVED status
  - Contractor must have `mercury_recipient_id`
  - No existing PENDING/PROCESSING payment for this invoice
- **Logic**:
  1. Get Mercury client via `getMercuryClient(organizationId)`
  2. Get Mercury account ID (primary checking account)
  3. Call `client.requestSendMoney(accountId, { recipientId, amount, paymentMethod, memo, idempotencyKey })`
  4. Create ContractorPayment record with status=PENDING, mercury_request_id from response
  5. If API call fails, create payment record with status=FAILED, failure_reason
- **Output**: `ContractorPayment`

### `retryPayment(paymentId: string)`
- **Auth**: `requireAdmin()`
- **Guards**: Payment must be FAILED status
- **Logic**: Reset status to PENDING, call Mercury API again with new idempotency key

### `getPaymentStatus(paymentId: string)`
- **Auth**: `requireAdmin()` OR `requireContractor()`
- **Output**: `ContractorPayment` with current status

---

## 5. Mercury Recipient Actions (`app/actions/mercury-recipient-actions.ts`)

### `getMercuryRecipients()`
- **Auth**: `requireAdmin()`
- **Output**: `MercuryRecipient[]` from Mercury API
- **Logic**: Call `client.getRecipients()`, return list

### `linkMercuryRecipient(contractorId: string, recipientId: string)`
- **Auth**: `requireAdmin()`
- **Logic**: Update contractor's `mercury_recipient_id`
- **Validation**: Verify recipientId exists in Mercury

### `createMercuryRecipient(data)`
- **Auth**: `requireAdmin()`
- **Input Schema**:
  ```typescript
  z.object({
    contractor_id: z.string().uuid(),
    name: string,
    emails: z.array(z.string().email()).optional(),
    defaultPaymentMethod: z.enum(['ach', 'domesticWire', 'internationalWire']),
    electronicRoutingInfo: z.object({ ... }).optional(),
    domesticWireRoutingInfo: z.object({ ... }).optional(),
  })
  ```
- **Logic**:
  1. Call `client.createRecipient(data)` via Lambda proxy
  2. Update contractor's `mercury_recipient_id` with new recipient ID
- **Output**: `{ recipientId: string, contractor: Contractor }`

---

## 6. Email Actions (`app/actions/email-actions.ts`)

### `sendContractorReminder(contractorId: string)`
- **Auth**: System (cron) or `requireAdmin()` (manual)
- **Logic**:
  1. Fetch contractor with pending required docs
  2. Generate magic link for portal access
  3. Send email via Resend with InvoiceReminderEmail template
  4. Update `last_reminder_sent_at`, `last_reminder_month`, `last_reminder_year`

### `sendBatchReminders(reminderDay: number)`
- **Auth**: System (cron only, verified by CRON_SECRET)
- **Logic**:
  1. Query all active contractors where:
     - `reminder_enabled = true`
     - `reminder_day_override = reminderDay` OR (`reminder_day_override IS NULL` AND org `contractor_reminder_day = reminderDay`)
     - Not already reminded for current month
  2. Use Resend batch API (up to 100 per call)
  3. Update reminder tracking fields

---

## 7. Cron Route (`app/api/contractor/reminders/cron/route.ts`)

### `GET /api/contractor/reminders/cron`
- **Auth**: `Authorization: Bearer ${CRON_SECRET}`
- **Schedule**: `0 8 * * *` (daily at 8 AM UTC)
- **Logic**:
  1. Get current day of month
  2. Call `sendBatchReminders(currentDay)`
  3. Return `{ success: true, remindersSent: number }`
