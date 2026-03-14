# Implementation Plan: Client Portfolio & Staff Management

**Feature**: Client Portfolio & Staff Management - Revenue Operations Foundation
**Branch**: 3-client-portfolio-staff
**Created**: 2026-02-16
**Status**: Planning in Progress

---

## Executive Summary

This plan details the implementation of a comprehensive client portfolio and workforce management system for a staffing/placement agency model. The system tracks client relationships, manages four staff types (BDRs, Admin, Contractors, Agency Staff), handles service templates with client customization, allocates subscription costs via hybrid methods, and calculates dual ROI metrics for clients and BDRs.

**Key Deliverables:**
- Client CRUD with custom margin targets and relationship types
- Service template system with per-client customization
- Staff management across 4 types (BDR, Admin, Contractor, Agency Staff)
- Many-to-many BDR-to-client assignments with allocation percentages
- Subscription cost allocation (hybrid: seat-based + percentage-based)
- Agency partner management with variable monthly breakdown tracking
- BDR productivity tracking (meetings booked that show up)
- Dual ROI calculations (ROI% + Margin%) for clients and BDRs
- Portfolio overview dashboard with filtering, search, export

**Estimated Complexity**: HIGH (10-14 days) - Complex data model with 12 new entities

**Timeline Breakdown**:
- Days 1-2: Database schema design + Prisma migrations (12 new tables)
- Days 3-4: Service template + client-service assignment logic
- Days 5-6: Staff management + BDR/contractor assignment M:N relationships
- Days 7-8: Subscription management + hybrid allocation engine
- Days 9-10: Agency partner + variable breakdown tracking
- Days 11-12: ROI calculation engines (client + BDR) with dual metrics
- Days 13-14: Portfolio dashboard, productivity tracking, CSV export, testing

---

## Technical Context

### Technology Stack

**Frontend:**
- **Next.js 16 App Router**: Server components for portfolio views, client components for interactive forms
- **React 19**: Modern React with concurrent features
- **shadcn/ui**: Form components (multi-step client wizard, BDR assignment modal, subscription allocator)
- **Tailwind CSS**: Styling with responsive design
- **TanStack Query**: Server state management for client/staff/subscription lists
- **React Hook Form + Zod**: Form validation (client creation, service assignment, BDR allocation)

**Backend:**
- **Next.js Server Actions**: Data mutations (createClient, assignBDR, allocateSubscription)
- **Next.js API Routes**: Read operations, ROI calculations, CSV export generation
- **Prisma ORM**: Database access with type-safe models
- **Zod**: Input validation schemas for all entities

