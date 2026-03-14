# Research: BDR Portal — End-of-Month Reports, Bonus Plans & Expense Reimbursement

**Feature**: 12-bdr-portal
**Date**: 2026-03-03

---

## R1: BDR Identity & Data Model Integration

**Decision**: BDRs are Staff members identified by `staff_type = 'BDR'` (dynamic role from StaffRole config). Portal access is granted via UserProfile with `role = BDR` and linked via new `bdr_staff_id` field.

**Rationale**: The existing Staff model already has `staff_type` as a dynamic role string from the `StaffRole` config table, with BDR as an existing value. The `engagement_type` enum (FULL_TIME, PART_TIME, etc.) describes the employment arrangement, not the role. Following the contractor portal pattern, a `bdr_staff_id` on UserProfile links the auth user to their Staff record.

**Alternatives considered**:
- Adding `BDR` to `EngagementType` enum — rejected because engagement type describes employment arrangement, not role
- Using email matching — rejected because it's fragile and doesn't handle name changes
- Using `contractor_id` pattern with a new `BDR` entity — rejected because Staff already serves this purpose with `staff_type`

---

## R2: Bonus Calculation Approach

**Decision**: Cumulative tiered bonus calculation as a pure function. Each tier pays its rate for meetings within that range, applied sequentially.

**Rationale**: The spec explicitly defines the cumulative approach: "12 meetings with tiers [1-5 @ $50, 6-10 @ $75, 11+ @ $100] = (5x$50) + (5x$75) + (2x$100) = $825". This is the standard progressive/marginal tier approach, not a flat-rate-per-tier approach.

**Alternatives considered**:
- Flat rate (all meetings at highest achieved tier) — rejected per spec example
- Weighted average — rejected, not standard for per-meeting bonuses

**Implementation**: Pure function `calculateTieredBonus(metricValue: number, tiers: Tier[])` returns `{ total: number, breakdown: TierBreakdown[] }`. Tiers sorted by `min_threshold` ascending. For each tier, calculate meetings in range = `min(max_threshold, metricValue) - min_threshold + 1` (capped at 0). Multiply by `payout_rate`.

---

## R3: New Models vs Extending Existing Models

**Decision**: Create new BDR-specific models (`BDRPayPlan`, `BDRBonusTier`, `BDRMonthlyReport`, `BDRExpenseClaim`, `BDRExpenseCategory`, `BDRPayPlanAssignment`) rather than extending existing `StaffBonus` and `StaffReimbursement`.

**Rationale**: The existing `StaffBonus` model is designed for one-off admin-created bonuses (PERFORMANCE, SIGNING, etc.) and doesn't support the self-service monthly report + tiered auto-calculation workflow. The existing `StaffReimbursement` model uses a fixed `ReimbursementType` enum without receipt uploads to Supabase Storage, org-scoped categories, or the admin approval queue workflow. New models provide clean separation of concerns.

**Alternatives considered**:
- Extend `StaffBonus` with pay plan reference and auto-calculation — rejected because it conflates admin-created bonuses with BDR self-reported tiered bonuses
- Extend `StaffReimbursement` with receipt storage — possible, but the BDR expense flow needs admin-configurable categories, status workflow, and receipt storage that would bloat the existing model

**Integration note**: When a BDR monthly report is approved, the system can optionally create a corresponding `StaffBonus` record (type = PERFORMANCE) for financial reporting consistency. This is a future enhancement.

---

## R4: Portal Authentication Pattern

**Decision**: Follow the contractor portal pattern exactly. Add `BDR` to `UserRole` enum. Create `requireBDR()` auth helper that validates role and returns `bdrStaffId`. BDR users are invited by admin and link to a Staff record via `bdr_staff_id` on UserProfile.

**Rationale**: The contractor portal pattern is proven and already handles auth flow, redirect logic, and data scoping. Reusing this pattern minimizes new code and ensures consistency.

**Key files to modify**:
- `lib/auth/helpers.ts` — add `requireBDR()` (mirrors `requireContractor()`)
- `app/actions/auth.ts` — add BDR role redirect to `/bdr-portal`
- `prisma/schema.prisma` — add `BDR` to `UserRole` enum, add `bdr_staff_id` to `UserProfile`

---

## R5: Receipt Storage Pattern

**Decision**: Use Supabase Storage with a `bdr-receipts` private bucket. Follow the contractor document upload pattern: server action receives FormData, validates file (10MB max, PDF/JPG/PNG), uploads via `supabaseAdmin.storage`, stores path in database, retrieves via signed URLs (1 hour expiry).

**Rationale**: The contractor portal already implements this exact pattern in `app/actions/contractor-document-actions.ts`. File path format: `{org_id}/{staff_id}/{expense_id}/{uuid}-{sanitized_name}`.

**Alternatives considered**:
- Client-side direct upload to Supabase — rejected because it requires exposing storage credentials
- External storage (S3) — rejected per constitution (use Supabase services)

---

## R6: Report Status Lifecycle

**Decision**: BDR Monthly Reports follow a 4-state lifecycle:
1. **DRAFT** — BDR has started but not submitted; editable by BDR
2. **SUBMITTED** — BDR has submitted; read-only for BDR, reviewable by admin
3. **APPROVED** — Admin has approved; locked for all; bonus finalized
4. **NEEDS_CORRECTION** — Admin has flagged; returns to editable state for BDR with admin feedback

**Rationale**: Matches spec requirements. "Needs Correction" effectively returns the report to an editable state (like DRAFT but preserving the original submission). After BDR corrects, they re-submit (→ SUBMITTED).

**State transitions**:
- DRAFT → SUBMITTED (BDR submits)
- SUBMITTED → APPROVED (Admin approves)
- SUBMITTED → NEEDS_CORRECTION (Admin flags)
- NEEDS_CORRECTION → SUBMITTED (BDR resubmits after correction)
- APPROVED → no further transitions (admin override only)

---

## R7: Pay Plan Base Metric Flexibility

**Decision**: Both `meetings_booked` and `meetings_showed` are captured on every report. The pay plan's `base_metric` field (enum: MEETINGS_BOOKED, MEETINGS_SHOWED) determines which metric drives the bonus calculation.

**Rationale**: Captures complete data for analytics while allowing flexibility in bonus calculation. Admin selects the driving metric when creating a pay plan.

**Implementation**: `BDRPayPlan.base_metric` is an enum. The bonus calculation engine reads the appropriate value from the report based on this field.
