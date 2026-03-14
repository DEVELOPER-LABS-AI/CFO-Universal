# Implementation Plan: Security & Quality Hardening

**Branch**: `13-security-hardening`
**Spec**: [spec.md](spec.md)
**Research**: [research.md](research.md)

---

## Technical Context

- **Framework**: Next.js 15 App Router, React 19, TypeScript 5.9 (strict)
- **Auth**: Supabase Auth + custom profile table + role-based helpers in `lib/auth/helpers.ts`
- **ORM**: Prisma 5.22 with PostgreSQL
- **Validation**: Zod schemas in `lib/validations/`
- **API Routes**: 62 total in `app/api/`
- **Existing auth helpers**: `requireAuth()`, `requireAdmin()`, `requireAgencyAdmin()`, `requireContractor()`, `requireBDR()`, `getOrganizationId()`

## Constitution Check

| Principle | Status | Notes |
|-----------|--------|-------|
| No implicit `any` types | FIX NEEDED | 96 `catch (error: any)` instances |
| Zod validation on responses | FIX NEEDED | Several API routes lack input validation |
| Service role keys never exposed to client | COMPLIANT | Keys used only server-side |
| User-friendly error messages | FIX NEEDED | Some routes leak internal details |
| Soft deletes for historical preservation | COMPLIANT | No hard delete changes |
| Prisma schema definitions (no raw SQL) | FIX NEEDED | 1 `$executeRawUnsafe` in production |

---

## Phase 1: Core Auth Fixes (Critical Security)

### Task 1.1: Remove Auto-Provisioning (FR-1)

**File**: `lib/auth/helpers.ts`

**Changes**:
1. Delete the `autoProvisionUser()` function entirely (lines 23-72)
2. In `getCurrentUser()`, remove the auto-provision call (lines 107-109). If no profile found, return `null`
3. The calling code already handles `null` by redirecting to login

**New behavior**: `getCurrentUser()` returns `null` for users without profiles → middleware redirects to `/login` → login page shows "Contact your administrator for an invitation" when user has valid Supabase session but no profile

**File**: `app/login/page.tsx`
- Add handling for "authenticated but no profile" state with the message: "Contact your administrator for an invitation"

### Task 1.2: Add `requireAdminOrExecutive()` Helper (FR-2)

**File**: `lib/auth/helpers.ts`

**Add**:
```typescript
export async function requireAdminOrExecutive(): Promise<AuthUser> {
  const user = await requireAuth()
  if (user.role !== 'ADMIN' && user.role !== 'EXECUTIVE') {
    throw new Error('Forbidden - admin or executive access required')
  }
  return user
}
```

### Task 1.3: Secure Mercury API Routes (FR-2, FR-3)

**ADMIN-only routes** (add `requireAdmin()` + replace body-based orgId with `getOrganizationId()`):
- `app/api/mercury/connect/route.ts` - Remove TODO comments, add `requireAdmin()`, use `getOrganizationId()`
- `app/api/mercury/disconnect/route.ts` - Same pattern
- `app/api/mercury/validate-key/route.ts` - Same pattern

**ADMIN+EXECUTIVE routes** (add `requireAdminOrExecutive()`, keep existing `getOrganizationId()`):
- `app/api/mercury/sync/manual/route.ts`
- `app/api/mercury/sync/status/route.ts`
- `app/api/mercury/sync/retry/route.ts`
- `app/api/mercury/sync/logs/[id]/route.ts`
- `app/api/mercury/connection/status/route.ts`
- `app/api/mercury/merchants/all/route.ts`
- `app/api/mercury/merchants/unmapped/route.ts`
- `app/api/mercury/merchants/map/route.ts`
- `app/api/mercury/merchants/unmap/route.ts`
- `app/api/mercury/merchants/set-mode/route.ts`
- `app/api/mercury/merchants/map-subscription/route.ts`
- `app/api/mercury/merchants/promote-fuzzy-subscription/route.ts`
- `app/api/mercury/merchants/transactions/route.ts`
- `app/api/mercury/merchants/[merchantId]/rules/route.ts`
- `app/api/mercury/merchants/[merchantId]/rules/[ruleId]/route.ts`
- `app/api/mercury/merchants/[merchantId]/rules/test/route.ts`
- `app/api/mercury/expenses/all/route.ts`
- `app/api/mercury/expenses/uncategorized/route.ts`
- `app/api/mercury/expenses/categorize/route.ts`
- `app/api/mercury/deposits/unassociated/route.ts`
- `app/api/mercury/deposits/link-client/route.ts`
- `app/api/mercury/logs/aws/route.ts`
- `app/api/mercury/auto-sync/logs/route.ts`

