# Feature Specification: Project Resource Allocation & Cost Tracking

**Status**: Draft
**Created**: 2026-03-01
**Last Updated**: 2026-03-01

---

## Overview

### Feature Summary

A project-level financial tracking system that lets agency leadership see exactly how much money (subscriptions, staff costs, contractor costs, and other expenses) is being invested into each project, enabling data-driven decisions about whether to continue funding or shut down underperforming initiatives.

### Business Value

Currently there is no consolidated view of how resources are allocated across projects. Subscription costs, staff time, and contractor expenses exist in separate silos, making it difficult to determine the true cost of a project. This feature aggregates all cost streams into a per-project view so leadership can compare investment against revenue, calculate ROI, and make informed go/no-go funding decisions — preventing money from being silently drained into projects that should be sunset.

### Target Users

- **Primary**: Agency Leadership / Executives — review project-level financials, make funding decisions
- **Primary**: Finance / Operations — assign costs to projects, maintain allocation accuracy
- **Secondary**: Project Managers — understand budget utilization for their projects

---

## User Scenarios

### Primary Use Cases

**Scenario 1: Leadership Reviews Project Portfolio Health**
- **Actor**: Agency Executive
- **Goal**: Quickly assess which projects are profitable and which are losing money
- **Steps**:
  1. Navigate to the Project Allocation dashboard
  2. View the project portfolio summary showing all active projects
  3. Review total investment, revenue, and ROI for each project
  4. Sort or filter projects by ROI, total cost, or status
  5. Drill into an underperforming project to see cost breakdown
- **Expected Outcome**: Executive can identify which projects to continue funding and which to flag for review or shutdown

**Scenario 2: Finance Assigns Subscriptions to a Project**
- **Actor**: Finance / Operations
- **Goal**: Allocate existing subscription costs to the correct project
- **Steps**:
  1. Navigate to a specific project's cost management view
  2. Select "Add Subscription Cost"
  3. Choose from existing subscriptions already tracked in the system
  4. Set the allocation percentage (e.g., 100% to one project or split across multiple)
  5. Save the allocation
- **Expected Outcome**: The subscription cost is reflected in the project's total investment, proportional to the allocation percentage

**Scenario 3: Finance Assigns Staff to a Project**
- **Actor**: Finance / Operations
- **Goal**: Track staff costs allocated to a project
- **Steps**:
  1. Navigate to a specific project's cost management view
  2. Select "Add Staff Allocation"
  3. Choose from existing staff members or contractors
  4. Set the allocation percentage or fixed monthly amount
  5. Set effective date range (start/end)
  6. Save the allocation
- **Expected Outcome**: Staff costs are proportionally reflected in the project's total investment based on the allocation

**Scenario 4: Leadership Decides to Sunset a Project**
- **Actor**: Agency Executive
- **Goal**: Review a project's financial history and decide to discontinue funding
- **Steps**:
  1. Open a specific project's detail view
  2. Review historical cost trend over time (month-over-month)
  3. Compare cumulative investment against revenue generated
  4. Review the cost breakdown by category (subscriptions, staff, contractors, other)
  5. Mark the project as "Under Review" or "Sunset"
- **Expected Outcome**: Project status is updated, and stakeholders are aware of the decision

**Scenario 5: Finance Creates a New Project for Tracking**
- **Actor**: Finance / Operations
- **Goal**: Set up a new project to begin tracking resource allocation
- **Steps**:
  1. Navigate to the Project Allocation section
  2. Select "Create New Project"
  3. Enter project name, description, and optional client association
  4. Set a budget target (optional)
  5. Save the project
- **Expected Outcome**: A new project entity is created, ready for cost allocations

### Edge Cases

