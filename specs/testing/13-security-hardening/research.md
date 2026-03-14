# Research: Security & Quality Hardening

## Decision Log

### D1: Auth Helper Reuse Pattern for API Routes

**Decision**: Reuse existing `requireAuth()`, `requireAdmin()`, and `getOrganizationId()` from `lib/auth/helpers.ts` and `lib/auth/organization.ts` in all API routes. Add a new `requireAdminOrExecutive()` helper for tiered Mercury/export access.

**Rationale**: These helpers already handle Supabase session validation, profile lookup, role checking, and org scoping. `getOrganizationId()` internally calls `requireAuth()`, so any route using it already has basic auth. The gap is role-level checks beyond basic auth.

**Alternatives**: Creating middleware-based auth (rejected - Next.js middleware runs on Edge Runtime which is incompatible with Prisma), creating per-route auth decorators (over-engineered for this scope).

### D2: Auto-Provisioning Fix Approach

**Decision**: Remove the `autoProvisionUser()` function entirely. In `getCurrentUser()`, if no profile exists, return `null` instead of creating one. The login page already handles `null` by redirecting to `/login`. Add a new "no access" state in the login flow.

**Rationale**: The invitation flow in `user-management.ts` already creates profiles with correct roles before users ever log in. Auto-provisioning was a dev convenience that became a security hole.

**Alternatives**: Keep auto-provisioning but with INACTIVE status (rejected per clarification - creates admin burden).

### D3: Error Handling Pattern

**Decision**: Replace `catch (error: any)` with `catch (error: unknown)` and use a shared helper `getErrorMessage(error: unknown): string` that does `instanceof Error` narrowing.

**Rationale**: TypeScript strict mode should catch `any` types. A shared helper avoids duplicating the narrowing pattern 96 times.

**Alternatives**: Using `catch (error)` without type annotation (works but less explicit).

### D4: Cron Endpoint Auth - Timing-Safe Comparison

**Decision**: Use Node.js `crypto.timingSafeEqual()` for Bearer token validation on cron endpoints. Keep the existing `CRON_SECRET` env var pattern but fix the comparison method.

**Rationale**: String `===` comparison is vulnerable to timing attacks. `timingSafeEqual` is the standard mitigation.

### D5: Password Validation Strategy

**Decision**: Create a shared `strongPasswordSchema` in `lib/validations/auth.ts`. Use it in `resetPasswordSchema` and `inviteAcceptSchema`. Keep `loginSchema` with `min(1)` as-is (per clarification).

**Rationale**: Existing users with weak passwords must not be locked out at login. Strong rules enforced at password creation/reset boundaries only.

### D6: Environment Validation Module

**Decision**: Create `lib/env.ts` that validates required env vars on import. Import it in `lib/prisma.ts` (which is the server-side entry point imported by nearly all server code). Use `typeof window === 'undefined'` guard to prevent client bundle inclusion.

**Rationale**: Fail-fast at startup is better than cryptic runtime errors. `lib/prisma.ts` is already imported by all server actions and API routes.

---

## Inventory: Files Requiring Changes

### API Routes Missing Auth (need `requireAuth`/`requireAdmin` added)

**Mercury routes (ADMIN-only: connect/disconnect/config):**
- `app/api/mercury/connect/route.ts` - TODO comments acknowledge missing auth
- `app/api/mercury/disconnect/route.ts` - TODO comments acknowledge missing auth
- `app/api/mercury/validate-key/route.ts` - No auth

**Mercury routes (ADMIN+EXECUTIVE: sync/view):**
- `app/api/mercury/sync/manual/route.ts` - TODO comments acknowledge missing auth
- `app/api/mercury/sync/status/route.ts` - Uses `getOrganizationId()` (has basic auth) but no role check
- `app/api/mercury/sync/retry/route.ts` - Uses `getOrganizationId()` but no role check
- `app/api/mercury/sync/logs/[id]/route.ts` - Uses `getOrganizationId()` but no role check
- `app/api/mercury/connection/status/route.ts` - Uses `getOrganizationId()` but no role check
- `app/api/mercury/merchants/all/route.ts` - Uses `getOrganizationId()` but no role check
- `app/api/mercury/merchants/unmapped/route.ts` - Uses `getOrganizationId()` but no role check
- `app/api/mercury/merchants/map/route.ts` - No auth, accepts org from body
- `app/api/mercury/merchants/unmap/route.ts` - Uses `getOrganizationId()` but no role check
- `app/api/mercury/merchants/set-mode/route.ts` - Uses `getOrganizationId()` but no role check
- `app/api/mercury/merchants/map-subscription/route.ts` - Uses `getOrganizationId()` but no role check
- `app/api/mercury/merchants/promote-fuzzy-subscription/route.ts` - Uses `getOrganizationId()` but no role check
- `app/api/mercury/merchants/transactions/route.ts` - Uses `getOrganizationId()` but no role check
- `app/api/mercury/merchants/[merchantId]/rules/route.ts` - Uses `getOrganizationId()` but no role check
- `app/api/mercury/merchants/[merchantId]/rules/[ruleId]/route.ts` - Uses `getOrganizationId()` but no role check
- `app/api/mercury/merchants/[merchantId]/rules/test/route.ts` - Uses `getOrganizationId()` but no role check
- `app/api/mercury/expenses/all/route.ts` - Uses `getOrganizationId()` but no role check
- `app/api/mercury/expenses/uncategorized/route.ts` - Uses `getOrganizationId()` but no role check
- `app/api/mercury/expenses/categorize/route.ts` - Uses `getOrganizationId()` but no role check
- `app/api/mercury/deposits/unassociated/route.ts` - Uses `getOrganizationId()` but no role check
- `app/api/mercury/deposits/link-client/route.ts` - No auth, accepts org from body
- `app/api/mercury/logs/aws/route.ts` - Uses `getOrganizationId()` but no role check
- `app/api/mercury/auto-sync/logs/route.ts` - Uses `getOrganizationId()` but no role check

