# Feature Specification: Dynamic Cost Sync & Auto-Association

**Status**: Draft
**Created**: 2026-02-17
**Last Updated**: 2026-02-17

---

## Clarifications

### Session 2026-02-17

- Q: When a subscription's cost changes month-over-month, how should the system store that change? → A: Every individual Mercury transaction matched to a subscription is persisted as its own transaction record linked to that subscription. The subscription's cost for any period is always computed dynamically by summing those transactions — `total_cost` is a derived value, not a stored scalar. Month-over-month trend reporting (up/down/flat and by how much) is automatically computed by comparing period totals.
- Q: If the auto-association engine fails partway through processing a batch of transactions, what should happen? → A: Partial commit — successfully processed transactions are saved; failed or unprocessed transactions land in the "Needs Review" queue for the next sync cycle to retry. No full rollback.
- Q: Should contractor payments derived from Mercury also show month-over-month cost trend reporting, the same way subscriptions do? → A: Yes — contractors get the same trend reporting as subscriptions: current month total, prior month total, absolute and percentage change, trend direction indicator, and transaction-level drill-down.
- Q: How often should Mercury transactions be pulled and auto-association run? → A: Daily scheduled — once per day at a configured time (e.g., overnight). Admins can also trigger a manual sync on demand at any time.
- Q: Should Mercury incoming transactions (deposits/receipts) be associatable with client revenue records, alongside the existing Xero invoice flow? → A: Yes — Mercury deposits can be associated with clients as actual cash receipts. The system shows both the Xero-invoiced amount and the Mercury-received amount side by side, giving a complete invoiced-vs-received (accrual-vs-cash) view per client.

---

## Overview

### Feature Summary

This feature enables subscription costs, direct contractor charges, and client revenue receipts to be automatically populated and kept current by deriving them from Mercury bank transactions — the authoritative source of truth. Once a Mercury merchant or transaction pattern is associated with a subscription, contractor, or client, all future matching transactions are categorized and linked automatically without any manual intervention. For revenue, Mercury deposits are shown alongside Xero invoice data to provide a complete invoiced-vs-received view per client.

### Business Value

Currently, subscription costs and contractor payments are entered manually, and revenue figures rely solely on Xero invoices — creating a disconnect between what's actually paid and received (as recorded by Mercury) and what appears in financial dashboards. This leads to stale cost data, margin miscalculations, and no visibility into whether invoiced revenue has actually been collected. By making Mercury transactions the single source of truth for both expenses and cash receipts, the system ensures that costs and received revenue always reflect real-world bank activity, and that every client view shows both what was invoiced and what was actually paid — closing the accrual-vs-cash gap.

### Target Users

- **Finance/Operations Admin**: Performs the one-time association between Mercury merchants and subscriptions or contractors. Reviews auto-categorized transactions and resolves exceptions.
- **Executive / Analyst**: Consumes cost data in dashboards, trusting that figures are always current and derived from actual bank activity.

---

## User Scenarios

### Primary Use Cases

**Scenario 1: Associate a Subscription to a Mercury Merchant**
- **Actor**: Finance Admin
- **Goal**: Link a subscription (e.g., "HubSpot") to the Mercury merchant that charges for it, so future charges update the subscription cost automatically.
- **Steps**:
  1. Admin navigates to the Subscriptions section and selects a subscription.
  2. Admin opens "Link to Mercury Merchant" and sees a list of recurring or recent Mercury transactions.
  3. Admin selects the matching merchant (e.g., "HUBSPOT INC").
  4. System saves the association and immediately applies it: the subscription's cost is updated from the most recent matching Mercury transaction.
  5. System displays a confirmation showing the linked merchant and the derived cost.
- **Expected Outcome**: From this point forward, every Mercury sync updates the subscription's cost from the matched merchant's transactions automatically, and the allocation-level costs cascade to clients and staff.

**Scenario 2: Associate a Direct Contractor to a Mercury Merchant**
- **Actor**: Finance Admin
- **Goal**: Link a contractor directly hired by the company to the Mercury merchant that represents their payments, so contractor expense records are populated automatically.
- **Steps**:
  1. Admin navigates to Contractors and selects a contractor (or creates a new one).
  2. Admin opens "Link to Mercury Merchant" and selects the matching merchant.
  3. System saves the association.
  4. System back-fills recent unlinked Mercury transactions from that merchant as expense records for this contractor.
  5. Future Mercury syncs automatically create or update contractor expense records for matching transactions.
