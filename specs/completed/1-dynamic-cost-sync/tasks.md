# Tasks: Dynamic Cost Sync & Auto-Association

**Feature**: 1-dynamic-cost-sync
**Branch**: `1-dynamic-cost-sync`
**Spec**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md) | **Data Model**: [data-model.md](./data-model.md)
**Generated**: 2026-02-17

---

## User Story Map

| ID | Story | FR | Priority |
|---|---|---|---|
| US1 | Admin links a Subscription to a Mercury merchant; back-fill creates transaction records | FR-1 | P1 |
| US2 | Admin links a Contractor to a Mercury merchant; historical transactions back-filled as expense records | FR-2 | P1 |
| US3 | Every Mercury sync triggers auto-association engine (partial commit on failure) | FR-3 | P2 |
| US4 | Subscription allocation costs and ClientROI auto-recompute after sync | FR-4 | P2 |
| US5 | Month-over-month cost trend view for subscriptions and contractors | FR-7 | P3 |
| US6 | Admin links Mercury deposits to clients; invoiced-vs-received view per client | FR-8 | P3 |
| US7 | Review queue surfaces unresolved expenses AND unassociated deposits with resolution options | FR-5 | P4 |
| US8 | Fuzzy merchant name matching with admin confirmation and promotion to exact mapping | FR-6 | P4 |

---

## Phase 1: Setup & Database Foundation

> Verify connection and apply schema before any code.

- [ ] T001 Verify Supabase DB connection: run `npx prisma migrate status` from repo root — must succeed before any schema work
- [ ] T002 Add `SubscriptionTransactionRecord` model to `prisma/schema.prisma` per data-model.md (table: `subscription_transaction_records`, fields: id, organization_id, subscription_id, mercury_transaction_id UNIQUE, amount, transaction_date, merchant_name, period_month, period_year, linked_at, created_at)
- [ ] T003 Add `ClientCashReceipt` model to `prisma/schema.prisma` per data-model.md (table: `client_cash_receipts`, fields: id, organization_id, client_id, mercury_transaction_id UNIQUE, amount, receipt_date, period_month, period_year, linked_at, linked_by_user_id, created_at)
- [ ] T004 Add `AutoSyncRunLog` model to `prisma/schema.prisma` per data-model.md (table: `auto_sync_run_logs`, fields: id, organization_id, mercury_sync_log_id FK, started_at, completed_at, duration_ms, subscription_transactions_created, contractor_expense_records_created, needs_review_count, engine_error_count, partial_commit, errors JSON, created_at)
- [ ] T005 Add `subscription_id String?` column to `MerchantMappingCache` in `prisma/schema.prisma` with FK to `subscriptions.id` and index
- [ ] T006 Add back-relations to `Subscription`, `Client`, `Organization`, and `MercurySyncLog` in `prisma/schema.prisma` per data-model.md
- [ ] T007 Run `npx prisma migrate dev --name "add-dynamic-cost-sync-tables"` and confirm migration file created in `prisma/migrations/`
- [ ] T008 Run `npx prisma generate` to rebuild Prisma client with new types
- [ ] T009 Add RLS policy for `subscription_transaction_records` in Supabase: SELECT org-membership check; INSERT service-role only
- [ ] T010 Add RLS policy for `client_cash_receipts` in Supabase: SELECT org-membership check; INSERT org-membership + admin role
- [ ] T011 Add RLS policy for `auto_sync_run_logs` in Supabase: SELECT org-membership check; INSERT service-role only
- [ ] T012 Verify migration applied: run `npx prisma migrate status` — all migrations must show as applied

---

## Phase 2: Foundation — Merchant Mapping Extension

> Shared infrastructure used by US1, US2, US6. Must complete before user story phases.

