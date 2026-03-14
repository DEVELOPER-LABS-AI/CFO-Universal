# Tasks: Security & Quality Hardening

**Feature**: [spec.md](spec.md)
**Plan**: [plan.md](plan.md)
**Branch**: `13-security-hardening`

---

## User Story Mapping

| Story | Functional Requirements | Priority | Description |
|-------|------------------------|----------|-------------|
| US1 | FR-1 | P1 | Fix auto-provisioning privilege escalation |
| US2 | FR-2 | P1 | Secure API routes with auth and RBAC |
| US3 | FR-4 | P2 | Standardize error handling across codebase |
| US4 | FR-5 | P2 | Add input validation to critical API parameters |
| US5 | FR-6 | P3 | Unify password validation schemas |
| US6 | FR-7 | P3 | Add environment variable validation |
| US7 | FR-8 | P3 | Replace raw SQL with Prisma queries |

---

## Phase 1: Setup

- [x] T001 Create feature branch `13-security-hardening` and verify clean build with `npx tsc --noEmit`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Goal**: Create shared helpers that all subsequent user stories depend on.

- [x] T002 Create shared error helper `getErrorMessage()` in `lib/utils/error.ts`
- [x] T003 Add `requireAdminOrExecutive()` helper function in `lib/auth/helpers.ts`

**Completion Criteria**: Both helpers compile cleanly and are importable from other files.

---

## Phase 3: US1 - Fix Auto-Provisioning (FR-1)

**Story Goal**: Deny access to users without pre-created profiles. No auto-provisioning of admin roles.

**Independent Test Criteria**:
- User with no profile gets `null` from `getCurrentUser()` and sees "Contact your administrator" message
- Existing users with profiles are unaffected
- Invited users receive their assigned role

### Tasks

- [x] T004 [US1] Delete `autoProvisionUser()` function entirely from `lib/auth/helpers.ts` (lines ~23-72)
- [x] T005 [US1] Update `getCurrentUser()` in `lib/auth/helpers.ts` to return `null` instead of calling `autoProvisionUser` when no profile exists (lines ~107-109)
- [x] T006 [US1] Add "authenticated but no profile" inline banner on `app/login/page.tsx` — when Supabase session exists but `getCurrentUser()` returns null, display: "Contact your administrator for an invitation" and a sign-out button. Do not redirect to a separate page.

---

## Phase 4: US2 - Secure API Routes with Auth & RBAC (FR-2)

**Story Goal**: All API routes enforce authentication and role-based access control. ADMIN-only routes reject non-admins. ADMIN+EXECUTIVE routes reject lower roles. Cron endpoints use timing-safe token comparison. Notification mutation routes require auth. Destructive operations require ADMIN verification.

**Independent Test Criteria**:
- CONTRACTOR calling Mercury endpoints gets 403
- EXECUTIVE calling Mercury sync/view endpoints gets 200
- EXECUTIVE calling Mercury connect gets 403
- ADMIN can access all endpoints
- Cron endpoints reject invalid tokens with 401
- Unauthenticated caller to notification read/archive gets 401

### Tasks — Mercury ADMIN-only routes

- [ ] T007 [P] [US2] Add `requireAdmin()` + replace body-based orgId with `getOrganizationId()` in `app/api/mercury/connect/route.ts`
- [ ] T008 [P] [US2] Add `requireAdmin()` + replace body-based orgId with `getOrganizationId()` in `app/api/mercury/disconnect/route.ts`
- [ ] T009 [P] [US2] Add `requireAdmin()` + replace body-based orgId with `getOrganizationId()` in `app/api/mercury/validate-key/route.ts`

### Tasks — Mercury ADMIN+EXECUTIVE routes

