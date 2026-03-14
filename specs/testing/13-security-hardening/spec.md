# Feature Specification: Security & Quality Hardening

**Status**: Draft
**Created**: 2026-03-04
**Last Updated**: 2026-03-04

## Clarifications

### Session 2026-03-04

- Q: Should uninvited users be denied access entirely or created with INACTIVE status? → A: Deny access entirely - return auth error, show "Contact your administrator for an invitation." No profile is created.
- Q: Which roles can access Mercury non-admin endpoints (sync, merchants, deposits)? → A: Tiered access - ADMIN for connect/disconnect/config; ADMIN + EXECUTIVE for sync status, merchant mappings, and deposit viewing.
- Q: How should password validation change affect existing users with weak passwords? → A: Strong validation enforced only on creation/reset flows. Login form keeps minimal validation (non-empty) so existing users are not locked out.

---

## Overview

### Feature Summary

Harden the application's security posture and code quality by fixing critical vulnerabilities discovered during a full-project audit. This includes fixing privilege escalation in user provisioning, enforcing role-based access control across all endpoints, strengthening input validation, and improving error handling consistency.

### Business Value

The application manages sensitive financial data (revenue, costs, profit margins, bank transactions) for agencies. The current security gaps allow any authenticated user to gain admin privileges, access or destroy financial data without authorization, and bypass role restrictions. Fixing these issues is a prerequisite for production readiness and protects the organization from data breaches, unauthorized financial operations, and compliance failures.

### Target Users

- **Platform Administrators** - Need confidence that only authorized users can perform admin operations
- **All authenticated users** - Benefit from consistent error feedback and secure session handling
- **External portal users** (Contractors, Agencies, BDRs) - Must be restricted to only their own data and actions

---

## User Scenarios

### Primary Use Cases

**Scenario 1: New User Login Without Invitation**
- **Actor**: Unauthenticated person who creates a Supabase account directly
- **Goal**: Attempt to access the platform without being invited
- **Steps**:
  1. Person signs up via Supabase authentication
  2. Person navigates to the application
  3. System checks for an existing user profile
  4. No profile exists and no pending invitation found
- **Expected Outcome**: User is denied access and shown a message that they need an administrator invitation. They are NOT auto-provisioned with admin privileges.

**Scenario 2: Contractor Attempts Admin API Endpoint**
- **Actor**: Authenticated user with CONTRACTOR role
- **Goal**: Access an admin-only endpoint (e.g., migration, backfill, or data export)
- **Steps**:
  1. Contractor authenticates and receives a valid session
  2. Contractor makes a request to an admin-restricted endpoint
  3. System validates the user's role against the endpoint's required role
- **Expected Outcome**: Request is rejected with a 403 Forbidden response. No data is returned or modified.

**Scenario 3: Admin Performs Destructive Operation**
- **Actor**: Authenticated user with ADMIN role
- **Goal**: Execute a bulk data operation (e.g., subscription backfill with purge)
- **Steps**:
  1. Admin authenticates and navigates to the relevant feature
  2. Admin initiates the destructive operation
  3. System verifies admin role before executing
- **Expected Outcome**: Operation proceeds only after role verification.

**Scenario 4: Malformed API Request**
- **Actor**: Any authenticated user or external caller
- **Goal**: Send invalid input to an API endpoint
- **Steps**:
  1. User sends a request with malformed JSON or invalid parameters
  2. System validates input against defined schemas
- **Expected Outcome**: User receives a clear 400 Bad Request response with validation details. No internal system information is exposed. No 500 error is thrown.

### Edge Cases

- Race condition during user provisioning: Two concurrent requests for the same new user should not create duplicate profiles (existing upsert logic handles this, but role assignment must still be correct)
- API routes called without any session cookie: Should return 401, not crash
- Cron endpoints called with expired or invalid tokens: Should return 401 with no side effects
- Users who were previously ADMIN and got demoted: Their next request should reflect the updated role, not a cached one
- Existing users with weak legacy passwords: Login form accepts any non-empty password (server authenticates), so these users are not locked out. Strong rules apply only when they next reset or change their password.

