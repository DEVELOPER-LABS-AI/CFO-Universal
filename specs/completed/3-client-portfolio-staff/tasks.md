# Implementation Tasks: Client Portfolio & Staff Management

**Feature**: Client Portfolio & Staff Management
**Branch**: 3-client-portfolio-staff
**Created**: 2026-02-16
**Status**: Ready for Implementation

---

## Overview

This document provides a complete task breakdown for implementing Feature 3: Client Portfolio & Staff Management. Tasks are organized by user story to enable independent, incremental delivery.

**Total Tasks**: 145
**User Stories**: 7
**Estimated Duration**: 10-14 days

---

## Task Summary by User Story

| User Story | Description | Tasks | Can Start After |
|------------|-------------|-------|-----------------|
| Setup | Project initialization & database schema | 35 | Immediately |
| Foundational | Validation schemas & shared utilities | 15 | Setup complete |
| US1 | Client & Service Management | 18 | Foundational complete |
| US2 | Staff Management & BDR Assignments | 20 | Foundational complete |
| US3 | Subscription Management & Allocation | 15 | Foundational complete |
| US4 | Agency Partner Management | 13 | Foundational complete |
| US5 | Portfolio Dashboard & Client ROI | 16 | US1, US2, US3, US4 complete |
| US6 | BDR Performance & ROI Tracking | 8 | US2, US5 complete |
| US7 | CSV Export & Reporting | 5 | US5 complete |

**Parallel Opportunities**: US1, US2, US3, US4 can be developed in parallel after Foundational phase

---

## Implementation Strategy

### MVP Scope (Recommended)
- **Phase 1**: Setup + Foundational (35 + 15 = 50 tasks)
- **Phase 2**: US1 (Client & Service Management) - 18 tasks
- **Total MVP**: 68 tasks, ~4-5 days

This provides a working client management system that can be deployed and validated before building additional features.

### Full Feature Delivery
- **Week 1**: Setup, Foundational, US1 (68 tasks)
- **Week 2**: US2, US3, US4 in parallel (48 tasks)
- **Week 3**: US5, US6, US7 sequentially (29 tasks)

---

## Phase 1: Setup & Database Schema

**Objective**: Initialize database schema for all 12 tables with RLS policies

**Prerequisites**: Phase 0 research complete, design documents finalized

**Tasks**:

- [ ] T001 Verify Supabase database connection with `npx prisma migrate status`
- [ ] T002 [P] Add StaffType enum (BDR, ADMIN, CONTRACTOR, AGENCY_STAFF) to prisma/schema.prisma
- [ ] T003 [P] Add AllocationType enum (SEAT_BASED, PERCENTAGE_BASED) to prisma/schema.prisma
- [ ] T004 [P] Create Client model in prisma/schema.prisma with fields: id, organization_id, name, status, relationship_type, custom_margin_target, start_date, churn_date, created_at, updated_at, deleted_at
- [ ] T005 [P] Add Client indexes: organization_id, status, (organization_id, name) unique for non-deleted
- [ ] T006 [P] Create Service model in prisma/schema.prisma with fields: id, organization_id, name, description, standard_rate, target_margin, is_active, created_at, updated_at, deleted_at
- [ ] T007 [P] Add Service indexes: organization_id, (organization_id, is_active)
- [ ] T008 [P] Create ClientService junction model in prisma/schema.prisma with fields: client_id, service_id, custom_rate, rate_type, composite PK
- [ ] T009 [P] Add ClientService indexes: client_id, service_id
- [ ] T010 [P] Create Staff model in prisma/schema.prisma with fields: id, organization_id, agency_id, name, staff_type, rate, rate_type, engagement_type, created_at, updated_at, deleted_at
- [ ] T011 [P] Add Staff indexes: organization_id, (organization_id, staff_type), agency_id
- [ ] T012 [P] Create StaffAssignment model in prisma/schema.prisma with fields: id, staff_id, client_id, allocation_percentage, start_date, end_date, created_at, updated_at
- [ ] T013 [P] Add StaffAssignment indexes: staff_id, client_id, (staff_id, client_id), (start_date, end_date)
- [ ] T014 [P] Create Subscription model in prisma/schema.prisma with fields: id, organization_id, name, total_cost, total_seats, billing_frequency, is_active, created_at, updated_at, deleted_at
- [ ] T015 [P] Add Subscription indexes: organization_id, (organization_id, is_active)
- [ ] T016 [P] Create SubscriptionAllocation model in prisma/schema.prisma with fields: id, subscription_id, client_id, staff_id, allocation_type, seats_allocated, percentage_allocated, cost_allocated, created_at, updated_at
- [ ] T017 [P] Add SubscriptionAllocation indexes: subscription_id, client_id, staff_id
- [ ] T018 [P] Create Agency model in prisma/schema.prisma with fields: id, organization_id, name, monthly_payment, start_date, created_at, updated_at, deleted_at
- [ ] T019 [P] Add Agency indexes: organization_id
- [ ] T020 [P] Create AgencyMonthlyBreakdown model in prisma/schema.prisma with fields: id, agency_id, month, year, breakdown (JSONB), breakdown_total, variance, created_at, updated_at, unique (agency_id, month, year)
- [ ] T021 [P] Add AgencyMonthlyBreakdown indexes: (agency_id, year, month DESC)
- [ ] T022 [P] Create BDRProductivityMetric model in prisma/schema.prisma with fields: id, bdr_id, client_id, month, year, meetings_attended, created_at, updated_at, unique (bdr_id, client_id, month, year)
- [ ] T023 [P] Add BDRProductivityMetric indexes: (bdr_id, year, month DESC), (client_id, year, month DESC)
- [ ] T024 [P] Create ClientROI model in prisma/schema.prisma with fields: id, client_id, month, year, revenue, total_costs, profit, roi_percentage, margin_percentage, bdr_costs, contractor_costs, subscription_costs, service_costs, calculated_at, unique (client_id, month, year)
- [ ] T025 [P] Add ClientROI indexes: (client_id, year, month DESC), margin_percentage, roi_percentage
- [ ] T026 [P] Create BDRROI model in prisma/schema.prisma with fields: id, bdr_id, month, year, revenue_attributed, bdr_cost, profit, roi_percentage, margin_percentage, meetings_attended_total, calculated_at, unique (bdr_id, month, year)
- [ ] T027 [P] Add BDRROI indexes: (bdr_id, year, month DESC), roi_percentage, margin_percentage
- [ ] T028 Run `npx prisma migrate dev --name add_client_staff_management` to generate migration
- [ ] T029 Review generated migration file in prisma/migrations/ for correctness
- [ ] T030 Run `npx prisma generate` to update Prisma Client with new models
- [ ] T031 [P] Create RLS policy for Client table in supabase/sql/rls-policies-client-staff.sql with organization isolation
- [ ] T032 [P] Create RLS policies for Service, ClientService tables in supabase/sql/rls-policies-client-staff.sql
- [ ] T033 [P] Create RLS policies for Staff, StaffAssignment tables in supabase/sql/rls-policies-client-staff.sql
- [ ] T034 [P] Create RLS policies for Subscription, SubscriptionAllocation tables in supabase/sql/rls-policies-client-staff.sql
- [ ] T035 [P] Create RLS policies for Agency, AgencyMonthlyBreakdown tables in supabase/sql/rls-policies-client-staff.sql
- [ ] T036 [P] Create RLS policies for BDRProductivityMetric, ClientROI, BDRROI tables in supabase/sql/rls-policies-client-staff.sql
- [ ] T037 Execute RLS policies SQL file on Supabase database
- [ ] T038 Create seed data script in prisma/seed-client-staff.ts with sample clients, services, staff
- [ ] T039 Run `npx prisma db seed` to populate development database
- [ ] T040 Verify RLS policies with multi-tenant test queries

**Deliverables**:
- ✅ 12 new Prisma models with proper indexes
- ✅ Migration applied to database
- ✅ RLS policies enforcing organization isolation
- ✅ Seed data for development testing

