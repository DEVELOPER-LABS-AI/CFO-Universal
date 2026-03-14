# API Contracts: Agency Markup & True Cost Server Actions

**Created**: 2026-03-05
**Feature**: 14-agency-markup-margins
**Pattern**: Next.js Server Actions (existing codebase convention)

---

## Modified Server Actions

### 1. `updateAgency(id, data)` — Extended

**File**: `app/actions/agency-management.ts`
**Auth**: `requireAdminOrExecutive()`

**Input Schema** (extended `updateAgencySchema`):
```typescript
{
  // Existing fields (all optional for partial update)
  name?: string;                    // 1-200 chars
  monthly_payment?: number | null;  // positive, min 0.01
  merchant_name?: string | null;    // max 200 chars
  start_date?: Date;

  // New fields
  markup_type?: 'PERCENTAGE' | 'FLAT_RATE' | null;
  markup_value?: number | null;     // >= 0
  markup_basis?: 'BASE_PAY' | 'TOTAL_COMPENSATION' | null;
}
```

**Validation Rules**:
- If `markup_value` is set, `markup_type` must also be set (and vice versa)
- If `markup_type` is null, `markup_value` and `markup_basis` must also be null
- `markup_value` >= 0

**Response**: `Agency` (full updated record)

---

### 2. `createStaff(data)` — Extended

**File**: `app/actions/staff-management.ts`
**Auth**: `requireAdminOrExecutive()`

**Input Schema** (extended `createStaffSchema`):
```typescript
{
  // Existing fields
  name: string;                     // 1-200 chars
  staff_type: string;               // 1-100 chars
  rate: number;                     // positive, min 0.01
  rate_type: 'HOURLY' | 'DAILY' | 'MONTHLY' | 'VARIABLE';
  engagement_type: 'FULL_TIME' | 'PART_TIME' | 'PROJECT' | 'OWNER' | 'AGENCY';
  agency_id?: string | null;        // UUID
  contractor_id?: string | null;    // UUID

  // New fields
  true_cost?: number | null;        // > 0 when provided
  true_cost_rate_type?: 'HOURLY' | 'DAILY' | 'MONTHLY' | 'VARIABLE' | null;
  markup_override_type?: 'PERCENTAGE' | 'FLAT_RATE' | null;
  markup_override_value?: number | null;  // >= 0
  rate_locked?: boolean;            // default false
}
```

**Validation Rules**:
- When `engagement_type === 'AGENCY'`: `true_cost` and `true_cost_rate_type` are required
- When `engagement_type !== 'AGENCY'`: true cost fields are ignored/stripped
- If `markup_override_value` is set, `markup_override_type` must also be set
- If `rate_locked` is false and `true_cost` + markup are provided, `rate` is auto-calculated

**Response**: `Staff` (full created record)

**Side Effect**: If `rate_locked === false` and agency has markup configured, auto-calculate `rate` from `true_cost + markup` before saving.

---

### 3. `updateStaff(id, data)` — Extended

**File**: `app/actions/staff-management.ts`
**Auth**: `requireAdminOrExecutive()`

**Input Schema** (extended `updateStaffSchema` — all fields optional):
```typescript
{
  // Existing fields (all optional)
  name?: string;
  staff_type?: string;
  rate?: number;
  rate_type?: 'HOURLY' | 'DAILY' | 'MONTHLY' | 'VARIABLE';
  engagement_type?: 'FULL_TIME' | 'PART_TIME' | 'PROJECT' | 'OWNER' | 'AGENCY';
  agency_id?: string | null;
  contractor_id?: string | null;

  // New fields (all optional)
  true_cost?: number | null;
  true_cost_rate_type?: 'HOURLY' | 'DAILY' | 'MONTHLY' | 'VARIABLE' | null;
  markup_override_type?: 'PERCENTAGE' | 'FLAT_RATE' | null;
  markup_override_value?: number | null;
  rate_locked?: boolean;
}
```

**Validation Rules**: Same as createStaff but all fields optional for partial update.

**Side Effect**: If `rate_locked === false` and `true_cost` or markup changes, recalculate `rate`.

**Response**: `Staff` (full updated record)

---

### 4. `createAgencyMonthlyBreakdown(data)` — Extended

**File**: `app/actions/agency-management.ts`
**Auth**: `requireAdminOrExecutive()`

