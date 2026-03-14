# Feature Specification: Client Portfolio & Staff Management

**Status**: Draft
**Created**: 2026-02-16
**Last Updated**: 2026-02-16

---

## Overview

### Feature Summary

A comprehensive client portfolio and workforce management system for staffing/placement agencies that tracks client relationships, manages multiple staff types (BDRs, contractors, admin, agency partners), handles service templates with client-specific customization, allocates subscription costs across clients and staff, and calculates dual ROI metrics (ROI% + Margin%) for both clients and BDRs to enable profit optimization.

### Business Value

This feature solves the critical challenge of tracking profitability in a staffing agency business model where revenue comes from placing BDRs with clients and providing services, while costs include BDR salaries, contractor fees, subscriptions, and agency partner payments.

**Problems Solved:**
- Client profitability blind spots when costs split across multiple clients
- BDR performance uncertainty (which BDRs drive revenue vs. cost centers)
- Subscription cost waste (SaaS tools paid but not allocated)
- Agency partner opacity (one payment without staff contribution visibility)

**Value Delivered:**
- Real-time client profitability (ROI% + Margin%) with full cost attribution
- BDR productivity tracking (meetings booked that show up) linked to revenue
- Subscription cost optimization through hybrid allocation
- Agency partner transparency with variable monthly breakdown tracking

### Target Users

**Primary Users:**
- Finance Administrators - Manage portfolio, track costs, calculate ROI, allocate subscriptions
- Agency Owners/Executives - View profitability, make pricing decisions, identify growth opportunities

**Secondary Users:**
- Operations Managers - Assign BDRs to clients, track utilization
- BDR Managers - Monitor BDR productivity and optimize team performance

---

## User Scenarios

### Primary Use Cases

**Scenario 1: Finance Admin Adds New Client with Service Templates**
- **Actor**: Finance Administrator
- **Goal**: Onboard a new client with customized services and margin targets
- **Steps**:
  1. Navigate to Clients page, click "Add Client"
  2. Enter client details (name: "Acme Corp", relationship: Retainer, margin target: 70%)
  3. Select service templates ("Marketing", "Assigned BDR")
  4. Customize rates (Marketing $5k base → $7k custom for Acme)
  5. Set status to Active and save
- **Expected Outcome**: Client appears in portfolio with two services, 70% margin target stored

**Scenario 2: Finance Admin Assigns BDR to Multiple Clients**  
- **Actor**: Finance Administrator
- **Goal**: Allocate BDR across clients with percentage splits
- **Steps**:
  1. Add BDR "Sarah Johnson" ($4,000/month)
  2. Create assignments: Acme 60%, Beta 40%
  3. Record productivity: 12 meetings (8 Acme, 4 Beta)
  4. System calculates costs: Acme $2,400, Beta $1,600
- **Expected Outcome**: BDR assigned with proper cost allocation and metrics tracked

**Scenario 3: Finance Admin Allocates Subscriptions (Hybrid)**
- **Actor**: Finance Administrator
- **Goal**: Split SaaS costs using seat-based and percentage allocation
- **Steps**:
  1. Add Salesforce ($500/mo, 5 seats)
  2. Allocate seats: Acme 2, Beta 2, Internal 1
  3. Add Adobe Creative Cloud ($60/mo)
  4. Allocate percentage: Acme 40%, Beta 30%, Internal 30%
- **Expected Outcome**: Subscription costs accurately attributed to clients

**Scenario 4: Finance Admin Manages Agency with Variable Breakdown**
- **Actor**: Finance Administrator
- **Goal**: Track agency monthly staffing changes
- **Steps**:
  1. Add agency "XYZ Staffing" ($15k/month)
  2. Record Month 1: 2 BDRs @ $6k, 1 Admin @ $3k
  3. Assign agency BDR "Mike" to Client Delta (50%)
  4. Month 2: Update to 3 BDRs @ $5k each
- **Expected Outcome**: Agency costs properly attributed with historical tracking

**Scenario 5: Agency Owner Views Client ROI Dashboard**
- **Actor**: Agency Owner
- **Goal**: Assess client profitability with dual metrics
- **Steps**:
  1. Navigate to Portfolio dashboard
  2. View Acme: Revenue $20k, Costs $8k
  3. See Profit $12k, ROI 150%, Margin 60%
  4. Compare to Beta: 45% margin (below target)