---

## Phase 2: Foundational - Validation Schemas

**Objective**: Create reusable Zod validation schemas for all entities

**Prerequisites**: Phase 1 complete (database schema exists)

**Tasks**:

- [X] T041 [P] Create CreateClientSchema in lib/validations/client.ts with fields: name, relationship_type, custom_margin_target, start_date
- [X] T042 [P] Create UpdateClientSchema in lib/validations/client.ts with optional fields and churn_date validation
- [X] T043 [P] Create GetClientsSchema in lib/validations/client.ts with pagination, filters, sorting params
- [X] T044 [P] Create CreateServiceSchema in lib/validations/service.ts with fields: name, description, standard_rate, target_margin
- [X] T045 [P] Create AssignServiceSchema in lib/validations/service.ts with fields: client_id, service_id, custom_rate
- [X] T046 [P] Create CreateStaffSchema in lib/validations/staff.ts with fields: name, staff_type, rate, rate_type, engagement_type, agency_id
- [X] T047 [P] Add custom validator to CreateStaffSchema: if staff_type = AGENCY_STAFF, agency_id required
- [X] T048 [P] Create CreateStaffAssignmentSchema in lib/validations/staff.ts with fields: staff_id, client_id, allocation_percentage, start_date
- [X] T049 [P] Create CreateSubscriptionSchema in lib/validations/subscription.ts with fields: name, total_cost, total_seats, billing_frequency
- [X] T050 [P] Create CreateSubscriptionAllocationSchema in lib/validations/subscription.ts with hybrid allocation support
- [X] T051 [P] Add custom validators to CreateSubscriptionAllocationSchema: XOR(client_id, staff_id), allocation type validation
- [X] T052 [P] Create CreateAgencySchema in lib/validations/agency.ts with fields: name, monthly_payment, start_date
- [X] T053 [P] Create CreateAgencyMonthlyBreakdownSchema in lib/validations/agency.ts with JSONB breakdown structure
- [X] T054 [P] Create RecordBDRProductivitySchema in lib/validations/productivity.ts with fields: bdr_id, client_id, month, year, meetings_attended
- [X] T055 [P] Create RefreshClientROISchema and RefreshBDRROISchema in lib/validations/roi.ts with fields: id, month, year

**Deliverables**:
- ✅ Complete validation schema library (6 files)
- ✅ Type-safe input validation for all operations
- ✅ Custom cross-field validators

---

## Phase 3: User Story 1 - Client & Service Management

**User Story**: Finance Admin adds new client with service templates

**Goal**: Enable admins to onboard clients with customized services and margin targets

**Independent Test Criteria**:
- ✅ Can create a client with name, relationship type, margin target
- ✅ Can assign service template to client with custom rate
- ✅ Can view client list with search and filters
- ✅ Can view client detail with all assigned services
- ✅ Client appears in portfolio after creation

**Tasks**:

- [X] T056 [US1] Create createClient server action in app/actions/client-management.ts using CreateClientSchema
- [X] T057 [US1] Create getClients server action in app/actions/client-management.ts with pagination and filters
- [X] T058 [US1] Create getClientById server action in app/actions/client-management.ts with service inclusions
- [X] T059 [US1] Create updateClient server action in app/actions/client-management.ts with churn date validation
- [X] T060 [US1] Create softDeleteClient server action in app/actions/client-management.ts setting deleted_at
- [X] T061 [US1] Create createService server action in app/actions/service-management.ts using CreateServiceSchema
- [X] T062 [US1] Create getServices server action in app/actions/service-management.ts with active filter
- [X] T063 [US1] Create assignServiceToClient server action in app/actions/service-management.ts preventing duplicates
- [X] T064 [US1] Create removeServiceFromClient server action in app/actions/service-management.ts
- [X] T065 [US1] Create client list page in app/dashboard/clients/page.tsx with server component
- [X] T066 [US1] Create ClientTable component in components/clients/ClientTable.tsx with sorting, filtering, pagination
- [X] T067 [US1] Create AddClientWizard component in components/clients/AddClientWizard.tsx with multi-step form
- [X] T068 [US1] Create client detail page in app/dashboard/clients/[id]/page.tsx showing services
- [X] T069 [US1] Create AssignServicesModal component in components/clients/AssignServicesModal.tsx with service selection and custom rate input
- [X] T070 [US1] Create ServiceTemplateList component in components/services/ServiceTemplateList.tsx
- [X] T071 [US1] Create CreateServiceModal component in components/services/CreateServiceModal.tsx
- [X] T072 [US1] Implement client search by name (partial match, case-insensitive) in getClients action
- [X] T073 [US1] Implement client filters (status, relationship type, margin range) in ClientTable component

