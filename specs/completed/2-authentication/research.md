# Research: Authentication & Admin User Management

**Feature**: Authentication & Admin User Management
**Branch**: 2-authentication
**Created**: 2026-02-12
**Last Updated**: 2026-02-13

---

## Overview

This document captures research findings and technical decisions for implementing an internal authentication system with admin-managed user access for the DevLabs CFO executive dashboard.

---

## Research Areas

### 1. Magic Link Authentication Pattern

**Question**: What's the best approach for secure, one-time magic link invitations?

**Research Findings**:

**Industry Best Practices**:
- Magic links should use cryptographically secure random tokens (UUID v4 or better)
- Tokens must be single-use and time-limited (typically 15 minutes to 24 hours)
- Tokens stored hashed in database for security
- Email delivery should use authenticated SMTP with SPF/DKIM
- Links should expire after first use to prevent replay attacks

**Supabase Auth Support**:
- Supabase Auth natively supports magic link authentication via `auth.signInWithOtp()`
- Built-in token generation using secure random (cryptographically safe)
- Automatic token expiration and validation
- Email templates configurable in Supabase dashboard
- Works with both email and phone (SMS) delivery

**Alternative Approaches Considered**:
1. **Custom JWT tokens**: More complex, requires manual expiration handling
2. **Temporary passwords**: Less secure, requires password rotation
3. **OAuth-style authorization codes**: Overkill for internal tool

**Decision**: Use Supabase Auth's `auth.admin.generateLink()` for admin-initiated invitations
- **Rationale**: Built-in security, automatic expiration, email delivery included, admin API perfect for invitation flow
- **Implementation**:
  - `auth.admin.generateLink({ type: 'magiclink', email })` for invitations
  - Store invite status in `user_profiles.invite_token` and `invite_expires_at` for tracking
  - Token expiration: 24 hours (configurable in Supabase settings)
  - Single-use enforcement via `invite_token` nullification after use

---

### 2. Role-Based Access Control (RBAC) Implementation

**Question**: How to implement RBAC with Supabase Auth and Next.js middleware?

**Research Findings**:

**Supabase Auth Metadata**:
- User metadata stored in `auth.users.user_metadata` (client-accessible)
- App metadata stored in `auth.users.app_metadata` (server-only, included in JWT)
- Custom claims can be added to JWT via database triggers or admin API
- Metadata persists across sessions and survives password changes

**Next.js 16 Middleware RBAC Patterns**:
- Middleware runs on every request before page render
- Can check JWT claims for role information
- Redirect non-authorized users before component rendering
- Edge runtime compatible (no Node.js APIs)

**Implementation Pattern**:
```typescript
// Store role in user_profiles table (source of truth)
// Sync role to JWT app_metadata on login via Server Action
// Middleware reads role from JWT, enforces access control
// Server Actions re-verify role against database for mutations
```

