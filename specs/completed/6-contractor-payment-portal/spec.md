# Feature Specification: Contractor Payment Portal & Automated Invoice Workflow

**Status**: Draft
**Created**: 2026-02-25
**Last Updated**: 2026-02-25

---

## Overview

### Feature Summary

A self-service portal for contractors that automates the monthly invoicing cycle — from email reminders and document uploads through invoice approval and payment via Mercury — replacing the current manual process of chasing documents and paying through Mercury's dashboard.

### Business Value

Eliminates manual overhead in contractor payment workflows. Currently, admins must individually remind contractors to submit documents, manually review paperwork, and initiate payments through Mercury's web UI. This feature automates reminders, centralizes document collection, streamlines approval, and enables one-click payment — reducing payment processing time and ensuring contractors are paid consistently and on schedule.

### Target Users

- **Primary**: Organization Admins — manage contractor relationships, approve invoices, trigger payments
- **Primary**: Contractors — receive reminders, upload documents, submit invoices, view payment status
- **Secondary**: Executives — visibility into contractor payment pipeline and spend

---

## Clarifications

### Session 2026-02-25

- Q: When an admin rejects an invoice, does it reopen or create a new record? → A: Same invoice reopens — status reverts to Draft so the contractor can edit and resubmit. Contractor receives a notification with the rejection reason/notes.
- Q: Is the invoice amount pre-populated or manually entered? → A: Pre-populated from the contractor's rate (base amount), but the contractor can add line items for reimbursements, bonuses, and other expenses. Total = base rate + line items.
- Q: What happens to invoice status if Mercury payment fails? → A: Invoice stays Approved; payment failure is logged on the payment record. Admin receives a notification and can retry payment.

---

## User Scenarios

### Primary Use Cases

**Scenario 1: Admin Configures Reminder Schedule**
- **Actor**: Admin
- **Goal**: Set the global default date for monthly contractor reminders
- **Steps**:
  1. Navigate to Dashboard Settings
  2. Locate the Contractor Payment section
  3. Set the global reminder date (default: 24th of each month)
  4. Save settings
- **Expected Outcome**: All contractors without individual overrides will receive reminders on the configured date each month

**Scenario 2: Admin Onboards a New Contractor**
- **Actor**: Admin
- **Goal**: Add a contractor to the system and link them to Mercury for payment
- **Steps**:
  1. Navigate to the Contractor management section
  2. Create or select an existing contractor
  3. Add email address and required document types
  4. Link to an existing Mercury recipient or create a new Mercury contact
  5. Send portal invitation to the contractor
- **Expected Outcome**: Contractor receives a magic link portal invitation and is linked to Mercury for future payments

**Scenario 3: Contractor Receives Reminder and Uploads Documents**
- **Actor**: Contractor
- **Goal**: Submit monthly SOW and invoice for payment
- **Steps**:
  1. Receive email reminder with portal link
  2. Log into the contractor portal via magic link
  3. View the current month's invoice request
  4. Upload required documents (SOW, supporting docs)
  5. Submit invoice for review
- **Expected Outcome**: Invoice and documents are submitted and visible to admin for review

**Scenario 4: Admin Reviews and Approves Invoice**
- **Actor**: Admin
- **Goal**: Review contractor submission and approve for payment
- **Steps**:
  1. Navigate to contractor invoice review queue
  2. Review uploaded documents and invoice details
  3. Approve or reject the invoice (with optional notes)
- **Expected Outcome**: Approved invoices are marked ready for payment; rejected invoices notify the contractor with feedback

**Scenario 5: Admin Triggers Payment via Mercury**
- **Actor**: Admin
- **Goal**: Pay an approved contractor invoice through Mercury
- **Steps**:
  1. Navigate to approved invoices queue
  2. Select invoice(s) to pay
  3. Confirm payment method (ACH, domestic wire, international wire)
  4. Initiate payment request to Mercury
  5. Payment request is queued in Mercury for final approval
- **Expected Outcome**: Payment request is submitted to Mercury's approval queue; payment status is tracked in the dashboard

