# Feature Specification: Timesheets & Time Tracking

**Status**: Draft
**Created**: 2026-03-06
**Last Updated**: 2026-03-06

---

## Overview

### Feature Summary

A complete time tracking and timesheet management system that enables staff to log actual hours worked against client placements and projects, submit timesheets for approval, and drive accurate hours-based billing for staff augmentation engagements.

### Business Value

Staff augmentation billing requires tracking actual hours worked, not static allocation percentages. Without timesheets, the organization cannot:
- Bill clients accurately based on real hours delivered
- Identify overtime and manage labor costs
- Calculate true utilization rates for staffing decisions
- Provide auditable records of work performed per engagement
- Reconcile contractor/staff hours against invoiced amounts

This feature transforms billing from estimated allocation-based calculations to actuals-based billing, improving revenue accuracy and client trust.

### Target Users

- **Staff Members**: Log daily hours against their client assignments and projects
- **Organization Admins/Managers**: Review, approve, or reject submitted timesheets; configure approval rules and overtime policies
- **Agency Admins**: Full timesheet management for their agency's staff — view, approve/reject, configure overtime, and access billing summaries as if operating their own company
- **Executives**: View aggregated hours data for financial reporting and decision-making

---

## Clarifications

### Session 2026-03-06

- Q: Can staff create timesheets for past weeks, and is there a lookback limit? → A: 2-week lookback — staff can create timesheets for the current week plus the prior 2 weeks. Older periods require admin intervention.
- Q: How should overtime hours be distributed across multiple client assignments for billing? → A: Proportional — overtime hours are split across assignments in proportion to regular hours logged per client that week.
- Q: Should the description field on time entries be required or optional? → A: Required on submission — descriptions can be blank in drafts but must be filled in before timesheet submission.
- Q: What level of timesheet authority should agency admins have? → A: Full authority — agency admins can approve/reject timesheets for their staff, configure agency-level overtime, view billing summaries, and export timesheet data. Platform admin retains global visibility and override capability.
- Q: Should agency-level overtime configuration be separate from org-level? → A: Yes — each agency can set its own overtime threshold and multiplier. The org-level config serves as the default; agency-level overrides take precedence for agency staff.

---

## User Scenarios

### Primary Use Cases

**Scenario 1: Staff Logs Daily Hours**
- **Actor**: Staff Member
- **Goal**: Record hours worked for the day across one or more client assignments
- **Steps**:
  1. Staff member opens the timesheet portal
  2. Selects the current week's timesheet (auto-created as DRAFT if not existing)
  3. For each day, enters hours against their assigned client(s) and optionally a project
  4. Marks each entry as billable or non-billable
  5. Adds a brief description of work performed
  6. Saves entries (timesheet remains in DRAFT status)
- **Expected Outcome**: Time entries are saved and visible in the weekly timesheet grid. Running totals update automatically.

**Scenario 2: Staff Submits Weekly Timesheet**
- **Actor**: Staff Member
- **Goal**: Submit completed timesheet for manager approval
- **Steps**:
  1. Staff member reviews the weekly timesheet with all daily entries
  2. Verifies total hours, billable vs non-billable split, and overtime hours
  3. Clicks "Submit for Approval"
  4. Timesheet status changes from DRAFT to SUBMITTED
- **Expected Outcome**: Timesheet is locked for editing and appears in the manager's approval queue. Staff receives confirmation.

**Scenario 3: Manager Approves Timesheet**
- **Actor**: Organization Admin/Manager
- **Goal**: Review and approve a submitted timesheet
- **Steps**:
  1. Manager opens the timesheet approval queue
  2. Reviews a submitted timesheet: hours per day, client allocation, descriptions, overtime
  3. Approves the timesheet
  4. Timesheet status changes from SUBMITTED to APPROVED
- **Expected Outcome**: Approved hours become the basis for billing calculations. Staff member is notified of approval.

**Scenario 4: Manager Rejects Timesheet**
- **Actor**: Organization Admin/Manager
- **Goal**: Return a timesheet that has errors or needs corrections
- **Steps**:
  1. Manager reviews a submitted timesheet and finds discrepancies
  2. Rejects the timesheet with a written reason (e.g., "Missing Friday hours" or "Project code incorrect")
  3. Timesheet status changes from SUBMITTED to REJECTED
