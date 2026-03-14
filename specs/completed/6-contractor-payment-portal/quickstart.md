# Quickstart: Contractor Payment Portal

## Overview

This feature adds a contractor self-service portal with automated email reminders, document uploads, invoice submission, and Mercury payment integration.

## Key Files to Create/Modify

### New Files
| File | Purpose |
|------|---------|
| `app/contractor-portal/layout.tsx` | Portal layout with auth (mirrors agency-portal) |
| `app/contractor-portal/page.tsx` | Contractor dashboard |
| `app/contractor-portal/invoices/page.tsx` | Invoice list |
| `app/contractor-portal/invoices/[id]/page.tsx` | Invoice detail + line items + upload |
| `app/contractor-portal/payments/page.tsx` | Payment history |
| `app/actions/contractor-portal-actions.ts` | Portal server actions |
| `app/actions/contractor-document-actions.ts` | Document upload/download actions |
| `app/actions/contractor-admin-actions.ts` | Admin-side contractor management |
| `app/actions/mercury-payment-actions.ts` | Mercury payment initiation |
| `app/actions/mercury-recipient-actions.ts` | Mercury recipient CRUD |
| `app/actions/email-actions.ts` | Resend email sending |
| `app/api/contractor/reminders/cron/route.ts` | Daily cron for reminders |
| `components/contractor-portal/Sidebar.tsx` | Portal navigation |
| `components/contractor-portal/InvoiceForm.tsx` | Invoice editing + line items |
| `components/contractor-portal/DocumentUpload.tsx` | File upload component |
| `components/contractor-portal/PaymentStatusBadge.tsx` | Status display |
| `components/admin/ContractorInvoiceReview.tsx` | Admin review UI |
| `components/admin/MercuryRecipientPicker.tsx` | Link contractor to Mercury |
| `components/admin/ContractorSettingsForm.tsx` | Global reminder settings |
| `components/emails/contractor-reminder.tsx` | React Email template |
| `components/emails/invoice-status-notification.tsx` | Approval/rejection email |
| `lib/mercury/payment-client.ts` | Mercury payment + recipient methods |
| `lib/email/resend-client.ts` | Resend client singleton |
| `lib/validations/contractor-invoice.ts` | Zod schemas |
| `prisma/migrations/YYYYMMDD_contractor_payment_portal/` | DB migration |

### Modified Files
| File | Change |
|------|--------|
| `prisma/schema.prisma` | Add models, enums, extend Contractor + Organization + UserProfile |
| `lib/auth/helpers.ts` | Add `requireContractor()` |
| `app/actions/auth.ts` | Handle CONTRACTOR role redirect to `/contractor-portal` |
| `lib/mercury/lambda-client.ts` | Add `requestSendMoney()`, `getRecipients()`, `createRecipient()` |
| `app/dashboard/settings/page.tsx` | Add Contractor Payment settings section |
| `vercel.json` | Add cron entry for `/api/contractor/reminders/cron` |
| `next.config.js` | Increase `bodySizeLimit` for file uploads |

## Environment Variables (New)

```env
RESEND_API_KEY=re_xxxxxxxxxxxxx
CRON_SECRET=<random-32-char-string>
```

## Invoice Status Flow

```
DRAFT → SUBMITTED → APPROVED → PAID
                  ↘ REJECTED → (reverts to DRAFT)
```

## Key Patterns to Follow

1. **Auth**: Mirror `requireAgencyAdmin()` → create `requireContractor()`
2. **Actions**: Mirror `agency-invoice-actions.ts` → create `contractor-portal-actions.ts`
3. **Portal layout**: Mirror `app/agency-portal/layout.tsx`
4. **Mercury API**: Extend `LambdaMercuryClient` with payment/recipient methods
5. **Validation**: Use Zod schemas, mirror `lib/validations/agency-invoice.ts`

## Testing Checklist

- [ ] Contractor can log in via magic link
- [ ] Draft invoice is auto-created with pre-populated base amount
- [ ] Contractor can add/edit/remove line items
- [ ] Contractor can upload documents (PDF, DOCX, PNG, JPG ≤ 10MB)
- [ ] Contractor can submit invoice (blocked if required docs missing)
- [ ] Admin receives notification on submission
- [ ] Admin can approve/reject with notes
- [ ] Rejection reverts to DRAFT + notifies contractor
- [ ] Admin can link contractor to Mercury recipient
- [ ] Admin can initiate payment (only for APPROVED invoices)
- [ ] Payment request appears in Mercury approval queue
- [ ] Payment status tracks correctly (Pending → Completed/Failed)
- [ ] Admin can retry failed payments
- [ ] Cron sends reminders on configured day
- [ ] Per-contractor reminder override works
- [ ] Global settings page controls default reminder day
