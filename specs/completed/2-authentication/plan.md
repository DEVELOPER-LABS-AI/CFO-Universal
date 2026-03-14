# Implementation Plan: Authentication & Admin User Management

**Feature**: Authentication & Admin User Management
**Branch**: 2-authentication
**Created**: 2026-02-13
**Status**: Planning Complete

---

## Executive Summary

This plan details the implementation of a secure, internal authentication system with admin-managed user access for the DevLabs CFO executive dashboard. The system will provide invitation-only user creation, magic link authentication, role-based access control (RBAC), and comprehensive audit logging.

**Key Deliverables:**
- Enhanced database schema with user_profiles and audit_logs tables
- Next.js middleware for authentication and RBAC enforcement
- Admin user management UI with invite, edit, deactivate, and delete operations
- Server Actions for secure user management operations
- Magic link invitation and password reset flows
- Comprehensive audit logging for compliance

**Estimated Complexity**: Medium-High (5-7 days)

---

## Technical Context

### Technology Stack

**Authentication Layer:**
- **Supabase Auth**: User credential management, JWT issuance, magic link generation
- **Next.js 16 Middleware**: Route protection, role verification, session validation
- **JWT (httpOnly cookies)**: Stateless session management with XSS protection

**Database Layer:**
- **Prisma**: Schema management for user_profiles and audit_logs
- **PostgreSQL (Supabase)**: User profile storage with RLS policies
- **Supabase Auth Schema**: Core authentication (managed by Supabase)

**Email Services:**
- **Supabase Email**: Built-in email service for invitations and password reset
- **Future SMTP**: Prepared for custom email provider migration (SendGrid, Postmark)

**Development Tools:**
- **TypeScript Strict Mode**: Type-safe auth utilities and server actions
- **Zod**: Form validation and API response schemas
- **Server Actions**: Secure mutations with built-in CSRF protection

### Architecture Decisions

**Decision 1: Supabase Auth Admin API for Invitations**
- **Rationale**: Built-in magic link generation, secure token handling, automatic expiration
- **Implementation**: Use `auth.admin.generateLink({ type: 'magiclink' })` for invitations
- **Alternative Considered**: Custom JWT tokens (rejected - reinventing wheel, less secure)

**Decision 2: Hybrid RBAC (Database + JWT Claims)**
- **Rationale**: Fast middleware checks via JWT, database verification for mutations
- **Implementation**:
  - `user_profiles.role` is single source of truth
  - Sync role to JWT `app_metadata` on login
  - Middleware reads JWT for quick route protection
  - Server Actions re-verify role via database query
- **Trade-off**: Slight complexity, but balances performance and security

**Decision 3: Status Check in Middleware for Immediate Revocation**
- **Rationale**: Deactivated users blocked on next request (immediate effect)
- **Implementation**: Middleware queries `user_profiles.status` on every authenticated request
- **Performance**: <10ms database query, acceptable for internal tool (5-50 users)
- **Alternative Considered**: JWT revocation list (rejected - complex, overkill)

**Decision 4: Dedicated audit_logs Table**
- **Rationale**: Compliance-ready, searchable, immutable record of admin actions
- **Implementation**: JSONB field for flexible action details (before/after snapshots)
- **Retention**: Indefinite (compliance requirement - 7+ years)

**Decision 5: Start with Supabase Email, Prepare for Custom SMTP**
- **Rationale**: Fastest MVP, low email volume for internal tool
- **Implementation**: Configure Supabase templates, add SMTP env vars for future migration
- **Migration Path**: Switch to SendGrid if deliverability issues arise

### Integration Points

**Supabase Auth Integration:**
- `auth.admin.createUser()` - Create user programmatically during invitation
- `auth.admin.generateLink()` - Generate magic link for invitation/password reset
- `auth.admin.updateUserById()` - Update email or metadata
- `auth.admin.deleteUser()` - Permanently remove user from auth system