- **Expected Outcome**: Timesheet is unlocked for editing. Staff member is notified with the rejection reason and can make corrections and resubmit.

**Scenario 5: Agency Admin Manages Staff Timesheets**
- **Actor**: Agency Admin
- **Goal**: Manage the full timesheet lifecycle for their agency's staff as if operating their own company
- **Steps**:
  1. Agency admin logs into the agency portal
  2. Navigates to the timesheets section
  3. Views all timesheets for their agency's staff (all statuses: DRAFT, SUBMITTED, APPROVED, REJECTED)
  4. Reviews a submitted timesheet: hours per day, client allocation, descriptions, overtime
  5. Approves or rejects the timesheet with a reason
  6. Views billing summaries and hours reports for their agency's staff
  7. Exports timesheet data for their agency's staff
- **Expected Outcome**: Agency admin has full control over timesheet approval for their staff, can track hours and billing, and operates independently without requiring platform admin intervention.

**Scenario 5b: Agency Admin Configures Overtime for Their Agency**
- **Actor**: Agency Admin
- **Goal**: Set overtime thresholds and rate multipliers specific to their agency
- **Steps**:
  1. Agency admin navigates to agency portal settings
  2. Sets weekly hours threshold (e.g., 45 hours/week for their workforce)
  3. Sets overtime rate multiplier (e.g., 1.25x)
  4. Saves configuration
- **Expected Outcome**: Agency-specific overtime rules apply to all their staff timesheets, independent of the platform-wide overtime configuration.

**Scenario 6: Admin Configures Overtime Rules**
- **Actor**: Organization Admin
- **Goal**: Set overtime thresholds and rate multipliers for the organization
- **Steps**:
  1. Admin navigates to timesheet settings
  2. Sets weekly hours threshold (e.g., 40 hours/week)
  3. Sets overtime rate multiplier (e.g., 1.5x)
  4. Saves configuration
- **Expected Outcome**: Hours exceeding the threshold are automatically flagged as overtime in timesheets, and billing calculations apply the overtime multiplier.

### Edge Cases

- Staff member has multiple active assignments across different clients — time entries must be allocated per assignment
- Staff member tries to submit a timesheet with zero hours — system should warn but allow submission (e.g., PTO week)
- Timesheet period spans a staff member's start or end date — only active days should be available for entry
- Manager approves a timesheet after the billing period has closed — approved hours should still be captured but flagged for late billing
- Staff member has no active assignments — timesheet can still be created for non-billable/bench time tracking
- Overlapping time entries for the same day and assignment — system should prevent duplicate entries

---

## Functional Requirements

### Core Requirements

**FR-1: Time Entry Management**
- **Description**: Staff members can create, edit, and delete individual time entries within a draft timesheet
- **Acceptance Criteria**:
  - [ ] Each time entry captures: date, hours (decimal, 0.25 increments), assignment reference, optional project reference, description (optional in draft, required on submission), billable flag
  - [ ] Hours are validated: minimum 0.25, maximum 24 per entry, maximum 24 total per day across all entries
  - [ ] Time entries can only be modified when the parent timesheet is in DRAFT or REJECTED status
  - [ ] Entries are linked to the staff member's active assignments
  - [ ] Non-assigned staff can log time as non-billable (bench time)

**FR-2: Timesheet Lifecycle**
- **Description**: Timesheets follow a defined status workflow: DRAFT, SUBMITTED, APPROVED, REJECTED
- **Acceptance Criteria**:
  - [ ] Timesheets are created per staff member per weekly period (Monday-Sunday)
  - [ ] A draft timesheet is auto-created when a staff member first logs time for a week
  - [ ] Staff can create timesheets for the current week and up to 2 prior weeks; older periods require admin action
  - [ ] Status transitions follow: DRAFT → SUBMITTED → APPROVED or REJECTED; REJECTED → SUBMITTED (resubmission)
  - [ ] Submitted and approved timesheets are read-only (no entry edits)
  - [ ] Rejected timesheets are unlocked for editing and resubmission
  - [ ] Each status transition is timestamped and attributed to the acting user

