# Tasks: Service Contracts & Billing Models

**Created**: 2026-02-28
**Feature**: [spec.md](spec.md)
**Plan**: [plan.md](plan.md)

---

## User Story Mapping

| Story | Spec Scenario | Description | Priority |
|-------|--------------|-------------|----------|
| US1 | Scenario 1, FR-1, FR-2 | Assign a contract-based service with defined terms | P1 |
| US2 | Scenario 2, FR-3 | Assign a one-time project service | P1 |
| US3 | Scenario 3, FR-4 | Assign an ongoing retainer service | P1 |
| US4 | Scenario 4, FR-5, FR-6 | View anticipated vs actual revenue with variance | P1 |
| US5 | Scenario 5, FR-8, FR-9 | Transition between contracts with overlap prevention | P2 |
| US6 | FR-7 | Service coverage using contract terms | P2 |
| US7 | FR-10 | Migration of existing data to contract model | P3 |

---

## Phase 1: Setup

- [x] T001 Verify database connection with `npx prisma migrate status`
- [x] T002 Add `BillingModel` enum (CONTRACT, PROJECT, RETAINER) to `prisma/schema.prisma`
- [x] T003 Add `ContractStatus` enum (ACTIVE, COMPLETED, TERMINATED) to `prisma/schema.prisma`
- [x] T004 Add `ServiceContract` model with all fields, indexes, and map to `service_contracts` table in `prisma/schema.prisma` per data-model.md
- [x] T005 Add `service_contracts ServiceContract[]` relation to Client, Service, and Organization models in `prisma/schema.prisma`
- [x] T006 Run `npx prisma migrate dev --name add-service-contracts` and `npx prisma generate`
- [x] T007 Verify migration applied: `npx prisma migrate status` and `npm run build` passes

---

## Phase 2: Foundational (Validation Schemas + Core Calculations)

- [x] T008 [P] Add `createServiceContractSchema` with superRefine for billing-model-specific validation to `lib/validations/service.ts` — CONTRACT requires end_month/end_year + monthly_rate >= 0; PROJECT requires project_fee > 0; RETAINER requires monthly_rate > 0; end date must be >= start date
- [x] T009 [P] Add `updateServiceContractSchema` (contract_id + optional end_month/end_year/notes — NO rate fields) to `lib/validations/service.ts`. Rate changes require terminate + create new contract to preserve audit history
- [x] T010 [P] Add `terminateServiceContractSchema` (contract_id + end_month + end_year) to `lib/validations/service.ts`
- [x] T011 [P] Create `getExpectedRevenueForPeriod(clientId, month, year)` in `lib/calculations/expected-revenue.ts` — query ServiceContract records (ACTIVE + COMPLETED), resolve per billing model (CONTRACT: monthly_rate within start-end range; PROJECT: project_fee in billing period; RETAINER: monthly_rate from start through current month or end date), fall back to ServiceRateHistory if no contracts exist for that client-service pair in the period
- [x] T012 [P] Create `getExpectedRevenueAllPeriods(clientId, organizationId)` in `lib/calculations/expected-revenue.ts` — get all available periods from ROI records + allocations + contracts, call getExpectedRevenueForPeriod for each, return per-period breakdown
- [x] T013 [P] Create `checkContractOverlap(clientId, serviceId, startMonth, startYear, endMonth, endYear, excludeContractId?)` in `lib/calculations/expected-revenue.ts` — query ACTIVE contracts for same client-service pair, check date range intersection, return overlap boolean + conflicting contract details

---

## Phase 3: US1/US2/US3 — Contract CRUD Server Actions

**Goal**: Enable creating, reading, updating, and terminating service contracts for all three billing models.

**Test criteria**: Can create CONTRACT with start/end/rate, PROJECT with fee/period, RETAINER with start/rate. Can list, update (end date/notes only), and terminate contracts. Overlap prevention works.

