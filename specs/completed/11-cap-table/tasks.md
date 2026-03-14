# Tasks: Cap Table MVP

**Created**: 2026-03-03
**Feature**: [spec.md](spec.md)
**Plan**: [plan.md](plan.md)
**Branch**: `11-cap-table`

---

## User Story Map

| Story | Scenario | Functional Reqs | Priority |
|-------|----------|-----------------|----------|
| US1 | Scenario 1: Admin Sets Up the Cap Table | FR-1 (Stakeholder Management), FR-2 (Share Class Configuration) | P1 |
| US2 | Scenario 2: Owner Views Their Equity Position | FR-3 (Ownership Summary View) | P1 |
| US3 | Scenario 4: Admin Updates Ownership After Equity Event | FR-4 (Transaction History) | P1 |
| US4 | Scenario 3: Admin Shares Cap Table with Investor | FR-5 (Investor-Ready Sharing) | P2 |
| US5 | Edge Case: Historical View | FR-6 (Point-in-Time View) | P2 |

---

## Phase 1: Setup

- [x] T001 Verify database connection with `npx prisma migrate status`
- [x] T002 Add `EquityTransactionType` enum (GRANT, TRANSFER, PURCHASE, CANCELLATION) to `prisma/schema.prisma` per data-model.md
- [x] T003 Add `CapTableStakeholder` model to `prisma/schema.prisma` per data-model.md (UUID PK, organization_id, name, email, role_title, deleted_at, timestamps, unique constraint on org+email, index on organization_id)
- [x] T004 Add `ShareClass` model to `prisma/schema.prisma` per data-model.md (UUID PK, organization_id, name, authorized_shares, reserved_shares, price_per_share Decimal(12,4), deleted_at nullable, timestamps, unique constraint on org+name, index on organization_id)
- [x] T005 Add `EquityHolding` model to `prisma/schema.prisma` per data-model.md (UUID PK, stakeholder_id, share_class_id, shares_held, timestamps, unique constraint on stakeholder+share_class, indexes on both FKs)
- [x] T006 Add `EquityTransaction` model to `prisma/schema.prisma` per data-model.md (UUID PK, organization_id, transaction_type, transaction_date Date, share_class_id, from/to_stakeholder_id nullable, shares_affected, price_per_share Decimal(12,4), notes Text, created_by, created_at only — NO updated_at, indexes per data-model.md)
- [x] T007 Add cap table relations to existing `Organization` model in `prisma/schema.prisma`: `cap_table_stakeholders CapTableStakeholder[]`, `share_classes ShareClass[]`, `equity_transactions EquityTransaction[]`
- [x] T008 Run `npx prisma migrate dev --name add_cap_table` and `npx prisma generate`
- [x] T009 Verify migration with `npx prisma migrate status` — all migrations applied

---

## Phase 2: Foundational

- [x] T010 Create RLS policies in `supabase/sql/011_cap_table_rls_policies.sql` — enable RLS on all 4 tables, add SELECT/INSERT/UPDATE/DELETE policies using `get_user_organization_id()` for cap_table_stakeholders, cap_table_share_classes, cap_table_equity_transactions; EquityHolding policy via subquery on stakeholder's organization_id
- [x] T011 [P] Create Zod validation schemas in `lib/validations/cap-table.ts` per contracts/server-actions.md: `createShareClassSchema`, `updateShareClassSchema`, `createStakeholderSchema`, `updateStakeholderSchema`, `removeStakeholderSchema`, `recordTransactionSchema` (with superRefine for type-specific stakeholder requirements), `generateShareLinkSchema`, `asOfDateSchema`. Export inferred types.
- [x] T012 [P] Create ownership calculation functions in `lib/calculations/cap-table.ts`: `calculateOwnershipPercentages(holdings, totalIssued)` returning percentages to 4 decimal places, `replayTransactionsAsOfDate(transactions, date)` reconstructing holdings from transaction ledger, `validateShareAvailability(shareClassId, sharesRequested, orgId)` checking available shares
- [x] T013 [P] Create HMAC share token functions in `lib/cap-table/share-token.ts`: `generateShareToken(orgId, expiresInDays)` using crypto.createHmac('sha256', CAP_TABLE_SHARE_SECRET) with base64url encoding, `validateShareToken(token)` with constant-time comparison returning orgId or throwing, following pattern from `app/api/webhooks/xero/route.ts`
- [x] T014 [P] Add "Cap Table" navigation item to sidebar in `components/dashboard/Sidebar.tsx` under the Insights group after Projects, with route `/dashboard/cap-table` and PieChart icon