- [ ] T010 [P] [US2] Add `requireAdminOrExecutive()` before `getOrganizationId()` in `app/api/mercury/sync/manual/route.ts`
- [ ] T011 [P] [US2] Add `requireAdminOrExecutive()` before `getOrganizationId()` in `app/api/mercury/sync/status/route.ts`
- [ ] T012 [P] [US2] Add `requireAdminOrExecutive()` before `getOrganizationId()` in `app/api/mercury/sync/retry/route.ts`
- [ ] T013 [P] [US2] Add `requireAdminOrExecutive()` before `getOrganizationId()` in `app/api/mercury/sync/logs/[id]/route.ts`
- [ ] T014 [P] [US2] Add `requireAdminOrExecutive()` before `getOrganizationId()` in `app/api/mercury/connection/status/route.ts`
- [ ] T015 [P] [US2] Add `requireAdminOrExecutive()` before `getOrganizationId()` in `app/api/mercury/merchants/all/route.ts`
- [ ] T016 [P] [US2] Add `requireAdminOrExecutive()` before `getOrganizationId()` in `app/api/mercury/merchants/unmapped/route.ts`
- [ ] T017 [P] [US2] Add `requireAdminOrExecutive()` + replace body-based orgId in `app/api/mercury/merchants/map/route.ts`
- [ ] T018 [P] [US2] Add `requireAdminOrExecutive()` before `getOrganizationId()` in `app/api/mercury/merchants/unmap/route.ts`
- [ ] T019 [P] [US2] Add `requireAdminOrExecutive()` before `getOrganizationId()` in `app/api/mercury/merchants/set-mode/route.ts`
- [ ] T020 [P] [US2] Add `requireAdminOrExecutive()` before `getOrganizationId()` in `app/api/mercury/merchants/map-subscription/route.ts`
- [ ] T021 [P] [US2] Add `requireAdminOrExecutive()` before `getOrganizationId()` in `app/api/mercury/merchants/promote-fuzzy-subscription/route.ts`
- [ ] T022 [P] [US2] Add `requireAdminOrExecutive()` before `getOrganizationId()` in `app/api/mercury/merchants/transactions/route.ts`
- [ ] T023 [P] [US2] Add `requireAdminOrExecutive()` before `getOrganizationId()` in `app/api/mercury/merchants/[merchantId]/rules/route.ts`
- [ ] T024 [P] [US2] Add `requireAdminOrExecutive()` before `getOrganizationId()` in `app/api/mercury/merchants/[merchantId]/rules/[ruleId]/route.ts`
- [ ] T025 [P] [US2] Add `requireAdminOrExecutive()` before `getOrganizationId()` in `app/api/mercury/merchants/[merchantId]/rules/test/route.ts`
- [ ] T026 [P] [US2] Add `requireAdminOrExecutive()` before `getOrganizationId()` in `app/api/mercury/expenses/all/route.ts`
- [ ] T027 [P] [US2] Add `requireAdminOrExecutive()` before `getOrganizationId()` in `app/api/mercury/expenses/uncategorized/route.ts`
- [ ] T028 [P] [US2] Add `requireAdminOrExecutive()` before `getOrganizationId()` in `app/api/mercury/expenses/categorize/route.ts`
- [ ] T029 [P] [US2] Add `requireAdminOrExecutive()` before `getOrganizationId()` in `app/api/mercury/deposits/unassociated/route.ts`
- [ ] T030 [P] [US2] Add `requireAdminOrExecutive()` + replace body-based orgId in `app/api/mercury/deposits/link-client/route.ts`
- [ ] T031 [P] [US2] Add `requireAdminOrExecutive()` before `getOrganizationId()` in `app/api/mercury/logs/aws/route.ts`
- [ ] T032 [P] [US2] Add `requireAdminOrExecutive()` before `getOrganizationId()` in `app/api/mercury/auto-sync/logs/route.ts`

### Tasks — Admin & Export routes

- [ ] T033 [P] [US2] Add `requireAdmin()` before `getOrganizationId()` in `app/api/admin/migrate-allocation-pools/route.ts`
- [ ] T034 [P] [US2] Add `requireAdmin()` before `getOrganizationId()` in `app/api/subscriptions/backfill-all/route.ts`
- [ ] T035 [P] [US2] Add `requireAdminOrExecutive()` before `getOrganizationId()` in `app/api/export/clients/route.ts`

### Tasks — Notification routes (currently NO auth)

- [ ] T036 [P] [US2] Add `requireAuth()` + `getOrganizationId()` + org ownership check in `app/api/notifications/[id]/read/route.ts`
- [ ] T037 [P] [US2] Add `requireAuth()` + `getOrganizationId()` + org ownership check in `app/api/notifications/[id]/archive/route.ts`

### Tasks — Cron endpoint auth

