# Implementation Plan: Dynamic Cost Sync & Auto-Association

**Feature**: 1-dynamic-cost-sync
**Branch**: `1-dynamic-cost-sync`
**Created**: 2026-02-17
**Spec**: [spec.md](./spec.md)
**Research**: [research.md](./research.md)
**Data Model**: [data-model.md](./data-model.md)
**Contracts**: [contracts/api-contracts.md](./contracts/api-contracts.md)

---

## Constitution Compliance

| Principle | Status |
|---|---|
| Prisma schema for all DB changes | ✅ |
| UUID PKs + timestamps on all new entities | ✅ |
| `organization_id` scoping on all new tables | ✅ |
| RLS policies required for 3 new tables | ✅ Required — task included |
| Server Actions / API Routes for mutations | ✅ |
| Supabase pooler URLs (verify before schema work) | ✅ Task 0 verifies |
| `npx prisma migrate dev` + `npx prisma generate` | ✅ |
| Exponential backoff (reuse `lib/mercury/retry.ts`) | ✅ |
| No hard deletes on core entities | ✅ New tables are append-only |
| No new unencrypted secrets | ✅ |

---

## Technical Context

**Stack**: Next.js 16, React 19, Prisma, Supabase (PostgreSQL), Tailwind CSS, shadcn/ui, Recharts + Tremor

**Existing foundation** (do not rebuild):
- Mercury sync pipeline: `lib/mercury/transaction-sync.ts`, `lib/mercury/scheduled-sync.ts`
- Merchant mapper: `lib/mercury/merchant-mapper.ts` (contractor + agency tiers)
- Categorization engine: `lib/mercury/categorization-engine.ts`
- Fuzzy matching utilities: `lib/mercury/utils.ts` (`normalizeName`, `calculateSimilarity`)
- Sync logger: `lib/mercury/sync-logger.ts`
- Client ROI calc: `lib/calculations/client-roi.ts`

**New components to build**:
- 3 new Prisma tables + 1 schema column
- Subscription sync engine extending the existing merchant mapper
- Auto-association orchestrator (post-sync pipeline step)
- Cascade cost calculator for subscription allocations
- Trend reporter (MoM for subscriptions and contractors)
- Client receipt mapper (Mercury deposits → clients)
- 9 new API routes + 2 modified existing routes
- 5 new UI components / panels

---

## Implementation Phases

---

### Phase 0: Database Foundation

> **Prerequisite**: Verify DB connection before ANY schema changes.

**Task 0.1 — Verify database connection**
```bash
npx prisma migrate status
```
Must succeed. If not, check `.env` for correct pooler URLs (port 6543 / 5432).

**Task 0.2 — Schema changes in `prisma/schema.prisma`**

Add to schema:
1. `SubscriptionTransactionRecord` model (new table: `subscription_transaction_records`)
2. `ClientCashReceipt` model (new table: `client_cash_receipts`)
3. `AutoSyncRunLog` model (new table: `auto_sync_run_logs`)
4. `subscription_id String?` field on `MerchantMappingCache`
5. Back-relations on `Subscription`, `Client`, `Organization`, `MercurySyncLog`

Exact field definitions: see [data-model.md](./data-model.md).

**Task 0.3 — Run migration**
```bash
npx prisma migrate dev --name "add-dynamic-cost-sync-tables"
npx prisma generate
```

**Task 0.4 — Add RLS policies** (Supabase dashboard or SQL migration file)

For `subscription_transaction_records`:
- SELECT: org membership check
- INSERT: service role only (system writes)

For `client_cash_receipts`:
- SELECT: org membership check
- INSERT: org membership + admin role

For `auto_sync_run_logs`:
- SELECT: org membership check
- INSERT: service role only

**Task 0.5 — Verify migration applied**
```bash
npx prisma migrate status   # Should show all migrations applied
```

---

### Phase 1: Subscription Merchant Mapping Engine

**Task 1.1 — Create `lib/mercury/subscription-mapper.ts`**

Mirrors the pattern of `mapMerchantToContractor` / `mapMerchantToAgency` in `merchant-mapper.ts`.

Key functions:
- `getCachedSubscriptionMapping(connectionId, merchantName)` — reads `MerchantMappingCache.subscription_id`
- `findSubscriptionByMerchantPattern(organizationId, merchantName)` — exact name match against active subscriptions
- `findSubscriptionsByFuzzyName(organizationId, merchantName, threshold=0.85)` — Jaro-Winkler fuzzy match
- `cacheSubscriptionMapping(connectionId, merchantName, subscriptionId, confidence, userId?)` — upsert cache entry with `subscription_id`
- `mapMerchantToSubscription(connectionId, organizationId, merchantName)` — tiered orchestrator

**Task 1.2 — Extend `POST /api/mercury/merchants/map` (existing route)**

Add `subscriptionId` as an accepted target (mutually exclusive with `contractorId`, `agencyId`). Update Zod schema and handler to call `cacheSubscriptionMapping()`.

**Task 1.3 — Create `POST /api/mercury/merchants/map-subscription/route.ts`**

New dedicated route for subscription mapping. On success, immediately triggers back-fill (Task 2.1 logic) for the last 90 days.