---

## Phase 3: Cap Table Setup [US1]

> **Story Goal**: Admin can create share classes and add stakeholders to initialize the cap table.
> **Test Criteria**: Create a "Common" share class with 10,000 authorized shares → add 3 stakeholders with names, roles, emails → verify share class displays correctly → edit a stakeholder's role → verify email uniqueness enforced.

- [x] T015 [US1] Implement `createShareClass` server action in `app/actions/cap-table.ts` — validate with createShareClassSchema, getOrganizationId, check name uniqueness (case-insensitive) within org, create ShareClass, revalidatePath('/dashboard/cap-table')
- [x] T016 [US1] Implement `updateShareClass` server action in `app/actions/cap-table.ts` — validate with updateShareClassSchema, verify class belongs to org, validate authorized >= issued + reserved if changed, check name uniqueness if changed, update record, revalidatePath
- [x] T017 [US1] Implement `createStakeholder` server action in `app/actions/cap-table.ts` — validate with createStakeholderSchema, getOrganizationId, check email uniqueness within org if provided, create CapTableStakeholder, revalidatePath
- [x] T018 [US1] Implement `updateStakeholder` server action in `app/actions/cap-table.ts` — validate with updateStakeholderSchema, verify stakeholder belongs to org (and not deleted), check email uniqueness if changed, update record, revalidatePath
- [x] T019 [US1] Implement `removeStakeholder` server action in `app/actions/cap-table.ts` — validate with removeStakeholderSchema, verify stakeholder belongs to org, check no EquityHolding with shares_held > 0 (throw "Stakeholder still holds shares. Record a Cancellation transaction first."), soft delete with deleted_at, revalidatePath
- [x] T020 [US1] Implement `getCapTableSummary` server action in `app/actions/cap-table.ts` — getOrganizationId, query non-deleted ShareClass records (deleted_at IS NULL), query non-deleted CapTableStakeholder with holdings and share_class, compute issued_shares/available_shares per class, compute ownership percentages per stakeholder (4 decimal places), compute totals, serialize all Decimal fields to Number()
- [x] T021 [P] [US1] Create `ShareClassConfig` component in `components/cap-table/ShareClassConfig.tsx` — shadcn/ui Card with share class summary (name, authorized, issued, reserved, available), inline create form, edit dialog, uses createShareClass/updateShareClass actions, toast feedback
- [x] T022 [P] [US1] Create `AddStakeholderModal` component in `components/cap-table/AddStakeholderModal.tsx` — shadcn/ui Dialog with form: name (required), email (optional), role_title (optional). Reusable for both create and edit (accepts optional stakeholder prop). Uses createStakeholder/updateStakeholder actions, toast feedback

---

## Phase 4: Ownership Summary View [US2]

> **Story Goal**: Owners and admins can view a clear summary of all stakeholders with ownership percentages and a visual chart.
> **Test Criteria**: After granting shares to 3 stakeholders → ownership table shows names, roles, shares, percentages → percentages sum to 100% → donut chart renders correct proportions → totals row shows aggregate → reserved shares appear as separate display item.

- [x] T023 [US2] Create `OwnershipTable` component in `components/cap-table/OwnershipTable.tsx` — shadcn/ui Table showing stakeholder name, role_title, share class, shares held, ownership percentage (4 decimal places), totals row, reserved/unallocated shares as separate summary line. Edit/remove action buttons per row. Empty state when no stakeholders
- [x] T024 [P] [US2] Create `OwnershipChart` component in `components/cap-table/OwnershipChart.tsx` — Recharts PieChart donut pattern (following `components/analytics/CostBreakdownChart.tsx`), showing ownership distribution per stakeholder with percentage labels, custom center text showing total issued shares, custom tooltip with name + shares + percentage
- [x] T025 [US2] Create main cap table page in `app/dashboard/cap-table/page.tsx` — server component calling getCapTableSummary, layout: top row = ShareClassConfig cards, middle = OwnershipTable (left) + OwnershipChart (right) in responsive grid, action buttons for Add Stakeholder + Record Transaction + Share. Require requireAuth() with Admin or Executive role check

---

## Phase 5: Transaction History [US3]

> **Story Goal**: Admin can record equity transactions (Grant, Transfer, Purchase, Cancellation) and view a chronological ledger of all changes.
> **Test Criteria**: Record a GRANT of 3,000 shares to stakeholder A → verify holding updated → record a TRANSFER of 500 shares from A to B → verify both holdings updated → view transaction ledger shows both entries with correct details → attempt granting more than available shares fails with error.