**FR-3: Approval Workflow (Dual-Authority)**
- **Description**: Both platform admins and agency admins can review, approve, or reject submitted timesheets for staff within their authority
- **Acceptance Criteria**:
  - [ ] Submitted timesheets appear in an approval queue visible to authorized approvers
  - [ ] Approvers can filter the queue by staff member, period, and status
  - [ ] Rejection requires a written reason (minimum 10 characters)
  - [ ] Approval and rejection trigger notifications to the staff member
  - [ ] Organization admins can approve any timesheet across the organization
  - [ ] Agency admins can approve/reject timesheets only for staff belonging to their agency
  - [ ] Agency admins see an approval queue scoped to their agency's staff in the agency portal
  - [ ] Platform admin retains override capability: can approve/reject any timesheet regardless of agency admin action
  - [ ] Both approval sources (agency admin or platform admin) are tracked with the reviewer's identity

**FR-4: Overtime Tracking (Multi-Level Configuration)**
- **Description**: Hours exceeding a configurable weekly threshold are automatically flagged as overtime, with support for both organization-level and agency-level overtime rules
- **Acceptance Criteria**:
  - [ ] Organization can set a weekly hours threshold (default: 40 hours)
  - [ ] Organization can set an overtime rate multiplier (default: 1.5x)
  - [ ] Agency admins can set agency-specific overtime thresholds and multipliers that override the organization default for their agency's staff
  - [ ] Resolution order: agency-level config (if set) takes precedence over org-level config for agency staff; direct staff always use org-level config
  - [ ] When total weekly hours exceed the threshold, excess hours are automatically classified as overtime
  - [ ] When a staff member has multiple assignments, overtime hours are distributed proportionally based on regular hours logged per assignment that week
  - [ ] Overtime hours are visually distinguished in the timesheet view
  - [ ] Billing calculations apply the overtime multiplier to overtime hours

**FR-5: Billing Calculation from Approved Hours**
- **Description**: Approved timesheet hours drive billing amount calculations per client assignment
- **Acceptance Criteria**:
  - [ ] Billable amount = (approved billable hours x staff bill rate) + (approved overtime hours x staff bill rate x overtime multiplier)
  - [ ] Calculations use the staff member's current bill rate at the time of the timesheet period
  - [ ] Billing summaries are available per client, per staff member, and per period
  - [ ] Non-billable hours are excluded from billing but tracked for utilization purposes

**FR-6: Timesheet Portal for Staff**
- **Description**: Staff members have a self-service interface to manage their timesheets
- **Acceptance Criteria**:
  - [ ] Staff can view all their timesheets with status indicators
  - [ ] Weekly grid view shows days as columns and assignments as rows
  - [ ] Running totals display per day, per assignment, and weekly total
  - [ ] Staff can navigate between weeks easily
  - [ ] Clear visual indicators for billable vs non-billable and overtime hours

