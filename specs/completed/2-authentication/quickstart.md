# Authentication Quick Start Guide

**Feature**: Authentication & User Management
**Target Duration**: 15-30 minutes
**Last Updated**: 2026-02-13

---

## Prerequisites

Before starting, ensure you have:

1. **Node.js 20+** installed
   ```bash
   node --version  # Should be v20.0.0 or higher
   ```

2. **Supabase Project** with email authentication enabled
   - Access: https://supabase.com
   - Create project or use existing one

3. **Database Schema** from Feature 1 (Database Schema)
   - Tables must be created and migrated
   - User profiles and organization tables ready

4. **Development Environment** cloned and set up
   ```bash
   git clone <repo>
   cd "DevLabs CFO"
   npm install
   ```

---

## Step 1: Configure Supabase (5 minutes)

### 1.1 Get Supabase Credentials

1. Log in to https://supabase.com
2. Select your project → **Settings** → **API**
3. Copy these values:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon public key** → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **service_role key** → `SUPABASE_SERVICE_ROLE_KEY`

### 1.2 Configure Authentication Settings

1. Go to **Authentication** → **Providers** → **Email**
2. Ensure **Email Confirmed** is enabled
3. Go to **URL Configuration**
4. Add these redirect URLs:
   ```
   http://localhost:3000/auth/callback
   http://localhost:3000/login
   http://localhost:3000/dashboard
   ```

### 1.3 (Optional) Configure Email Templates

1. Go to **Authentication** → **Email Templates**
2. Customize if desired:
   - Confirm signup email
   - Password reset email
   - Magic link email (if using passwordless)

---

## Step 2: Set Environment Variables (2 minutes)

### 2.1 Create `.env.local`

Copy the example and add your Supabase credentials:

```bash
cp .env.local.example .env.local
```

### 2.2 Update `.env.local` with Supabase Keys

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...

# Database (Prisma)
DATABASE_URL="postgresql://postgres:password@localhost:5432/devlabs_cfo"
PRISMA_DATABASE_URL="postgresql://postgres:password@localhost:5432/devlabs_cfo"

# Encryption (for storing sensitive data)
ENCRYPTION_KEY=your-32-byte-hex-key-here
```

---

## Step 3: Database Setup (3 minutes)

### 3.1 Create Tables

Run migrations to create auth-related tables:

```bash
npm run db:migrate
```

This creates:
- `user_profiles` - User profile information
- `user_organizations` - User-org relationships
- `core_organizations` - Organization data

### 3.2 Generate Prisma Client

```bash
npm run db:generate
```

---

## Step 4: Create First Admin User (2 minutes)

### 4.1 Via SQL (Direct Database Access)

Open **Supabase Dashboard** → **SQL Editor** and run:

```sql
-- 1. Create organization
INSERT INTO public.core_organizations (id, name, subscription_tier, created_at, updated_at)
VALUES (
  'org-' || gen_random_uuid()::text,
  'Your Agency Name',
  'free',
  NOW(),
  NOW()
)
RETURNING id;

-- Copy the returned organization ID and use it below:

-- 2. Create user profile (using Supabase Auth user ID)
-- First, you need to create the user via email/password in Auth section
-- Then get the user ID and run:

INSERT INTO public.user_profiles (id, email, full_name, created_at, updated_at)
VALUES (
  'auth-user-id-here',  -- Get from Supabase Auth → Users
  'admin@youragency.com',
  'Admin User',
  NOW(),
  NOW()
);

-- 3. Link user to organization as owner
INSERT INTO public.user_organizations (id, user_id, organization_id, role, created_at, updated_at)
VALUES (
  gen_random_uuid()::text,
  'auth-user-id-here',
  'org-id-from-step-1',
  'owner',
  NOW(),
  NOW()
);
```

### 4.2 Via Supabase Auth Dashboard (Recommended)

1. Go to **Authentication** → **Users**
2. Click **Add user** → **Create new user**
3. Enter email and password
4. Copy the generated **User ID**
5. Run the SQL script above with this user ID

---

## Step 5: Start Development Server (2 minutes)

### 5.1 Run Development Server

```bash
npm run dev
```

Server starts at: **http://localhost:3000**

### 5.2 Verify Server is Running

Open in browser:
```
http://localhost:3000
```

You should see the home page without errors.

---

## Step 6: Test Login Flow (3 minutes)

### 6.1 Navigate to Login

```
http://localhost:3000/login
```

### 6.2 Enter Credentials

- **Email**: The email you created in Step 4
- **Password**: The password you set

### 6.3 After Login

You should be redirected to:
```
http://localhost:3000/dashboard
```

---

## Step 7: Development Workflow

### Access Admin Portal

After logging in, access the admin portal:
```
http://localhost:3000/admin
```

Requires `admin` or `owner` role (set in `user_organizations` table).

### Invite First User (Optional)

1. Log in as admin
2. Go to **Admin** → **Team Members**
3. Click **Invite User**
4. Enter email address
5. Invited user receives email with signup link

### Check Session & Auth

Verify auth is working:
```bash
# Check middleware protection
curl -i http://localhost:3000/dashboard  # Should redirect to login

