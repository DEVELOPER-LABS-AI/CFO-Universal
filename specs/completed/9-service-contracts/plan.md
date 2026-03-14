# Implementation Plan: Service Contracts & Billing Models

**Created**: 2026-02-28
**Feature**: [spec.md](spec.md)
**Research**: [research.md](research.md)
**Data Model**: [data-model.md](data-model.md)
**Contracts**: [contracts/](contracts/)
**Quickstart**: [quickstart.md](quickstart.md)

---

## Technical Context

### Existing Architecture

| Component | Current State | Impact |
|-----------|--------------|--------|
| **Prisma Schema** | Service, ClientService (composite PK), ServiceRateHistory models exist | Extend with ServiceContract model + 2 new enums |
| **Service Coverage** | `getServiceCoverage()` walks month-by-month using `getServiceCostForPeriod()` which resolves rates from ServiceRateHistory | Modify to check ServiceContract first, fall back to rate history |
| **Financial Summary** | Returns revenue (from deposits), costs (from ROI), no expected revenue | Add expectedRevenue, variance, variancePercentage fields |
| **Server Actions** | `service-management.ts` has assignServiceToClient, updateClientServiceRate, rate history CRUD | Add contract CRUD actions (create, update, terminate, list) |
| **Validation** | `lib/validations/service.ts` has Zod schemas for services and rate history | Add contract schemas with superRefine for conditional validation |
| **UI - Assignment** | `AssignServicesModal` selects service + optional custom_rate | Add billing model selection + conditional term fields |
| **UI - Services Table** | `ClientServicesTable` shows inline-editable rate + rate history dialog | Add contract list, manage, terminate actions |
| **UI - Financial Summary** | `ClientFinancialSummary` shows revenue, costs, profit, cost breakdown | Add expected revenue card, variance indicator |

### Dependencies

| Dependency | Status | Risk |
|------------|--------|------|
| Prisma schema migration | Ready | Low — additive changes only |
| Service coverage calculation | Working | Medium — core algorithm change |
| Financial summary API | Working | Low — additive response fields |
| Refresh ROI (0/8 failure) | **BROKEN** | **Blocker for verification** — must be fixed separately |
| PaymentAllocation system | Working | None — no changes needed |

### Unknowns Resolved

All unknowns resolved in [research.md](research.md):
- R-1: ServiceContract as separate entity (not embedded in ClientService)
- R-2: New BillingModel enum (distinct from RelationshipType and billing_type)
- R-3: ContractStatus with ACTIVE/COMPLETED/TERMINATED transitions
- R-4: Per-service migration date (earliest contract start), not global cutover
- R-5: Application-level overlap prevention via Prisma query
- R-6: Expected revenue as new utility in lib/calculations/expected-revenue.ts
- R-7: Data migration creates RETAINER contracts from existing ClientService records
- R-8: Extend AssignServicesModal + ContractFormFields component

---

## Constitution Check

| Principle | Compliance | Notes |
|-----------|-----------|-------|
| 1. Technology Stack | PASS | Next.js Server Actions, Prisma, shadcn/ui |
| 2. Data Architecture | PASS | organization_id on ServiceContract, no cross-org queries |
| 3. Integration Philosophy | N/A | No external system changes |
| 4. Security Requirements | PASS | RLS via organization_id, no sensitive data exposure |
| 5. Performance Standards | PASS | Indexed queries, no N+1 patterns |
| 6. Code Quality | PASS | TypeScript strict, Zod validation, Prisma types |
| 7. Development Workflow | PASS | Feature branch 9-service-contracts, spec-driven |
| 8. Prisma-Supabase | PASS | Pooler URLs, migrate dev workflow, generate after changes |

### Constitution Gates

- [x] Multi-tenant isolation (organization_id on new entity)
- [x] UUID primary keys
- [x] created_at/updated_at timestamps
- [x] Prisma-managed schema (no raw SQL)
- [x] Server Actions for mutations
- [x] Zod validation on all inputs
- [x] Indexed foreign keys

**Deviation**: ServiceContract uses `status` field instead of `deleted_at` for lifecycle. Contracts are historical records that should never be deleted — status tracks lifecycle (ACTIVE → COMPLETED/TERMINATED). This is intentional and preserves audit history per spec requirement.

---

## Implementation Phases

### Phase 1: Schema & Migration (Foundation)

**Goal**: Create the ServiceContract table and enums in the database.

**Files**:
| File | Action |
|------|--------|
| `prisma/schema.prisma` | ADD BillingModel enum, ContractStatus enum, ServiceContract model, relations on Client/Service/Organization |