- **Shared Subscriptions**: A single subscription (e.g., cloud hosting) may serve multiple projects. The system must support percentage-based allocation splits across projects.
- **Staff on Multiple Projects**: A staff member may work on 2-3 projects simultaneously. Their cost should be split proportionally across assigned projects.
- **Allocation Changes Mid-Month**: When an allocation percentage changes partway through a month, the system should prorate costs based on the effective date.
- **Zero Revenue Projects**: Internal or R&D projects may have no associated revenue. ROI calculations should handle this gracefully (show investment-only metrics without dividing by zero).
- **Historical Retroactive Allocations**: Finance may need to backdate allocations to correct past periods. The system should allow backdating with a clear audit trail.
- **Subscription Cancellation**: When a subscription is cancelled, its allocation to projects should automatically end on the cancellation date.

---

## Functional Requirements

### Core Requirements

**FR-1: Project Entity Management**
- **Description**: The system must allow users to create, view, edit, and archive projects as top-level entities for cost tracking.
- **Acceptance Criteria**:
  - [ ] Users can create a project with a name, description, status, and optional client association
  - [ ] Users can edit project details after creation
  - [ ] Users can set an optional budget target for a project
  - [ ] Projects can be archived (soft deleted) without losing historical data
  - [ ] Projects have lifecycle statuses: Active, Under Review, Sunset, Archived

**FR-2: Subscription Cost Allocation**
- **Description**: The system must allow users to assign existing subscriptions to projects with percentage-based allocation.
- **Acceptance Criteria**:
  - [ ] Users can assign one or more subscriptions to a project
  - [ ] Each allocation includes a percentage (1-100%) and effective date range
  - [ ] Total allocation for a single subscription across all projects cannot exceed 100%
  - [ ] Changing an allocation creates a new record (audit trail preserved)
  - [ ] Monthly subscription costs are automatically calculated based on allocation percentage

**FR-3: Staff & Contractor Cost Allocation**
- **Description**: The system must allow users to assign staff and contractors to projects with cost attribution.
- **Acceptance Criteria**:
  - [ ] Users can assign staff members or contractors to a project
  - [ ] Allocation supports both percentage-based and fixed-amount attribution
  - [ ] Each allocation has an effective date range (start and optional end date)
  - [ ] Staff cost is derived from their existing compensation data in the system
  - [ ] Contractor cost is derived from their existing rate/invoice data

**FR-4: Project Cost Aggregation**
- **Description**: The system must aggregate all allocated costs into a consolidated project financial view.
- **Acceptance Criteria**:
  - [ ] Total project cost is the sum of: subscription costs + staff costs + contractor costs + other expenses
  - [ ] Costs are broken down by category with subtotals
  - [ ] Monthly cost totals are calculated for trend analysis
  - [ ] Cost data can be viewed for any historical period (month, quarter, year)

**FR-5: ROI & Financial Health Metrics**
- **Description**: The system must calculate and display ROI and financial health indicators for each project.
- **Acceptance Criteria**:
  - [ ] ROI is calculated as (Revenue - Total Cost) / Total Cost when revenue data is available
  - [ ] Projects with no revenue show investment-only metrics (total cost, burn rate)
  - [ ] Monthly burn rate is displayed (average monthly cost over the selected period)
  - [ ] Budget utilization percentage is shown when a budget target is set
  - [ ] Projects are visually flagged when ROI is negative or budget is exceeded

**FR-6: Project Portfolio Dashboard**
- **Description**: The system must provide a summary dashboard showing all projects with their financial health at a glance.
- **Acceptance Criteria**:
  - [ ] Dashboard displays all active projects with key metrics (total cost, revenue, ROI, status)
  - [ ] Users can sort projects by any metric column
  - [ ] Users can filter projects by status, client, or date range
  - [ ] Dashboard includes a summary row with organization-wide totals
  - [ ] Visual indicators (color coding) highlight projects that need attention

**FR-7: Historical Cost Tracking**
- **Description**: The system must maintain a historical record of all cost allocations and allow trend analysis over time.
- **Acceptance Criteria**:
  - [ ] All allocation changes are timestamped and preserved (never overwritten)
  - [ ] Users can view cost trends as a chart (month-over-month line or bar chart)
  - [ ] Retroactive allocation changes recalculate historical totals for affected periods
  - [ ] Cost history is exportable for external analysis