- [ ] T013 [P] Create `lib/mercury/subscription-mapper.ts` with functions: `getCachedSubscriptionMapping(connectionId, merchantName)`, `findSubscriptionByMerchantPattern(organizationId, merchantName)`, `findSubscriptionsByFuzzyName(organizationId, merchantName, threshold=0.85)`, `cacheSubscriptionMapping(connectionId, merchantName, subscriptionId, confidence, userId?)`, `mapMerchantToSubscription(connectionId, organizationId, merchantName)` — mirror pattern of `mapMerchantToAgency` in `lib/mercury/merchant-mapper.ts`; reuse `normalizeName` and `calculateSimilarity` from `lib/mercury/utils.ts`
- [ ] T014 [P] Create `lib/mercury/receipt-mapper.ts` with functions: `getUnassociatedDeposits(connectionId, organizationId, page, limit)` (queries Mercury credits with no ClientCashReceipt), `suggestClientForDeposit(counterpartyName, organizationId)` (Jaro-Winkler fuzzy match against client names), `linkDepositToClient(mercuryTransactionId, clientId, userId, organizationId)` (creates ClientCashReceipt, validates positive amount, enforces uniqueness)
- [ ] T015 Extend `lib/validations/subscription.ts` with Zod schemas: `MapSubscriptionMerchantSchema` (subscriptionId UUID, merchantName string, matchType enum EXACT|FUZZY_KEYWORD) and `LinkDepositSchema` (mercuryTransactionId string, clientId UUID)
- [ ] T016 Update `cacheMerchantMapping` and `cacheAgencyMapping` in `lib/mercury/merchant-mapper.ts` to clear `subscription_id` when writing contractor/agency mapping (enforce mutual exclusivity of the three FK columns at the application layer)

---

## Phase 3: US1 — Subscription Merchant Mapping

> Complete, independently testable: Admin can link a subscription to a Mercury merchant and see transaction records created for the last 90 days.

- [ ] T017 [US1] Create `lib/mercury/subscription-sync.ts` with: `linkTransactionToSubscription(tx, subscriptionId, organizationId)` (creates `SubscriptionTransactionRecord`, skips if `mercury_transaction_id` already exists), `backfillSubscriptionTransactions(connectionId, organizationId, subscriptionId, merchantName)` (queries `financial_expense_records` from last 90 days matching merchant, creates `SubscriptionTransactionRecord` for each unlinked one), `processSubscriptionMappings(connectionId, organizationId, transactions[])` (batch processor returning counts)
- [ ] T018 [US1] Create `app/api/mercury/merchants/map-subscription/route.ts` — POST handler: validate with `MapSubscriptionMerchantSchema`, call `cacheSubscriptionMapping()`, call `backfillSubscriptionTransactions()`, return `{ success, subscriptionId, merchantName, transactionsLinked, computedPeriodCost }`
- [ ] T019 [US1] Add DELETE handler to `app/api/mercury/merchants/map-subscription/route.ts`: remove `MerchantMappingCache` entry by subscriptionId + merchantName, return success (does NOT delete existing `subscription_transaction_records`)
- [ ] T020 [US1] [P] Extend `app/api/mercury/merchants/map/route.ts` POST handler to accept optional `subscriptionId` field (mutually exclusive with `contractorId`, `agencyId`); add Zod union validation; call `cacheSubscriptionMapping()` when `subscriptionId` is provided
- [ ] T021 [US1] Create subscription merchant link modal component `components/subscriptions/MerchantLinkModal.tsx` — extend existing merchant link modal pattern (from contractors); shows recent Mercury merchants via unmapped list API; on submit calls `POST /api/mercury/merchants/map-subscription`
- [ ] T022 [US1] Add "Link to Mercury Merchant" button and `MerchantLinkModal` to subscription detail page at `app/(dashboard)/subscriptions/[id]/page.tsx` (or equivalent route)

**Independent Test Criteria (US1)**:
- POST map-subscription → 200, `transactionsLinked > 0` for known merchant
- POST map-subscription with duplicate → 400 `MERCHANT_ALREADY_MAPPED`
- DELETE map-subscription → 200; `subscription_transaction_records` rows for that sub still exist
- DB: `merchant_mapping_cache` has `subscription_id` set, `contractor_id` null, `agency_id` null