**Admin routes (ADMIN-only):**
- `app/api/admin/migrate-allocation-pools/route.ts` - Uses `getOrganizationId()` but no admin check
- `app/api/subscriptions/backfill-all/route.ts` - Uses `getOrganizationId()` but no admin check

**Export routes (ADMIN+EXECUTIVE):**
- `app/api/export/clients/route.ts` - Uses `getOrganizationId()` but no role check

**Cron routes (Bearer token):**
- `app/api/cron/contractor-reminders/route.ts` - Uses string `===` comparison
- `app/api/mercury/sync/cron/route.ts` - Uses string `===` comparison
- `app/api/xero/sync/cron/route.ts` - Uses string `===` comparison
- `app/api/cfo-strategist/nightly/route.ts` - Uses string `===` comparison

**Notification routes (PARTIAL auth - need fixes):**
- `app/api/notifications/route.ts` (GET) - Has `requireAuth()` + `getOrganizationId()` (OK)
- `app/api/notifications/[id]/route.ts` (GET) - Has `requireAuth()` + `getOrganizationId()` (OK)
- `app/api/notifications/[id]/read/route.ts` (POST) - **NO AUTH** - uses raw PrismaClient, no requireAuth or org scoping
- `app/api/notifications/[id]/archive/route.ts` (POST) - **NO AUTH** - uses raw PrismaClient, no requireAuth or org scoping

**Routes with proper auth already (no changes needed):**
- `app/api/xero/sync/retry/route.ts` - Has `requireAuth()` + role check
- `app/api/xero/oauth/authorize/route.ts` - Has `getOrganizationId()`
- `app/api/xero/oauth/disconnect/route.ts` - Has `requireAuth()` + `getOrganizationId()`
- `app/api/xero/oauth/callback/route.ts` - Cookie-based auth
- `app/api/xero/mappings/*` - Has `getOrganizationId()`
- `app/api/xero/expenses/*` - Has `getOrganizationId()`
- `app/api/xero/sync/status/route.ts` - Has `getOrganizationId()`
- `app/api/xero/sync/logs/[id]/route.ts` - Has `getOrganizationId()`
- `app/api/clients/route.ts` - Has `getOrganizationId()`
- `app/api/clients/[id]/*` - Has `getOrganizationId()`
- `app/api/health/route.ts` - Public health check (no auth needed)
- `app/api/share/cap-table/[token]/route.ts` - Token-based public sharing (no auth needed)
- `app/api/webhooks/xero/route.ts` - Webhook verification (no user auth needed)
- `app/api/expense-categories/route.ts` - Has `getOrganizationId()`
- `app/api/subscriptions/[id]/transactions/*` - Has `getOrganizationId()`
- `app/api/subscriptions/[id]/trend/route.ts` - Has `getOrganizationId()`
- `app/api/contractors/[id]/trend/route.ts` - Has `getOrganizationId()`

### `catch (error: any)` instances: 97 across these files

**API routes (29):** mercury/* (23 instances across 22 files), admin/*, subscriptions/*, export/*, cron/*, xero/*, notifications/* (6 non-mercury)
**Components (43):** clients/*, agencies/*, subscriptions/*, staff/*, mercury/*, cap-table/*, portfolio/*, settings/*
**Lib (14):** mercury/*, xero/*
**Dashboard pages (9):** strategist/*, analytics/*, portfolio/*
**Server actions (2):** roi-calculations.ts

### Raw SQL: 1 production instance
- `app/actions/user-management.ts:517` - `$executeRawUnsafe` → replace with `prisma.contractorInvoice.updateMany()`

### Environment Variables (23 usages across 13 lib files)

**Critical (must exist at startup):**
- `NEXT_PUBLIC_SUPABASE_URL` - lib/supabase/*
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - lib/supabase/*
- `SUPABASE_SERVICE_ROLE_KEY` - lib/supabase/admin.ts
- `DATABASE_URL` - Prisma connection
- `DIRECT_URL` - Prisma direct connection
- `ENCRYPTION_KEY` - lib/encryption.ts (already validated)

**Optional integrations (validate on access):**
- `XERO_CLIENT_ID`, `XERO_CLIENT_SECRET`, `XERO_REDIRECT_URI` - lib/xero/client.ts
- `MERCURY_API_KEY` - lib/mercury/client.ts (deprecated, using encrypted DB key)
- `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION` - lib/mercury/lambda-client.ts
- `RESEND_API_KEY`, `RESEND_FROM_EMAIL` - lib/email/resend-client.ts
- `CRON_SECRET` - app/api/cron/*, app/api/mercury/sync/cron/*
- `NEXT_PUBLIC_APP_URL` - lib/cap-table/share-token.ts
