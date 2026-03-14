# Setup Guide: CFO-Universal Deployment

**Created**: 2026-03-14
**Purpose**: Set up separate Vercel + Supabase projects for universal edition

---

## Step 1: Create Vercel Project

### Via Vercel Dashboard

1. Go to https://vercel.com/new
2. Select **Import Git Repository**
3. Choose `DEVELOPER-LABS-AI/CFO-Universal`
4. Configure project:
   - **Project Name**: `devlabs-cfo-universal`
   - **Framework Preset**: Next.js
   - **Root Directory**: `./` (default)
   - **Build Command**: `npm run build` (default)
   - **Output Directory**: `.next` (default)

### Via Vercel CLI

```bash
cd /Users/developerlabsai/Projects/RevenuePatch/CFO-Universal

# Login to Vercel
vercel login

# Link to new project
vercel link

# When prompted:
# - Scope: DEVELOPER-LABS-AI
# - Link to existing project? No
# - Project name: devlabs-cfo-universal

# Deploy
vercel --prod
```

---

## Step 2: Create Separate Supabase Project

### Why Separate?

- Universal edition needs clean database (no agency-specific tables)
- Allows testing destructive migrations safely
- Production agency customers remain unaffected

### Create Project

1. Go to https://supabase.com/dashboard
2. Click **New Project**
3. Configure:
   - **Name**: `devlabs-cfo-universal`
   - **Database Password**: Generate strong password (save in 1Password)
   - **Region**: `us-west-2` (same as agency edition for consistency)
   - **Pricing Plan**: Pro ($25/mo for 900s Edge Functions)

4. Wait for provisioning (~2 minutes)

5. Get connection strings:
   - Navigate to **Project Settings** → **Database**
   - Copy **Connection Pooling** URLs (CRITICAL: use pooler, not direct)

---

## Step 3: Configure Environment Variables

### Vercel Environment Variables

Set these in Vercel dashboard (Settings → Environment Variables):

```bash
# Database (Supabase Pooler URLs - REQUIRED)
DATABASE_URL="postgresql://postgres.<NEW_PROJECT_REF>:<PASSWORD>@aws-0-us-west-2.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1"
DIRECT_URL="postgresql://postgres.<NEW_PROJECT_REF>:<PASSWORD>@aws-0-us-west-2.pooler.supabase.com:5432/postgres"

# Supabase
NEXT_PUBLIC_SUPABASE_URL="https://<NEW_PROJECT_REF>.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="<NEW_ANON_KEY>"
SUPABASE_SERVICE_ROLE_KEY="<NEW_SERVICE_ROLE_KEY>"
SUPABASE_FUNCTION_SECRET="<NEW_SECRET>"

# App
NEXT_PUBLIC_APP_URL="https://devlabs-cfo-universal.vercel.app"
CRON_SECRET="<GENERATE_NEW_RANDOM_TOKEN>"

# Integrations (can reuse from agency edition for testing)
XERO_CLIENT_ID="<SAME_AS_AGENCY>"
XERO_CLIENT_SECRET="<SAME_AS_AGENCY>"
MERCURY_API_KEY="<SAME_AS_AGENCY>"

# New integrations (get these)
QUICKBOOKS_CLIENT_ID="<TBD>"
QUICKBOOKS_CLIENT_SECRET="<TBD>"
ANTHROPIC_API_KEY="<TBD>"
TELEGRAM_BOT_TOKEN="<TBD>"

# AWS Lambda (Mercury) - can reuse
AWS_REGION="us-east-1"
AWS_ACCESS_KEY_ID="<SAME_AS_AGENCY>"
AWS_SECRET_ACCESS_KEY="<SAME_AS_AGENCY>"
MERCURY_LAMBDA_FUNCTION_NAME="mercury-sync"
```

### Local Development (.env.local)

```bash
# Copy to /Users/developerlabsai/Projects/RevenuePatch/CFO-Universal/.env.local
# Use same values as above
```

---

## Step 4: Initialize Database

```bash
cd /Users/developerlabsai/Projects/RevenuePatch/CFO-Universal

# Verify connection (CRITICAL: test pooler URLs)
npx prisma migrate status

# Should output: "Database connection successful"
# If timeout → verify pooler URLs (not db.*.supabase.co)

# Apply existing migrations
npx prisma migrate deploy

# Generate Prisma client
npx prisma generate

# Seed initial data
npx prisma db seed
```

---

## Step 5: Verify Deployment

