# Data Model: Client Portfolio & Staff Management

**Feature**: 3-client-portfolio-staff
**Created**: 2026-02-16
**Status**: Phase 0 Design Complete

---

## Overview

This document defines the complete data model for Feature 3, including 12 new tables, 4 new enums, relationships, validation rules, and indexing strategies. All design decisions are based on research findings documented in `research.md`.

---

## Entity Relationship Diagram

```
Organization (1) ─┬─ (N) Client
                 ├─ (N) Service
                 ├─ (N) Staff
                 ├─ (N) Agency
                 └─ (N) Subscription

Client (N) ─┬─ (N) Service (via ClientService junction)
            ├─ (N) Staff (via StaffAssignment)
            ├─ (N) SubscriptionAllocation
            ├─ (N) BDRProductivityMetric
            └─ (N) ClientROI

Staff (1) ─┬─ (N) StaffAssignment
           ├─ (N) Agency (for agency staff: N:1)
           ├─ (N) BDRProductivityMetric (if staff_type = BDR)
           ├─ (N) BDRROI (if staff_type = BDR)
           └─ (N) SubscriptionAllocation

Subscription (1) ─── (N) SubscriptionAllocation

Agency (1) ─┬─ (N) Staff (agency staff)
            └─ (N) AgencyMonthlyBreakdown
```

---

## Enums

### StaffType
```prisma
enum StaffType {
  BDR              // Business Development Representative
  ADMIN            // Administrative staff
  CONTRACTOR       // Individual contractor
  AGENCY_STAFF     // Staff from agency partner
}
```

**Usage**: Discriminates staff types in unified Staff table

---

### AllocationType
```prisma
enum AllocationType {
  SEAT_BASED       // Allocate exact seats (e.g., Salesforce)
  PERCENTAGE_BASED // Allocate percentage (e.g., Adobe Creative Cloud)
}
```

**Usage**: Supports hybrid subscription allocation (seat-based + percentage-based)

---

### ClientStatus (Existing)
```prisma
enum ClientStatus {
  ACTIVE
  INACTIVE
  CHURNED
}
```

---

### RelationshipType (Existing)
```prisma
enum RelationshipType {
  RETAINER
  PROJECT_BASED
  HOURLY
  VALUE_BASED
}
```

---

## Tables

### 1. Client

**Description**: Core client entity with custom margin targets and relationship tracking

**Schema**:
```prisma
model Client {
  id                   String           @id @default(uuid())
  organization_id      String
  name                 String
  status               ClientStatus     @default(ACTIVE)
  relationship_type    RelationshipType
  custom_margin_target Decimal?         @db.Decimal(5, 2) // 0-100%
  start_date           DateTime         @default(now())
  churn_date           DateTime?
  created_at           DateTime         @default(now())
  updated_at           DateTime         @updatedAt
  deleted_at           DateTime?

  // Relationships
  organization      Organization           @relation(fields: [organization_id], references: [id])
  services          ClientService[]        // M:N to services
  staff_assignments StaffAssignment[]      // M:N to staff
  subscriptions     SubscriptionAllocation[]
  productivity      BDRProductivityMetric[]
  roi_metrics       ClientROI[]

  @@unique([organization_id, name], name: "unique_client_name", map: "unique_client_name_idx")
  @@index([organization_id])
  @@index([status])
  @@index([organization_id, name])
}
```

**Validation Rules**:
- name: Required, 1-200 characters
- custom_margin_target: Optional, 0-100%
- churn_date: Must be >= start_date
- Unique constraint: (organization_id, name) for non-deleted records

---

### 2. Service (Template)

**Description**: Reusable service templates with base rates