**Pattern for each file**:
```typescript
import { requireAdminOrExecutive } from '@/lib/auth/helpers'
import { getOrganizationId } from '@/lib/auth/organization'

export async function GET(request: NextRequest) {
  try {
    await requireAdminOrExecutive()
    const organizationId = await getOrganizationId()
    // ... rest of handler
  } catch (error: unknown) {
    // ... error handling
  }
}
```

### Task 1.4: Secure Admin & Export Routes (FR-2)

**ADMIN-only**:
- `app/api/admin/migrate-allocation-pools/route.ts` - Add `requireAdmin()` before `getOrganizationId()`
- `app/api/subscriptions/backfill-all/route.ts` - Add `requireAdmin()` before `getOrganizationId()`

**ADMIN+EXECUTIVE**:
- `app/api/export/clients/route.ts` - Add `requireAdminOrExecutive()` before `getOrganizationId()`

### Task 1.5: Secure Notification Routes (FR-2)

**Files**:
- `app/api/notifications/[id]/read/route.ts` - **Currently has NO auth**. Add `requireAuth()` + `getOrganizationId()`, verify notification belongs to user's org before updating.
- `app/api/notifications/[id]/archive/route.ts` - **Currently has NO auth**. Same pattern as read route.

### Task 1.6: Verify User Deletion Auth (FR-2)

**File**: `app/actions/user-management.ts`

**Change**: Verify that the existing user deletion flow includes `requireAdmin()` check. If missing, add it.

### Task 1.7: Fix Cron Endpoint Auth (FR-2)

**Files**:
- `app/api/cron/contractor-reminders/route.ts`
- `app/api/mercury/sync/cron/route.ts`
- `app/api/xero/sync/cron/route.ts`
- `app/api/cfo-strategist/nightly/route.ts`

**Change**: Replace string `===` comparison with `crypto.timingSafeEqual()`:
```typescript
import crypto from 'crypto'

const authHeader = request.headers.get('authorization')
const cronSecret = process.env.CRON_SECRET
if (!authHeader || !cronSecret) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}
const token = authHeader.replace('Bearer ', '')
const isValid = token.length === cronSecret.length &&
  crypto.timingSafeEqual(Buffer.from(token), Buffer.from(cronSecret))
if (!isValid) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}
```

---

## Phase 2: Error Handling & Input Validation

### Task 2.1: Create Shared Error Helper

**New helper in**: `lib/utils/error.ts`

```typescript
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  if (typeof error === 'string') return error
  return 'An unexpected error occurred'
}
```

### Task 2.2: Fix All `catch (error: any)` (FR-4)

Replace all 96 instances across the codebase. Grouped by location:

**API routes (~30 files)**: Replace `catch (error: any)` with `catch (error: unknown)`, use `getErrorMessage()`, ensure no `error.message` is returned to client in 500 responses.

**Components (~40 files)**: Replace `catch (error: any)` with `catch (error: unknown)`, use `getErrorMessage()` for toast messages.

**Lib files (~12 files)**: Replace `catch (error: any)` with `catch (error: unknown)`, use `getErrorMessage()` for logging.

**Dashboard pages (~8 files)**: Same pattern as components.

**Server actions (~2 files)**: Same pattern.

### Task 2.3: Add Input Validation to Export Route (FR-5)

**File**: `app/api/export/clients/route.ts`

**Change**: Add Zod schema for filter parameters:
```typescript
const exportFiltersSchema = z.object({
  status: z.string().optional(),
  relationship_type: z.string().optional(),
  min_margin: z.coerce.number().min(0).max(100).optional(),
  max_margin: z.coerce.number().min(0).max(100).optional(),
  search: z.string().max(200).optional(),
  // ... other filters
})

// In handler:
const filtersParam = searchParams.get('filters')
if (filtersParam) {
  try {
    const parsed = JSON.parse(filtersParam)
    filters = exportFiltersSchema.parse(parsed)
  } catch (e) {
    return NextResponse.json({ error: 'Invalid filter parameters' }, { status: 400 })
  }
}
```

### Task 2.4: Sanitize Error Responses (FR-4)

**Files**: All API routes that currently return `error.message` in 500 responses.

**Change**: Replace `error.message || 'fallback'` patterns with generic messages in 500 responses. Keep specific error messages for 400/404 responses where the error is expected.

---

## Phase 3: Password & Environment Validation

### Task 3.1: Unify Password Validation (FR-6)

**File**: `lib/validations/auth.ts`

**Changes**:
1. Create shared `strongPasswordSchema`:
```typescript
export const strongPasswordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .regex(/[A-Z]/, 'Must contain at least one uppercase letter')
  .regex(/[a-z]/, 'Must contain at least one lowercase letter')
  .regex(/[0-9]/, 'Must contain at least one number')
```