- **Expected Outcome**: Clear visibility into profitable vs. underperforming clients

**Scenario 6: Finance Admin Tracks BDR Productivity and ROI**
- **Actor**: Finance Administrator
- **Goal**: Measure BDR performance and ROI
- **Steps**:
  1. View BDR Sarah: 12 meetings, $50k revenue, $4k cost
  2. See BDR ROI: 1,150%, Margin: 92%
  3. Compare to Mike: 300% ROI, 75% margin
- **Expected Outcome**: Identify high-performing BDRs objectively

**Scenario 7: Finance Admin Exports Portfolio Data**
- **Actor**: Finance Administrator
- **Goal**: Export data for board meeting
- **Steps**:
  1. Filter: Status=Active, Margin<60%
  2. Select columns: Name, Revenue, Costs, Margin%, ROI%, BDRs
  3. Click "Export to CSV"
- **Expected Outcome**: CSV with 15 active clients for strategic discussions

### Edge Cases

**Edge Case 1: BDR at 0% Allocation**
- Handling: Allow 0% but require end_date. Pro-rate costs for partial months.

**Edge Case 2: Client with >100% Total BDR Allocation**
- Handling: Warn but don't block. Admin responsible for alignment with billing.

**Edge Case 3: Service Template Deleted with Active Assignments**
- Handling: Soft delete template. Existing assignments show "Template Deleted" warning.

**Edge Case 4: Subscription Seats Exceed Available**
- Handling: Validate allocated ≤ total. Show error before saving.

**Edge Case 5: Agency Breakdown Mismatch**
- Handling: Warn variance but allow save. Admin may have negotiated different amount.

**Edge Case 6: Churned Client with Active Assignments**
- Handling: Prompt to end all assignments when status=Churned.

**Edge Case 7: Retroactive Productivity Entry**
- Handling: Allow historical entry with custom date. Re-calculate ROI.

**Edge Case 8: Client with No Revenue**
- Handling: Show negative ROI with warning "No revenue recorded yet".

---

## Functional Requirements

### Core Requirements

**FR-1: Client Management**
- **Description**: CRUD operations for client records with custom margin targets
- **Acceptance Criteria**:
  - [ ] Add client with name, relationship_type, status, custom_margin_target
  - [ ] Validate churn_date >= start_date
  - [ ] Soft delete (sets deleted_at)
  - [ ] Search by name (partial, case-insensitive)
  - [ ] Filter by status and relationship_type
  - [ ] Multi-tenant scoping (organization_id, RLS)

**FR-2: Service Template Management**
- **Description**: Define reusable service templates with base rates
- **Acceptance Criteria**:
  - [ ] Create template with name, description, standard_rate, target_margin
  - [ ] Mark active/inactive
  - [ ] Soft delete (existing assignments unaffected)
  - [ ] View which clients use each template
  - [ ] Validate rate > 0, margin 0-100%

**FR-3: Client-Service Assignment with Customization**
- **Description**: Assign templates to clients with custom rates
- **Acceptance Criteria**:
  - [ ] Assign multiple templates to client
  - [ ] Customize rate per client
  - [ ] Prevent duplicate assignments
  - [ ] Show "Template Deleted" if template removed

**FR-4: Staff Management (Multiple Types)**
- **Description**: Manage BDRs, Admin, Contractors, Agency Staff
- **Acceptance Criteria**:
  - [ ] Add staff with type, rate, rate_type, engagement_type
  - [ ] Associate agency staff with agency_id
  - [ ] Soft delete
  - [ ] Filter by type, engagement, agency
  - [ ] Prevent deleting with active assignments

**FR-5: BDR-to-Client Assignment (M:N)**
- **Description**: Assign BDRs to clients with allocation percentages
- **Acceptance Criteria**:
  - [ ] Create assignment with allocation_percentage (1-100)
  - [ ] Set start_date and optional end_date
  - [ ] Calculate cost per client (rate × allocation%)
  - [ ] Warn if total allocation >100%
  - [ ] Preserve assignment history

**FR-6: Contractor-to-Client Assignment**
- **Description**: Similar to BDR assignments for contractors
- **Acceptance Criteria**:
  - [ ] M:N relationship with allocation percentages
  - [ ] Separate display from BDR assignments

