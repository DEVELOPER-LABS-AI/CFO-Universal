# Feature Specification: Authentication & Admin User Management

**Status**: Updated
**Created**: 2026-02-12
**Last Updated**: 2026-02-13

---

## Overview

### Feature Summary

An internal authentication and admin user management system that enables secure login, password recovery, and centralized user administration for company executives accessing the DevLabs CFO platform.

### Business Value

Provides secure, role-based access control for an internal executive dashboard. Eliminates the complexity of public registration by implementing invitation-only user creation through an admin portal. Reduces IT overhead through self-service password reset while maintaining enterprise-grade security. Enables controlled access with clear role definitions (admin, executive, analyst) for different levels of financial data access.

### Target Users

**Primary Users:**
- **Executives**: View and analyze financial data, no administrative privileges
- **Analysts**: Access financial reports and metrics (potentially with limited scope)
- **Admins**: Full access including user management, system configuration

**Secondary Users:**
- **IT Support**: Initial system setup and troubleshooting
- **New Users**: Receiving invitations and setting up their accounts

---

## User Scenarios

### Primary Use Cases

**Scenario 1: Admin Invites New User**
- **Actor**: Admin user
- **Goal**: Add a new executive to the system
- **Steps**:
  1. Navigate to Admin → User Management (/dashboard/admin/users)
  2. Click "Add User" button
  3. Enter new user's email, full name, and role (executive/analyst/admin)
  4. Submit form
  5. System generates secure magic link and sends invitation email
  6. New user receives email with invitation link
- **Expected Outcome**: User record created with pending status, invitation email sent, magic link expires in 24 hours

**Scenario 2: New User Accepts Invitation**
- **Actor**: Invited user
- **Goal**: Activate account and set password
- **Steps**:
  1. Click magic link in invitation email
  2. Redirected to password setup page
  3. Enter new password (meeting complexity requirements)
  4. Confirm password
  5. Submit form
  6. Automatically logged in
- **Expected Outcome**: Password set, account activated, magic link invalidated, user logged into dashboard

**Scenario 3: User Login**
- **Actor**: Any active user
- **Goal**: Access their CFO dashboard
- **Steps**:
  1. Navigate to login page
  2. Enter email and password
  3. Submit credentials
  4. System validates credentials
  5. Redirected to dashboard based on role
- **Expected Outcome**: User authenticated, role-based dashboard loaded, session established with JWT token containing user_id and role

**Scenario 4: Password Reset**
- **Actor**: User who forgot password
- **Goal**: Regain access to their account
- **Steps**:
  1. Click "Forgot Password" on login page
  2. Enter email address
  3. Receive password reset email with magic link
  4. Click reset link in email
  5. Enter new password meeting requirements
  6. Confirm new password
  7. Automatically logged in
- **Expected Outcome**: Password updated, magic link invalidated, user logged in successfully

**Scenario 5: Profile Management**
- **Actor**: Logged-in user
- **Goal**: Update personal information
- **Steps**:
  1. Navigate to profile settings
  2. Update name or preferences
  3. Save changes
  4. Receive confirmation
- **Expected Outcome**: Profile information updated in database, changes reflected throughout application

**Scenario 6: Admin Manages Users**
- **Actor**: Admin user
- **Goal**: View, edit, deactivate, or delete users
- **Steps**:
  1. Navigate to Admin → User Management
  2. View table of all users with search/filter options
  3. Perform action: Edit user details, Deactivate account, Reset password, or Delete user
  4. Confirm action if destructive
  5. Receive confirmation
- **Expected Outcome**: User record updated, audit log entry created, admin receives confirmation

### Edge Cases

**Expired Magic Link**
- Invitation or password reset links expire after 24 hours. Show error with option to request new link (admin must resend for invitations).

**Invalid Magic Link Token**
- Handle tampered or already-used tokens gracefully with clear error messaging.

**Concurrent Login Sessions**
- Allow multiple active sessions per user but display last login time in profile for security awareness.

**User Deactivation During Session**
- When admin deactivates a user, immediately invalidate their session and redirect to login with appropriate message.