- **Expected Outcome**: Contractor costs in dashboards and ROI calculations reflect actual Mercury payments without manual entry.

**Scenario 3: Auto-Sync on Mercury Transaction Pull**
- **Actor**: System (scheduled or manual sync)
- **Goal**: Ensure all costs are current after every Mercury sync.
- **Steps**:
  1. Mercury sync completes (scheduled or triggered manually).
  2. System applies all saved merchant-to-subscription mappings: updates `Subscription.total_cost` from matched transactions.
  3. System applies all saved merchant-to-contractor mappings: creates or updates `ExpenseRecord` entries linked to the contractor.
  4. System applies existing categorization rules to any remaining uncategorized transactions.
  5. System flags transactions that have no mapping or rule match for admin review.
- **Expected Outcome**: Dashboard cost figures, subscription allocations, contractor expenses, and client ROI metrics are all current within minutes of a Mercury sync completing.

**Scenario 4: Review and Resolve Unmapped Transactions**
- **Actor**: Finance Admin
- **Goal**: Handle Mercury transactions that could not be automatically associated.
- **Steps**:
  1. Admin sees a notification/indicator showing N transactions need attention.
  2. Admin reviews each transaction: amount, merchant, date.
  3. Admin either links it to an existing subscription/contractor, creates a new contractor record, or marks it as a general expense category.
  4. System offers to apply this decision as a rule for future transactions from the same merchant.
- **Expected Outcome**: All transactions are resolved; the new rule ensures future transactions from that merchant are handled automatically.

**Scenario 5: Associate a Mercury Deposit with a Client as a Cash Receipt**
- **Actor**: Finance Admin
- **Goal**: Link a Mercury incoming deposit to a client so the system tracks what revenue was actually received in the bank, separate from what was invoiced via Xero.
- **Steps**:
  1. Admin navigates to a client record or the Mercury deposit review list.
  2. Admin sees Mercury deposits that haven't been associated with a client.
  3. Admin selects a deposit and links it to the appropriate client.
  4. System saves the association; future deposits from the same originating party are suggested for the same client.
  5. The client's detail view now shows: Xero-invoiced amount (accrual) alongside Mercury-received amount (cash) for the period.
- **Expected Outcome**: Every client has a real-time invoiced-vs-received view, making it immediately visible if a client has outstanding unpaid invoices or has paid ahead.

### Edge Cases

- **Merchant name variations**: The same vendor may appear under slightly different merchant names across transactions (e.g., "HUBSPOT INC" vs "HubSpot*MONTHLY"). The system must allow an admin to confirm fuzzy matches or add alternate name patterns to an existing mapping.
- **Subscription cost changes**: When a subscription price increases, the next Mercury transaction will reflect the new amount. Because cost is computed dynamically from stored transactions, the new amount is reflected automatically in the current period total; the system surfaces a change notification (when the threshold is exceeded) so allocations can be reviewed.
- **Contractor no longer active**: If a contractor is soft-deleted but Mercury transactions still arrive from their merchant, the system flags the transaction for review rather than silently dropping it.
- **Duplicate transaction associations**: A Mercury transaction must only be linked to one expense record. If a mapping would produce a duplicate, the system skips creation and logs the conflict.
- **Partial-month charges / pro-rated**: Subscription charges that are pro-rated or one-time do not replace the base monthly cost; they are recorded as separate expense records and flagged for admin awareness.
- **Engine failure mid-run**: If the auto-association engine fails partway through a batch, completed associations are kept; unprocessed transactions are placed in the "Needs Review" queue and retried on the next sync cycle. Admins see an error count in the sync summary.

---

## Functional Requirements

### Core Requirements

**FR-1: Subscription Merchant Mapping**
- **Description**: Admins can associate a Subscription record with one or more Mercury merchant name patterns. Once saved, every matched Mercury transaction is persisted as an individual transaction record linked to that subscription. The subscription's cost for any period is always computed dynamically from those stored transactions — no manually entered or overwritten cost value is used.
- **Acceptance Criteria**:
  - [ ] Admin can open any active Subscription and link it to a Mercury merchant via a search/select UI showing recent transaction merchants.
  - [ ] System stores the merchant-to-subscription association persistently.
  - [ ] After saving, all matched Mercury transactions (within the 90-day back-fill window) are linked to the subscription as individual transaction records.
  - [ ] The subscription's displayed cost for any period is computed by summing its linked transaction amounts for that period — not stored as a fixed value.
  - [ ] Multiple merchant name patterns can be associated with a single subscription (handles vendor name variations).
  - [ ] Removing a mapping does not delete historical transaction records already linked to the subscription.