**Database Layer:**
- **PostgreSQL (Supabase)**: Relational database with RLS policies
- **Prisma**: Schema management for 12 new tables + 4 enum types
- **Supabase Pooler URLs**: Connection pooling (port 6543 for queries, 5432 for migrations per Constitution #8)
- **RLS Policies**: Organization-scoped data isolation for all entities

**State Management:**
- **Server State**: TanStack Query for lists, dashboards, reports
- **Form State**: React Hook Form for multi-step wizards
- **URL State**: Next.js searchParams for filters, pagination, sorting

**Data Structures:**
- **JSONB**: Agency monthly breakdown (variable staffing composition)
- **Enums**: Staff types, allocation types, relationship types
- **Decimal**: Financial calculations (rates, costs, ROI percentages)

**Development Tools:**
- **TypeScript Strict Mode**: Type-safe code across all layers
- **Vitest**: Unit tests for ROI calculations, allocation logic
- **Playwright**: E2E tests for critical flows (client onboarding, BDR assignment)

### Unknowns Requiring Research

**R1: Prisma Schema Design for Variable Agency Breakdown**
- [NEEDS CLARIFICATION] Best approach for storing variable monthly breakdown (JSONB vs normalized tables)
- Research: PostgreSQL JSONB query performance vs JOIN performance for reporting
- Decision: Choose between flexibility (JSONB) vs query optimization (normalized)

**R2: ROI Calculation Strategy**
- [NEEDS CLARIFICATION] Real-time calculation vs pre-calculated snapshots
- Research: Performance implications of calculating ROI on-the-fly for 100+ clients
- Decision: Hybrid approach (cache with invalidation) vs fully computed columns

**R3: Multi-Select Allocation UI Pattern**
- [NEEDS CLARIFICATION] Best UX for allocating 1 BDR to multiple clients with percentages
- Research: shadcn/ui patterns for percentage allocation (slider vs input vs drag-drop)
- Decision: Component design for subscription seat allocation UI

**R4: Subscription Allocation Validation**
- [NEEDS CLARIFICATION] Real-time validation vs save-time validation for allocation constraints
- Research: User experience for warning vs blocking when allocation >100%
- Decision: When to prevent saves vs when to show warnings

**R5: Agency Breakdown History Querying**
- [NEEDS CLARIFICATION] Efficient querying of JSONB history for cost attribution reports
- Research: JSONB indexing strategies, GIN vs BTREE for array fields
- Decision: Index strategy for agency breakdown history queries

**R6: CSV Export Performance**
- [NEEDS CLARIFICATION] Server-side vs client-side CSV generation for large datasets
- Research: Next.js API route streaming for large exports (500+ clients)
- Decision: Export architecture for scalability

All research findings will be documented in `research.md` before Phase 1 implementation begins.

---

## Constitution Check

### Compliance Summary

**✅ COMPLIANT:**
- **Technology Stack** (Principle #1): Next.js 16, React 19, Prisma, Supabase, Vercel
- **Multi-Tenancy** (Principle #2): All 12 tables scoped by `organization_id` with RLS
- **Security** (Principle #4): No sensitive data exposed to client, RLS enforced, soft deletes
- **Performance** (Principle #5): ROI calculations designed for <2s load time target
- **Code Quality** (Principle #6): TypeScript strict mode, Zod validation, comprehensive error handling
- **Database Connection** (Principle #8): Will use Supabase pooler URLs, verify connection before migrations
- **Development Workflow** (Principle #7): Spec → Plan → Tasks → Implementation, feature branch 3-client-portfolio-staff

**✅ DATABASE DESIGN COMPLIANCE:**
- UUID primary keys for all 12 new tables
- created_at, updated_at timestamps on all entities
- Soft deletes with deleted_at field (Client, Service, Staff, Subscription, Agency)
- Indexes on foreign keys (organization_id, client_id, staff_id, subscription_id, agency_id)
- Indexes on frequently queried fields (status, staff_type, allocation_percentage)
- Will test connection with `npx prisma migrate status` before schema changes
- Will run `npx prisma generate` after all schema modifications

**✅ API DESIGN COMPLIANCE:**
- Next.js Server Actions for mutations (createClient, assignBDR, allocateSubscription)
- Typed responses with Zod validation
- No direct database access from client components
- RLS policies prevent cross-organization data leakage

**✅ FRONTEND DESIGN COMPLIANCE:**
- Server Components by default (portfolio lists, dashboards)
- Client Components only for interactive forms (BDR assignment modal, subscription allocator)
- Loading states for all async operations
- TanStack Query for server state caching
- shadcn/ui component patterns

**🔍 RESEARCH TASKS (Phase 0):**
All [NEEDS CLARIFICATION] items (R1-R6) will be researched and documented in `research.md`.

**📋 PRE-IMPLEMENTATION VERIFICATION:**
1. ✅ Verify `.env` has Supabase pooler URLs (not direct db URLs)
2. ✅ Test connection: `npx prisma migrate status` before schema work
3. ✅ Review migration files before applying to production
4. ✅ Confirm RLS policies won't be affected by schema changes
5. ✅ Backup production data before applying migrations

---

## Architecture Decisions

### Decision 1: Service Model - Hybrid Template + Customization

**Context**: User operates staffing agency where services (Marketing, Web Design, Assigned BDR) are standardized but priced differently per client.

**Decision**: Keep `Service` table as templates, use `ClientService` junction for per-client customization.

**Implementation**:
```typescript
// Service table: Global templates
model Service {
  id              String  @id @default(uuid())
  organization_id String
  name            String  // "Marketing", "Web Design", "Assigned BDR"
  description     String?
  standard_rate   Decimal @db.Decimal(10, 2)  // Base rate
  target_margin   Decimal @db.Decimal(5, 2)   // Default margin %
  is_active       Boolean @default(true)
  
  client_services ClientService[]  // M:N to clients
}

// ClientService junction: Per-client customization
model ClientService {
  client_id   String
  service_id  String
  custom_rate Decimal? @db.Decimal(10, 2)  // Override rate for this client
  rate_type   RateType?  // Override rate type
  
  client  Client
  service Service
  
  @@id([client_id, service_id])
}
```

**Rationale**:
- ✅ Templates ensure naming consistency (all clients use "Marketing" not variations)
- ✅ Customization allows per-client pricing (Acme pays $7k, Beta pays $5k for same service)
- ✅ Easy to add new service templates organization-wide
- ✅ Historical data preserved even if template deleted (soft delete)

**Alternatives Considered**:
- Client-specific services only (no templates): Rejected - causes naming inconsistency, harder to report
- Fixed pricing (no customization): Rejected - doesn't match real pricing model

**Trade-offs**:
- ⚠️ Requires join query to get client services with rates (acceptable performance cost)
- ✅ UI can show "Marketing (custom $7k)" vs "Marketing (standard $5k)"

---

### Decision 2: Subscription Allocation - Hybrid Seat-Based + Percentage-Based

**Context**: Different subscription types require different allocation methods (Salesforce has seats, Adobe is shared).

**Decision**: Single `SubscriptionAllocation` table supporting both allocation types via discriminated union.

**Implementation**:
```typescript
model SubscriptionAllocation {
  id                    String @id @default(uuid())
  subscription_id       String
  client_id             String?  // Allocate to client...
  staff_id              String?  // ...OR to staff (not both)
  allocation_type       AllocationType  // SEAT_BASED | PERCENTAGE_BASED
  seats_allocated       Int?     // Required if SEAT_BASED
  percentage_allocated  Decimal? // Required if PERCENTAGE_BASED
  cost_allocated        Decimal  // Calculated field
  
  // Validation: Either client_id OR staff_id must be set
  // Validation: If SEAT_BASED, seats_allocated required
  // Validation: If PERCENTAGE_BASED, percentage_allocated required
}

enum AllocationType {
  SEAT_BASED       // Allocate exact seats (e.g., Salesforce)
  PERCENTAGE_BASED // Allocate percentage (e.g., Adobe)
}
```

**Calculation Logic**:
```typescript
async function calculateAllocatedCost(allocation: SubscriptionAllocation): Promise<Decimal> {
  const subscription = await getSubscription(allocation.subscription_id);
  
  if (allocation.allocation_type === 'SEAT_BASED') {
    const costPerSeat = subscription.total_cost / subscription.total_seats;
    return costPerSeat * allocation.seats_allocated;
  } else {
    return subscription.total_cost * (allocation.percentage_allocated / 100);
  }
}
```

**Validation Rules**:
- Seat-based: Sum of seats_allocated ≤ subscription.total_seats (hard constraint)
- Percentage-based: Sum of percentage_allocated can exceed 100% (warn only, shared tools)

**Rationale**:
- ✅ Single table reduces complexity (vs 2 separate allocation tables)
- ✅ Supports both allocation methods as confirmed by user
- ✅ Clear validation rules per allocation type
- ✅ Cost calculation logic encapsulated

**Trade-offs**:
- ⚠️ Nullable fields require validation (mitigated by Zod schemas)
- ✅ Flexible for future allocation types (e.g., usage-based)

---

### Decision 3: Agency Monthly Breakdown - JSONB for Variable Composition

**Context**: Agency partner staffing mix changes monthly (Month 1: 2 BDRs + 1 Admin, Month 2: 3 BDRs). Need historical tracking.

**Decision**: Use JSONB field for breakdown with calculated summary fields.

**Implementation**:
```typescript
model AgencyMonthlyBreakdown {
  id              String @id @default(uuid())
  agency_id       String
  month           Int    // 1-12
  year            Int    // 2026
  breakdown       Json   // JSONB: [{name, role, cost}, ...]
  breakdown_total Decimal @db.Decimal(10, 2)  // Sum of costs
  variance        Decimal @db.Decimal(10, 2)  // breakdown_total - agency.monthly_payment
  
  agency Agency
  
  @@unique([agency_id, month, year])
  @@index([agency_id, year, month(sort: Desc)])
}

// Example breakdown JSON:
{
  "breakdown": [
    {"name": "Mike Chen", "role": "BDR", "cost": 6000},
    {"name": "Sarah Lee", "role": "BDR", "cost": 6000},
    {"name": "Admin Staff", "role": "Admin", "cost": 3000}
  ],
  "breakdown_total": 15000,
  "variance": 0
}
```

**Rationale**:
- ✅ JSONB allows variable staffing (flexible array length)
- ✅ Can query for specific roles: `breakdown @> '[{"role": "BDR"}]'::jsonb`
- ✅ Historical snapshots easy to browse (monthly records)
- ✅ Computed fields (breakdown_total, variance) optimize common queries

**Alternatives Considered**:
- Normalized tables (AgencyStaffMember with monthly snapshots): Rejected - overly complex for read-heavy use case
- Single JSONB field without computed fields: Rejected - requires aggregation on every query

**Trade-offs**:
- ⚠️ JSONB queries less intuitive than SQL JOINs (acceptable for this use case)
- ✅ Flexibility for future fields (e.g., hourly_rate, engagement_type per staff)

---

### Decision 4: BDR Productivity Metrics - Separate Time-Series Table

**Context**: Track "meetings booked that show up" per BDR per month, optionally per client.

**Decision**: Dedicated `BDRProductivityMetric` table with composite unique constraint.

**Implementation**:
```typescript
model BDRProductivityMetric {
  id                String @id @default(uuid())
  bdr_id            String
  client_id         String?  // Nullable: aggregate metric if NULL
  month             Int      // 1-12
  year              Int      // 2026
  meetings_attended Int      // Count of qualified meetings
  
  bdr    Staff  @relation(fields: [bdr_id], references: [id])
  client Client? @relation(fields: [client_id], references: [id])
  
  @@unique([bdr_id, client_id, month, year])
  @@index([bdr_id, year, month(sort: Desc)])
  @@index([client_id, year, month(sort: Desc)])
}
```

**Querying Patterns**:
```typescript
// Total meetings for BDR across all clients
SELECT SUM(meetings_attended) FROM BDRProductivityMetric 
WHERE bdr_id = ? AND year = 2026 AND month = 2;

// Meetings per client for BDR
SELECT client_id, meetings_attended FROM BDRProductivityMetric
WHERE bdr_id = ? AND year = 2026 AND month = 2 AND client_id IS NOT NULL;
```

**Rationale**:
- ✅ Time-series table optimized for trend analysis
- ✅ Composite unique constraint prevents duplicate entry
- ✅ client_id nullable allows both aggregate and per-client tracking
- ✅ Supports retroactive entry (any month/year)

**Trade-offs**:
- ✅ Clean separation of concerns (metrics vs core data)
- ⚠️ Requires manual entry initially (calendar integration is future enhancement)

---

### Decision 5: ROI Calculation - Pre-Calculated Snapshots with On-Demand Refresh

**Context**: Need to display client ROI% and Margin% quickly for 100+ clients in dashboard.

**Decision**: Pre-calculated monthly snapshots with manual refresh capability.

**Implementation**:
```typescript
model ClientROI {
  id                 String @id @default(uuid())
  client_id          String
  month              Int
  year               Int
  revenue            Decimal @db.Decimal(10, 2)  // From Xero invoices
  total_costs        Decimal @db.Decimal(10, 2)  // Sum of all costs
  profit             Decimal @db.Decimal(10, 2)  // revenue - total_costs
  roi_percentage     Decimal @db.Decimal(5, 2)   // (profit / total_costs) * 100
  margin_percentage  Decimal @db.Decimal(5, 2)   // (profit / revenue) * 100
  calculated_at      DateTime
  
  client Client
  
  @@unique([client_id, month, year])
  @@index([client_id, year, month(sort: Desc)])
  @@index([margin_percentage])  // For sorting dashboard by margin
}

// Similar structure for BDRROI
model BDRROI {
  id                      String @id @default(uuid())
  bdr_id                  String
  month                   Int
  year                    Int
  revenue_attributed      Decimal  // Client revenue * allocation %
  bdr_cost                Decimal  // BDR monthly rate
  profit                  Decimal
  roi_percentage          Decimal
  margin_percentage       Decimal
  meetings_attended_total Int      // From BDRProductivityMetric
  calculated_at           DateTime
  
  bdr Staff
  
  @@unique([bdr_id, month, year])
}
```

**Calculation Trigger**:
```typescript
// Triggered by:
// 1. Xero sync completes (revenue updated)
// 2. Staff assignment changed (costs updated)
// 3. Subscription allocation changed (costs updated)
// 4. Manual "Refresh ROI" button click
async function refreshClientROI(clientId: string, month: number, year: number) {
  const revenue = await getClientRevenue(clientId, month, year);  // From Xero
  const costs = await calculateClientCosts(clientId, month, year);  // Sum all cost types
  
  const profit = revenue - costs;
  const roi = costs > 0 ? (profit / costs) * 100 : 0;
  const margin = revenue > 0 ? (profit / revenue) * 100 : 0;
  
  await prisma.clientROI.upsert({
    where: { client_id_month_year: { client_id: clientId, month, year } },
    update: { revenue, total_costs: costs, profit, roi_percentage: roi, margin_percentage: margin, calculated_at: new Date() },
    create: { client_id: clientId, month, year, revenue, total_costs: costs, profit, roi_percentage: roi, margin_percentage: margin, calculated_at: new Date() }
  });
}
```

**Rationale**:
- ✅ Fast dashboard loads (<2s for 100 clients) - no real-time calculations
- ✅ Historical trend data built-in (monthly snapshots)
- ✅ calculated_at timestamp shows data freshness
- ✅ Manual refresh allows on-demand recalculation

**Alternatives Considered**:
- Real-time calculation: Rejected - too slow for dashboard, requires complex joins
- Materialized views: Rejected - Supabase doesn't support automatic refresh

**Trade-offs**:
- ⚠️ Data can be stale (shows "Last calculated 2 days ago" warning)
- ✅ User has control over when to refresh (trade accuracy for speed)

---

### Decision 6: Staff Model - Unified Table with Type Discriminator

**Context**: Need to track 4 staff types (BDR, Admin, Contractor, Agency Staff) with shared fields (name, rate) and type-specific fields (agency_id for agency staff).

**Decision**: Single `Staff` table with `staff_type` enum and nullable type-specific fields.

**Implementation**:
```typescript
model Staff {
  id              String @id @default(uuid())
  organization_id String
  agency_id       String?  // Only for staff_type = AGENCY_STAFF
  name            String
  staff_type      StaffType
  rate            Decimal @db.Decimal(10, 2)
  rate_type       RateType
  engagement_type EngagementType
  deleted_at      DateTime?
  
  organization    Organization
  agency          Agency?
  assignments     StaffAssignment[]  // M:N to clients
  productivity    BDRProductivityMetric[]  // Only for staff_type = BDR
  roi_metrics     BDRROI[]  // Only for staff_type = BDR
  
  @@index([organization_id, staff_type])
  @@index([agency_id])
}

enum StaffType {
  BDR           // Business Development Representative
  ADMIN         // Administrative staff
  CONTRACTOR    // Individual contractor
  AGENCY_STAFF  // Staff from agency partner
}
```

**Rationale**:
- ✅ Single table simplifies queries (all staff in one place)
- ✅ Easy to add new staff types in future
- ✅ Shared fields (name, rate) avoid duplication
- ✅ Nullable fields allow type-specific data

**Alternatives Considered**:
- Separate tables per type (BDR, Admin, Contractor, AgencyStaff): Rejected - complex queries, harder to report across all staff
- Polymorphic associations: Rejected - not well-supported in Prisma

**Trade-offs**:
- ⚠️ Nullable fields require validation (e.g., agency_id must be set if staff_type = AGENCY_STAFF)
- ✅ Queries can filter by staff_type easily: `WHERE staff_type = 'BDR'`

---

## Data Model Overview

### New Tables (12 Total)

**Core Entities:**
1. **Client** - Client records with margin targets and status
2. **Service** - Service templates with base rates
3. **ClientService** - M:N junction with per-client customization

**Staff Management:**
4. **Staff** - Unified staff table (BDR, Admin, Contractor, Agency Staff)
5. **StaffAssignment** - M:N BDR/contractor-to-client assignments
6. **Agency** - Agency partner records
7. **AgencyMonthlyBreakdown** - Variable monthly staffing composition

**Subscription Tracking:**
8. **Subscription** - SaaS subscription records
9. **SubscriptionAllocation** - Hybrid seat/percentage allocation

**Performance Metrics:**
10. **BDRProductivityMetric** - Meetings attended per BDR per month
11. **ClientROI** - Pre-calculated client profitability snapshots
12. **BDRROI** - Pre-calculated BDR profitability snapshots

**New Enums (4 Total):**
- StaffType (BDR, ADMIN, CONTRACTOR, AGENCY_STAFF)
- AllocationType (SEAT_BASED, PERCENTAGE_BASED)
- Plus reused from existing schema: ClientStatus, RelationshipType, RateType, EngagementType

### Relationships

```
Organization (1) ─── (N) Client
                └── (N) Service
                └── (N) Staff
                └── (N) Agency
                └── (N) Subscription

Client (N) ─── (N) Service (via ClientService junction)
       (1) ─── (N) StaffAssignment
       (1) ─── (N) SubscriptionAllocation
       (1) ─── (N) BDRProductivityMetric
       (1) ─── (N) ClientROI

Staff (1) ─── (N) StaffAssignment
      (N) ─── (1) Agency (for agency staff)
      (1) ─── (N) BDRProductivityMetric (if staff_type = BDR)
      (1) ─── (N) BDRROI (if staff_type = BDR)
      (1) ─── (N) SubscriptionAllocation

Subscription (1) ─── (N) SubscriptionAllocation

Agency (1) ─── (N) Staff (agency staff)
       (1) ─── (N) AgencyMonthlyBreakdown
```

### Indexes Strategy

**Organization Scoping:**
- All tables: `@@index([organization_id])`

**Performance Optimization:**
- Staff: `@@index([organization_id, staff_type])` - Filter by type
- StaffAssignment: `@@index([staff_id, client_id])` - Lookup assignments
- ClientROI: `@@index([margin_percentage])` - Sort dashboard by margin
- BDRProductivityMetric: `@@index([bdr_id, year, month])` - Time-series queries
- AgencyMonthlyBreakdown: `@@index([agency_id, year, month])` - Historical lookup

**Soft Delete Support:**
- Queries: `WHERE deleted_at IS NULL`
- Historical reports: Include deleted records

---

## Implementation Phases

### Phase 0: Research & Design (Days 1-2)

**Objective**: Resolve all [NEEDS CLARIFICATION] items and finalize technical decisions.

**Tasks**:
1. Research R1: JSONB vs normalized tables for agency breakdown (performance benchmarks)
2. Research R2: ROI calculation strategies (real-time vs snapshots)
3. Research R3: Multi-select allocation UI patterns (component library exploration)
4. Research R4: Subscription allocation validation UX
5. Research R5: JSONB indexing strategies for agency breakdown queries
6. Research R6: CSV export performance (server-side streaming)
7. Document findings in `research.md`
8. Update plan.md with final decisions
9. Create data-model.md with full schema diagrams
10. Generate contracts/server-actions.md with API signatures

**Deliverables**:
- research.md (all R1-R6 documented)
- data-model.md (12 tables, 4 enums, relationships, indexes)
- contracts/server-actions.md (15-20 server actions defined)

---

### Phase 1: Database Schema & Migrations (Days 3-4)

**Objective**: Create Prisma schema for all 12 tables and apply migrations.

**Tasks**:
1. Verify database connection: `npx prisma migrate status`
2. Add enums to prisma/schema.prisma (StaffType, AllocationType)
3. Create Client model with fields from spec
4. Create Service model (templates)
5. Create ClientService junction model
6. Create Staff model (unified with staff_type)
7. Create StaffAssignment model (M:N)
8. Create Agency model
9. Create AgencyMonthlyBreakdown model (JSONB)
10. Create Subscription model
11. Create SubscriptionAllocation model (hybrid)
12. Create BDRProductivityMetric model
13. Create ClientROI model (pre-calculated)
14. Create BDRROI model (pre-calculated)
15. Add all indexes per strategy
16. Run `npx prisma migrate dev --name add_client_staff_management`
17. Run `npx prisma generate`
18. Create Supabase RLS policies for all 12 tables
19. Test RLS policies with multi-tenant data
20. Seed development database with sample data

**Deliverables**:
- prisma/schema.prisma updated
- prisma/migrations/[timestamp]_add_client_staff_management/ created
- supabase/sql/rls-policies-client-staff.sql created
- Prisma Client regenerated

---

### Phase 2: Validation Schemas (Day 5)

**Objective**: Create Zod schemas for all input validation.

**Tasks**:
1. Create lib/validations/client.ts (createClientSchema, updateClientSchema)
2. Create lib/validations/service.ts (createServiceSchema, assignServiceSchema)
3. Create lib/validations/staff.ts (createStaffSchema, createAssignmentSchema)
4. Create lib/validations/subscription.ts (createSubscriptionSchema, createAllocationSchema)
5. Create lib/validations/agency.ts (createAgencySchema, createBreakdownSchema)
6. Create lib/validations/productivity.ts (createProductivityMetricSchema)
7. Add custom validators (allocation % sum, seat constraints, date ranges)
8. Unit tests for all validation schemas

**Deliverables**:
- lib/validations/*.ts (6 files)
- Comprehensive validation coverage

---

### Phase 3: Client & Service Management (Days 6-7)

**Objective**: Implement client CRUD and service template system.

**Tasks**:
1. Create app/actions/client-management.ts (createClient, getClients, getClientById, updateClient, softDeleteClient)
2. Create app/actions/service-management.ts (createService, getServices, assignServiceToClient, removeServiceFromClient)
3. Create app/dashboard/clients/page.tsx (client list with search, filter, pagination)
4. Create app/dashboard/clients/[id]/page.tsx (client detail view)
5. Create components/clients/AddClientWizard.tsx (multi-step form)
6. Create components/clients/AssignServicesModal.tsx (service selection + customization)
7. Create components/services/ServiceTemplateList.tsx
8. Create components/services/CreateServiceModal.tsx
9. Implement search functionality (client name partial match)
10. Implement filters (status, relationship type, margin range)
11. Add sorting (name, margin%, revenue)
12. Test client-service assignment flow

**Deliverables**:
- Client management UI complete
- Service template system functional
- Client-service assignment working

---

### Phase 4: Staff Management & Assignments (Days 8-9)

**Objective**: Implement staff CRUD and M:N assignment logic.

**Tasks**:
1. Create app/actions/staff-management.ts (createStaff, getStaff, createAssignment, endAssignment)
2. Create app/dashboard/staff/page.tsx (staff list filtered by type)
3. Create components/staff/AddStaffModal.tsx (with staff type selection)
4. Create components/staff/AssignBDRModal.tsx (multi-client assignment with allocation %)
5. Create components/staff/StaffAssignmentTable.tsx (shows assignments per staff)
6. Create components/clients/ClientStaffTable.tsx (shows staff assigned to client)
7. Implement allocation % validation (warn if >100%)
8. Add BDR productivity tracking UI (manual entry)
9. Create components/staff/ProductivityEntryModal.tsx
10. Test BDR multi-client assignment flow
11. Test contractor assignment flow
12. Test allocation % calculations

**Deliverables**:
- Staff management UI complete
- BDR/contractor assignment working
- Allocation % tracking functional

---

### Phase 5: Subscription Management & Allocation (Day 10)

**Objective**: Implement subscription tracking and hybrid allocation engine.

**Tasks**:
1. Create app/actions/subscription-management.ts (createSubscription, createAllocation, calculateAllocatedCost)
2. Create app/dashboard/subscriptions/page.tsx (subscription list)
3. Create components/subscriptions/AddSubscriptionModal.tsx
4. Create components/subscriptions/AllocateSubscriptionModal.tsx (hybrid seat/percentage UI)
5. Implement seat-based allocation (with seat constraint validation)
6. Implement percentage-based allocation (with warning if >100%)
7. Create allocation summary view (shows cost per client/staff)
8. Add "unutilized cost" indicator
9. Test seat allocation (Salesforce example)
10. Test percentage allocation (Adobe example)
11. Test constraint validation

**Deliverables**:
- Subscription management UI complete
- Hybrid allocation engine working
- Cost attribution accurate

---

### Phase 6: Agency Partner Management (Day 11)

**Objective**: Implement agency partner tracking with variable monthly breakdown.

**Tasks**:
1. Create app/actions/agency-management.ts (createAgency, createMonthlyBreakdown, getBreakdownHistory)
2. Create app/dashboard/agencies/page.tsx (agency list)
3. Create components/agencies/AddAgencyModal.tsx
4. Create components/agencies/MonthlyBreakdownForm.tsx (JSONB entry UI)
5. Create components/agencies/BreakdownHistoryTable.tsx
6. Implement breakdown total calculation
7. Implement variance display (breakdown - payment)
8. Add historical breakdown querying
9. Test variable staffing entry (Month 1: 2 BDRs + 1 Admin, Month 2: 3 BDRs)
10. Test agency staff assignment to clients

**Deliverables**:
- Agency partner management complete
- Variable breakdown tracking functional
- Historical data queryable

---

### Phase 7: ROI Calculation Engines (Day 12)

**Objective**: Implement dual ROI calculation for clients and BDRs.

**Tasks**:
1. Create lib/calculations/client-roi.ts (refreshClientROI, calculateClientCosts)
2. Create lib/calculations/bdr-roi.ts (refreshBDRROI, calculateAttributedRevenue)
3. Implement cost aggregation (BDRs + contractors + subscriptions + services)
4. Implement revenue attribution (Xero invoices → clients)
5. Implement BDR revenue attribution (client revenue × allocation %)
6. Add edge case handling (zero revenue, zero costs)
7. Create app/actions/roi-management.ts (refreshROI endpoint)
8. Add "Refresh ROI" button to portfolio dashboard
9. Test client ROI calculation
10. Test BDR ROI calculation
11. Test historical trend queries

**Deliverables**:
- Client ROI engine complete
- BDR ROI engine complete
- Dual metrics (ROI% + Margin%) calculated

---

### Phase 8: Portfolio Dashboard & Reports (Day 13)

**Objective**: Build portfolio overview with sorting, filtering, and export.

**Tasks**:
1. Create app/dashboard/portfolio/page.tsx (main dashboard)
2. Create components/portfolio/ClientTable.tsx (sortable, filterable)
3. Create components/portfolio/PortfolioSummaryCards.tsx (total clients, avg margin, etc.)
4. Create components/portfolio/BDRPerformanceTable.tsx
5. Implement client search (name partial match)
6. Implement filters (status, margin range, relationship type)
7. Implement sorting (name, revenue, costs, margin%, ROI%)
8. Create app/api/export/clients/route.ts (CSV generation)
9. Create components/portfolio/ExportButton.tsx
10. Implement CSV export with filters applied
11. Add "Last calculated" timestamp to ROI displays
12. Test portfolio dashboard with 100+ clients
13. Test CSV export performance

**Deliverables**:
- Portfolio dashboard complete
- Filtering, sorting, search working
- CSV export functional

---

### Phase 9: Testing & Documentation (Day 14)

**Objective**: Comprehensive testing and documentation.

**Tasks**:
1. Unit tests for ROI calculation engines
2. Unit tests for allocation logic (subscriptions)
3. Unit tests for validation schemas
4. Integration tests for server actions (createClient, assignBDR, etc.)
5. E2E test: Client onboarding flow
6. E2E test: BDR assignment flow
7. E2E test: Subscription allocation flow
8. E2E test: ROI calculation and dashboard viewing
9. Performance test: Portfolio dashboard with 500 clients
10. Update quickstart.md with development workflows
11. Document API contracts in contracts/server-actions.md
12. Code review and refactoring

**Deliverables**:
- Test coverage >80%
- All E2E tests passing
- Documentation complete

---

## Success Criteria

**Functional Completeness:**
- ✅ All 17 functional requirements (FR-1 through FR-17) implemented
- ✅ All 12 data requirements (DR-1 through DR-12) in database
- ✅ All 7 user scenarios from spec working end-to-end
- ✅ All 8 edge cases handled gracefully

**Performance Targets:**
- ✅ Client ROI displays in <2 seconds for 100 clients
- ✅ Portfolio search results in <1 second for 500 records
- ✅ Client onboarding completes in <5 minutes
- ✅ CSV export generates in <10 seconds for 500 clients

**Quality Standards:**
- ✅ TypeScript strict mode (no any types)
- ✅ All server actions have Zod validation
- ✅ Test coverage >80% for calculation engines
- ✅ E2E tests cover all critical user flows
- ✅ RLS policies enforce organization isolation
- ✅ Soft deletes preserve historical data

**Constitution Compliance:**
- ✅ All database changes follow Principle #8 (pooler URLs, migration workflow)
- ✅ Multi-tenancy enforced via RLS
- ✅ No direct database access from client components
- ✅ All sensitive data handled securely

---

## Risks & Mitigation

**Risk 1: Complex Data Model**
- Impact: 12 new tables with 7 M:N relationships may be error-prone
- Mitigation: Comprehensive unit tests, strict validation schemas, careful migration review

**Risk 2: ROI Calculation Performance**
- Impact: Real-time ROI calculation for 100+ clients may be slow
- Mitigation: Pre-calculated snapshots with manual refresh, indexed margin_percentage for sorting

**Risk 3: JSONB Query Complexity**
- Impact: Agency breakdown queries may be unintuitive
- Mitigation: GIN indexes, computed fields (breakdown_total), clear documentation

**Risk 4: Subscription Allocation Edge Cases**
- Impact: User could over-allocate seats or percentages
- Mitigation: Hard constraints for seats (block save), soft warnings for percentages (show alert)

**Risk 5: Migration Size**
- Impact: 12 tables in one migration may fail or cause production downtime
- Mitigation: Test migration on staging first, backup production data, consider splitting into 2 migrations if needed

---

## Next Steps

1. ✅ Complete Phase 0 research (resolve R1-R6)
2. ✅ Generate data-model.md with full schema
3. ✅ Generate contracts/server-actions.md
4. ✅ Update agent context with new technology
5. ⏭️ Begin Phase 1 implementation (database schema)
6. ⏭️ Create task breakdown in tasks.md
7. ⏭️ Execute implementation phases 1-9

**Plan Status**: Ready for Phase 0 research and design work.