**Scenario 6: Contractor Views Payment History**
- **Actor**: Contractor
- **Goal**: Check the status of past and current invoices
- **Steps**:
  1. Log into contractor portal via magic link
  2. View invoice list with statuses (Draft, Submitted, Approved, Rejected, Paid)
  3. View payment details for completed payments
- **Expected Outcome**: Contractor has full visibility into their invoice and payment history

### Edge Cases

- **Contractor misses reminder deadline**: Admin can manually trigger a follow-up reminder for individual contractors
- **Document upload fails**: System retains partial uploads and allows retry without losing other submitted documents
- **Mercury contact mismatch**: If a contractor's banking details change, admin can update the Mercury recipient and re-link
- **Contractor with no Mercury contact**: System prevents payment initiation until Mercury recipient is linked
- **Multiple invoices in same month**: System enforces one invoice per contractor per month, matching the agency pattern
- **Mercury API unavailable**: Payment requests are queued locally; admin is notified and can retry. Invoice stays Approved throughout.
- **Mercury payment fails (insufficient funds, recipient issue)**: Failure reason logged on payment record; admin notified with retry option. Invoice remains Approved.
- **Contractor account deactivated**: Deactivated contractors do not receive reminders and cannot access the portal

---

## Functional Requirements

### Core Requirements

**FR-1: Global Reminder Date Configuration**
- **Description**: Admins can set a global default date (1-28) for when monthly email reminders are sent to all contractors
- **Acceptance Criteria**:
  - [ ] Default reminder date is the 24th of each month
  - [ ] Admin can change the global date from the Dashboard Settings page
  - [ ] Date selection is limited to 1-28 to avoid month-length issues
  - [ ] Changes take effect on the next scheduled cycle

**FR-2: Per-Contractor Reminder Override**
- **Description**: Each contractor can have an individual reminder date or have reminders disabled entirely
- **Acceptance Criteria**:
  - [ ] Admin can set a custom reminder date for a specific contractor
  - [ ] Admin can disable reminders for a specific contractor
  - [ ] Per-contractor settings override the global default
  - [ ] Contractors without overrides use the global default

**FR-3: Automated Email Reminders**
- **Description**: The system sends monthly email reminders to contractors prompting them to upload documents and submit invoices
- **Acceptance Criteria**:
  - [ ] Emails are sent automatically based on the configured schedule
  - [ ] Email contains a direct link to the contractor portal
  - [ ] Email lists any required documents that have not yet been submitted
  - [ ] Only active contractors with email addresses receive reminders
  - [ ] Admin can manually trigger a reminder for a specific contractor

**FR-4: Contractor Portal Login**
- **Description**: Contractors have their own authenticated portal to manage invoices and documents via passwordless magic link
- **Acceptance Criteria**:
  - [ ] Contractors receive a magic link invitation via email (passwordless login)
  - [ ] Portal is accessible at a dedicated route separate from the admin dashboard
  - [ ] Contractors can only see their own data (invoices, documents, payments)
  - [ ] Returning contractors log in via magic link (no password required)
  - [ ] Session management follows security best practices

**FR-5: Document Upload**
- **Description**: Contractors can upload SOW, invoices, and other required documents through the portal
- **Acceptance Criteria**:
  - [ ] Contractors can upload files (PDF, DOCX, PNG, JPG) up to 10MB per file
  - [ ] Admin can define which document types are required per contractor
  - [ ] Uploaded documents are associated with the specific month's invoice
  - [ ] Contractors can replace a previously uploaded document before submission
  - [ ] Documents are securely stored with access limited to the contractor and organization admins

**FR-6: Contractor Invoice Submission**
- **Description**: Contractors submit monthly invoices through the portal for admin review
- **Acceptance Criteria**:
  - [ ] One invoice per contractor per month
  - [ ] Invoice base amount is pre-populated from the contractor's rate in the system
  - [ ] Contractor can add line items for reimbursements, bonuses, and other expenses beyond the base rate
  - [ ] Each line item includes a type (Reimbursement/Bonus/Other), description, and amount
  - [ ] Invoice total is calculated as base rate + sum of all line items
  - [ ] Contractor can save a draft before submitting
  - [ ] Submitted invoices cannot be edited by the contractor; admin rejection reverts status to Draft for resubmission
  - [ ] Submission triggers a notification to admins