**FR-7: Subscription Management**
- **Description**: Track SaaS subscriptions with cost and seats
- **Acceptance Criteria**:
  - [ ] Add subscription with total_cost, total_seats, billing_frequency
  - [ ] Mark inactive
  - [ ] Show unutilized cost

**FR-8: Subscription Allocation (Hybrid)**
- **Description**: Allocate costs via seats or percentage
- **Acceptance Criteria**:
  - [ ] Seat-based: Allocate exact seats, calculate cost/seat
  - [ ] Percentage-based: Allocate percentage, calculate cost fraction
  - [ ] Validate seats ≤ total_seats
  - [ ] Warn if percentage >100%
  - [ ] Allocate to client OR staff (not both in same record)

**FR-9: Agency Partner Management**
- **Description**: Track agency partners with monthly payments
- **Acceptance Criteria**:
  - [ ] Add agency with monthly_payment, start_date
  - [ ] View current and historical breakdowns

**FR-10: Agency Monthly Breakdown Tracking**
- **Description**: Record variable monthly staffing breakdowns
- **Acceptance Criteria**:
  - [ ] Create breakdown with month/year, staff details (JSON)
  - [ ] Display breakdown total vs. payment variance
  - [ ] Allow retroactive editing

**FR-11: BDR Productivity Tracking**
- **Description**: Track meetings booked that show up
- **Acceptance Criteria**:
  - [ ] Enter meetings_attended per BDR per month
  - [ ] Optional per-client tracking
  - [ ] Allow retroactive entry
  - [ ] Show monthly trends

**FR-12: Client ROI Calculation (Dual Metrics)**
- **Description**: Calculate ROI% and Margin% for clients
- **Acceptance Criteria**:
  - [ ] Calculate revenue from Xero
  - [ ] Calculate total costs (BDRs + contractors + subscriptions + services)
  - [ ] Calculate ROI% = (Profit / Costs) × 100
  - [ ] Calculate Margin% = (Profit / Revenue) × 100
  - [ ] Handle edge cases (zero revenue/costs)
  - [ ] Show historical trends

**FR-13: BDR ROI Calculation (Dual Metrics)**
- **Description**: Calculate ROI% and Margin% for BDRs
- **Acceptance Criteria**:
  - [ ] Calculate attributed revenue (client revenue × allocation%)
  - [ ] Calculate BDR cost (monthly rate)
  - [ ] Calculate ROI% and Margin%
  - [ ] Compare BDRs side-by-side

**FR-14: Portfolio Overview Dashboard**
- **Description**: View all clients with financial health
- **Acceptance Criteria**:
  - [ ] Display list with Revenue, Costs, Profit, ROI%, Margin%
  - [ ] Sort by any column
  - [ ] Filter by status, relationship, margin range
  - [ ] Search by name
  - [ ] Show summary cards (Total Clients, Avg Margin, etc.)

**FR-15: Data Export (CSV)**
- **Description**: Export portfolio data to CSV
- **Acceptance Criteria**:
  - [ ] Export Clients, BDRs, Contractors, Subscriptions
  - [ ] Apply current filters
  - [ ] Select columns to include
  - [ ] Generate CSV with timestamp in filename

**FR-16: Multi-Tenant Data Isolation**
- **Description**: Organization-scoped data with RLS
- **Acceptance Criteria**:
  - [ ] All tables have organization_id
  - [ ] RLS policies filter by organization
  - [ ] API routes validate ownership

**FR-17: Soft Delete Preservation**
- **Description**: Preserve historical data via soft deletes
- **Acceptance Criteria**:
  - [ ] All entities have deleted_at field
  - [ ] Soft delete sets timestamp
  - [ ] Default queries filter deleted records
  - [ ] Historical reports include deleted data

### Data Requirements

**DR-1: Client**
- id, organization_id, name, status, relationship_type, custom_margin_target, start_date, churn_date, deleted_at
- Indexed: organization_id, status, name
- Unique: (organization_id, name) for non-deleted

**DR-2: Service (Template)**
- id, organization_id, name, description, standard_rate, target_margin, is_active, deleted_at
- Indexed: organization_id, is_active

**DR-3: ClientService (Junction)**
- client_id, service_id, custom_rate, rate_type
- PK: (client_id, service_id)

