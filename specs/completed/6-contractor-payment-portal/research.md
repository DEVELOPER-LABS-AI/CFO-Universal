# Research: Contractor Payment Portal

## Technology Decisions

### 1. Mercury Payment API - `request-send-money`

**Decision**: Use `POST /api/v1/account/{accountId}/request-send-money` (approval-based endpoint)
**Rationale**: Creates a payment request that lands in Mercury's dashboard approval queue. A Mercury admin must approve before money moves. This is the safest option and does NOT require IP whitelisting (uses Custom token with `RequestSendMoney` scope), making it ideal for Vercel serverless.
**Alternatives Considered**:
- Direct send via `POST /transactions` — requires Read & Write token + IP whitelist, not suitable for serverless without Lambda proxy; too risky for automated payments

**Request Body**:
```typescript
{
  recipientId: string;     // Existing Mercury recipient ID
  amount: number;          // Dollar amount
  paymentMethod: "ach" | "domesticWire" | "check";
  memo?: string;           // Payment description
  idempotencyKey?: string; // Prevents duplicate payments
}
```

**Response**: Returns `{ requestId, status: "pendingApproval", ... }`

### 2. Mercury Recipients API

**Decision**: Use GET/POST `/api/v1/recipients` for listing and creating recipients
**Rationale**: Allows syncing Mercury contacts and creating new ones from within the app
**Note**: Creating recipients (`POST /recipients`) requires Read & Write token + IP whitelist → must route through Lambda proxy. Listing recipients (`GET /recipients`) only needs Read token.

**Recipient Object Shape**:
```typescript
{
  id: string;
  name: string;
  emails: string[];
  defaultPaymentMethod: "ach" | "domesticWire" | "internationalWire" | "check";
  electronicRoutingInfo?: { accountNumber, routingNumber, bankName, address };
  domesticWireRoutingInfo?: { accountNumber, routingNumber, address };
}
```

### 3. Email Service - Resend

**Decision**: Use Resend with React Email templates
**Rationale**: Built for Next.js, supports React components as templates, generous free tier (3,000 emails/month, 100/day), simple API
**Packages**: `resend`, `@react-email/components`
**Rate Limit**: 2 requests/second; batch API sends up to 100 emails in 1 request
**Alternatives Considered**:
- SendGrid — more complex setup, enterprise-focused, overkill for contractor reminders
- Postmark — excellent deliverability but more expensive, no React Email integration

### 4. Scheduled Reminders - Vercel Cron

**Decision**: Daily cron job at 8 AM UTC checking if today matches any contractor's reminder day
**Rationale**: Different contractors may have different reminder days; daily check handles global + per-contractor overrides. Existing vercel.json already has cron jobs for Mercury and Xero sync.
**Constraint**: Hobby plan allows once-per-day minimum; Pro allows per-minute. Daily is sufficient for this feature.
**Implementation**: `GET /api/contractor/reminders/cron` secured with `CRON_SECRET`
**Idempotency**: Track last reminder sent per contractor per month to prevent duplicates (Vercel may deliver cron events more than once)

### 5. Document Storage - Supabase Storage

**Decision**: Private Supabase Storage bucket with signed URLs for access
**Rationale**: Already using Supabase; private bucket with RLS enforces access control. Signed URLs (1-hour expiry) for secure document viewing.
**Bucket**: `contractor-documents` (private, 10MB max per file)
**Allowed MIME types**: `application/pdf`, `application/vnd.openxmlformats-officedocument.wordprocessingml.document`, `image/png`, `image/jpeg`
**File path convention**: `{organization_id}/{contractor_id}/{invoice_id}/{filename}`
**Upload approach**: Server-side upload via server action (increase `bodySizeLimit` to `'11mb'` in next.config.js)

### 6. Contractor Authentication

**Decision**: Add CONTRACTOR role to UserRole enum; magic link authentication via Supabase
**Rationale**: Mirrors existing AGENCY_ADMIN pattern. Passwordless magic link reduces friction for contractors. Add `contractor_id` to UserProfile (like `agency_id` for AGENCY_ADMIN).
**Portal Route**: `/contractor-portal/` (mirrors `/agency-portal/`)
**Auth Helper**: New `requireContractor()` function following `requireAgencyAdmin()` pattern

### 7. Lambda Proxy Usage

**Decision**: Route all Mercury payment/recipient API calls through existing Lambda proxy
**Rationale**: `POST /recipients` requires IP whitelisting. While `request-send-money` and `GET /recipients` don't, routing everything through Lambda proxy maintains consistency and avoids managing multiple auth paths.
**Implementation**: Add `requestSendMoney()`, `getRecipients()`, `createRecipient()` methods to LambdaMercuryClient

### 8. Invoice Status Reuse

**Decision**: Reuse existing `InvoiceStatus` enum (DRAFT, SUBMITTED, APPROVED, REJECTED, PAID)
**Rationale**: Same workflow states apply to contractor invoices. No need for a separate enum.
**New Enum Needed**: `ContractorLineItemType` (REIMBURSEMENT, BONUS, OTHER) — different from agency `InvoiceLineItemType` since contractor line items don't reference staff/service IDs

### 9. Notification Delivery

**Decision**: Dual notification — email via Resend + in-portal via existing Notification model
**Rationale**: Contractors may not be logged in when events occur (rejection, payment). Email ensures timely delivery. In-portal notification provides history when they log in.
**Events triggering notifications**:
- Invoice rejected (to contractor)
- Invoice approved (to contractor)
- Payment completed (to contractor)
- Payment failed (to admin)
- Invoice submitted (to admin)
- Reminder sent (to contractor)