- [x] T014 Implement `createServiceContract` server action in `app/actions/service-management.ts` — validate input with createServiceContractSchema, verify client + service belong to org, call checkContractOverlap, auto-calculate term_months for CONTRACT, create ServiceContract record (if end_month/end_year is before current month, set status=COMPLETED instead of ACTIVE), ensure ClientService exists (create if missing with custom_rate = monthly_rate), revalidate client detail path
- [x] T015 Implement `getClientContracts` server action in `app/actions/service-management.ts` — accept client_id + optional service_id and status filters, query with org isolation, return contracts with service name and calculated total_value (monthly_rate * term_months)
- [x] T016 Implement `updateServiceContract` server action in `app/actions/service-management.ts` — validate with updateServiceContractSchema, verify ACTIVE status, allow changes to end_month/end_year/notes only (rate changes require terminate + create new), recalculate term_months if end date changed, re-check overlap if date range expanded, update record, revalidate
- [x] T017 Implement `terminateServiceContract` server action in `app/actions/service-management.ts` — validate with terminateServiceContractSchema, verify ACTIVE status + org ownership, set end_month/end_year + status=TERMINATED, recalculate term_months, revalidate

---

## Phase 4: US1/US2/US3/US5 — Contract Assignment UI

**Goal**: Users can assign services with billing model selection and contract terms, view contracts, and manage transitions (terminate + create new) through the UI.

**Test criteria**: AssignServicesModal shows billing model selection with conditional fields per type. Contracts appear in the services table with status badges. Overlap errors shown when conflicting contract exists. End Contract dialog with month/year picker works.

- [x] T018 Create `ContractFormFields` component in `components/clients/ContractFormFields.tsx` — billing model radio group (Contract/Project/Retainer), conditional fields: CONTRACT shows start month/year + end month/year with bidirectional sync to term length + monthly rate + auto-calculated total value; PROJECT shows billing period month/year + project fee; RETAINER shows start month/year + monthly rate. Use shadcn/ui Select, Input, RadioGroup components
- [x] T019 Modify `components/clients/AssignServicesModal.tsx` — after service selection, render ContractFormFields; on save, call `createServiceContract` server action instead of `assignServiceToClient`; display overlap error from server response as destructive toast with conflicting contract's service name and date range, suggest ending existing contract first; show total contract value for CONTRACT type
- [x] T020 Modify `components/clients/ClientServicesTable.tsx` — for each service, fetch and display active contracts using `getClientContracts`; show billing model badge (Contract/Project/Retainer), rate, period range, status badge; add "End Contract" button opening AlertDialog with month/year picker for termination date (default: current month), on confirm call `terminateServiceContract`, show success toast and refresh; show collapsed section for historical (COMPLETED/TERMINATED) contracts with dimmed styling

---

## Phase 5: US4 — Expected Revenue & Variance Display

**Goal**: Financial summary shows expected revenue from contract terms alongside actual revenue, with variance calculation.

**Test criteria**: Financial summary API returns expectedRevenue, variance, variancePercentage. UI shows expected revenue card and color-coded variance indicator.

- [x] T021 Modify `app/api/clients/[id]/financial-summary/route.ts` — import getExpectedRevenueForPeriod and getExpectedRevenueAllPeriods from expected-revenue.ts; for mode=month, call getExpectedRevenueForPeriod for selected period; for mode=all, call getExpectedRevenueAllPeriods and aggregate totals; add expectedRevenue, variance (actual - expected), variancePercentage to response; add expectedRevenueByPeriod array for all-time mode
- [x] T022 Modify `components/clients/ClientFinancialSummary.tsx` — add "Expected Revenue" metric card between Revenue and Total Costs cards; add variance indicator below expected revenue: green text for positive variance (overpayment), red text for negative variance (underpayment), display both dollar amount and percentage; update TypeScript interfaces for new API response fields

---

## Phase 6: US6 — Service Coverage Using Contract Terms

**Goal**: Service coverage calculation uses contract-defined expected costs instead of rate-history-based resolution.

**Test criteria**: Coverage walk uses contract monthly_rate for periods with active contracts, falls back to rate history for older periods. Gap months between contracts show $0 expected cost.

- [x] T023 Modify `getServiceCoverage()` in `lib/calculations/service-coverage.ts` — query all ServiceContract records (ACTIVE + COMPLETED) for the client's services; in `getServiceCostForPeriod(m, y)`, check if any ServiceContract covers this period first (CONTRACT: monthly_rate within start-end range; PROJECT: project_fee in billing period; RETAINER: monthly_rate from start through min(current month, end date)); if contract found, use contract rate; if not, fall back to existing ServiceRateHistory resolution (unchanged)
- [x] T024 Update `monthlyServiceCost` calculation in `lib/calculations/service-coverage.ts` — use active contract rates for current month instead of current custom_rate; fall back to custom_rate/standard_rate only if no active contract exists for that service

