# Feature Specification: Cap Table MVP

**Status**: Draft
**Created**: 2026-03-01
**Last Updated**: 2026-03-01

---

## Overview

### Feature Summary

A basic capitalization table that tracks ownership stakes for the agency's 3 founders/owners, providing a clean, investor-ready view of equity distribution that can be shared during fundraising conversations.

### Business Value

When speaking with investors, the agency needs a professional, accurate representation of its ownership structure. Currently this information lives in spreadsheets or legal documents that aren't easily shareable or presentable. This feature provides a polished, always-current cap table view that builds investor confidence and saves time during due diligence.

### Target Users

- **Primary**: Agency Owners / Founders (ADMIN or EXECUTIVE role) — manage and view their ownership data
- **Primary**: Finance / Admin — maintain cap table accuracy
- **Secondary**: Investors / Advisors — view shared cap table during fundraising (read-only)

---

## Clarifications

### Session 2026-03-03

- Q: What mechanism should be used for shareable investor links? → A: Signed token URL (JWT/HMAC token encoding cap table ID + expiry, no extra DB table for links)
- Q: How should the unallocated equity pool be represented? → A: Reserved shares field on the share class (authorized - issued - reserved = available)
- Q: Should cap table stakeholders be linked to application user accounts? → A: Independent records (standalone; no foreign key to users table)
- Q: What approach for PDF export? → A: Browser print-to-PDF (styled print CSS on the shared view page; user triggers browser print dialog)
- Q: What should the default expiration for shareable investor links be? → A: 30 days

---

## User Scenarios

### Primary Use Cases

**Scenario 1: Admin Sets Up the Cap Table**
- **Actor**: Finance / Admin
- **Goal**: Initialize the cap table with the 3 owners and their ownership stakes
- **Steps**:
  1. Navigate to the Cap Table section
  2. Add each owner with their name, role, and ownership percentage
  3. Enter the share class details (e.g., Common)
  4. Set the number of authorized and issued shares
  5. Save the cap table
- **Expected Outcome**: Cap table displays all 3 owners with their respective ownership percentages, share counts, and roles

**Scenario 2: Owner Views Their Equity Position**
- **Actor**: Agency Owner
- **Goal**: Review their current ownership stake and equity details
- **Steps**:
  1. Navigate to the Cap Table section
  2. View the ownership summary table showing all stakeholders
  3. See their individual ownership percentage, share count, and share class
- **Expected Outcome**: Owner has a clear view of their equity position relative to other owners

**Scenario 3: Admin Shares Cap Table with an Investor**
- **Actor**: Finance / Admin
- **Goal**: Generate a shareable, read-only view of the cap table for an investor meeting
- **Steps**:
  1. Navigate to the Cap Table section
  2. Select "Share" or "Export"
  3. Choose between generating a shareable link (time-limited) or exporting as PDF
  4. Send the link or document to the investor
- **Expected Outcome**: Investor receives a professional, read-only view of the ownership structure

**Scenario 4: Admin Updates Ownership After an Equity Event**
- **Actor**: Finance / Admin
- **Goal**: Record a change in ownership (e.g., equity grant, transfer, new investment round)
- **Steps**:
  1. Navigate to the Cap Table section
  2. Select "Record Transaction" or edit an existing stakeholder
  3. Enter the transaction type (grant, transfer, purchase), date, shares affected, and price per share (if applicable)
  4. Save the transaction
- **Expected Outcome**: Cap table is updated to reflect the new ownership distribution; transaction is recorded in the history

### Edge Cases

- **Ownership Percentages Must Sum to 100%**: The system should validate that fully-diluted ownership percentages total 100% (or flag discrepancies for unissued/reserved shares).
- **Future Equity Pool**: The company may reserve a pool for future employees or advisors. This is represented as a reserved shares field on the share class (authorized - issued - reserved = available). No virtual stakeholder row is created.
- **Fractional Shares**: Ownership splits may result in fractional shares. The system should handle precision to at least 4 decimal places for percentages.
- **Historical View**: When sharing with investors, they may want to see the cap table as of a specific date (e.g., pre-investment). The system should support point-in-time views.

---

## Functional Requirements

### Core Requirements

**FR-1: Stakeholder Management**
- **Description**: The system must allow users to add, edit, and remove stakeholders (owners/shareholders) from the cap table.
- **Acceptance Criteria**:
  - [ ] Users can add a stakeholder with name, role/title, and email (share class assignment happens via equity transactions)
  - [ ] Users can edit stakeholder details after creation
  - [ ] Users can remove a stakeholder (with transaction record of share disposition)
  - [ ] Each stakeholder shows their total shares, ownership percentage, and share class

**FR-2: Share Class Configuration**
- **Description**: The system must support defining one or more share classes with distinct properties.
- **Acceptance Criteria**:
  - [ ] Users can create share classes (e.g., Common, Preferred)
  - [ ] Each share class has a name, authorized share count, reserved share count, and optional price per share
  - [ ] The cap table displays shares broken down by class
  - [ ] Total authorized vs. issued vs. reserved shares are tracked per class (available = authorized - issued - reserved)

**FR-3: Ownership Summary View**
- **Description**: The system must display a clear summary table of all stakeholders and their ownership.
- **Acceptance Criteria**:
  - [ ] Summary table shows: Stakeholder name, role, share class, shares held, ownership percentage
  - [ ] Ownership percentages are calculated automatically based on total issued shares
  - [ ] A visual representation (donut/pie chart) shows ownership distribution
  - [ ] Summary includes totals row (total issued shares, total ownership = 100%)
  - [ ] Unallocated/reserved shares are shown as a separate line item if applicable