**DR-4: Staff**
- id, organization_id, agency_id, name, staff_type, rate, rate_type, engagement_type, deleted_at
- Indexed: organization_id, staff_type, agency_id

**DR-5: StaffAssignment**
- id, staff_id, client_id, start_date, end_date, allocation_percentage
- Indexed: staff_id, client_id, start_date, end_date

**DR-6: Subscription**
- id, organization_id, name, total_cost, total_seats, billing_frequency, is_active, deleted_at

**DR-7: SubscriptionAllocation**
- id, subscription_id, client_id, staff_id, allocation_type, seats_allocated, percentage_allocated, cost_allocated
- Indexed: subscription_id, client_id, staff_id

**DR-8: Agency**
- id, organization_id, name, monthly_payment, start_date, deleted_at

**DR-9: AgencyMonthlyBreakdown**
- id, agency_id, month, year, breakdown (JSONB), breakdown_total, variance
- Unique: (agency_id, month, year)

**DR-10: BDRProductivityMetric**
- id, bdr_id, client_id, month, year, meetings_attended
- Unique: (bdr_id, client_id, month, year)

**DR-11: ClientROI**
- id, client_id, month, year, revenue, total_costs, profit, roi_percentage, margin_percentage, calculated_at

**DR-12: BDRROI**
- id, bdr_id, month, year, revenue_attributed, bdr_cost, profit, roi_percentage, margin_percentage, meetings_attended_total

---

## Success Criteria

### Measurable Outcomes

- [ ] **Data Completeness**: 100% of clients have assigned services within 1 month
- [ ] **Cost Attribution**: 95%+ of subscription costs allocated
- [ ] **Performance**: ROI displays in <2 seconds for 100 clients
- [ ] **Productivity Tracking**: 90%+ BDRs have monthly metrics within 5 days
- [ ] **Adoption**: 80%+ admins use dashboard weekly
- [ ] **Onboarding Speed**: New client in <5 minutes
- [ ] **Search Speed**: Results in <1 second for 500 records
- [ ] **Data Preservation**: 0 data loss during soft deletes

---

## Dependencies

### External Dependencies

- Xero Integration (Feature 4) - Revenue data for ROI
- Mercury Integration (Feature 5) - Optional expense data
- Supabase Auth - User authentication for RLS
- Prisma ORM - Database schema migrations

### Internal Dependencies

- Feature 1: Database Schema (organizations, user_organizations)
- Feature 2: Authentication (user sessions, RLS policies)
- Feature 4: Xero Integration (revenue data)
- Feature 5: Mercury Integration (optional)

---

## Assumptions

- Finance admins understand staffing agency financials
- Xero invoices can be mapped to clients
- BDR productivity manually entered (calendar integration future)
- Organization has <20 subscriptions
- Agency provides monthly breakdown
- Low churn allows manual updates
- Monthly ROI review (not real-time)

---

## Out of Scope

**Phase 1 MVP:**
- Automated margin calculations (Feature 6)
- Dashboards with visualizations (Feature 7)
- Pricing recommendations AI (Feature 8)
- Calendar integration
- CRM integration
- Time tracking
- Contract generation
- Email notifications
- Forecasting
- Multi-currency

**Future Enhancements:**
- Real-time ROI with auto-refresh
- Automated alerts
- BDR leaderboard
- Service profitability analysis
- Bulk CSV import
- API endpoints
- Mobile app

---

## Security & Privacy Considerations

### Data Privacy

- Financial data encrypted at rest and in transit
- PII protection (GDPR/CCPA compliance)
- Audit logging for all changes
- 7+ year data retention for tax compliance

### Access Control

- Finance Admin: Full CRUD
- Agency Owner: Read-only ROI access
- Operations Manager: Limited write
- BDR Manager: Read-only metrics
- RLS enforcement on all queries
- API validation of organization_id

### Compliance

- GDPR data export support
- CCPA disclosure requirements
- SOC 2 audit logs
- Financial regulations (7-year retention)

---

**End of Specification**

**Next Steps:**
1. Stakeholder review
2. `/speckit.clarify` if needed
3. `/speckit.plan` for implementation plan
4. `/speckit.tasks` for task breakdown
5. `/speckit.implement` to begin development
