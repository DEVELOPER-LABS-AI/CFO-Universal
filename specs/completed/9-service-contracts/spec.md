# Feature Specification: Service Contracts & Billing Models

**Status**: Draft
**Created**: 2026-02-28
**Last Updated**: 2026-02-28

---

## Overview

### Feature Summary

Add contract-based service tracking so that each client-service relationship has a defined billing model (Contract, Project, or Retainer) with explicit terms, enabling the system to automatically calculate anticipated revenue per period and match actual deposits against expected contract revenue.

### Business Value

Currently, the system relies on manually entered rate history entries to track what a client should be paying per period. This is error-prone and requires the administrator to retroactively add entries like "$12,000/mo Jun 2025, $0/mo Jan 2026, $8,000/mo Mar 2026." With contract-based tracking, the system knows the exact terms of each engagement upfront: when it starts, when it ends, what the rate is, and what total revenue to expect. This eliminates guesswork, makes service coverage calculation deterministic, and provides a clear view of anticipated vs actual revenue across the entire client portfolio.

### Target Users

- **Primary**: Agency owner/CFO who manages client contracts, reviews financial health, and tracks revenue against expectations
- **Secondary**: Account managers who assign services to clients and monitor individual client billing status

---

## Clarifications

### Session 2026-02-28

- Q: Should a client be able to have multiple sequential (non-overlapping) billing arrangements for the same service? → A: Yes, multiple sequential records per service — each contract/retainer is its own record with independent terms and history.
- Q: For historical periods, should the system use legacy rate history or new contract records? → A: Dual-source — use ServiceRateHistory for periods before migration date, contract records for periods on or after migration. Gradual transition; both systems coexist.
- Q: For open-ended retainers, how far into the future should anticipated revenue be projected? → A: Through current month only — expected revenue is calculated for past and current periods only, not projected into future months.

---

## User Scenarios

### Primary Use Cases

**Scenario 1: Assigning a Contract-Based Service**
- **Actor**: Agency owner
- **Goal**: Set up a new 12-month contract for a client at $8,000/month starting March 2026
- **Steps**:
  1. Navigate to client detail page
  2. Click "Assign Service" and select the service
  3. Choose billing model "Contract"
  4. Enter contract start date (March 2026), term length (12 months), and monthly rate ($8,000)
  5. System auto-calculates contract end date (February 2027) and total contract value ($96,000)
  6. Confirm and save
- **Expected Outcome**: The client-service record shows a contract with defined terms. Financial summary and service coverage now use contract terms to calculate anticipated revenue for each month from March 2026 through February 2027.

**Scenario 2: Assigning a One-Time Project**
- **Actor**: Agency owner
- **Goal**: Add a one-time website redesign project billed at $15,000
- **Steps**:
  1. Navigate to client detail page
  2. Click "Assign Service" and select the service
  3. Choose billing model "Project"
  4. Enter the project fee ($15,000) and the billing period (month/year when payment is expected)
  5. Confirm and save
- **Expected Outcome**: The project appears as a single expected revenue item for the specified period. Service coverage treats it as a one-time expected amount, not a recurring obligation.

**Scenario 3: Assigning an Ongoing Retainer**
- **Actor**: Agency owner
- **Goal**: Set up an open-ended retainer at $5,000/month starting January 2026
- **Steps**:
  1. Navigate to client detail page
  2. Click "Assign Service" and select the service
  3. Choose billing model "Retainer"
  4. Enter start date (January 2026) and monthly rate ($5,000); no end date required
  5. Confirm and save
- **Expected Outcome**: The retainer generates anticipated revenue of $5,000/month from January 2026 onward with no defined end. Service coverage continues expecting payments indefinitely until the retainer is explicitly ended.

**Scenario 4: Viewing Anticipated vs Actual Revenue**
- **Actor**: Agency owner
- **Goal**: Understand how actual deposits compare to expected contract revenue for a client
- **Steps**:
  1. Navigate to client detail page and view financial summary
  2. See a comparison showing: Expected Revenue (from contract terms) vs Actual Revenue (from deposits/allocations) for each period
  3. Identify variance — e.g., "Oct 2025: Expected $12,000, Received $11,700, Variance -$300"
- **Expected Outcome**: Clear, per-period visibility into revenue gaps or surpluses, enabling proactive follow-up on underpayments.

**Scenario 5: Transitioning Between Contracts**
- **Actor**: Agency owner
- **Goal**: End a $12,000/month contract and start a new $8,000/month contract with a 2-month gap (free months)
- **Steps**:
  1. Navigate to client's services table
  2. End the current contract by setting its end date to December 2025
  3. Assign a new contract starting March 2026 at $8,000/month
  4. The system recognizes January-February 2026 have no active contract — expected revenue is $0
- **Expected Outcome**: Service coverage and financial calculations correctly show $0 expected for the gap months without needing manual $0 rate history entries.