**FR-2: Contractor Merchant Mapping**
- **Description**: Admins can associate a Contractor record with a Mercury merchant name or pattern. Once linked, Mercury transactions from that merchant automatically generate or update contractor expense records.
- **Acceptance Criteria**:
  - [ ] Admin can open any Contractor and link it to a Mercury merchant.
  - [ ] Upon saving, the system back-fills unlinked historical Mercury transactions from that merchant as `ExpenseRecord` entries for the contractor.
  - [ ] Future Mercury syncs auto-create `ExpenseRecord` entries for new matched transactions.
  - [ ] Each Mercury transaction is linked to at most one `ExpenseRecord` (no duplicates).
  - [ ] System respects existing `MerchantMappingCache` records; contractor mapping coexists with agency mapping (mutually exclusive per transaction).

**FR-3: Auto-Sync on Mercury Pull**
- **Description**: Mercury transactions are pulled on a daily scheduled basis (once per day at a configured time). Admins may also trigger a manual sync at any time. Every sync — whether scheduled or manual — triggers the auto-association engine, which applies all saved mappings and categorization rules before surfacing any unresolved transactions.
- **Acceptance Criteria**:
  - [ ] After each Mercury sync, all transactions with a saved subscription mapping are stored as individual subscription transaction records linked to that subscription; the subscription's computed cost updates automatically.
  - [ ] After each Mercury sync, all transactions with a saved contractor mapping produce or update `ExpenseRecord` entries.
  - [ ] Categorization rules (`TransactionCategorizationRule`) are applied to any transaction not covered by a direct mapping.
  - [ ] Transactions with no matching mapping or rule are surfaced in a "Needs Review" queue.
  - [ ] If the engine encounters an error mid-run, all successfully processed transactions are committed; unprocessed transactions are placed in the "Needs Review" queue for the next sync cycle — no full rollback is performed.
  - [ ] A sync summary is logged showing counts: auto-matched, rule-matched, needs review, and engine errors.

**FR-4: Cascading Cost Updates**
- **Description**: After each Mercury sync, subscription allocation costs and client ROI figures are recomputed from the updated transaction history — ensuring all downstream figures always reflect actual spending.
- **Acceptance Criteria**:
  - [ ] After new subscription transactions are linked, `SubscriptionAllocation.cost_allocated` is recomputed for all active allocations of that subscription based on the current period's transaction total.
  - [ ] `ClientROI.subscription_costs` is updated for affected clients in the current period.
  - [ ] When the computed cost for a subscription period differs from the prior period by more than a configurable threshold (default: 10%), an admin notification is surfaced.
  - [ ] Historical period transaction records are never modified retroactively; prior period costs remain as computed at that time.

**FR-7: Cost Trend Reporting (Subscriptions & Contractors)**
- **Description**: For every subscription and every direct contractor, the system surfaces month-over-month cost trend data derived from Mercury-linked transaction records, showing whether spending went up, down, or stayed flat compared to the prior period — and by how much. Both entity types present the same reporting interface and level of detail.
- **Acceptance Criteria**:
  - [ ] Each subscription displays: current month total, prior month total, absolute change (e.g., +$100), and percentage change (e.g., +20%).
  - [ ] Each contractor displays the same trend figures derived from their linked `ExpenseRecord` entries.
  - [ ] Trend direction (up / down / flat) is visually indicated alongside the figures for both subscriptions and contractors.
  - [ ] A transaction-level breakdown is accessible for both: lists every individual Mercury transaction linked to that subscription or contractor for the selected period.
  - [ ] Reporting is available at least at monthly granularity; data is recomputed after each Mercury sync.
  - [ ] Trend data is available for all periods covered by stored transaction records (up to the 90-day back-fill limit for initial data).

