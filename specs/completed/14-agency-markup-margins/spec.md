# Feature Specification: Agency Staff True Cost & Markup Transparency

**Status**: Draft
**Created**: 2026-03-05
**Last Updated**: 2026-03-05

---

## Overview

### Feature Summary

Enable platform owners to track the true cost of agency-sourced staff (what the agency actually pays the worker) alongside configurable markup rules, providing full margin visibility across individual staff, agencies, and client engagements.

### Business Value

When hiring talent through staffing agencies, the platform owner currently sees only the bill rate (what they pay the agency) with no insight into the agency's actual cost or the margin being charged. This feature exposes the true cost structure so the platform owner can:
- Negotiate better rates with agencies by understanding their margins
- Compare cost efficiency across multiple agencies
- Make informed decisions about whether to convert agency staff to direct hires
- Accurately forecast staffing costs and identify margin compression
- Ensure markup policies are consistently applied across all agency relationships

### Target Users

- **Platform Owner / Organization Admin**: Sets markup policies, reviews margins, negotiates with agencies
- **Finance / Operations Staff**: Reviews agency cost breakdowns, monitors margin health, reconciles invoices against expected costs

---

## Clarifications

### Session 2026-03-05

- Q: How should existing agency staff without true cost data be handled at launch? → A: Graceful gap - existing staff can have empty true cost; margin displays "N/A" until populated. No backfill required.
- Q: Should markup apply to base pay only, total compensation, or be configurable? → A: Configurable per agency - the platform owner chooses whether markup applies to base pay only or total compensation (base + expenses + reimbursements) for each agency relationship.
- Q: Can the bill rate be manually overridden or is it always computed from markup? → A: Hybrid - bill rate is auto-calculated by default, but a "lock rate" toggle lets the user fix the bill rate independently, ignoring markup changes.

---

## User Scenarios

### Primary Use Cases

**Scenario 1: Setting Agency-Level Markup Policy**
- **Actor**: Platform Owner
- **Goal**: Establish a default markup rule for a staffing agency
- **Steps**:
  1. Navigate to the agency detail page
  2. Open the markup configuration section
  3. Select markup type (percentage or flat rate) and enter the value (e.g., 30%)
  4. Choose the markup basis: base pay only, or total compensation (base pay + expenses + reimbursements)
  5. Save the markup configuration
- **Expected Outcome**: All new staff added under this agency automatically inherit the default markup. Existing agency staff can be updated to use the new default or retain their individual overrides.

**Scenario 2: Adding Agency Staff with True Cost**
- **Actor**: Platform Owner
- **Goal**: Add a new staff member sourced through an agency with full cost transparency
- **Steps**:
  1. Open the Add Staff modal and select "Agency" association
  2. Select the agency from the dropdown
  3. Enter the true cost (what the agency pays the worker) with rate and rate type
  4. View the auto-calculated bill rate based on the agency's markup configuration
  5. Optionally override the markup for this specific staff member
  6. Save the new staff member
- **Expected Outcome**: Staff record is created with both true cost and bill rate stored. The margin (dollar and percentage) is visible on the staff detail page.

**Scenario 3: Overriding Markup for Individual Staff**
- **Actor**: Platform Owner
- **Goal**: Set a different markup for a specific agency staff member who has a negotiated rate
- **Steps**:
  1. Navigate to the staff detail page for an agency staff member
  2. Open the cost/markup section
  3. Toggle "Override agency default markup"
  4. Enter the custom markup (percentage or flat rate)
  5. Save changes
- **Expected Outcome**: The staff member's bill rate recalculates using the custom markup instead of the agency default. The override is clearly indicated in the UI.

**Scenario 4: Reviewing Agency Margin Dashboard**
- **Actor**: Platform Owner / Finance Staff
- **Goal**: Understand margin health across all agency relationships
- **Steps**:
  1. Navigate to the agencies dashboard
  2. View aggregate margin metrics: total true cost, total billed cost, total margin ($ and %)
  3. Drill into a specific agency to see per-staff margin breakdown
  4. Review the monthly breakdown with true cost vs billed cost columns
- **Expected Outcome**: Clear visibility into which agencies have the highest/lowest margins, and which individual staff members represent the best/worst value.

