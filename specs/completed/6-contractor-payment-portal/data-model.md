# Data Model: Contractor Payment Portal

## Entity Relationship Overview

```
Organization (1) ──── (N) Contractor
Contractor   (1) ──── (N) ContractorInvoice
Contractor   (1) ──── (1) UserProfile (via contractor_id, role=CONTRACTOR)
ContractorInvoice (1) ──── (N) ContractorInvoiceLineItem
ContractorInvoice (1) ──── (N) ContractorDocument
ContractorInvoice (1) ──── (0..1) ContractorPayment
```

---

## Schema Changes

### Enum: ContractorLineItemType (NEW)

```prisma
enum ContractorLineItemType {
  REIMBURSEMENT
  BONUS
  OTHER
}
```

### Enum: ContractorDocumentType (NEW)

```prisma
enum ContractorDocumentType {
  SOW
  INVOICE
  TAX_FORM
  OTHER
}
```

### Enum: PaymentMethod (NEW)

```prisma
enum PaymentMethod {
  ACH
  DOMESTIC_WIRE
  INTERNATIONAL_WIRE
}
```

### Enum: PaymentStatus (NEW)

```prisma
enum PaymentStatus {
  PENDING
  PROCESSING
  COMPLETED
  FAILED
}
```

### Enum: PortalInvitationStatus (NEW)

```prisma
enum PortalInvitationStatus {
  PENDING
  ACCEPTED
  EXPIRED
}
```

### Enum: UserRole (MODIFIED)

```prisma
enum UserRole {
  ADMIN
  EXECUTIVE
  ANALYST
  AGENCY_ADMIN
  CONTRACTOR      // NEW
}
```

---

## Extended Models

### UserProfile (MODIFIED)

Add field:
```prisma
contractor_id  String?   @db.Uuid
contractor     Contractor? @relation(fields: [contractor_id], references: [id])
```

### Contractor (MODIFIED)

Add fields:
```prisma
model Contractor {
  // ... existing fields (id, organization_id, name, rate, rate_type, engagement_type, deleted_at, created_at, updated_at)

  // NEW fields
  email                     String?
  mercury_recipient_id      String?
  portal_invitation_status  PortalInvitationStatus?
  reminder_day_override     Int?        // 1-28, null = use global default
  reminder_enabled          Boolean     @default(true)
  required_doc_types        Json?       // Array of ContractorDocumentType strings
  last_reminder_sent_at     DateTime?
  last_reminder_month       Int?        // Track which month's reminder was last sent
  last_reminder_year        Int?

  // NEW relations
  invoices                  ContractorInvoice[]
  documents                 ContractorDocument[]
  payments                  ContractorPayment[]
  portal_user               UserProfile?  // via UserProfile.contractor_id
}
```

### Organization (MODIFIED)

Add fields:
```prisma
model Organization {
  // ... existing fields

  // NEW fields
  contractor_reminder_day      Int       @default(24)   // 1-28
  contractor_default_doc_types Json?     // Default required document types for new contractors
}
```

---

## New Models

### ContractorInvoice

```prisma
model ContractorInvoice {
  id                String          @id @default(uuid()) @db.Uuid
  contractor_id     String          @db.Uuid
  organization_id   String          @db.Uuid
  month             Int
  year              Int
  base_amount       Decimal         @db.Decimal(12, 2)
  total_amount      Decimal         @db.Decimal(12, 2)
  description       String?
  status            InvoiceStatus   @default(DRAFT)
  submitted_at      DateTime?
  reviewed_at       DateTime?
  reviewed_by       String?         @db.Uuid
  rejection_reason  String?
  payment_reference String?
  created_at        DateTime        @default(now())
  updated_at        DateTime        @updatedAt

  // Relations
  contractor        Contractor      @relation(fields: [contractor_id], references: [id], onDelete: Restrict)
  organization      Organization    @relation(fields: [organization_id], references: [id], onDelete: Restrict)
  reviewer          UserProfile?    @relation("InvoiceReviewer", fields: [reviewed_by], references: [id])
  line_items        ContractorInvoiceLineItem[]
  documents         ContractorDocument[]
  payment           ContractorPayment?

  @@unique([contractor_id, month, year])
  @@index([organization_id])
  @@index([status])
  @@index([contractor_id])
}
```

**State Transitions**:
```
DRAFT → SUBMITTED (contractor submits)
SUBMITTED → APPROVED (admin approves)
SUBMITTED → REJECTED (admin rejects) → reverts to DRAFT
APPROVED → PAID (payment completed via Mercury)
```

