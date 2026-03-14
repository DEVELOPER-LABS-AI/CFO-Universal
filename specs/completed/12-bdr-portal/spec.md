# Feature Specification: BDR Portal — End-of-Month Reports, Bonus Plans & Expense Reimbursement

**Status**: Draft
**Created**: 2026-03-01
**Last Updated**: 2026-03-01

---

## Overview

### Feature Summary

A self-service portal for Business Development Representatives (BDRs) to submit end-of-month performance reports, track tiered bonus attainment based on meetings booked/showed, and submit expense reimbursement requests — paired with an admin interface for agencies to configure flexible pay plans and bonus tier structures.

### Business Value

Agency leadership currently has no standardized way to collect BDR performance data, calculate tiered bonuses, or process expense reimbursements. This leads to manual spreadsheet tracking, inconsistent bonus calculations, and delayed reimbursements. This feature creates a structured workflow where admins define bonus tiers and pay plans, BDRs self-report their metrics and expenses, and leadership gets a clear view of bonus payouts and costs — reducing administrative overhead and ensuring BDRs are compensated accurately and on time.

### Target Users

- **Primary**: BDRs (Business Development Representatives) — submit monthly reports, view bonus attainment, submit expenses
- **Primary**: Agency Admins / Leadership — configure pay plans, review BDR reports, approve expenses, view bonus summaries
- **Secondary**: Finance — review approved bonuses and expenses for payment processing

---

## Clarifications

### Session 2026-03-03

- Q: How are BDRs represented in the existing data model? → A: Staff members with `staff_type = 'BDR'` (dynamic role from StaffRole config table; `engagement_type` describes employment arrangement e.g. FULL_TIME/PART_TIME)
- Q: Where does the BDR portal live in the app architecture? → A: Separate portal at `/bdr-portal` (like the contractor portal pattern); admin management in `/dashboard/bdr`
- Q: Where should uploaded receipts be stored and what's the max file size? → A: Supabase Storage with 10MB max file size per receipt
- Q: For MVP, should the report form capture both metrics (meetings booked + showed) or just the bonus-driving metric? → A: Capture both metrics; pay plan base metric selects which one drives bonus calculation
- Q: Who can create and manage pay plans? → A: Both Agency Admins and regular Admins (not just Admins)

---

## User Scenarios

### Primary Use Cases

**Scenario 1: Admin Configures a BDR Pay Plan with Tiered Bonuses**
- **Actor**: Agency Admin
- **Goal**: Set up a flexible bonus structure tied to meetings showed
- **Steps**:
  1. Navigate to BDR Pay Plan settings
  2. Create a new pay plan (or edit an existing one)
  3. Define the base metric (e.g., "Meetings Showed")
  4. Add bonus tiers with thresholds and payout amounts:
     - Tier 1: 1-5 meetings → $X per meeting
     - Tier 2: 6-10 meetings → $Y per meeting (higher rate)
     - Tier 3: 11+ meetings → $Z per meeting (highest rate)
  5. Set the effective date range for the plan
  6. Assign the pay plan to one or more BDRs
- **Expected Outcome**: BDRs assigned to this plan will have their bonuses auto-calculated based on the tier structure when they submit monthly reports

**Scenario 2: BDR Submits End-of-Month Report**
- **Actor**: BDR
- **Goal**: Report monthly performance metrics for bonus calculation
- **Steps**:
  1. Log into the BDR Portal
  2. Navigate to "End of Month Report" for the current period
  3. Enter the number of meetings booked and meetings showed
  4. Review the auto-calculated bonus based on their assigned pay plan tiers
  5. Add any optional notes or comments
  6. Submit the report
- **Expected Outcome**: Report is submitted for admin review; bonus calculation is visible to both BDR and admin

**Scenario 3: BDR Submits an Expense for Reimbursement**
- **Actor**: BDR
- **Goal**: Request reimbursement for a business expense
- **Steps**:
  1. Log into the BDR Portal
  2. Navigate to "Expenses"
  3. Select "New Expense"
  4. Enter expense details: date, category, amount, description
  5. Upload a receipt or supporting document
  6. Submit the expense for approval