**Task 1.4 — Create `DELETE /api/mercury/merchants/map-subscription/route.ts`**

Removes mapping from `MerchantMappingCache`. Does NOT delete existing `subscription_transaction_records`.

---

### Phase 2: Subscription Transaction Sync Engine

**Task 2.1 — Create `lib/mercury/subscription-sync.ts`**

Core engine that links Mercury transactions to subscriptions.

Key functions:
- `linkTransactionToSubscription(tx, subscriptionId, organizationId)` — creates a `SubscriptionTransactionRecord`, skips if `mercury_transaction_id` already exists (duplicate guard)
- `backfillSubscriptionTransactions(connectionId, organizationId, subscriptionId, merchantName)` — queries existing `ExpenseRecord` entries from the last 90 days matching the merchant, creates `SubscriptionTransactionRecord` for each unlinked one
- `processSubscriptionMappings(connectionId, organizationId, transactions)` — for each debit transaction in a batch, check subscription mapping cache, create records, return counts

**Task 2.2 — Create `lib/calculations/subscription-cost-calculator.ts`**

Key functions:
- `computeSubscriptionPeriodCost(subscriptionId, month, year)` — `SUM(amount)` from `subscription_transaction_records` for the period
- `cascadeAllocationUpdates(subscriptionId, month, year)` — recomputes `SubscriptionAllocation.cost_allocated` for all active allocations of the subscription based on updated period total
- `updateClientROISubscriptionCosts(subscriptionId, month, year)` — updates `ClientROI.subscription_costs` for affected clients
- `detectCostChangeAndNotify(subscriptionId, currentTotal, priorTotal, organizationId)` — if `abs((current - prior) / prior) > threshold`, creates a `Notification` record

---

### Phase 3: Auto-Association Engine (Orchestrator)

**Task 3.1 — Create `lib/mercury/auto-association-engine.ts`**

Orchestrates the full post-sync pipeline. Called by `syncTransactions()` after the Mercury API fetch completes.

```
runAutoAssociation(organizationId, connectionId, syncLogId, transactions[]):
  1. Create AutoSyncRunLog (started_at)
  2. Separate transactions into DEBITS and CREDITS
  3. [PARTIAL COMMIT] For each DEBIT transaction:
     a. Check subscription mapping → if found, create SubscriptionTransactionRecord
     b. Check contractor mapping → if found, create/update ExpenseRecord (existing)
     c. Apply categorization rules (existing)
     d. If unresolved → add to needs_review list
  4. [PARTIAL COMMIT] For each CREDIT transaction:
     a. Surface in unassociated deposits queue (no auto-linking for revenue)
  5. Trigger cascade cost updates for all affected subscriptions
  6. Complete AutoSyncRunLog (completed_at, counts, partialCommit flag)
  7. Return summary
```

Each step is wrapped in a try/catch. Failures increment `engine_error_count` and add to the needs_review queue without rolling back successfully committed records.

**Task 3.2 — Hook auto-association into `lib/mercury/transaction-sync.ts`**

After the main sync loop completes (transactions fetched and stored), call `runAutoAssociation()` as the final step. Pass the collected transaction batch and the sync log ID.

**Task 3.3 — Create `GET /api/mercury/auto-sync/logs/route.ts`**

Returns recent `AutoSyncRunLog` records for the organization.

---

### Phase 4: Trend Reporting Engine

**Task 4.1 — Create `lib/calculations/trend-reporter.ts`**

Key functions:
- `getSubscriptionTrend(subscriptionId, currentMonth, currentYear, historyMonths)` — queries `subscription_transaction_records`, computes period totals for N months, derives MoM change
- `getContractorTrend(contractorId, currentMonth, currentYear, historyMonths)` — queries `expense_records` filtered by `contractor_id`, same aggregation logic
- `computeTrend(currentTotal, priorTotal)` — returns `{ direction, absoluteChange, percentageChange }`

**Task 4.2 — Create `GET /api/subscriptions/[id]/transactions/route.ts`**

Returns paginated list of `subscription_transaction_records` for a subscription, optionally filtered by period.

**Task 4.3 — Create `GET /api/subscriptions/[id]/trend/route.ts`**

Calls `getSubscriptionTrend()`, returns structured trend response per contract.

**Task 4.4 — Create `GET /api/contractors/[id]/trend/route.ts`**

Calls `getContractorTrend()`, returns structured trend response per contract.

---

### Phase 5: Client Revenue Reconciliation

**Task 5.1 — Create `lib/mercury/receipt-mapper.ts`**

Key functions:
- `getUnassociatedDeposits(connectionId, organizationId, page, limit)` — queries Mercury credit transactions with no `ClientCashReceipt` record, includes fuzzy client name suggestion
- `linkDepositToClient(mercuryTransactionId, clientId, userId, organizationId)` — creates `ClientCashReceipt`, validates transaction is a credit, enforces uniqueness
- `suggestClientForDeposit(counterpartyName, organizationId)` — fuzzy match against client names (reuse `calculateSimilarity`)

**Task 5.2 — Create `GET /api/mercury/deposits/unassociated/route.ts`**