**Schema**:
```prisma
model Service {
  id              String   @id @default(uuid())
  organization_id String
  name            String
  description     String?
  standard_rate   Decimal  @db.Decimal(10, 2)
  target_margin   Decimal  @db.Decimal(5, 2) // 0-100%
  is_active       Boolean  @default(true)
  created_at      DateTime @default(now())
  updated_at      DateTime @updatedAt
  deleted_at      DateTime?

  // Relationships
  organization    Organization    @relation(fields: [organization_id], references: [id])
  client_services ClientService[] // M:N to clients

  @@index([organization_id])
  @@index([organization_id, is_active])
}
```

**Validation Rules**:
- name: Required, 1-100 characters
- standard_rate: Must be > 0
- target_margin: 0-100%
- is_active: Boolean, defaults to true

---

### 3. ClientService (Junction)

**Description**: M:N junction between clients and services with per-client customization

**Schema**:
```prisma
model ClientService {
  client_id   String
  service_id  String
  custom_rate Decimal? @db.Decimal(10, 2) // Overrides service.standard_rate
  rate_type   RateType? // Overrides service rate type

  // Relationships
  client  Client  @relation(fields: [client_id], references: [id], onDelete: Cascade)
  service Service @relation(fields: [service_id], references: [id], onDelete: Restrict)

  @@id([client_id, service_id])
  @@index([client_id])
  @@index([service_id])
}
```

**Business Logic**:
- If custom_rate is NULL, use service.standard_rate
- Prevents duplicate service assignments to same client (composite PK)
- Cascade delete on client deletion
- Restrict delete on service deletion (must remove assignments first)

---

### 4. Staff

**Description**: Unified staff table for BDRs, Admin, Contractors, and Agency Staff

**Schema**:
```prisma
model Staff {
  id              String         @id @default(uuid())
  organization_id String
  agency_id       String?        // Only for staff_type = AGENCY_STAFF
  name            String
  staff_type      StaffType
  rate            Decimal        @db.Decimal(10, 2)
  rate_type       RateType       // MONTHLY, HOURLY, PROJECT
  engagement_type EngagementType // W2, 1099, CORP_TO_CORP
  created_at      DateTime       @default(now())
  updated_at      DateTime       @updatedAt
  deleted_at      DateTime?

  // Relationships
  organization        Organization              @relation(fields: [organization_id], references: [id])
  agency              Agency?                   @relation(fields: [agency_id], references: [id])
  assignments         StaffAssignment[]         // M:N to clients
  productivity        BDRProductivityMetric[]   // Only for staff_type = BDR
  roi_metrics         BDRROI[]                  // Only for staff_type = BDR
  subscription_allocs SubscriptionAllocation[]

  @@index([organization_id])
  @@index([organization_id, staff_type])
  @@index([agency_id])
}
```

**Validation Rules**:
- name: Required, 1-200 characters
- rate: Must be > 0
- agency_id: Required if staff_type = AGENCY_STAFF, null otherwise
- Cannot soft delete staff with active assignments (end_date = null)

**Type-Specific Fields**:
- BDR: Can have productivity metrics and ROI calculations
- AGENCY_STAFF: Must have agency_id set
- CONTRACTOR/ADMIN: General purpose, no special constraints

---

### 5. StaffAssignment

**Description**: M:N assignment of staff to clients with allocation percentages

**Schema**:
```prisma
model StaffAssignment {
  id                    String   @id @default(uuid())
  staff_id              String
  client_id             String
  allocation_percentage Decimal  @db.Decimal(5, 2) // 0-100%
  start_date            DateTime @default(now())
  end_date              DateTime?
  created_at            DateTime @default(now())
  updated_at            DateTime @updatedAt

  // Relationships
  staff  Staff  @relation(fields: [staff_id], references: [id])
  client Client @relation(fields: [client_id], references: [id])

  @@index([staff_id])
  @@index([client_id])
  @@index([staff_id, client_id])
  @@index([start_date, end_date])
}
```

**Validation Rules**:
- allocation_percentage: 0-100%
- end_date: If set, must be >= start_date
- Warn if sum of allocation_percentage for one staff_id > 100% (not blocked)
- Active assignment: end_date IS NULL