**Admin Attempts to Delete Self**
- Prevent admins from deleting their own account. Require another admin to perform deletion.

**Last Admin User**
- Prevent deletion or role change of the last admin user to avoid lockout. Require at least one admin at all times.

**Non-Admin Accessing Admin Routes**
- Users without admin role attempting to access /dashboard/admin/* are redirected to dashboard with error message.

**Password Reset for Inactive User**
- Inactive users can still reset passwords but remain inactive. Login will be blocked with clear message to contact admin.

---

## Functional Requirements

### Core Requirements

**FR-1: User Login**
- **Description**: Active users can authenticate with email and password
- **Acceptance Criteria**:
  - [ ] Login form accepts email and password
  - [ ] Invalid credentials display generic error message (prevents user enumeration)
  - [ ] Inactive users are blocked from login with message to contact admin
  - [ ] Successful login creates JWT session token with user_id and role claims
  - [ ] User redirected to role-appropriate dashboard after successful login
  - [ ] Failed login attempts are rate-limited (max 5 attempts per 15 minutes)
  - [ ] Account locked temporarily after excessive failed attempts (unlocks after 30 minutes)
  - [ ] Last login timestamp updated in user_profiles table

**FR-2: Password Reset**
- **Description**: Users can reset forgotten passwords via email magic link
- **Acceptance Criteria**:
  - [ ] Password reset form accepts email address
  - [ ] Reset email sent regardless of whether email exists (security best practice)
  - [ ] Magic link contains secure, single-use token (UUID v4)
  - [ ] Magic link expires after 24 hours
  - [ ] Clicking valid link navigates to password setup page
  - [ ] New password must meet complexity requirements (8+ chars, uppercase, lowercase, number, special char)
  - [ ] Password successfully updated in Supabase Auth
  - [ ] Magic link invalidated immediately after use
  - [ ] User automatically logged in after password set
  - [ ] All existing sessions invalidated upon password change

**FR-3: User Logout**
- **Description**: Users can terminate their session
- **Acceptance Criteria**:
  - [ ] Logout button accessible from navigation menu on all authenticated pages
  - [ ] Clicking logout invalidates JWT token
  - [ ] User redirected to login page after logout
  - [ ] Session data cleared from client
  - [ ] Accessing protected routes after logout redirects to login

**FR-4: Profile Management**
- **Description**: Users can view and update their profile information
- **Acceptance Criteria**:
  - [ ] Profile page displays current name, email, role (read-only), and last login
  - [ ] Users can update their full name
  - [ ] Users can update preferences (theme, notifications - stored as JSON)
  - [ ] Changes saved successfully to user_profiles table
  - [ ] Confirmation message displayed after successful update
  - [ ] Profile changes reflected immediately in UI
  - [ ] Email changes are not allowed (admin-only operation)

**FR-5: Protected Route Authentication**
- **Description**: System prevents unauthorized access to protected pages
- **Acceptance Criteria**:
  - [ ] All routes except /login, /forgot-password, /reset-password, /invite-accept are protected
  - [ ] Unauthenticated users redirected to /login
  - [ ] Authentication check occurs on every page load via middleware
  - [ ] JWT token validated on server-side for each request
  - [ ] Expired tokens redirect to login with "session expired" message
  - [ ] Deep links preserved - users redirected to intended page after login
  - [ ] Inactive users blocked from all protected routes

**FR-6: Role-Based Access Control**
- **Description**: System enforces role-based permissions for admin routes
- **Acceptance Criteria**:
  - [ ] Middleware checks user role from JWT claims on admin route access
  - [ ] Only users with 'admin' role can access /dashboard/admin/* routes
  - [ ] Non-admin users attempting admin access are redirected with error message
  - [ ] Role displayed in navigation header for user awareness
  - [ ] Role verified server-side on every admin API call
  - [ ] Audit log records admin actions (user created, edited, deleted, role changed)

**FR-7: Session Management**
- **Description**: System manages user sessions securely with automatic expiration
- **Acceptance Criteria**:
  - [ ] Sessions expire after 7 days of inactivity by default
  - [ ] Session extended automatically with user activity
  - [ ] Users warned before session expiration (5 minutes prior)
  - [ ] Expired sessions redirect to login with message
  - [ ] Sessions invalidated on password change
  - [ ] "Remember me" option extends session to 30 days

**FR-8: Admin User List & Search**
- **Description**: Admins can view and search all users in the system
- **Acceptance Criteria**:
  - [ ] User management page displays table with: name, email, role, status, last_login, actions
  - [ ] Table shows all users across organization
  - [ ] Search functionality filters by name or email (real-time)
  - [ ] Filter dropdown for role (admin/executive/analyst/all)
  - [ ] Filter dropdown for status (active/inactive/all)
  - [ ] Sorting by column (name, email, role, status, last login)
  - [ ] Pagination if more than 50 users
  - [ ] Role and status displayed with color-coded badges

**FR-9: Admin Add User (Invitation)**
- **Description**: Admins can invite new users via email magic link
- **Acceptance Criteria**:
  - [ ] "Add User" button opens modal with form
  - [ ] Form collects: email, full_name, role (dropdown: admin/executive/analyst)
  - [ ] Email validation prevents invalid formats
  - [ ] Duplicate email addresses rejected with clear error
  - [ ] Submitting form creates user record in Supabase Auth with random password
  - [ ] User record created in user_profiles with status='inactive'
  - [ ] Secure magic link token generated (UUID v4) and stored in invite_token
  - [ ] invite_expires_at set to 24 hours from now
  - [ ] Invitation email sent with magic link
  - [ ] Admin sees success confirmation with user added to table
  - [ ] Audit log entry created: "User [email] invited by [admin_email]"

**FR-10: Admin Edit User**
- **Description**: Admins can modify user details
- **Acceptance Criteria**:
  - [ ] Edit button opens modal pre-filled with current user data
  - [ ] Editable fields: full_name, email, role
  - [ ] Email changes trigger re-invitation flow (new magic link sent)
  - [ ] Role changes validated (cannot remove last admin)
  - [ ] Changes saved to user_profiles and Supabase Auth
  - [ ] User notified via email if role changed
  - [ ] Admin sees success confirmation
  - [ ] Audit log entry created: "User [email] modified by [admin_email] - changed [field]: [old] → [new]"

**FR-11: Admin Deactivate/Reactivate User**
- **Description**: Admins can disable user access without deleting account
- **Acceptance Criteria**:
  - [ ] Deactivate action sets status='inactive' in user_profiles
  - [ ] Active sessions for deactivated user invalidated immediately
  - [ ] Deactivated users cannot log in (blocked with "account deactivated" message)
  - [ ] Reactivate action sets status='active' and user can log in again
  - [ ] User list shows inactive users with grayed-out styling
  - [ ] Admin cannot deactivate themselves
  - [ ] Audit log entry created for both deactivate and reactivate actions

**FR-12: Admin Delete User**
- **Description**: Admins can permanently remove users from the system
- **Acceptance Criteria**:
  - [ ] Delete action requires confirmation modal with warning
  - [ ] Confirmation requires typing user's email to proceed
  - [ ] User record deleted from user_profiles table
  - [ ] User record deleted from Supabase Auth
  - [ ] Active sessions for deleted user invalidated immediately
  - [ ] Admin cannot delete themselves
  - [ ] Cannot delete last admin user (validation prevents)
  - [ ] Audit log entry created: "User [email] deleted by [admin_email]"
  - [ ] Historical data (financial records) not deleted - only user access removed

**FR-13: Admin Reset User Password**
- **Description**: Admins can send password reset magic link to any user
- **Acceptance Criteria**:
  - [ ] Reset password action generates new magic link
  - [ ] Previous magic links for user invalidated
  - [ ] Password reset email sent to user
  - [ ] Magic link expires in 24 hours
  - [ ] User can set new password via link
  - [ ] All existing sessions for user invalidated
  - [ ] Admin sees confirmation that reset email sent
  - [ ] Audit log entry created: "Password reset initiated for [email] by [admin_email]"

**FR-14: Initial Admin Setup**
- **Description**: First admin user created via database script for system bootstrap
- **Acceptance Criteria**:
  - [ ] SQL script provided in documentation
  - [ ] Script creates user in Supabase Auth with email and hashed password
  - [ ] Script creates user_profiles record with role='admin', status='active'
  - [ ] Script includes clear instructions and example values
  - [ ] Script can be run multiple times safely (idempotent)
  - [ ] Documentation includes password reset instructions for initial admin

### Data Requirements

**DR-1: User Authentication Data**
- **Description**: User credentials and authentication state managed by Supabase Auth
- **Key Attributes**:
  - User ID (UUID, primary key)
  - Email (unique, required)
  - Encrypted password (managed by Supabase)
  - Created at timestamp
  - Updated at timestamp
- **Validation Rules**:
  - Email must be valid format
  - Email must be unique across all users
  - Password minimum 8 characters with complexity requirements (uppercase, lowercase, number, special char)

**DR-2: User Profile Data**
- **Description**: Extended user information and system access control
- **Key Attributes**:
  - User ID (links to Supabase Auth, unique)
  - Full name (required, 1-100 characters)
  - Role (enum: 'admin', 'executive', 'analyst')
  - Status (enum: 'active', 'inactive')
  - Last login (timestamp, nullable)
  - Invite token (UUID, nullable - used for magic links)
  - Invite expires at (timestamp, nullable)
  - Preferences (JSON, nullable - theme, notifications, etc.)
  - Created at timestamp
  - Updated at timestamp
- **Validation Rules**:
  - Full name required, 1-100 characters
  - Role must be one of: admin, executive, analyst
  - Status must be one of: active, inactive
  - User ID must exist in Supabase Auth
  - Invite token must be UUID v4 format if present
  - Invite expires at must be future timestamp if invite token present

**DR-3: Audit Log Data**
- **Description**: Records of administrative actions for security and compliance
- **Key Attributes**:
  - Log ID (UUID, primary key)
  - Admin user ID (who performed action)
  - Target user ID (who was affected, nullable for system actions)
  - Action type (enum: user_created, user_edited, user_deleted, user_deactivated, user_reactivated, role_changed, password_reset)
  - Action details (JSON - old values, new values, specific changes)
  - IP address (for security tracking)
  - Created at timestamp
- **Validation Rules**:
  - Admin user ID must exist
  - Action type must be valid enum value
  - Action details must be valid JSON

---

## Success Criteria

### Measurable Outcomes

- [ ] **Login Performance**: Users can log in within 2 seconds from credential submission
- [ ] **Password Reset Success**: 95% of password reset requests complete successfully within 5 minutes
- [ ] **Session Stability**: Less than 1% of sessions experience unexpected logout
- [ ] **Security Compliance**: Zero unauthorized access to organization data or admin functions
- [ ] **Admin Efficiency**: Admins can add new users in under 60 seconds
- [ ] **User Activation**: 90% of invited users complete activation within 24 hours
- [ ] **Protected Routes**: 100% of unauthorized access attempts to admin routes are blocked
- [ ] **Role Enforcement**: 100% of role-based access control checks pass
- [ ] **Audit Coverage**: 100% of admin actions are logged with complete details
- [ ] **System Availability**: Authentication system maintains 99.9% uptime

---

## Dependencies

### External Dependencies

- **Supabase Auth**: User authentication service including password hashing, JWT issuance, session management
- **Supabase Database**: Stores user_profiles, audit_logs, integrates with RLS policies
- **Email Service**: For sending invitation and password reset magic links (Supabase email or custom SMTP)
- **Next.js 16**: Routing, middleware for protected routes, server components

### Internal Dependencies

- **Database Schema (Feature 1)**: Requires user_profiles table (to be updated with new fields)
- **RLS Policies**: Organization-level data isolation already implemented
- **Environment Configuration**: Requires Supabase credentials in .env file
- **Single Organization**: System assumes single organization for all users (organization_id not needed in JWT)

---

## Assumptions

- This is an internal tool - no public registration needed
- Single organization setup - all users belong to same company
- Email delivery is reliable (using Supabase email service or custom SMTP)
- Users have access to their email for invitations and password reset
- JWT tokens are stored in httpOnly cookies for security
- Next.js middleware is used for route protection and role enforcement
- Password complexity requirements follow OWASP guidelines
- Session duration of 7 days inactive / 30 days with "remember me" is acceptable
- Rate limiting prevents brute force attacks
- Admin users are trusted employees with appropriate training
- At least one admin user always exists in the system (enforced by validation)
- Audit logs retained indefinitely for compliance
- Most users will access from desktop browsers (mobile optimization is future enhancement)

---

## Out of Scope

- Public user registration - not needed for internal tool
- Email verification - not required since admins create accounts
- Multi-organization support - single company deployment
- Organization switching - not applicable
- Social login (Google, Microsoft, GitHub) - internal tool uses email/password
- Two-factor authentication (2FA/MFA) - future enhancement
- Single Sign-On (SSO) - future enhancement if needed for enterprise integration
- Biometric authentication - future enhancement
- Custom email templates - uses Supabase defaults initially
- IP-based access restrictions - future enhancement
- Detailed analytics dashboard for admin usage - future enhancement
- User self-service account deletion - admin-only operation
- Team management (departments, groups) - future enhancement
- Granular permissions beyond role-based access - future enhancement

---

## Security & Privacy Considerations

**Data Privacy**
- Passwords never stored in plain text (Supabase handles bcrypt encryption)
- Email addresses treated as PII - not shared with third parties
- Session tokens stored in httpOnly, secure cookies to prevent XSS attacks
- No authentication data logged in application logs
- Audit logs contain admin actions but not sensitive user data (no passwords)

**Access Control**
- Role-based access control (RBAC) enforced at middleware level
- JWT tokens include user_id and role claims verified on every request
- Admin routes protected with role check - non-admins blocked
- Expired or invalid tokens rejected automatically
- Magic link tokens single-use and time-limited (24 hours)
- At least one admin user enforced to prevent lockout

**Compliance**
- GDPR compliant - admins can delete user data on request
- Password requirements meet OWASP recommendations
- Rate limiting prevents brute force attacks (max 5 attempts per 15 minutes)
- Account lockout after failed attempts (30 minutes)
- Audit trail of all admin actions for compliance and security review

**Attack Prevention**
- Protection against: SQL injection (via Prisma/Supabase), XSS (httpOnly cookies), CSRF (SameSite cookies), brute force (rate limiting), session hijacking (secure tokens)
- Generic error messages prevent user enumeration
- Magic links expire quickly (24 hours) and are single-use
- Rate limiting on login and password reset endpoints
- Account lockout after excessive failed login attempts
- Admin cannot delete themselves or last admin (prevents lockout)

**Token Security**
- Magic link tokens use UUID v4 (cryptographically secure random)
- Tokens invalidated immediately after use
- Expired tokens rejected with clear error
- No token reuse permitted

---

## Future Enhancements

- **Two-Factor Authentication (2FA)**: SMS or authenticator app for additional security
- **Single Sign-On (SSO)**: SAML or OAuth2 if integrating with enterprise identity provider
- **Session Management Dashboard**: View and revoke active sessions
- **Login History**: Show recent login activity, IP addresses, and device information
- **Advanced Password Policies**: Configurable complexity requirements and expiration
- **User Activity Monitoring**: Track user actions beyond login/logout
- **Bulk User Import**: CSV upload for adding multiple users at once
- **User Groups/Departments**: Organize users into teams for future permission features
- **API Keys**: Generate API tokens for programmatic access to financial data
- **Custom Email Templates**: Branded invitation and password reset emails
- **IP Whitelisting**: Restrict access to specific IP ranges
- **Automated User Offboarding**: Scheduled deactivation for departing employees
- **Granular Permissions**: Fine-grained access control beyond role-based (e.g., read-only analyst)