**Next.js App Integration:**
- Middleware protects `/dashboard/*` routes (requires authentication)
- Middleware protects `/dashboard/admin/*` routes (requires admin role)
- Server Actions handle all user management mutations
- Public routes: `/login`, `/forgot-password`, `/reset-password`, `/invite-accept`

**Email Templates:**
- Magic link invitation: "You've been invited to DevLabs CFO"
- Password reset: "Reset your DevLabs CFO password"
- Role change notification: "Your role has been updated"

### Constitution Compliance Check

**Mandatory Requirements:**
- ✅ Using Supabase Auth (aligns with Supabase PostgreSQL stack)
- ✅ Using Prisma for schema management (user_profiles, audit_logs)
- ✅ Multi-tenancy: All users belong to single organization (internal tool)
- ✅ UUID primary keys for new tables
- ✅ Timestamps (created_at, updated_at) on all tables
- ✅ Soft deletes not needed (user deletion is hard delete by design)

**Security Requirements:**
- ✅ JWT tokens in httpOnly cookies (XSS protection)
- ✅ Row Level Security policies for user_profiles and audit_logs
- ✅ Service role access only in Server Actions (never client-side)
- ✅ Passwords encrypted via Supabase Auth (bcrypt)
- ✅ Rate limiting on login and password reset endpoints
- ✅ Magic link tokens cryptographically secure (UUID v4)

**Performance Standards:**
- ✅ Login: <2s (credential validation to dashboard)
- ✅ Middleware check: <50ms (JWT validation + status check)
- ✅ Password reset: <5 minutes (email delivery to password set)
- ✅ Supports internal scale (5-50 users, 10-20 concurrent sessions)

**Code Quality:**
- ✅ TypeScript strict mode enabled
- ✅ Prisma-generated types for user_profiles and audit_logs
- ✅ Zod validation for all forms and API responses
- ✅ Server-side validation for all mutations

**No Constitution Violations**: All requirements satisfied. Single-organization design aligns with internal tool use case.

---

## Phase 0: Research & Decisions (COMPLETED)

### Research Tasks Completed

See [research.md](./research.md) for complete findings.

**Key Decisions:**
1. ✅ Magic links via Supabase Auth Admin API
2. ✅ Hybrid RBAC (database source of truth + JWT claims)
3. ✅ Middleware status check for immediate deactivation
4. ✅ Dedicated audit_logs table with JSONB details
5. ✅ Supabase Email for MVP (SMTP env vars prepared)
6. ✅ SQL script for initial admin bootstrap

**Resolved Unknowns:**
- ✅ How to revoke sessions immediately → Middleware status check
- ✅ How to sync role to JWT → Server Action on login
- ✅ How to prevent last admin deletion → Validation in Server Action
- ✅ How to bootstrap first admin → SQL script with documentation

---

## Phase 1: Database Schema Updates

### Goals
- Extend user_profiles table with authentication fields
- Create audit_logs table for compliance
- Add database indexes for performance
- Apply RLS policies for security

### Prerequisites
- Phase 0 (Database Schema) completed
- Prisma configured and connected to Supabase

### Tasks

**Task 1.1: Update Prisma Schema for user_profiles**

Add authentication fields to existing user_profiles table:

```prisma
model user_profiles {
  user_id            String    @id @db.Uuid // Links to Supabase auth.users.id
  organization_id    String    @db.Uuid // FK to organizations
  full_name          String    @db.VarChar(100)
  role               UserRole  @default(EXECUTIVE) // admin, executive, analyst
  status             UserStatus @default(INACTIVE) // active, inactive
  last_login         DateTime?
  invite_token       String?   @db.Uuid // For magic link invitations
  invite_expires_at  DateTime?
  preferences        Json?     // theme, notifications, etc.
  created_at         DateTime  @default(now())
  updated_at         DateTime  @updatedAt

  // Relations
  organization       organizations @relation(fields: [organization_id], references: [id])
  audit_logs_actor   audit_logs[]  @relation("actor")
  audit_logs_target  audit_logs[]  @relation("target")

  @@index([user_id])
  @@index([organization_id])
  @@index([status])
  @@index([role])
  @@map("user_profiles")
}

enum UserRole {
  ADMIN
  EXECUTIVE
  ANALYST
}

enum UserStatus {
  ACTIVE
  INACTIVE
}
```