### Edge Cases

- **Overlapping contracts for the same service**: If two contracts for the same service overlap in time, the system should warn the user and prevent the overlap (a service can only have one active billing arrangement per period)
- **Contract end date in the past**: Allowed for historical data entry; system treats it as a completed contract
- **Rate changes mid-contract**: User should be able to amend the contract rate; the change creates a historical marker so prior periods retain their original rate
- **Zero-dollar months**: Explicitly supported via gap periods between contracts (no active contract = $0 expected)
- **Partial months**: If a contract starts mid-month, the first month still counts as a full billing period (standard agency practice)
- **Multiple services on one client**: Each service has its own independent billing model and contract terms

---

## Functional Requirements

### Core Requirements

**FR-1: Billing Model Selection**
- **Description**: When assigning a service to a client, the user must choose a billing model that defines how revenue expectations are calculated.
- **Acceptance Criteria**:
  - [ ] Three billing models are available: Contract, Project, Retainer
  - [ ] Billing model is required when assigning a service to a client
  - [ ] Existing service assignments (created before this feature) default to "Retainer" with their current custom_rate as the monthly rate and no defined end date

**FR-2: Contract Terms Tracking**
- **Description**: For Contract billing model, the system must store and enforce contract start date, end date, term length, and monthly rate.
- **Acceptance Criteria**:
  - [ ] Contract requires: start month/year, term length in months, and monthly rate
  - [ ] End month/year is auto-calculated from start date + term length
  - [ ] Total contract value is displayed (monthly rate x term length)
  - [ ] User can manually override the end date (which recalculates term length)
  - [ ] Contract rate must be zero or positive (zero-dollar contracts allowed for promotional periods)

**FR-3: Project Terms Tracking**
- **Description**: For Project billing model, the system must store a one-time fee amount and the expected billing period.
- **Acceptance Criteria**:
  - [ ] Project requires: project fee amount and billing period (month/year)
  - [ ] Project fee appears as expected revenue only in the specified billing period
  - [ ] Project fee must be positive (greater than zero)

**FR-4: Retainer Terms Tracking**
- **Description**: For Retainer billing model, the system must store start date and monthly rate with no required end date.
- **Acceptance Criteria**:
  - [ ] Retainer requires: start month/year and monthly rate
  - [ ] End date is optional (null means ongoing)
  - [ ] Retainer generates monthly expected revenue from start date through the current month (or until end date, whichever is earlier). Future months beyond current are not included in expected revenue totals
  - [ ] Retainer rate must be positive (greater than zero)

**FR-5: Anticipated Revenue Calculation**
- **Description**: The system must calculate expected revenue per period based on active contract terms for current/future periods, while preserving legacy rate history for historical periods before migration.
- **Acceptance Criteria**:
  - [ ] For periods on or after the migration date, expected revenue equals the sum of all active contract/retainer/project arrangements for that period
  - [ ] For periods before the migration date, expected revenue continues to use ServiceRateHistory (legacy behavior preserved)
  - [ ] Contracts contribute their monthly rate only within their start-to-end range
  - [ ] Projects contribute their fee only in their specified billing period
  - [ ] Retainers contribute their monthly rate from start date through the current month (or until end date, whichever is earlier)
  - [ ] Expected revenue is only calculated for past and current periods, not projected into future months
  - [ ] Periods with no active billing arrangement have $0 expected revenue
  - [ ] Expected revenue is available in the financial summary API response

**FR-6: Actual vs Expected Revenue Comparison**
- **Description**: The financial summary must show a comparison of expected revenue (from contract terms) against actual revenue (from deposits/allocations) for each period.
- **Acceptance Criteria**:
  - [ ] Each period displays: Expected Revenue, Actual Revenue, Variance (actual - expected)
  - [ ] Positive variance (overpayment) shown in green; negative variance (underpayment) shown in red
  - [ ] All-time view aggregates expected and actual totals across all periods
  - [ ] Variance is displayed both as dollar amount and percentage

**FR-7: Service Coverage Using Contract Terms**
- **Description**: Service coverage calculation must use contract terms as the source of truth for expected costs, replacing the rate-history-based walk.
- **Acceptance Criteria**:
  - [ ] Coverage status (Covered, Warning, Past Due, Suspended) uses contract-defined expected amounts
  - [ ] "Covered through" date is determined by comparing cumulative deposits against cumulative expected revenue from contracts
  - [ ] Credit balance reflects overpayment relative to contract expectations
  - [ ] Months remaining reflects how many future contract months the credit balance covers

**FR-8: Contract Overlap Prevention**
- **Description**: The system must prevent overlapping billing arrangements for the same service on the same client.
- **Acceptance Criteria**:
  - [ ] When assigning a new contract/retainer for a service that already has an active arrangement, the system warns the user
  - [ ] User must either end the existing arrangement first or choose a non-overlapping start date
  - [ ] Validation occurs at save time with a clear error message