---

## Functional Requirements

### Core Requirements

**FR-1: Fix User Auto-Provisioning**
- **Description**: When a user authenticates via Supabase but has no existing profile, the system must deny access entirely. No profile or organization link is created. The user sees a message directing them to contact their administrator for an invitation.
- **Acceptance Criteria**:
  - [ ] Users without a pre-created profile are denied access (getCurrentUser returns null)
  - [ ] No profile or organization membership is auto-created for uninvited users
  - [ ] Denied users see a clear message: "Contact your administrator for an invitation"
  - [ ] Users who were invited (profile pre-created via admin) receive the role assigned during invitation
  - [ ] Existing users with profiles are not affected by this change

**FR-2: Add Authentication and Authorization to API Routes**
- **Description**: All API routes that perform data reads or mutations must verify the user's authentication session and role before processing the request. Routes currently missing these checks must be updated. Destructive operations (purge, migration, deletion) require ADMIN role verification.
- **Acceptance Criteria**:
  - [ ] Mercury connect/disconnect/config endpoints require ADMIN role
  - [ ] Mercury sync status, merchant mappings, and deposit viewing endpoints require ADMIN or EXECUTIVE role
  - [ ] Admin migration endpoint requires ADMIN role
  - [ ] Subscription backfill/purge endpoint requires ADMIN role
  - [ ] Client data export endpoint requires ADMIN or EXECUTIVE role
  - [ ] Notification read/archive endpoints require authentication and organization scoping
  - [ ] Cron endpoints validate their authorization token using timing-safe comparison
  - [ ] All protected endpoints return 401 for missing auth and 403 for insufficient role
  - [ ] User deletion requires ADMIN role (already implemented, verify)
  - [ ] No destructive endpoint can be invoked by non-admin roles

**FR-4: Standardize Error Handling**
- **Description**: Replace all untyped error handlers (`catch (error: any)`) with properly typed error handling (`catch (error: unknown)`) across server actions, API routes, and client components. Error responses must not leak internal system details.
- **Acceptance Criteria**:
  - [ ] Zero instances of `catch (error: any)` remain in the codebase
  - [ ] All error handlers use `error: unknown` with proper type narrowing (`instanceof Error`)
  - [ ] API error responses do not expose internal function names, service names, or stack traces
  - [ ] Client-facing error messages are user-friendly and actionable

**FR-5: Add Input Validation to Critical API Route Parameters**
- **Description**: API routes that accept user-facing query parameters with JSON parsing or complex filter logic must validate input using schema validation before processing. Focus on routes where invalid input currently causes 500 errors rather than 400 responses.
- **Acceptance Criteria**:
  - [ ] Export endpoint validates filter parameters with defined schema before JSON.parse
  - [ ] Malformed JSON in query parameters returns 400 with clear error, not 500
  - [ ] Numeric parameters are validated for range and type
  - [ ] String parameters are validated for maximum length

**FR-6: Unify Password Validation**
- **Description**: Strong password requirements must be enforced on all password creation and reset flows. The login form retains minimal validation (non-empty) to avoid locking out existing users with legacy weak passwords.
- **Acceptance Criteria**:
  - [ ] Password reset form enforces minimum 8-character password with complexity rules (uppercase, lowercase, number)
  - [ ] Invitation acceptance form enforces the same strong password requirements
  - [ ] Login form validates only that password is non-empty (server handles authentication)
  - [ ] All password creation/reset flows use the same shared strong validation schema
  - [ ] Users see clear, specific feedback about which password requirements are not met on creation/reset forms