**Steps**:
1. Verify DB connection: `npx prisma migrate status`
2. Add enums: `BillingModel` (CONTRACT, PROJECT, RETAINER), `ContractStatus` (ACTIVE, COMPLETED, TERMINATED)
3. Add `ServiceContract` model per [data-model.md](data-model.md)
4. Add `service_contracts ServiceContract[]` relation to Client, Service, Organization models
5. Run: `npx prisma migrate dev --name add-service-contracts`
6. Run: `npx prisma generate`
7. Verify: `npx prisma migrate status`

**Acceptance**: Table created, Prisma Client generated, build passes.

---

### Phase 2: Expected Revenue Calculation (Core Logic)

**Goal**: Build the calculation engine that determines expected revenue from contract terms.

**Files**:
| File | Action |
|------|--------|
| `lib/calculations/expected-revenue.ts` | NEW — expected revenue calculation functions |

**Key functions**:
- `getExpectedRevenueForPeriod(clientId, month, year)`:
  - Query ACTIVE/COMPLETED ServiceContract records for client
  - For each contract: check if period falls within contract range
  - CONTRACT: monthly_rate if start <= period <= end
  - PROJECT: project_fee if period matches start_month/start_year
  - RETAINER: monthly_rate if period >= start and period <= min(current month, end date)
  - Sum all applicable rates
  - If no contracts found for any service in this period, fall back to ServiceRateHistory
- `getExpectedRevenueAllPeriods(clientId, organizationId)`:
  - Get all available periods (from ROI records + allocations + contracts)
  - Call `getExpectedRevenueForPeriod` for each
- `checkContractOverlap(clientId, serviceId, startMonth, startYear, endMonth, endYear, excludeContractId?)`:
  - Query ACTIVE contracts for same client-service pair
  - Check date range intersection
  - Return overlap boolean + conflicting contract details

**Acceptance**: Unit-testable functions that correctly resolve expected revenue for all billing model types.

---

### Phase 3: Server Actions (CRUD)

**Goal**: Implement contract CRUD operations as server actions.

**Files**:
| File | Action |
|------|--------|
| `lib/validations/service.ts` | EXTEND — add createServiceContractSchema, updateServiceContractSchema, terminateServiceContractSchema |
| `app/actions/service-management.ts` | EXTEND — add createServiceContract, updateServiceContract, terminateServiceContract, getClientContracts |

**Validation schemas** per [contracts/server-actions.md](contracts/server-actions.md):
- `createServiceContractSchema`: base fields + superRefine for billing-model-specific validation
- `updateServiceContractSchema`: contract_id + optional fields
- `terminateServiceContractSchema`: contract_id + end date

**Server actions**:
- `createServiceContract`: validate → check org ownership → check overlap → auto-calc term_months → create record → ensure ClientService exists → revalidate
- `updateServiceContract`: validate → check ACTIVE status → check new overlaps if dates changed → update → revalidate
- `terminateServiceContract`: validate → set status=TERMINATED + end date → revalidate
- `getClientContracts`: validate → query with optional filters → return with calculated total_value

**Acceptance**: All CRUD operations work with proper validation, org isolation, and overlap prevention.

---

### Phase 4: Service Coverage Enhancement

**Goal**: Replace rate-history-based cost resolution with contract-based resolution.

**Files**:
| File | Action |
|------|--------|
| `lib/calculations/service-coverage.ts` | MODIFY — use contracts in getServiceCostForPeriod() |

**Changes to `getServiceCoverage()`**:
1. Query all ServiceContract records for the client's services (in addition to existing rate history)
2. In `getServiceCostForPeriod(m, y)`:
   - First check if any ServiceContract exists covering this period
   - If yes: use contract rate (monthly_rate for CONTRACT/RETAINER, project_fee for PROJECT)
   - If no: fall back to existing ServiceRateHistory resolution (unchanged)
3. `monthlyServiceCost` (current rate for display): use active contract rates for current month
4. No changes to status determination logic

**Acceptance**: Coverage calculation produces correct results using contract rates where available, falls back to rate history for older periods.

---

### Phase 5: Financial Summary Enhancement

**Goal**: Add expected revenue and variance to the financial summary API.

**Files**:
| File | Action |
|------|--------|
| `app/api/clients/[id]/financial-summary/route.ts` | MODIFY — add expectedRevenue, variance to response |

