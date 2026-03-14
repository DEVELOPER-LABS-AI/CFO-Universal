# Research: Dynamic Cost Sync & Auto-Association

**Feature**: 1-dynamic-cost-sync
**Date**: 2026-02-17

---

## Existing Codebase Analysis

### What Already Exists (Do Not Rebuild)

| Component | File | Capability |
|---|---|---|
| Merchant-to-Contractor mapping | `lib/mercury/merchant-mapper.ts` | 3-tier: cache → exact → fuzzy (Jaro-Winkler 0.85) |
| Merchant-to-Agency mapping | `lib/mercury/merchant-mapper.ts` | Same 3-tier pattern, separate functions |
| Transaction categorization | `lib/mercury/categorization-engine.ts` | Priority cascade: contractor → rules → defaults → OTHER |
| Transaction sync | `lib/mercury/transaction-sync.ts` | Incremental sync, creates ExpenseRecords, maps merchants |
| Scheduled sync | `lib/mercury/scheduled-sync.ts` | Daily cron via `/api/mercury/sync/cron` |
| Sync logging | `lib/mercury/sync-logger.ts` | startSyncLog / completeSyncLog / failSyncLog |
| Rate limiting | `lib/mercury/rate-limiter.ts` | API rate limit management |
| Retry logic | `lib/mercury/retry.ts` | Exponential backoff |
| Client ROI calc | `lib/calculations/client-roi.ts` | Computes ROI from revenue + costs |
| Agency cost calc | `lib/calculations/agency-costs.ts` | Computes agency monthly totals |

### MerchantMappingCache Current State

The `MerchantMappingCache` table already supports three mutually exclusive mapping targets:
- `contractor_id` — expense → contractor
- `agency_id` — expense → agency

**Gap**: No `subscription_id` field. Adding this field extends the existing pattern cleanly without restructuring.

### ExpenseRecord Current State

`ExpenseRecord` already has `mercury_transaction_id` (unique), `category` (enum), `contractor_id`, `agency_id`. It is the existing home for Mercury-sourced expense data.

**Gap**: Subscriptions are not linked to expense records. Individual subscription transactions need their own link table (`subscription_transaction_records`) separate from `ExpenseRecord` because subscriptions aggregate multiple transactions into a computed cost — this is distinct from contractor expense records which are 1:1 with transactions.

### Categorization Pipeline Current Priority Order

```
P1: Contractor match → CONTRACTOR_COST (0.95 confidence)
P2: Admin rules → matched category (0.90)
P3: Default keyword patterns → SUBSCRIPTION/OVERHEAD/etc (0.70-0.80)
P4: OTHER fallback (0.0 confidence)
```

**Extension needed**: Insert P0 before P1: Subscription mapping → link to `subscription_transaction_records` table (debit/outgoing transactions only).

---

## Decision Log

### Decision 1: Where to Store Subscription Transactions

**Decision**: New dedicated table `subscription_transaction_records`

**Rationale**: Subscriptions aggregate transactions into computed period costs; ExpenseRecord is designed for 1:1 contractor/vendor charge tracking. Using a separate table keeps the models clean, allows efficient period-sum queries, and avoids polluting ExpenseRecord with subscription-specific aggregation semantics.

**Alternatives Considered**:
- Reuse `ExpenseRecord` with `subscription_id` FK — rejected because it conflates contractor costs with subscription cost tracking and complicates period aggregation queries.
- Store only computed period totals — rejected per spec (Q1 clarification): every individual transaction must be stored.

### Decision 2: MerchantMappingCache Extension vs. New Table

**Decision**: Add `subscription_id` column to existing `MerchantMappingCache`

**Rationale**: The existing table already enforces mutual exclusivity between `contractor_id` and `agency_id` at the application layer. Adding `subscription_id` as a third option follows the same pattern with minimal migration surface. A separate subscription mapping table would duplicate the normalized name deduplication logic already proven in this table.