- **Expected Outcome**: Expense is submitted and appears in the admin's approval queue

**Scenario 4: Admin Reviews BDR Monthly Reports**
- **Actor**: Agency Admin / Leadership
- **Goal**: Review all BDR submissions for the month and verify bonus calculations
- **Steps**:
  1. Navigate to the BDR Reports dashboard
  2. View all submitted reports for the current month
  3. Review each BDR's reported metrics against the assigned pay plan
  4. Verify the auto-calculated bonus amounts
  5. Approve or flag reports that need correction
- **Expected Outcome**: Admin has a clear summary of all BDR performance and total bonus payout for the month

**Scenario 5: Admin Approves or Rejects Expense Claims**
- **Actor**: Agency Admin
- **Goal**: Process BDR expense reimbursement requests
- **Steps**:
  1. Navigate to the Expense Approval queue
  2. Review pending expense submissions with receipts
  3. Approve valid expenses or reject with a reason
  4. Approved expenses are marked for reimbursement
- **Expected Outcome**: Approved expenses are logged for payment; rejected expenses notify the BDR with feedback

**Scenario 6: Leadership Views Bonus & Expense Summary**
- **Actor**: Agency Leadership
- **Goal**: Understand total BDR compensation costs for the month
- **Steps**:
  1. Navigate to BDR Reports dashboard
  2. View the monthly summary: total bonuses earned, total expenses approved, per-BDR breakdown
  3. Compare month-over-month trends
- **Expected Outcome**: Leadership has visibility into BDR compensation costs to inform budgeting

### Edge Cases

- **No Meetings in a Month**: A BDR who books zero meetings should still be able to submit a report (with $0 bonus). The system should not block submission.
- **Mid-Month Pay Plan Change**: If an admin changes the tier structure mid-month, the system should apply the plan that was active for the majority of the month (or allow admin to choose which plan applies).
- **Duplicate Report Submission**: A BDR should only be able to submit one report per month. If they need to correct it, the original report should be editable until approved.
- **Expense Without Receipt**: Some expenses may not have a receipt. The system should allow submission without a receipt but flag it for admin attention.
- **Retroactive Report Submission**: A BDR may need to submit a report for a previous month. The system should allow this with admin approval.
- **Multiple Pay Plans**: A BDR could theoretically be on different pay plans during a month (e.g., promotion). The system should handle plan transitions gracefully.

---

## Functional Requirements

### Core Requirements

**FR-1: Pay Plan Configuration**
- **Description**: Admins must be able to create and manage flexible pay plans with tiered bonus structures.
- **Acceptance Criteria**:
  - [ ] Admins can create a pay plan with a name, description, and effective date range
  - [ ] Each pay plan supports a configurable base metric (e.g., "Meetings Showed", "Meetings Booked")
  - [ ] Admins can define multiple bonus tiers per plan, each with a threshold range and payout rate
  - [ ] Tier examples: 1-5 meetings = $50/meeting, 6-10 = $75/meeting, 11+ = $100/meeting
  - [ ] Tiers are validated to ensure no gaps or overlaps in threshold ranges
  - [ ] Pay plans can be assigned to one or more BDRs
  - [ ] Historical pay plans are preserved (not deleted) when superseded

**FR-2: BDR End-of-Month Report Submission**
- **Description**: BDRs must be able to submit a structured monthly performance report through a portal interface.
- **Acceptance Criteria**:
  - [ ] BDRs can access a dedicated self-service portal at `/bdr-portal` with authentication (separate from admin dashboard)
  - [ ] The report form shows the current month and the BDR's assigned pay plan
  - [ ] BDRs enter their reported metrics (meetings booked, meetings showed)
  - [ ] The system auto-calculates the bonus amount based on the assigned pay plan tiers
  - [ ] BDRs can see the tier breakdown showing which tiers they hit
  - [ ] BDRs can add notes or comments to their report
  - [ ] Only one report can exist per BDR per month (editable until approved)
  - [ ] Reports have statuses: Draft, Submitted, Approved, Needs Correction