---

## Phase 4: US2 — Contractor Merchant Mapping Back-fill

> Complete, independently testable: Admin links a contractor; 90-day historical transactions appear as expense records.

- [ ] T023 [US2] Add `backfillContractorTransactions(connectionId, organizationId, contractorId, merchantName)` function to `lib/mercury/subscription-sync.ts`: queries `financial_expense_records` from last 90 days matching merchant name where `contractor_id` is null, updates each to set `contractor_id = contractorId` and `mercury_sync_status = SYNCED`
- [ ] T024 [US2] Update `app/api/mercury/merchants/map/route.ts` POST handler to call `backfillContractorTransactions()` after saving manual contractor mapping — runs back-fill for the linked contractor before returning the response
- [ ] T025 [US2] [P] Add `backfill_count` field to the POST map response so the UI can display how many historical records were linked

**Independent Test Criteria (US2)**:
- POST map (contractorId) → 200, `backfill_count` reflects rows updated in `financial_expense_records`
- DB: Updated expense records have `contractor_id` set for the back-filled period

---

## Phase 5: US3 — Auto-Association Engine (Orchestrator)

> Complete, independently testable: Triggering a Mercury sync creates subscription transaction records and contractor expense records automatically.

- [ ] T026 [US3] Create `lib/mercury/auto-association-engine.ts` with `runAutoAssociation(organizationId, connectionId, syncLogId, transactions[])`: (1) create `AutoSyncRunLog` started_at, (2) separate transactions into DEBITS and CREDITS, (3) per-DEBIT: check subscription mapping → create `SubscriptionTransactionRecord` if found, else check contractor mapping → create/update `ExpenseRecord`, else apply categorization rules, else add to needs_review list (each step per-transaction try/catch, partial commit), (4) collect unassociated CREDITS for deposits queue, (5) update `AutoSyncRunLog` with counts and `partial_commit` flag
- [ ] T027 [US3] Hook `runAutoAssociation()` into `lib/mercury/transaction-sync.ts` — call after main sync loop completes, pass the transaction batch and `syncLogId`; wrap in try/catch so engine failure does not fail the parent sync
- [ ] T028 [US3] Create `app/api/mercury/auto-sync/logs/route.ts` — GET handler: query `auto_sync_run_logs` for org ordered by `started_at DESC`, limit via query param (default 10), return array per contract in `contracts/api-contracts.md`
- [ ] T029 [US3] Update `lib/mercury/scheduled-sync.ts` `runScheduledSyncForOrganization()` to receive and pass transaction batch to `runAutoAssociation()` after `syncTransactions()` call completes

**Independent Test Criteria (US3)**:
- Trigger manual sync → GET `/api/mercury/auto-sync/logs` returns a run record with `completedAt` set
- DB: `subscription_transaction_records` rows created for matched merchants
- DB: `auto_sync_run_logs.partial_commit = false` when no errors

---

## Phase 6: US4 — Cascading Cost Updates

> Complete, independently testable: After sync, subscription allocation costs and ClientROI reflect the new transaction totals.

- [ ] T030 [US4] Create `lib/calculations/subscription-cost-calculator.ts` with: `computeSubscriptionPeriodCost(subscriptionId, month, year)` (SUM amount from `subscription_transaction_records`), `cascadeAllocationUpdates(subscriptionId, month, year)` (recompute `SubscriptionAllocation.cost_allocated` for all active allocations using period total × allocation percentage/seats), `updateClientROISubscriptionCosts(subscriptionId, month, year)` (update `client_roi.subscription_costs` for affected clients), `detectCostChangeAndNotify(subscriptionId, currentTotal, priorTotal, organizationId, thresholdPct=10)` (if `|change/prior| > threshold`, create `Notification` record with type `INFO`, source `SYSTEM`)
- [ ] T031 [US4] Call `cascadeAllocationUpdates()` and `updateClientROISubscriptionCosts()` inside `lib/mercury/auto-association-engine.ts` after each subscription transaction batch is committed — collect affected subscription IDs and call once per unique subscription per sync run
- [ ] T032 [US4] Call `detectCostChangeAndNotify()` in the cascade step, comparing current period total vs prior period total for each affected subscription

