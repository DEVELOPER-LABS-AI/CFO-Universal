# API Contracts: Dynamic Cost Sync & Auto-Association

**Feature**: 1-dynamic-cost-sync
**Date**: 2026-02-17
**Pattern**: Next.js API Routes (REST). All routes require authenticated session. Admin role required for mutation endpoints.

---

## New Endpoints

### 1. Map Merchant to Subscription

**Route**: `POST /api/mercury/merchants/map-subscription`

**Purpose**: Admin links a Mercury merchant name to a Subscription. Triggers immediate back-fill of matched transactions in the 90-day window.

**Request Body**:
```typescript
{
  subscriptionId: string;          // UUID of the Subscription record
  merchantName: string;            // Exact merchant name from Mercury
  matchType: 'EXACT' | 'FUZZY_KEYWORD';
}
```

**Response (200)**:
```typescript
{
  success: true;
  subscriptionId: string;
  merchantName: string;
  transactionsLinked: number;       // Count back-filled from 90-day window
  computedPeriodCost: number;       // Current month total after back-fill
}
```

**Response (400)**:
```typescript
{
  success: false;
  error: 'SUBSCRIPTION_NOT_FOUND' | 'MERCHANT_ALREADY_MAPPED' | 'INVALID_SUBSCRIPTION';
  message: string;
}
```

---

### 2. Unmap Merchant from Subscription

**Route**: `DELETE /api/mercury/merchants/map-subscription`

**Purpose**: Remove a merchant-to-subscription mapping. Does not delete existing `subscription_transaction_records`.

**Request Body**:
```typescript
{ subscriptionId: string; merchantName: string; }
```

**Response (200)**:
```typescript
{ success: true; message: string; }
```

---

### 3. Get Subscription Transaction History

**Route**: `GET /api/subscriptions/[id]/transactions`

**Purpose**: Returns all Mercury transactions linked to a subscription, optionally filtered by period.

**Query Params**:
```
?month=2&year=2026    // Optional period filter
?page=1&limit=50      // Pagination
```

**Response (200)**:
```typescript
{
  subscriptionId: string;
  subscriptionName: string;
  period: { month: number; year: number } | null;  // null = all time
  totalAmount: number;
  transactions: Array<{
    id: string;
    mercury_transaction_id: string;
    amount: number;
    transaction_date: string;   // ISO 8601
    merchant_name: string;
    period_month: number;
    period_year: number;
  }>;
  pagination: { page: number; limit: number; total: number; };
}
```

---

### 4. Get Subscription Cost Trend

**Route**: `GET /api/subscriptions/[id]/trend`

**Purpose**: Returns month-over-month trend data for a subscription.

**Query Params**:
```
?months=6    // How many months of history to return (default: 3, max: 12)
```

**Response (200)**:
```typescript
{
  subscriptionId: string;
  subscriptionName: string;
  currentPeriod: {
    month: number; year: number;
    total: number;
    transactionCount: number;
  };
  priorPeriod: {
    month: number; year: number;
    total: number;
    transactionCount: number;
  } | null;  // null if no prior period data
  trend: {
    direction: 'UP' | 'DOWN' | 'FLAT' | 'NEW';
    absoluteChange: number;        // e.g. 100.00
    percentageChange: number;      // e.g. 20.00
  };
  history: Array<{
    month: number; year: number;
    total: number;
    transactionCount: number;
  }>;
}
```

---

### 5. Get Contractor Cost Trend

**Route**: `GET /api/contractors/[id]/trend`

**Purpose**: Returns month-over-month trend data for a contractor (from `expense_records`).

**Query Params**: `?months=6`

**Response (200)**: Same shape as subscription trend response above, with `contractorId` and `contractorName` fields instead.

---

### 6. Get Unassociated Mercury Deposits

**Route**: `GET /api/mercury/deposits/unassociated`

**Purpose**: Returns Mercury incoming (credit) transactions not yet linked to a client.

**Query Params**: `?page=1&limit=50`