Returns unlinked Mercury deposits with client suggestions.

**Task 5.3 — Create `POST /api/mercury/deposits/link-client/route.ts`**

Admin endpoint to link a deposit to a client. Validates debit/credit direction.

**Task 5.4 — Create `GET /api/clients/[id]/revenue-reconciliation/route.ts`**

Queries both `financial_revenue_records` (Xero) and `client_cash_receipts` (Mercury) for the client and period, returns reconciliation view per contract.

---

### Phase 6: Review Queue Extension

**Task 6.1 — Extend `GET /api/mercury/merchants/unmapped` response**

Add `transaction_type: 'DEBIT' | 'CREDIT'` and subscription fuzzy match suggestions to the response (see modified contract in [api-contracts.md](./contracts/api-contracts.md)).

**Task 6.2 — Update Review Queue UI**

Extend the existing unmapped merchant review UI to:
- Show a "Deposits" tab for unassociated credit transactions
- Show subscription as a link option (alongside contractor and agency) for debit transactions
- Surface cost change notifications (subscription cost went up/down > 10%)

---

### Phase 7: UI Components

**Task 7.1 — Merchant Link Modal (Subscription option)**

Extend existing merchant link modal (used for contractor/agency mapping) to include "Subscription" as a third option. Reuse modal shell and search/select pattern.

**Task 7.2 — Subscription Detail: Transaction History Panel**

New panel on the Subscription detail page showing:
- List of linked Mercury transactions for the selected period (month picker)
- Period total
- Drill-down to individual transaction details

**Task 7.3 — Subscription Detail: Cost Trend Chart**

Recharts bar/line chart showing monthly cost totals for the last N months. Includes trend indicator (up/down arrow + % change). Uses Tremor Card wrapper per constitution stack.

**Task 7.4 — Contractor Detail: Cost Trend Chart**

Same chart component as Task 7.3, parameterized for contractor data from the contractor trend API.

**Task 7.5 — Client Detail: Revenue Reconciliation Panel**

New panel showing:
- Xero invoiced amount for the period
- Mercury received amount for the period
- Outstanding balance / overpayment status
- Link to list of associated Mercury deposits

---

### Phase 8: Testing

**Task 8.1 — Unit tests for new calculation engines**
- `subscription-cost-calculator.ts`: test period sum, cascade update, threshold notification
- `trend-reporter.ts`: test MoM direction logic (UP/DOWN/FLAT/NEW), edge cases (no prior period, zero cost)
- `subscription-mapper.ts`: test 3-tier lookup (cache hit, exact match, fuzzy match, no match)
- `receipt-mapper.ts`: test credit-only validation, duplicate prevention

**Task 8.2 — Integration tests for new API routes**
- Map merchant to subscription → verify back-fill creates records
- Link deposit to client → verify ClientCashReceipt created, duplicate rejected
- Trend endpoint → verify correct period aggregation
- Reconciliation endpoint → verify Xero vs Mercury figures

**Task 8.3 — E2E test: Full auto-association cycle**
- Trigger manual sync → verify auto-association engine runs → verify subscription records created → verify trend data updated

---

## Implementation Order (Dependency Graph)

```
Phase 0 (DB)
  └── Phase 1 (Subscription Mapper)
        └── Phase 2 (Subscription Sync Engine)
              └── Phase 3 (Auto-Association Orchestrator)
                    ├── Phase 4 (Trend Reporting)
                    │     └── Phase 7.3 / 7.4 (Charts)
                    └── Phase 5 (Client Receipts)
                          └── Phase 7.5 (Reconciliation Panel)
Phase 6 (Review Queue) — depends on Phase 1 + 5
Phase 7.1 (Modal) — depends on Phase 1
Phase 8 (Tests) — after all phases
```

---

## Risk Register

| Risk | Impact | Mitigation |
|---|---|---|
| `mercury_transaction_id` uniqueness collision | Medium | Unique constraint on schema; upsert skips duplicates |
| Subscription fuzzy match false positive | Medium | 0.85 threshold + admin confirmation step for fuzzy matches |
| Cascade update performance on large subscription portfolios | Low | Bounded operation (fixed number of allocations per subscription); no N+1 via Prisma `findMany` |
| Client receipt linked to wrong client | Medium | Admin-only action; audit log on every `ClientCashReceipt` creation |
| Auto-association engine blocks sync completion | Low | Engine runs after sync; partial commit isolates failures |

---

## Definition of Done

- [ ] All 3 new Prisma tables created and migrated
- [ ] RLS policies applied for all new tables
- [ ] `npx prisma migrate status` clean post-deployment
- [ ] Subscription merchant mapping: one-time link triggers 90-day back-fill
- [ ] Daily sync runs auto-association engine as post-step
- [ ] Trend endpoints return correct MoM data for subscriptions and contractors
- [ ] Client revenue reconciliation shows Xero invoiced vs Mercury received
- [ ] Review queue surfaces unassociated deposits and subscription match options
- [ ] Unit tests passing for all calculation engines
- [ ] Integration tests passing for all new API routes
- [ ] No TypeScript strict mode violations