**FR-3: Tiered Bonus Calculation Engine**
- **Description**: The system must automatically calculate bonus amounts based on the BDR's reported metrics and their assigned pay plan tiers.
- **Acceptance Criteria**:
  - [ ] Bonus calculation applies the correct tier rate to each range of meetings
  - [ ] Example: 12 meetings with tiers [1-5 @ $50, 6-10 @ $75, 11+ @ $100] = (5x$50) + (5x$75) + (2x$100) = $825
  - [ ] Calculation is displayed as a line-by-line tier breakdown
  - [ ] Total bonus is shown prominently on the report
  - [ ] If the pay plan changes, existing approved reports retain their original calculation

**FR-4: Expense Reimbursement Submission**
- **Description**: BDRs must be able to submit expense reimbursement requests with supporting documentation.
- **Acceptance Criteria**:
  - [ ] BDRs can create an expense entry with: date, category, amount, description
  - [ ] Expense categories are configurable by the admin (e.g., Travel, Meals, Software, Office Supplies)
  - [ ] BDRs can upload receipt images or documents (PDF, JPG, PNG) to Supabase Storage, max 10MB per file
  - [ ] Expenses without receipts are accepted but flagged
  - [ ] Each expense has statuses: Submitted, Approved, Rejected, Reimbursed
  - [ ] BDRs can view their expense history and status

**FR-5: Admin Report Review & Approval**
- **Description**: Admins must be able to review, approve, or flag BDR monthly reports.
- **Acceptance Criteria**:
  - [ ] Admins see a queue of all submitted BDR reports for the current month
  - [ ] Each report shows: BDR name, reported metrics, auto-calculated bonus, tier breakdown
  - [ ] Admins can approve a report (finalizing the bonus amount)
  - [ ] Admins can mark a report as "Needs Correction" with feedback notes
  - [ ] BDRs are notified when their report is approved or needs correction
  - [ ] Approved reports cannot be modified without admin override

**FR-6: Admin Expense Approval**
- **Description**: Admins must be able to review and approve or reject BDR expense claims.
- **Acceptance Criteria**:
  - [ ] Admins see a queue of pending expense submissions
  - [ ] Each expense shows: BDR name, date, category, amount, description, receipt (if attached)
  - [ ] Admins can approve or reject with a reason
  - [ ] Rejected expenses notify the BDR with the rejection reason
  - [ ] Approved expenses are marked for reimbursement processing

**FR-7: BDR Compensation Dashboard**
- **Description**: The system must provide a summary dashboard for leadership showing BDR compensation data.
- **Acceptance Criteria**:
  - [ ] Dashboard shows all BDRs with their monthly bonus amounts and expense totals
  - [ ] Monthly summary includes: total bonuses paid, total expenses approved, grand total
  - [ ] Per-BDR breakdown is available (drill-down)
  - [ ] Month-over-month comparison is viewable
  - [ ] Data can be filtered by month, BDR, or pay plan

### Data Requirements

**DR-1: Pay Plan**
- **Description**: A configurable compensation structure defining how BDR bonuses are calculated
- **Key Attributes**: Name, description, base metric, effective start date, effective end date (optional), organization ID, created by
- **Validation Rules**: Name is required; at least one tier must be defined; effective start date is required

**DR-2: Bonus Tier**
- **Description**: A threshold-rate pair within a pay plan defining payout for a range of metric values
- **Key Attributes**: Pay plan ID, min threshold, max threshold (optional for top tier), payout rate per unit, sort order
- **Validation Rules**: Min threshold must be a positive integer; tiers within a plan cannot have overlapping ranges; payout rate must be positive

**DR-3: BDR Monthly Report**
- **Description**: A BDR's self-reported performance data for a specific month
- **Key Attributes**: BDR staff ID (Staff.id where engagement_type = 'BDR'), report month (year-month), meetings booked, meetings showed, calculated bonus, pay plan ID (snapshot), status, admin notes, submitted at, approved at
- **Validation Rules**: One report per BDR per month; meetings values must be non-negative integers; status must be one of the defined values