**FR-7: Invoice Review and Approval**
- **Description**: Admins review submitted invoices and approve or reject them
- **Acceptance Criteria**:
  - [ ] Admin can view all pending invoices in a review queue
  - [ ] Admin can view uploaded documents inline
  - [ ] Admin can approve an invoice, marking it ready for payment
  - [ ] Admin can reject an invoice with a required rejection reason/notes explaining what needs to change
  - [ ] Rejection reverts the invoice status to Draft, allowing the contractor to edit and resubmit
  - [ ] Contractor receives a notification (email + in-portal) with the rejection reason and notes
  - [ ] Approval/rejection actions are logged for audit purposes

**FR-8: Mercury Payment Initiation**
- **Description**: Admins can trigger payment for approved invoices through Mercury's approval-based API endpoint
- **Acceptance Criteria**:
  - [ ] Payment can only be initiated for approved invoices
  - [ ] Admin selects the payment method (ACH, domestic wire, international wire)
  - [ ] Payment request is submitted to Mercury's approval queue (not auto-sent)
  - [ ] Payment status is tracked and updated (Pending, Processing, Completed, Failed)
  - [ ] If payment fails, invoice remains in Approved status; failure reason is logged on the payment record
  - [ ] Admin receives a notification on payment failure with the error details
  - [ ] Admin can retry payment for failed attempts without re-approving the invoice
  - [ ] Contractor cannot be paid if no Mercury recipient is linked

**FR-9: Mercury Recipient Management**
- **Description**: Contractors are linked to Mercury recipients for payment routing
- **Acceptance Criteria**:
  - [ ] Admin can link a contractor to an existing Mercury recipient
  - [ ] Admin can create a new Mercury recipient from the contractor's details
  - [ ] Mercury recipient ID is stored with the contractor record
  - [ ] Admin can update or re-link Mercury recipient if banking details change
  - [ ] Recipient list is synced from Mercury's API

**FR-10: Admin Manual Reminder Trigger**
- **Description**: Admins can send ad-hoc reminders to individual contractors outside the automated schedule
- **Acceptance Criteria**:
  - [ ] Admin can trigger a reminder from the contractor detail page
  - [ ] Manual reminders use the same email template as automated ones
  - [ ] System prevents sending more than 3 reminders per contractor per month to avoid spam

### Data Requirements

**DR-1: Contractor Profile Extension**
- **Description**: Extended contractor data for portal access and payment routing
- **Key Attributes**: Email address, Mercury recipient ID, portal invitation status, reminder date override, reminder enabled flag, required document types
- **Validation Rules**: Email must be valid format; Mercury recipient ID must correspond to a valid Mercury contact

**DR-2: Contractor Invoice**
- **Description**: Monthly invoice records submitted by contractors
- **Key Attributes**: Contractor ID, organization ID, month, year, base amount (pre-populated from rate), total amount (base + line items), description, status (Draft/Submitted/Approved/Rejected/Paid), submitted date, reviewed date, reviewer ID, rejection reason, payment reference
- **Validation Rules**: One invoice per contractor per month; base amount pre-populated from contractor rate; total must be positive; status transitions must follow the defined workflow

**DR-2a: Contractor Invoice Line Item**
- **Description**: Additional line items added by contractors to their monthly invoice beyond the base rate
- **Key Attributes**: Invoice ID, type (Reimbursement/Bonus/Other), description, amount
- **Validation Rules**: Amount must be positive; description is required; each line item must be associated with an invoice

**DR-3: Contractor Document**
- **Description**: Files uploaded by contractors associated with invoices
- **Key Attributes**: Invoice ID, contractor ID, document type (SOW/Invoice/Tax Form/Other), file name, file path, file size, mime type, uploaded date
- **Validation Rules**: Max 10MB per file; allowed types: PDF, DOCX, PNG, JPG; documents linked to a specific invoice

**DR-4: Global Payment Settings**
- **Description**: Organization-wide configuration for contractor payment workflow
- **Key Attributes**: Default reminder day (1-28), reminder email template, default required document types
- **Validation Rules**: Day must be between 1 and 28

