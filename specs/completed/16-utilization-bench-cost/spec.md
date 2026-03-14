# Feature Specification: Utilization & Bench Cost Visibility

**Status**: Draft
**Created**: 2026-03-06
**Last Updated**: 2026-03-06

---

## Overview

### Feature Summary

A utilization tracking and bench cost reporting system that gives staffing leaders real-time visibility into how effectively staff are deployed, identifies idle (bench) resources, and quantifies the cost of unallocated staff time to drive better capacity and hiring decisions.

### Business Value

In staff augmentation, undeployed staff represent direct cost with no offsetting revenue. Without utilization tracking, the organization cannot:
- Identify under-utilized staff draining margins before it becomes critical
- Quantify the financial impact of bench time in dollars
- Set and monitor utilization targets to maintain profitability
- Make data-driven decisions about hiring, bench management, and capacity planning
- Provide the CFO with actionable staffing efficiency metrics

Industry benchmarks show that every 5% improvement in utilization translates to significant margin gains. This feature makes utilization a first-class metric alongside revenue and margin.

### Target Users

- **Executives/CFO**: Monitor organization-wide utilization rates and bench cost trends for financial planning
- **Organization Admins/Managers**: Track individual staff utilization, identify bench resources, and take action on under-utilization
- **Agency Admins**: Full utilization visibility for their agency's staff — view utilization rates, bench status, bench costs, set agency-level utilization targets, and access bench reports as if operating their own company
- **Staff Members**: See their own utilization rate as a performance indicator

---

## Clarifications

### Session 2026-03-06

- Q: Should bench cost include all non-billable time, or only truly idle/unassigned time? → A: Separate categories — "non-billable" (working on internal tasks/projects) is tracked but does not incur bench cost. "Bench" (idle/unassigned) is the only category that incurs bench cost.
- Q: Which staff engagement types should be included in utilization tracking? → A: Exclude OWNER — track utilization for FULL_TIME, PART_TIME, PROJECT, and AGENCY staff only. Owners have different KPIs and are not placeable resources.
- Q: What level of utilization visibility should agency admins have? → A: Full visibility — agency admins can view utilization rates, bench status, bench costs, and bench reports for their agency's staff. They can also set agency-level utilization targets. Platform admin retains global visibility across all agencies.
- Q: Should bench cost for agency staff use the agency's true cost or the platform's bill rate? → A: True cost (what the agency pays the worker) when available. This gives the agency an accurate view of their own cost exposure during bench time.

---

## User Scenarios

### Primary Use Cases

**Scenario 1: Executive Reviews Organization Utilization Dashboard**
- **Actor**: Executive / CFO
- **Goal**: Understand overall staff utilization health and bench cost exposure
- **Steps**:
  1. Executive navigates to the utilization dashboard
  2. Views the organization-wide utilization rate (current period and trend)
  3. Reviews total bench cost for the current period
  4. Compares actual utilization against the target threshold
  5. Drills down into departments or staff types with low utilization
- **Expected Outcome**: Executive has a clear picture of staffing efficiency and can identify areas requiring action (reassignment, new sales, or staff reduction).

**Scenario 2: Manager Identifies Bench Resources**
- **Actor**: Organization Admin/Manager
- **Goal**: Find staff members who are idle or under-utilized and assess the cost impact
- **Steps**:
  1. Manager opens the bench report
  2. Views a list of staff with utilization below the target threshold
  3. For each bench resource, sees: name, role, days on bench, daily/monthly bench cost, last active assignment
  4. Sorts by bench cost to prioritize the most expensive idle resources
  5. Takes action: assigns to a new client, marks for internal project, or flags for discussion
- **Expected Outcome**: Manager can proactively address under-utilization before it significantly impacts margins.

