# Authentication & Admin User Management - Implementation Tasks

**Feature**: Authentication & Admin User Management
**Branch**: `2-authentication`
**Created**: 2026-02-13
**Status**: Ready for Implementation

---

## Overview

This document provides a comprehensive, actionable task list for implementing authentication and admin user management. Tasks are organized by user story phases with clear dependencies, parallelization opportunities, and verification criteria.

**Total Tasks**: 249
**Estimated Duration**: 5-7 days
**MVP Tasks**: 81 (Setup + Foundational + US1 + US3)
**Parallelizable Tasks**: 78 (31% of total)

---

## Table of Contents

- [Phase 1: Setup & Dependencies](#phase-1-setup--dependencies)
- [Phase 2: Foundational Infrastructure](#phase-2-foundational-infrastructure)
- [Phase 3: US1 - Admin Invites New User](#phase-3-us1---admin-invites-new-user)
- [Phase 4: US2 - New User Accepts Invitation](#phase-4-us2---new-user-accepts-invitation)
- [Phase 5: US3 - User Login](#phase-5-us3---user-login)
- [Phase 6: US4 - Password Reset](#phase-6-us4---password-reset)
- [Phase 7: US5 - Profile Management](#phase-7-us5---profile-management)
- [Phase 8: US6 - Admin Manages Users](#phase-8-us6---admin-manages-users)
- [Phase 9: Polish & Cross-Cutting Concerns](#phase-9-polish--cross-cutting-concerns)
- [Dependencies](#dependencies)
- [Success Criteria](#success-criteria)
- [MVP Scope](#mvp-scope)
- [Implementation Strategy](#implementation-strategy)

---

## Phase 1: Setup & Dependencies

**Goal**: Prepare development environment, configure Supabase, and update database schema.

**Prerequisites**: None (first phase)

**Parallelization**: Tasks T001-T003 can run in parallel

### Tasks

- [ ] [T001] [P] Configure Supabase authentication settings at /Users/developerlabsai/Projects/RevenuePatch/DevLabs CFO (enable email auth, set redirect URLs)
- [ ] [T002] [P] Add Supabase environment variables to .env.local file (NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY)
- [ ] [T003] [P] Install required dependencies: @supabase/ssr, @supabase/supabase-js at /Users/developerlabsai/Projects/RevenuePatch/DevLabs CFO
- [ ] [T004] Update Prisma schema at /Users/developerlabsai/Projects/RevenuePatch/DevLabs CFO/prisma/schema.prisma with UserRole enum
- [ ] [T005] Update Prisma schema at /Users/developerlabsai/Projects/RevenuePatch/DevLabs CFO/prisma/schema.prisma with UserStatus enum
- [ ] [T006] Update Prisma schema at /Users/developerlabsai/Projects/RevenuePatch/DevLabs CFO/prisma/schema.prisma with AuditActionType enum
- [ ] [T007] Update user_profiles model in Prisma schema to add role field (UserRole, default EXECUTIVE)
- [ ] [T008] Update user_profiles model in Prisma schema to add status field (UserStatus, default ACTIVE)
- [ ] [T009] Update user_profiles model in Prisma schema to add last_login field (DateTime, nullable)
- [ ] [T010] Update user_profiles model in Prisma schema to add invite_token field (String, nullable, unique)
- [ ] [T011] Update user_profiles model in Prisma schema to add invite_expires_at field (DateTime, nullable)
- [ ] [T012] Create audit_logs model in Prisma schema at /Users/developerlabsai/Projects/RevenuePatch/DevLabs CFO/prisma/schema.prisma
- [ ] [T013] Add indexes to user_profiles model (role, status, invite_token) in Prisma schema
- [ ] [T014] Add indexes to audit_logs model (actor_id, target_user_id, action_type, created_at) in Prisma schema
- [ ] [T015] Run Prisma migration: npx prisma migrate dev --name add_authentication_schema at /Users/developerlabsai/Projects/RevenuePatch/DevLabs CFO
- [ ] [T016] Generate Prisma client: npx prisma generate at /Users/developerlabsai/Projects/RevenuePatch/DevLabs CFO
- [ ] [T017] Create RLS policy SQL script at /Users/developerlabsai/Projects/RevenuePatch/DevLabs CFO/prisma/rls-auth-policies.sql
- [ ] [T018] Apply RLS policies via psql command at /Users/developerlabsai/Projects/RevenuePatch/DevLabs CFO

### Verification

- [ ] Supabase authentication enabled for email provider
- [ ] Environment variables loaded correctly
- [ ] Migration creates user_profiles and audit_logs tables
- [ ] All enums defined correctly (UserRole, UserStatus, AuditActionType)
- [ ] Indexes created on all specified fields
- [ ] Prisma client generated with new types
- [ ] RLS policies prevent cross-organization access

---

## Phase 2: Foundational Infrastructure

**Goal**: Build core authentication utilities, middleware, and helper functions.

**Prerequisites**: Phase 1 completed

**Parallelization**: Tasks T019-T026 can run in parallel (independent utilities)

### Tasks

- [ ] [T019] [P] Create Supabase server client utility at /Users/developerlabsai/Projects/RevenuePatch/DevLabs CFO/lib/supabase/server.ts
- [ ] [T020] [P] Create Supabase admin client utility at /Users/developerlabsai/Projects/RevenuePatch/DevLabs CFO/lib/supabase/admin.ts
- [ ] [T021] [P] Create AuthUser TypeScript interface in /Users/developerlabsai/Projects/RevenuePatch/DevLabs CFO/lib/auth/helpers.ts
- [ ] [T022] [P] Implement getCurrentUser() function in /Users/developerlabsai/Projects/RevenuePatch/DevLabs CFO/lib/auth/helpers.ts
- [ ] [T023] [P] Implement isAdmin() function in /Users/developerlabsai/Projects/RevenuePatch/DevLabs CFO/lib/auth/helpers.ts
- [ ] [T024] [P] Implement requireAuth() function in /Users/developerlabsai/Projects/RevenuePatch/DevLabs CFO/lib/auth/helpers.ts
- [ ] [T025] [P] Implement requireAdmin() function in /Users/developerlabsai/Projects/RevenuePatch/DevLabs CFO/lib/auth/helpers.ts
- [ ] [T026] [P] Create syncRoleToJWT() utility in /Users/developerlabsai/Projects/RevenuePatch/DevLabs CFO/lib/auth/sync-metadata.ts
- [ ] [T027] [P] Create createAuditLog() utility in /Users/developerlabsai/Projects/RevenuePatch/DevLabs CFO/lib/audit/logger.ts
- [ ] [T028] [P] Create getIPAddress() helper in /Users/developerlabsai/Projects/RevenuePatch/DevLabs CFO/lib/audit/logger.ts
- [ ] [T029] Create Next.js middleware at /Users/developerlabsai/Projects/RevenuePatch/DevLabs CFO/middleware.ts
- [ ] [T030] Implement authentication check in middleware (verify JWT token)
- [ ] [T031] Implement status check in middleware (query user_profiles.status)
- [ ] [T032] Implement admin route protection in middleware (check /dashboard/admin/* routes)
- [ ] [T033] Add public routes exclusion in middleware config (/login, /forgot-password, /reset-password, /invite-accept)
- [ ] [T034] Create redirect helper functions at /Users/developerlabsai/Projects/RevenuePatch/DevLabs CFO/lib/auth/redirect.ts
- [ ] [T035] Handle edge runtime compatibility for Prisma in middleware

### Verification

- [ ] getCurrentUser() returns user data with role and status
- [ ] requireAdmin() throws error for non-admin users
- [ ] syncRoleToJWT() updates app_metadata in Supabase Auth
- [ ] createAuditLog() inserts record in audit_logs table
- [ ] Middleware redirects unauthenticated users to /login
- [ ] Middleware blocks inactive users (status='inactive')
- [ ] Middleware blocks non-admin from /dashboard/admin/*
- [ ] Public routes accessible without authentication
- [ ] TypeScript types match Prisma schema

---

## Phase 3: US1 - Admin Invites New User

**Goal**: Admin can create new users via invitation flow with magic link.

**Prerequisites**: Phase 2 (Foundational Infrastructure) completed

**User Story**: Admin navigates to User Management, clicks "Add User", enters email/name/role, submits form, user receives invitation email with magic link.

**Independent Test Criteria**:
- Admin can access user management page
- Add user form validates email format and uniqueness
- User record created in both Supabase Auth and user_profiles
- Magic link token generated and stored with 24h expiration
- Invitation email sent with correct magic link URL
- Audit log entry created for user_created action
- New user appears in admin list with "Inactive" status

**Parallelization**: Tasks T036-T038 can run in parallel with T045-T047, then T048-T051 can run in parallel with T052-T054

### Tasks

#### Server Actions
- [ ] [T036] [P] [US1] Create inviteUser Server Action at /Users/developerlabsai/Projects/RevenuePatch/DevLabs CFO/app/actions/user-management.ts
- [ ] [T037] [P] [US1] Implement admin authorization check in inviteUser action
- [ ] [T038] [P] [US1] Implement email validation and uniqueness check in inviteUser action
- [ ] [T039] [US1] Call Supabase Admin API auth.admin.createUser() in inviteUser action
- [ ] [T040] [US1] Create user_profiles record with status='inactive' in inviteUser action
- [ ] [T041] [US1] Generate invite_token (UUID v4) and set invite_expires_at (+24h) in inviteUser action
- [ ] [T042] [US1] Call Supabase Admin API auth.admin.generateLink() for magic link in inviteUser action
- [ ] [T043] [US1] Create audit log entry (action_type: USER_CREATED) in inviteUser action
- [ ] [T044] [US1] Return success response with user data in inviteUser action

#### UI Components
- [ ] [T045] [P] [US1] Create AddUserModal component at /Users/developerlabsai/Projects/RevenuePatch/DevLabs CFO/app/dashboard/admin/users/components/AddUserModal.tsx
- [ ] [T046] [P] [US1] Create Zod validation schema for add user form in AddUserModal
- [ ] [T047] [P] [US1] Implement form fields (email, full_name, role dropdown) in AddUserModal
- [ ] [T048] [US1] Implement form submission calling inviteUser action in AddUserModal
- [ ] [T049] [US1] Add success toast notification in AddUserModal
- [ ] [T050] [US1] Add error handling and display in AddUserModal
- [ ] [T051] [US1] Add loading state during form submission in AddUserModal

#### User List Page
- [ ] [T052] [P] [US1] Create admin user list page at /Users/developerlabsai/Projects/RevenuePatch/DevLabs CFO/app/dashboard/admin/users/page.tsx
- [ ] [T053] [US1] Fetch all users with Prisma query in user list page
- [ ] [T054] [US1] Display user table with columns: name, email, role, status, last_login, actions
- [ ] [T055] [US1] Add "Add User" button triggering AddUserModal in user list page
- [ ] [T056] [US1] Implement role badges with color coding (admin/executive/analyst)
- [ ] [T057] [US1] Implement status badges (active/inactive) with styling

### Verification

- [ ] Admin can access /dashboard/admin/users page
- [ ] "Add User" button opens modal with form
- [ ] Email validation prevents invalid formats
- [ ] Duplicate email rejected with error message
- [ ] User created in Supabase Auth with random password
- [ ] User_profiles record created with status='inactive'
- [ ] invite_token and invite_expires_at set correctly (24h from now)
- [ ] Magic link generated and invitation email sent
- [ ] New user appears in table with "Inactive" status
- [ ] Audit log entry created with action_type: USER_CREATED

---

## Phase 4: US2 - New User Accepts Invitation

**Goal**: Invited user can click magic link, set password, and activate account.

**Prerequisites**: Phase 3 (US1) completed

**User Story**: User receives invitation email, clicks magic link, redirected to password setup page, enters password (8+ chars with complexity), submits, account activated, automatically logged in.

**Independent Test Criteria**:
- Magic link validation (token exists, not expired)
- Invalid/expired token shows clear error message
- Password setup form enforces complexity requirements
- Password successfully updated in Supabase Auth
- User_profiles status changed to 'active'
- invite_token and invite_expires_at cleared
- User automatically logged in after activation
- User redirected to /dashboard

**Parallelization**: Tasks T058-T060 can run in parallel with T066-T069

### Tasks

#### Server Action
- [ ] [T058] [P] [US2] Create acceptInvitation Server Action at /Users/developerlabsai/Projects/RevenuePatch/DevLabs CFO/app/actions/auth.ts
- [ ] [T059] [US2] Validate invite_token exists and not expired in acceptInvitation action
- [ ] [T060] [US2] Validate password complexity (8+ chars, uppercase, lowercase, number, special char) in acceptInvitation action
- [ ] [T061] [US2] Call Supabase Admin API auth.admin.updateUserById() to set password in acceptInvitation action
- [ ] [T062] [US2] Update user_profiles: set status='active', clear invite_token and invite_expires_at in acceptInvitation action
- [ ] [T063] [US2] Update last_login timestamp in user_profiles
- [ ] [T064] [US2] Create session with Supabase Auth in acceptInvitation action
- [ ] [T065] [US2] Return success response with redirect to /dashboard

#### UI Page
- [ ] [T066] [P] [US2] Create invite-accept page at /Users/developerlabsai/Projects/RevenuePatch/DevLabs CFO/app/invite-accept/page.tsx
- [ ] [T067] [US2] Extract invite_token from URL query parameters in invite-accept page
- [ ] [T068] [US2] Verify token validity on page load (server-side check)
- [ ] [T069] [US2] Show error message for invalid/expired token with "Request New Invitation" link
- [ ] [T070] [P] [US2] Create password setup form component with validation
- [ ] [T071] [US2] Display password strength indicator
- [ ] [T072] [US2] Display password requirements checklist
- [ ] [T073] [US2] Implement form submission calling acceptInvitation action
- [ ] [T074] [US2] Handle success: redirect to /dashboard
- [ ] [T075] [US2] Handle errors: display error message

### Verification

- [ ] Clicking valid magic link loads password setup page
- [ ] Invalid token shows error: "Invitation expired or invalid"
- [ ] Expired token (>24h) shows error message
- [ ] Password form enforces complexity (8+ chars, mixed case, number, special)
- [ ] Weak passwords rejected with clear feedback
- [ ] Password successfully set in Supabase Auth
- [ ] User_profiles.status changed to 'active'
- [ ] invite_token and invite_expires_at cleared (set to null)
- [ ] User automatically logged in after submission
- [ ] User redirected to /dashboard
- [ ] Magic link cannot be reused (single-use)

---

## Phase 5: US3 - User Login

**Goal**: Users can log in with email/password and access role-appropriate dashboard.

**Prerequisites**: Phase 2 (Foundational Infrastructure) completed

**User Story**: User navigates to /login, enters email and password, submits credentials, system validates, role synced to JWT, user redirected to dashboard.

**Independent Test Criteria**:
- Login form accepts email and password
- Invalid credentials show generic error (prevents enumeration)
- Inactive users blocked with "account inactive" message
- Successful login creates JWT session with user_id and role
- Role synced from user_profiles to JWT app_metadata
- last_login timestamp updated
- User redirected to /dashboard
- Deep links preserved via redirect parameter

**Parallelization**: Tasks T076-T078 can run in parallel with T085-T087, and T094-T096

### Tasks

#### Server Action
- [ ] [T076] [P] [US3] Create loginUser Server Action at /Users/developerlabsai/Projects/RevenuePatch/DevLabs CFO/app/actions/auth.ts
- [ ] [T077] [US3] Call Supabase Auth signInWithPassword(email, password) in loginUser action
- [ ] [T078] [US3] Handle invalid credentials with generic error message in loginUser action
- [ ] [T079] [US3] Query user_profiles to get role and status in loginUser action
- [ ] [T080] [US3] Block login if status='inactive' with error message in loginUser action
- [ ] [T081] [US3] Call syncRoleToJWT() to update app_metadata in loginUser action
- [ ] [T082] [US3] Update user_profiles.last_login timestamp in loginUser action
- [ ] [T083] [US3] Create session with updated JWT in loginUser action
- [ ] [T084] [US3] Return success response with redirect URL in loginUser action

#### UI Page
- [ ] [T085] [P] [US3] Create login page at /Users/developerlabsai/Projects/RevenuePatch/DevLabs CFO/app/login/page.tsx
- [ ] [T086] [US3] Create login form with email and password fields
- [ ] [T087] [US3] Create Zod validation schema for login form
- [ ] [T088] [US3] Implement form submission calling loginUser action
- [ ] [T089] [US3] Add "Forgot Password" link to login form
- [ ] [T090] [US3] Handle success: redirect to /dashboard or deep link from redirect parameter
- [ ] [T091] [US3] Handle errors: display error message
- [ ] [T092] [US3] Add loading state during submission
- [ ] [T093] [US3] Implement rate limiting display (max 5 attempts message)

#### Logout
- [ ] [T094] [P] [US3] Create logoutUser Server Action at /Users/developerlabsai/Projects/RevenuePatch/DevLabs CFO/app/actions/auth.ts
- [ ] [T095] [US3] Call Supabase Auth signOut() in logoutUser action
- [ ] [T096] [US3] Clear session cookies in logoutUser action
- [ ] [T097] [US3] Return success response with redirect to /login
- [ ] [T098] [US3] Add logout button to navigation header
- [ ] [T099] [US3] Implement logout button click handler calling logoutUser action

### Verification

- [ ] Login form accessible at /login
- [ ] Email and password fields validate input
- [ ] Invalid credentials show error: "Invalid email or password"
- [ ] Inactive users show error: "Account inactive. Contact administrator."
- [ ] Successful login creates JWT with user_id and role in app_metadata
- [ ] Role synced from database to JWT on every login
- [ ] last_login timestamp updated in database
- [ ] User redirected to /dashboard after login
- [ ] Deep link redirect works (/login?redirect=/dashboard/admin redirects to /dashboard/admin)
- [ ] Logout button clears session and redirects to /login
- [ ] Accessing protected routes after logout redirects to /login

---

## Phase 6: US4 - Password Reset

**Goal**: Users can reset forgotten passwords via email magic link.

**Prerequisites**: Phase 5 (US3) completed

**User Story**: User clicks "Forgot Password", enters email, receives reset email with magic link, clicks link, enters new password, automatically logged in.

**Independent Test Criteria**:
- Forgot password form accepts email address
- Reset email sent regardless of email existence (security)
- Magic link contains secure single-use token
- Magic link expires after 24 hours
- Clicking valid link navigates to password reset page
- Password complexity enforced (8+ chars, mixed case, number, special)
- Password successfully updated in Supabase Auth
- Magic link invalidated after use
- User automatically logged in after reset
- All existing sessions invalidated

**Parallelization**: Tasks T100-T102 can run in parallel with T104-T106 and T110-T114 and T115-T120

### Tasks

#### Server Actions
- [ ] [T100] [P] [US4] Create sendPasswordReset Server Action at /Users/developerlabsai/Projects/RevenuePatch/DevLabs CFO/app/actions/auth.ts
- [ ] [T101] [US4] Validate email format in sendPasswordReset action
- [ ] [T102] [US4] Call Supabase Admin API auth.admin.generateLink({ type: 'recovery' }) in sendPasswordReset action
- [ ] [T103] [US4] Return success message (always, even if email doesn't exist) in sendPasswordReset action

- [ ] [T104] [P] [US4] Create resetPassword Server Action at /Users/developerlabsai/Projects/RevenuePatch/DevLabs CFO/app/actions/auth.ts
- [ ] [T105] [US4] Validate password complexity in resetPassword action
- [ ] [T106] [US4] Call Supabase Auth updateUser({ password }) in resetPassword action
- [ ] [T107] [US4] Update user_profiles.last_login timestamp in resetPassword action
- [ ] [T108] [US4] Invalidate all existing sessions for user in resetPassword action
- [ ] [T109] [US4] Create new session and return redirect to /dashboard

#### UI Pages
- [ ] [T110] [P] [US4] Create forgot-password page at /Users/developerlabsai/Projects/RevenuePatch/DevLabs CFO/app/forgot-password/page.tsx
- [ ] [T111] [US4] Create email input form in forgot-password page
- [ ] [T112] [US4] Implement form submission calling sendPasswordReset action
- [ ] [T113] [US4] Display success message: "If email exists, reset link sent"
- [ ] [T114] [US4] Add loading state during submission

- [ ] [T115] [P] [US4] Create reset-password page at /Users/developerlabsai/Projects/RevenuePatch/DevLabs CFO/app/reset-password/page.tsx
- [ ] [T116] [US4] Extract recovery token from URL query parameters
- [ ] [T117] [US4] Verify token validity on page load
- [ ] [T118] [US4] Show error for invalid/expired token
- [ ] [T119] [US4] Create password input form with confirmation field
- [ ] [T120] [US4] Display password strength indicator
- [ ] [T121] [US4] Implement form submission calling resetPassword action
- [ ] [T122] [US4] Handle success: redirect to /dashboard
- [ ] [T123] [US4] Handle errors: display error message

### Verification

- [ ] Forgot password page accessible at /forgot-password
- [ ] Email field validates format
- [ ] Submit shows: "If email exists, reset link sent" (always)
- [ ] Reset email sent with magic link for valid email
- [ ] No email sent for non-existent address (but same message shown)
- [ ] Magic link expires after 24 hours
- [ ] Clicking valid link loads password reset page
- [ ] Invalid/expired token shows clear error message
- [ ] Password form enforces complexity requirements
- [ ] Password successfully updated in Supabase Auth
- [ ] Magic link invalidated after first use (cannot reuse)
- [ ] User automatically logged in after reset
- [ ] All existing sessions invalidated on password change

---

## Phase 7: US5 - Profile Management

**Goal**: Users can view and update their profile information.

**Prerequisites**: Phase 5 (US3) completed

**User Story**: User navigates to profile settings, sees current name/email/role/last login, updates name or preferences, saves changes, receives confirmation.

**Independent Test Criteria**:
- Profile page displays user data (name, email, role, last_login)
- Email and role are read-only
- User can update full_name
- User can update preferences (theme, notifications stored as JSON)
- Changes saved to user_profiles table
- Confirmation message displayed after save
- Profile changes reflected immediately in UI

**Parallelization**: Tasks T124-T126 can run in parallel with T130-T133

### Tasks

#### Server Action
- [ ] [T124] [P] [US5] Create updateProfile Server Action at /Users/developerlabsai/Projects/RevenuePatch/DevLabs CFO/app/actions/profile.ts
- [ ] [T125] [US5] Validate user is authenticated (requireAuth) in updateProfile action
- [ ] [T126] [US5] Validate full_name (1-100 characters) in updateProfile action
- [ ] [T127] [US5] Validate preferences JSON structure in updateProfile action
- [ ] [T128] [US5] Update user_profiles record in database
- [ ] [T129] [US5] Return success response with updated profile data

#### UI Page
- [ ] [T130] [P] [US5] Create profile page at /Users/developerlabsai/Projects/RevenuePatch/DevLabs CFO/app/dashboard/profile/page.tsx
- [ ] [T131] [US5] Fetch current user profile data on page load
- [ ] [T132] [US5] Display read-only fields: email, role, last_login
- [ ] [T133] [US5] Create editable form for full_name
- [ ] [T134] [US5] Create preferences editor (theme, notifications toggle)
- [ ] [T135] [US5] Implement form submission calling updateProfile action
- [ ] [T136] [US5] Display success toast notification after save
- [ ] [T137] [US5] Handle errors: display error message
- [ ] [T138] [US5] Add loading state during save
- [ ] [T139] [US5] Refresh profile data after successful update

### Verification

- [ ] Profile page accessible at /dashboard/profile
- [ ] Current name, email, role, last_login displayed
- [ ] Email field is read-only (grayed out)
- [ ] Role field is read-only (displayed as badge)
- [ ] full_name field is editable
- [ ] Preferences (theme, notifications) are editable
- [ ] Changes saved successfully to database
- [ ] Success message displayed: "Profile updated"
- [ ] Changes reflected immediately without page refresh
- [ ] Invalid data (empty name) shows validation error

---

## Phase 8: US6 - Admin Manages Users

**Goal**: Admin can view, edit, deactivate, and delete users.

**Prerequisites**: Phase 3 (US1) completed

**User Story**: Admin navigates to User Management, views table with all users, performs actions (edit details, deactivate, reset password, delete), receives confirmation.

**Independent Test Criteria**:
- User table shows all users with search/filter
- Admin can edit user name, email, role
- Email change triggers re-invitation
- Role change validated (cannot remove last admin)
- Admin can deactivate/reactivate users
- Deactivated users blocked from login immediately
- Admin can delete users with confirmation
- Delete requires typing email address
- Cannot delete self or last admin
- All actions create audit log entries

**Parallelization**: Tasks T140-T143 can run in parallel with T151-T154 and T157-T160 and T163-T166 and T172-T174 and T178-T181 and T185-T188 and T192-T195 and T200-T203

### Tasks

#### Server Actions - Edit User
- [ ] [T140] [P] [US6] Create updateUser Server Action at /Users/developerlabsai/Projects/RevenuePatch/DevLabs CFO/app/actions/user-management.ts
- [ ] [T141] [US6] Verify current user is admin (requireAdmin) in updateUser action
- [ ] [T142] [US6] Prevent admin from editing themselves without confirmation
- [ ] [T143] [US6] Validate role change (cannot remove last admin) in updateUser action
- [ ] [T144] [US6] Fetch current user_profiles record for comparison
- [ ] [T145] [US6] If email changed: validate uniqueness and call Supabase Admin API updateUserById
- [ ] [T146] [US6] If email changed: generate new magic link for verification
- [ ] [T147] [US6] Update user_profiles record with new data
- [ ] [T148] [US6] Create audit log entry (action_type: USER_EDITED) with before/after values
- [ ] [T149] [US6] If role changed: send email notification to user
- [ ] [T150] [US6] Return success response

#### Server Actions - Deactivate/Reactivate
- [ ] [T151] [P] [US6] Create deactivateUser Server Action at /Users/developerlabsai/Projects/RevenuePatch/DevLabs CFO/app/actions/user-management.ts
- [ ] [T152] [US6] Verify current user is admin and not self-deactivating
- [ ] [T153] [US6] Update user_profiles: set status='inactive'
- [ ] [T154] [US6] Create audit log entry (action_type: USER_DEACTIVATED)
- [ ] [T155] [US6] Send email to user: "Account deactivated"
- [ ] [T156] [US6] Return success response

- [ ] [T157] [P] [US6] Create reactivateUser Server Action at /Users/developerlabsai/Projects/RevenuePatch/DevLabs CFO/app/actions/user-management.ts
- [ ] [T158] [US6] Verify current user is admin
- [ ] [T159] [US6] Update user_profiles: set status='active'
- [ ] [T160] [US6] Create audit log entry (action_type: USER_REACTIVATED)
- [ ] [T161] [US6] Send email to user: "Account reactivated"
- [ ] [T162] [US6] Return success response

#### Server Actions - Delete User
- [ ] [T163] [P] [US6] Create deleteUser Server Action at /Users/developerlabsai/Projects/RevenuePatch/DevLabs CFO/app/actions/user-management.ts
- [ ] [T164] [US6] Verify current user is admin
- [ ] [T165] [US6] Prevent self-deletion
- [ ] [T166] [US6] Validate not deleting last admin (count admins)
- [ ] [T167] [US6] Fetch user_profiles record for audit log
- [ ] [T168] [US6] Call Supabase Admin API auth.admin.deleteUser()
- [ ] [T169] [US6] Delete user_profiles record
- [ ] [T170] [US6] Create audit log entry (action_type: USER_DELETED) with user details
- [ ] [T171] [US6] Return success response

#### Server Actions - Reset Password
- [ ] [T172] [P] [US6] Create adminResetPassword Server Action at /Users/developerlabsai/Projects/RevenuePatch/DevLabs CFO/app/actions/user-management.ts
- [ ] [T173] [US6] Verify current user is admin
- [ ] [T174] [US6] Call Supabase Admin API auth.admin.generateLink({ type: 'recovery' })
- [ ] [T175] [US6] Invalidate any existing invite_token for user
- [ ] [T176] [US6] Create audit log entry (action_type: PASSWORD_RESET)
- [ ] [T177] [US6] Return success response

#### UI Components - Edit Modal
- [ ] [T178] [P] [US6] Create EditUserModal component at /Users/developerlabsai/Projects/RevenuePatch/DevLabs CFO/app/dashboard/admin/users/components/EditUserModal.tsx
- [ ] [T179] [US6] Pre-fill form with current user data (name, email, role)
- [ ] [T180] [US6] Create form fields: full_name, email, role dropdown
- [ ] [T181] [US6] Implement form submission calling updateUser action
- [ ] [T182] [US6] Display confirmation for role changes
- [ ] [T183] [US6] Handle success: close modal, refresh user list, show toast
- [ ] [T184] [US6] Handle errors: display error message

#### UI Components - Delete Confirmation
- [ ] [T185] [P] [US6] Create DeleteUserDialog component at /Users/developerlabsai/Projects/RevenuePatch/DevLabs CFO/app/dashboard/admin/users/components/DeleteUserDialog.tsx
- [ ] [T186] [US6] Display warning message: "Type email to confirm deletion"
- [ ] [T187] [US6] Create email confirmation input field
- [ ] [T188] [US6] Disable delete button until email matches exactly
- [ ] [T189] [US6] Implement delete button calling deleteUser action
- [ ] [T190] [US6] Handle success: close dialog, refresh user list, show toast
- [ ] [T191] [US6] Handle errors: display error message

#### UI Components - User Actions
- [ ] [T192] [P] [US6] Create UserActionsDropdown component at /Users/developerlabsai/Projects/RevenuePatch/DevLabs CFO/app/dashboard/admin/users/components/UserActionsDropdown.tsx
- [ ] [T193] [US6] Add "Edit" action opening EditUserModal
- [ ] [T194] [US6] Add "Deactivate" action calling deactivateUser (if user active)
- [ ] [T195] [US6] Add "Reactivate" action calling reactivateUser (if user inactive)
- [ ] [T196] [US6] Add "Reset Password" action calling adminResetPassword
- [ ] [T197] [US6] Add "Delete" action opening DeleteUserDialog
- [ ] [T198] [US6] Disable "Deactivate" and "Delete" for current admin user
- [ ] [T199] [US6] Show confirmation toast for all actions

#### UI - User List Enhancements
- [ ] [T200] [P] [US6] Add search functionality to user list page (filter by name or email)
- [ ] [T201] [US6] Add role filter dropdown (admin/executive/analyst/all)
- [ ] [T202] [US6] Add status filter dropdown (active/inactive/all)
- [ ] [T203] [US6] Add column sorting (name, email, role, status, last_login)
- [ ] [T204] [US6] Add pagination if more than 50 users
- [ ] [T205] [US6] Display role badges with color coding
- [ ] [T206] [US6] Display status badges with color coding
- [ ] [T207] [US6] Gray out inactive users in table

### Verification

- [ ] User list displays all users correctly
- [ ] Search filters by name or email in real-time
- [ ] Role filter works (admin/executive/analyst/all)
- [ ] Status filter works (active/inactive/all)
- [ ] Column sorting works for all columns
- [ ] Edit modal pre-fills with current data
- [ ] Email change triggers new magic link
- [ ] Role change validated (cannot remove last admin)
- [ ] Role change sends notification email
- [ ] Deactivate sets status='inactive' and logs action
- [ ] Deactivated user blocked on next login attempt
- [ ] Reactivate sets status='active' and logs action
- [ ] Delete requires typing email confirmation
- [ ] Cannot delete self (admin)
- [ ] Cannot delete last admin
- [ ] Delete removes from Supabase Auth and user_profiles
- [ ] Reset password sends email with magic link
- [ ] All actions create audit log entries
- [ ] Audit logs include actor_id, target_user_id, action_details

---

## Phase 9: Polish & Cross-Cutting Concerns

**Goal**: Testing, documentation, error handling, and production deployment.

**Prerequisites**: All user story phases (3-8) completed

**Parallelization**: Tasks T208-T217 (tests) can run in parallel, tasks T218-T222 (docs) can run in parallel

### Tasks

#### Testing
- [ ] [T208] [P] Write unit tests for auth helpers (getCurrentUser, requireAdmin, syncRoleToJWT) at /Users/developerlabsai/Projects/RevenuePatch/DevLabs CFO/lib/auth/__tests__/helpers.test.ts
- [ ] [T209] [P] Write integration tests for inviteUser Server Action at /Users/developerlabsai/Projects/RevenuePatch/DevLabs CFO/app/actions/__tests__/user-management.test.ts
- [ ] [T210] [P] Write integration tests for loginUser Server Action at /Users/developerlabsai/Projects/RevenuePatch/DevLabs CFO/app/actions/__tests__/auth.test.ts
- [ ] [T211] [P] Write E2E test for login flow (Playwright/Cypress) at /Users/developerlabsai/Projects/RevenuePatch/DevLabs CFO/tests/e2e/login.spec.ts
- [ ] [T212] [P] Write E2E test for invitation flow at /Users/developerlabsai/Projects/RevenuePatch/DevLabs CFO/tests/e2e/invitation.spec.ts
- [ ] [T213] [P] Write E2E test for password reset flow at /Users/developerlabsai/Projects/RevenuePatch/DevLabs CFO/tests/e2e/password-reset.spec.ts
- [ ] [T214] [P] Write RBAC enforcement tests (admin vs non-admin) at /Users/developerlabsai/Projects/RevenuePatch/DevLabs CFO/tests/rbac.test.ts
- [ ] [T215] [P] Write edge case tests (expired tokens, last admin protection) at /Users/developerlabsai/Projects/RevenuePatch/DevLabs CFO/tests/edge-cases.test.ts
- [ ] [T216] Run performance tests (login <2s, middleware <50ms, audit query <500ms)
- [ ] [T217] Run security audit (rate limiting, XSS protection, CSRF tokens)

#### Documentation
- [ ] [T218] [P] Create admin bootstrap SQL script at /Users/developerlabsai/Projects/RevenuePatch/DevLabs CFO/docs/setup-initial-admin.sql
- [ ] [T219] [P] Create environment variables documentation at /Users/developerlabsai/Projects/RevenuePatch/DevLabs CFO/docs/environment-setup.md
- [ ] [T220] [P] Create API documentation for Server Actions at /Users/developerlabsai/Projects/RevenuePatch/DevLabs CFO/docs/api-auth.md
- [ ] [T221] [P] Create user management guide at /Users/developerlabsai/Projects/RevenuePatch/DevLabs CFO/docs/user-management-guide.md
- [ ] [T222] [P] Update README with authentication section at /Users/developerlabsai/Projects/RevenuePatch/DevLabs CFO/README.md

#### Error Handling & Monitoring
- [ ] [T223] Add error boundary for auth pages at /Users/developerlabsai/Projects/RevenuePatch/DevLabs CFO/app/login/error.tsx
- [ ] [T224] Add error boundary for admin pages at /Users/developerlabsai/Projects/RevenuePatch/DevLabs CFO/app/dashboard/admin/error.tsx
- [ ] [T225] Implement global error handler for Server Actions
- [ ] [T226] Add rate limiting to login endpoint (5 attempts per 15 min)
- [ ] [T227] Add rate limiting to password reset endpoint
- [ ] [T228] Add account lockout after 5 failed login attempts (unlock after 30 min)
- [ ] [T229] Add session expiry warning (5 min before expiration)
- [ ] [T230] Add logging for failed login attempts
- [ ] [T231] Add logging for admin actions (separate from audit_logs)

#### Audit Log Viewer
- [ ] [T232] Create audit log page at /Users/developerlabsai/Projects/RevenuePatch/DevLabs CFO/app/dashboard/admin/audit-logs/page.tsx
- [ ] [T233] Fetch audit logs with pagination (50 entries per page)
- [ ] [T234] Display table: timestamp, actor, action, target user, details
- [ ] [T235] Add filter by action_type dropdown
- [ ] [T236] Add filter by date range picker
- [ ] [T237] Add search by actor or target user
- [ ] [T238] Display action_details JSON in expandable row
- [ ] [T239] Add export to CSV functionality

#### Production Deployment
- [ ] [T240] Verify all environment variables set in production
- [ ] [T241] Run database migrations in production
- [ ] [T242] Create initial admin user via bootstrap script
- [ ] [T243] Verify Supabase email delivery in production
- [ ] [T244] Test login flow in production
- [ ] [T245] Test invitation flow in production
- [ ] [T246] Test password reset flow in production
- [ ] [T247] Verify middleware protecting routes in production
- [ ] [T248] Verify admin routes blocked for non-admins in production
- [ ] [T249] Monitor first week of production usage for errors

### Verification

- [ ] All unit tests pass (100% coverage on auth helpers)
- [ ] All integration tests pass (Server Actions)
- [ ] All E2E tests pass (login, invitation, password reset)
- [ ] RBAC tests verify admin-only access
- [ ] Edge case tests pass (expired tokens, last admin)
- [ ] Performance benchmarks met (login <2s, middleware <50ms)
- [ ] Security audit passes (no XSS, CSRF, brute force vulnerabilities)
- [ ] Bootstrap script documented and tested
- [ ] Environment variables documented
- [ ] API documentation complete
- [ ] User guide written
- [ ] README updated
- [ ] Error boundaries handle auth errors gracefully
- [ ] Rate limiting prevents brute force attacks
- [ ] Account lockout works after 5 failed attempts
- [ ] Session expiry warning shown 5 min before
- [ ] Audit log viewer displays all admin actions
- [ ] Production deployment successful
- [ ] Initial admin user created in production
- [ ] All flows verified in production environment

---

## Dependencies

### Critical Path (Sequential Phases)

```
Phase 1 (Setup & Dependencies)
    ↓
Phase 2 (Foundational Infrastructure)
    ↓
Phase 3 (US1 - Admin Invites) ─┐
    ↓                           │
Phase 4 (US2 - Accepts Invite) │
                                ├─→ Phase 9 (Polish & Testing)
Phase 5 (US3 - User Login) ────┤       ↓
    ↓                           │   Production Deployment
Phase 6 (US4 - Password Reset) │
    ↓                           │
Phase 7 (US5 - Profile Mgmt) ──┤
    ↓                           │
Phase 8 (US6 - Admin Manages) ─┘
```

### User Story Independence

After Phase 2 (Foundational Infrastructure), these user stories can be developed in parallel:

**Parallel Group A** (independent):
- Phase 3 (US1) - Admin Invites New User
- Phase 5 (US3) - User Login

**Parallel Group B** (requires Phase 5):
- Phase 6 (US4) - Password Reset
- Phase 7 (US5) - Profile Management

**Sequential**:
- Phase 4 (US2) requires Phase 3 (US1) - invitation flow
- Phase 8 (US6) requires Phase 3 (US1) - admin management

### Within-Phase Parallelization

**Phase 1 Setup**: T001-T003 (3 parallel tasks)
**Phase 2 Foundational**: T019-T028 (10 parallel tasks)
**Phase 3 US1**: T036-T038 + T045-T047 + T052 (7 parallel tasks)
**Phase 4 US2**: T058-T060 + T066-T069 (7 parallel tasks)
**Phase 5 US3**: T076-T078 + T085-T087 + T094-T096 (9 parallel tasks)
**Phase 6 US4**: T100-T102 + T104-T106 + T110-T114 + T115-T120 (16 parallel tasks)
**Phase 7 US5**: T124-T126 + T130-T133 (7 parallel tasks)
**Phase 8 US6**: T140-T143 + T151-T154 + T157-T160 + T163-T166 + T172-T174 + T178-T181 + T185-T188 + T192-T195 + T200-T203 (37 parallel tasks)
**Phase 9 Polish**: T208-T217 + T218-T222 (15 parallel tasks)

**Total Parallelization Opportunities**: 78 tasks (31% of total)

**Estimated speedup with parallelization**: ~40% reduction in development time (7 days → 4-5 days with team)

---

## Success Criteria

### Functional Requirements (from spec.md)

**FR-1: User Login**
- [ ] Login form accepts email and password
- [ ] Invalid credentials display generic error message
- [ ] Inactive users blocked with message
- [ ] JWT session created with user_id and role
- [ ] User redirected to dashboard
- [ ] Rate limited (5 attempts per 15 min)
- [ ] Account locked after excessive attempts
- [ ] last_login timestamp updated

**FR-2: Password Reset**
- [ ] Password reset form accepts email
- [ ] Email sent regardless of existence
- [ ] Magic link secure and single-use
- [ ] Link expires after 24 hours
- [ ] Password complexity enforced
- [ ] Password updated in Supabase Auth
- [ ] Link invalidated after use
- [ ] User auto-logged in after reset
- [ ] All sessions invalidated

**FR-3: User Logout**
- [ ] Logout button accessible
- [ ] JWT invalidated
- [ ] User redirected to login
- [ ] Session data cleared
- [ ] Protected routes redirect after logout

**FR-4: Profile Management**
- [ ] Profile displays name, email, role, last_login
- [ ] full_name editable
- [ ] Preferences editable (theme, notifications)
- [ ] Changes saved successfully
- [ ] Confirmation message displayed
- [ ] Changes reflected immediately
- [ ] Email changes not allowed (read-only)

**FR-5: Protected Route Authentication**
- [ ] All routes except public routes protected
- [ ] Unauthenticated redirected to /login
- [ ] Auth check on every page load
- [ ] JWT validated server-side
- [ ] Expired tokens redirect with message
- [ ] Deep links preserved
- [ ] Inactive users blocked

**FR-6: Role-Based Access Control**
- [ ] Middleware checks role from JWT
- [ ] Only admin can access /dashboard/admin/*
- [ ] Non-admin redirected with error
- [ ] Role displayed in UI
- [ ] Role verified server-side on API calls
- [ ] Audit log records admin actions

**FR-7: Session Management**
- [ ] Sessions expire after 7 days inactivity
- [ ] Session extended with activity
- [ ] Warning before expiration (5 min)
- [ ] Expired sessions redirect to login
- [ ] Sessions invalidated on password change
- [ ] "Remember me" extends to 30 days

**FR-8: Admin User List & Search**
- [ ] User table with name, email, role, status, last_login, actions
- [ ] Shows all users
- [ ] Search by name or email
- [ ] Filter by role
- [ ] Filter by status
- [ ] Column sorting
- [ ] Pagination if >50 users
- [ ] Color-coded badges

**FR-9: Admin Add User (Invitation)**
- [ ] "Add User" button opens modal
- [ ] Form collects email, name, role
- [ ] Email validation
- [ ] Duplicate emails rejected
- [ ] User created in Supabase Auth
- [ ] user_profiles created with status='inactive'
- [ ] Magic link generated and stored
- [ ] invite_expires_at set to +24h
- [ ] Invitation email sent
- [ ] Success confirmation shown
- [ ] Audit log created

**FR-10: Admin Edit User**
- [ ] Edit modal pre-filled
- [ ] Editable: name, email, role
- [ ] Email change triggers re-invitation
- [ ] Role change validated (last admin)
- [ ] Changes saved
- [ ] Email notification on role change
- [ ] Success confirmation
- [ ] Audit log created

**FR-11: Admin Deactivate/Reactivate User**
- [ ] Deactivate sets status='inactive'
- [ ] Active sessions invalidated immediately
- [ ] Deactivated users cannot log in
- [ ] Reactivate sets status='active'
- [ ] Inactive users grayed out
- [ ] Cannot deactivate self
- [ ] Audit logs for both actions

**FR-12: Admin Delete User**
- [ ] Confirmation modal with warning
- [ ] Requires typing email
- [ ] user_profiles deleted
- [ ] Supabase Auth deleted
- [ ] Active sessions invalidated
- [ ] Cannot delete self
- [ ] Cannot delete last admin
- [ ] Audit log created
- [ ] Historical data preserved

**FR-13: Admin Reset User Password**
- [ ] Generates new magic link
- [ ] Previous links invalidated
- [ ] Email sent to user
- [ ] Link expires in 24h
- [ ] User can set new password
- [ ] All sessions invalidated
- [ ] Confirmation shown to admin
- [ ] Audit log created

**FR-14: Initial Admin Setup**
- [ ] SQL script provided
- [ ] Creates user in Supabase Auth
- [ ] Creates user_profiles with role='admin'
- [ ] Clear instructions included
- [ ] Idempotent (safe to run multiple times)
- [ ] Password reset instructions documented

### Performance Targets

- [ ] **Login Performance**: <2 seconds from submission to dashboard
- [ ] **Password Reset Success**: 95% complete within 5 minutes
- [ ] **Session Stability**: <1% unexpected logout
- [ ] **Security Compliance**: Zero unauthorized access
- [ ] **Admin Efficiency**: Add user in <60 seconds
- [ ] **User Activation**: 90% complete within 24 hours
- [ ] **Protected Routes**: 100% unauthorized attempts blocked
- [ ] **Role Enforcement**: 100% access checks pass
- [ ] **Audit Coverage**: 100% admin actions logged
- [ ] **System Availability**: 99.9% uptime

### Security Requirements

- [ ] Passwords encrypted (Supabase bcrypt)
- [ ] JWT in httpOnly cookies
- [ ] Service role key never exposed
- [ ] RLS policies enforce isolation
- [ ] Rate limiting on login/reset
- [ ] Generic error messages (no enumeration)
- [ ] Magic links expire after 24h
- [ ] Tokens single-use and invalidated

### Quality Standards

- [ ] All unit tests pass
- [ ] All integration tests pass
- [ ] All E2E tests pass
- [ ] TypeScript strict mode, no errors
- [ ] Zod validation on all inputs
- [ ] Error handling for edge cases
- [ ] Documentation complete

---

## MVP Scope

**Minimum Viable Product** (Day 1-3, 81 tasks):

### Required for MVP

**Phase 1: Setup & Dependencies** (18 tasks)
- All tasks T001-T018 required

**Phase 2: Foundational Infrastructure** (17 tasks)
- All tasks T019-T035 required

**Phase 3: US1 - Admin Invites New User** (22 tasks)
- All tasks T036-T057 required

**Phase 5: US3 - User Login** (24 tasks)
- All tasks T076-T099 required

**Total MVP Tasks**: 81 tasks
**Estimated MVP Duration**: 3 days

### MVP Deliverables

1. **Admin can create users** via invitation flow
2. **Users can log in** with email/password
3. **Sessions protected** via middleware
4. **Basic RBAC** (admin vs non-admin routes)
5. **Audit logging** for user creation

### Post-MVP Incremental Additions

**Tier 1** (Day 4, high value):
- Phase 4: US2 - Invitation acceptance (20 tasks)
- Phase 6: US4 - Password reset (24 tasks)

**Tier 2** (Day 5, moderate value):
- Phase 7: US5 - Profile management (16 tasks)
- Phase 8: US6 - Admin user management (68 tasks)

**Tier 3** (Day 6-7, polish):
- Phase 9: Testing, documentation, monitoring (42 tasks)

---

## Implementation Strategy

### Suggested Timeline (Day 1-7)

**Day 1: Setup & Foundation**
- Morning: Phase 1 (Setup & Dependencies) - T001-T018
- Afternoon: Phase 2 (Foundational Infrastructure) - T019-T035
- **Checkpoint**: Middleware protecting routes, auth helpers working

**Day 2: Admin Invitation Flow**
- Morning: Phase 3 Server Actions - T036-T044
- Afternoon: Phase 3 UI Components - T045-T057
- **Checkpoint**: Admin can invite users, magic links sent

**Day 3: User Login & MVP Completion**
- Morning: Phase 5 Login - T076-T093
- Afternoon: Phase 5 Logout - T094-T099
- **Checkpoint**: MVP complete - admin invites, users log in

**Day 4: Invitation Acceptance & Password Reset**
- Morning: Phase 4 (US2) - T058-T075
- Afternoon: Phase 6 (US4) - T100-T123
- **Checkpoint**: Full user lifecycle (invite → accept → login → reset)

**Day 5: Profile & User Management**
- Morning: Phase 7 (US5) - T124-T139
- Afternoon: Phase 8 Start (Server Actions) - T140-T177
- **Checkpoint**: Users can manage profiles, admin can edit/deactivate

**Day 6: Admin User Management UI**
- Morning: Phase 8 UI Components - T178-T199
- Afternoon: Phase 8 Enhancements - T200-T207
- **Checkpoint**: Full admin user management with search/filter

**Day 7: Polish, Testing & Deploy**
- Morning: Phase 9 Testing - T208-T217
- Afternoon: Phase 9 Documentation & Deployment - T218-T249
- **Checkpoint**: Production-ready, tested, documented

### What Can Be Added Incrementally

**Week 1 Post-Launch**:
- Audit log viewer (T232-T239)
- Enhanced error handling (T223-T231)
- Email customization

**Week 2-4 Enhancements**:
- Two-factor authentication (2FA)
- Session management dashboard
- Login history tracking
- Bulk user import via CSV
- Custom email templates

### Which Stories Provide Most Value

**Highest Value** (MVP Core):
1. **US1 - Admin Invites** (unlocks user onboarding)
2. **US3 - User Login** (unlocks system access)

**High Value** (Week 1):
3. **US4 - Password Reset** (reduces support burden)
4. **US2 - Invitation Acceptance** (completes onboarding)

**Medium Value** (Week 2):
5. **US6 - Admin Manages Users** (operational efficiency)
6. **US5 - Profile Management** (user autonomy)

**Lower Value** (Nice to Have):
7. Testing & Documentation (long-term maintainability)
8. Audit Log Viewer (compliance, not immediate need)

---

## Notes

- **Task IDs**: Sequential T001-T249 for easy tracking
- **[P] Tag**: Indicates task can be parallelized with others in same phase
- **[Story] Tag**: Links task to user story (US1-US6)
- **File Paths**: All paths are absolute from project root
- **Verification**: Each phase has specific success criteria
- **Dependencies**: Clear critical path with parallelization opportunities

---

## Quick Reference

**Total Tasks**: 249
**MVP Tasks**: 81 (Setup + Foundation + US1 + US3)
**Estimated Duration**: 5-7 days (3 days for MVP)
**Parallelizable Tasks**: 78 tasks (31% of total)
**User Stories**: 6 (US1-US6)
**Phases**: 9 (Setup → Polish)

---

**Last Updated**: 2026-02-13
**Status**: Ready for Implementation
**Next Step**: Create feature branch `2-authentication` and begin Phase 1