- [x] T026 [US3] Implement `recordEquityTransaction` server action in `app/actions/cap-table.ts` — validate with recordTransactionSchema, getOrganizationId + userId for created_by, wrap in Prisma $transaction: verify share_class belongs to org, verify stakeholder IDs belong to org, validate share availability (GRANT/PURCHASE: available >= affected; TRANSFER/CANCELLATION: from_stakeholder holding >= affected), create EquityTransaction, upsert EquityHolding records per transaction semantics in data-model.md, revalidatePath
- [x] T027 [US3] Implement `getTransactionHistory` server action in `app/actions/cap-table.ts` — getOrganizationId, query EquityTransaction ordered by transaction_date DESC + created_at DESC, include from_stakeholder, to_stakeholder, share_class relations, serialize Decimal fields
- [x] T028 [P] [US3] Create `RecordTransactionModal` component in `components/cap-table/RecordTransactionModal.tsx` — shadcn/ui Dialog with form: transaction_type (Select: Grant/Transfer/Purchase/Cancellation), transaction_date (DatePicker), share_class_id (Select from available classes), conditional from/to stakeholder Selects based on type, shares_affected (number input), price_per_share (optional number), notes (textarea). Uses recordEquityTransaction action, toast feedback, validation error display
- [x] T029 [US3] Create `TransactionLedger` component in `components/cap-table/TransactionLedger.tsx` — shadcn/ui Table showing transaction_date, type (badge), share class, from → to stakeholders, shares affected, price per share, notes. Chronological descending order. Empty state when no transactions
- [x] T030 [US3] Update `app/dashboard/cap-table/page.tsx` — add TransactionLedger section below ownership view, call getTransactionHistory, wire up RecordTransactionModal to action button

---

## Phase 6: Investor-Ready Sharing [US4]

> **Story Goal**: Admin can generate a time-limited shareable link and export the cap table as PDF for investor meetings.
> **Test Criteria**: Generate share link with 30-day default → open link in incognito browser → see read-only cap table with company name, ownership table, pie chart → expired/invalid token shows error page → Print/Save as PDF produces clean single-page output.

- [x] T031 [US4] Implement `generateShareLink` server action in `app/actions/cap-table.ts` — validate with generateShareLinkSchema, getOrganizationId, call generateShareToken from lib/cap-table/share-token.ts, construct full URL using NEXT_PUBLIC_APP_URL + /share/cap-table/ + token, return { url, expires_at }
- [x] T032 [US4] Create public share API route in `app/api/share/cap-table/[token]/route.ts` — GET handler: extract token, call validateShareToken (return 401 if invalid, 410 if expired), query cap table data using Prisma with explicit organization_id filter from token (no session), return same shape as getCapTableSummary. Include org name in response
- [x] T033 [US4] Add `/share/cap-table` to public routes list in `middleware.ts` — add to the existing pathname check so share pages bypass auth redirect
- [x] T034 [US4] Create public shared view page in `app/share/cap-table/[token]/page.tsx` — server component: fetch from share API route, render clean branded layout with org name + "Cap Table" heading + current date, OwnershipTable (read-only, no action buttons), OwnershipChart, share class summary. Show error state for invalid/expired tokens. Include "Print / Save as PDF" client button calling window.print()
- [x] T035 [US4] Add `@media print` styles to `app/globals.css` — hide all navigation, sidebar, buttons, interactive elements; full-width table layout; optimize font sizes and margins; ensure Recharts SVG chart renders; page title visible
- [x] T036 [P] [US4] Create `ShareLinkDialog` component in `components/cap-table/ShareLinkDialog.tsx` — shadcn/ui Dialog: expiration days input (default 30, range 1-365), generate button calling generateShareLink action, display generated URL with copy-to-clipboard button, show expiration date
- [x] T037 [US4] Update `app/dashboard/cap-table/page.tsx` — wire ShareLinkDialog to Share/Export action button

---

## Phase 7: Point-in-Time View [US5]

> **Story Goal**: Users can view the cap table as it existed on any historical date by replaying the transaction ledger.
> **Test Criteria**: Record transactions on Jan 1, Feb 1, Mar 1 → select Feb 15 → see cap table reflecting only Jan + Feb transactions → select Jan 1 → see only Jan transaction → select future date → see current state.