**Scenario 3: Admin Sets Utilization Targets**
- **Actor**: Organization Admin
- **Goal**: Configure utilization thresholds that define healthy, warning, and critical states
- **Steps**:
  1. Admin navigates to utilization settings
  2. Sets the target utilization rate (e.g., 80%)
  3. Sets the warning threshold (e.g., below 70%)
  4. Sets the critical threshold (e.g., below 50%)
  5. Optionally sets different targets per staff type (e.g., developers at 85%, designers at 75%)
  6. Saves configuration
- **Expected Outcome**: Utilization dashboards and reports use these thresholds for color-coded status indicators and alert triggers.

**Scenario 4: Manager Reviews Individual Staff Utilization**
- **Actor**: Organization Admin/Manager
- **Goal**: Assess a specific staff member's utilization history and current status
- **Steps**:
  1. Manager navigates to a staff member's detail page
  2. Opens the utilization tab
  3. Views current period utilization rate, billable hours, available hours
  4. Reviews utilization trend over the past 6 months
  5. Sees assignment history and gaps between placements
- **Expected Outcome**: Manager understands the staff member's deployment efficiency and can plan accordingly.

**Scenario 5: System Generates Utilization Alerts**
- **Actor**: System (automated)
- **Goal**: Proactively notify managers when utilization drops below thresholds
- **Steps**:
  1. System calculates utilization snapshots on a scheduled basis (weekly)
  2. Compares each staff member's utilization against configured thresholds
  3. For staff below the warning threshold, generates a notification
  4. For staff below the critical threshold, generates an urgent notification
  5. Notifications appear in the notification center and optionally via existing alert channels
- **Expected Outcome**: Managers are alerted to utilization problems without having to manually check dashboards.

**Scenario 6: Executive Reviews Bench Cost Trends**
- **Actor**: Executive / CFO
- **Goal**: Track how bench costs have changed over time to evaluate staffing strategy effectiveness
- **Steps**:
  1. Executive navigates to the bench cost trend view
  2. Views monthly bench cost over the past 12 months as a chart
  3. Sees average bench duration (days between assignments)
  4. Reviews bench cost as a percentage of total payroll cost
  5. Compares against historical benchmarks or targets
- **Expected Outcome**: Executive can assess whether staffing strategy changes are reducing bench exposure over time.

**Scenario 7: Agency Admin Reviews Agency Utilization**
- **Actor**: Agency Admin
- **Goal**: Monitor utilization and bench costs for their agency's placed staff
- **Steps**:
  1. Agency admin logs into the agency portal
  2. Navigates to the utilization section
  3. Views utilization rate for their agency's staff (current period and trend)
  4. Reviews bench report showing idle agency staff with cost impact
  5. Identifies under-utilized staff and plans redeployment or internal assignments
  6. Sets agency-level utilization targets (independent from platform targets)
- **Expected Outcome**: Agency admin has full visibility into their workforce efficiency and can proactively manage bench exposure without requiring platform admin assistance.

**Scenario 8: Agency Admin Sets Agency-Level Utilization Targets**
- **Actor**: Agency Admin
- **Goal**: Configure utilization thresholds specific to their agency's workforce
- **Steps**:
  1. Agency admin navigates to agency portal settings
  2. Sets target utilization rate (e.g., 85% for their specialized developers)
  3. Sets warning and critical thresholds appropriate for their agency
  4. Saves configuration
- **Expected Outcome**: Agency-level targets are used for status indicators and alerts for the agency's staff, independent of the platform-wide targets.

### Edge Cases

- Staff member with no assignments at all — should show 0% utilization and full bench cost based on their rate
- Staff member assigned at 100% allocation but no timesheet data exists — system falls back to allocation percentage for utilization calculation
- Staff member on partial allocation (e.g., 50% to one client) — remaining 50% counts as bench time unless allocated elsewhere
- New staff member who just started — utilization is calculated only for their active period, not the full reporting period
- Terminated staff — excluded from current utilization calculations but included in historical reports for their active period
- Staff with variable rate (VARIABLE rate type) — bench cost calculation requires a default rate assumption

