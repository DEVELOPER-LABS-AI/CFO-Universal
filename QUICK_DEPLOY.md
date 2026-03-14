# Quick Deployment Guide

## ✅ What's Complete

- ✅ All server actions updated with `getOrganizationId()`
- ✅ User-organization link verified (User ID: `228c1944-7de7-4a2e-a27a-010dd14b89e4`, Org ID: `org-devlabs-test`)
- ✅ Database migrations applied
- ✅ Authentication system working

## 🔧 Remaining Build Fixes Needed

There are a few TypeScript errors to fix before deploying. Here's the summary:

### 1. Fix roi-calculations.ts (Line 110)

The validation schema is missing the `status` field. Either:
- Add `status` to the getClientROIDashboardSchema, OR
- Remove the status filter from line 110-112

### 2. Review other potential type errors

Run `npm run build` and fix any remaining TypeScript errors.

## 🚀 Deploy Steps (After Build Passes)

### Option A: Deploy to Vercel (Recommended)

```bash
# 1. Commit your changes
git add .
git commit -m "feat: Complete Feature 3 - Client Portfolio & Staff Management"

# 2. Push to GitHub
git push origin main

# 3. Deploy to Vercel
npx vercel

# Or if you have Vercel CLI configured:
vercel --prod
```

### Option B: Deploy via Vercel Dashboard

1. Go to https://vercel.com/dashboard
2. Click "Import Project"
3. Connect your GitHub repository
4. Vercel will auto-detect Next.js
5. Add environment variables (see below)
6. Click "Deploy"

## 🔐 Environment Variables for Production

Add these in Vercel Dashboard → Project Settings → Environment Variables:

```bash
# Database
DATABASE_URL="your-supabase-connection-pooler-url"
DIRECT_URL="your-supabase-direct-url"

# Supabase Auth
NEXT_PUBLIC_SUPABASE_URL="https://fqljijavvxkthzozslzx.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="your-anon-key"

# Optional: Xero Integration
XERO_CLIENT_ID="your-xero-client-id"
XERO_CLIENT_SECRET="your-xero-client-secret"
XERO_REDIRECT_URI="https://yourdomain.com/api/xero/callback"

# Optional: Mercury Integration
MERCURY_API_KEY="your-mercury-api-key"

# Optional: Encryption for OAuth tokens
ENCRYPTION_KEY="your-32-char-encryption-key"
```

## ✅ Post-Deployment Checklist

After deployment:

1. **Test Login**
   - Visit your deployed URL
   - Login with `clance@developerlabs.ai`
   - Verify you can access the dashboard

2. **Test Organization Scoping**
   - Create a test client
   - Verify it's linked to "DevLabs Test Agency" (org-devlabs-test)
   - Check that only your organization's data appears

3. **Test Core Features**
   - Create client → ✅
   - Create service → ✅
   - Create staff (BDR) → ✅
   - Assign staff to client → ✅
   - View portfolio dashboard → ✅
   - Export to CSV → ✅

## 🐛 If You Need Help

The main TypeScript errors are minor validation schema mismatches. To fix quickly:

1. Run `npm run build`
2. Read the error message
3. Either update the validation schema OR remove the problematic filter
4. Repeat until build passes

Then proceed with deployment!

## 📝 Summary

**Current Status:**
- Authentication: ✅ Working
- Database: ✅ Migrated
- User-Org Link: ✅ Verified
- Build: ⚠️ Needs TypeScript fixes
- Deploy: 🔜 Ready after build passes

**Your Organization:**
- Name: DevLabs Test Agency
- ID: org-devlabs-test
- User: clance@developerlabs.ai (ADMIN role)

Once the build passes, you're ready to deploy! 🚀