**Best Practices**:
1. **Single Source of Truth**: Store role in `user_profiles.role` field
2. **JWT Claims Sync**: Update `app_metadata.role` on login via Server Action
3. **Middleware Check**: Read `user.app_metadata.role`, redirect if unauthorized
4. **API Verification**: Re-verify role via database query (don't trust JWT alone for mutations)
5. **Audit Trail**: Log all admin actions with actor, target, action type

**Decision**: Hybrid approach - database source of truth + JWT claims for performance
- **Rationale**: Fast middleware checks via JWT, verified in API layer via database
- **Implementation**:
  - `user_profiles.role` as authoritative source
  - Sync to JWT `app_metadata` on login
  - Middleware uses JWT for quick route protection
  - Server Actions verify against database before mutations
  - Audit log for all privileged operations

---

### 3. User Status Management (Active/Inactive)

**Question**: How to immediately revoke access when admin deactivates a user?

**Research Findings**:

**Supabase Auth Session Management**:
- Sessions stored as JWT tokens in cookies (stateless)
- No built-in "kill switch" for active sessions
- JWT tokens valid until expiration (7-30 days default)
- User ban requires updating `auth.users.banned_until` field

**Session Revocation Strategies**:

**Option A: Supabase Banned Until**
- Set `auth.users.banned_until = future_date` to block login
- Existing sessions remain valid until natural expiration
- **Downside**: Active sessions not immediately revoked

**Option B: JWT Revocation List**
- Maintain list of revoked token IDs in database
- Check on every request in middleware
- **Downside**: Database query on every page load (performance hit)

**Option C: Hybrid - Status Check + Short Session Expiry**
- Store `user_profiles.status = 'inactive'`
- Middleware checks status on protected routes
- Use shorter session expiration for faster revocation
- **Downside**: User could stay logged in for up to session TTL

**Option D: Database Query in Middleware**
- Middleware calls lightweight query to check status
- Query uses indexed `user_id` column
- Cache result briefly (1 minute) at edge
- **Downside**: Extra database call, but negligible for internal tool

**Decision**: Option C (Hybrid) with middleware status check
- **Rationale**: Balances UX (long sessions) with security (immediate revocation on next request)
- **Implementation**:
  - Default session: 7 days
  - Remember me: 30 days
  - Middleware checks `user_profiles.status` on every authenticated request
  - Inactive users redirected to login with "Account deactivated" message
  - Admin sets status='inactive' → user's next request triggers middleware → immediate logout
  - For internal tool with 5-50 users, extra DB query is negligible (<10ms)

---

### 4. Audit Logging for Compliance

**Question**: What should be logged and how to structure audit logs?

**Research Findings**:

**Compliance Requirements** (GDPR, SOC 2):
- **Who**: User who performed action
- **What**: Action type and details
- **When**: Timestamp (UTC)
- **Where**: IP address (optional)
- **Target**: User/resource affected
- **Result**: Success or failure

**Audit Log Best Practices**:
1. **Immutable**: Never delete audit logs (append-only)
2. **Tamper-proof**: Consider cryptographic signatures for critical systems
3. **Searchable**: Index by timestamp, actor, action type
4. **Retention**: Keep indefinitely or per compliance requirements (7+ years)
5. **Privacy**: Don't log passwords or sensitive PII

**PostgreSQL Audit Table Design**:
```sql
audit_logs table:
- id (uuid, primary key)
- actor_id (user who performed action)
- target_user_id (user affected)
- action_type (enum: user_created, user_deleted, etc.)
- action_details (jsonb: before/after values)
- ip_address (text, optional)
- created_at (timestamp, immutable)
```

**Decision**: Dedicated `audit_logs` table with structured logging
- **Rationale**: Compliance-ready, searchable, future-proof for security reviews
- **Implementation**:
  - Log all admin actions: user create, edit, delete, deactivate, reactivate, role change, password reset
  - Store in dedicated `audit_logs` Prisma model
  - Use `jsonb` for flexible action_details (before/after snapshots)
  - Index on `created_at`, `actor_id`, `action_type` for fast queries
  - Future: Admin dashboard to view audit trail

---

### 5. Email Service for Invitations and Password Reset

**Question**: Use Supabase email service or custom SMTP?

**Research Findings**:

**Supabase Email Service**:
- **Pros**: Built-in, zero config, works out of the box, handles auth emails automatically
- **Cons**: Limited customization, shared IP (potential deliverability issues), rate limits
- **Limits**:
  - Free tier: 60 emails/hour
  - Pro tier: Custom limits
- **Customization**: Email templates editable in Supabase dashboard

**Custom SMTP (SendGrid, Postmark, AWS SES)**:
- **Pros**: Full control, dedicated IP, better deliverability, custom branding
- **Cons**: Requires setup, API keys, additional cost, email template management
- **Cost**:
  - SendGrid: Free tier 100 emails/day, paid from $15/month
  - Postmark: $15/month for 10K emails
  - AWS SES: $0.10 per 1,000 emails

**Decision**: Start with Supabase email, prepare for custom SMTP if needed
- **Rationale**: Fastest time to MVP, internal tool has low email volume (<100 emails/month)
- **Implementation**:
  - Configure Supabase email templates for branding
  - Use `auth.admin.generateLink()` for magic links
  - Add `SMTP_*` environment variables for future migration
  - Future: Switch to SendGrid if deliverability issues arise

---

### 6. Initial Admin Bootstrapping

**Question**: How to create the first admin user securely?

**Research Findings**:

**Common Approaches**:

**Option A: Supabase Dashboard Manual Creation**
- Create user in Supabase Auth UI
- Manually insert `user_profiles` record via SQL editor
- **Downside**: Error-prone, not reproducible

**Option B: Seed Script**
- Include in `prisma/seed.ts`
- Run via `npm run db:seed`
- **Downside**: Credentials in codebase (security risk)

**Option C: SQL Script with Supabase SQL Editor**
- Provide documented SQL script
- Admin runs once during setup
- Uses Supabase Admin API to create user
- **Benefit**: Secure, reproducible, standard practice

**Decision**: SQL Script (Option C) with documented instructions
- **Rationale**: Secure, reproducible, standard for backend systems
- **Implementation**:
  - Provide `docs/setup-admin.sql` script
  - Use Supabase Auth Admin API to create user
  - Insert `user_profiles` record with role='admin', status='active'
  - Document in `quickstart.md` with step-by-step instructions
  - Admin can reset password via forgot password flow after first login

---

## Technology Choices

### Selected Technologies

| Technology | Purpose | Decision Rationale |
|-----------|---------|-------------------|
| **Supabase Auth** | User authentication, JWT tokens | Industry-standard, built-in security, magic link support |
| **Next.js Middleware** | Route protection, RBAC enforcement | Edge-optimized, runs before page render |
| **Prisma** | Database ORM, schema management | Type-safe, excellent DX, already used in project |
| **PostgreSQL** | Database, user storage | Required by constitution, Supabase-managed |
| **JWT (httpOnly cookies)** | Session management | Secure, stateless, XSS-protected |
| **Supabase Email** | Invitation and password reset emails | Built-in, zero config, sufficient for MVP |

### Alternatives Considered

| Alternative | Why Not Chosen |
|------------|---------------|
| **NextAuth.js** | Overkill for internal tool, Supabase Auth simpler |
| **Auth0** | External SaaS, additional cost, unnecessary complexity |
| **Custom JWT implementation** | Reinventing wheel, Supabase Auth handles this |
| **Session-based auth (DB sessions)** | Requires database lookup per request, worse performance |
| **Custom magic link tokens** | Supabase Auth provides this built-in |

---

## Security Considerations

### Threat Model

**Threats Addressed**:
1. ✅ **Brute Force Attacks**: Rate limiting (5 attempts per 15 min), account lockout
2. ✅ **Session Hijacking**: httpOnly cookies, SameSite policy, secure flag
3. ✅ **XSS Attacks**: JWT in httpOnly cookies (not localStorage)
4. ✅ **CSRF Attacks**: SameSite cookies, CSRF tokens on mutations
5. ✅ **User Enumeration**: Generic error messages on login/password reset
6. ✅ **Token Replay**: Single-use magic links, short expiration (24h)
7. ✅ **Privilege Escalation**: Role verified on both middleware AND API layer
8. ✅ **Data Leakage**: Audit logs exclude sensitive data (no passwords)

**Security Hardening**:
- Password complexity: 8+ chars, uppercase, lowercase, number, special char (OWASP)
- Magic link tokens: Supabase secure random (128-bit entropy)
- Session expiry: 7 days default, 30 days with "remember me"
- Admin actions: All logged to `audit_logs` with timestamp and actor
- Last admin protection: Cannot delete/demote last admin user

---

## Performance Considerations

### Expected Load

**Internal Tool Metrics**:
- **Users**: 5-50 executives/analysts/admins
- **Concurrent Sessions**: 10-20 typical, 50 peak
- **Login Frequency**: 2-5 logins per user per day
- **Admin Actions**: 1-10 user management operations per week

**Performance Targets**:
- Login: <2 seconds (credential validation to dashboard)
- Middleware auth check: <50ms (JWT validation + status check)
- Password reset: <5 minutes (email delivery to password set)
- User deactivation: Immediate (next request triggers logout)
- Audit log query: <500ms for last 1000 entries

### Optimization Strategies

**Database Indexes**:
```sql
CREATE INDEX idx_user_profiles_user_id ON user_profiles(user_id);
CREATE INDEX idx_user_profiles_status ON user_profiles(status);
CREATE INDEX idx_user_profiles_role ON user_profiles(role);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at DESC);
CREATE INDEX idx_audit_logs_actor_id ON audit_logs(actor_id);
```

**Edge Optimization**:
- Next.js middleware runs on Vercel Edge (global distribution)
- JWT validation happens at edge (no database roundtrip)
- Status check uses Supabase connection pooling (fast queries, <10ms)

---

## Integration Points

### Supabase Auth Integration

**Admin API Usage**:
- `auth.admin.createUser()` → Create user programmatically
- `auth.admin.generateLink({ type: 'magiclink' })` → Send invitation
- `auth.admin.updateUserById()` → Change email/metadata
- `auth.admin.deleteUser()` → Permanently delete user

**Email Templates**:
- Magic link invitation: "You've been invited to DevLabs CFO"
- Password reset: "Reset your DevLabs CFO password"
- Email change confirmation: "Verify your new email"

### Next.js App Integration

**Protected Routes**:
- `/dashboard/*` → Requires authentication
- `/dashboard/admin/*` → Requires `role='admin'`
- Public routes: `/login`, `/forgot-password`, `/reset-password`, `/invite-accept`

**Server Actions**:
- `loginUser(email, password)` → Authenticates, sets session, syncs role to JWT
- `logoutUser()` → Clears session, redirects to login
- `inviteUser(email, name, role)` → Admin creates user, sends magic link
- `updateUserRole(userId, newRole)` → Admin changes role, logs action
- `deactivateUser(userId)` → Admin sets status='inactive', logs action

---

## Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| **Admin account lockout** | Medium | High | Prevent deletion of last admin, document password reset |
| **Email delivery failures** | Low | Medium | Use reliable Supabase email, prepare SMTP fallback |
| **Session not revoked fast enough** | Low | Low | Middleware checks status on every request (immediate) |
| **Audit log storage growth** | Low | Low | Small logs (~1 KB each), 10K actions = ~10 MB |
| **Magic link phishing** | Low | Medium | Links expire in 24h, single-use, educate users |
| **Brute force attacks** | Medium | Low | Rate limiting, account lockout, monitoring |

---

## Open Questions

None remaining. All technical decisions resolved.

---

## References

- [Supabase Auth Documentation](https://supabase.com/docs/guides/auth)
- [Supabase Admin API](https://supabase.com/docs/reference/javascript/auth-admin-api)
- [Next.js Middleware](https://nextjs.org/docs/app/building-your-application/routing/middleware)
- [OWASP Authentication Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html)
- [JWT Best Practices](https://datatracker.ietf.org/doc/html/rfc8725)
- [GDPR Audit Log Requirements](https://gdpr.eu/compliance/audit-logs/)