**Independent Test Criteria (US4)**:
- After sync with matched subscription: `subscription_allocations.cost_allocated` updated for current month
- After sync with >10% cost change: notification record created in `notifications` table
- `client_roi.subscription_costs` reflects new computed cost

---

## Phase 7: US5 — Cost Trend Reporting

> Complete, independently testable: Subscription and contractor detail views show MoM cost trend with transaction drill-down.

- [ ] T033 [P] [US5] Create `lib/calculations/trend-reporter.ts` with: `getSubscriptionTrend(subscriptionId, currentMonth, currentYear, historyMonths=3)` (aggregate `subscription_transaction_records` by period, compute MoM change), `getContractorTrend(contractorId, currentMonth, currentYear, historyMonths=3)` (aggregate `financial_expense_records` by period for contractor), `computeTrend(currentTotal, priorTotal)` returning `{ direction: 'UP'|'DOWN'|'FLAT'|'NEW', absoluteChange, percentageChange }`
- [ ] T034 [P] [US5] Create `app/api/subscriptions/[id]/transactions/route.ts` — GET handler: query `subscription_transaction_records` for subscriptionId with optional `?month=&year=` filter and `?page=&limit=` pagination; return array per contract
- [ ] T035 [P] [US5] Create `app/api/subscriptions/[id]/trend/route.ts` — GET handler: call `getSubscriptionTrend()`, return trend response per contract (`currentPeriod`, `priorPeriod`, `trend`, `history`)
- [ ] T036 [P] [US5] Create `app/api/contractors/[id]/trend/route.ts` — GET handler: call `getContractorTrend()`, return same trend shape
- [ ] T037 [US5] Create `components/subscriptions/SubscriptionTrendChart.tsx` — Recharts bar chart with monthly cost totals, trend indicator (↑/↓/→), MoM % change badge; accepts `history[]` and `trend` props from trend API
- [ ] T038 [US5] Create `components/contractors/ContractorTrendChart.tsx` — same component structure as `SubscriptionTrendChart.tsx` parameterized for contractor data
- [ ] T039 [US5] Add `SubscriptionTrendChart` and transaction history panel (date-range picker + paginated transaction list) to subscription detail page at `app/(dashboard)/subscriptions/[id]/page.tsx`
- [ ] T040 [US5] Add `ContractorTrendChart` to contractor detail page at `app/(dashboard)/contractors/[id]/page.tsx`

**Independent Test Criteria (US5)**:
- GET `/api/subscriptions/[id]/trend` with 2+ months data → `trend.direction` in `['UP','DOWN','FLAT']`, `trend.percentageChange` is a number
- GET `/api/subscriptions/[id]/trend` with 1 month data → `trend.direction = 'NEW'`
- GET `/api/subscriptions/[id]/transactions?month=2&year=2026` → array of linked transaction records
- GET `/api/contractors/[id]/trend` → same shape with contractor expense data

---

## Phase 8: US6 — Client Revenue Receipt Association

> Complete, independently testable: Admin can link a Mercury deposit to a client; client view shows invoiced vs received.