**API Endpoints Created**:
- POST /api/actions/createClient
- GET /api/actions/getClients
- GET /api/actions/getClientById
- PUT /api/actions/updateClient
- DELETE /api/actions/softDeleteClient
- POST /api/actions/createService
- GET /api/actions/getServices
- POST /api/actions/assignServiceToClient
- DELETE /api/actions/removeServiceFromClient

**Deliverables**:
- ✅ Client CRUD operations complete
- ✅ Service template system functional
- ✅ Client-service assignment working
- ✅ UI for client management

---

## Phase 4: User Story 2 - Staff Management & BDR Assignments

**User Story**: Finance Admin assigns BDR to multiple clients with percentage splits

**Goal**: Allocate BDRs across clients with proper cost attribution

**Independent Test Criteria**:
- ✅ Can add BDR with monthly rate
- ✅ Can assign BDR to multiple clients with allocation percentages
- ✅ System calculates costs per client (rate × allocation%)
- ✅ Warning shown if total allocation >100%
- ✅ Can view staff utilization across clients

**Tasks**:

- [X] T074 [P] [US2] Create createStaff server action in app/actions/staff-management.ts using CreateStaffSchema
- [X] T075 [P] [US2] Create getStaff server action in app/actions/staff-management.ts with type and agency filters
- [X] T076 [P] [US2] Create getStaffById server action in app/actions/staff-management.ts with assignment inclusions
- [X] T077 [US2] Create createStaffAssignment server action in app/actions/staff-management.ts with allocation percentage
- [X] T078 [US2] Add allocation percentage sum validation to createStaffAssignment: warn if >100%, don't block
- [X] T079 [US2] Create endStaffAssignment server action in app/actions/staff-management.ts setting end_date
- [X] T080 [US2] Create distributeAllocationEvenly server action in app/actions/staff-management.ts for bulk allocation
- [X] T081 [US2] Create bulkEndAssignments server action in app/actions/staff-management.ts for churned clients
- [X] T082 [P] [US2] Create staff list page in app/dashboard/staff/page.tsx with type filter tabs
- [X] T083 [P] [US2] Create StaffTable component in components/staff/StaffTable.tsx showing utilization percentage
- [X] T084 [P] [US2] Create AddStaffModal component in components/staff/AddStaffModal.tsx with staff type selection
- [X] T085 [US2] Create AssignBDRModal component in components/staff/AssignBDRModal.tsx with multi-client allocation UI
- [X] T086 [US2] Implement allocation remaining indicator in AssignBDRModal using progress bar pattern
- [X] T087 [US2] Add "Distribute Evenly" and "Allocate Remaining" bulk action buttons in AssignBDRModal
- [X] T088 [US2] Create StaffAssignmentTable component in components/staff/StaffAssignmentTable.tsx showing assignments per staff
- [X] T089 [US2] Create ClientStaffTable component in components/clients/ClientStaffTable.tsx showing staff assigned to client
- [X] T090 [US2] Calculate utilization percentage: sum of active allocation_percentage where end_date IS NULL
- [X] T091 [US2] Add warning badge in StaffTable if utilization >100%
- [X] T092 [US2] Create ProductivityEntryModal component in components/staff/ProductivityEntryModal.tsx for BDR metrics
- [X] T093 [US2] Create recordBDRProductivity server action in app/actions/productivity-management.ts