**Validation Rules**:
- `month`: 1-12
- `year`: current year or previous year
- `base_amount`: >= 0 (pre-populated from contractor rate)
- `total_amount`: base_amount + sum(line_items.amount), must be > 0
- Unique constraint: one invoice per contractor per month

### ContractorInvoiceLineItem

```prisma
model ContractorInvoiceLineItem {
  id          String                   @id @default(uuid()) @db.Uuid
  invoice_id  String                   @db.Uuid
  type        ContractorLineItemType
  description String
  amount      Decimal                  @db.Decimal(12, 2)
  sort_order  Int                      @default(0)
  created_at  DateTime                 @default(now())
  updated_at  DateTime                 @updatedAt

  // Relations
  invoice     ContractorInvoice        @relation(fields: [invoice_id], references: [id], onDelete: Cascade)

  @@index([invoice_id])
}
```

**Validation Rules**:
- `amount`: must be > 0
- `description`: required, min 2 characters
- `type`: REIMBURSEMENT, BONUS, or OTHER

### ContractorDocument

```prisma
model ContractorDocument {
  id              String                  @id @default(uuid()) @db.Uuid
  invoice_id      String?                 @db.Uuid
  contractor_id   String                  @db.Uuid
  organization_id String                  @db.Uuid
  document_type   ContractorDocumentType
  file_name       String
  file_path       String                  // Supabase Storage path
  file_size       Int                     // Bytes
  mime_type       String
  uploaded_at     DateTime                @default(now())
  created_at      DateTime                @default(now())
  updated_at      DateTime                @updatedAt

  // Relations
  invoice         ContractorInvoice?      @relation(fields: [invoice_id], references: [id], onDelete: SetNull)
  contractor      Contractor              @relation(fields: [contractor_id], references: [id], onDelete: Restrict)
  organization    Organization            @relation(fields: [organization_id], references: [id], onDelete: Restrict)

  @@index([invoice_id])
  @@index([contractor_id])
  @@index([organization_id])
}
```

**Validation Rules**:
- `file_size`: max 10,485,760 bytes (10MB)
- `mime_type`: must be one of: application/pdf, application/vnd.openxmlformats-officedocument.wordprocessingml.document, image/png, image/jpeg
- `file_path`: format `{org_id}/{contractor_id}/{invoice_id}/{filename}`

### ContractorPayment

```prisma
model ContractorPayment {
  id                      String          @id @default(uuid()) @db.Uuid
  invoice_id              String          @unique @db.Uuid
  contractor_id           String          @db.Uuid
  organization_id         String          @db.Uuid
  mercury_request_id      String?         // From request-send-money response
  mercury_transaction_id  String?         // Populated when payment completes
  payment_method          PaymentMethod
  amount                  Decimal         @db.Decimal(12, 2)
  status                  PaymentStatus   @default(PENDING)
  failure_reason          String?
  initiated_at            DateTime        @default(now())
  completed_at            DateTime?
  initiated_by            String          @db.Uuid
  created_at              DateTime        @default(now())
  updated_at              DateTime        @updatedAt

  // Relations
  invoice                 ContractorInvoice @relation(fields: [invoice_id], references: [id], onDelete: Restrict)
  contractor              Contractor        @relation(fields: [contractor_id], references: [id], onDelete: Restrict)
  organization            Organization      @relation(fields: [organization_id], references: [id], onDelete: Restrict)
  initiator               UserProfile       @relation("PaymentInitiator", fields: [initiated_by], references: [id])

  @@index([contractor_id])
  @@index([organization_id])
  @@index([status])
}
```

**State Transitions**:
```
PENDING → PROCESSING (Mercury accepts request)
PROCESSING → COMPLETED (Mercury confirms payment)
PROCESSING → FAILED (Mercury rejects / error)
PENDING → FAILED (API call fails)
FAILED → PENDING (admin retries)
```

---

## Storage Bucket

**Bucket**: `contractor-documents`
- **Public**: false
- **File size limit**: 10,485,760 bytes (10MB)
- **Allowed MIME types**: PDF, DOCX, PNG, JPG
- **Path convention**: `{organization_id}/{contractor_id}/{invoice_id}/{timestamp}-{filename}`

**RLS Policies**:
- Contractors can upload/read/delete files in their own `{contractor_id}/` folder
- Admins can read all files in their `{organization_id}/` folder
- No public access
