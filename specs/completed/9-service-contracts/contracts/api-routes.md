# API Contracts: API Routes

**Pattern**: Next.js API Routes (reads) — consistent with existing codebase.

---

## 1. GET /api/clients/[id]/financial-summary (Enhanced)

**Existing route** — enhanced with expected revenue and variance fields.

**New fields in response**:
```typescript
{
  // ... existing fields (revenue, totalCosts, profit, etc.) ...

  // NEW: Expected revenue from contract terms
  expectedRevenue: number          // Sum of all contract-defined expected revenue for this period
  variance: number                 // actual revenue - expected revenue
  variancePercentage: number | null // (variance / expectedRevenue) * 100, null if expectedRevenue = 0

  // NEW: Per-period expected revenue breakdown (in all-time mode)
  expectedRevenueByPeriod?: Array<{
    month: number
    year: number
    expectedRevenue: number
    actualRevenue: number
    variance: number
  }>
}
```

**Behavior changes**:
- For periods with active contracts → `expectedRevenue` = sum of applicable contract rates
- For periods with no contracts but with `ServiceRateHistory` → fall back to legacy rate calculation
- For `mode=all` → aggregate expected revenue across all available periods

---

## 2. GET /api/clients/[id]/service-coverage (Enhanced)

**Existing route** — enhanced to use contract-based expected revenue.

**Changes to coverage walk**:
- `getServiceCostForPeriod(m, y)` now checks `ServiceContract` records first
- If a contract exists covering the period → use contract monthly_rate (or project_fee for PROJECT)
- If no contract exists → fall back to `ServiceRateHistory` (legacy behavior)
- Retainers cap at current month (no future projection)

**Response** (unchanged structure, more accurate values):
```typescript
{
  monthlyServiceCost: number      // From active contracts (current month)
  totalPaid: number               // From payment allocations
  totalExpected: number           // From contract terms (past + current months only)
  coveredThrough: { month, year } | null
  monthsRemaining: number
  creditBalance: number
  status: 'COVERED' | 'WARNING' | 'PAST_DUE' | 'SUSPENDED'
  daysUntilShutoff: number | null
  gracePeriodDays: number
  warningDays: number
}
```

---

## 3. Expected Revenue Utility

**New file**: `lib/calculations/expected-revenue.ts`

```typescript
/**
 * Calculate expected revenue for a client in a given period.
 * Uses ServiceContract records as primary source, falls back to ServiceRateHistory.
 */
export async function getExpectedRevenueForPeriod(
  clientId: string,
  month: number,
  year: number
): Promise<number>

/**
 * Calculate expected revenue for a client across all historical periods.
 * Returns per-period breakdown.
 */
export async function getExpectedRevenueAllPeriods(
  clientId: string,
  organizationId: string
): Promise<Array<{ month: number; year: number; expectedRevenue: number }>>

/**
 * Check if a proposed contract overlaps with any existing ACTIVE contracts
 * for the same client-service pair.
 */
export async function checkContractOverlap(
  clientId: string,
  serviceId: string,
  startMonth: number,
  startYear: number,
  endMonth: number | null,
  endYear: number | null,
  excludeContractId?: string  // For updates
): Promise<{ overlaps: boolean; conflictingContract?: ServiceContract }>
```
