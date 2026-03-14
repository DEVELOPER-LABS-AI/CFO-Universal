# Quickstart: Dynamic Cost Sync & Auto-Association

**Feature**: 1-dynamic-cost-sync
**Branch**: `1-dynamic-cost-sync`

---

## Prerequisites

- Node.js 20+, pnpm/npm installed
- Supabase project connected (pooler URLs in `.env`)
- Mercury integration already active (connection exists in DB)
- Run `npx prisma migrate status` — must return success before any schema work

---

## Environment Variables

No new environment variables are required. All Mercury and Supabase config is already in `.env`.

---

## Apply Database Migrations

```bash
# 1. Verify connection
npx prisma migrate status

# 2. Apply new migrations (adds 3 tables + 1 column)
npx prisma migrate dev --name "add-dynamic-cost-sync-tables"

# 3. Regenerate Prisma client
npx prisma generate
```

---

## Key New Files (After Implementation)

| File | Purpose |
|---|---|
| `lib/mercury/subscription-sync.ts` | Maps merchants → subscriptions, creates SubscriptionTransactionRecords |
| `lib/mercury/receipt-mapper.ts` | Maps Mercury deposits → clients, creates ClientCashReceipts |
| `lib/mercury/auto-association-engine.ts` | Orchestrates full post-sync pipeline |
| `lib/calculations/subscription-cost-calculator.ts` | Computes period totals and triggers cascade updates |
| `lib/calculations/trend-reporter.ts` | Computes MoM trend for subscriptions and contractors |
| `app/api/subscriptions/[id]/transactions/route.ts` | Transaction history for a subscription |
| `app/api/subscriptions/[id]/trend/route.ts` | MoM trend for a subscription |
| `app/api/contractors/[id]/trend/route.ts` | MoM trend for a contractor |
| `app/api/mercury/deposits/unassociated/route.ts` | Unlinked Mercury deposits |
| `app/api/mercury/deposits/link-client/route.ts` | Link a deposit to a client |
| `app/api/clients/[id]/revenue-reconciliation/route.ts` | Invoiced vs received view |
| `app/api/mercury/auto-sync/logs/route.ts` | Auto-sync run history |

---

## How the Auto-Association Pipeline Works

```
Mercury Sync Job (daily cron or manual)
  └── syncTransactions()                    [EXISTING]
        └── [POST-PROCESSING] Auto-Association Engine [NEW]
              ├── Step 1: Subscription Merchant Mapping
              │     ├── For each debit transaction
              │     ├── Check MerchantMappingCache for subscription_id
              │     ├── If found → create SubscriptionTransactionRecord
              │     └── Trigger cascade cost update
              ├── Step 2: Contractor Merchant Mapping        [EXISTING - no change]
              │     └── Creates ExpenseRecord with contractor_id
              ├── Step 3: Client Deposit Mapping (credits only)
              │     ├── Check MerchantMappingCache for client suggestions
              │     └── Surface unassociated deposits in review queue
              ├── Step 4: Categorization Rules Fallback      [EXISTING - no change]
              └── Step 5: Flag unresolved → Needs Review queue
```

---

## Testing a Full Sync Cycle Locally

```bash
# 1. Trigger a manual Mercury sync (will run auto-association as post-step)
curl -X POST /api/mercury/sync/manual \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"organizationId": "<org-id>"}'

# 2. Check auto-sync run log
GET /api/mercury/auto-sync/logs?limit=1

# 3. Check subscription transaction records
GET /api/subscriptions/<id>/transactions?month=2&year=2026

# 4. Check trend
GET /api/subscriptions/<id>/trend?months=3
```

---

## UI Entry Points

- **Subscriptions page** → Click a subscription → "Link to Mercury Merchant" button
- **Contractors page** → Click a contractor → "Link to Mercury Merchant" button (existing pattern, extended)
- **Mercury Review Queue** → Now includes unassociated deposits (credits) as a separate tab
- **Client detail page** → "Revenue Reconciliation" panel showing Xero invoiced vs Mercury received