**Alternatives Considered**:
- New `subscription_merchant_mapping` table — rejected because it duplicates the unique constraint and cache logic already in `MerchantMappingCache`.

### Decision 3: Client Cash Receipt Storage

**Decision**: New `client_cash_receipts` table (separate from `RevenueRecord`)

**Rationale**: `RevenueRecord` is Xero-sourced (accrual/invoice basis). Mercury deposits are cash-basis receipts. Keeping them separate preserves data provenance and allows the invoiced-vs-received view to be computed as a simple join/sum comparison without data mixing.

**Alternatives Considered**:
- Add Mercury fields to `RevenueRecord` — rejected because it mixes accrual and cash-basis data in one record, complicating financial reporting accuracy.

### Decision 4: Auto-Association Engine Architecture

**Decision**: Post-processing step appended to existing `syncTransactions()` flow; partial commit per-transaction (matches existing error handling pattern in transaction-sync.ts)

**Rationale**: The existing sync pipeline already handles per-transaction error isolation. Inserting the auto-association engine as a post-sync step (calling it after all transactions are fetched and stored as raw Mercury data) avoids modifying the core sync logic while ensuring association runs on every sync. Partial commit (transactions that succeed are kept, failures go to Needs Review queue) matches the clarified spec requirement and the existing error isolation pattern.

### Decision 5: Fuzzy Matching Threshold for Subscriptions

**Decision**: Same 0.85 Jaro-Winkler threshold as contractor/agency matching

**Rationale**: The existing threshold is already tuned for the domain (vendor/company names). Subscriptions use the same merchant name data from Mercury, so the same threshold applies. Reuses `normalizeName()` and `calculateSimilarity()` from `lib/mercury/utils.ts`.

### Decision 6: Subscription Cost Cascade Timing

**Decision**: Synchronous within the same auto-association job run (not deferred)

**Rationale**: Subscription allocation recalculation is a bounded operation (multiply total cost by allocation percentages). Running it synchronously within the same job ensures the dashboard reflects updated costs immediately after sync completes, matching the spec's requirement that ROI figures update "within the same sync cycle."

---

## Constitution Compliance Check

| Principle | Status | Notes |
|---|---|---|
| Prisma schema for all DB changes | ✅ Pass | All new tables via Prisma schema + migration |
| UUID PKs | ✅ Pass | Applied to all 3 new tables |
| `created_at` / `updated_at` timestamps | ✅ Pass | On all new tables |
| Soft deletes where applicable | ✅ Pass | `subscription_transaction_records` and `client_cash_receipts` are immutable records (no soft delete needed) |
| `organization_id` scoping | ✅ Pass | All new tables scoped via parent FK chain |
| RLS policies | ✅ Required | New policies needed for 3 new tables |
| Next.js Server Actions for mutations | ✅ Pass | All mutation API routes follow existing pattern |
| Supabase pooler URLs | ✅ Pass | Existing `.env` already validated; no change |
| Migration workflow | ✅ Pass | `npx prisma migrate dev` → `npx prisma generate` sequence required |
| Verify DB connection first | ✅ Pass | Task 0 in implementation tasks |
| No unencrypted secrets | ✅ Pass | No new secrets introduced |
| Exponential backoff for external APIs | ✅ Pass | Existing `lib/mercury/retry.ts` reused |

---

## Key Reuse Points

These existing utilities are reused directly — no changes needed:

- `normalizeName()` and `calculateSimilarity()` from `lib/mercury/utils.ts`
- `startSyncLog()`, `completeSyncLog()`, `failSyncLog()` from `lib/mercury/sync-logger.ts`
- `getCategorizationRules()` and `matchesRule()` from `lib/mercury/categorization-engine.ts`
- `cacheAgencyMapping()` / `cacheMerchantMapping()` patterns for new `cacheSubscriptionMapping()`
- Recharts + Tremor for trend chart components (already in constitution stack)
- shadcn/ui components for merchant link modal (reuse existing pattern from merchant map UI)