**FR-9: Contract End/Termination**
- **Description**: Users must be able to end or terminate an active contract or retainer.
- **Acceptance Criteria**:
  - [ ] User can set an end date on any active contract or retainer
  - [ ] Ending a contract recalculates anticipated revenue (removes future expected amounts)
  - [ ] Service coverage updates immediately after contract termination
  - [ ] Historical periods retain their original expected amounts (ending does not retroactively change past expectations)

**FR-10: Migration of Existing Data**
- **Description**: Existing client-service assignments must be migrated to the new billing model without data loss.
- **Acceptance Criteria**:
  - [ ] All existing ClientService records receive a default billing model of "Retainer"
  - [ ] Existing custom_rate becomes the retainer monthly rate
  - [ ] Existing ServiceRateHistory entries are preserved for historical reference
  - [ ] No disruption to current financial calculations during migration

### Data Requirements

**DR-1: Billing Model**
- **Description**: The type of billing arrangement for a client-service assignment
- **Key Attributes**: Enumerated value — CONTRACT, PROJECT, RETAINER
- **Validation Rules**: Required for all new assignments; defaults to RETAINER for existing records

**DR-2: Service Contract (new entity, separate from ClientService)**
- **Description**: An individual billing arrangement record. A client can have multiple sequential contracts for the same service (e.g., Contract 1: Jun-Dec 2025 at $12K/mo, then Contract 2: Mar 2026+ at $8K/mo). Each is its own record with independent terms and audit history. The existing ClientService join table is preserved as the relationship anchor; contracts reference it.
- **Key Attributes**:
  - Unique identifier (auto-generated)
  - Reference to client and service
  - Billing model (CONTRACT, PROJECT, or RETAINER)
  - Start month and year
  - End month and year (optional for RETAINER)
  - Monthly rate (for CONTRACT and RETAINER)
  - Project fee (for PROJECT)
  - Term length in months (for CONTRACT, auto-calculated)
  - Total contract value (calculated: monthly rate x term length)
  - Status (ACTIVE, COMPLETED, TERMINATED)
- **Validation Rules**:
  - Start date is required for all models
  - End date required for CONTRACT, optional for RETAINER, not applicable for PROJECT
  - Monthly rate required and >= 0 for CONTRACT, > 0 for RETAINER
  - Project fee required and > 0 for PROJECT
  - No overlapping active arrangements for the same service on the same client (validated across all records for that client-service pair)

---

## Success Criteria

### Measurable Outcomes

- [ ] **Revenue Accuracy**: Expected revenue per period matches contract terms exactly — no manual rate history entries needed for new contracts
- [ ] **Coverage Accuracy**: Service coverage status correctly reflects contract terms, including zero-dollar gap months between contracts
- [ ] **Variance Visibility**: Users can identify underpayment or overpayment within 10 seconds of viewing a client's financial summary
- [ ] **Data Integrity**: 100% of existing client-service assignments are migrated with correct billing model and rate without data loss
- [ ] **Task Efficiency**: Setting up a new 12-month contract takes fewer than 5 interactions (clicks/inputs) from the assign service modal
- [ ] **Overlap Prevention**: System prevents 100% of overlapping contract attempts with clear user-facing error messages

---

## Dependencies

### Internal Dependencies

- Existing Service and ClientService models (will be extended, not replaced)
- Financial summary API (`/api/clients/[id]/financial-summary`)
- Service coverage calculation (`lib/calculations/service-coverage.ts`)
- Client ROI calculation (`lib/calculations/client-roi.ts`)
- Payment allocation system (deposits linked to periods)
- Refresh ROI functionality (must be working — currently failing with 0/8 errors, needs fix as prerequisite)

---

## Assumptions

- Partial months are billed as full months (industry standard for agency contracts)
- Existing ServiceRateHistory data is preserved and remains the source of truth for periods before the migration date. For periods on or after the migration date, contract records take precedence. Both systems coexist during the transition period
- The "Refresh All Periods" failure is a separate bug that must be fixed before this feature can be fully verified, but is not caused by the contract model design
- Contract amendments (rate changes mid-contract) create a new contract record rather than modifying the existing one, preserving audit history
- All monetary values are in USD (matching existing system behavior)

---

## Out of Scope

- Automated invoice generation from contract terms
- Multi-currency support for contracts
- Approval workflows for contract creation or amendments
- Client-facing contract documents or e-signatures
- Automated notifications for contract renewal or expiration (may be added in a future iteration)
- Hourly billing tracking with time entries (the HOURLY relationship type exists on clients but detailed time tracking is not part of this feature)

---

## Future Enhancements

- Contract renewal workflows with automatic rate escalation
- Contract expiration notifications and reminders
- Revenue forecasting dashboard based on active contracts across all clients
- Bulk contract management (apply rate changes across multiple clients)
- Integration with external contract management or CRM systems