**Business Logic**:
- Cost per client = staff.rate × (allocation_percentage / 100)
- Overlapping assignments allowed (staff can have multiple active assignments)
- Historical preservation: Never delete, only set end_date

---

### 6. Subscription

**Description**: SaaS subscription tracking with cost and seat information

**Schema**:
```prisma
model Subscription {
  id                String   @id @default(uuid())
  organization_id   String
  name              String
  total_cost        Decimal  @db.Decimal(10, 2)
  total_seats       Int?     // Null for percentage-based subscriptions
  billing_frequency String   // MONTHLY, ANNUAL, QUARTERLY
  is_active         Boolean  @default(true)
  created_at        DateTime @default(now())
  updated_at        DateTime @updatedAt
  deleted_at        DateTime?

  // Relationships
  organization Organization             @relation(fields: [organization_id], references: [id])
  allocations  SubscriptionAllocation[]

  @@index([organization_id])
  @@index([organization_id, is_active])
}
```

**Validation Rules**:
- name: Required, 1-200 characters (e.g., "Salesforce", "Adobe Creative Cloud")
- total_cost: Must be > 0
- total_seats: Optional (null for percentage-based subscriptions)
- billing_frequency: MONTHLY, ANNUAL, QUARTERLY

---

### 7. SubscriptionAllocation

**Description**: Hybrid allocation of subscription costs (seat-based + percentage-based)

**Schema**:
```prisma
model SubscriptionAllocation {
  id                    String         @id @default(uuid())
  subscription_id       String
  client_id             String?        // Allocate to client...
  staff_id              String?        // ...OR to staff (not both)
  allocation_type       AllocationType
  seats_allocated       Int?           // Required if SEAT_BASED
  percentage_allocated  Decimal?       @db.Decimal(5, 2) // Required if PERCENTAGE_BASED
  cost_allocated        Decimal        @db.Decimal(10, 2) // Calculated field
  created_at            DateTime       @default(now())
  updated_at            DateTime       @updatedAt

  // Relationships
  subscription Subscription @relation(fields: [subscription_id], references: [id])
  client       Client?      @relation(fields: [client_id], references: [id])
  staff        Staff?       @relation(fields: [staff_id], references: [id])

  @@index([subscription_id])
  @@index([client_id])
  @@index([staff_id])
}
```

**Validation Rules**:
- Exactly one of client_id OR staff_id must be set (XOR constraint)
- If allocation_type = SEAT_BASED: seats_allocated required, percentage_allocated null
- If allocation_type = PERCENTAGE_BASED: percentage_allocated required, seats_allocated null
- SEAT_BASED: Sum of seats_allocated ≤ subscription.total_seats (hard constraint)
- PERCENTAGE_BASED: Sum of percentage_allocated can exceed 100% (warn only)

**Calculated Field Logic**:
```typescript
// cost_allocated calculation
if (allocation_type === 'SEAT_BASED') {
  cost_allocated = (subscription.total_cost / subscription.total_seats) * seats_allocated;
} else {
  cost_allocated = subscription.total_cost * (percentage_allocated / 100);
}
```

---

### 8. Agency

**Description**: Agency partner tracking with monthly payment

**Schema**:
```prisma
model Agency {
  id              String   @id @default(uuid())
  organization_id String
  name            String
  monthly_payment Decimal  @db.Decimal(10, 2)
  start_date      DateTime @default(now())
  created_at      DateTime @default(now())
  updated_at      DateTime @updatedAt
  deleted_at      DateTime?

  // Relationships
  organization Organization              @relation(fields: [organization_id], references: [id])
  staff        Staff[]                   // Agency staff members
  breakdowns   AgencyMonthlyBreakdown[]

  @@index([organization_id])
}
```

**Validation Rules**:
- name: Required, 1-200 characters
- monthly_payment: Must be > 0
- Cannot soft delete agency with active staff assignments