**FR-7: Timesheet Dashboard (Platform Admin & Agency Admin)**
- **Description**: Both platform admins and agency admins have centralized timesheet views appropriate to their authority scope
- **Acceptance Criteria**:
  - [ ] Platform admin dashboard shows all timesheets across the organization, filterable by status, staff member, client, agency, and period
  - [ ] Agency admin dashboard (in agency portal) shows all timesheets for their agency's staff, filterable by status, staff member, client, and period
  - [ ] Summary statistics: total hours submitted, approved, pending review (scoped to viewer's authority)
  - [ ] Bulk actions: approve multiple timesheets at once (platform admin: any timesheet; agency admin: their agency's staff only)
  - [ ] Drill-down to individual timesheet detail with full entry breakdown
  - [ ] Agency admin can see billing summaries for their agency's staff timesheets

**FR-8: Timesheet Reporting (Multi-Scope)**
- **Description**: Aggregated hours data is available for reporting and export, scoped by viewer authority
- **Acceptance Criteria**:
  - [ ] Hours summary report by staff, client, project, and period
  - [ ] Export timesheet data in CSV format
  - [ ] Report includes billable hours, non-billable hours, overtime hours, and calculated billing amounts
  - [ ] Platform admins see reports across the entire organization
  - [ ] Agency admins see reports scoped to their agency's staff only
  - [ ] Agency admins can export CSV for their agency's staff timesheets from the agency portal

### Data Requirements

**DR-1: Timesheet**
- **Description**: A weekly submission unit grouping time entries for a single staff member
- **Key Attributes**: Staff reference, organization reference, period start date, period end date, status, total hours, billable hours, overtime hours, submitted timestamp, reviewer reference, reviewed timestamp, rejection reason
- **Validation Rules**: One timesheet per staff member per week. Period start must be a Monday. Period end must be the following Sunday. Total hours must equal sum of time entry hours.

**DR-2: Time Entry**
- **Description**: An individual record of hours worked on a specific date for a specific assignment
- **Key Attributes**: Timesheet reference, staff reference, assignment reference, project reference (optional), date, hours (decimal), description, billable flag, overtime flag
- **Validation Rules**: Date must fall within parent timesheet's period. Hours must be between 0.25 and 24. Total hours per day across all entries must not exceed 24. Assignment must be active for the staff member on the entry date.

**DR-3: Overtime Configuration**
- **Description**: Organization-level settings for overtime tracking
- **Key Attributes**: Organization reference, weekly hours threshold, overtime rate multiplier, enabled flag
- **Validation Rules**: Threshold must be positive. Multiplier must be >= 1.0.

---

## Success Criteria

### Measurable Outcomes

- [ ] **Time Entry Speed**: Staff members can log a full week of time entries in under 5 minutes
- [ ] **Approval Turnaround**: 90% of submitted timesheets are reviewed (approved or rejected) within 2 business days
- [ ] **Billing Accuracy**: Billing amounts calculated from approved hours match expected values within 1% tolerance
- [ ] **Adoption**: 80% of active staff members submit timesheets weekly within 4 weeks of launch
- [ ] **Data Completeness**: 100% of submitted timesheets have descriptions on all time entries (enforced at submission)
- [ ] **Overtime Visibility**: All overtime hours are automatically flagged without manual intervention
- [ ] **Resubmission Rate**: Rejected timesheets are corrected and resubmitted within 1 business day on average

---

## Dependencies

### External Dependencies

- None (this is a self-contained feature within the existing platform)

### Internal Dependencies

- **Staff Management** (Spec 3): Staff records and assignment data must exist
- **Staff Assignments**: Active StaffAssignment records are required for billable time entry linking
- **Agency Markup** (Spec 14): Bill rate and true cost fields on Staff used for billing calculations
- **Notification System**: Existing notification infrastructure for approval/rejection alerts

---

## Assumptions

- The timesheet period is weekly (Monday-Sunday); bi-weekly or monthly periods are out of scope for the initial release
- Time is entered in decimal hours (0.25 increments), not clock-in/clock-out format
- All active staff members (including agency-placed staff) are expected to submit timesheets
- Overtime rules apply at two levels: organization-wide default and optional per-agency override. Per-client or per-staff-type variations are out of scope for the initial release
- The existing ContractorInvoice approval workflow pattern (DRAFT → SUBMITTED → APPROVED → REJECTED) is a proven UX pattern to follow
- Staff members access timesheets through the existing portal infrastructure (contractor-portal pattern)
- Bill rates are sourced from the Staff record's current rate at the time of the timesheet period

---

## Out of Scope

- Clock-in/clock-out or start/stop timer functionality
- Mobile-native time tracking app (web responsive only)
- Integration with external time tracking tools (Harvest, Toggl, Clockify)
- PTO/leave management and tracking
- Client-facing timesheet approval (approval is internal only)
- Automated invoice generation from approved timesheets (future enhancement)
- Bi-weekly or monthly timesheet periods (weekly only for initial release)
- Per-client or per-staff-type overtime rule variations (per-agency is supported)
- Geolocation or IP-based time entry verification
- AI-powered time entry suggestions

---

## Security & Privacy Considerations

- **Data Privacy**: Time entries contain work descriptions that may reference client-proprietary information; entries are scoped to the organization via multi-tenancy
- **Access Control**: Staff can only view and edit their own timesheets. Platform admins can view and approve all timesheets within their organization. Agency admins can view all statuses and approve/reject timesheets for their agency's staff. Agency admins cannot see timesheets for staff outside their agency.
- **Audit Trail**: All status transitions (submit, approve, reject) are logged with timestamps and acting user for compliance

---

## Future Enhancements

- Automated invoice generation from approved timesheets
- Integration with external time tracking tools (Harvest, Toggl)
- Bi-weekly and monthly timesheet period options
- Per-client overtime rules and rate overrides
- Time entry templates for recurring work patterns
- Mobile-native time tracking with offline support
- Client portal view for timesheet visibility
- Budget tracking: actual hours vs estimated hours per project