**FR-7: Add Environment Variable Validation at Startup**
- **Description**: The application must validate that all required environment variables are present and correctly formatted when the server starts, rather than failing at runtime when first accessed.
- **Acceptance Criteria**:
  - [ ] Server fails to start with a clear error message if required environment variables are missing
  - [ ] Required variables include: database connection, authentication keys, and encryption key
  - [ ] Optional integration variables (Xero, Mercury, AWS) are validated only when their features are accessed
  - [ ] Validation runs only on the server, not in client bundles

**FR-8: Replace Raw SQL with Query Builder**
- **Description**: All instances of raw SQL execution must be replaced with the ORM query builder to maintain consistent query safety and auditability.
- **Acceptance Criteria**:
  - [ ] Zero instances of `$executeRawUnsafe` remain in the codebase
  - [ ] Replacement queries produce identical results to the original raw SQL
  - [ ] No new raw SQL is introduced

---

## Success Criteria

### Measurable Outcomes

- [ ] **Security**: No authenticated user can access or modify data outside their authorized role
- [ ] **Access Control**: 100% of API routes that handle sensitive data enforce role verification
- [ ] **Input Safety**: Critical API endpoints with JSON parsing return 400 (not 500) for malformed input
- [ ] **Code Quality**: Zero instances of `catch (error: any)` or `$executeRawUnsafe` in the codebase
- [ ] **User Experience**: Password creation/reset forms enforce consistent strong requirements with clear feedback; login form does not block existing users
- [ ] **Reliability**: Application fails fast at startup with clear messages when required configuration is missing
- [ ] **Privilege Escalation**: No path exists for a user to obtain higher privileges than explicitly assigned by an administrator

---

## Dependencies

### External Dependencies

- Supabase Auth service (existing - no changes needed)
- Prisma ORM (existing - using query builder instead of raw SQL)

### Internal Dependencies

- Existing role-based helper functions (`requireAuth`, `requireAdmin`, `requireAgencyAdmin`, `requireContractor`, `requireBDR`) in `lib/auth/helpers.ts`
- Existing Zod validation patterns in `lib/validations/`
- Existing user invitation flow in `app/actions/user-management.ts`

---

## Assumptions

- The six existing user roles (ADMIN, EXECUTIVE, ANALYST, AGENCY_ADMIN, CONTRACTOR, BDR) are sufficient and no new roles need to be created
- The existing `requireAuth()` / `requireAdmin()` helper functions are correctly implemented and can be reused in API routes
- Supabase handles its own rate limiting for authentication attempts (application-level rate limiting is out of scope for this feature)
- The `.env` secrets rotation is handled as a separate operational task, not part of this code change
- The existing middleware correctly refreshes Supabase sessions and this behavior should not change

---

## Out of Scope

- Rotating compromised secrets (operational task, not code change)
- Scrubbing `.env` from git history (operational task)
- Adding application-level rate limiting (separate feature requiring Redis/Upstash setup)
- Implementing audit logging infrastructure (separate feature)
- Adding Supabase Row-Level Security policies (separate feature)
- Adding ESLint configuration (separate tooling task)
- Adding unit test coverage (separate quality initiative)
- Performance optimizations (React memoization, Next.js Image, database indexes)
- Accessibility improvements

---

## Security & Privacy Considerations

- **Privilege Escalation**: The auto-provisioning fix is the highest-priority item as it currently grants admin access to any authenticated user
- **Data Privacy**: Role-based access control ensures contractors cannot see agency margin data, and analysts cannot export unvetted projections
- **Access Control**: Every endpoint handling financial data must verify the caller's role matches the required permission level
- **Error Information Disclosure**: Error responses must not reveal internal architecture details (Lambda function names, database structure, service endpoints)
- **Input Validation**: All user-supplied input must be validated to prevent injection attacks and unexpected server errors

---

## Future Enhancements

- Application-level rate limiting with Redis/Upstash
- Comprehensive audit logging for all mutation operations
- Supabase Row-Level Security as defense-in-depth
- Session timeout and forced re-authentication for sensitive operations
- IP-based access restrictions for admin endpoints