---

## Phase 7: US7 — Data Migration

**Goal**: All existing ClientService records are migrated to ServiceContract records without data loss or calculation disruption.

**Test criteria**: Every ClientService has a corresponding ServiceContract. Expected revenue matches pre-migration rate history. Service coverage produces identical results.

- [x] T025 Create data migration script in `scripts/migrate-client-services-to-contracts.ts` — for each ClientService record: get client.start_date for start_month/start_year; use custom_rate if set, else service.standard_rate; create ServiceContract with billing_model=RETAINER, status=ACTIVE (or COMPLETED if client status is CHURNED/INACTIVE), monthly_rate=resolved rate, no end date; preserve all ServiceRateHistory entries unchanged
- [x] T026 Run migration on development database and verify: every active ClientService has a corresponding ACTIVE RETAINER contract; financial summary expected revenue matches rate history values; service coverage produces same results; no build or runtime errors

---

## Phase 8: Polish & Cross-Cutting

- [x] T027 Verify `npm run build` passes with all changes — fix any TypeScript compilation errors
- [x] T028 Verify all server actions have proper organization_id isolation — no cross-tenant data leakage in createServiceContract, updateServiceContract, terminateServiceContract, getClientContracts
- [x] T029 End-to-end verification: navigate to a client detail page → assign a service with CONTRACT billing model → verify contract appears in services table → check financial summary shows expected revenue and variance → terminate contract → verify coverage updates immediately

---

## Dependencies

```
T001-T007 (Schema)
    └──> T008-T013 (Validation + Calculations) [parallelizable]
              └──> T014-T017 (Server Actions)
                        ├──> T018-T020 (Assignment UI + Overlap/Terminate UX)
                        ├──> T021-T022 (Variance Display)
                        └──> T023-T024 (Service Coverage)
                                  └──> T025-T026 (Data Migration)
                                            └──> T027-T029 (Polish)
```

### Parallel Execution Opportunities

| Group | Tasks | Why Parallel |
|-------|-------|-------------|
| Validation schemas | T008, T009, T010 | Independent schemas in same file, no interdependencies |
| Core calculations | T011, T012, T013 | Independent functions in same file, no interdependencies |
| UI + API + Coverage | T018-T020, T021-T022, T023-T024 | Different files, all depend only on server actions (T014-T017) |

---

## Implementation Strategy

**MVP (Phase 1-4)**: Schema + Validation + Server Actions + Assignment UI = users can create and manage contracts for all three billing models with overlap prevention and contract termination. This is the minimum viable increment.

**Increment 2 (Phase 5)**: Expected revenue + variance display = users can see anticipated vs actual revenue comparison.

**Increment 3 (Phase 6)**: Service coverage enhancement = system uses contracts for coverage calculations.

**Increment 4 (Phase 7-8)**: Data migration + verification = existing data migrated, full feature complete.

---

## Summary

| Metric | Value |
|--------|-------|
| Total tasks | 29 |
| Setup tasks | 7 |
| Foundational tasks | 6 |
| US1/US2/US3/US5 tasks (CRUD + UI) | 7 |
| US4 tasks (Variance) | 2 |
| US6 tasks (Coverage) | 2 |
| US7 tasks (Migration) | 2 |
| Polish tasks | 3 |
| Parallel opportunities | 3 groups (12 tasks parallelizable) |

---

## Analysis Fixes Applied

- **D1/D2/D3**: Merged T023→T019 (overlap error), T024→T020 (End Contract dialog), removed redundant Phase 6
- **I1**: T009 and T016 now restrict updates to end_date/notes only — rate changes require terminate + create new (per spec assumption)
- **C1**: T014 now sets status=COMPLETED when end date is in the past at creation time
- **C2**: Status derived from ACTIVE/COMPLETED/TERMINATED stored field — COMPLETED set at creation (C1) or by explicit user action; no periodic job needed
- **I3**: Data migration (T025-T026) depends on server actions (T014-T017), not service coverage
- **U2**: T018 explicitly describes bidirectional sync between end_date and term_months
- Renumbered T025-T031 → T023-T029 after Phase 6 removal
