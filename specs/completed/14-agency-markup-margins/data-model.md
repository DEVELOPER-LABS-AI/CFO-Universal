# Data Model: Agency Staff True Cost & Markup Transparency

**Created**: 2026-03-05
**Feature**: 14-agency-markup-margins

---

## New Enums

### MarkupType
```
PERCENTAGE   — Markup expressed as a percentage of cost (e.g., 30% → bill = cost × 1.30)
FLAT_RATE    — Markup expressed as a fixed amount per rate unit (e.g., +$15/hr)
```

### MarkupBasis
```
BASE_PAY            — Markup applies to base compensation only
TOTAL_COMPENSATION  — Markup applies to base + expenses + reimbursements
```

---

## Modified Entities

### Agency (existing model — fields added)

| Field | Type | Nullable | Default | Description |
|-------|------|----------|---------|-------------|
| markup_type | MarkupType | Yes | null | Default markup calculation method for this agency |
| markup_value | Decimal(10,2) | Yes | null | Markup amount (percentage value or flat rate amount) |
| markup_basis | MarkupBasis | Yes | null | Whether markup applies to base pay or total compensation |

**Validation Rules**:
- `markup_type` is required when `markup_value` is set (and vice versa)
- `markup_value` must be >= 0 when `markup_type` is PERCENTAGE
- `markup_value` must be >= 0 when `markup_type` is FLAT_RATE
- `markup_basis` defaults to BASE_PAY when markup is configured but basis not specified
- All three fields are null when no markup is configured (agency operates in legacy mode)

**Relationships**: No new relationships. Existing `staff Staff[]` relation unchanged.

---

### Staff (existing model — fields added)

| Field | Type | Nullable | Default | Description |
|-------|------|----------|---------|-------------|
| true_cost | Decimal(10,2) | Yes | null | What the agency actually pays the worker |
| true_cost_rate_type | RateType | Yes | null | Rate type for true cost (HOURLY, DAILY, MONTHLY, VARIABLE) |
| markup_override_type | MarkupType | Yes | null | Staff-level markup override type |
| markup_override_value | Decimal(10,2) | Yes | null | Staff-level markup override amount |
| rate_locked | Boolean | No | false | When true, rate field is manually set and decoupled from markup formula |

**Validation Rules**:
- `true_cost` is required when creating new staff with `engagement_type = AGENCY`
- `true_cost` is nullable for existing agency staff (migration grace)
- `true_cost` must be > 0 when provided
- `true_cost_rate_type` is required when `true_cost` is set
- `markup_override_type` is required when `markup_override_value` is set (and vice versa)
- `markup_override_value` must be >= 0
- `rate_locked` defaults to false; when true, auto-calculation is skipped
- These fields are ignored/hidden for non-agency staff (engagement_type != AGENCY)

**Rate Calculation Logic**:
```
If rate_locked = true:
  → rate stays as manually set
  → effective_markup = (rate - true_cost_monthly) / true_cost_monthly × 100

If markup_override_type is set:
  → use staff-level override for calculation

Else if agency.markup_type is set:
  → use agency-level default for calculation

Calculation (when not locked):
  PERCENTAGE + BASE_PAY:
    rate = true_cost × (1 + markup_value / 100)
  PERCENTAGE + TOTAL_COMPENSATION:
    rate = (true_cost + expenses + reimbursements) × (1 + markup_value / 100)
  FLAT_RATE:
    rate = true_cost + flat_amount
    (rate types converted via: 176 hrs/mo, 22 days/mo)
```

---

### AgencyMonthlyBreakdown (existing model — JSONB structure enhanced)

The `breakdown` JSONB column's staff item structure gains a new optional field:

**Staff Breakdown Item (enhanced)**:
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| staff_id | UUID | Yes | Staff member ID |
| name | String | Yes | Staff member name |
| role | String | Yes | Staff role/type |
| base_pay | Number | Yes | Bill rate amount (what org pays) |
| true_cost | Number | No | Agency's cost (what agency pays worker) — new field |
| expenses | Number | Yes | Additional expenses |
| reimbursements | Number | Yes | Reimbursement amounts |
| notes | String | No | Free-form notes |
| subtotal | Number | Yes | base_pay + expenses + reimbursements |

**Backward Compatibility**: Existing breakdown records without `true_cost` remain valid. The field is optional in the Zod schema. UI shows margin as "N/A" when `true_cost` is absent.

---

## Computed Values (not stored, calculated at query/render time)

| Value | Formula | Context |
|-------|---------|---------|
| Staff margin ($) | `toMonthlyCost(rate, rate_type) - toMonthlyCost(true_cost, true_cost_rate_type)` | Staff detail, agency detail |
| Staff margin (%) | `(margin_dollar / toMonthlyCost(true_cost, true_cost_rate_type)) × 100` | Staff detail, agency detail |
| Agency total true cost | `SUM(toMonthlyCost(staff.true_cost, staff.true_cost_rate_type))` for active agency staff | Agency dashboard |
| Agency total billed | `SUM(toMonthlyCost(staff.rate, staff.rate_type))` for active agency staff | Agency dashboard |
| Agency total margin ($) | `agency_total_billed - agency_total_true_cost` | Agency dashboard |
| Agency avg margin (%) | `(agency_total_margin / agency_total_true_cost) × 100` | Agency dashboard |
| Breakdown line margin ($) | `base_pay - true_cost` (per staff item in JSONB) | Monthly breakdown view |
| Breakdown line margin (%) | `(base_pay - true_cost) / true_cost × 100` | Monthly breakdown view |

---

## State Transitions

### Markup Configuration Lifecycle (Agency)
```
No Markup (null/null/null) → Configured (type/value/basis set)
Configured → Updated (value or type changed)
Configured → Removed (reset to null/null/null)
```
- Changing agency markup does NOT auto-update existing staff rates
- UI offers optional bulk-update prompt

### Rate Lock Lifecycle (Staff)
```
Unlocked (rate_locked=false) → Locked (rate_locked=true, rate frozen)
Locked → Unlocked (rate_locked=false, rate recalculated from formula)
```

### True Cost Lifecycle (Staff)
```
Empty (null — existing staff) → Populated (true_cost + true_cost_rate_type set)
Populated → Updated (value changed, triggers rate recalc if not locked)
```

---

## Indexes

New indexes on modified models:

| Model | Index | Rationale |
|-------|-------|-----------|
| Staff | `[agency_id, true_cost]` | Filter agency staff with/without true cost for dashboard aggregation |

No additional indexes needed — existing `[agency_id]` and `[organization_id, status]` indexes cover query patterns.

---

## Migration Notes

- All new fields are nullable or have defaults — migration is non-destructive
- No data backfill required (graceful gap approach)
- No new tables — only ALTER TABLE ADD COLUMN operations
- Existing queries remain functional — new fields are additive
- JSONB structure change requires no migration — Zod validation handles optional `true_cost`
