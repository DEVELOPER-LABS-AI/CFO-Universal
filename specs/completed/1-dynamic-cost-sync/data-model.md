# Data Model: Dynamic Cost Sync & Auto-Association

**Feature**: 1-dynamic-cost-sync
**Date**: 2026-02-17

---

## Schema Changes Overview

### New Tables (3)

| Table | Purpose | Schema |
|---|---|---|
| `subscription_transaction_records` | Links individual Mercury debit transactions to Subscriptions | `financial` |
| `client_cash_receipts` | Links individual Mercury credit/deposit transactions to Clients | `financial` |
| `auto_sync_run_logs` | Tracks each auto-association engine run | `integrations` |

### Modified Tables (1)

| Table | Change |
|---|---|
| `merchant_mapping_cache` | Add `subscription_id` column (nullable FK to `subscriptions.id`) |

---

## New Table Definitions

### 1. `subscription_transaction_records`

Links a single Mercury debit transaction to a Subscription. The subscription's cost for any period is computed by summing `amount` across records for that `period_month` + `period_year`.

```prisma
model SubscriptionTransactionRecord {
  id                    String       @id @default(uuid())
  organization_id       String
  subscription_id       String
  mercury_transaction_id String      @unique  // Each Mercury tx linked to at most one sub
  amount                Decimal      @db.Decimal(10, 2)
  transaction_date      DateTime
  merchant_name         String
  period_month          Int          // 1-12
  period_year           Int          // e.g. 2026
  linked_at             DateTime     @default(now())
  created_at            DateTime     @default(now())

  // Relations
  organization  Organization @relation(fields: [organization_id], references: [id])
  subscription  Subscription @relation(fields: [subscription_id], references: [id], onDelete: Cascade)

  @@unique([subscription_id, mercury_transaction_id])
  @@index([organization_id])
  @@index([subscription_id, period_year, period_month(sort: Desc)])
  @@index([mercury_transaction_id])
  @@index([transaction_date(sort: Desc)])
  @@map("subscription_transaction_records")
}
```

**Key Constraints**:
- `mercury_transaction_id` is globally unique (one tx cannot link to two subscriptions)
- Period (month/year) is denormalized from `transaction_date` for efficient aggregation queries

---

### 2. `client_cash_receipts`

Links a single Mercury credit/deposit transaction to a Client as a confirmed cash receipt. Stored separately from `financial_revenue_records` (Xero accrual data).

```prisma
model ClientCashReceipt {
  id                    String   @id @default(uuid())
  organization_id       String
  client_id             String
  mercury_transaction_id String  @unique  // Each deposit linked to at most one client
  amount                Decimal  @db.Decimal(10, 2)
  receipt_date          DateTime
  period_month          Int      // 1-12
  period_year           Int
  linked_at             DateTime @default(now())
  linked_by_user_id     String   // Who made the association (always admin)
  created_at            DateTime @default(now())

  // Relations
  organization Organization @relation(fields: [organization_id], references: [id])
  client       Client       @relation(fields: [client_id], references: [id])

  @@unique([client_id, mercury_transaction_id])
  @@index([organization_id])
  @@index([client_id, period_year, period_month(sort: Desc)])
  @@index([mercury_transaction_id])
  @@index([receipt_date(sort: Desc)])
  @@map("client_cash_receipts")
}
```

**Key Constraints**:
- `mercury_transaction_id` globally unique (one deposit cannot link to two clients)
- Only positive-amount (credit) Mercury transactions are valid inputs
- `linked_by_user_id` always required (admin-only action; no system auto-linking for revenue)

---

### 3. `auto_sync_run_logs`

Tracks each execution of the auto-association engine, which runs as a post-processing step after every Mercury sync job.