---

### 9. AgencyMonthlyBreakdown

**Description**: Variable monthly staffing breakdown with JSONB storage (Research: R1)

**Schema**:
```prisma
model AgencyMonthlyBreakdown {
  id              String   @id @default(uuid())
  agency_id       String
  month           Int      // 1-12
  year            Int      // 2024, 2025, etc.
  breakdown       Json     // JSONB: [{name, role, cost}, ...]
  breakdown_total Decimal  @db.Decimal(10, 2) // Pre-computed sum
  variance        Decimal  @db.Decimal(10, 2) // breakdown_total - agency.monthly_payment
  created_at      DateTime @default(now())
  updated_at      DateTime @updatedAt

  // Relationships
  agency Agency @relation(fields: [agency_id], references: [id])

  @@unique([agency_id, month, year])
  @@index([agency_id, year, month(sort: Desc)])
}
```

**JSONB Structure**:
```json
{
  "staff": [
    {"name": "Mike Chen", "role": "BDR", "cost": 6000},
    {"name": "Sarah Lee", "role": "BDR", "cost": 6000},
    {"name": "Admin Staff", "role": "ADMIN", "cost": 3000}
  ]
}
```

**Validation Rules**:
- month: 1-12
- year: > 2020
- breakdown_total: Auto-calculated from breakdown JSON
- variance: breakdown_total - agency.monthly_payment
- Unique constraint: (agency_id, month, year)

**Indexing Strategy** (from R5 research):
```sql
-- GIN index with jsonb_path_ops for containment queries
CREATE INDEX idx_breakdown_staff ON agency_monthly_breakdowns
USING GIN ((breakdown -> 'staff') jsonb_path_ops);
```

---

### 10. BDRProductivityMetric

**Description**: Time-series tracking of BDR meetings attended per month

**Schema**:
```prisma
model BDRProductivityMetric {
  id                String   @id @default(uuid())
  bdr_id            String
  client_id         String?  // Nullable: aggregate metric if NULL
  month             Int      // 1-12
  year              Int
  meetings_attended Int
  created_at        DateTime @default(now())
  updated_at        DateTime @updatedAt

  // Relationships
  bdr    Staff  @relation(fields: [bdr_id], references: [id])
  client Client? @relation(fields: [client_id], references: [id])

  @@unique([bdr_id, client_id, month, year])
  @@index([bdr_id, year, month(sort: Desc)])
  @@index([client_id, year, month(sort: Desc)])
}
```

**Validation Rules**:
- month: 1-12
- year: > 2020
- meetings_attended: >= 0
- Unique constraint prevents duplicate entries for same BDR+client+month+year

**Query Patterns**:
```sql
-- Total meetings for BDR across all clients
SELECT SUM(meetings_attended) FROM bdr_productivity_metrics
WHERE bdr_id = ? AND year = 2026 AND month = 2;

-- Meetings per client for BDR
SELECT client_id, meetings_attended FROM bdr_productivity_metrics
WHERE bdr_id = ? AND year = 2026 AND month = 2 AND client_id IS NOT NULL;
```

---

### 11. ClientROI

**Description**: Pre-calculated monthly client ROI snapshots (Research: R2)

**Schema**:
```prisma
model ClientROI {
  id                 String   @id @default(uuid())
  client_id          String
  month              Int      // 1-12
  year               Int
  revenue            Decimal  @db.Decimal(10, 2) // From Xero invoices
  total_costs        Decimal  @db.Decimal(10, 2) // Sum of all costs
  profit             Decimal  @db.Decimal(10, 2) // revenue - total_costs
  roi_percentage     Decimal  @db.Decimal(8, 2)  // (profit / total_costs) * 100
  margin_percentage  Decimal  @db.Decimal(5, 2)  // (profit / revenue) * 100
  calculated_at      DateTime @default(now())

  // Cost breakdowns (for transparency)
  bdr_costs          Decimal @db.Decimal(10, 2)
  contractor_costs   Decimal @db.Decimal(10, 2)
  subscription_costs Decimal @db.Decimal(10, 2)
  service_costs      Decimal @db.Decimal(10, 2)

  // Relationships
  client Client @relation(fields: [client_id], references: [id])

  @@unique([client_id, month, year])
  @@index([client_id, year, month(sort: Desc)])
  @@index([margin_percentage])  // For sorting dashboard by margin
  @@index([roi_percentage])     // For sorting dashboard by ROI
}
```