**FR-8: Client Revenue Receipt Association**
- **Description**: Admins can associate Mercury incoming deposits with a client as a cash receipt record. Once associated, the client view shows both the Xero-invoiced amount (accrual) and the Mercury-received amount (cash) side by side, enabling a complete invoiced-vs-received reconciliation view. Future deposits from the same originating source are suggested for the same client automatically.
- **Acceptance Criteria**:
  - [ ] Admin can view Mercury incoming deposits (credits) separately from expense transactions.
  - [ ] Admin can associate any Mercury deposit with an existing client, marking it as a cash receipt for that client.
  - [ ] After association, the system suggests the same client for future deposits from the same originating party (fuzzy name matching, same as expense side).
  - [ ] Each client's detail view displays: total Xero-invoiced amount for the period, total Mercury-received amount for the period, and the difference (outstanding balance or overpayment).
  - [ ] Mercury receipt associations do not modify or overwrite existing `RevenueRecord` entries from Xero; they are stored as separate cash receipt records linked to the client.
  - [ ] Unassociated Mercury deposits above zero value appear in the "Needs Review" queue alongside unassociated expense transactions.

**FR-5: Unresolved Transaction Review Queue**
- **Description**: A dedicated view shows all Mercury transactions that could not be automatically associated, with enough context for an admin to resolve them and optionally create a rule.
- **Acceptance Criteria**:
  - [ ] Admin can see a count of unresolved transactions in the dashboard at all times.
  - [ ] Each unresolved transaction shows: merchant name, amount, date, and suggested matches (fuzzy) if available.
  - [ ] Admin can resolve by: linking to an existing subscription, linking to an existing contractor, creating a new contractor, or assigning a general expense category.
  - [ ] After resolving, admin is offered the option to save the decision as a rule for future transactions from the same merchant.
  - [ ] Resolved transactions are removed from the queue immediately.

**FR-6: Merchant Name Pattern Matching**
- **Description**: The system supports exact and fuzzy merchant name matching so that minor variations in vendor names do not break auto-association.
- **Acceptance Criteria**:
  - [ ] Exact merchant name matches are applied first with highest confidence.
  - [ ] Fuzzy matches above a confidence threshold are applied automatically and flagged as "fuzzy-matched" in the sync log.
  - [ ] Fuzzy matches below the confidence threshold are presented in the review queue with the suggested match highlighted for admin confirmation.
  - [ ] Admin can promote a fuzzy match to an exact mapping rule with one action.

### Data Requirements

**DR-1: Subscription Merchant Mapping**
- **Description**: A new association record linking a Subscription to one or more Mercury merchant name patterns.
- **Key Attributes**: subscription_id, merchant_name_pattern, match_type (EXACT / FUZZY_KEYWORD), is_active, created_by_user_id, last_applied_at
- **Validation Rules**: At least one merchant_name_pattern must be non-empty; subscription must be active.

**DR-2: Contractor Merchant Mapping Extension**
- **Description**: Extension of the existing `MerchantMappingCache` to support subscription-level associations (contractor path already exists via `contractor_id`; subscription path is new).
- **Key Attributes**: Adds `subscription_id` field to `MerchantMappingCache`; a mapping targets exactly one of: contractor, agency, or subscription.
- **Validation Rules**: Exactly one of `contractor_id`, `agency_id`, or `subscription_id` must be set per mapping record.

**DR-3: Subscription Transaction Record**
- **Description**: An individual transaction record linking a specific Mercury transaction to a Subscription. Each matched Mercury transaction is stored here; the subscription's cost for any period is computed by summing these records.
- **Key Attributes**: subscription_id, mercury_transaction_id, amount, transaction_date, merchant_name, period_month, period_year, linked_at
- **Validation Rules**: `mercury_transaction_id` must be unique per subscription (one transaction cannot be linked to the same subscription twice); `mercury_transaction_id` must reference a known Mercury transaction.

**DR-5: Client Cash Receipt Record**
- **Description**: A record linking a specific Mercury deposit (incoming transaction) to a client as a confirmed cash receipt. Stored separately from Xero `RevenueRecord` entries; the invoiced-vs-received view is computed by comparing both sources per client per period.
- **Key Attributes**: client_id, mercury_transaction_id, amount, receipt_date, period_month, period_year, linked_at, linked_by_user_id
- **Validation Rules**: `mercury_transaction_id` must be a credit/incoming transaction (positive amount); each Mercury transaction may be linked to at most one client receipt record; `mercury_transaction_id` must be unique per client.

**DR-4: Auto-Sync Run Record**
- **Description**: Tracks each auto-association engine run: which sync triggered it, how many records were matched, updated, and flagged for review.
- **Key Attributes**: triggered_by_sync_log_id, matched_subscriptions_count, subscription_transactions_created, matched_contractors_count, needs_review_count, run_completed_at
- **Validation Rules**: Must reference a valid `MercurySyncLog` entry.