2. Keep `loginSchema` with `min(1)` (unchanged - per clarification)
3. Update `resetPasswordSchema` to use `strongPasswordSchema`
4. Check `app/invite-accept/page.tsx` for password field - update to use `strongPasswordSchema`

### Task 3.2: Add Environment Variable Validation (FR-7)

**New file**: `lib/env.ts`

```typescript
function validateRequiredEnvVars() {
  if (typeof window !== 'undefined') return // Client-side guard

  const required = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'SUPABASE_SERVICE_ROLE_KEY',
    'ENCRYPTION_KEY',
  ]

  const missing = required.filter(key => !process.env[key])
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`)
  }
}

validateRequiredEnvVars()
```

**Integration**: Import `lib/env.ts` at the top of `lib/prisma.ts` to ensure it runs on server startup.

### Task 3.3: Replace Raw SQL (FR-8)

**File**: `app/actions/user-management.ts` (line ~517)

**Change**:
```typescript
// Before:
await prisma.$executeRawUnsafe(
  `UPDATE contractor_invoices SET reviewed_by = NULL WHERE reviewed_by = $1`,
  profile.id
)

// After:
await prisma.contractorInvoice.updateMany({
  where: { reviewed_by: profile.id },
  data: { reviewed_by: null },
})
```

---

## Phase 4: Verification

### Task 4.1: Build Verification
- Run `npx tsc --noEmit` to verify zero TypeScript errors
- Run `npx next build` to verify build succeeds
- Grep for `catch (error: any)` → must return 0 results
- Grep for `$executeRawUnsafe` → must return 0 results (in app/ and lib/ dirs)
- Grep for `autoProvisionUser` → must return 0 results

### Task 4.2: Manual Verification Checklist
- [ ] Login as user with no profile → see "Contact your administrator" message
- [ ] Login as CONTRACTOR → attempt Mercury endpoints → 403
- [ ] Login as EXECUTIVE → access Mercury sync status → 200
- [ ] Login as EXECUTIVE → attempt Mercury connect → 403
- [ ] Login as ADMIN → all endpoints accessible
- [ ] Send malformed JSON to export endpoint → 400 (not 500)
- [ ] Password reset form → requires 8+ chars with complexity
- [ ] Login form → accepts any non-empty password
- [ ] Remove a required env var → server fails to start with clear message

---

## File Change Summary

| Category | Files Changed | New Files |
|----------|--------------|-----------|
| Auth helpers | 1 | 0 |
| Mercury API routes | 26 | 0 |
| Admin API routes | 2 | 0 |
| Export API routes | 1 | 0 |
| Cron API routes | 4 | 0 |
| Error handling (all) | ~96 instances across ~50 files | 1 (`lib/utils/error.ts`) |
| Password validation | 1-2 | 0 |
| Env validation | 1 (prisma.ts import) | 1 (`lib/env.ts`) |
| Raw SQL | 1 | 0 |
| Login page | 1 | 0 |
| **Total** | **~55 files modified** | **2 new files** |

---

## Execution Order & Dependencies

```
Phase 1 (Critical - do first, serial):
  1.1 Remove auto-provisioning
  1.2 Add requireAdminOrExecutive helper
  1.3 Secure Mercury routes (depends on 1.2)
  1.4 Secure admin/export routes (depends on 1.2)
  1.5 Fix cron auth

Phase 2 (Can start after 1.2):
  2.1 Create error helper
  2.2 Fix catch (error: any) everywhere (depends on 2.1)
  2.3 Add export input validation
  2.4 Sanitize error responses

Phase 3 (Independent):
  3.1 Unify password validation
  3.2 Add env validation
  3.3 Replace raw SQL

Phase 4 (After all above):
  4.1 Build verification
  4.2 Manual verification
```

## Constitution Exceptions

| Principle | Deviation | Justification |
|-----------|-----------|---------------|
| API Design: "Include rate limiting on public endpoints" | Out of scope for this feature | Rate limiting requires Redis/Upstash infrastructure not yet provisioned. This feature focuses on auth/RBAC which is a prerequisite for meaningful rate limiting. Rate limiting is tracked as a future enhancement in spec.md. Security priority: auth > rate limiting. |

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Breaking existing admin workflows | Medium | High | Test all admin pages after auth changes |
| Locking out current users | Low | Critical | Auto-provision removal only affects new non-invited users |
| Breaking cron jobs | Low | Medium | Test cron endpoints with correct Bearer token |
| Build failures from error type changes | Low | Low | TypeScript compiler will catch mismatches |
