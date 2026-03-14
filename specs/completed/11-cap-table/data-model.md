# Data Model: Cap Table MVP

**Created**: 2026-03-03
**Feature**: [spec.md](spec.md)
**Research**: [research.md](research.md)

---

## New Enums

### EquityTransactionType

```prisma
enum EquityTransactionType {
  GRANT
  TRANSFER
  PURCHASE
  CANCELLATION

  @@map("EquityTransactionType")
}
```

---

## New Entities

### CapTableStakeholder

Independent record representing an equity holder. No foreign key to users table — stakeholders may be external investors or advisors without application accounts.

```prisma
model CapTableStakeholder {
  id              String   @id @default(uuid()) @db.Uuid
  organization_id String
  name            String   @db.VarChar(200)
  email           String?  @db.VarChar(255)
  role_title      String?  @db.VarChar(100)
  created_at      DateTime @default(now()) @db.Timestamptz(6)
  updated_at      DateTime @updatedAt @db.Timestamptz(6)
  deleted_at      DateTime? @db.Timestamptz(6)

  // Relations
  organization Organization     @relation(fields: [organization_id], references: [id], onDelete: Cascade)
  holdings     EquityHolding[]
  transactions_as_from EquityTransaction[] @relation("TransactionFrom")
  transactions_as_to   EquityTransaction[] @relation("TransactionTo")

  @@unique([organization_id, email])
  @@index([organization_id])
  @@map("cap_table_stakeholders")
}
```

#### Field Descriptions

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | UUID | Auto | Primary key |
| `organization_id` | UUID | Yes | Multi-tenant isolation |
| `name` | VARCHAR(200) | Yes | Stakeholder display name |
| `email` | VARCHAR(255) | No | Unique within org (for deduplication) |
| `role_title` | VARCHAR(100) | No | e.g., "Co-Founder", "CEO", "Advisor" |
| `deleted_at` | Timestamptz | No | Soft delete |

#### Validation Rules

- `name` is required, 1-200 characters
- `email` must be unique within the organization (when not null)
- `email` validated as valid email format

---

### ShareClass

A category of shares with authorization limits and optional pricing.

```prisma
model ShareClass {
  id               String   @id @default(uuid()) @db.Uuid
  organization_id  String
  name             String   @db.VarChar(100)
  authorized_shares Int
  reserved_shares  Int      @default(0)
  price_per_share  Decimal? @db.Decimal(12, 4)
  created_at       DateTime @default(now()) @db.Timestamptz(6)
  updated_at       DateTime @updatedAt @db.Timestamptz(6)
  deleted_at       DateTime? @db.Timestamptz(6)

  // Relations
  organization Organization     @relation(fields: [organization_id], references: [id], onDelete: Cascade)
  holdings     EquityHolding[]
  transactions EquityTransaction[]

  @@unique([organization_id, name])
  @@index([organization_id])
  @@map("cap_table_share_classes")
}
```

#### Field Descriptions

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | UUID | Auto | Primary key |
| `organization_id` | UUID | Yes | Multi-tenant isolation |
| `name` | VARCHAR(100) | Yes | e.g., "Common", "Preferred Series A" |
| `authorized_shares` | Int | Yes | Total shares authorized for this class |
| `reserved_shares` | Int | Yes | Shares reserved for future use (default 0) |
| `price_per_share` | Decimal(12,4) | No | Fair market value or par value |
| `deleted_at` | Timestamptz | No | Soft delete |

#### Validation Rules

- `name` required, unique within organization
- `authorized_shares` must be a positive integer (> 0)
- `reserved_shares` must be >= 0
- `reserved_shares` must not exceed `authorized_shares - total_issued` (application-level)
- `price_per_share` must be >= 0 when provided

#### Computed Fields (Not Stored)

| Field | Formula |
|-------|---------|
| `issued_shares` | `SUM(holdings.shares_held)` for this share class |
| `available_shares` | `authorized_shares - issued_shares - reserved_shares` |