---

## Success Criteria

### Measurable Outcomes

- [ ] **Automation Rate**: 90% or more of recurring Mercury transactions are auto-associated without admin intervention after initial one-time mapping setup.
- [ ] **Data Freshness**: Subscription costs and contractor expense records are current within 24 hours via the daily scheduled sync; admins can force an immediate update via manual sync at any time.
- [ ] **Review Queue Resolution**: Admins can resolve any unrecognized transaction and save a rule in under 60 seconds.
- [ ] **Accuracy**: Auto-associated costs match Mercury transaction amounts with 100% fidelity (no rounding or estimation).
- [ ] **Cost Cascade Time**: Downstream client ROI and margin figures reflect updated subscription/contractor costs within the same sync cycle.
- [ ] **Zero Data Loss**: No Mercury transaction is silently discarded; every transaction is either auto-associated, rule-matched, or queued for review.
- [ ] **Trend Reporting**: Every subscription and every contractor with at least two months of Mercury-linked transaction data shows an accurate month-over-month cost trend with transaction-level drill-down available.
- [ ] **Revenue Reconciliation**: Every active client shows an invoiced-vs-received view (Xero accrual vs. Mercury cash) that is accurate to within one daily sync cycle.

---

## Dependencies

### External Dependencies

- **Mercury Bank API**: Source of all transaction data. Sync must be active and healthy for auto-association to function.
- **Xero**: Revenue records (invoices) continue to flow from Xero; this feature does not modify that path but relies on it for complete ROI calculations.

### Internal Dependencies

- **Mercury Sync Engine** (`MercuryConnection`, `MercurySyncLog`): Auto-association engine runs as a post-processing step after each Mercury sync job.
- **Subscription & Allocation Models** (`Subscription`, `SubscriptionAllocation`): Must be present and active for cost cascading to work.
- **Contractor Records** (`Contractor`): Must exist (or be created during review) for contractor mapping to link.
- **Merchant Mapping Cache** (`MerchantMappingCache`): Extended to support subscription mappings; contractor path already present.
- **Transaction Categorization Rules** (`TransactionCategorizationRule`): Applied as a fallback layer after direct mappings.
- **Client ROI Metrics** (`ClientROI`): Recalculated when subscription or contractor costs change.

---

## Assumptions

- Mercury is already connected and syncing transactions for the organization.
- Subscriptions and Contractors exist (or can be created on-the-fly during review) before the first mapping is saved.
- Billing frequency for subscriptions is already captured; the system derives actual cost from transaction amounts, not from billing frequency calculations.
- The threshold for "cost change notification" defaults to 10% but can be adjusted per subscription by admins.
- Back-fill of historical transactions applies only to the last 90 days to avoid performance issues; older transactions remain unlinked unless manually assigned.
- Mercury syncs run on a daily schedule at a configured time (e.g., overnight). Admins can also trigger a manual sync at any time from the dashboard. The auto-association engine runs as a post-processing step within each sync job.

---

## Out of Scope

- Automatic creation of new Subscription records from unknown merchants (admin must create the record first, then link).
- Payment forecasting or subscription renewal reminders.
- Modification of the Xero revenue sync flow (Xero invoice records are read-only within this feature; Mercury cash receipts are stored as a separate, parallel data set).
- Support for non-Mercury bank integrations in this iteration.
- Multi-currency subscription costs (USD only for this iteration).
- Editing or voiding historical Mercury transactions from within the app.

---

## Security & Privacy Considerations

- **Access Control**: Only users with Admin role can create or modify merchant mappings and categorization rules. Analyst and Executive roles can view the review queue but cannot resolve or create rules.
- **Data Integrity**: Mercury transaction IDs are stored as unique keys; duplicate association attempts are rejected, not silently overwritten.
- **Audit Trail**: All mapping creations, modifications, and admin-driven resolutions are logged with user ID and timestamp for auditability.

---

## Future Enhancements

- Confidence-based auto-promotion: fuzzy matches that are consistently confirmed by admins over time are automatically elevated to exact matches.
- Subscription renewal detection: notify admins when an annual subscription charge appears so they can review seat/allocation changes.
- Multi-merchant aggregation: allow a single subscription cost to be derived from multiple merchant sources (e.g., base platform + add-on billed separately).