**Response (200)**:
```typescript
{
  total: number;
  deposits: Array<{
    mercury_transaction_id: string;
    amount: number;
    transaction_date: string;
    description: string | null;
    counterparty_name: string | null;
    suggestedClientId: string | null;    // Fuzzy match suggestion
    suggestedClientName: string | null;
    suggestionConfidence: number | null; // 0.0-1.0
  }>;
}
```

---

### 7. Link Mercury Deposit to Client

**Route**: `POST /api/mercury/deposits/link-client`

**Purpose**: Admin associates a Mercury deposit with a client as a cash receipt.

**Request Body**:
```typescript
{
  mercuryTransactionId: string;
  clientId: string;
}
```

**Response (200)**:
```typescript
{
  success: true;
  receiptId: string;
  clientId: string;
  amount: number;
  receiptDate: string;
}
```

**Response (400)**:
```typescript
{
  success: false;
  error: 'ALREADY_LINKED' | 'NOT_A_DEPOSIT' | 'CLIENT_NOT_FOUND';
  message: string;
}
```

---

### 8. Get Client Revenue Reconciliation

**Route**: `GET /api/clients/[id]/revenue-reconciliation`

**Purpose**: Returns the invoiced-vs-received view per client for a given period.

**Query Params**: `?month=2&year=2026`

**Response (200)**:
```typescript
{
  clientId: string;
  clientName: string;
  period: { month: number; year: number; };
  invoiced: {
    total: number;               // From Xero RevenueRecord
    invoiceCount: number;
    currency: 'USD';
  };
  received: {
    total: number;               // From ClientCashReceipt
    receiptCount: number;
    currency: 'USD';
  };
  reconciliation: {
    outstanding: number;         // invoiced.total - received.total (positive = unpaid)
    overpayment: number;         // received.total - invoiced.total (positive = overpaid)
    status: 'FULLY_PAID' | 'PARTIALLY_PAID' | 'UNPAID' | 'OVERPAID';
  };
}
```

---

### 9. Get Auto-Sync Run History

**Route**: `GET /api/mercury/auto-sync/logs`

**Purpose**: Returns recent auto-association engine run records.

**Query Params**: `?limit=10`

**Response (200)**:
```typescript
{
  runs: Array<{
    id: string;
    mercurySyncLogId: string;
    startedAt: string;
    completedAt: string | null;
    durationMs: number | null;
    subscriptionTransactionsCreated: number;
    contractorExpenseRecordsCreated: number;
    needsReviewCount: number;
    engineErrorCount: number;
    partialCommit: boolean;
  }>;
}
```

---

## Modified Endpoints

### `GET /api/mercury/merchants/unmapped`

**Change**: Response now includes a `type` field indicating whether the unmapped transaction is a debit (expense) or credit (deposit), so the UI can route it to the correct resolution flow.

```diff
{
  merchants: Array<{
    merchant_name: string;
    transaction_count: number;
    last_seen_at: string;
+   transaction_type: 'DEBIT' | 'CREDIT';  // NEW
+   suggested_subscription_id: string | null;  // NEW - fuzzy match against subscriptions
+   suggested_subscription_name: string | null;  // NEW
  }>;
}
```

### `POST /api/mercury/merchants/map`

**Change**: Accepts optional `subscriptionId` in addition to existing `contractorId`/`agencyId`. Exactly one must be provided.

```diff
{
  merchantName: string;
  contractorId?: string;
  agencyId?: string;
+ subscriptionId?: string;  // NEW
}
```

---

## Zod Validation Schemas (Implementation Reference)

```typescript
// Map merchant to subscription
const MapSubscriptionSchema = z.object({
  subscriptionId: z.string().uuid(),
  merchantName: z.string().min(1).max(255),
  matchType: z.enum(['EXACT', 'FUZZY_KEYWORD']),
});

// Link deposit to client
const LinkDepositSchema = z.object({
  mercuryTransactionId: z.string().min(1),
  clientId: z.string().uuid(),
});

// Trend query params
const TrendQuerySchema = z.object({
  months: z.coerce.number().int().min(1).max(12).default(3),
});

// Reconciliation query params
const ReconciliationQuerySchema = z.object({
  month: z.coerce.number().int().min(1).max(12),
  year: z.coerce.number().int().min(2020).max(2050),
});
```