- [x] T038 [US5] Implement `getCapTableAsOfDate` server action in `app/actions/cap-table.ts` — validate with asOfDateSchema, getOrganizationId, query EquityTransaction where transaction_date <= date ordered ASC, call replayTransactionsAsOfDate from lib/calculations/cap-table.ts, return same shape as getCapTableSummary with historical holdings
- [x] T039 [US5] Create `PointInTimeSelector` component in `components/cap-table/PointInTimeSelector.tsx` — shadcn/ui DatePicker + "View as of" button, calls getCapTableAsOfDate, updates parent state with historical data. "Reset to current" button to restore live view
- [x] T040 [US5] Update `app/dashboard/cap-table/page.tsx` — add PointInTimeSelector to page header area, when historical date selected: replace OwnershipTable and OwnershipChart data with historical results, show "Viewing as of [date]" banner, disable mutation buttons (Add Stakeholder, Record Transaction)

---

## Phase 8: Polish & Cross-Cutting Concerns

- [x] T041 Handle edge case: empty cap table state — show onboarding guidance in `app/dashboard/cap-table/page.tsx` ("Create a share class to get started" when no share classes, "Add stakeholders to populate the cap table" when no stakeholders)
- [x] T042 Handle edge case: ownership percentages when zero total issued shares — display 0.0000% for all, no division-by-zero in `lib/calculations/cap-table.ts`
- [x] T043 Handle edge case: `CAP_TABLE_SHARE_SECRET` not set — `generateShareLink` throws clear error message "Sharing is not configured. Set CAP_TABLE_SHARE_SECRET environment variable.", share button disabled in UI when env missing
- [x] T044 Verify Decimal → number serialization for all cap table server actions returning Prisma Decimal fields (price_per_share, ownership percentages)
- [x] T045 Ensure shared view page (`app/share/cap-table/[token]/page.tsx`) renders correctly without auth context — no calls to requireAuth or getOrganizationId in the public page
- [x] T046 Add rate limiting to the public share API route `app/api/share/cap-table/[token]/route.ts` — implement simple in-memory rate limiter (e.g., Map-based sliding window, 60 requests/min per IP) to prevent brute-force token guessing per constitution requirement for public endpoints
- [x] T047 Run `npm run build` to verify no TypeScript errors and clean production build

---

## Dependencies

```
Phase 1 (Setup)
  └─→ Phase 2 (Foundational)
        ├─→ Phase 3 (US1: Cap Table Setup)
        │     └─→ Phase 4 (US2: Ownership View)
        │           └─→ Phase 5 (US3: Transactions)
        │                 ├─→ Phase 6 (US4: Sharing)
        │                 └─→ Phase 7 (US5: Point-in-Time)
        └─→ Phase 8 (Polish) — after all US phases complete
```

**Story Dependencies**:
- US1 (Cap Table Setup) is independent — MVP
- US2 (Ownership View) depends on US1 (needs stakeholders and share classes to display)
- US3 (Transactions) depends on US2 (needs summary view to see transaction effects)
- US4 (Sharing) depends on US3 (needs complete cap table with transactions)
- US5 (Point-in-Time) depends on US3 (needs transaction ledger to replay)

---

## Parallel Execution Opportunities

**Within Phase 2** (Foundational):
- T011 (validation schemas), T012 (calculations), T013 (share token), T014 (sidebar) are all independent files

**Within Phase 3** (US1):
- T021 (ShareClassConfig) and T022 (AddStakeholderModal) can be built in parallel with T015-T020 (server actions)

**Within Phase 4** (US2):
- T024 (OwnershipChart) can be built in parallel with T023 (OwnershipTable)

**Within Phase 5** (US3):
- T028 (RecordTransactionModal) can be built in parallel with T026-T027 (server actions)

**Within Phase 6** (US4):
- T036 (ShareLinkDialog) can be built in parallel with T031-T035

---

## Implementation Strategy

**MVP Scope**: Phases 1-3 (US1: Cap Table Setup)
- Delivers: share class creation, stakeholder CRUD, basic summary query
- Validates: schema, migrations, server actions, page routing

**Increment 2**: Phase 4 (US2: Ownership View)
- Delivers: full ownership visualization with table and donut chart
- Validates: percentage calculations, chart rendering, responsive layout

**Increment 3**: Phase 5 (US3: Transactions)
- Delivers: equity transaction recording with atomic holding updates
- Validates: transaction ledger, Prisma $transaction atomicity, share limit enforcement

**Increment 4**: Phase 6 (US4: Sharing)
- Delivers: shareable links, public view, print-to-PDF
- Validates: HMAC token signing/validation, public route, print CSS

**Increment 5**: Phase 7 (US5: Point-in-Time)
- Delivers: historical cap table view via transaction replay
- Validates: replay algorithm correctness, UI state management

**Final**: Phase 8 (Polish)
- Delivers: production readiness
- Validates: edge cases, empty states, build success
