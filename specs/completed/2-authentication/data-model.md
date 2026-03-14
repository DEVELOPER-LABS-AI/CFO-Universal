# Data Model: Authentication & Admin User Management

**Feature**: Authentication & Admin User Management
**Version**: 1.0
**Created**: 2026-02-13
**Status**: Final

---

## Overview

This document defines the data structures, database schema changes, entity relationships, data flow diagrams, and migration strategy for the authentication and admin user management feature. The design integrates with Supabase Auth for user credentials while maintaining user profile metadata, roles, and audit logs in PostgreSQL via Prisma.

---

## Database Schema Changes

### 1. Updates to UserProfile Table

The existing `user_profiles` table will be extended with authentication-specific fields:

**Current fields** (to be retained):
- `id` (UUID, primary key)
- `user_id` (UUID, unique, links to Supabase Auth)
- `full_name` (String)
- `avatar_url` (String, nullable)
- `preferences` (JSON, nullable)
- `last_active_org` (String, nullable)
- `created_at` (DateTime)
- `updated_at` (DateTime)

**New fields to add**:
- `role` (Enum: admin, executive, analyst) - **Required**, defaults to 'executive'
- `status` (Enum: active, inactive) - **Required**, defaults to 'active'
- `last_login` (DateTime, nullable) - Updated on successful login
- `invite_token` (String, nullable) - UUID v4 token for invitation/password reset magic links
- `invite_expires_at` (DateTime, nullable) - Expiration timestamp for invite_token

**Field-level constraints**:
```
role: NOT NULL, DEFAULT 'executive'
status: NOT NULL, DEFAULT 'active'
last_login: NULLABLE
invite_token: NULLABLE, UNIQUE (when not null)
invite_expires_at: NULLABLE, must be future timestamp if invite_token present
```

**Indexes to add**:
```sql
CREATE INDEX idx_user_profiles_role ON user_profiles(role);
CREATE INDEX idx_user_profiles_status ON user_profiles(status);
CREATE INDEX idx_user_profiles_invite_token ON user_profiles(invite_token)
  WHERE invite_token IS NOT NULL;
```

---

### 2. New AuditLog Table

**Purpose**: Record all administrative actions for compliance, security auditing, and accountability.

**Fields**:
- `id` (UUID, primary key) - Unique identifier for each audit log entry
- `actor_id` (UUID, not null) - User ID of admin who performed the action
- `target_user_id` (UUID, nullable) - User ID of the affected user (null for system actions)
- `action_type` (Enum, not null) - Type of action performed
- `action_details` (JSONB, nullable) - Flexible JSON storing before/after values
- `ip_address` (String, nullable) - IP address of requester for security tracking
- `created_at` (DateTime, not null, default now) - Immutable timestamp of action

**Field descriptions**:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | UUID | Yes | Primary key |
| `actor_id` | UUID | Yes | User ID of admin performing action (foreign key to user_profiles) |
| `target_user_id` | UUID | No | User ID of affected user (foreign key to user_profiles) |
| `action_type` | Enum | Yes | Type of administrative action |
| `action_details` | JSONB | No | Dynamic JSON: `{before: {...}, after: {...}, changes: {...}}` |
| `ip_address` | String | No | Requester IP for security tracking |
| `created_at` | DateTime | Yes | Auto-set timestamp, immutable |

**Indexes to add**:
```sql
CREATE INDEX idx_audit_logs_actor_id ON audit_logs(actor_id);
CREATE INDEX idx_audit_logs_target_user_id ON audit_logs(target_user_id);
CREATE INDEX idx_audit_logs_action_type ON audit_logs(action_type);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at DESC);
```

**No update/delete operations allowed** - Append-only table for compliance.

---

### 3. Enum Definitions

#### UserRole Enum
Represents user access level and capabilities:

```
enum UserRole {
  admin      // Full system access: user management, settings, all data
  executive  // Data access: view financial data, dashboards (default role)
  analyst    // Limited data access: view reports, dashboards (future role)
}
```