**Task 1.2: Create audit_logs Table**

```prisma
model audit_logs {
  id              String      @id @default(uuid()) @db.Uuid
  organization_id String      @db.Uuid
  actor_id        String      @db.Uuid // Admin who performed action
  target_user_id  String?     @db.Uuid // User affected (nullable for system actions)
  action_type     AuditAction
  action_details  Json        // Before/after values, specific changes
  ip_address      String?     @db.VarChar(45) // IPv6 max length
  created_at      DateTime    @default(now())

  // Relations
  organization    organizations @relation(fields: [organization_id], references: [id])
  actor           user_profiles @relation("actor", fields: [actor_id], references: [user_id])
  target_user     user_profiles? @relation("target", fields: [target_user_id], references: [user_id])

  @@index([created_at(sort: Desc)])
  @@index([actor_id])
  @@index([action_type])
  @@index([organization_id])
  @@map("audit_logs")
}

enum AuditAction {
  USER_CREATED
  USER_EDITED
  USER_DELETED
  USER_DEACTIVATED
  USER_REACTIVATED
  ROLE_CHANGED
  PASSWORD_RESET
}
```

**Task 1.3: Create Database Migration**

```bash
npx prisma migrate dev --name add_user_profiles_and_audit_logs
```

**Task 1.4: Apply RLS Policies**

Create `prisma/rls-auth-policies.sql`:

```sql
-- User Profiles RLS
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_isolation_user_profiles" ON user_profiles
  FOR ALL
  USING (
    organization_id = (
      SELECT organization_id FROM user_profiles WHERE user_id = auth.uid()
    )
  );

-- Audit Logs RLS
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_isolation_audit_logs" ON audit_logs
  FOR ALL
  USING (
    organization_id = (
      SELECT organization_id FROM user_profiles WHERE user_id = auth.uid()
    )
  );

-- Admin-only write access to user_profiles
CREATE POLICY "admin_write_user_profiles" ON user_profiles
  FOR INSERT, UPDATE, DELETE
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_id = auth.uid()
      AND role = 'ADMIN'
    )
  );
```

Apply policies:
```bash
psql $DATABASE_URL < prisma/rls-auth-policies.sql
```

**Task 1.5: Generate Updated Prisma Client**

```bash
npx prisma generate
```

### Verification Criteria
- ✅ Migration generates SQL for user_profiles and audit_logs
- ✅ All columns and indexes created successfully
- ✅ Prisma Client includes UserRole, UserStatus, AuditAction enums
- ✅ TypeScript autocomplete shows new fields
- ✅ RLS policies prevent cross-org data access
- ✅ Test query returns empty result for different organization

### Parallelization Opportunities
None - all tasks are sequential (schema → migration → RLS → client generation)

---

## Phase 2: Authentication Utilities & Helpers

### Goals
- Create type-safe auth utilities
- Implement JWT role synchronization
- Build reusable middleware helpers
- Create audit logging utilities

### Prerequisites
- Phase 1 (Database Schema) completed
- Supabase Auth environment variables configured

### Tasks

**Task 2.1: Create Supabase Server Client Utilities**

File: `lib/supabase/server.ts`

```typescript
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export function createClient() {
  const cookieStore = cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
        set(name: string, value: string, options: any) {
          cookieStore.set({ name, value, ...options })
        },
        remove(name: string, options: any) {
          cookieStore.delete({ name, ...options })
        },
      },
    }
  )
}
```

**Task 2.2: Create Supabase Admin Client**

File: `lib/supabase/admin.ts`

```typescript
import { createClient } from '@supabase/supabase-js'

// IMPORTANT: Use service role key - server-side only, never expose to client
export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
)
```

