# Research: Service Contracts & Billing Models

**Created**: 2026-02-28
**Feature**: [spec.md](spec.md)

---

## R-1: ServiceContract Entity Placement

**Decision**: Create a new `ServiceContract` model separate from `ClientService`.

**Rationale**: `ClientService` is a composite-key join table (`@@id([client_id, service_id])`) that enforces one record per client-service pair. Contracts need multiple sequential records per client-service pair (e.g., Contract 1: Jun-Dec 2025, Contract 2: Mar 2026+). A separate entity with a UUID primary key and FK references to client_id + service_id supports this cleanly.

**Alternatives considered**:
- Embedding contract fields directly on `ClientService`: Rejected — composite PK prevents multiple contracts per service.
- Creating a polymorphic `BillingArrangement` table: Rejected — overengineered for 3 known billing types. A single table with nullable fields per type is simpler and sufficient.

---

## R-2: Billing Model Enum Design

**Decision**: Create a new `BillingModel` Prisma enum with values `CONTRACT`, `PROJECT`, `RETAINER`.

**Rationale**: This is distinct from existing `RelationshipType` (which describes the client relationship: RETAINER, PROJECT_BASED, HOURLY, etc.) and from `Service.billing_type` (which is a string field `"recurring"` | `"one_time"`). The new enum describes the billing terms of a specific arrangement, not the client relationship or service type.

**Alternatives considered**:
- Reusing `RelationshipType`: Rejected — it describes client-level relationships, not service-level billing terms. A client could have PROJECT_BASED relationship type but CONTRACT billing on a specific service.
- Using a string field: Rejected — enum provides type safety and DB-level validation.

---

## R-3: Contract Status Lifecycle

**Decision**: Three statuses: `ACTIVE`, `COMPLETED`, `TERMINATED`. Create a new `ContractStatus` enum.

**Rationale**:
- `ACTIVE`: Contract is currently in effect (start date reached, end date not reached or null for retainers)
- `COMPLETED`: Contract end date has passed and all terms were fulfilled (natural expiration)
- `TERMINATED`: Contract was ended early by user action (premature cancellation)

Status transitions:
- `ACTIVE → COMPLETED`: Automatic when end date passes (or can be triggered by setting end date to past)
- `ACTIVE → TERMINATED`: User explicitly terminates the contract
- No reverse transitions (terminated/completed contracts stay that way; create a new contract instead)

**Alternatives considered**:
- Adding `SUSPENDED` or `PAUSED` states: Deferred to future iteration — adds complexity without clear current need.
- Deriving status from dates only (no stored status): Rejected — explicit status field enables clear queries and distinguishes natural completion from early termination.

---

## R-4: Dual-Source Revenue Expectation Strategy

**Decision**: Use a migration date marker. Periods before the marker use `ServiceRateHistory`; periods on/after use `ServiceContract` records.

**Rationale**: The spec requires backward compatibility. Existing rate history entries represent historical truth that shouldn't be retroactively replaced. The migration date is when the first `ServiceContract` record is created for a client-service pair — from that point forward, contracts are the source of truth.

**Implementation approach**:
- Per client-service pair, the migration date is the `start_month/start_year` of the earliest `ServiceContract` record.
- `getServiceCostForPeriod()` in `service-coverage.ts` checks: if a `ServiceContract` exists covering this period → use contract rate. Otherwise → fall back to `ServiceRateHistory` (existing behavior).
- This is a per-service migration, not a global cutover date.

**Alternatives considered**:
- Global migration date stored in organization settings: Rejected — too rigid, doesn't allow gradual service-by-service adoption.
- Backfilling contracts from rate history: Rejected — spec explicitly says "both systems coexist."

---

## R-5: Overlap Prevention Strategy

**Decision**: Validate at server action level before save. Check for any existing `ACTIVE` `ServiceContract` for the same `client_id + service_id` with overlapping date ranges.

**Rationale**: The overlap check must compare month/year ranges. Two contracts overlap if:
```
contractA.start <= contractB.end AND contractB.start <= contractA.end
```
For retainers with no end date, treat end as infinity (always overlaps with anything after its start).

**Implementation**: Prisma query in the `createServiceContract` server action that checks for conflicting records. Returns a user-friendly error message identifying the conflicting contract.

**Alternatives considered**:
- Database-level constraint (exclusion constraint): Rejected — PostgreSQL range exclusion constraints are complex with month/year integer fields (not timestamps). Application-level validation is simpler and provides better error messages.
- Allow overlaps with a warning only: Rejected — spec requires prevention, not just warning.

---

## R-6: Expected Revenue in Financial Summary

**Decision**: Add `expectedRevenue` and `variance` fields to the financial summary API response. Calculate per-period expected revenue from active contracts.

**Rationale**: Financial summary currently returns actual revenue from deposits. Adding expected revenue (from contract terms) enables the variance comparison UI (FR-6). The calculation function `getExpectedRevenueForPeriod(clientId, month, year)` sums all active contract/retainer/project amounts for that period.

**Implementation**: New utility function in `lib/calculations/expected-revenue.ts` that:
1. Queries all `ServiceContract` records for the client
2. For each period, sums rates from contracts whose date ranges include that period
3. For retainers, caps at current month (no future projection)
4. Returns expected revenue amount

This plugs into both `financial-summary/route.ts` (for display) and `service-coverage.ts` (replacing rate-history-based cost calculation).

---

## R-7: Migration of Existing Data

**Decision**: Prisma migration creates the `ServiceContract` table and a data migration script creates `RETAINER`-type contracts for each existing `ClientService` record.

**Rationale**: Existing `ClientService` records have `custom_rate` but no contract terms. The migration:
1. For each `ClientService` with `custom_rate != null`: create a `ServiceContract` with billing_model=RETAINER, monthly_rate=custom_rate, start_month/year from client.start_date, no end date, status=ACTIVE.
2. For each `ClientService` with `custom_rate == null`: create a `ServiceContract` with billing_model=RETAINER, monthly_rate=service.standard_rate, same start logic, status=ACTIVE.
3. Preserve all `ServiceRateHistory` entries — they remain valid for historical lookups.

**Alternatives considered**:
- No automatic migration (require manual contract creation): Rejected — existing clients would have no expected revenue, breaking service coverage.
- Only migrate active clients: Rejected — all clients need contract records for historical accuracy.

---

## R-8: UI Integration Pattern

**Decision**: Extend the existing `AssignServicesModal` with billing model selection and contract term fields. Add a new `ContractsTable` component within the client services section.

**Rationale**: The existing assignment flow (select service → set rate → save) naturally extends to include billing model selection and term fields. The `ClientServicesTable` currently shows services with inline rate editing — it should be enhanced to show active contracts with their terms rather than just the flat rate.

**Pattern**: Follow existing shadcn/ui dialog pattern used by `AssignServicesModal` and `EditAllocationsModal`. Use conditional form fields based on billing model selection (similar to how `LinkDepositModal` conditionally shows allocation rows).
