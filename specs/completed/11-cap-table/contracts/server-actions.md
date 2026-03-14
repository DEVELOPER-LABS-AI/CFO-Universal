# Server Actions Contract: Cap Table MVP

**Created**: 2026-03-03
**Feature**: [spec.md](../spec.md)
**Data Model**: [data-model.md](../data-model.md)

---

## File: `app/actions/cap-table.ts`

All actions use `getOrganizationId()` for multi-tenant isolation. Errors thrown directly (no try-catch wrapping). Decimal fields serialized to `Number()` before returning.

---

### Share Class Actions

#### `createShareClass(data)`

**Input Schema** (`lib/validations/cap-table.ts`):
```typescript
const createShareClassSchema = z.object({
  name: z.string().min(1).max(100).trim(),
  authorized_shares: z.number().int().positive(),
  reserved_shares: z.number().int().min(0).default(0),
  price_per_share: z.number().min(0).optional().nullable(),
});
```

**Logic**:
1. Parse input with `createShareClassSchema`
2. Get `organizationId`
3. Check name uniqueness within org (case-insensitive)
4. Create `ShareClass` record
5. `revalidatePath('/dashboard/cap-table')`

**Returns**: Serialized `ShareClass` object

---

#### `updateShareClass(data)`

**Input Schema**:
```typescript
const updateShareClassSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(100).trim().optional(),
  authorized_shares: z.number().int().positive().optional(),
  reserved_shares: z.number().int().min(0).optional(),
  price_per_share: z.number().min(0).optional().nullable(),
});
```

**Logic**:
1. Parse input
2. Verify share class belongs to org
3. If `authorized_shares` or `reserved_shares` changed: validate `authorized >= issued + reserved`
4. If `name` changed: check uniqueness
5. Update record
6. `revalidatePath('/dashboard/cap-table')`

**Returns**: Serialized updated `ShareClass` object

---

### Stakeholder Actions

#### `createStakeholder(data)`

**Input Schema**:
```typescript
const createStakeholderSchema = z.object({
  name: z.string().min(1).max(200).trim(),
  email: z.string().email().max(255).optional().nullable(),
  role_title: z.string().max(100).trim().optional().nullable(),
});
```

**Logic**:
1. Parse input
2. Get `organizationId`
3. If email provided: check uniqueness within org
4. Create `CapTableStakeholder` record
5. `revalidatePath('/dashboard/cap-table')`

**Returns**: Serialized `CapTableStakeholder` object

---

#### `updateStakeholder(data)`

**Input Schema**:
```typescript
const updateStakeholderSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(200).trim().optional(),
  email: z.string().email().max(255).optional().nullable(),
  role_title: z.string().max(100).trim().optional().nullable(),
});
```

**Logic**:
1. Parse input
2. Verify stakeholder belongs to org
3. If email changed: check uniqueness within org
4. Update record
5. `revalidatePath('/dashboard/cap-table')`

**Returns**: Serialized updated `CapTableStakeholder` object

---

#### `removeStakeholder(data)`

**Input Schema**:
```typescript
const removeStakeholderSchema = z.object({
  id: z.string().uuid(),
});
```

**Logic**:
1. Parse input
2. Verify stakeholder belongs to org
3. Check if stakeholder has any `EquityHolding` with `shares_held > 0` — if yes, throw error "Stakeholder still holds shares. Record a Cancellation transaction first."
4. Soft delete: set `deleted_at = now()`
5. `revalidatePath('/dashboard/cap-table')`

**Returns**: `{ success: true }`

---

### Transaction Actions

#### `recordEquityTransaction(data)`

**Input Schema**:
```typescript
const recordTransactionSchema = z.object({
  transaction_type: z.enum(['GRANT', 'TRANSFER', 'PURCHASE', 'CANCELLATION']),
  transaction_date: z.union([z.string(), z.date()]).pipe(z.coerce.date()),
  share_class_id: z.string().uuid(),
  from_stakeholder_id: z.string().uuid().optional().nullable(),
  to_stakeholder_id: z.string().uuid().optional().nullable(),
  shares_affected: z.number().int().positive(),
  price_per_share: z.number().min(0).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
}).superRefine((data, ctx) => {
  // GRANT/PURCHASE require to_stakeholder_id
  if (['GRANT', 'PURCHASE'].includes(data.transaction_type) && !data.to_stakeholder_id) {
    ctx.addIssue({ code: 'custom', message: 'Recipient stakeholder required', path: ['to_stakeholder_id'] });
  }
  // TRANSFER requires both
  if (data.transaction_type === 'TRANSFER') {
    if (!data.from_stakeholder_id) ctx.addIssue({ code: 'custom', message: 'Source stakeholder required', path: ['from_stakeholder_id'] });
    if (!data.to_stakeholder_id) ctx.addIssue({ code: 'custom', message: 'Recipient stakeholder required', path: ['to_stakeholder_id'] });
  }
  // CANCELLATION requires from_stakeholder_id
  if (data.transaction_type === 'CANCELLATION' && !data.from_stakeholder_id) {
    ctx.addIssue({ code: 'custom', message: 'Source stakeholder required', path: ['from_stakeholder_id'] });
  }
});
```