**DR-5: Payment Record**
- **Description**: Mercury payment tracking for contractor invoices
- **Key Attributes**: Invoice ID, Mercury transaction ID, payment method, amount, status, initiated date, completed date, failure reason
- **Validation Rules**: Must reference an approved invoice; Mercury transaction ID populated after API response

---

## Success Criteria

### Measurable Outcomes

- [ ] **Efficiency**: Admin time spent on contractor payment processing is reduced by at least 70%
- [ ] **Timeliness**: 90% of contractors submit documents within 5 days of receiving a reminder
- [ ] **Completeness**: All required documents are uploaded before an invoice can be submitted
- [ ] **Accuracy**: Zero duplicate or missed payments per quarter through automated tracking
- [ ] **Adoption**: 100% of active contractors are onboarded to the portal within 30 days of launch
- [ ] **Speed**: Payment initiation takes under 30 seconds from invoice approval to Mercury request
- [ ] **Visibility**: Contractors can check payment status at any time without contacting admin

---

## Dependencies

### External Dependencies

- **Mercury API** — Payment initiation (approval-based `request-send-money` endpoint) and recipient management (`/recipients` endpoints)
- **Resend** — Email delivery service for automated and manual reminder emails
- **Supabase Storage** — Secure document upload and retrieval with signed URLs

### Internal Dependencies

- **Existing Contractor model** — Will be extended with email, Mercury recipient ID, and portal fields
- **Authentication system** — New CONTRACTOR role for portal access, magic link flow
- **Mercury connection** — Existing Mercury API integration (`lib/mercury/`)
- **Notification system** — Existing notification model for in-app alerts

---

## Assumptions

- Contractors are individual entities (not agencies) who submit their own invoices directly
- The monthly invoicing cycle aligns with the existing agency invoice pattern (one per month)
- Mercury's approval-based payment endpoint is preferred over direct send for safety
- Contractors only need to see their own invoices, documents, and payment history
- The existing user invitation flow (magic links via Supabase) is adapted for contractor onboarding
- Resend is the email delivery service; React Email is used for templating
- Email reminders are sent once per scheduled date (not repeated automatically within the same month)
- Payment amounts on invoices match what is sent via Mercury (no partial payments in v1)
- Document storage uses Supabase Storage with organization-scoped buckets

---

## Out of Scope

- Automatic recurring payments (all payments require admin approval)
- Partial payments or payment plans for a single invoice
- Contractor self-registration (admin must invite contractors)
- International tax compliance or withholding calculations
- Invoice dispute resolution workflow beyond approve/reject
- Contractor-to-contractor communication
- Bulk import of contractors from external systems
- Multi-currency payment support (USD only for v1)
- SMS or push notification reminders (email only for v1)

---

## Security & Privacy Considerations

- **Data Privacy**: Contractor banking details are stored in Mercury only, not in the application database. Only Mercury recipient IDs are stored locally.
- **Access Control**: Contractors can only access their own data. Admins have full visibility across all contractors. Document access is restricted to the owning contractor and organization admins.
- **Authentication**: Contractor portal uses passwordless magic link authentication via Supabase with a dedicated CONTRACTOR role. Session tokens are scoped to prevent cross-role access.
- **File Security**: Uploaded documents are stored in Supabase Storage with organization-scoped access controls. Temporary signed URLs are used for document viewing.
- **Audit Trail**: All approval, rejection, and payment actions are logged with actor, timestamp, and details.
- **Payment Safety**: Mercury payments use the approval-based endpoint (`request-send-money`), requiring human confirmation in Mercury's dashboard before funds are transferred.

---

## Future Enhancements

- Recurring payment automation (skip approval for trusted contractors with consistent invoices)
- Bulk payment processing (pay multiple approved invoices in one action)
- Contractor performance dashboard (on-time submission rates, payment history analytics)
- Multi-currency support for international contractors
- SMS/push notification reminders alongside email
- Direct deposit setup through the contractor portal
- Integration with tax preparation services (1099 generation)
- Payment scheduling (set future payment dates)