### Test Endpoints

```bash
# Health check
curl https://devlabs-cfo-universal.vercel.app/api/health

# Expected: { "status": "ok", "database": "connected" }

# Database connection
curl https://devlabs-cfo-universal.vercel.app/api/test-db

# Expected: { "organizations": 0 } (empty database)
```

### Verify Crons

```bash
# List scheduled crons
vercel crons ls --project devlabs-cfo-universal

# Should show:
# - /api/xero/sync/cron (0 2 * * *)
# - /api/mercury/sync/cron (0 2 * * *)
# - /api/cron/contractor-reminders (0 8 * * *)
# - /api/utilization/snapshots/generate (0 6 * * 1)
```

---

## Step 6: Set Up Supabase Edge Functions

```bash
# Login to Supabase
supabase login

# Link to new project
supabase link --project-ref <NEW_PROJECT_REF>

# Deploy Edge Functions
supabase functions deploy cfo-strategist-nightly

# Set secrets
supabase secrets set ANTHROPIC_API_KEY=<YOUR_KEY>
supabase secrets set NEXT_PUBLIC_APP_URL=https://devlabs-cfo-universal.vercel.app
```

---

## Step 7: Repository Comparison

### Original Repo (Agency Edition)
- **URL**: https://github.com/DEVELOPER-LABS-AI/CFO
- **Vercel**: `devlabs-cfo-v2.vercel.app`
- **Branch**: `main`
- **Customers**: Production agency customers
- **Schema**: Agency-specific (Agency, BDR, etc.)
- **Status**: ✅ **STABLE - Do not modify destructively**

### New Repo (Universal Edition)
- **URL**: https://github.com/DEVELOPER-LABS-AI/CFO-Universal
- **Vercel**: `devlabs-cfo-universal.vercel.app`
- **Branch**: `1-cfo-productization`
- **Customers**: None (development/testing)
- **Schema**: Clean slate for refactoring
- **Status**: 🏗️ **DEVELOPMENT - Safe to experiment**

---

## Step 8: Development Guidelines

### DO in Universal Repo
- ✅ Drop agency tables (Agency, BDR, etc.)
- ✅ Rename Contractor → Vendor
- ✅ Add new business type features
- ✅ Refactor margin calculations
- ✅ Test destructive migrations
- ✅ Experiment with agent implementations

### DON'T in Universal Repo
- ❌ Deploy to production agency customers
- ❌ Use production agency database
- ❌ Mix agency and universal data

### DO in Original Repo (CFO)
- ✅ Bug fixes for agency customers
- ✅ Minor feature enhancements
- ✅ Performance optimizations
- ✅ Security patches

### Merge Strategy (Future)
- Option A: Keep both repos (dual product)
- Option B: Merge universal back to original after validation
- Decision point: Q4 2026 after universal launch

---

## Quick Reference

| Aspect | Agency Edition | Universal Edition |
|--------|----------------|-------------------|
| **Repo** | DEVELOPER-LABS-AI/CFO | DEVELOPER-LABS-AI/CFO-Universal |
| **Local Path** | `DevLabs CFO` | `CFO-Universal` |
| **Branch** | `main` | `1-cfo-productization` |
| **Vercel** | `devlabs-cfo-v2` | `devlabs-cfo-universal` |
| **Supabase** | fqljijavvxkthzozslzx | <NEW_PROJECT> |
| **Database** | Production (agency data) | Development (clean) |
| **Risk Level** | 🔴 High (production) | 🟢 Low (isolated) |

---

## Next Steps

1. ✅ Repository created
2. ✅ Code cloned
3. ⏳ **YOU DO**: Create Vercel project (5 minutes)
4. ⏳ **YOU DO**: Create Supabase project (5 minutes)
5. ⏳ **YOU DO**: Set environment variables (10 minutes)
6. ⏳ **WE DO**: Apply initial migrations
7. ⏳ **WE DO**: Begin Phase 1 implementation

**Total setup time**: ~20 minutes

---

## Status

- [x] GitHub repository created
- [x] Code cloned to new location
- [x] Remote configured
- [x] Main branch pushed
- [x] Productization branch pushed
- [ ] Vercel project created (manual step)
- [ ] Supabase project created (manual step)
- [ ] Environment variables configured (manual step)
- [ ] Database initialized (after env vars)
- [ ] Ready for implementation

Once you've completed steps 3-5 above (Vercel + Supabase + env vars), let me know and I'll begin the implementation!
