# Deploy Mercury Integration to Production

## ⚠️ CRITICAL: Follow Steps in Order

This guide will walk you through deploying the Mercury Banking Integration to production.

---

## Step 1: Apply Database Migration to Supabase

### 1.1 Open Supabase SQL Editor

1. Go to https://supabase.com/dashboard/project/YOUR_PROJECT/sql
2. Click "New query"

### 1.2 Apply Schema Migration

Copy and paste the **ENTIRE CONTENTS** of this file:
**File:** `supabase/migrations/20260215_add_mercury_integration.sql`

Click **Run** (bottom right)

✅ Should see: "Success. No rows returned"

### 1.3 Verify Installation

Copy and paste the **ENTIRE CONTENTS** of this file:
**File:** `supabase/migrations/verify_mercury_schema.sql`

Click **Run**

✅ Expected results:
- **Enums**: 9 rows (all show "EXISTS ✓")
- **Tables**: 7 rows (all show "EXISTS ✓")
- **RLS Status**: 7 rows (all show "ENABLED ✓")
- **RLS Policies**: Multiple rows (counts per table)
- **Indexes**: Multiple rows (all show "EXISTS ✓")
- **Column Types**: 5 rows showing mercury_sync_logs columns
- **Foreign Keys**: Multiple rows (all show "EXISTS ✓")

❌ If any show "MISSING ✗" or "DISABLED ✗", **STOP** and review the migration file.

---

## Step 2: Set Environment Variables

### 2.1 Generate Secrets

Run this in your terminal:

```bash
# Generate encryption key (if not already created for Xero)
openssl rand -base64 32

# Generate cron secret (if not already created for Xero)
openssl rand -base64 24
```

**Save these values securely!**

### 2.2 Add to Vercel Environment Variables

Go to: https://vercel.com/YOUR_ORG/YOUR_PROJECT/settings/environment-variables

Add these variables (if not already set):

| Variable | Value | Environment |
|----------|-------|-------------|
| `ENCRYPTION_KEY` | *[key from step 2.1]* | Production, Preview, Development |
| `CRON_SECRET` | *[secret from step 2.1]* | Production, Preview, Development |
| `DATABASE_URL` | *[your Supabase connection string]* | Production, Preview, Development |
| `NEXT_PUBLIC_SUPABASE_URL` | *[your Supabase URL]* | Production, Preview, Development |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | *[your Supabase anon key]* | Production, Preview, Development |

### 2.3 Add Mercury-Specific Variables

You'll need to add these after setting up Mercury Bank API access:

| Variable | Value | Environment |
|----------|-------|-------------|
| `MERCURY_API_KEY` | *[your Mercury API key]* | Production, Preview, Development |
| `MERCURY_API_URL` | `https://api.mercury.com` | Production, Preview, Development |

---

## Step 3: Merge to Main Branch

### 3.1 Verify All Changes Committed

```bash
git status
```

Should show: "nothing to commit, working tree clean"

### 3.2 Switch to Main and Merge

```bash
# Switch to main branch
git checkout main

# Pull latest changes
git pull origin main

# Merge feature branch
git merge 5-mercury-integration

# Push to remote
git push origin main
```

---

## Step 4: Deploy to Vercel

### 4.1 Automatic Deployment

If you have automatic deployments enabled (default for main branch):
- Vercel will automatically deploy after pushing to main
- Monitor deployment at: https://vercel.com/YOUR_ORG/YOUR_PROJECT/deployments

### 4.2 Manual Deployment (if needed)

```bash
# Install Vercel CLI if not already installed
npm i -g vercel

# Deploy to production
vercel --prod
```

### 4.3 Monitor Deployment

1. Go to https://vercel.com/YOUR_ORG/YOUR_PROJECT/deployments
2. Wait for deployment to complete (typically 2-5 minutes)
3. Click on the deployment to view build logs
4. Verify: "Build completed successfully"

---

## Step 5: Set Up Mercury Cron Job

### 5.1 Configure Vercel Cron (Optional - if using Vercel Cron)

The `vercel.json` file already includes:

```json
{
  "crons": [
    {
      "path": "/api/mercury/sync/cron",
      "schedule": "0 2 * * *"
    }
  ]
}
```

This runs daily at 2 AM UTC. Vercel will automatically enable this on deployment.

### 5.2 Or Use External Cron Service

If you prefer an external cron service:

1. **Using Cron-Job.org**:
   - Go to https://console.cron-job.org/jobs/create
   - Title: "Mercury Daily Sync"
   - URL: `https://YOUR_DOMAIN.vercel.app/api/mercury/sync/cron`
   - Schedule: `0 2 * * *` (2 AM UTC)
   - Add header: `Authorization: Bearer YOUR_CRON_SECRET`

2. **Using GitHub Actions** (see `.github/workflows/mercury-sync.yml` if needed)

3. **Using AWS EventBridge** (for AWS-hosted apps)

---

## Step 6: Test the Integration

### 6.1 Test Database Connection

