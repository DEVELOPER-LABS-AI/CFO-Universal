# Quickstart: Service Contracts & Billing Models

**Created**: 2026-02-28
**Feature**: [spec.md](spec.md)

---

## Prerequisites

1. Database connection verified: `npx prisma migrate status` returns success
2. `.env` uses Supabase pooler URLs (port 6543 for DATABASE_URL, port 5432 for DIRECT_URL)
3. Existing codebase compiles: `npm run build` passes
4. "Refresh All Periods" bug fixed (separate prerequisite — currently failing 0/8)

---

## Implementation Order

```
Phase 1: Schema & Migration
  └──> Phase 2: Expected Revenue Calculation
         ├──> Phase 3: Server Actions (CRUD)
         ├──> Phase 4: Service Coverage Enhancement
         └──> Phase 5: Financial Summary Enhancement
                └──> Phase 6: UI Components
                       └──> Phase 7: Data Migration & Verification
```

---

## Phase 1: Schema & Migration

### Files to modify
- `prisma/schema.prisma` — Add BillingModel enum, ContractStatus enum, ServiceContract model, relations

### Steps
1. Verify DB connection: `npx prisma migrate status`
2. Add enums and model to schema.prisma
3. Run migration: `npx prisma migrate dev --name add-service-contracts`
4. Generate client: `npx prisma generate`
5. Verify: `npx prisma migrate status` shows all applied

### Validation
- [ ] `ServiceContract` table exists in database
- [ ] Enums created: `BillingModel`, `ContractStatus`
- [ ] Relations work: can query `client.service_contracts`

---

## Phase 2: Expected Revenue Calculation

### New file
- `lib/calculations/expected-revenue.ts`

### Steps
1. Implement `getExpectedRevenueForPeriod(clientId, month, year)`:
   - Query ServiceContract records for client
   - For CONTRACT: return monthly_rate if period is within start-end range
   - For PROJECT: return project_fee if period matches billing period
   - For RETAINER: return monthly_rate if period >= start and <= current month (or end date)
   - If no contracts found for period: fall back to ServiceRateHistory
2. Implement `getExpectedRevenueAllPeriods(clientId, organizationId)`
3. Implement `checkContractOverlap(clientId, serviceId, ...)`

### Validation
- [ ] CONTRACT returns rate only within date range
- [ ] PROJECT returns fee only in specified period
- [ ] RETAINER returns rate from start through current month only
- [ ] Falls back to rate history for periods with no contracts
- [ ] Overlap detection works correctly

---

## Phase 3: Server Actions (CRUD)

### Files to modify
- `app/actions/service-management.ts` — Add createServiceContract, updateServiceContract, terminateServiceContract, getClientContracts
- `lib/validations/service.ts` — Add Zod schemas

### Steps
1. Add validation schemas with superRefine for conditional fields
2. Implement createServiceContract with overlap check
3. Implement updateServiceContract (ACTIVE only)
4. Implement terminateServiceContract
5. Implement getClientContracts (read)

### Validation
- [ ] Cannot create overlapping contracts
- [ ] CONTRACT requires end date and monthly_rate
- [ ] PROJECT requires project_fee
- [ ] RETAINER requires monthly_rate > 0
- [ ] Organization isolation enforced

---

## Phase 4: Service Coverage Enhancement

### Files to modify
- `lib/calculations/service-coverage.ts` — Use contracts for expected cost

### Steps
1. In `getServiceCostForPeriod()`, check ServiceContract first
2. Query active contracts for the client's services
3. For each period: if contract exists → use contract rate; else → use rate history (existing behavior)
4. No changes to status determination logic (COVERED/WARNING/PAST_DUE/SUSPENDED)

### Validation
- [ ] Coverage uses contract rates when available
- [ ] Falls back to rate history for pre-contract periods
- [ ] Gap months (no active contract) = $0 expected
- [ ] Retainer projection capped at current month

---

## Phase 5: Financial Summary Enhancement

### Files to modify
- `app/api/clients/[id]/financial-summary/route.ts` — Add expectedRevenue, variance to response

### Steps
1. Call `getExpectedRevenueForPeriod()` for selected period
2. Add `expectedRevenue`, `variance`, `variancePercentage` to response
3. For all-time mode: add `expectedRevenueByPeriod` breakdown
4. Ensure response is backward-compatible (new fields are additive)

### Validation
- [ ] Expected revenue appears in API response
- [ ] Variance = actual - expected
- [ ] All-time mode aggregates correctly
- [ ] No breaking changes to existing response shape

---

## Phase 6: UI Components

### Files to modify
- `components/clients/AssignServicesModal.tsx` — Add billing model selection and contract term fields
- `components/clients/ClientServicesTable.tsx` — Show contracts, add manage/terminate actions
- `components/clients/ClientFinancialSummary.tsx` — Show expected revenue, variance comparison

### New files
- `components/clients/ContractFormFields.tsx` — Reusable contract term fields (conditional by billing model)

### Steps
1. Enhance AssignServicesModal with billing model radio group and conditional fields
2. Add contract list/management to ClientServicesTable
3. Add expected revenue card and variance display to ClientFinancialSummary
4. Add terminate contract action with confirmation dialog

### Validation
- [ ] Can create CONTRACT with all required fields
- [ ] Can create PROJECT with fee and billing period
- [ ] Can create RETAINER with start date and rate
- [ ] Overlap error shown when conflicting contract exists
- [ ] Variance displayed with green (over) / red (under) indicators

---

## Phase 7: Data Migration & Verification

### Steps
1. Write migration script to create RETAINER contracts for existing ClientService records
2. Run on development database
3. Verify: each active ClientService has a corresponding ACTIVE RETAINER contract
4. Verify: financial summary shows expected revenue matching previous rate history
5. Verify: service coverage produces same results as before migration

### Validation
- [ ] All existing ClientService records have corresponding ServiceContract
- [ ] Custom rates preserved as RETAINER monthly_rate
- [ ] ServiceRateHistory entries preserved (unchanged)
- [ ] No disruption to current financial calculations

---

## Key Files Reference

| File | Role |
|------|------|
| `prisma/schema.prisma` | ServiceContract model definition |
| `lib/calculations/expected-revenue.ts` | Expected revenue calculation (NEW) |
| `lib/calculations/service-coverage.ts` | Coverage walk (MODIFY) |
| `lib/validations/service.ts` | Zod schemas (EXTEND) |
| `app/actions/service-management.ts` | CRUD server actions (EXTEND) |
| `app/api/clients/[id]/financial-summary/route.ts` | Financial summary API (MODIFY) |
| `components/clients/AssignServicesModal.tsx` | Assignment modal (MODIFY) |
| `components/clients/ClientServicesTable.tsx` | Services table (MODIFY) |
| `components/clients/ClientFinancialSummary.tsx` | Financial display (MODIFY) |
| `components/clients/ContractFormFields.tsx` | Contract form fields (NEW) |

---

## Constitution Compliance

- [x] **Database**: UUID primary keys, created_at/updated_at, soft deletes (via status, not deleted_at — contracts are historical records)
- [x] **Multi-tenancy**: organization_id on ServiceContract, all queries scoped
- [x] **Prisma workflow**: migrate dev → generate → verify status
- [x] **API design**: Server actions for mutations, API routes for reads
- [x] **TypeScript**: Zod validation, Prisma-generated types
- [x] **Frontend**: shadcn/ui components, Server Components default
- [x] **Pooler URLs**: verified before migration