**Scenario 5: Monthly Breakdown with Cost Transparency**
- **Actor**: Finance Staff
- **Goal**: Create a monthly agency breakdown that includes true cost detail
- **Steps**:
  1. Open the monthly breakdown form for an agency
  2. For each staff line item, see both the true cost (agency's cost) and the billed amount (what the org pays)
  3. Review margin per staff member and overall breakdown margin
  4. Submit the breakdown
- **Expected Outcome**: The monthly breakdown records preserve both true cost and billed cost, enabling historical margin analysis.

### Edge Cases

- **Agency with no markup configured**: Staff added to an agency with no markup rule should prompt the user to set a markup or allow entry of the bill rate directly (falling back to current behavior)
- **Markup change on existing staff**: When an agency's default markup changes, existing staff retain their current rates unless explicitly updated; a prompt offers to bulk-update
- **Zero markup**: Some agencies may operate at cost (0% markup) for certain arrangements; the system must allow this
- **Rate type mismatch**: If the agency's markup is defined as a flat hourly rate but the staff member's true cost is monthly, the system must convert appropriately using the standard conversion factors (176 hours/month)
- **Negative margin**: If the bill rate is manually set below the true cost, display a warning but allow it (some staff may be subsidized or in ramp-up periods)
- **Existing staff without true cost**: Pre-existing agency staff records are not required to have true cost populated; margin metrics display "N/A" and these records are excluded from aggregate margin calculations until true cost is entered
- **Locked rate with markup change**: When a staff member's bill rate is locked and the agency default markup changes, the locked rate is preserved; the UI shows the effective margin based on the locked rate vs true cost, not the agency default markup

---

## Functional Requirements

### Core Requirements

**FR-1: True Cost Capture**
- **Description**: When adding or editing staff associated with an agency, the system must capture the true cost (what the agency pays the worker) as a separate data point from the bill rate
- **Acceptance Criteria**:
  - [ ] A "True Cost" / "Agency Cost" field is available when adding or editing agency staff
  - [ ] True cost supports the same rate types as the existing rate field (hourly, daily, monthly, variable)
  - [ ] True cost is required when adding new staff with engagement type AGENCY
  - [ ] Existing agency staff without true cost display margin as "N/A" until true cost is populated
  - [ ] True cost is not shown or required for non-agency staff

**FR-2: Agency-Level Markup Configuration**
- **Description**: Each agency can have a default markup configuration that applies to all staff under that agency
- **Acceptance Criteria**:
  - [ ] Agency record supports a markup type: percentage or flat rate
  - [ ] Percentage markup is expressed as a percentage of true cost (e.g., 30% means bill rate = true cost * 1.30)
  - [ ] Flat rate markup is expressed in the same unit as the rate type (e.g., +$15/hr)
  - [ ] Agency markup includes a "markup basis" setting: base pay only, or total compensation (base + expenses + reimbursements)
  - [ ] Markup configuration is optional; agencies without markup configured function as they do today
  - [ ] Changing agency markup does not automatically change existing staff rates

**FR-3: Staff-Level Markup Override**
- **Description**: Individual agency staff members can have a custom markup that overrides the agency default
- **Acceptance Criteria**:
  - [ ] Staff record can store an individual markup type and value
  - [ ] When a staff-level markup exists, it takes precedence over the agency default
  - [ ] The UI clearly indicates when a staff member uses an override vs the agency default
  - [ ] The override can be removed to revert to the agency default

**FR-4: Bill Rate Auto-Calculation**
- **Description**: The bill rate (what the organization pays) is automatically calculated from true cost + applicable markup
- **Acceptance Criteria**:
  - [ ] When true cost and markup are both provided, the bill rate is auto-calculated and displayed
  - [ ] The user can see the calculated bill rate before saving
  - [ ] For percentage markup on base pay only: bill rate = true cost * (1 + markup_percentage / 100)
  - [ ] For percentage markup on total compensation: bill rate = (true cost + expenses + reimbursements) * (1 + markup_percentage / 100)
  - [ ] For flat rate markup: bill rate = true cost + flat_amount (applied to base rate regardless of basis setting)
  - [ ] Rate type conversions are handled correctly (e.g., hourly markup on monthly true cost uses 176 hours/month)
  - [ ] The auto-calculated bill rate populates the existing rate field on the Staff record
  - [ ] A "lock rate" toggle allows the user to fix the bill rate manually, decoupling it from the markup formula
  - [ ] When the rate is locked, changes to true cost or markup do not recalculate the bill rate
  - [ ] Locked rates display an indicator showing the rate is manually set and the effective markup percentage differs from the agency default
  - [ ] The lock can be removed to revert to auto-calculated behavior

**FR-5: Margin Display on Staff Records**
- **Description**: Each agency staff member's detail view shows the margin between bill rate and true cost
- **Acceptance Criteria**:
  - [ ] Margin is displayed as both a dollar amount and a percentage
  - [ ] Monthly equivalent margin is shown regardless of rate type
  - [ ] Negative margins are highlighted with a warning indicator
  - [ ] Margin information is only visible to organization admins (not agency admin users)

**FR-6: Agency Dashboard Margin Metrics**
- **Description**: The agencies dashboard and individual agency detail pages display aggregate margin information
- **Acceptance Criteria**:
  - [ ] Agencies dashboard shows: total monthly true cost, total monthly billed cost, total margin ($), average margin (%)
  - [ ] Individual agency detail page shows per-staff margin breakdown
  - [ ] Agency comparison is possible by viewing margin percentages across agencies
  - [ ] Only active (non-terminated, non-deleted) staff are included in margin calculations

**FR-7: Enhanced Monthly Breakdown**
- **Description**: The agency monthly breakdown includes true cost alongside billed cost for each staff line item
- **Acceptance Criteria**:
  - [ ] Staff breakdown items include a true cost field in addition to the existing base_pay (bill rate)
  - [ ] The breakdown shows margin per staff line item
  - [ ] Breakdown total includes both total true cost and total billed cost
  - [ ] Historical breakdowns retain the true cost data at the time of creation (snapshot, not recalculated)

### Data Requirements

**DR-1: Agency Markup Configuration**
- **Description**: Stores the default markup rule for an agency
- **Key Attributes**: markup type (percentage or flat), markup value, markup basis (base pay only OR total compensation including expenses and reimbursements) - configurable per agency
- **Validation Rules**: Markup value must be non-negative for percentage type; flat rate can be any non-negative value; markup type is required when markup value is set

**DR-2: Staff True Cost**
- **Description**: Stores the true compensation cost for agency staff
- **Key Attributes**: true cost amount, true cost rate type (hourly/daily/monthly/variable)
- **Validation Rules**: Required when creating new staff with engagement type AGENCY; optional for existing agency staff (nullable for migration); must be greater than zero when provided; rate type must match or be convertible to the bill rate type

**DR-3: Staff Markup Override & Rate Lock**
- **Description**: Optional per-staff markup that overrides the agency default, with optional rate lock
- **Key Attributes**: override markup type, override markup value, override active flag, rate locked flag (boolean), locked bill rate value (when rate is locked)
- **Validation Rules**: Same validation as agency-level markup; when active, takes precedence over agency default. When rate is locked, the locked bill rate is stored independently and markup changes are ignored until unlocked.

**DR-4: Enhanced Breakdown Line Items**
- **Description**: Monthly breakdown staff items include true cost alongside billed cost
- **Key Attributes**: true_cost field per staff item in the JSONB breakdown structure
- **Validation Rules**: True cost should be less than or equal to base_pay (billed cost) under normal conditions; warn but allow exceptions

---

## Success Criteria

### Measurable Outcomes

- [ ] **Completeness**: 100% of agency staff records have true cost captured within one billing cycle of feature launch
- [ ] **Accuracy**: Bill rate auto-calculation matches expected value (true cost + markup) with no rounding errors greater than $0.01
- [ ] **Visibility**: Platform owner can determine the margin for any agency staff member within 2 clicks from the agencies dashboard
- [ ] **Efficiency**: Monthly breakdown creation time does not increase by more than 30 seconds compared to current flow
- [ ] **Decision Support**: Platform owner can compare margin percentages across all agencies on a single dashboard view
- [ ] **Data Integrity**: Historical monthly breakdowns preserve true cost snapshots and are not affected by subsequent markup changes

---

## Dependencies

### Internal Dependencies

- Existing Staff management system (Staff model, AddStaffModal, EditStaffModal, StaffTable)
- Existing Agency management system (Agency model, agency detail pages, AgencyMonthlyBreakdown)
- Currency utility functions for rate type conversions (toMonthlyCost)
- Agency cost calculation utilities (agency-costs.ts)

---

## Assumptions

- The true cost represents what the agency pays the worker and is provided by the platform owner based on contractual knowledge or negotiation with the agency (the agency does not self-report via the platform)
- Markup is always calculated on top of the true cost (cost-plus model), not derived by subtracting from a fixed bill rate
- The existing `rate` field on Staff will continue to represent the bill rate (what the organization pays); new fields are additive
- Rate type conversions use the existing standard: 176 hours/month (22 days * 8 hours), 22 days/month
- Margin visibility is restricted to organization admin users; agency admin users should not see true cost or margin data
- Only one markup rule applies per staff member at a time (either agency default or staff override, not stacked)

---

## Out of Scope

- Agency self-service portal where agencies enter their own cost data
- Historical markup change tracking / audit log (future enhancement)
- Automated markup negotiation or rate benchmarking against market data
- Integration with external staffing platforms or vendor management systems (VMS)
- Tiered or conditional markup rules (e.g., different rates for overtime, different rates after 6 months)
- Multi-currency support for true cost vs bill rate

---

## Security & Privacy Considerations

- **Data Privacy**: True cost and margin data are sensitive business intelligence. This data must not be visible to agency admin users who log into the platform
- **Access Control**: Only organization admins and designated finance roles should see true cost, markup configuration, and margin metrics. Agency admin users see only the bill rate (existing behavior)
- **Data Sensitivity**: True cost data should be treated as confidential and excluded from any agency-facing reports or exports

---

## Future Enhancements

- Historical markup audit trail showing when and why markup rates changed
- Agency self-service cost reporting where agencies can submit their true cost data
- Margin trend analysis over time with charts and forecasting
- Automated alerts when margins fall below configurable thresholds
- Bulk markup update tool to apply new rates across all staff for an agency
- Market rate comparison to benchmark agency markups against industry standards