```bash
# In Supabase SQL Editor, run:
SELECT COUNT(*) FROM mercury_connections;
SELECT COUNT(*) FROM mercury_sync_logs;
```

Should both return 0 (empty tables ready for data).

### 6.2 Test Mercury Connection Flow

1. Navigate to: `https://YOUR_DOMAIN.vercel.app/dashboard/integrations/mercury`
2. Click "Connect Mercury Account"
3. Verify OAuth flow works (even if you don't have Mercury credentials yet)
4. Check for errors in browser console

### 6.3 Test Cron Endpoint (Manual Trigger)

```bash
curl -X POST https://YOUR_DOMAIN.vercel.app/api/mercury/sync/cron \
  -H "Authorization: Bearer YOUR_CRON_SECRET" \
  -H "Content-Type: application/json"
```

Expected response:
```json
{
  "success": true,
  "message": "Scheduled sync completed",
  "result": {
    "total_connections": 0,
    "successful_connections": 0,
    "failed_connections": 0,
    ...
  }
}
```

### 6.4 Check Application Logs

In Vercel dashboard:
1. Go to Deployments → [Your Deployment] → Logs
2. Look for:
   - No critical errors
   - Database connection successful
   - Mercury API endpoints responding

---

## Step 7: Verify Integration Health

### 7.1 Health Check Endpoints

Test these endpoints:

```bash
# Connection status
curl https://YOUR_DOMAIN.vercel.app/api/mercury/connection/status?organizationId=YOUR_ORG_ID

# Sync status
curl https://YOUR_DOMAIN.vercel.app/api/mercury/sync/status?organizationId=YOUR_ORG_ID
```

### 7.2 Database Verification

In Supabase SQL Editor:

```sql
-- Check schema is correct
\d mercury_connections
\d mercury_sync_logs
\d mercury_transactions

-- Verify RLS policies
SELECT tablename, policyname FROM pg_policies
WHERE tablename LIKE 'mercury%';
```

---

## ✅ Deployment Checklist

Before marking deployment complete, verify:

- [ ] Database migration applied to Supabase (all checks ✓)
- [ ] Environment variables set in Vercel (ENCRYPTION_KEY, CRON_SECRET, DATABASE_URL)
- [ ] Mercury API credentials added (MERCURY_API_KEY, MERCURY_API_URL)
- [ ] Feature branch merged to main
- [ ] Vercel deployment completed successfully
- [ ] Cron job configured (Vercel Cron or external)
- [ ] Database connection tested (tables exist and accessible)
- [ ] Mercury integration page loads without errors
- [ ] Cron endpoint responds correctly
- [ ] No errors in Vercel deployment logs

---

## 🚨 Troubleshooting

### Migration Fails

**Error**: "type mercury_connection_status already exists"
- **Fix**: The migration was partially applied. Run the verify script to see what's missing.

### Build Fails

**Error**: "Cannot find module '@/lib/mercury/...''"
- **Fix**: Ensure all Mercury files are committed and pushed.

### Environment Variables Not Found

**Error**: "ENCRYPTION_KEY is not defined"
- **Fix**: Add the variable in Vercel dashboard, then redeploy.

### Cron Job Not Running

**Check**:
1. Verify cron schedule in `vercel.json`
2. Check Vercel Cron dashboard: https://vercel.com/YOUR_ORG/YOUR_PROJECT/settings/cron-jobs
3. Check cron logs in Vercel deployment logs

### Database Connection Error

**Error**: "relation mercury_connections does not exist"
- **Fix**: Migration not applied. Go back to Step 1.

### Mercury API Error

**Error**: "Mercury API returned 401 Unauthorized"
- **Fix**: Verify MERCURY_API_KEY is set correctly in Vercel environment variables.

---

## 📊 Post-Deployment Monitoring

### Metrics to Watch

1. **Sync Success Rate**: Target 95%+
2. **Sync Duration**: Should be <10 minutes for 500 transactions
3. **API Error Rate**: Should be <5%
4. **Database Query Performance**: <500ms for dashboard queries

### Monitoring Tools

- **Vercel Logs**: Real-time application logs
- **Supabase Logs**: Database query logs
- **Vercel Analytics**: Performance metrics
- **Sentry** (if configured): Error tracking

### Daily Health Check

1. Check cron job ran (look for sync logs at ~2 AM UTC)
2. Review any failed syncs in `mercury_sync_logs` table
3. Check for unmapped merchants in admin dashboard
4. Verify no critical errors in Vercel logs

---

## 🎉 Deployment Complete!

Once all checklist items are complete, the Mercury Integration is live!

**Next Steps**:
1. Connect a Mercury account to test end-to-end flow
2. Monitor first scheduled sync (next 2 AM UTC)
3. Review transaction categorization accuracy
4. Train merchant mapping for common vendors
5. Set up alerts for sync failures

**Need Help?**
- Check Vercel deployment logs
- Review Supabase database logs
- Consult specs/5-mercury-integration/ documentation