**Calculation Logic**:
```typescript
// Total costs aggregation
total_costs = bdr_costs + contractor_costs + subscription_costs + service_costs;

// Profit
profit = revenue - total_costs;

// Dual metrics
roi_percentage = costs > 0 ? (profit / costs) * 100 : 0;
margin_percentage = revenue > 0 ? (profit / revenue) * 100 : 0;
```

**Update Triggers**:
- End of month: Final snapshot calculation
- Daily: Current month snapshot update
- On-demand: "Refresh ROI" button
- After Xero sync: Invalidate cache, recalculate

---

### 12. BDRROI

**Description**: Pre-calculated monthly BDR ROI snapshots

**Schema**:
```prisma
model BDRROI {
  id                      String   @id @default(uuid())
  bdr_id                  String
  month                   Int      // 1-12
  year                    Int
  revenue_attributed      Decimal  @db.Decimal(10, 2) // Client revenue * allocation %
  bdr_cost                Decimal  @db.Decimal(10, 2) // BDR monthly rate
  profit                  Decimal  @db.Decimal(10, 2) // revenue_attributed - bdr_cost
  roi_percentage          Decimal  @db.Decimal(8, 2)  // (profit / bdr_cost) * 100
  margin_percentage       Decimal  @db.Decimal(5, 2)  // (profit / revenue_attributed) * 100
  meetings_attended_total Int                          // From BDRProductivityMetric
  calculated_at           DateTime @default(now())

  // Relationships
  bdr Staff @relation(fields: [bdr_id], references: [id])

  @@unique([bdr_id, month, year])
  @@index([bdr_id, year, month(sort: Desc)])
  @@index([roi_percentage])
  @@index([margin_percentage])
}
```

**Calculation Logic**:
```typescript
// Revenue attribution per client
for each assignment of BDR to client {
  attributed_revenue += client_revenue * (allocation_percentage / 100);
}

// BDR cost (monthly rate)
bdr_cost = staff.rate; // Assumes RateType = MONTHLY

// Metrics
profit = revenue_attributed - bdr_cost;
roi_percentage = bdr_cost > 0 ? (profit / bdr_cost) * 100 : 0;
margin_percentage = revenue_attributed > 0 ? (profit / revenue_attributed) * 100 : 0;
```

---

## Indexes Summary

### Organization Scoping
All tables have `organization_id` indexed for multi-tenant queries.

### Performance Optimization
| Table | Index | Purpose |
|-------|-------|---------|
| Client | (organization_id, name) | Search by name |
| Client | (status) | Filter by status |
| Service | (organization_id, is_active) | Filter active templates |
| Staff | (organization_id, staff_type) | Filter by type |
| StaffAssignment | (staff_id, client_id) | Lookup assignments |
| StaffAssignment | (start_date, end_date) | Time-range queries |
| SubscriptionAllocation | (subscription_id) | Lookup allocations |
| SubscriptionAllocation | (client_id, staff_id) | Reverse lookup |
| AgencyMonthlyBreakdown | GIN (breakdown->'staff') | JSONB containment queries |
| AgencyMonthlyBreakdown | (agency_id, year, month DESC) | Time-series |
| BDRProductivityMetric | (bdr_id, year, month DESC) | BDR trends |
| ClientROI | (margin_percentage, roi_percentage) | Dashboard sorting |
| BDRROI | (roi_percentage, margin_percentage) | BDR leaderboard |