- [ ] T041 [US6] Create `app/api/mercury/deposits/unassociated/route.ts` — GET handler: call `getUnassociatedDeposits()` from `lib/mercury/receipt-mapper.ts`, call `suggestClientForDeposit()` for each, return paginated list with `suggestedClientId`, `suggestedClientName`, `suggestionConfidence` per contract
- [ ] T042 [US6] Create `app/api/mercury/deposits/link-client/route.ts` — POST handler: validate with `LinkDepositSchema`, call `linkDepositToClient()`, return `{ success, receiptId, clientId, amount, receiptDate }`; reject with `NOT_A_DEPOSIT` if transaction is debit, `ALREADY_LINKED` if `mercury_transaction_id` unique violation, `CLIENT_NOT_FOUND` if clientId invalid
- [ ] T043 [US6] Create `app/api/clients/[id]/revenue-reconciliation/route.ts` — GET handler with `?month=&year=` params: query `financial_revenue_records` (Xero invoiced) and `client_cash_receipts` (Mercury received) for client+period; return `{ invoiced, received, reconciliation: { outstanding, overpayment, status } }` per contract
- [ ] T044 [US6] Create `components/clients/RevenueReconciliationPanel.tsx` — Tremor Card showing: invoiced total, received total, outstanding/overpayment status badge, month picker, list of linked Mercury deposits for the period
- [ ] T045 [US6] Add `RevenueReconciliationPanel` to client detail page at `app/(dashboard)/clients/[id]/page.tsx`

**Independent Test Criteria (US6)**:
- POST link-client with valid deposit → 201, `ClientCashReceipt` row created in DB
- POST link-client with debit transaction → 400 `NOT_A_DEPOSIT`
- POST link-client twice same deposit → 400 `ALREADY_LINKED`
- GET revenue-reconciliation → `invoiced.total` from Xero records, `received.total` from `client_cash_receipts`; `reconciliation.status` = `FULLY_PAID` when totals match

---

## Phase 9: US7 & US8 — Review Queue & Fuzzy Match Promotion

> Complete, independently testable: Review queue shows both unresolved expenses and unassociated deposits; fuzzy matches can be promoted to exact.

- [ ] T046 [P] [US7] Extend `app/api/mercury/merchants/unmapped/route.ts` GET response to include `transaction_type: 'DEBIT'|'CREDIT'` for each merchant and add `suggested_subscription_id`, `suggested_subscription_name` fields (call `mapMerchantToSubscription()` in preview/suggest mode — return match without caching)
- [ ] T047 [US7] Update review queue UI component (find at `components/mercury/` or `app/(dashboard)/mercury/`) to add "Deposits" tab that fetches from `GET /api/mercury/deposits/unassociated`; existing "Expenses" tab unchanged; add "Link to Subscription" option in the expense resolution dropdown alongside existing contractor/agency/category options
- [ ] T048 [US7] Ensure `FR-5` resolution actions (link to subscription, contractor, category) each call the correct map endpoint and remove the transaction from the queue on success
- [ ] T049 [P] [US8] Add `promoteToExactMapping(connectionId, normalizedMerchantName, subscriptionId)` to `lib/mercury/subscription-mapper.ts` — updates existing `MerchantMappingCache` entry `mapping_confidence` to `EXACT` and `confidence_score` to 1.0
- [ ] T050 [US8] Create `POST /api/mercury/merchants/promote-fuzzy-subscription/route.ts` — admin promotes a fuzzy-matched subscription mapping to exact; calls `promoteToExactMapping()`
- [ ] T051 [US8] Add "Confirm & Make Exact" action in review queue UI for transactions that have a fuzzy subscription suggestion with confidence below 0.85

**Independent Test Criteria (US7 / US8)**:
- GET `/api/mercury/merchants/unmapped` → each item includes `transaction_type` field
- Deposits tab in review queue shows unassociated credits
- POST promote-fuzzy-subscription → `MerchantMappingCache.mapping_confidence = EXACT`

---

## Phase 10: Polish & Cross-Cutting Concerns