**FR-4: Transaction History**
- **Description**: The system must record all equity transactions that change the cap table.
- **Acceptance Criteria**:
  - [ ] Users can record transactions: Grant, Transfer, Purchase, Cancellation
  - [ ] Each transaction includes: date, type, stakeholder(s) involved, shares affected, price per share (optional), notes
  - [ ] Transaction history is viewable as a chronological ledger
  - [ ] Cap table state can be reconstructed from the transaction history

**FR-5: Investor-Ready Sharing**
- **Description**: The system must provide a way to share the cap table externally in a professional, read-only format.
- **Acceptance Criteria**:
  - [ ] Users can generate a shareable link using a signed token (JWT/HMAC) encoding the cap table ID and expiration (default: 30 days)
  - [ ] Shared view is read-only and does not require authentication; token is validated server-side
  - [ ] Users can export the cap table via browser print-to-PDF (print-optimized CSS applied to the shared view)
  - [ ] Shared/exported view includes company name, date, and a clean visual layout optimized for print
  - [ ] Shareable links can be revoked by rotating the `CAP_TABLE_SHARE_SECRET` environment variable (denylist deferred to future enhancement)

**FR-6: Point-in-Time View**
- **Description**: The system must allow users to view the cap table as of any historical date.
- **Acceptance Criteria**:
  - [ ] Users can select a date and see the cap table as it existed on that date
  - [ ] Historical view is derived from the transaction ledger
  - [ ] Historical views are viewable in the dashboard (sharing historical views via link deferred to future enhancement)

### Data Requirements

**DR-1: Stakeholder**
- **Description**: An individual or entity that holds equity in the company. Stakeholders are independent records with no foreign key to the users table — not all equity holders (e.g., investors, advisors) will have application accounts.
- **Key Attributes**: Name, email, role/title, organization ID
- **Validation Rules**: Name is required; email must be unique within the cap table

**DR-2: Share Class**
- **Description**: A category of shares with specific rights and properties
- **Key Attributes**: Name, authorized shares, reserved shares (default 0), price per share (optional), organization ID
- **Validation Rules**: Name is required and unique within the organization; authorized shares must be a positive integer; reserved shares must be non-negative and cannot exceed (authorized - issued)

**DR-3: Equity Holding**
- **Description**: The number of shares a stakeholder holds in a specific share class
- **Key Attributes**: Stakeholder ID, share class ID, shares held
- **Validation Rules**: Shares held cannot exceed authorized shares for the class; shares must be non-negative

**DR-4: Equity Transaction**
- **Description**: A recorded event that changes share ownership
- **Key Attributes**: Transaction type, date, stakeholder(s), share class, shares affected, price per share, notes, created by
- **Validation Rules**: Date is required; shares affected must be positive; transaction type must be one of: Grant, Transfer, Purchase, Cancellation

---

## Success Criteria

### Measurable Outcomes

- [ ] **Setup Speed**: Admin can set up the complete cap table for 3 owners in under 10 minutes
- [ ] **Investor Readiness**: Exported or shared cap table requires zero additional formatting before sharing with investors
- [ ] **Accuracy**: Ownership percentages always sum to 100% (within rounding tolerance of 0.01%)
- [ ] **Shareability**: Time to generate and send a cap table view to an investor is under 1 minute
- [ ] **Audit Trail**: Every change to the cap table is traceable to a specific transaction with date and author

---

## Dependencies

### Internal Dependencies

- **Authentication (Feature 2)**: User authentication for access control
- **RLS Policies (Feature 8)**: Organization-level data isolation for cap table data

---

## Assumptions

- The agency has exactly 3 owners at MVP launch, but the system should support adding more stakeholders in the future
- MVP requires only Common share class; Preferred shares are a future enhancement but the data model should accommodate them
- Share values and pricing are in a single currency (USD assumed)
- The cap table is maintained manually (no integration with legal filing systems like Carta or Pulley)
- Shareable links will be served from the existing application domain (no separate microservice needed)
- Transaction history is append-only; transactions cannot be deleted, only reversed with a new offsetting transaction

---

## Out of Scope

- Vesting schedules and vesting cliff tracking (future enhancement)
- Convertible note / SAFE tracking and conversion modeling
- Option pool management and employee stock option grants
- Integration with legal cap table platforms (Carta, Pulley, AngelList)
- Waterfall analysis or liquidation preference modeling
- Tax implications or 409A valuation tracking
- Multi-entity / subsidiary cap tables
- Voting rights and governance features

---

## Security & Privacy Considerations

- **Access Control**: Only users with ADMIN or EXECUTIVE roles can view and edit the cap table. Cap table data is highly sensitive.
- **Shareable Links**: Implemented as signed tokens (JWT/HMAC) with embedded expiration. Time-limited, revocable via signing secret rotation or denylist. Do not expose internal system data beyond what's shown in the cap table view.
- **Data Isolation**: Cap table data is scoped by organization ID, enforced by RLS policies.
- **Audit Trail**: All changes logged with user identity and timestamp for compliance.

---

## Future Enhancements

- Vesting schedule tracking with cliff dates and vesting calendars
- Convertible note and SAFE instrument tracking
- Option pool management for employee equity grants
- Scenario modeling ("what-if" for future funding rounds)
- Integration with legal platforms (Carta, Pulley) for automated sync
- Waterfall analysis for liquidation scenarios
- Investor portal with login-based access (vs. shareable links)