**API Endpoints Created**:
- POST /api/actions/createStaff
- GET /api/actions/getStaff
- GET /api/actions/getStaffById
- POST /api/actions/createStaffAssignment
- PUT /api/actions/endStaffAssignment
- POST /api/actions/distributeAllocationEvenly
- POST /api/actions/bulkEndAssignments
- POST /api/actions/recordBDRProductivity

**Deliverables**:
- ✅ Staff management across 4 types (BDR, Admin, Contractor, Agency Staff)
- ✅ M:N staff-to-client assignments with allocation percentages
- ✅ Utilization tracking and warnings
- ✅ Bulk allocation utilities

---

## Phase 5: User Story 3 - Subscription Management & Allocation

**User Story**: Finance Admin allocates subscriptions using hybrid methods (seat-based + percentage-based)

**Goal**: Split SaaS costs across clients and staff accurately

**Independent Test Criteria**:
- ✅ Can add subscription with total cost and seats
- ✅ Can allocate seats to clients (seat-based)
- ✅ Can allocate percentage to clients (percentage-based)
- ✅ System validates seats ≤ total_seats (hard constraint)
- ✅ System warns if percentage >100% (soft warning)
- ✅ Shows unutilized cost

**Tasks**:

- [X] T094 [P] [US3] Create createSubscription server action in app/actions/subscription-management.ts using CreateSubscriptionSchema
- [X] T095 [P] [US3] Create getSubscriptions server action in app/actions/subscription-management.ts with utilization calculation
- [X] T096 [US3] Create createSubscriptionAllocation server action in app/actions/subscription-management.ts with hybrid allocation
- [X] T097 [US3] Add seat constraint validation to createSubscriptionAllocation: sum of seats_allocated ≤ total_seats, block if exceeded
- [X] T098 [US3] Add percentage warning to createSubscriptionAllocation: warn if sum >100%, allow save
- [X] T099 [US3] Implement calculateAllocatedCost function in app/actions/subscription-management.ts: if SEAT_BASED use costPerSeat, if PERCENTAGE_BASED use percentage fraction
- [X] T100 [US3] Create removeSubscriptionAllocation server action in app/actions/subscription-management.ts
- [X] T101 [P] [US3] Create subscription list page in app/dashboard/subscriptions/page.tsx
- [X] T102 [P] [US3] Create SubscriptionTable component in components/subscriptions/SubscriptionTable.tsx showing allocated/unutilized costs
- [X] T103 [P] [US3] Create AddSubscriptionModal component in components/subscriptions/AddSubscriptionModal.tsx
- [X] T104 [US3] Create AllocateSubscriptionModal component in components/subscriptions/AllocateSubscriptionModal.tsx with allocation type toggle
- [X] T105 [US3] Implement seat-based allocation UI in AllocateSubscriptionModal: number input with remaining seats indicator
- [X] T106 [US3] Implement percentage-based allocation UI in AllocateSubscriptionModal: number input with progress bar
- [X] T107 [US3] Create AllocationSummaryCard component in components/subscriptions/AllocationSummaryCard.tsx showing cost per client/staff
- [X] T108 [US3] Add "Unutilized Cost" indicator to SubscriptionTable showing difference between total_cost and sum(cost_allocated)

**API Endpoints Created**:
- POST /api/actions/createSubscription
- GET /api/actions/getSubscriptions
- POST /api/actions/createSubscriptionAllocation
- DELETE /api/actions/removeSubscriptionAllocation

**Deliverables**:
- ✅ Subscription management with seat and percentage allocation
- ✅ Hybrid allocation engine working
- ✅ Cost attribution accurate
- ✅ Unutilized cost tracking

---

## Phase 6: User Story 4 - Agency Partner Management

**User Story**: Finance Admin manages agency with variable monthly breakdown

**Goal**: Track agency staffing changes month-over-month with historical data