- [ ] T052 Add Zod request validation to all 9 new API routes (reference `lib/validations/subscription.ts` and `lib/validations/contractor.ts` for patterns)
- [ ] T053 [P] Audit all new files for TypeScript strict mode compliance — no implicit `any`, all Prisma return types explicitly typed
- [ ] T054 [P] Write unit tests for `lib/calculations/subscription-cost-calculator.ts` covering: period sum, cascade allocation update, threshold notification (>10%), zero-cost edge case
- [ ] T055 [P] Write unit tests for `lib/calculations/trend-reporter.ts` covering: UP/DOWN/FLAT/NEW direction logic, no-prior-period case, zero prior total (avoid division by zero)
- [ ] T056 [P] Write unit tests for `lib/mercury/subscription-mapper.ts` covering: cache hit, exact match, fuzzy match above threshold, no match (returns null)
- [ ] T057 [P] Write unit tests for `lib/mercury/receipt-mapper.ts` covering: debit rejection, duplicate prevention, fuzzy client suggestion scoring
- [ ] T058 Run `npx prisma migrate status` in staging environment to confirm clean migration state
- [ ] T059 Verify RLS policies are active in Supabase for all 3 new tables by testing unauthenticated access returns 403
- [ ] T060 Update `lib/mercury/sync-logger.ts` if any new log fields are needed for auto-sync run summary display

---

## Dependency Graph

```
Phase 1 (DB Setup)
  └── Phase 2 (Foundation Mappers)
        ├── Phase 3 (US1: Subscription Mapping)
        │     └── Phase 5 (US3: Auto-Association Engine)
        │           ├── Phase 6 (US4: Cascade Updates)
        │           ├── Phase 7 (US5: Trend Reporting)
        │           └── Phase 8 (US6: Client Receipts)
        │                 └── Phase 9 (US7: Review Queue)
        └── Phase 4 (US2: Contractor Back-fill)
              └── Phase 5 (US3: Auto-Association Engine)

Phase 9 (US7/US8) — also depends on Phase 3, Phase 7, Phase 8
Phase 10 (Polish) — depends on all phases
```

**Stories that can start in parallel once Phase 2 is done**:
- US1 (Phase 3) and US2 (Phase 4) are independent — different files, no shared state

**Within US5 (Phase 7)**: T033–T036 are all parallelizable (different files, no inter-dependency).

---

## Parallel Execution Examples

**After Phase 2 completes** — run simultaneously:
```
Agent A: Phase 3 (US1) T017 → T022
Agent B: Phase 4 (US2) T023 → T025
```

**Within Phase 7 (US5)** — run simultaneously:
```
Agent A: T033 (trend-reporter.ts) + T034 (transactions route) + T035 (subscription trend route)
Agent B: T036 (contractor trend route) + T037 (SubscriptionTrendChart) + T038 (ContractorTrendChart)
```

**Phase 10 tests** — all T054–T057 are parallelizable (separate test files).

---

## Implementation Strategy (MVP First)

**MVP (Phases 1–5)** — delivers the core "associate once, auto-sync forever" value:
- DB schema + migrations
- Subscription merchant mapping with 90-day back-fill
- Auto-association engine running post-sync

**Increment 2 (Phase 6)** — adds cascade cost accuracy:
- Subscription cost calculator + cascade updates

**Increment 3 (Phases 7–8)** — completes reporting:
- Trend charts for subscriptions and contractors

**Increment 4 (Phases 9–10)** — completes the client revenue story + polish:
- Client receipts + reconciliation view
- Review queue extension + fuzzy promotion

---

## Summary

| Metric | Count |
|---|---|
| Total tasks | 60 |
| Phase 1 (Setup) | 12 |
| Phase 2 (Foundation) | 4 |
| Phase 3 (US1) | 6 |
| Phase 4 (US2) | 3 |
| Phase 5 (US3) | 4 |
| Phase 6 (US4) | 3 |
| Phase 7 (US5) | 8 |
| Phase 8 (US6) | 5 |
| Phase 9 (US7/US8) | 6 |
| Phase 10 (Polish) | 9 |
| Parallelizable tasks [P] | 22 |
| User story phases | 7 |