---

### EquityHolding

Junction table linking a stakeholder to shares held in a specific class.

```prisma
model EquityHolding {
  id              String   @id @default(uuid()) @db.Uuid
  stakeholder_id  String   @db.Uuid
  share_class_id  String   @db.Uuid
  shares_held     Int
  created_at      DateTime @default(now()) @db.Timestamptz(6)
  updated_at      DateTime @updatedAt @db.Timestamptz(6)

  // Relations
  stakeholder CapTableStakeholder @relation(fields: [stakeholder_id], references: [id], onDelete: Cascade)
  share_class ShareClass          @relation(fields: [share_class_id], references: [id], onDelete: Cascade)

  @@unique([stakeholder_id, share_class_id])
  @@index([stakeholder_id])
  @@index([share_class_id])
  @@map("cap_table_equity_holdings")
}
```

#### Field Descriptions

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | UUID | Auto | Primary key |
| `stakeholder_id` | UUID | Yes | FK to CapTableStakeholder |
| `share_class_id` | UUID | Yes | FK to ShareClass |
| `shares_held` | Int | Yes | Current number of shares held |

#### Validation Rules

- `shares_held` must be >= 0
- Unique constraint on `(stakeholder_id, share_class_id)` — one holding per class per stakeholder
- Total `shares_held` across all holders for a class must not exceed `authorized_shares - reserved_shares`

#### Computed Fields (Not Stored)

| Field | Formula |
|-------|---------|
| `ownership_percentage` | `shares_held / total_issued_shares * 100` (to 4 decimal places) |

---

### EquityTransaction

Append-only ledger of all equity events. Transactions are never deleted — only reversed with offsetting entries.

```prisma
model EquityTransaction {
  id                    String                @id @default(uuid()) @db.Uuid
  organization_id       String
  transaction_type      EquityTransactionType
  transaction_date      DateTime              @db.Date
  share_class_id        String                @db.Uuid
  from_stakeholder_id   String?               @db.Uuid
  to_stakeholder_id     String?               @db.Uuid
  shares_affected       Int
  price_per_share       Decimal?              @db.Decimal(12, 4)
  notes                 String?               @db.Text
  created_by            String
  created_at            DateTime              @default(now()) @db.Timestamptz(6)

  // Relations
  organization     Organization        @relation(fields: [organization_id], references: [id], onDelete: Cascade)
  share_class      ShareClass          @relation(fields: [share_class_id], references: [id], onDelete: Cascade)
  from_stakeholder CapTableStakeholder? @relation("TransactionFrom", fields: [from_stakeholder_id], references: [id])
  to_stakeholder   CapTableStakeholder? @relation("TransactionTo", fields: [to_stakeholder_id], references: [id])

  @@index([organization_id])
  @@index([organization_id, transaction_date])
  @@index([from_stakeholder_id])
  @@index([to_stakeholder_id])
  @@index([share_class_id])
  @@map("cap_table_equity_transactions")
}
```

#### Field Descriptions

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | UUID | Auto | Primary key |
| `organization_id` | UUID | Yes | Multi-tenant isolation |
| `transaction_type` | EquityTransactionType | Yes | GRANT, TRANSFER, PURCHASE, CANCELLATION |
| `transaction_date` | Date | Yes | When the equity event occurred |
| `share_class_id` | UUID | Yes | Which share class is affected |
| `from_stakeholder_id` | UUID | Conditional | Source stakeholder (TRANSFER, CANCELLATION) |
| `to_stakeholder_id` | UUID | Conditional | Destination stakeholder (GRANT, TRANSFER, PURCHASE) |
| `shares_affected` | Int | Yes | Number of shares involved |
| `price_per_share` | Decimal(12,4) | No | Price per share for PURCHASE transactions |
| `notes` | Text | No | Free-text description of the transaction |
| `created_by` | String | Yes | User ID who recorded the transaction |