- [ ] T038 [P] [US2] Replace string `===` with `crypto.timingSafeEqual()` in `app/api/cron/contractor-reminders/route.ts`
- [ ] T039 [P] [US2] Replace string `===` with `crypto.timingSafeEqual()` in `app/api/mercury/sync/cron/route.ts`
- [ ] T040 [P] [US2] Replace string `===` with `crypto.timingSafeEqual()` in `app/api/xero/sync/cron/route.ts`
- [ ] T041 [P] [US2] Replace string `===` with `crypto.timingSafeEqual()` in `app/api/cfo-strategist/nightly/route.ts`

### Tasks — Destructive operation verification

- [ ] T042 [US2] Verify user deletion flow in `app/actions/user-management.ts` requires `requireAdmin()` — add if missing

---

## Phase 5: US3 - Standardize Error Handling (FR-4)

**Story Goal**: Replace all `catch (error: any)` with `catch (error: unknown)` using the shared `getErrorMessage()` helper. Sanitize 500 error responses.

**Independent Test Criteria**:
- `grep -r "catch (error: any)" app/ components/ lib/` returns 0 results
- No 500 responses expose internal function names or stack traces
- All error handlers use `instanceof Error` narrowing via `getErrorMessage()`

**Depends on**: T002 (`getErrorMessage` helper)

### Tasks

- [ ] T043 [P] [US3] Replace all `catch (error: any)` with `catch (error: unknown)` + `getErrorMessage()` in `app/api/mercury/` routes (22 files, 23 instances)
- [ ] T044 [P] [US3] Replace all `catch (error: any)` with `catch (error: unknown)` + `getErrorMessage()` in `app/api/` routes outside mercury (6 instances: admin, subscriptions, export, cron, xero, cfo-strategist, notifications, expense-categories)
- [ ] T045 [P] [US3] Replace all `catch (error: any)` with `catch (error: unknown)` + `getErrorMessage()` in `components/` (43 instances across 38 files)
- [ ] T046 [P] [US3] Replace all `catch (error: any)` with `catch (error: unknown)` + `getErrorMessage()` in `lib/` files (14 instances across 6 files)
- [ ] T047 [P] [US3] Replace all `catch (error: any)` with `catch (error: unknown)` + `getErrorMessage()` in `app/dashboard/` pages (9 instances across 6 files)
- [ ] T048 [P] [US3] Replace all `catch (error: any)` with `catch (error: unknown)` + `getErrorMessage()` in `app/actions/` server actions (2 instances across 1 file)
- [ ] T049 [US3] Sanitize all API 500 error responses to return generic messages instead of `error.message` in `app/api/` routes

---

## Phase 6: US4 - Input Validation (FR-5)

**Story Goal**: Add Zod schema validation to critical API routes where invalid input currently causes 500 errors instead of 400.

**Independent Test Criteria**:
- Malformed JSON to export endpoint returns 400 (not 500)
- Out-of-range numeric parameters return 400
- Oversized string parameters return 400

### Tasks

- [x] T050 [US4] Add Zod `exportFiltersSchema` validation for filter parameters in `app/api/export/clients/route.ts`

---

## Phase 7: US5 - Unify Password Validation (FR-6)

**Story Goal**: Create a shared strong password schema. Enforce on creation/reset. Keep login minimal.

**Independent Test Criteria**:
- Password reset form rejects passwords without uppercase, lowercase, or digit
- Invite acceptance form enforces the same strong rules
- Login form accepts any non-empty password

### Tasks

- [x] T051 [US5] Create shared `strongPasswordSchema` in `lib/validations/auth.ts` (min 8 chars, uppercase, lowercase, number)
- [x] T052 [US5] Update `resetPasswordSchema` in `lib/validations/auth.ts` to use `strongPasswordSchema`
- [x] T053 [US5] Verify `app/invite-accept/page.tsx` correctly uses updated `resetPasswordSchema` — already imports it, confirm strong rules cascade after T052

---

## Phase 8: US6 - Environment Variable Validation (FR-7)

**Story Goal**: Fail fast at startup if required env vars are missing.

**Independent Test Criteria**:
- Removing a required env var causes server to fail with a clear error listing the missing variable
- Client bundle does not include env validation code

### Tasks

- [x] T054 [US6] Create `lib/env.ts` with required env var validation (SUPABASE_URL, ANON_KEY, SERVICE_ROLE_KEY, ENCRYPTION_KEY) and `typeof window` guard
- [x] T055 [US6] Import `lib/env.ts` at top of `lib/prisma.ts` to trigger validation on server startup

---

## Phase 9: US7 - Replace Raw SQL (FR-8)