**Task 2.3: Create Auth Helper Functions**

File: `lib/auth/helpers.ts`

```typescript
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import type { UserRole, UserStatus } from '@prisma/client'

export interface AuthUser {
  userId: string
  email: string
  role: UserRole
  status: UserStatus
  organizationId: string
  fullName: string
}

/**
 * Get current authenticated user with profile data
 * Returns null if not authenticated
 */
export async function getCurrentUser(): Promise<AuthUser | null> {
  const supabase = createClient()

  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return null

  const profile = await prisma.user_profiles.findUnique({
    where: { user_id: user.id },
    include: { organization: true }
  })

  if (!profile) return null

  return {
    userId: user.id,
    email: user.email!,
    role: profile.role,
    status: profile.status,
    organizationId: profile.organization_id,
    fullName: profile.full_name
  }
}

/**
 * Check if current user has admin role
 */
export async function isAdmin(): Promise<boolean> {
  const user = await getCurrentUser()
  return user?.role === 'ADMIN' && user?.status === 'ACTIVE'
}

/**
 * Require authentication - throw if not authenticated
 */
export async function requireAuth(): Promise<AuthUser> {
  const user = await getCurrentUser()
  if (!user) throw new Error('Unauthorized')
  if (user.status !== 'ACTIVE') throw new Error('Account inactive')
  return user
}

/**
 * Require admin role - throw if not admin
 */
export async function requireAdmin(): Promise<AuthUser> {
  const user = await requireAuth()
  if (user.role !== 'ADMIN') throw new Error('Forbidden - admin access required')
  return user
}
```

**Task 2.4: Sync Role to JWT on Login**

File: `lib/auth/sync-metadata.ts`

```typescript
import { supabaseAdmin } from '@/lib/supabase/admin'
import { prisma } from '@/lib/prisma'

/**
 * Sync user role from database to JWT app_metadata
 * Called on login to ensure JWT contains latest role
 */
export async function syncRoleToJWT(userId: string): Promise<void> {
  const profile = await prisma.user_profiles.findUnique({
    where: { user_id: userId }
  })

  if (!profile) throw new Error('User profile not found')

  // Update Supabase Auth user metadata with role
  await supabaseAdmin.auth.admin.updateUserById(userId, {
    app_metadata: {
      role: profile.role,
      organization_id: profile.organization_id
    }
  })

  // Update last_login timestamp
  await prisma.user_profiles.update({
    where: { user_id: userId },
    data: { last_login: new Date() }
  })
}
```

**Task 2.5: Create Audit Logging Utility**

File: `lib/audit/logger.ts`

```typescript
import { prisma } from '@/lib/prisma'
import type { AuditAction } from '@prisma/client'

interface AuditLogInput {
  organizationId: string
  actorId: string
  targetUserId?: string
  actionType: AuditAction
  actionDetails: Record<string, any>
  ipAddress?: string
}

/**
 * Create immutable audit log entry
 */
export async function createAuditLog(input: AuditLogInput): Promise<void> {
  await prisma.audit_logs.create({
    data: {
      organization_id: input.organizationId,
      actor_id: input.actorId,
      target_user_id: input.targetUserId,
      action_type: input.actionType,
      action_details: input.actionDetails,
      ip_address: input.ipAddress
    }
  })
}

/**
 * Helper to extract IP address from request
 */
export function getIPAddress(request: Request): string | undefined {
  return request.headers.get('x-forwarded-for')?.split(',')[0].trim()
    || request.headers.get('x-real-ip')
    || undefined
}
```

### Verification Criteria
- ✅ `getCurrentUser()` returns user data with role and status
- ✅ `requireAdmin()` throws for non-admin users
- ✅ `syncRoleToJWT()` updates app_metadata in Supabase Auth
- ✅ `createAuditLog()` inserts record into audit_logs table
- ✅ TypeScript types match Prisma schema
- ✅ All utilities handle errors gracefully