**Mapping to capabilities**:
- `admin`: Can access /dashboard/admin/*, manage users, view audit logs
- `executive`: Can access /dashboard/*, view financial data, manage own profile
- `analyst`: Can access /dashboard/*, view financial reports (future enhancement)

---

#### UserStatus Enum
Represents whether a user account is enabled:

```
enum UserStatus {
  active     // User can log in and access system
  inactive   // User cannot log in; used for temporary deactivation
}
```

**Transitions**:
- `active` → `inactive`: Admin deactivates user (immediate session revocation)
- `inactive` → `active`: Admin reactivates user (user can log in again)
- New user created: Status is `inactive` until email invitation accepted
- User accepts invitation: Status automatically becomes `active`

---

#### AuditActionType Enum
Represents types of administrative actions logged:

```
enum AuditActionType {
  user_created        // Admin invited/created new user
  user_edited         // Admin modified user details (name, email, role)
  user_deleted        // Admin permanently deleted user record
  user_deactivated    // Admin set user status to inactive
  user_reactivated    // Admin set user status to active
  role_changed        // User's role changed (user_created logs this separately)
  password_reset      // Admin initiated password reset for user
}
```

**Audit details captured per action type**:

| Action Type | Details Captured |
|------------|------------------|
| `user_created` | `{after: {email, name, role}, inviteExpiresAt}` |
| `user_edited` | `{before: {email, name, role}, after: {...}, changes: [fields]}` |
| `user_deleted` | `{before: {email, name, role}, reason?: string}` |
| `user_deactivated` | `{before: {status}, after: {status}, reason?: string}` |
| `user_reactivated` | `{before: {status}, after: {status}}` |
| `role_changed` | `{before: {role}, after: {role}, reason?: string}` |
| `password_reset` | `{email, initiatedBy: admin_email}` |

---

## Entity Definitions (Prisma Format)

### Updated UserProfile Model

```prisma
model UserProfile {
  id              String   @id @default(uuid())
  user_id         String   @unique // Links to auth.users.id in Supabase Auth
  full_name       String
  avatar_url      String?

  // Authentication fields
  role            UserRole @default(EXECUTIVE)
  status          UserStatus @default(ACTIVE)
  last_login      DateTime?

  // Invitation/Magic link fields
  invite_token    String?  @unique // UUID v4, nullable
  invite_expires_at DateTime? // Null unless active invitation pending

  // User preferences
  preferences     Json? // User preferences (theme, notifications, etc.)
  last_active_org String? // FK to core_organizations.id

  // Timestamps
  created_at      DateTime @default(now())
  updated_at      DateTime @updatedAt

  // Relations
  audit_logs_as_actor AuditLog[] @relation("AuditActorRelation")
  audit_logs_as_target AuditLog[] @relation("AuditTargetRelation")

  @@index([user_id])
  @@index([role])
  @@index([status])
  @@index([invite_token])
  @@index([invite_expires_at])
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

**Validation rules**:
- `user_id`: Must exist in Supabase Auth users table
- `full_name`: Required, 1-100 characters
- `role`: Required, must be valid enum value
- `status`: Required, must be valid enum value
- `invite_token`: If present, must be valid UUID v4 format and unique
- `invite_expires_at`: If present, must be future timestamp (time > now)
- Constraint: If `invite_token` is non-null, `invite_expires_at` must also be non-null

---

### New AuditLog Model

```prisma
model AuditLog {
  id              String   @id @default(uuid())

  // Actors
  actor_id        String // User ID of admin who performed action
  target_user_id  String? // User ID of affected user (nullable)

  // Action details
  action_type     AuditActionType
  action_details  Json? // Flexible: {before: {...}, after: {...}}
  ip_address      String?

  // Timestamp (immutable)
  created_at      DateTime @default(now())

  // Relations
  actor           UserProfile @relation("AuditActorRelation", fields: [actor_id], references: [id], onDelete: Cascade)
  target_user     UserProfile? @relation("AuditTargetRelation", fields: [target_user_id], references: [id], onDelete: SetNull)

  @@index([actor_id])
  @@index([target_user_id])
  @@index([action_type])
  @@index([created_at])
  @@map("audit_logs")
}

enum AuditActionType {
  USER_CREATED
  USER_EDITED
  USER_DELETED
  USER_DEACTIVATED
  USER_REACTIVATED
  ROLE_CHANGED
  PASSWORD_RESET
}
```

**Validation rules**:
- `actor_id`: Must exist in user_profiles table
- `target_user_id`: If present, must exist in user_profiles table
- `action_type`: Required, must be valid enum value
- `action_details`: Valid JSON object if present
- `created_at`: Auto-set at creation, immutable
- No updates or deletes allowed on audit logs (enforce in application layer)

**Relationship constraints**:
- If actor user is deleted: `onDelete: Cascade` removes audit logs (preserves action history)
- If target user is deleted: `onDelete: SetNull` preserves audit log with null target (shows admin action occurred)

---

## Data Relationships

### Entity-Relationship Diagram (Text Format)

```
┌─────────────────────────────────────────────────────────────┐
│                    Supabase Auth (External)                 │
│                     auth.users table                         │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ id (UUID, PK)                                         │  │
│  │ email (unique)                                        │  │
│  │ encrypted_password (bcrypt)                           │  │
│  │ created_at, updated_at                                │  │
│  │ app_metadata.role (synced from user_profiles)        │  │
│  └───────────────────────────────────────────────────────┘  │
└────────────────┬────────────────────────────────────────────┘
                 │ (1:1) user_id foreign key
                 │
┌────────────────▼────────────────────────────────────────────┐
│                   PostgreSQL (Supabase)                      │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │             user_profiles (Updated)                  │   │
│  │  id (PK, UUID)                                       │   │
│  │  user_id (FK → auth.users, unique)                   │   │
│  │  full_name, avatar_url, preferences                  │   │
│  │  ┌────────────────────────────────────────────────┐  │   │
│  │  │ NEW FIELDS:                                    │  │   │
│  │  │ role (enum: admin, executive, analyst)         │  │   │
│  │  │ status (enum: active, inactive)                │  │   │
│  │  │ last_login (timestamp, nullable)               │  │   │
│  │  │ invite_token (UUID, nullable, unique)          │  │   │
│  │  │ invite_expires_at (timestamp, nullable)        │  │   │
│  │  └────────────────────────────────────────────────┘  │   │
│  │  created_at, updated_at                              │   │
│  └─────────┬────────────────────────────────┬───────────┘   │
│            │ (1:N)                          │ (1:N)         │
│            │ as_actor_id                    │ as_target_id  │
│  ┌─────────▼────────────────────────────────▼───────────┐   │
│  │             audit_logs (NEW)                         │   │
│  │  id (PK, UUID)                                       │   │
│  │  actor_id (FK → user_profiles, not null)             │   │
│  │  target_user_id (FK → user_profiles, nullable)       │   │
│  │  action_type (enum: user_created, ...)               │   │
│  │  action_details (JSON: {before, after, changes})     │   │
│  │  ip_address (string, nullable)                       │   │
│  │  created_at (immutable timestamp)                    │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

### Relationship Details

**UserProfile → AuditLog (One-to-Many, as actor)**
- One admin user can perform many audit actions
- Relationship: `UserProfile.audit_logs_as_actor`
- Foreign key: `AuditLog.actor_id` → `UserProfile.id`
- Cascading delete: If admin deleted, their audit logs are deleted (preserves actions by deleted admins)

**UserProfile → AuditLog (One-to-Many, as target)**
- One user can be the target of many audit actions
- Relationship: `UserProfile.audit_logs_as_target`
- Foreign key: `AuditLog.target_user_id` → `UserProfile.id`
- Set-null on delete: If target user deleted, audit logs show null target (action still recorded)

**UserProfile ↔ Supabase Auth (One-to-One)**
- One user profile maps to one Supabase Auth user
- Links via `user_profiles.user_id` → `auth.users.id`
- External relationship (Supabase manages auth.users)

---

## Data Flow Diagrams

### 1. User Invitation & Activation Flow

```
Admin Dashboard
      │
      ├─ Click "Add User"
      │       │
      │       ├─ Modal: Enter email, name, role
      │       │
      │       └─ Click "Send Invitation"
      │
      ▼
Server Action: inviteUser(email, name, role)
      │
      ├─ Verify admin is logged in & has admin role
      ├─ Validate email format & uniqueness
      │
      ├─ Call Supabase Admin API:
      │  └─ auth.admin.createUser({
      │      email,
      │      password: random_secure_string,
      │      email_confirm: true
      │    })
      │  Returns: user_id (UUID)
      │
      ├─ Generate invite_token = UUID v4
      ├─ Set invite_expires_at = now() + 24 hours
      │
      ├─ Insert user_profiles record:
      │  {
      │    user_id,
      │    full_name: name,
      │    role: role,
      │    status: 'inactive',      // Not active until email confirmed
      │    invite_token,
      │    invite_expires_at
      │  }
      │
      ├─ Call Supabase Admin API:
      │  └─ auth.admin.generateLink({
      │      type: 'magiclink',
      │      email,
      │      options: {
      │        redirectTo: 'https://app.com/invite-accept?token=' + invite_token
      │      }
      │    })
      │  Returns: magic_link (includes Supabase token)
      │
      ├─ Log audit action:
      │  {
      │    action_type: 'user_created',
      │    actor_id: current_admin_id,
      │    target_user_id: new_user_id,
      │    action_details: {
      │      after: { email, name, role },
      │      inviteExpiresAt: invite_expires_at
      │    },
      │    ip_address: request.ip
      │  }
      │
      └─ Return success: "Invitation sent to {email}"
         User appears in list with status "Inactive"

═══════════════════════════════════════════════════════════════════════

User receives email → Clicks magic link
         │
         └─ Redirected to /invite-accept?token={invite_token}
                │
                └─ Page verifies invite_token is valid & not expired
                        │
                        ├─ If invalid/expired:
                        │  └─ Show error "Invitation expired or invalid"
                        │
                        └─ If valid:
                           ├─ Display "Set Your Password" form
                           │
                           └─ User enters password (8+ chars, complexity)
                                   │
                                   └─ Submit form

═══════════════════════════════════════════════════════════════════════

Server Action: acceptInvitation(email, newPassword, invite_token)
      │
      ├─ Verify invite_token exists in user_profiles
      ├─ Verify invite_token matches user's email
      ├─ Verify invite_expires_at > now()
      │
      ├─ Call Supabase Admin API:
      │  └─ auth.admin.updateUserById(user_id, {
      │      password: newPassword,
      │      email_confirm: true
      │    })
      │
      ├─ Update user_profiles:
      │  {
      │    status: 'active',
      │    invite_token: null,
      │    invite_expires_at: null,
      │    last_login: now()
      │  }
      │
      ├─ Log audit action:
      │  {
      │    action_type: 'user_created' (already logged by admin)
      │    // No new audit log for activation
      │  }
      │
      ├─ Create session & JWT with:
      │  {
      │    sub: user_id,
      │    email,
      │    app_metadata.role: user_role,
      │    iss: 'https://supabase'
      │  }
      │
      └─ Redirect to /dashboard
         ✅ User is now active & logged in
```

---

### 2. User Login & JWT Role Sync Flow

```
Login Page
    │
    └─ User enters email & password
            │
            └─ Click "Sign In"

═══════════════════════════════════════════════════════════════════════

Server Action: loginUser(email, password)
      │
      ├─ Call Supabase Auth API:
      │  └─ auth.signInWithPassword(email, password)
      │     Returns: JWT with claims {sub, email}
      │     OR throws error if invalid credentials
      │
      ├─ If auth fails:
      │  └─ Return generic error: "Invalid email or password"
      │     (prevents user enumeration)
      │
      ├─ If auth succeeds:
      │  ├─ Fetch from user_profiles:
      │  │  └─ SELECT role, status FROM user_profiles WHERE user_id = ?
      │  │
      │  ├─ Verify status = 'active':
      │  │  ├─ If inactive:
      │  │  │  └─ Return error: "Account is inactive. Contact administrator."
      │  │  │
      │  │  └─ If active: Continue
      │  │
      │  ├─ Update user_profiles.last_login = now()
      │  │
      │  ├─ Call Supabase Admin API (server-side only):
      │  │  └─ auth.admin.updateUserById(user_id, {
      │  │      app_metadata: {
      │  │        role: user_role  // Sync from DB to JWT
      │  │      }
      │  │    })
      │  │
      │  ├─ Create new session with updated JWT:
      │  │  ├─ JWT claims now include:
      │  │  │  {
      │  │  │    sub: user_id,
      │  │  │    email,
      │  │  │    app_metadata.role: 'admin' | 'executive' | 'analyst'
      │  │  │  }
      │  │  │
      │  │  └─ Store in httpOnly cookie (secure, SameSite=Lax)
      │  │
      │  └─ Return success, redirect to /dashboard
      │
      └─ ✅ User logged in with role-aware JWT

═══════════════════════════════════════════════════════════════════════

User navigates to protected route
         │
         └─ Middleware runs (Next.js app/middleware.ts)
                │
                ├─ Extract JWT from httpOnly cookie
                ├─ Verify JWT signature (via Supabase key)
                ├─ Check exp claim not expired
                │
                ├─ If JWT valid:
                │  ├─ Extract user_id & role from claims
                │  │
                │  ├─ If accessing /dashboard/admin/*:
                │  │  ├─ Check role == 'admin' from JWT
                │  │  ├─ If not admin:
                │  │  │  └─ Redirect to /dashboard with error
                │  │  │
                │  │  └─ If admin: Allow request to continue
                │  │
                │  └─ If accessing /dashboard/*:
                │     └─ Allow request (status check in component)
                │
                └─ If JWT invalid/expired:
                   └─ Redirect to /login with "Session expired" message

═══════════════════════════════════════════════════════════════════════

Protected component loads
    │
    ├─ Server Component calls User.getSession()
    │  └─ Returns { user_id, email, role }
    │
    ├─ Verify status='active' via database query:
    │  └─ SELECT status FROM user_profiles WHERE user_id = ?
    │
    ├─ If status != 'active':
    │  └─ Log user out, redirect to /login: "Account deactivated"
    │
    └─ If status = 'active':
       └─ Render dashboard with role-appropriate content
          ✅ User has full access
```

---

### 3. Admin User Management (CRUD with Audit Logging) Flow

```
Admin navigates to /dashboard/admin/users
         │
         └─ Middleware checks JWT role == 'admin'
                │
                └─ ✅ Access granted, load user table

═══════════════════════════════════════════════════════════════════════

EDIT USER SCENARIO:
═══════════════════════════════════════════════════════════════════════

Admin clicks "Edit" on user row
     │
     └─ Modal opens with form pre-filled:
        {
          name: "John Doe",
          email: "john@company.com",
          role: "executive"
        }

User modifies field (e.g., role: executive → admin)
     │
     └─ Click "Save Changes"

═══════════════════════════════════════════════════════════════════════

Server Action: updateUser(userId, {name, email, role})
      │
      ├─ Verify current user is admin
      ├─ Prevent admin from editing themselves without confirmation
      │
      ├─ If role change: Verify not removing last admin user
      │  └─ Query: SELECT COUNT(*) FROM user_profiles WHERE role='admin'
      │     ├─ If count == 1 and trying to demote this user:
      │     │  └─ Return error: "Cannot remove last admin"
      │     │
      │     └─ If count > 1: Allow role change
      │
      ├─ Fetch current user_profiles record:
      │  └─ SELECT * FROM user_profiles WHERE user_id = ?
      │
      ├─ Identify changes:
      │  {
      │    before: { email: "john@company.com", role: "executive" },
      │    after: { email: "john@company.com", role: "admin" },
      │    changes: ["role"]
      │  }
      │
      ├─ If email changed:
      │  ├─ Verify new email is unique
      │  ├─ Update Supabase Auth:
      │  │  └─ auth.admin.updateUserById(user_id, {
      │  │      email: newEmail,
      │  │      email_confirm: true
      │  │    })
      │  │
      │  ├─ Generate new magic link for email verification
      │  ├─ Send verification email to new address
      │  │
      │  └─ Set invite_token & invite_expires_at
      │
      ├─ Update user_profiles record:
      │  {
      │    name,
      │    email (if changed),
      │    role,
      │    updated_at: now()
      │  }
      │
      ├─ Log audit action:
      │  {
      │    action_type: 'user_edited',
      │    actor_id: current_admin_id,
      │    target_user_id: edited_user_id,
      │    action_details: {
      │      before: { email: "john@company.com", role: "executive" },
      │      after: { email: "john@company.com", role: "admin" },
      │      changes: ["role"]
      │    },
      │    ip_address: request.ip
      │  }
      │
      ├─ If role changed:
      │  └─ Send email: "Your role has been changed to {newRole}"
      │
      └─ Return success: "User updated"

═══════════════════════════════════════════════════════════════════════

DEACTIVATE USER SCENARIO:
═══════════════════════════════════════════════════════════════════════

Admin clicks "Deactivate" on user row
    │
    └─ Confirmation dialog: "Deactivate [user email]?"
       ├─ If admin tries to deactivate themselves:
       │  └─ Show error: "You cannot deactivate your own account"
       │
       └─ If different user: Click "Confirm"

═══════════════════════════════════════════════════════════════════════

Server Action: deactivateUser(userId)
      │
      ├─ Verify current user is admin & not self-deactivating
      │
      ├─ Update user_profiles:
      │  {
      │    status: 'inactive',
      │    updated_at: now()
      │  }
      │
      ├─ Log audit action:
      │  {
      │    action_type: 'user_deactivated',
      │    actor_id: current_admin_id,
      │    target_user_id: deactivated_user_id,
      │    action_details: {
      │      before: { status: 'active' },
      │      after: { status: 'inactive' }
      │    },
      │    ip_address: request.ip
      │  }
      │
      ├─ Send email to user:
      │  "Your account has been deactivated. Contact admin to reactivate."
      │
      ├─ If user currently logged in:
      │  ├─ Middleware checks status on next request
      │  ├─ Detects status='inactive'
      │  └─ Logs them out with message: "Account deactivated"
      │
      └─ Return success: "User deactivated"
         User row shows "Inactive" status with grayed styling

═══════════════════════════════════════════════════════════════════════

DELETE USER SCENARIO:
═══════════════════════════════════════════════════════════════════════

Admin clicks "Delete" on user row
    │
    └─ Confirmation dialog: "Type email to confirm deletion: [input]"
       ├─ User must type exact email address
       ├─ If admin tries to delete themselves:
       │  └─ Show error: "You cannot delete your own account"
       │
       ├─ If trying to delete last admin:
       │  └─ Show error: "Cannot delete last admin user"
       │
       └─ If different user: Type email, click "Delete Permanently"

═══════════════════════════════════════════════════════════════════════

Server Action: deleteUser(userId)
      │
      ├─ Verify current user is admin
      ├─ Prevent self-deletion
      ├─ Prevent deletion of last admin
      │  └─ Query: SELECT COUNT(*) FROM user_profiles WHERE role='admin' AND user_id != ?
      │     ├─ If count == 0:
      │     │  └─ Return error: "Cannot delete last admin"
      │     │
      │     └─ If count > 0: Allow deletion
      │
      ├─ Fetch user_profiles record for logging:
      │  └─ SELECT * FROM user_profiles WHERE user_id = ?
      │
      ├─ Call Supabase Admin API:
      │  └─ auth.admin.deleteUser(user_id)
      │
      ├─ Delete from user_profiles:
      │  └─ DELETE FROM user_profiles WHERE user_id = ?
      │
      ├─ Log audit action:
      │  {
      │    action_type: 'user_deleted',
      │    actor_id: current_admin_id,
      │    target_user_id: deleted_user_id,
      │    action_details: {
      │      before: {
      │        email: user.email,
      │        name: user.full_name,
      │        role: user.role
      │      }
      │    },
      │    ip_address: request.ip
      │  }
      │  Note: target_user_id stored even though user deleted
      │        (SetNull on cascade keeps audit log, shows deleted user_id)
      │
      ├─ If user currently logged in:
      │  ├─ Session becomes invalid on next request (user doesn't exist)
      │  └─ Redirected to /login
      │
      └─ Return success: "User deleted"
         User removed from table

═══════════════════════════════════════════════════════════════════════

PASSWORD RESET SCENARIO (Admin-Initiated):
═══════════════════════════════════════════════════════════════════════

Admin clicks "Reset Password" on user row
     │
     └─ Modal: "Send password reset email to [user@email.com]?"
        └─ Click "Send Reset Link"

═══════════════════════════════════════════════════════════════════════

Server Action: resetUserPassword(userId)
      │
      ├─ Verify current user is admin
      │
      ├─ Call Supabase Admin API:
      │  └─ auth.admin.generateLink({
      │      type: 'recovery',  // Password recovery
      │      email: user.email,
      │      options: {
      │        redirectTo: 'https://app.com/reset-password'
      │      }
      │    })
      │  Returns: recovery_link with Supabase token
      │
      ├─ Update user_profiles:
      │  ├─ Invalidate any existing invite_token
      │  └─ {
      │      invite_token: null,
      │      invite_expires_at: null
      │    }
      │
      ├─ Log audit action:
      │  {
      │    action_type: 'password_reset',
      │    actor_id: current_admin_id,
      │    target_user_id: reset_user_id,
      │    action_details: {
      │      email: user.email,
      │      initiatedBy: current_admin_email
      │    },
      │    ip_address: request.ip
      │  }
      │
      ├─ Email is sent by Supabase with recovery link
      │
      └─ Return success: "Password reset email sent to [email]"

User clicks link → Password setup page
     │
     └─ User enters new password
             │
             └─ Submit form

═══════════════════════════════════════════════════════════════════════

Server Action: setNewPassword(newPassword, supabaseToken)
      │
      ├─ Call Supabase Auth API:
      │  └─ auth.updateUser({ password: newPassword })
      │
      ├─ Update user_profiles:
      │  └─ last_login: now()
      │
      ├─ Create session & redirect to /dashboard
      │
      └─ ✅ Password reset complete
```

---

## Migration Strategy

### Phase 1: Schema Updates (Database Migration)

#### Step 1a: Add New Enums

```sql
-- Add new enums for user roles and status
CREATE TYPE user_role AS ENUM ('admin', 'executive', 'analyst');
CREATE TYPE user_status AS ENUM ('active', 'inactive');
CREATE TYPE audit_action_type AS ENUM (
  'user_created',
  'user_edited',
  'user_deleted',
  'user_deactivated',
  'user_reactivated',
  'role_changed',
  'password_reset'
);
```

#### Step 1b: Alter user_profiles Table

```sql
-- Add new columns to user_profiles
ALTER TABLE user_profiles
ADD COLUMN role user_role NOT NULL DEFAULT 'executive';

ALTER TABLE user_profiles
ADD COLUMN status user_status NOT NULL DEFAULT 'active';

ALTER TABLE user_profiles
ADD COLUMN last_login TIMESTAMPTZ NULL;

ALTER TABLE user_profiles
ADD COLUMN invite_token UUID NULL UNIQUE;

ALTER TABLE user_profiles
ADD COLUMN invite_expires_at TIMESTAMPTZ NULL;

-- Add constraints
ALTER TABLE user_profiles
ADD CONSTRAINT check_invite_token_with_expiry
CHECK ((invite_token IS NULL AND invite_expires_at IS NULL)
       OR (invite_token IS NOT NULL AND invite_expires_at IS NOT NULL));

ALTER TABLE user_profiles
ADD CONSTRAINT check_invite_not_expired
CHECK (invite_expires_at IS NULL OR invite_expires_at > NOW());

-- Create indexes
CREATE INDEX idx_user_profiles_role ON user_profiles(role);
CREATE INDEX idx_user_profiles_status ON user_profiles(status);
CREATE INDEX idx_user_profiles_invite_token ON user_profiles(invite_token)
  WHERE invite_token IS NOT NULL;
```

#### Step 1c: Create audit_logs Table

```sql
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID NOT NULL,
  target_user_id UUID NULL,
  action_type audit_action_type NOT NULL,
  action_details JSONB NULL,
  ip_address TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Foreign keys
  CONSTRAINT fk_actor FOREIGN KEY (actor_id)
    REFERENCES user_profiles(id) ON DELETE CASCADE,
  CONSTRAINT fk_target_user FOREIGN KEY (target_user_id)
    REFERENCES user_profiles(id) ON DELETE SET NULL
);

-- Create indexes
CREATE INDEX idx_audit_logs_actor_id ON audit_logs(actor_id);
CREATE INDEX idx_audit_logs_target_user_id ON audit_logs(target_user_id);
CREATE INDEX idx_audit_logs_action_type ON audit_logs(action_type);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at DESC);

-- Table comment for documentation
COMMENT ON TABLE audit_logs IS 'Immutable audit trail of all administrative actions. Append-only, never delete entries.';
COMMENT ON COLUMN audit_logs.action_details IS 'JSON object: {before: {...}, after: {...}, changes: [fields]}';
```

#### Step 1d: Run Prisma Migration

```bash
# Generate Prisma migration
npx prisma migrate dev --name add_authentication_schema

# Or create manually and apply:
npx prisma migrate deploy
```

---

### Phase 2: Backfill Existing Data

#### Step 2a: Backfill Existing Users with default role

```sql
-- All existing users default to 'executive' role
UPDATE user_profiles
SET role = 'executive'
WHERE role IS NULL;

-- Verify all users have a role
SELECT COUNT(*) as total_users,
       COUNT(CASE WHEN role IS NOT NULL THEN 1 END) as users_with_role
FROM user_profiles;
```

**Expected output**: Both counts should match

#### Step 2b: Verify Status Defaulting

```sql
-- Check that all users have active status
SELECT COUNT(*) as total_users,
       COUNT(CASE WHEN status = 'active' THEN 1 END) as active_users
FROM user_profiles;
```

**Expected output**: Both counts should match

#### Step 2c: Create Initial Admin User

**Option A: Via SQL Script (Recommended for security)**

```sql
-- This script is provided separately in docs/setup-admin.sql
-- It uses Supabase Admin API via a prepared script to:
-- 1. Create user in auth.users with secure temporary password
-- 2. Insert record in user_profiles with role='admin', status='active'
-- 3. Output password reset link for initial login

-- Run via: psql -h {db_host} -U postgres {database} -f setup-admin.sql
```

**Setup script template** (`docs/setup-admin.sql`):

```sql
-- IMPORTANT: Run this script to bootstrap the first admin user
-- Prerequisites:
--   1. Supabase project created
--   2. PostgreSQL database initialized
--   3. User_profiles table exists with new schema
--
-- Steps:
--   1. In Supabase dashboard, go to "Sql Editor"
--   2. Create new query
--   3. Paste content from this file
--   4. Run the query
--   5. Note the password and user_id from output
--   6. Admin should reset password on first login via /forgot-password

-- Insert first admin user (example)
-- MANUALLY CREATE IN SUPABASE DASHBOARD:
-- 1. Go to Authentication → Users
-- 2. Click "Add user"
-- 3. Email: admin@company.com
-- 4. Password: (let Supabase auto-generate temporary)
-- 5. Click "Create User"
-- 6. Copy the user ID

-- Then run:
INSERT INTO user_profiles (
  id,
  user_id,
  full_name,
  role,
  status,
  created_at,
  updated_at
) VALUES (
  gen_random_uuid(),
  '{PASTE_USER_ID_FROM_SUPABASE_HERE}',
  'System Administrator',
  'admin',
  'active',
  NOW(),
  NOW()
);

-- Verify insertion
SELECT user_id, full_name, role, status
FROM user_profiles
WHERE role = 'admin';
```

**Instructions for admin setup** (in `docs/SETUP.md`):

1. Go to Supabase dashboard → Authentication → Users
2. Click "Add user" button
3. Enter email: `admin@company.com` (or your admin email)
4. Supabase auto-generates temporary password
5. Click "Create User"
6. Copy the user ID from the user details page
7. In Supabase SQL Editor:
   - Paste the SQL script from above
   - Replace `{PASTE_USER_ID_FROM_SUPABASE_HERE}` with copied user ID
   - Run the query
8. User created with role='admin', status='active'
9. On first login, go to /forgot-password to set permanent password
10. All subsequent users created via admin UI

---

### Phase 3: Prisma Schema Update

Update `/Users/developerlabsai/Projects/RevenuePatch/DevLabs CFO/prisma/schema.prisma`:

```prisma
// Add at top with other enums (after existing enums)
enum UserRole {
  ADMIN
  EXECUTIVE
  ANALYST
}

enum UserStatus {
  ACTIVE
  INACTIVE
}

enum AuditActionType {
  USER_CREATED
  USER_EDITED
  USER_DELETED
  USER_DEACTIVATED
  USER_REACTIVATED
  ROLE_CHANGED
  PASSWORD_RESET
}

// Update existing UserProfile model
model UserProfile {
  id              String   @id @default(uuid())
  user_id         String   @unique
  full_name       String
  avatar_url      String?

  // NEW: Authentication fields
  role            UserRole @default(EXECUTIVE)
  status          UserStatus @default(ACTIVE)
  last_login      DateTime?
  invite_token    String?  @unique
  invite_expires_at DateTime?

  // Existing fields
  preferences     Json?
  last_active_org String?
  created_at      DateTime @default(now())
  updated_at      DateTime @updatedAt

  // NEW: Relations to audit logs
  audit_logs_as_actor AuditLog[] @relation("AuditActorRelation")
  audit_logs_as_target AuditLog[] @relation("AuditTargetRelation")

  @@index([user_id])
  @@index([role])
  @@index([status])
  @@index([invite_token])
  @@map("user_profiles")
}

// NEW: AuditLog model
model AuditLog {
  id              String   @id @default(uuid())
  actor_id        String
  target_user_id  String?
  action_type     AuditActionType
  action_details  Json?
  ip_address      String?
  created_at      DateTime @default(now())

  // Relations
  actor           UserProfile @relation("AuditActorRelation", fields: [actor_id], references: [id], onDelete: Cascade)
  target_user     UserProfile? @relation("AuditTargetRelation", fields: [target_user_id], references: [id], onDelete: SetNull)

  @@index([actor_id])
  @@index([target_user_id])
  @@index([action_type])
  @@index([created_at])
  @@map("audit_logs")
}
```

---

### Phase 4: Verification & Testing

#### Step 4a: Run Migration

```bash
# In project directory
npx prisma migrate deploy

# Verify schema
npx prisma db push
```

#### Step 4b: Test User Creation

```typescript
// Test creating a user profile with new fields
import { prisma } from '@/lib/db';

const testUser = await prisma.userProfile.create({
  data: {
    user_id: '12345678-1234-1234-1234-123456789012',
    full_name: 'Test User',
    role: 'EXECUTIVE',
    status: 'ACTIVE'
  }
});

console.log(testUser);
// Output: { id, user_id, full_name, role, status, last_login: null, ... }
```

#### Step 4c: Test Audit Logging

```typescript
// Test creating an audit log
const auditLog = await prisma.auditLog.create({
  data: {
    actor_id: admin_id,
    target_user_id: user_id,
    action_type: 'USER_CREATED',
    action_details: {
      after: { email: 'user@company.com', role: 'executive' }
    }
  }
});

console.log(auditLog);
// Output: { id, actor_id, target_user_id, action_type, ... }
```

#### Step 4d: Verify Indexes

```sql
-- Check that all indexes were created
SELECT indexname
FROM pg_indexes
WHERE tablename IN ('user_profiles', 'audit_logs')
ORDER BY tablename, indexname;
```

**Expected indexes**:
- `idx_user_profiles_role`
- `idx_user_profiles_status`
- `idx_user_profiles_invite_token`
- `idx_audit_logs_actor_id`
- `idx_audit_logs_target_user_id`
- `idx_audit_logs_action_type`
- `idx_audit_logs_created_at`

---

### Phase 5: RLS Policy Updates (If Using Supabase RLS)

If the application uses Supabase Row-Level Security (RLS):

```sql
-- Allow authenticated users to view their own profile
CREATE POLICY "Users can view their own profile" ON user_profiles
  FOR SELECT USING (user_id = auth.uid());

-- Allow admins to view all profiles
CREATE POLICY "Admins can view all profiles" ON user_profiles
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM user_profiles up2
      WHERE up2.user_id = auth.uid() AND up2.role = 'admin'
    )
  );

-- Allow admins to update profiles
CREATE POLICY "Admins can update profiles" ON user_profiles
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM user_profiles up2
      WHERE up2.user_id = auth.uid() AND up2.role = 'admin'
    )
  );

-- Allow admins to view audit logs
CREATE POLICY "Admins can view audit logs" ON audit_logs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.user_id = auth.uid() AND up.role = 'admin'
    )
  );
```

---

## Data Validation Rules

### UserProfile Model

| Field | Validation Rules |
|-------|------------------|
| `user_id` | Must be UUID, must exist in Supabase Auth, must be unique |
| `full_name` | Required, 1-100 characters, non-empty string |
| `role` | Required, must be 'admin', 'executive', or 'analyst' |
| `status` | Required, must be 'active' or 'inactive' |
| `last_login` | Optional, must be valid timestamp if present |
| `invite_token` | Optional, must be valid UUID v4 if present, must be unique |
| `invite_expires_at` | Optional, must be future timestamp; required if invite_token is set |
| `preferences` | Optional, must be valid JSON object if present |

**Application-level constraints**:
- Cannot demote/delete last admin user
- Cannot self-deactivate/delete
- invite_token and invite_expires_at must both be set or both be null
- If invite_expires_at is set, it must be in the future

### AuditLog Model

| Field | Validation Rules |
|-------|------------------|
| `actor_id` | Required, must exist in user_profiles table |
| `target_user_id` | Optional, if set must exist in user_profiles table |
| `action_type` | Required, must be valid enum value |
| `action_details` | Optional, must be valid JSON object if present |
| `ip_address` | Optional, must be valid IP address if present |
| `created_at` | Required, auto-set, immutable |

**Application-level constraints**:
- Audit logs are append-only (never updated or deleted)
- All admin mutations must create corresponding audit log entry
- action_details JSON must include 'before' and 'after' keys for comparison

---

## Performance Considerations

### Indexes

All proposed indexes on user_profiles and audit_logs serve specific query patterns:

| Index | Query Pattern | Estimated Rows Scanned |
|-------|---------------|------------------------|
| `idx_user_profiles_role` | Filter by role in admin UI | O(n) |
| `idx_user_profiles_status` | Middleware status check | O(1) |
| `idx_user_profiles_invite_token` | Lookup user by invite token | O(1) |
| `idx_audit_logs_actor_id` | Show user's actions (e.g., "admin created 5 users") | O(n) |
| `idx_audit_logs_action_type` | Filter logs by action type | O(n) |
| `idx_audit_logs_created_at` | Time-range queries (last 24h actions) | O(n) |

### Query Performance

For internal tool with ~5-50 users:

- User profile lookup by ID: <1ms (indexed)
- Status check on middleware: <5ms (indexed lookup + JWT validation)
- List all users: <50ms (full table scan of 5-50 rows)
- Audit log query (last 1000): <200ms (indexed on created_at)

### Caching Strategy

Status checks can be cached briefly (1 minute) at edge if performance needed:

```typescript
// Example: Cache status in middleware
const cachedStatus = await cache.get(`user_status:${userId}`);
if (!cachedStatus) {
  const status = await db.getUserStatus(userId);
  await cache.set(`user_status:${userId}`, status, { ttl: 60 }); // 1 min
}
```

---

## Backward Compatibility

### Existing Data Integrity

- Existing user_profiles records are unaffected by new columns (all default safely)
- Existing queries continue to work (new columns are optional in SELECT)
- No data migration or transformation needed

### Migration Path

1. Deploy schema migrations first (no application changes needed yet)
2. All existing users default to role='executive', status='active'
3. Deploy application code using new fields
4. No downtime required

---

## Security & Privacy

### Data Sensitivity

**High sensitivity fields**:
- `user_id` - Links to auth.users; treat as PII
- Email (via user_id relationship) - Personally identifiable

**Medium sensitivity**:
- `role` - Shows access level; doesn't reveal identity
- `status` - Shows if account active; public display in admin UI
- `invite_token` - Single-use, time-limited token; sensitive in transit

**Low sensitivity**:
- Timestamps, action_details - Non-personal information

### Access Control

- Only admins can view/modify user profiles
- Users can view own profile (name, role, last_login)
- Audit logs visible only to admins
- Status automatically checked on protected routes

### Data Retention

- User profiles: Indefinite (until user deleted)
- Audit logs: Indefinite retention for compliance (GDPR allows up to 7 years)
- Deleted user's audit logs preserved with target_user_id = null (shows action occurred)

---

## Testing Strategy

### Unit Tests

```typescript
// Test enum values
describe('Enums', () => {
  it('should have valid UserRole values', () => {
    expect(UserRole.ADMIN).toBeDefined();
    expect(UserRole.EXECUTIVE).toBeDefined();
    expect(UserRole.ANALYST).toBeDefined();
  });
});
```

### Integration Tests

```typescript
// Test user creation with audit log
describe('User Management', () => {
  it('should create user and log audit entry', async () => {
    const admin = await createTestAdmin();
    const newUser = await inviteUser(admin.id, {
      email: 'test@company.com',
      name: 'Test User',
      role: 'executive'
    });

    const auditLog = await getAuditLog(newUser.id, 'USER_CREATED');
    expect(auditLog).toBeDefined();
    expect(auditLog.actor_id).toBe(admin.id);
  });
});
```

### Database Tests

```typescript
// Test constraints
describe('Database Constraints', () => {
  it('should prevent invite_token without expiry', async () => {
    expect(async () => {
      await prisma.userProfile.create({
        data: {
          user_id: uuid(),
          full_name: 'Test',
          invite_token: uuid(),
          invite_expires_at: null // Missing!
        }
      });
    }).rejects.toThrow();
  });
});
```

---

## Documentation Files

The following documentation should be created/updated:

1. **docs/SETUP.md** - Initial admin user setup instructions
2. **docs/AUTHENTICATION.md** - Authentication system overview
3. **docs/API.md** - API endpoints for user management
4. **docs/AUDIT.md** - Audit logging and compliance guide
5. **docs/MIGRATIONS.md** - Database migration guide for deployments

---

## Appendix: SQL Reference

### Full Schema Definition

```sql
-- Types/Enums
CREATE TYPE user_role AS ENUM ('admin', 'executive', 'analyst');
CREATE TYPE user_status AS ENUM ('active', 'inactive');
CREATE TYPE audit_action_type AS ENUM (
  'user_created', 'user_edited', 'user_deleted',
  'user_deactivated', 'user_reactivated', 'role_changed', 'password_reset'
);

-- Updated user_profiles with new columns
ALTER TABLE user_profiles ADD COLUMN role user_role NOT NULL DEFAULT 'executive';
ALTER TABLE user_profiles ADD COLUMN status user_status NOT NULL DEFAULT 'active';
ALTER TABLE user_profiles ADD COLUMN last_login TIMESTAMPTZ NULL;
ALTER TABLE user_profiles ADD COLUMN invite_token UUID NULL UNIQUE;
ALTER TABLE user_profiles ADD COLUMN invite_expires_at TIMESTAMPTZ NULL;

-- Constraints
ALTER TABLE user_profiles ADD CONSTRAINT check_invite_token_with_expiry
  CHECK ((invite_token IS NULL AND invite_expires_at IS NULL)
         OR (invite_token IS NOT NULL AND invite_expires_at IS NOT NULL));
ALTER TABLE user_profiles ADD CONSTRAINT check_invite_not_expired
  CHECK (invite_expires_at IS NULL OR invite_expires_at > NOW());

-- Indexes
CREATE INDEX idx_user_profiles_role ON user_profiles(role);
CREATE INDEX idx_user_profiles_status ON user_profiles(status);
CREATE INDEX idx_user_profiles_invite_token ON user_profiles(invite_token) WHERE invite_token IS NOT NULL;

-- New audit_logs table
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  target_user_id UUID NULL REFERENCES user_profiles(id) ON DELETE SET NULL,
  action_type audit_action_type NOT NULL,
  action_details JSONB NULL,
  ip_address TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_audit_logs_actor_id ON audit_logs(actor_id);
CREATE INDEX idx_audit_logs_target_user_id ON audit_logs(target_user_id);
CREATE INDEX idx_audit_logs_action_type ON audit_logs(action_type);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at DESC);
```

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-02-13 | Comprehensive data model specification with schema, enums, relationships, flows, and migration strategy |