```prisma
model AutoSyncRunLog {
  id                            String    @id @default(uuid())
  organization_id               String
  mercury_sync_log_id           String    // FK to MercurySyncLog
  started_at                    DateTime  @default(now())
  completed_at                  DateTime?
  duration_ms                   Int?
  subscription_transactions_created Int   @default(0)
  contractor_expense_records_created Int  @default(0)
  needs_review_count            Int       @default(0)
  engine_error_count            Int       @default(0)
  partial_commit                Boolean   @default(false)  // true if errors occurred mid-run
  errors                        Json      @default("[]")
  created_at                    DateTime  @default(now())

  // Relations
  organization   Organization   @relation(fields: [organization_id], references: [id])
  mercury_sync   MercurySyncLog @relation(fields: [mercury_sync_log_id], references: [id])

  @@index([organization_id])
  @@index([mercury_sync_log_id])
  @@index([started_at(sort: Desc)])
  @@map("auto_sync_run_logs")
}
```

---

## Modified Table: `merchant_mapping_cache`

Add `subscription_id` as a third mutually exclusive mapping target.

```diff
model MerchantMappingCache {
  ...
  contractor_id   String?   // Set when merchant maps to a contractor
  agency_id       String?   // Set when merchant maps to an agency
+ subscription_id String?   // Set when merchant maps to a subscription (NEW)
  ...
}
```

**Mutual Exclusivity Rule** (application-layer enforced):
- Exactly one of `contractor_id`, `agency_id`, `subscription_id` must be non-null per record
- A subscription mapping is only applied to debit (outgoing) transactions

---

## Modified Relations on Existing Tables

### `Subscription` model
```diff
model Subscription {
  ...
+ transaction_records SubscriptionTransactionRecord[]
}
```

### `Client` model
```diff
model Client {
  ...
+ cash_receipts ClientCashReceipt[]
}
```

### `Organization` model
```diff
model Organization {
  ...
+ subscription_transaction_records SubscriptionTransactionRecord[]
+ client_cash_receipts             ClientCashReceipt[]
+ auto_sync_run_logs               AutoSyncRunLog[]
}
```

### `MercurySyncLog` model
```diff
model MercurySyncLog {
  ...
+ auto_sync_run AutoSyncRunLog?
}
```

---

## Computed Values (No Additional Storage)

These values are always computed from stored records — not stored as independent fields:

| Value | Source | Computation |
|---|---|---|
| Subscription cost (current period) | `subscription_transaction_records` | `SUM(amount) WHERE period_month = X AND period_year = Y` |
| Subscription cost (prior period) | `subscription_transaction_records` | `SUM(amount) WHERE period_month = X-1 AND period_year = Y` |
| MoM cost change $ | computed | current_total - prior_total |
| MoM cost change % | computed | `(change / prior_total) * 100` |
| Contractor MoM trend | `financial_expense_records` | `SUM(amount) WHERE contractor_id = X GROUP BY period` |
| Client invoiced amount | `financial_revenue_records` | Xero-sourced, existing |
| Client received amount | `client_cash_receipts` | `SUM(amount) WHERE client_id = X AND period = Y` |
| Outstanding balance | computed | invoiced_amount - received_amount |

---

## Indexes Required for Performance

| Table | Index | Query Pattern |
|---|---|---|
| `subscription_transaction_records` | `(subscription_id, period_year, period_month DESC)` | Period cost aggregation |
| `subscription_transaction_records` | `mercury_transaction_id` | Duplicate detection |
| `client_cash_receipts` | `(client_id, period_year, period_month DESC)` | Client reconciliation |
| `client_cash_receipts` | `mercury_transaction_id` | Duplicate detection |
| `auto_sync_run_logs` | `(organization_id, started_at DESC)` | Recent run history |

---

## RLS Policies Required

Three new policies must be added to Supabase for each new table:

1. **SELECT**: `organization_id IN (SELECT org_id FROM user_organizations WHERE user_id = auth.uid())`
2. **INSERT**: Same org check + user role = 'admin' for `client_cash_receipts` (admin-only)
3. **INSERT**: System service role only for `subscription_transaction_records` and `auto_sync_run_logs`

---

## Migration Strategy

```bash
# 1. Verify connection
npx prisma migrate status

# 2. Create migration
npx prisma migrate dev --name "add-dynamic-cost-sync-tables"

# 3. Regenerate client
npx prisma generate

# 4. Apply RLS policies via Supabase dashboard or SQL migration
```

**Rollback**: Drop the 3 new tables and revert `merchant_mapping_cache` `subscription_id` column addition. No existing data is modified.