**Changes**:
1. Import `getExpectedRevenueForPeriod` from expected-revenue.ts
2. For `mode=month`: call getExpectedRevenueForPeriod for the selected period
3. For `mode=all`: call getExpectedRevenueAllPeriods, aggregate totals
4. Add to response: `expectedRevenue`, `variance` (actual - expected), `variancePercentage`
5. Add `expectedRevenueByPeriod` array for all-time mode

**Acceptance**: API returns expected revenue and variance alongside existing data, no breaking changes.

---

### Phase 6: UI Components

**Goal**: Build the user interface for contract management and variance display.

**Files**:
| File | Action |
|------|--------|
| `components/clients/ContractFormFields.tsx` | NEW — reusable form fields for billing model + terms |
| `components/clients/AssignServicesModal.tsx` | MODIFY — integrate ContractFormFields |
| `components/clients/ClientServicesTable.tsx` | MODIFY — show contracts, add terminate action |
| `components/clients/ClientFinancialSummary.tsx` | MODIFY — show expected revenue card, variance |

**ContractFormFields** (new component):
- Billing model radio group: Contract / Project / Retainer
- Conditional fields:
  - CONTRACT: Start month/year, end month/year (or term length), monthly rate → auto-calc total value
  - PROJECT: Billing period (month/year), project fee
  - RETAINER: Start month/year, monthly rate
- Reusable in both AssignServicesModal and inline editing

**AssignServicesModal changes**:
- After service selection: show ContractFormFields
- On save: call `createServiceContract` instead of just `assignServiceToClient`
- Show overlap error if returned

**ClientServicesTable changes**:
- Show active contracts per service (billing model badge, rate, period, status)
- "End Contract" button → terminateServiceContract with confirmation
- Collapsed view of historical contracts (COMPLETED/TERMINATED)

**ClientFinancialSummary changes**:
- New "Expected Revenue" metric card (between Revenue and Total Costs)
- Variance indicator: green (surplus), red (shortfall), with $ amount and %
- In revenue detail dialog: add expected revenue column per period

**Acceptance**: Full UI flow for creating, viewing, and terminating contracts with variance visibility.

---

### Phase 7: Data Migration & Verification

**Goal**: Migrate existing ClientService records to ServiceContract and verify correctness.

**Files**:
| File | Action |
|------|--------|
| `prisma/migrations/[timestamp]_migrate-existing-contracts/migration.sql` | NEW — data migration SQL (or a script) |

**Migration logic**:
1. For each ClientService record:
   - Get client.start_date for start_month/start_year
   - Use custom_rate if set, else service.standard_rate
   - Create ServiceContract: billing_model=RETAINER, status=ACTIVE (or COMPLETED if client is CHURNED/INACTIVE), monthly_rate=resolved rate, no end date
2. Preserve all ServiceRateHistory entries (no modifications)

**Verification**:
- [ ] Every active ClientService has a corresponding ACTIVE RETAINER contract
- [ ] Financial summary expected revenue matches pre-migration rate history calculations
- [ ] Service coverage produces identical results before and after migration
- [ ] No new errors or regressions in build/runtime

**Acceptance**: All data migrated, calculations unchanged, no data loss.

---

## Risk Mitigation

| Risk | Mitigation |
|------|-----------|
| Refresh ROI still broken (0/8 failure) | Fix as separate prerequisite before Phase 7 verification |
| Migration corrupts existing data | Run on development database first; production uses Prisma migrate deploy with backup |
| Overlap validation race condition | Prisma transaction wraps check + insert to prevent concurrent overlaps |
| Performance degradation from contract queries | Indexed on (client_id, service_id, status); queries are O(contracts per client) which is small |
| Breaking changes to financial summary API | All new fields are additive; existing clients consuming the API see no changes |

---

## Files Summary

### New Files
| File | Purpose |
|------|---------|
| `lib/calculations/expected-revenue.ts` | Expected revenue calculation engine |
| `components/clients/ContractFormFields.tsx` | Reusable billing model + term form fields |

### Modified Files
| File | Changes |
|------|---------|
| `prisma/schema.prisma` | Add BillingModel enum, ContractStatus enum, ServiceContract model, relations |
| `lib/validations/service.ts` | Add contract validation schemas |
| `app/actions/service-management.ts` | Add contract CRUD server actions |
| `lib/calculations/service-coverage.ts` | Use contracts in getServiceCostForPeriod() |
| `app/api/clients/[id]/financial-summary/route.ts` | Add expectedRevenue, variance to response |
| `components/clients/AssignServicesModal.tsx` | Integrate ContractFormFields |
| `components/clients/ClientServicesTable.tsx` | Show contracts, terminate action |
| `components/clients/ClientFinancialSummary.tsx` | Expected revenue card, variance display |