# After login, check cookies
# Browser DevTools → Application → Cookies
# You should see Supabase auth cookies
```

---

## Configuration Reference

### Supabase Auth Settings

Located at: **Authentication** → **Settings**

| Setting | Value | Purpose |
|---------|-------|---------|
| JWT Expiry | 3600 (1 hour) | Session duration |
| Refresh Token Expiry | 604800 (7 days) | Extended session |
| Email Confirmations | Enabled | Require email verification |
| Auto Confirm | Disabled | Manual verification required |

### Environment Variables Summary

| Variable | Source | Required |
|----------|--------|----------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Settings → API | ✅ |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Settings → API | ✅ |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Settings → API | ✅ |
| `DATABASE_URL` | Supabase → Settings → Database | ✅ |
| `ENCRYPTION_KEY` | Generate yourself | ⚠️ Optional |

### Rate Limiting (Optional)

Configure in `.env.local`:

```env
# Rate limiting for login attempts
RATE_LIMIT_ENABLED=true
RATE_LIMIT_WINDOW=900        # 15 minutes
RATE_LIMIT_MAX_ATTEMPTS=5    # Max 5 attempts per window
```

---

## Troubleshooting

### Issue: "Invalid Redirect URL"

**Error**: Authentication redirects to blank page
**Fix**:
1. Go to Supabase → **Authentication** → **URL Configuration**
2. Verify `http://localhost:3000/auth/callback` is in the Redirect URLs list
3. Verify `http://localhost:3000` is listed (or add it)
4. Save changes and refresh browser

### Issue: Email Verification Not Working

**Error**: Users can't verify email or receive verification emails
**Fix**:
1. Check Supabase → **Authentication** → **Email Templates**
2. Verify email provider is configured (Supabase uses built-in by default)
3. Check **Email Templates** → **Confirm signup** has correct link format
4. For local testing: Check Supabase Dashboard → **Email Logs** for delivery status

### Issue: User Can't Log In

**Symptoms**: Login page shows error after entering credentials
**Fix**:
1. Verify user exists in Supabase → **Authentication** → **Users**
2. Check user's **Email verified** status (should be ✅)
3. Verify user profile exists in database:
   ```bash
   npm run db:studio  # Opens Prisma Studio at http://localhost:5555
   # Check user_profiles table for user ID
   ```
4. Verify organization link exists in `user_organizations` table

### Issue: "Auth Helpers Error"

**Error**: Console shows Supabase auth-helpers errors
**Fix**:
1. Clear browser cache and cookies
2. Restart dev server: `npm run dev`
3. Check `.env.local` for typos in Supabase keys
4. Verify `NEXT_PUBLIC_SUPABASE_URL` ends with `/` (if required)

### Issue: Middleware Not Protecting Routes

**Symptoms**: Can access `/dashboard` without logging in
**Fix**:
1. Check middleware file exists: `src/middleware.ts`
2. Verify protected routes are configured
3. Restart dev server
4. Clear browser cache

### Admin Lockout Recovery

**If admin user is locked out**:

1. Go to Supabase → **Authentication** → **Users**
2. Find the admin user
3. Click the three-dot menu → **Reset Password**
4. User receives password reset email
5. Click link to set new password

---

## Performance Notes

**Expected Performance**:
- Login: < 1 second
- Page load after auth: < 2 seconds
- Database queries: < 100ms
- Middleware check: < 50ms

**For 15-30 minute setup**:
- Total time: ~25 minutes (includes some waiting for email delivery)
- Most critical path: Steps 1-6 (12 minutes)
- Remaining time for verification and troubleshooting

---

## Next Steps

After successful authentication setup:

1. **Add More Users**: Use invite flow or admin panel
2. **Customize Email Templates**: Branding and messaging
3. **Configure Roles**: Extend role-based access control
4. **Set Up Organization Switching**: Enable multi-org support
5. **Implement 2FA** (optional): Add two-factor authentication
6. **Proceed to Feature 3**: Client Management Dashboard

---

## Quick Reference

### Important URLs

| URL | Purpose |
|-----|---------|
| `http://localhost:3000` | Home page |
| `http://localhost:3000/login` | Login form |
| `http://localhost:3000/register` | Registration form (if enabled) |
| `http://localhost:3000/dashboard` | Protected dashboard |
| `http://localhost:3000/admin` | Admin panel (admin/owner only) |

### Important Files

| File | Purpose |
|------|---------|
| `src/middleware.ts` | Route protection middleware |
| `src/lib/auth.ts` | Authentication utilities |
| `src/app/login/page.tsx` | Login page component |
| `src/app/dashboard/page.tsx` | Protected dashboard |
| `.env.local` | Environment configuration |
| `prisma/schema.prisma` | Database schema |

### Useful Commands

```bash
npm run dev              # Start development server
npm run db:studio       # Open Prisma Studio (database browser)
npm run db:migrate      # Run database migrations
npm run db:generate     # Regenerate Prisma client
npm run build           # Build for production
npm run lint            # Check code quality
```

---

## Support

**Having issues?** Check:

1. **Console Logs**: Open browser DevTools (F12) → Console tab
2. **Network Tab**: Check API calls to Supabase
3. **Supabase Logs**: Dashboard → Logs → Auth
4. **Database**: Prisma Studio (`npm run db:studio`)
5. **Documentation**: See `specs/2-authentication/spec.md` for full details