**DR-4: Expense Claim**
- **Description**: A reimbursement request submitted by a BDR
- **Key Attributes**: BDR staff ID (Staff.id), date, category, amount, description, receipt document ID (optional), status, admin notes, submitted at
- **Validation Rules**: Amount must be positive; date cannot be in the future; category must be from the configured list

**DR-5: Expense Category**
- **Description**: Admin-configurable categories for expense classification
- **Key Attributes**: Name, description, organization ID, active status
- **Validation Rules**: Name is required and unique within the organization

---

## Success Criteria

### Measurable Outcomes

- [ ] **Report Submission**: BDRs can submit their end-of-month report in under 5 minutes
- [ ] **Bonus Accuracy**: Auto-calculated bonuses match manual tier calculations with 100% accuracy
- [ ] **Admin Efficiency**: Admin can review and approve all BDR reports for a month in under 15 minutes (for up to 20 BDRs)
- [ ] **Expense Processing**: Expense submissions are processed (approved or rejected) within 48 hours of submission
- [ ] **Visibility**: Leadership can see total BDR compensation costs for any month within 2 clicks from the main dashboard
- [ ] **Flexibility**: Admins can modify bonus tiers without developer involvement — changes take effect for the next reporting period

---

## Dependencies

### Internal Dependencies

- **Authentication (Feature 2)**: BDR portal login and role-based access control
- **RLS Policies (Feature 8)**: Organization-level and user-level data isolation for BDR data
- **Contractor Portal (Feature 6)**: May share portal infrastructure and UI patterns for the BDR portal login experience

---

## Assumptions

- BDRs are represented as Staff members with `staff_type = 'BDR'` (dynamic role from the StaffRole config table); `engagement_type` describes their employment arrangement (FULL_TIME, PART_TIME, etc.)
- The primary metric for bonus calculation is "Meetings Showed" but the system should be flexible enough to support other metrics in the future
- BDR portal lives at `/bdr-portal` (separate from admin dashboard), following the contractor portal pattern; admin BDR management pages live at `/dashboard/bdr`
- BDR portal authentication will follow the same pattern as the contractor portal (magic link or standard login)
- Expense reimbursement is tracked and approved in this system but actual payment is handled outside (via Mercury or manual transfer)
- Monthly reporting periods align with calendar months (1st through last day of month)
- The number of BDRs per organization is manageable (under 50) — the system is not designed for enterprise sales organizations at this stage

---

## Out of Scope

- CRM integration for automatic meeting count verification (BDRs self-report)
- Automated payment/reimbursement processing (approval only; payment happens outside the system)
- Commission structures beyond tiered per-unit bonuses (e.g., percentage-of-revenue commissions)
- Real-time meeting tracking or calendar integration
- Team-based or quota-based bonus structures
- Tax withholding calculations on bonus amounts
- Multi-level approval workflows (single admin approval only)
- BDR onboarding or training management

---

## Security & Privacy Considerations

- **Access Control**: BDRs can only view and edit their own reports and expenses. Admins can view all BDR data within their organization.
- **Compensation Privacy**: Individual bonus amounts and pay plan details are only visible to the BDR themselves and admins — not to other BDRs.
- **Document Security**: Uploaded receipts are stored in Supabase Storage (max 10MB per file) with RLS policies ensuring access only by the submitting BDR and admins.
- **Data Isolation**: All BDR data is scoped by organization ID, enforced by RLS policies.

---

## Future Enhancements

- CRM integration (HubSpot, Salesforce) for automatic meeting verification
- Commission-based pay plans (percentage of deal value)
- Team quotas and team-based bonus pools
- Automated payment integration with Mercury for approved bonuses and expenses
- BDR performance leaderboards (opt-in, with privacy controls)
- Custom metric support beyond meetings (calls, demos, proposals sent)
- Multi-level approval workflows for larger organizations
- Annual compensation summaries and W-2/1099 data export