### Parallelization Opportunities
Tasks 2.1-2.5 can be implemented in parallel (independent utilities)

---

## Phase 3: Next.js Middleware for Route Protection

### Goals
- Implement authentication check on protected routes
- Enforce RBAC for admin routes
- Check user status (active/inactive)
- Redirect unauthenticated users to login

### Prerequisites
- Phase 2 (Auth Utilities) completed
- Next.js 16 middleware configured

### Tasks

**Task 3.1: Create Middleware Configuration**

File: `middleware.ts` (root of project)

```typescript
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function middleware(request: NextRequest) {
  const response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value
        },
        set(name: string, value: string, options: any) {
          response.cookies.set({ name, value, ...options })
        },
        remove(name: string, options: any) {
          response.cookies.delete({ name, ...options })
        },
      },
    }
  )

  // Refresh session if needed
  const { data: { user }, error } = await supabase.auth.getUser()

  const pathname = request.nextUrl.pathname

  // Public routes (no auth required)
  const publicRoutes = ['/login', '/forgot-password', '/reset-password', '/invite-accept']
  if (publicRoutes.some(route => pathname.startsWith(route))) {
    return response
  }

  // Require authentication for all other routes
  if (!user) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('redirect', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // Check user status and role for protected routes
  const profile = await prisma.user_profiles.findUnique({
    where: { user_id: user.id },
    select: { role: true, status: true }
  })

  if (!profile) {
    // User exists in auth but not in user_profiles (data inconsistency)
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('error', 'profile_not_found')
    return NextResponse.redirect(loginUrl)
  }

  // Block inactive users
  if (profile.status !== 'ACTIVE') {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('error', 'account_inactive')
    await supabase.auth.signOut()
    return NextResponse.redirect(loginUrl)
  }

  // Admin route protection
  if (pathname.startsWith('/dashboard/admin')) {
    if (profile.role !== 'ADMIN') {
      const dashboardUrl = new URL('/dashboard', request.url)
      dashboardUrl.searchParams.set('error', 'admin_required')
      return NextResponse.redirect(dashboardUrl)
    }
  }

  return response
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (public folder)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
```

**Task 3.2: Create Redirect Helper**

File: `lib/auth/redirect.ts`

```typescript
import { redirect } from 'next/navigation'

export function redirectToLogin(currentPath?: string) {
  const params = new URLSearchParams()
  if (currentPath) params.set('redirect', currentPath)
  redirect(`/login?${params.toString()}`)
}

export function redirectToDashboard(message?: string) {
  const params = new URLSearchParams()
  if (message) params.set('message', message)
  redirect(`/dashboard?${params.toString()}`)
}
```

**Task 3.3: Handle Edge Runtime Compatibility**

Ensure Prisma works in Edge Runtime:

File: `lib/prisma-edge.ts`

```typescript
// Edge-compatible Prisma client for middleware
import { PrismaClient } from '@prisma/client/edge'
import { withAccelerate } from '@prisma/extension-accelerate'

const globalForPrisma = global as unknown as { prismaEdge: PrismaClient }

export const prismaEdge = globalForPrisma.prismaEdge ||
  new PrismaClient().$extends(withAccelerate())

if (process.env.NODE_ENV !== 'production') globalForPrisma.prismaEdge = prismaEdge
```

Update middleware to use `prismaEdge` instead of `prisma`.