**Story Goal**: Replace `$executeRawUnsafe` with Prisma query builder.

**Independent Test Criteria**:
- `grep -r "$executeRawUnsafe" app/ lib/` returns 0 results
- Replacement query produces identical behavior (nullify `reviewed_by` on contractor invoices)

### Tasks

- [x] T056 [US7] Replace `$executeRawUnsafe` with `prisma.contractorInvoice.updateMany()` in `app/actions/user-management.ts` (~line 517)

---

## Phase 10: Verification & Polish

**Goal**: Ensure all changes compile, build, and pass grep checks.

- [ ] T057 Run `npx tsc --noEmit` and verify zero TypeScript errors
- [ ] T058 Run `npx next build` and verify clean build
- [ ] T059 Verify `grep -r "catch (error: any)" app/ components/ lib/` returns 0 results
- [ ] T060 Verify `grep -r "executeRawUnsafe" app/ lib/` returns 0 results
- [ ] T061 Verify `grep -r "autoProvisionUser" lib/` returns 0 results

---

## Dependencies

```
T002 (error helper) ──────────────> T043-T049 (US3: error handling)
T003 (requireAdminOrExecutive) ──> T010-T032, T035 (US2: ADMIN+EXEC routes)
T004-T005 (auto-provision) ──────> T006 (login page message)
T001 (setup) ─────────────────────> All subsequent tasks
T043-T056 (all impl) ────────────> T057-T061 (verification)
T052 (resetPasswordSchema) ──────> T053 (verify invite-accept cascades)
```

### Story Dependency Order

```
Phase 2 (Foundational: T002, T003) - MUST complete first
  |
  ├── Phase 3 (US1: T004-T006) - Independent after Phase 2
  ├── Phase 4 (US2: T007-T042) - Independent after T003
  ├── Phase 5 (US3: T043-T049) - Independent after T002
  ├── Phase 6 (US4: T050) - Independent
  ├── Phase 7 (US5: T051-T053) - Independent
  ├── Phase 8 (US6: T054-T055) - Independent
  └── Phase 9 (US7: T056) - Independent
  |
Phase 10 (Verification: T057-T061) - After ALL above
```

---

## Parallel Execution Opportunities

**Within Phase 4 (US2)**: All 36 route tasks (T007-T042) are parallelizable — they modify different files with the same pattern.

**Across Phases 3-9**: After foundational tasks complete, US1 through US7 can all proceed in parallel since they touch different files:
- US1 modifies `lib/auth/helpers.ts` and `app/login/page.tsx`
- US2 modifies `app/api/mercury/`, `app/api/admin/`, `app/api/subscriptions/`, `app/api/export/`, `app/api/cron/`, `app/api/notifications/[id]/`
- US3 modifies error handlers across `app/`, `components/`, `lib/`
- US4 modifies `app/api/export/clients/route.ts`
- US5 modifies `lib/validations/auth.ts` and verifies `app/invite-accept/page.tsx`
- US6 creates `lib/env.ts` and modifies `lib/prisma.ts`
- US7 modifies `app/actions/user-management.ts`

**Note**: US2 and US3 both touch `app/api/` files. When working on both in parallel, apply auth changes (US2) before error handling changes (US3) to avoid merge conflicts.

---

## Implementation Strategy

1. **MVP (Phase 2-3)**: Fix the critical privilege escalation first — this is the highest-security-impact change
2. **Core Security (Phase 4)**: Secure all API routes — second highest impact
3. **Quality (Phase 5-9)**: Error handling, validation, and cleanup — important but lower blast radius
4. **Verify (Phase 10)**: Full build verification ensures nothing broke

**Suggested MVP scope**: Phases 1-4 (T001-T042) — covers all critical security fixes.

---

## Summary

| Metric | Count |
|--------|-------|
| Total tasks | 61 |
| Setup tasks | 1 |
| Foundational tasks | 2 |
| US1 tasks (auto-provision) | 3 |
| US2 tasks (API auth/RBAC) | 36 |
| US3 tasks (error handling) | 7 |
| US4 tasks (input validation) | 1 |
| US5 tasks (password) | 3 |
| US6 tasks (env validation) | 2 |
| US7 tasks (raw SQL) | 1 |
| Verification tasks | 5 |
| Parallelizable tasks | 43 |
| Files modified (estimated) | ~58 |
| New files | 2 (`lib/utils/error.ts`, `lib/env.ts`) |