---

## Data Integrity Constraints

### Referential Integrity
- All foreign keys enforce `ON DELETE` behavior:
  - Client deletion: CASCADE to ClientService, StaffAssignment, ClientROI
  - Service deletion: RESTRICT (must remove assignments first)
  - Staff deletion: RESTRICT (must end assignments first)
  - Subscription deletion: CASCADE to allocations

### Soft Deletes
Tables with `deleted_at` column:
- Client
- Service
- Staff
- Subscription
- Agency

**Default Query Pattern**:
```sql
WHERE deleted_at IS NULL
```

**Historical Reports**:
```sql
-- Include deleted records for historical analysis
WHERE TRUE
```

### Validation Constraints
- Percentage fields: CHECK (value >= 0 AND value <= 100)
- Date ranges: CHECK (end_date >= start_date)
- Positive amounts: CHECK (amount > 0)
- Month: CHECK (month >= 1 AND month <= 12)

---

## Calculated Fields

### Runtime Calculations
- `SubscriptionAllocation.cost_allocated`: Calculated during upsert
- `AgencyMonthlyBreakdown.breakdown_total`: Sum of breakdown JSON costs
- `AgencyMonthlyBreakdown.variance`: breakdown_total - monthly_payment

### Pre-Computed Snapshots
- `ClientROI.*`: All fields pre-calculated and stored
- `BDRROI.*`: All fields pre-calculated and stored

**Refresh Strategy** (from R2 research):
- End of month: Final snapshot (immutable)
- Daily: Current month update
- On-demand: Manual refresh button
- Event-driven: After Xero sync

---

## Multi-Tenant Isolation

All tables include `organization_id` with RLS policies:

```sql
-- Example RLS policy
CREATE POLICY "org_isolation_policy"
  ON clients
  FOR ALL
  USING (
    organization_id IN (
      SELECT organization_id
      FROM user_organizations
      WHERE user_id = auth.uid()
    )
  );
```

**Applied to all tables**:
- Client
- Service
- ClientService (via client relationship)
- Staff
- StaffAssignment (via staff relationship)
- Subscription
- SubscriptionAllocation (via subscription relationship)
- Agency
- AgencyMonthlyBreakdown (via agency relationship)
- BDRProductivityMetric (via staff relationship)
- ClientROI (via client relationship)
- BDRROI (via staff relationship)

---

## Migration Strategy

### Phase 1: Core Entities (Tables 1-4)
```bash
npx prisma migrate dev --name add_client_service_staff_agency_models
```

- Client
- Service
- ClientService
- Staff (unified table with StaffType enum)

### Phase 2: Assignments & Allocations (Tables 5-7)
```bash
npx prisma migrate dev --name add_assignments_and_subscriptions
```

- StaffAssignment
- Subscription
- SubscriptionAllocation

### Phase 3: Agency & Breakdowns (Tables 8-9)
```bash
npx prisma migrate dev --name add_agency_monthly_breakdown
```

- Agency
- AgencyMonthlyBreakdown (with JSONB)

### Phase 4: Metrics & ROI (Tables 10-12)
```bash
npx prisma migrate dev --name add_productivity_and_roi_metrics
```

- BDRProductivityMetric
- ClientROI
- BDRROI

### Post-Migration Tasks
1. Run `npx prisma generate` to update Prisma Client
2. Create RLS policies in Supabase for all new tables
3. Create GIN indexes for JSONB fields
4. Seed development data for testing

---

## Next Steps

1. ✅ Review data model with stakeholders
2. ✅ Generate API contracts in `contracts/server-actions.md`
3. ✅ Update `plan.md` with final schema
4. ✅ Begin Phase 1 implementation (Prisma schema creation)

---

**Data Model Complete**: 2026-02-16