**Logic** (runs in Prisma `$transaction`):
1. Parse input
2. Get `organizationId` and `userId` (for `created_by`)
3. Verify `share_class_id` belongs to org
4. Verify stakeholder IDs belong to org (where applicable)
5. Validate share availability:
   - **GRANT/PURCHASE**: check `available_shares >= shares_affected` for the share class
   - **TRANSFER/CANCELLATION**: check `from_stakeholder` holding has `shares_held >= shares_affected`
6. Create `EquityTransaction` record
7. Update `EquityHolding` records:
   - **GRANT/PURCHASE**: upsert `to_stakeholder` holding, increment `shares_held`
   - **TRANSFER**: decrement `from_stakeholder`, increment `to_stakeholder`
   - **CANCELLATION**: decrement `from_stakeholder` `shares_held`
8. `revalidatePath('/dashboard/cap-table')`

**Returns**: Serialized `EquityTransaction` object

---

### Query Actions

#### `getCapTableSummary()`

**Input**: None (uses org from session)

**Logic**:
1. Get `organizationId`
2. Query all `ShareClass` records for org (non-deleted, `deleted_at IS NULL`)
3. Query all `CapTableStakeholder` records (non-deleted) with `holdings` and holding's `share_class`
4. Calculate totals: total issued, total authorized, total reserved
5. Calculate ownership percentages per stakeholder

**Returns**:
```typescript
{
  share_classes: Array<{
    id: string;
    name: string;
    authorized_shares: number;
    reserved_shares: number;
    issued_shares: number;       // computed
    available_shares: number;    // computed
    price_per_share: number | null;
  }>;
  stakeholders: Array<{
    id: string;
    name: string;
    email: string | null;
    role_title: string | null;
    holdings: Array<{
      share_class_id: string;
      share_class_name: string;
      shares_held: number;
      ownership_percentage: number; // computed, 4 decimal places
    }>;
    total_shares: number;           // sum across classes
    total_ownership_percentage: number;
  }>;
  totals: {
    total_authorized: number;
    total_issued: number;
    total_reserved: number;
    total_available: number;
  };
}
```

---

#### `getTransactionHistory()`

**Input**: None (uses org from session)

**Logic**:
1. Get `organizationId`
2. Query all `EquityTransaction` records for org, ordered by `transaction_date DESC, created_at DESC`
3. Include `from_stakeholder`, `to_stakeholder`, `share_class` relations
4. Serialize Decimal fields

**Returns**:
```typescript
Array<{
  id: string;
  transaction_type: string;
  transaction_date: string;
  share_class: { id: string; name: string };
  from_stakeholder: { id: string; name: string } | null;
  to_stakeholder: { id: string; name: string } | null;
  shares_affected: number;
  price_per_share: number | null;
  notes: string | null;
  created_by: string;
  created_at: string;
}>
```

---

#### `getCapTableAsOfDate(date)`

**Input Schema**:
```typescript
const asOfDateSchema = z.object({
  date: z.union([z.string(), z.date()]).pipe(z.coerce.date()),
});
```

**Logic**:
1. Parse input
2. Get `organizationId`
3. Query all `EquityTransaction` records where `transaction_date <= date`, ordered by `transaction_date ASC, created_at ASC`
4. Replay transactions to compute stakeholder holdings at that point in time
5. Return same shape as `getCapTableSummary()` but with historical data

**Returns**: Same shape as `getCapTableSummary()`

---

### Sharing Actions

#### `generateShareLink(data)`

**Input Schema**:
```typescript
const generateShareLinkSchema = z.object({
  expires_in_days: z.number().int().min(1).max(365).default(30),
});
```

**Logic**:
1. Parse input
2. Get `organizationId`
3. Compute expiry: `Date.now() + expires_in_days * 86400 * 1000` (Unix ms)
4. Construct payload: `{orgId}:{expiryTimestamp}`
5. Sign with HMAC-SHA256 using `process.env.CAP_TABLE_SHARE_SECRET`
6. Construct token: `base64url(payload).base64url(signature)`
7. Return full URL: `{APP_URL}/share/cap-table/{token}`

**Returns**:
```typescript
{
  url: string;
  expires_at: string; // ISO date
}
```

---

## File: `app/api/share/cap-table/[token]/route.ts`

Public API route (no auth required). Validates the signed token and returns cap table data.

#### `GET /api/share/cap-table/[token]`

**Logic**:
1. Extract `token` from params
2. Split token into `payload` and `signature` parts
3. Recompute HMAC-SHA256 of payload using `CAP_TABLE_SHARE_SECRET`
4. Compare signatures (constant-time comparison)
5. If invalid: return `401 Unauthorized`
6. Parse payload: extract `orgId` and `expiryTimestamp`
7. If expired: return `410 Gone`
8. Query cap table data using service-role Prisma client with explicit `organization_id` filter
9. Return cap table summary (same shape as `getCapTableSummary()`)

**Returns**: Cap table summary JSON (same as `getCapTableSummary()`)

---

## File: `app/share/cap-table/[token]/page.tsx`

Public Next.js page (no auth). Server Component that:
1. Calls the share API route internally to validate token and fetch data
2. Renders a clean, branded cap table view
3. Includes print-optimized CSS
4. Shows company name, date, ownership table, and pie chart
5. Includes a "Print / Save as PDF" button that triggers `window.print()`

---

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `CAP_TABLE_SHARE_SECRET` | HMAC-SHA256 signing key for shareable links | Yes (for sharing feature) |