#### Validation Rules

- `shares_affected` must be > 0
- `transaction_date` is required
- Stakeholder requirements by type:
  - **GRANT**: `to_stakeholder_id` required, `from_stakeholder_id` null
  - **TRANSFER**: both `from_stakeholder_id` and `to_stakeholder_id` required
  - **PURCHASE**: `to_stakeholder_id` required, `from_stakeholder_id` null
  - **CANCELLATION**: `from_stakeholder_id` required, `to_stakeholder_id` null
- No `updated_at` — transactions are immutable (append-only)

#### Transaction Semantics

| Type | Effect on Holdings |
|------|-------------------|
| GRANT | Increase `to_stakeholder` shares by `shares_affected` |
| TRANSFER | Decrease `from_stakeholder`, increase `to_stakeholder` by `shares_affected` |
| PURCHASE | Increase `to_stakeholder` shares by `shares_affected` |
| CANCELLATION | Decrease `from_stakeholder` shares by `shares_affected` |

---

## Relation Updates to Existing Models

### Organization (add relations)

```prisma
model Organization {
  // ... existing fields ...

  // Feature 11: Cap Table
  cap_table_stakeholders CapTableStakeholder[]
  share_classes          ShareClass[]
  equity_transactions    EquityTransaction[]
}
```

---

## Index Strategy

| Table | Index | Purpose |
|-------|-------|---------|
| `cap_table_stakeholders` | `(organization_id)` | Multi-tenant list queries |
| `cap_table_stakeholders` | `(organization_id, email)` UNIQUE | Deduplication |
| `cap_table_share_classes` | `(organization_id)` | Multi-tenant list queries |
| `cap_table_share_classes` | `(organization_id, name)` UNIQUE | Name uniqueness |
| `cap_table_equity_holdings` | `(stakeholder_id, share_class_id)` UNIQUE | One holding per class per stakeholder |
| `cap_table_equity_holdings` | `(stakeholder_id)` | Stakeholder lookup |
| `cap_table_equity_holdings` | `(share_class_id)` | Class summary |
| `cap_table_equity_transactions` | `(organization_id)` | Multi-tenant queries |
| `cap_table_equity_transactions` | `(organization_id, transaction_date)` | Point-in-time queries |
| `cap_table_equity_transactions` | `(from_stakeholder_id)` | Stakeholder history |
| `cap_table_equity_transactions` | `(to_stakeholder_id)` | Stakeholder history |
| `cap_table_equity_transactions` | `(share_class_id)` | Class transaction history |

---

## Migration Plan

### Schema Migration
1. Create `EquityTransactionType` enum
2. Create `cap_table_stakeholders` table
3. Create `cap_table_share_classes` table
4. Create `cap_table_equity_holdings` table
5. Create `cap_table_equity_transactions` table
6. Add relations to Organization model

### RLS Policies
```sql
-- cap_table_stakeholders
CREATE POLICY "Users can manage stakeholders in their org"
  ON cap_table_stakeholders FOR ALL
  USING (organization_id = get_user_organization_id());

-- cap_table_share_classes
CREATE POLICY "Users can manage share classes in their org"
  ON cap_table_share_classes FOR ALL
  USING (organization_id = get_user_organization_id());

-- cap_table_equity_holdings (org scoped via stakeholder)
CREATE POLICY "Users can view holdings in their org"
  ON cap_table_equity_holdings FOR ALL
  USING (
    stakeholder_id IN (
      SELECT id FROM cap_table_stakeholders
      WHERE organization_id = get_user_organization_id()
    )
  );

-- cap_table_equity_transactions
CREATE POLICY "Users can manage transactions in their org"
  ON cap_table_equity_transactions FOR ALL
  USING (organization_id = get_user_organization_id());
```

### No Data Migration Required
This is a new feature with no existing data to migrate.