**Input Schema** (extended `createAgencyMonthlyBreakdownSchema`):
```typescript
{
  agency_id: string;                // UUID
  month: number;                    // 1-12
  year: number;                     // 2000-2100
  breakdown: {
    staff: Array<{
      staff_id: string;             // UUID
      name: string;                 // min 1 char
      role: string;                 // min 1 char
      base_pay: number;             // >= 0 (bill rate)
      true_cost?: number;           // >= 0 (agency's cost) — NEW, optional
      expenses: number;             // >= 0, default 0
      reimbursements: number;       // >= 0, default 0
      notes?: string | null;        // max 500 chars
      subtotal: number;             // >= 0, base_pay + expenses + reimbursements
    }>;
    services: Array<{
      name: string;                 // 1-200 chars
      description?: string | null;  // max 500 chars
      amount: number;               // >= 0
    }>;
  };
}
```

**Response**:
```typescript
{
  breakdown: AgencyMonthlyBreakdown;
  summary: {
    staff_total: number;
    services_total: number;
    breakdown_total: number;
    mercury_actual: number;
    variance: number;
    true_cost_total: number;       // NEW: sum of all staff true_cost values
    margin_total: number;          // NEW: staff_total - true_cost_total
    margin_percentage: number;     // NEW: (margin_total / true_cost_total) × 100
  };
  warning: string | null;
}
```

---

## New Utility Functions

### 5. `calculateBillRate(trueCost, trueCostRateType, markupType, markupValue, markupBasis, expenses?, reimbursements?)`

**File**: `lib/calculations/markup-calculations.ts`

**Input**:
```typescript
{
  trueCost: number;                 // > 0
  trueCostRateType: RateType;
  markupType: MarkupType;
  markupValue: number;              // >= 0
  markupBasis: MarkupBasis;
  expenses?: number;                // >= 0, default 0
  reimbursements?: number;          // >= 0, default 0
}
```

**Output**: `{ billRate: number; billRateType: RateType }`

**Logic**:
- PERCENTAGE + BASE_PAY: `trueCost × (1 + markupValue / 100)`
- PERCENTAGE + TOTAL_COMPENSATION: `(trueCost + expenses + reimbursements) × (1 + markupValue / 100)`
- FLAT_RATE: `trueCost + flatAmount` (converted to matching rate type using 176 hrs/mo, 22 days/mo)

---

### 6. `calculateMargin(billRate, billRateType, trueCost, trueCostRateType)`

**File**: `lib/calculations/markup-calculations.ts`

**Input**:
```typescript
{
  billRate: number;
  billRateType: RateType;
  trueCost: number;
  trueCostRateType: RateType;
}
```

**Output**:
```typescript
{
  marginDollar: number;             // Monthly margin in dollars
  marginPercentage: number;         // Margin as percentage of true cost
  isNegative: boolean;              // Warning flag
}
```

**Logic**:
- Convert both to monthly using `toMonthlyCost()`
- `marginDollar = monthlyBillRate - monthlyTrueCost`
- `marginPercentage = (marginDollar / monthlyTrueCost) × 100`

---

### 7. `getEffectiveMarkup(staff, agency)`

**File**: `lib/calculations/markup-calculations.ts`

**Input**: Staff record + associated Agency record

**Output**:
```typescript
{
  markupType: MarkupType | null;
  markupValue: number | null;
  markupBasis: MarkupBasis | null;
  source: 'staff_override' | 'agency_default' | 'none';
  rateLocked: boolean;
}
```

**Logic**:
- If `staff.rate_locked === true`: return current values with `rateLocked: true`
- If `staff.markup_override_type` is set: return staff override with `source: 'staff_override'`
- If `agency.markup_type` is set: return agency default with `source: 'agency_default'`
- Otherwise: return nulls with `source: 'none'`

---

## Data Queries (read patterns)

### 8. `getStaff` / `getStaffById` — Extended Response

Existing queries already include agency relation. New fields (`true_cost`, `true_cost_rate_type`, `markup_override_type`, `markup_override_value`, `rate_locked`) are returned automatically via Prisma select.

**Access Control**: When called from agency portal context, strip `true_cost`, `markup_override_*`, and `rate_locked` fields from response.

### 9. `getAgencies` — Extended Response

Existing query includes staff relation. Margin aggregation computed at the application layer from staff `true_cost` and `rate` fields.

**Access Control**: Markup and margin data only included for ADMIN/EXECUTIVE roles.