**Independent Test Criteria**:
- ✅ Can add agency with monthly payment
- ✅ Can record monthly breakdown with variable staff composition (JSONB)
- ✅ System calculates breakdown_total from JSON
- ✅ System shows variance (breakdown_total - monthly_payment)
- ✅ Can view historical breakdowns
- ✅ Can assign agency staff to clients

**Tasks**:

- [X] T109 [P] [US4] Create createAgency server action in app/actions/agency-management.ts using CreateAgencySchema
- [X] T110 [P] [US4] Create getAgencies server action in app/actions/agency-management.ts
- [X] T111 [US4] Create createAgencyMonthlyBreakdown server action in app/actions/agency-management.ts with JSONB breakdown
- [X] T112 [US4] Implement breakdown_total calculation in createAgencyMonthlyBreakdown: sum all staff costs from JSON array
- [X] T113 [US4] Implement variance calculation in createAgencyMonthlyBreakdown: breakdown_total - agency.monthly_payment
- [X] T114 [US4] Add variance warning to createAgencyMonthlyBreakdown: if variance >$100 or >10%, add warning to response
- [X] T115 [US4] Create getAgencyBreakdownHistory server action in app/actions/agency-management.ts ordered by year DESC, month DESC
- [X] T116 [P] [US4] Create agency list page in app/dashboard/agencies/page.tsx
- [X] T117 [P] [US4] Create AgencyTable component in components/agencies/AgencyTable.tsx
- [X] T118 [P] [US4] Create AddAgencyModal component in components/agencies/AddAgencyModal.tsx
- [X] T119 [US4] Create MonthlyBreakdownForm component in components/agencies/MonthlyBreakdownForm.tsx with dynamic staff entry
- [X] T120 [US4] Add "Add Staff Member" button in MonthlyBreakdownForm to append to breakdown array
- [X] T121 [US4] Create BreakdownHistoryTable component in components/agencies/BreakdownHistoryTable.tsx showing monthly snapshots

**API Endpoints Created**:
- POST /api/actions/createAgency
- GET /api/actions/getAgencies
- POST /api/actions/createAgencyMonthlyBreakdown
- GET /api/actions/getAgencyBreakdownHistory

**Deliverables**:
- ✅ Agency partner management complete
- ✅ Variable monthly breakdown with JSONB
- ✅ Historical data queryable
- ✅ Variance tracking and warnings

---

## Phase 7: User Story 5 - Portfolio Dashboard & Client ROI

**User Story**: Agency Owner views client ROI dashboard with dual metrics

**Goal**: Assess client profitability with ROI% and Margin%

**Independent Test Criteria**:
- ✅ Dashboard displays all clients with revenue, costs, profit, ROI%, margin%
- ✅ Can sort by any column (name, revenue, costs, margin%, ROI%)
- ✅ Can filter by status, relationship type, margin range
- ✅ Can search by client name
- ✅ Shows summary cards (total clients, avg margin, total profit)
- ✅ "Last calculated" timestamp displayed with refresh button

**Prerequisites**: US1, US2, US3, US4 complete (all cost sources available)

**Tasks**:

- [X] T122 [US5] Create refreshClientROI server action in app/actions/roi-calculations.ts
- [X] T123 [US5] Implement getClientRevenue function in lib/calculations/client-roi.ts querying Xero invoice data
- [X] T124 [US5] Implement calculateClientCosts function in lib/calculations/client-roi.ts: sum BDR costs + contractor costs + subscription costs + service costs
- [X] T125 [US5] Implement dual metrics calculation in refreshClientROI: roi_percentage = (profit / total_costs) * 100, margin_percentage = (profit / revenue) * 100
- [X] T126 [US5] Add edge case handling in refreshClientROI: if costs = 0, roi_percentage = 0; if revenue = 0, margin_percentage = 0
- [X] T127 [US5] Implement upsert logic in refreshClientROI: use unique constraint (client_id, month, year) to update or create
- [X] T128 [US5] Create getClientROIDashboard server action in app/actions/roi-calculations.ts reading from ClientROI table
- [X] T129 [US5] Add filters to getClientROIDashboard: status, minMargin, maxMargin, relationship_type
- [X] T130 [US5] Add sorting to getClientROIDashboard: sortBy (name, revenue, costs, margin_percentage, roi_percentage), sortOrder (asc, desc)
- [X] T131 [US5] Calculate summary statistics in getClientROIDashboard: total_clients, total_revenue, total_costs, total_profit, avg_margin, avg_roi
- [X] T132 [P] [US5] Create portfolio dashboard page in app/dashboard/portfolio/page.tsx
- [X] T133 [P] [US5] Create ClientTable component in components/portfolio/ClientTable.tsx with sortable columns
- [X] T134 [P] [US5] Create PortfolioSummaryCards component in components/portfolio/PortfolioSummaryCards.tsx showing 6 summary metrics
- [X] T135 [US5] Implement client search in ClientTable with debounced input
- [X] T136 [US5] Implement filters in ClientTable: status dropdown, relationship dropdown, margin range sliders
- [X] T137 [US5] Add "Refresh ROI" button in portfolio dashboard triggering refreshClientROI for all clients