### Data Requirements

**DR-1: Project**
- **Description**: Top-level entity representing a funded initiative or product
- **Key Attributes**: Name, description, status, client association (optional), budget target (optional), created date, organization ID
- **Validation Rules**: Name is required and unique within the organization; status must be one of the defined lifecycle values

**DR-2: Project Cost Allocation**
- **Description**: Junction record linking a cost source (subscription, staff, or contractor) to a project
- **Key Attributes**: Project ID, cost source type, cost source ID, allocation percentage or fixed amount, effective start date, effective end date (optional), created by, created at
- **Validation Rules**: Allocation percentage must be 1-100; total allocation for a single source across projects cannot exceed 100%; start date is required

**DR-3: Project Cost Snapshot**
- **Description**: Monthly aggregated cost record for reporting and trend analysis
- **Key Attributes**: Project ID, period (year-month), subscription cost total, staff cost total, contractor cost total, other cost total, revenue total, ROI
- **Validation Rules**: One snapshot per project per period; automatically generated or refreshed on demand

---

## Success Criteria

### Measurable Outcomes

- [ ] **Visibility**: Leadership can view the total investment for any project within 3 clicks from the main dashboard
- [ ] **Accuracy**: Project cost totals match the sum of individual allocations with less than 1% rounding variance
- [ ] **Decision Speed**: Time to determine whether a project is profitable or not is reduced to under 2 minutes (vs. manual spreadsheet analysis)
- [ ] **Coverage**: 100% of active subscriptions and staff can be allocated to at least one project
- [ ] **Historical Depth**: Cost trends are viewable for any period since the project's creation date
- [ ] **Adoption**: All active projects have cost allocations assigned within 30 days of feature launch

---

## Dependencies

### Internal Dependencies

- **Subscription Tracking (Feature 1 - Dynamic Cost Sync)**: Subscription cost data must be available for allocation to projects
- **Staff & Contractor Management (Features 3 & 6)**: Staff compensation and contractor rate data must be accessible for cost calculations
- **Client Portfolio (Feature 3)**: Client entities used for optional project-client association
- **Mercury Integration (Feature 5)**: Transaction data may feed into project revenue tracking

---

## Assumptions

- Subscription costs are already tracked in the system via Dynamic Cost Sync and can be referenced by ID
- Staff compensation data (salary, hourly rate) is stored in the existing staff management system
- Contractor costs can be derived from approved invoices in the contractor payment portal
- Revenue data for projects will initially be manually entered or derived from client invoices via Xero
- Organizations have a manageable number of projects (under 100) — the dashboard is not designed for enterprise-scale portfolio management at this stage
- Allocation percentages are set manually by Finance; there is no automatic time-tracking integration in this version

---

## Out of Scope

- Automated time tracking or timesheet integration (allocations are manual percentage-based)
- Forecasting or predictive analytics (future enhancement)
- Multi-currency support (all costs assumed in organization's base currency)
- Approval workflows for allocation changes (any authorized user can modify)
- Integration with external project management tools (Jira, Asana, etc.)
- Invoicing or billing from this view (handled by existing features)

---

## Security & Privacy Considerations

- **Access Control**: Only users with Finance or Executive roles can create/edit cost allocations. All authenticated users within the organization can view project summaries.
- **Data Isolation**: Project and allocation data is scoped by organization ID, enforced by existing RLS policies.
- **Audit Trail**: All allocation changes are logged with the user who made the change and timestamp.

---

## Future Enhancements

- Time-tracking integration for automatic staff allocation based on logged hours
- Budget alerts and notifications when a project approaches or exceeds its budget target
- Forecasting based on historical burn rate trends
- Project comparison views (side-by-side financial analysis)
- Automated revenue attribution from Xero invoices tagged to specific projects