### Verification Criteria
- ✅ Unauthenticated users redirected to /login
- ✅ Inactive users logged out and redirected
- ✅ Non-admin users blocked from /dashboard/admin/*
- ✅ Deep links preserved via redirect parameter
- ✅ Middleware runs on all protected routes
- ✅ No performance degradation (<50ms middleware execution)

### Parallelization Opportunities
None - middleware is a single integrated component

---

## Phase 4: Server Actions for User Management

### Goals
- Implement secure user CRUD operations
- Add audit logging to all admin actions
- Validate business rules (last admin protection)
- Handle magic link generation

### Prerequisites
- Phase 2 (Auth Utilities) and Phase 3 (Middleware) completed

### Tasks

See [data-model.md](./data-model.md) for complete Server Actions implementation including:
- Task 4.1: Create User (Invitation Flow)
- Task 4.2: Update User
- Task 4.3: Deactivate/Reactivate User
- Task 4.4: Delete User
- Task 4.5: Send Password Reset
- Task 4.6: Login Action with Role Sync
- Task 4.7: Logout Action

### Verification Criteria
- ✅ All Server Actions require authentication/authorization
- ✅ Audit logs created for every admin action
- ✅ Last admin cannot be deleted or demoted
- ✅ Admin cannot delete/deactivate themselves
- ✅ Magic links generated successfully
- ✅ Role synced to JWT on login
- ✅ All inputs validated with Zod
- ✅ TypeScript types enforced

### Parallelization Opportunities
Tasks 4.1-4.5 (CRUD operations) can be implemented in parallel
Tasks 4.6-4.7 (login/logout) can be implemented in parallel

---

## Phase 5: Admin User Management UI

### Goals
- Create admin user list table with search/filter
- Build user creation modal with form
- Implement edit, deactivate, delete actions
- Add audit log viewer
- Build public auth pages (login, password reset, invite accept)

### Prerequisites
- Phase 4 (Server Actions) completed
- shadcn/ui components installed

### Tasks

**Task 5.1: User List Page** - `app/dashboard/admin/users/page.tsx`
**Task 5.2: Add User Modal** - `app/dashboard/admin/users/components/AddUserModal.tsx`
**Task 5.3: Edit User Modal** - `app/dashboard/admin/users/components/EditUserModal.tsx`
**Task 5.4: User Actions Dropdown** - `app/dashboard/admin/users/components/UserActionsDropdown.tsx`
**Task 5.5: Audit Log Viewer** - `app/dashboard/admin/audit-logs/page.tsx`
**Task 5.6: Login Page** - `app/login/page.tsx`
**Task 5.7: Forgot Password Page** - `app/forgot-password/page.tsx`
**Task 5.8: Reset Password Page** - `app/reset-password/page.tsx`
**Task 5.9: Invite Accept Page** - `app/invite-accept/page.tsx`

### Verification Criteria
- ✅ User list displays all users with correct data
- ✅ Search and filters work correctly
- ✅ Add user modal creates user and sends invitation
- ✅ Edit user modal updates user data
- ✅ Deactivate/reactivate actions work
- ✅ Delete requires email confirmation
- ✅ Audit logs display admin actions
- ✅ Login redirects based on role
- ✅ Password reset flow works end-to-end
- ✅ Invite acceptance activates user
- ✅ All forms validate inputs
- ✅ Error states handled gracefully

### Parallelization Opportunities
Tasks 5.1-5.5 (admin pages) can be built in parallel
Tasks 5.6-5.9 (public auth pages) can be built in parallel

---

## Phase 6: Testing & Validation

### Goals
- Test all user management flows
- Verify RBAC enforcement
- Test edge cases and error handling
- Performance testing

### Prerequisites
- All previous phases completed

### Tasks

**Task 6.1: Unit Tests for Auth Utilities**
**Task 6.2: Integration Tests for Server Actions**
**Task 6.3: E2E Tests for User Flows**
**Task 6.4: RBAC Enforcement Tests**
**Task 6.5: Edge Case Tests**
**Task 6.6: Performance Tests**
**Task 6.7: Security Audit**

### Verification Criteria
- ✅ All unit tests pass
- ✅ All integration tests pass
- ✅ All E2E tests pass
- ✅ RBAC tests pass
- ✅ Edge case tests pass
- ✅ Performance benchmarks met
- ✅ Security audit passes

### Parallelization Opportunities
All test suites can run in parallel

---

## Phase 7: Documentation & Deployment

### Goals
- Document setup process
- Create admin user bootstrap script
- Update environment variables
- Deploy and verify production

### Prerequisites
- Phase 6 (Testing) completed

### Tasks

**Task 7.1: Create Admin Bootstrap Script** - `docs/setup-initial-admin.sql`
**Task 7.2: Environment Variables Documentation** - `docs/environment-setup.md`
**Task 7.3: API Documentation** - `docs/api-auth.md`
**Task 7.4: User Guide** - `docs/user-management-guide.md`
**Task 7.5: Update README**
**Task 7.6: Deploy to Production**
**Task 7.7: Post-Deployment Verification**

### Verification Criteria
- ✅ Bootstrap script documented
- ✅ Environment variables documented
- ✅ API documentation complete
- ✅ User guide written
- ✅ README updated
- ✅ Production deployment successful
- ✅ Initial admin user created
- ✅ All flows verified in production

### Parallelization Opportunities
Tasks 7.1-7.5 (documentation) can be written in parallel
Task 7.6-7.7 (deployment) must be sequential

---

## Success Criteria

**Functional Requirements:**
- ✅ Admin can invite users via email magic link
- ✅ Users can accept invitation and set password
- ✅ Users can log in with email/password
- ✅ Users can reset forgotten passwords
- ✅ Admin can view, edit, deactivate, delete users
- ✅ Role-based access control enforced
- ✅ User status (active/inactive) enforced
- ✅ Last admin cannot be deleted or demoted
- ✅ Admin cannot delete themselves
- ✅ All admin actions logged to audit_logs

**Performance Targets:**
- ✅ Login: <2 seconds
- ✅ Middleware auth check: <50ms
- ✅ Password reset: <5 minutes
- ✅ User deactivation: Immediate (next request)
- ✅ Audit log query: <500ms for 1000 entries

**Security Requirements:**
- ✅ Passwords encrypted (Supabase bcrypt)
- ✅ JWT tokens in httpOnly cookies
- ✅ Service role key never exposed to client
- ✅ RLS policies enforce organization isolation
- ✅ Rate limiting on login/password reset
- ✅ Generic error messages prevent user enumeration
- ✅ Magic links expire after 24 hours
- ✅ Tokens single-use and invalidated after use

**Quality Standards:**
- ✅ All unit tests pass
- ✅ All integration tests pass
- ✅ All E2E tests pass
- ✅ TypeScript strict mode, no errors
- ✅ Zod validation on all inputs
- ✅ Error handling for all edge cases
- ✅ Documentation complete

---

## Risk Mitigation

| Risk | Mitigation Strategy |
|------|---------------------|
| **Admin account lockout** | Prevent deletion of last admin, document password reset process |
| **Email delivery failures** | Use reliable Supabase email, prepare SMTP fallback |
| **Session not revoked fast enough** | Middleware checks status on every request (immediate) |
| **Audit log storage growth** | Small logs (~1 KB each), 10K actions = ~10 MB (negligible) |
| **Magic link phishing** | Links expire in 24h, single-use, educate users |
| **Brute force attacks** | Rate limiting, account lockout, monitoring |
| **JWT token compromise** | httpOnly cookies, short expiration, re-verify on mutations |
| **Middleware performance** | Lightweight query (<10ms), edge runtime optimization |

---

## Next Steps

**Ready for Implementation:**
1. Run `/speckit.tasks` to generate actionable task checklist
2. Create feature branch: `2-authentication`
3. Begin Phase 1: Database Schema Updates

**Future Enhancements:**
- Two-factor authentication (2FA)
- Single Sign-On (SSO) integration
- Session management dashboard
- Login history tracking
- Custom email templates
- IP whitelisting
- Bulk user import via CSV

---

## References

- [Feature Specification](./spec.md)
- [Research & Technical Decisions](./research.md)
- [Data Model](./data-model.md)
- [Project Constitution](../../.specify/memory/constitution.md)
- [Supabase Auth Documentation](https://supabase.com/docs/guides/auth)
- [Next.js Middleware Guide](https://nextjs.org/docs/app/building-your-application/routing/middleware)
- [OWASP Authentication Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html)