---

## Functional Requirements

### Core Requirements

**FR-1: Utilization Rate Calculation**
- **Description**: The system calculates utilization rate for each staff member based on billable hours relative to available hours
- **Acceptance Criteria**:
  - [ ] Utilization rate = billable hours / available hours, expressed as a percentage
  - [ ] Available hours are calculated as: working days in period x standard daily hours (configurable, default 8)
  - [ ] Billable hours are sourced from approved timesheets (Spec 15) when available
  - [ ] When no timesheet data exists, billable hours are estimated from allocation percentage x available hours as a fallback
  - [ ] Utilization is calculated per staff member, per period (weekly, monthly, quarterly)
  - [ ] Staff with engagement_type OWNER are excluded from utilization tracking (owners are not placeable resources)
  - [ ] Organization-wide utilization is the weighted average across all active eligible staff (FULL_TIME, PART_TIME, PROJECT, AGENCY)

**FR-2: Bench Status Identification**
- **Description**: The system identifies staff who are on the bench (unassigned or under-utilized) and tracks bench duration
- **Acceptance Criteria**:
  - [ ] Staff with no active assignments are classified as "on bench"
  - [ ] Staff with utilization below the configured target are classified as "under-utilized"
  - [ ] Bench duration is tracked: consecutive days without a billable assignment
  - [ ] Bench status is updated automatically as assignments start and end
  - [ ] Staff on bench are surfaced in a dedicated bench report

**FR-3: Bench Cost Calculation**
- **Description**: The system calculates the cost of idle staff time in monetary terms
- **Acceptance Criteria**:
  - [ ] Bench cost = bench hours x staff hourly rate equivalent
  - [ ] For monthly-rate staff, hourly equivalent = monthly rate / (working days per month x daily hours)
  - [ ] Bench hours = available hours - billable hours - non-billable hours (only truly idle/unassigned time)
  - [ ] Non-billable hours (internal projects, training, etc.) are tracked separately and do not incur bench cost
  - [ ] Total organization bench cost is the sum of all individual bench costs
  - [ ] Bench cost is available per staff member, per period, and in aggregate

**FR-4: Utilization Targets and Thresholds (Multi-Level)**
- **Description**: Both platform admins and agency admins can configure utilization targets with warning and critical thresholds appropriate to their scope
- **Acceptance Criteria**:
  - [ ] Organization-level default target can be set (e.g., 80%)
  - [ ] Warning threshold can be set (e.g., below 70%)
  - [ ] Critical threshold can be set (e.g., below 50%)
  - [ ] Agency admins can set agency-specific utilization targets that override the organization default for their agency's staff
  - [ ] Resolution order: agency-level target (if set) takes precedence over org-level target for agency staff; direct staff always use org-level target
  - [ ] Optionally, targets can be set per staff type (role-based overrides)
  - [ ] Thresholds drive visual indicators: green (at/above target), yellow (warning), red (critical)

