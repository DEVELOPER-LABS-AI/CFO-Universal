# API Contracts: Server Actions

**Pattern**: Next.js Server Actions (mutations) — consistent with existing codebase.

---

## 1. createServiceContract

**File**: `app/actions/service-management.ts`

**Input** (Zod schema: `createServiceContractSchema`):
```typescript
{
  client_id: string       // UUID
  service_id: string      // UUID
  billing_model: 'CONTRACT' | 'PROJECT' | 'RETAINER'
  start_month: number     // 1-12
  start_year: number      // 2020-2099
  end_month?: number      // 1-12 (required for CONTRACT)
  end_year?: number       // 2020-2099 (required for CONTRACT)
  monthly_rate?: number   // >= 0 for CONTRACT, > 0 for RETAINER
  project_fee?: number    // > 0 for PROJECT
  notes?: string
}
```

**Behavior**:
1. Validate input against `createServiceContractSchema`
2. Verify client and service belong to caller's organization
3. Check for overlapping ACTIVE contracts on same (client_id, service_id)
4. Auto-calculate `term_months` for CONTRACT type
5. Create `ServiceContract` record
6. If no `ClientService` record exists for this pair, create one (with custom_rate = monthly_rate)
7. Revalidate `/dashboard/clients/[id]`

**Success response**: `{ success: true, contract: ServiceContract }`
**Error responses**:
- `{ success: false, error: "Overlapping contract exists for [Service Name] from [start] to [end]" }`
- `{ success: false, error: "Service not found or not in your organization" }`
- Standard Zod validation errors

---

## 2. updateServiceContract

**File**: `app/actions/service-management.ts`

**Input** (Zod schema: `updateServiceContractSchema`):
```typescript
{
  contract_id: string     // UUID
  end_month?: number      // 1-12
  end_year?: number       // 2020-2099
  monthly_rate?: number   // >= 0 for CONTRACT, > 0 for RETAINER
  project_fee?: number    // > 0 for PROJECT
  notes?: string
}
```

**Behavior**:
1. Validate contract exists and belongs to caller's organization
2. Only allow updates to ACTIVE contracts
3. If rate changed, only apply to current/future periods (historical expectations preserved)
4. If end date changed, recalculate `term_months`
5. Check for new overlaps if date range expanded
6. Update record
7. Revalidate `/dashboard/clients/[id]`

**Constraints**: Cannot change `billing_model`, `client_id`, `service_id`, or `start_month/start_year`.

---

## 3. terminateServiceContract

**File**: `app/actions/service-management.ts`

**Input** (Zod schema: `terminateServiceContractSchema`):
```typescript
{
  contract_id: string     // UUID
  end_month: number       // 1-12 (effective termination month)
  end_year: number        // 2020-2099
}
```

**Behavior**:
1. Validate contract exists, belongs to organization, status is ACTIVE
2. Set `end_month`/`end_year` to provided values
3. Set `status` to TERMINATED
4. Recalculate `term_months` based on new end date
5. Revalidate `/dashboard/clients/[id]`

---

## 4. getClientContracts

**File**: `app/actions/service-management.ts`

**Input**:
```typescript
{
  client_id: string       // UUID
  service_id?: string     // Optional filter by service
  status?: 'ACTIVE' | 'COMPLETED' | 'TERMINATED'  // Optional status filter
}
```

**Returns**:
```typescript
{
  contracts: Array<{
    id: string
    billing_model: 'CONTRACT' | 'PROJECT' | 'RETAINER'
    status: 'ACTIVE' | 'COMPLETED' | 'TERMINATED'
    start_month: number
    start_year: number
    end_month: number | null
    end_year: number | null
    monthly_rate: number | null
    project_fee: number | null
    term_months: number | null
    total_value: number | null  // Calculated: monthly_rate * term_months
    notes: string | null
    service: { id: string, name: string }
    created_at: string
  }>
}
```

---

## 5. Validation Schemas

**File**: `lib/validations/service.ts` (extend existing)

```typescript
// Base contract fields
const contractBaseSchema = z.object({
  client_id: z.string().uuid(),
  service_id: z.string().uuid(),
  billing_model: z.enum(['CONTRACT', 'PROJECT', 'RETAINER']),
  start_month: z.number().int().min(1).max(12),
  start_year: z.number().int().min(2020).max(2099),
  notes: z.string().max(500).optional(),
});

// Conditional fields validated via superRefine
export const createServiceContractSchema = contractBaseSchema.extend({
  end_month: z.number().int().min(1).max(12).optional(),
  end_year: z.number().int().min(2020).max(2099).optional(),
  monthly_rate: z.number().min(0).optional(),
  project_fee: z.number().positive().optional(),
}).superRefine((data, ctx) => {
  // CONTRACT: requires end date and monthly_rate
  // PROJECT: requires project_fee
  // RETAINER: requires monthly_rate > 0
  // End date must be >= start date
});

export const updateServiceContractSchema = z.object({
  contract_id: z.string().uuid(),
  end_month: z.number().int().min(1).max(12).optional(),
  end_year: z.number().int().min(2020).max(2099).optional(),
  monthly_rate: z.number().min(0).optional(),
  project_fee: z.number().positive().optional(),
  notes: z.string().max(500).optional(),
});

export const terminateServiceContractSchema = z.object({
  contract_id: z.string().uuid(),
  end_month: z.number().int().min(1).max(12),
  end_year: z.number().int().min(2020).max(2099),
});
```