**API Endpoints Created**:
- POST /api/actions/refreshClientROI
- GET /api/actions/getClientROIDashboard

**Deliverables**:
- ✅ Portfolio dashboard with client ROI metrics
- ✅ Dual metrics (ROI% + Margin%) calculated
- ✅ Filtering, sorting, search working
- ✅ On-demand ROI refresh

---

## Phase 8: User Story 6 - BDR Performance & ROI Tracking

**User Story**: Finance Admin tracks BDR productivity and ROI

**Goal**: Measure BDR performance with meetings attended and attributed revenue

**Independent Test Criteria**:
- ✅ Can view BDR with meetings attended, revenue attributed, cost, ROI%, margin%
- ✅ BDR revenue attributed = sum(client_revenue × allocation_percentage) across all assignments
- ✅ BDR ROI% and Margin% calculated correctly
- ✅ Can compare BDRs side-by-side
- ✅ Shows meetings attended per BDR

**Prerequisites**: US2 (Staff Management), US5 (ROI Calculation) complete

**Tasks**:

- [X] T138 [US6] Create refreshBDRROI server action in app/actions/roi-calculations.ts
- [X] T139 [US6] Implement calculateAttributedRevenue function in lib/calculations/bdr-roi.ts: for each assignment, get client_revenue × (allocation_percentage / 100), sum all
- [X] T140 [US6] Implement BDR cost retrieval in refreshBDRROI: staff.rate (assumes RateType = MONTHLY)
- [X] T141 [US6] Implement dual metrics calculation in refreshBDRROI: roi_percentage = (profit / bdr_cost) * 100, margin_percentage = (profit / revenue_attributed) * 100
- [X] T142 [US6] Get total meetings_attended from BDRProductivityMetric table for the month/year
- [X] T143 [US6] Create getBDRPerformanceDashboard server action in app/actions/roi-calculations.ts reading from BDRROI table
- [X] T144 [US6] Calculate summary statistics in getBDRPerformanceDashboard: total_bdrs, total_revenue_attributed, total_bdr_costs, avg_roi, avg_margin, total_meetings_attended
- [X] T145 [US6] Create BDRPerformanceTable component in components/portfolio/BDRPerformanceTable.tsx showing ROI metrics and meetings attended

**API Endpoints Created**:
- POST /api/actions/refreshBDRROI
- GET /api/actions/getBDRPerformanceDashboard

**Deliverables**:
- ✅ BDR ROI calculation engine complete
- ✅ Revenue attribution working
- ✅ BDR performance dashboard

---

## Phase 9: User Story 7 - CSV Export & Reporting

**User Story**: Finance Admin exports portfolio data to CSV

**Goal**: Export filtered client data for external analysis

**Independent Test Criteria**:
- ✅ Can export clients with selected columns
- ✅ Current filters applied to export
- ✅ CSV downloads with timestamp in filename
- ✅ Export completes in <10 seconds for 500 clients

**Prerequisites**: US5 (Portfolio Dashboard) complete

**Tasks**:

- [X] T146 [US7] Create CSV export API route in app/api/export/clients/route.ts using streaming pattern from R6 research
- [X] T147 [US7] Implement server-side streaming with fast-csv library in export route: ReadableStream with 50-row chunks
- [X] T148 [US7] Add query params to export route: filters (JSON), columns (comma-separated)
- [X] T149 [US7] Create ExportButton component in components/portfolio/ExportButton.tsx with progress indicator
- [X] T150 [US7] Implement client-side download in ExportButton using Fetch API with progress tracking

**API Endpoints Created**:
- GET /api/export/clients?filters={}&columns=name,revenue,costs,margin_percentage,roi_percentage

**Deliverables**:
- ✅ CSV export with streaming
- ✅ Progress indicator
- ✅ Filter and column selection

---

## Parallel Execution Examples

### After Foundational Phase Complete

You can work on these user stories in parallel (independent teams/developers):

**Team 1**: US1 (Client & Service Management) - 18 tasks
**Team 2**: US2 (Staff Management) - 20 tasks
**Team 3**: US3 (Subscription Management) - 15 tasks
**Team 4**: US4 (Agency Management) - 13 tasks

**Total Parallel Work**: 66 tasks across 4 teams

### Within Each User Story

Tasks marked with [P] can be done in parallel. For example, in US1:
- T056-T064 (9 server actions) can all be implemented in parallel
- T065-T071 (7 UI components) can all be built in parallel

---

## Testing Strategy

### Unit Tests
- Validation schemas (T041-T055)
- ROI calculation engines (T122-T126, T138-T141)
- Allocation logic (T099, T112-T113)

### Integration Tests
- Server actions with database (after each user story phase)
- RLS policy enforcement (T040)

### E2E Tests
- Client onboarding flow (US1)
- BDR assignment flow (US2)
- Subscription allocation flow (US3)
- ROI calculation and dashboard (US5)

---

## Dependencies Graph

```
Setup (Phase 1)
    ↓
Foundational (Phase 2)
    ↓
    ├─→ US1 (Client & Service) ─────────────┐
    ├─→ US2 (Staff & BDR) ─────────────────┤
    ├─→ US3 (Subscription) ────────────────┤
    ├─→ US4 (Agency) ──────────────────────┤
    │                                       ↓
    │                               US5 (Portfolio & ROI)
    │                                       ↓
    │                               US6 (BDR Performance)
    │                                       ↓
    │                               US7 (CSV Export)
    └───────────────────────────────────────┘
```

**Critical Path**: Setup → Foundational → US1/US2/US3/US4 → US5 → US6 → US7

**Minimum Time**: 10 days (with full parallelization)

---

## Success Criteria

### Functional Completeness
- ✅ All 7 user scenarios working end-to-end
- ✅ All 17 functional requirements (FR-1 through FR-17) implemented
- ✅ All 8 edge cases handled gracefully

### Performance Targets
- ✅ Client ROI displays in <2 seconds for 100 clients
- ✅ Portfolio search results in <1 second for 500 records
- ✅ Client onboarding completes in <5 minutes
- ✅ CSV export generates in <10 seconds for 500 clients

### Quality Standards
- ✅ TypeScript strict mode (no any types)
- ✅ All server actions have Zod validation
- ✅ Test coverage >80% for calculation engines
- ✅ E2E tests cover all critical user flows
- ✅ RLS policies enforce organization isolation
- ✅ Soft deletes preserve historical data

---

## Next Steps

1. **Review Tasks**: Confirm task breakdown with team
2. **Assign Work**: Distribute user stories to team members
3. **Begin Setup**: Start with Phase 1 (T001-T040)
4. **Parallel Development**: After Foundational phase, split into US1, US2, US3, US4 teams
5. **Integration**: Complete US5, US6, US7 sequentially
6. **Testing**: Run E2E tests after each user story
7. **Deployment**: Deploy MVP (US1) first, then incremental releases

**Estimated Completion**: 10-14 days with 2-3 developers

---

**Tasks File Complete**: 2026-02-16