**FR-5: Utilization Dashboard (Platform Admin & Agency Admin)**
- **Description**: Dedicated utilization dashboards for both platform admins (organization-wide) and agency admins (agency-scoped)
- **Acceptance Criteria**:
  - [ ] Platform admin dashboard: organization-wide utilization rate, total bench cost, staff list filterable by role/client/agency/status
  - [ ] Agency admin dashboard (in agency portal): agency-scoped utilization rate and bench cost for their staff only
  - [ ] Total bench cost for the current period displayed prominently (scoped to viewer's authority)
  - [ ] Staff list with individual utilization rates, sortable and filterable
  - [ ] Utilization trend chart showing rates over time (monthly, past 12 months)
  - [ ] Drill-down from aggregate level to individual staff detail
  - [ ] Color-coded status indicators based on configured thresholds (using agency-level thresholds for agency staff when set)

**FR-6: Bench Report (Multi-Scope)**
- **Description**: A focused report listing bench and under-utilized staff with cost impact, scoped by viewer authority
- **Acceptance Criteria**:
  - [ ] Lists all staff currently below the utilization target
  - [ ] For each staff member shows: name, role, current utilization rate, bench hours, bench cost, days on bench, last active assignment end date
  - [ ] Sortable by bench cost (highest first) to prioritize expensive idle resources
  - [ ] Filterable by staff type, engagement type, and agency
  - [ ] Summary totals: total bench headcount, total bench cost, average bench duration
  - [ ] Platform admins see the full organization bench report
  - [ ] Agency admins see bench report scoped to their agency's staff only (accessible from agency portal)

**FR-7: Utilization Snapshots**
- **Description**: The system captures periodic utilization snapshots for historical tracking and trend analysis
- **Acceptance Criteria**:
  - [ ] Snapshots are generated on a configurable schedule (default: weekly on Monday)
  - [ ] Each snapshot records: staff member, period, available hours, billable hours, non-billable hours, utilization rate, bench hours, bench cost
  - [ ] Snapshots are immutable once generated (historical record)
  - [ ] Snapshots can be manually triggered by admins for ad-hoc analysis

**FR-8: Utilization Alerts**
- **Description**: Automated notifications when staff utilization drops below configured thresholds
- **Acceptance Criteria**:
  - [ ] When a utilization snapshot is generated, staff below warning threshold trigger a notification
  - [ ] Staff below critical threshold trigger an urgent notification
  - [ ] Notifications are sent to organization admins (for all staff) and agency admins (for their agency's staff) via the existing notification system
  - [ ] Alerts include staff name, current utilization rate, threshold breached, and bench cost impact
  - [ ] Duplicate alerts for the same staff member in consecutive periods are suppressed (alert only on initial threshold breach and if the situation worsens)

**FR-9: Staff Detail Utilization View**
- **Description**: Individual staff detail pages include a utilization tab showing their deployment efficiency
- **Acceptance Criteria**:
  - [ ] Utilization tab shows current period utilization rate and status (on target, warning, critical)
  - [ ] Historical utilization trend chart (past 6-12 months)
  - [ ] Breakdown of hours: billable, non-billable, bench
  - [ ] Assignment timeline showing placements and gaps
  - [ ] Bench cost attributed to this staff member for the current period

**FR-10: Analytics Integration**
- **Description**: Key utilization metrics are surfaced in the existing analytics and main dashboard
- **Acceptance Criteria**:
  - [ ] Main dashboard overview includes a utilization summary widget (org utilization rate + bench cost)
  - [ ] Analytics page includes utilization KPI cards alongside existing margin and revenue metrics
  - [ ] CFO Strategist receives utilization data for AI-powered staffing recommendations

### Data Requirements

**DR-1: Utilization Snapshot**
- **Description**: A point-in-time record of a staff member's utilization metrics for a specific period
- **Key Attributes**: Staff reference, organization reference, period start, period end, available hours, billable hours, non-billable hours, utilization rate (percentage), bench hours, bench cost (monetary), data source (timesheet or allocation fallback), generated timestamp
- **Validation Rules**: One snapshot per staff member per period. Utilization rate must be between 0% and 100%. Available hours must be positive. Bench hours = available hours - billable hours - non-billable hours (only idle time incurs bench cost; non-billable productive hours are tracked but excluded from bench cost).

**DR-2: Utilization Target**
- **Description**: Configurable thresholds for utilization monitoring per organization
- **Key Attributes**: Organization reference, staff type (optional, for role-specific targets), target utilization rate, warning threshold, critical threshold, standard daily hours, enabled flag
- **Validation Rules**: Target rate must be between 0% and 100%. Warning threshold must be less than target. Critical threshold must be less than warning. Standard daily hours must be between 1 and 24.

---

## Success Criteria

### Measurable Outcomes

- [ ] **Visibility**: Organization utilization rate and bench cost are visible within 2 clicks from the main dashboard
- [ ] **Bench Identification Speed**: Managers can identify all bench resources and their cost impact within 30 seconds of opening the bench report
- [ ] **Trend Tracking**: Utilization trends are available for the past 12 months with weekly granularity
- [ ] **Alert Responsiveness**: Utilization alerts are generated within 24 hours of a staff member dropping below threshold
- [ ] **Accuracy**: Utilization calculations using timesheet data match manual calculation within 1% tolerance
- [ ] **Fallback Reliability**: When no timesheet data exists, allocation-based utilization estimates are generated without errors
- [ ] **Adoption**: 100% of organization admins access the utilization dashboard at least weekly within 4 weeks of launch
- [ ] **Decision Impact**: Average bench duration decreases by 15% within 3 months of feature adoption (measured by comparing pre/post launch bench snapshots)

---

## Dependencies

### External Dependencies

- None (this is a self-contained feature within the existing platform)

### Internal Dependencies

- **Timesheets** (Spec 15): Primary data source for billable hours; feature functions with allocation fallback if Spec 15 is not yet implemented
- **Staff Management** (Spec 3): Staff records, roles, rates, and engagement types
- **Staff Assignments**: Assignment records with allocation percentages (fallback data source)
- **Agency Markup** (Spec 14): True cost fields for accurate bench cost calculations
- **Notification System**: Existing notification infrastructure for utilization alerts
- **CFO Strategist** (Spec 7): Receives utilization data for AI-driven staffing recommendations

---

## Assumptions

- Standard working hours are 8 hours/day and 5 days/week (configurable per organization)
- Utilization is calculated based on calendar working days, excluding weekends; public holidays are not tracked in the initial release
- Bench cost uses the staff member's true cost (true_cost field) when available; falls back to the staff rate field if true cost is not set. Bill rate is never used for bench cost.
- The system can function without Spec 15 (Timesheets) by using allocation percentages as a fallback for utilization estimates
- Utilization snapshots are generated weekly by default; real-time utilization is calculated on-demand from current data
- Only active staff with eligible engagement types (FULL_TIME, PART_TIME, PROJECT, AGENCY) are included in utilization metrics; OWNER type is excluded; terminated staff appear only in historical data
- For staff with VARIABLE rate type, the most recent known rate is used for bench cost calculations

---

## Out of Scope

- Capacity planning and demand forecasting (future feature)
- Hiring recommendations based on utilization data
- Client-facing utilization reports
- Revenue forecasting from utilization projections
- Public holiday calendars and PTO deductions from available hours
- Utilization gamification or leaderboards
- Real-time utilization streaming (near-real-time via snapshots is sufficient)
- Contractor utilization (contractors are billed per invoice, not tracked for utilization)
- Multi-organization benchmarking or industry comparison

---

## Security & Privacy Considerations

- **Data Privacy**: Individual utilization rates are sensitive performance data; staff members can see only their own utilization unless they have admin/manager roles
- **Access Control**: Organization-wide utilization dashboards and bench reports are restricted to admin and executive roles. Agency admins have full utilization visibility (dashboards, bench reports, targets configuration) scoped to their agency's staff only, accessible through the agency portal. Agency admins cannot see utilization data for staff outside their agency.
- **Data Retention**: Utilization snapshots are retained indefinitely for historical analysis and trend reporting

---

## Future Enhancements

- Capacity planning dashboard with demand forecasting
- Hiring recommendations triggered by sustained high utilization (>90% org-wide)
- Revenue impact modeling: "if we improve utilization by X%, margin improves by Y%"
- Public holiday calendar integration for accurate available hours
- Client-facing utilization reports for transparency
- Predictive bench alerts: "Staff X's assignment ends in 2 weeks with no next placement"
- Contractor utilization tracking for blended workforce visibility
- Utilization-based compensation incentives
