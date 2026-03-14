# Data Model: Service Contracts & Billing Models

**Created**: 2026-02-28
**Feature**: [spec.md](spec.md)
**Research**: [research.md](research.md)

---

## New Enums

### BillingModel

```prisma
enum BillingModel {
  CONTRACT
  PROJECT
  RETAINER
  @@map("BillingModel")
}
```

### ContractStatus

```prisma
enum ContractStatus {
  ACTIVE
  COMPLETED
  TERMINATED
  @@map("ContractStatus")
}
```

---

## New Entity: ServiceContract

```prisma
model ServiceContract {
  id              String          @id @default(uuid())
  organization_id String
  client_id       String
  service_id      String
  billing_model   BillingModel
  status          ContractStatus  @default(ACTIVE)

  // Billing terms
  start_month     Int             // 1-12
  start_year      Int             // YYYY
  end_month       Int?            // 1-12 (nullable for RETAINER)
  end_year        Int?            // YYYY (nullable for RETAINER)
  monthly_rate    Decimal?        @db.Decimal(10, 2) // CONTRACT and RETAINER
  project_fee     Decimal?        @db.Decimal(10, 2) // PROJECT only
  term_months     Int?            // CONTRACT only (auto-calculated)

  // Metadata
  notes           String?
  created_at      DateTime        @default(now())
  updated_at      DateTime        @updatedAt

  // Relations
  organization    Organization    @relation(fields: [organization_id], references: [id])
  client          Client          @relation(fields: [client_id], references: [id], onDelete: Cascade)
  service         Service         @relation(fields: [service_id], references: [id], onDelete: Cascade)

  @@index([client_id, service_id, status])
  @@index([organization_id])
  @@index([client_id, start_year, start_month])
  @@map("service_contracts")
}
```

### Field Descriptions

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | UUID | Auto | Primary key |
| `organization_id` | UUID | Yes | Multi-tenant isolation |
| `client_id` | UUID | Yes | FK to Client |
| `service_id` | UUID | Yes | FK to Service |
| `billing_model` | BillingModel | Yes | CONTRACT, PROJECT, or RETAINER |
| `status` | ContractStatus | Yes | ACTIVE, COMPLETED, or TERMINATED (default: ACTIVE) |
| `start_month` | Int (1-12) | Yes | Month when billing begins |
| `start_year` | Int (YYYY) | Yes | Year when billing begins |
| `end_month` | Int (1-12) | Conditional | Required for CONTRACT; optional for RETAINER; N/A for PROJECT |
| `end_year` | Int (YYYY) | Conditional | Required for CONTRACT; optional for RETAINER; N/A for PROJECT |
| `monthly_rate` | Decimal(10,2) | Conditional | Required for CONTRACT (>= 0) and RETAINER (> 0) |
| `project_fee` | Decimal(10,2) | Conditional | Required for PROJECT (> 0) |
| `term_months` | Int | Conditional | CONTRACT only — auto-calculated from start/end dates |
| `notes` | String | No | Free-text notes about the contract |
| `created_at` | DateTime | Auto | Record creation timestamp |
| `updated_at` | DateTime | Auto | Last update timestamp |

### Validation Rules

1. **All types**: `start_month` (1-12), `start_year` (>= 2020) required
2. **CONTRACT**: `monthly_rate` >= 0 required, `end_month`/`end_year` required, `term_months` auto-calculated
3. **PROJECT**: `project_fee` > 0 required, `start_month`/`start_year` represent the billing period
4. **RETAINER**: `monthly_rate` > 0 required, `end_month`/`end_year` optional (null = ongoing)
5. **Overlap prevention**: No two ACTIVE contracts for the same `(client_id, service_id)` with overlapping date ranges
6. **Organization isolation**: All queries must include `organization_id` filter

### State Transitions

```
                 ┌─────────┐
     Create ───► │  ACTIVE  │
                 └────┬─────┘
                      │
            ┌─────────┼──────────┐
            │                    │
   End date reached     User terminates
            │                    │
            ▼                    ▼
     ┌────────────┐      ┌─────────────┐
     │ COMPLETED  │      │ TERMINATED  │
     └────────────┘      └─────────────┘
```

No reverse transitions. To restart billing, create a new contract.

---

## Relation Updates to Existing Models

### Client (add relation)

```prisma
model Client {
  // ... existing fields ...
  service_contracts ServiceContract[]
}
```

### Service (add relation)

```prisma
model Service {
  // ... existing fields ...
  service_contracts ServiceContract[]
}
```

### Organization (add relation)

```prisma
model Organization {
  // ... existing fields ...
  service_contracts ServiceContract[]
}
```

---

## Calculated Fields (Not Stored)

| Field | Formula | Where Used |
|-------|---------|------------|
| `total_contract_value` | `monthly_rate × term_months` | UI display for CONTRACT type |
| `expected_revenue_for_period` | Sum of applicable contract rates for a given month/year | Financial summary, service coverage |
| `variance` | `actual_revenue - expected_revenue` | Financial summary UI |

---

## Index Strategy

| Index | Purpose |
|-------|---------|
| `(client_id, service_id, status)` | Overlap prevention queries, active contract lookups |
| `(organization_id)` | Multi-tenant isolation |
| `(client_id, start_year, start_month)` | Chronological contract listing, date-range queries |

---

## Migration Plan

### Schema Migration
1. Create `BillingModel` and `ContractStatus` enums
2. Create `service_contracts` table with all fields and indexes
3. Add relations to Client, Service, Organization

### Data Migration
For each existing `ClientService` record:
1. Look up `client.start_date` for the start month/year
2. Use `custom_rate` if set, otherwise `service.standard_rate`
3. Create a `ServiceContract` with:
   - `billing_model`: RETAINER
   - `status`: ACTIVE (or COMPLETED if client is CHURNED/INACTIVE)
   - `start_month/start_year`: from client.start_date
   - `end_month/end_year`: null (open-ended)
   - `monthly_rate`: resolved rate
4. Preserve all existing `ServiceRateHistory` entries unchanged
