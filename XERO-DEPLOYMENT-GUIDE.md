# Xero Integration - Deployment & Testing Guide

## 📋 Pre-Deployment Checklist

### 1. Environment Variables Required

Add these to your Vercel project (Settings → Environment Variables):

```bash
# Xero OAuth 2.0
XERO_CLIENT_ID=<your-xero-client-id>
XERO_CLIENT_SECRET=<your-xero-client-secret>
XERO_REDIRECT_URI=https://devlabs-cfo.vercel.app/api/xero/oauth/callback

# Encryption (generate with: openssl rand -base64 32)
ENCRYPTION_KEY=<your-32-byte-encryption-key>

# Cron Job Security
CRON_SECRET=<generate-random-string>

# Supabase (should already be set)
NEXT_PUBLIC_SUPABASE_URL=<your-supabase-url>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-supabase-anon-key>
DATABASE_URL=<your-supabase-postgres-connection-string>
DIRECT_URL=<your-supabase-direct-connection-string>
```

### 2. Create Xero OAuth App

1. Go to [Xero Developer Portal](https://developer.xero.com/app/manage)
2. Click "New app"
3. Fill in:
   - **App name**: DevLabs CFO
   - **Integration type**: Web app
   - **Company or application URL**: https://devlabs-cfo.vercel.app
   - **OAuth 2.0 redirect URI**: https://devlabs-cfo.vercel.app/api/xero/oauth/callback
4. Save and copy your Client ID and Client Secret

## 🗄️ Step 1: Apply Database Migrations

### Option A: Supabase Dashboard (Recommended)

1. Open [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project
3. Go to **SQL Editor**
4. Create a new query
5. Copy and paste the contents of **`supabase/sql/001_xero_integration_schema.sql`**
6. Click **Run**
7. Repeat for **`supabase/sql/002_xero_rls_policies.sql`**

### Option B: Command Line

```bash
# Using Supabase CLI (if installed)
supabase db push

# Or use psql directly
psql "$DATABASE_URL" -f supabase/sql/001_xero_integration_schema.sql
psql "$DATABASE_URL" -f supabase/sql/002_xero_rls_policies.sql
```

### Verify Installation

Run the verification script in Supabase SQL Editor:

```sql
-- Copy contents of supabase/sql/verify_xero_schema.sql
```

**Expected Results:**
- ✅ All enums exist (9 total)
- ✅ All tables exist (4 Xero tables)
- ✅ RLS enabled on all tables
- ✅ Helper function exists
- ✅ RLS policies present (2-4 per table)
- ✅ Revenue/Expense fields added

## 🚀 Step 2: Deploy to Vercel

### Generate Encryption Key

```bash
# Generate a secure 32-byte encryption key
openssl rand -base64 32

# Generate CRON_SECRET
openssl rand -base64 24
```

### Deploy

```bash
# Push latest code to GitHub (triggers Vercel deployment)
git add .
git commit -m "feat: Complete Xero integration (Feature 4)"
git push origin 4-xero-integration

# Or deploy directly with Vercel CLI
vercel --prod
```

### Verify Deployment

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Check deployment status for `devlabs-cfo`
3. Verify all environment variables are set
4. Check deployment logs for errors

## 🧪 Step 3: Test the Integration

### Test 1: OAuth Connection Flow

1. **Login** to DevLabs CFO:
   ```
   https://devlabs-cfo.vercel.app/login
   ```

2. **Navigate** to Xero integration page:
   ```
   https://devlabs-cfo.vercel.app/dashboard/integrations/xero
   ```

3. **Click "Connect to Xero"** button
   - Should redirect to Xero OAuth login
   - Login with your Xero account
   - Authorize the app
   - Should redirect back to dashboard

4. **Verify connection status**:
   - Connection Status: **ACTIVE** (green badge)
   - Tenant ID displayed
   - Scopes shown: `offline_access`, `accounting.transactions.read`, `accounting.contacts.read`
   - Connected Since date

**Expected Result**: ✅ Status shows ACTIVE with green badge

---

### Test 2: Manual Invoice Sync

1. **Click "Sync Now"** button on dashboard
2. **Wait** for sync to complete (10-30 seconds)
3. **Check Sync History table**:
   - New row appears with status RUNNING → SUCCESS
   - Invoices processed count > 0
   - No errors shown

4. **Verify in database**:
   ```sql
   -- Check synced invoices
   SELECT COUNT(*) FROM financial_revenue_records
   WHERE revenue_sync_status = 'SYNCED';

   -- Check sync logs
   SELECT * FROM xero_sync_logs
   ORDER BY started_at DESC LIMIT 5;
   ```

**Expected Result**: ✅ Sync completes successfully with invoices synced

---

### Test 3: Expense Sync

1. **Check if expenses were synced** in the same sync as Test 2
2. **Verify in database**:
   ```sql
   -- Check synced expenses
   SELECT COUNT(*) FROM financial_expense_records
   WHERE expense_sync_status = 'SYNCED';

   -- Check categorization
   SELECT category, COUNT(*)
   FROM financial_expense_records
   GROUP BY category;
   ```

**Expected Result**: ✅ Expenses synced and categorized

---

### Test 4: Contact Mapping

1. **Check for unmapped contacts**:
   - Look at "Unmapped Contacts" count widget
   - If count > 0, click "Review →"

2. **Manual Mapping Page**:
   ```
   https://devlabs-cfo.vercel.app/dashboard/integrations/xero/mappings
   ```
   - Should show list of unmapped Xero contacts
   - Dropdown to select internal client
   - "Map" button to save mapping

3. **Test mapping**:
   - Select a client from dropdown
   - Click "Map"
   - Contact should disappear from list

**Expected Result**: ✅ Manual mapping works, count decreases

---

### Test 5: Error Handling & Retry

1. **Simulate a failure** (optional):
   - Temporarily remove XERO_CLIENT_SECRET from Vercel
   - Trigger manual sync
   - Should see FAILED status

2. **Test retry**:
   - Click "Retry" button on failed sync
   - Should create new sync attempt
   - Restore XERO_CLIENT_SECRET
   - Retry should succeed

**Expected Result**: ✅ Retry mechanism works

---

### Test 6: Automated Daily Sync (Cron)

**Note**: This runs automatically at 2 AM UTC daily. To test immediately:

1. **Trigger cron endpoint manually**:
   ```bash
   curl -X GET "https://devlabs-cfo.vercel.app/api/xero/sync/cron" \
     -H "Authorization: Bearer $CRON_SECRET"
   ```

2. **Check response**:
   ```json
   {
     "success": true,
     "total_connections": 1,
     "successful": 1,
     "failed": 0,
     "results": [...]
   }
   ```

3. **Verify in Vercel Logs**:
   - Go to Vercel Dashboard → Deployments → Latest → Logs
   - Search for "Cron sync completed"

**Expected Result**: ✅ Cron executes successfully

---

## 🐛 Troubleshooting

### Issue: "OAuth callback failed"

**Cause**: Redirect URI mismatch

**Fix**:
1. Verify `XERO_REDIRECT_URI` matches exactly in:
   - Vercel environment variables
   - Xero Developer Portal app settings
2. Must be: `https://devlabs-cfo.vercel.app/api/xero/oauth/callback`

---

### Issue: "Token expired" status

**Cause**: Access token expired and refresh failed

**Fix**:
1. Check `XERO_CLIENT_SECRET` is correct
2. Disconnect and reconnect Xero integration
3. Verify token encryption key hasn't changed

---

### Issue: No invoices syncing

**Possible causes**:
1. No invoices in Xero account (APPROVED or PAID status)
2. Contact mapping failing (check unmapped contacts count)
3. RLS policies blocking access

**Debug**:
```sql
-- Check sync logs for errors
SELECT errors FROM xero_sync_logs
WHERE status IN ('FAILED', 'PARTIAL')
ORDER BY started_at DESC LIMIT 1;

-- Check if contacts are mapped
SELECT * FROM xero_contact_mappings LIMIT 10;
```

---

### Issue: Database connection errors

**Cause**: Missing DATABASE_URL or DIRECT_URL

**Fix**:
1. Go to Supabase Dashboard → Project Settings → Database
2. Copy "Connection string" (transaction pooler) → `DATABASE_URL`
3. Copy "Direct connection" → `DIRECT_URL`
4. Add both to Vercel environment variables
5. Redeploy

---

### Issue: Encryption errors

**Cause**: Invalid or missing ENCRYPTION_KEY

**Fix**:
```bash
# Generate new key
openssl rand -base64 32

# Add to Vercel env vars
# Redeploy

# Existing connections will need to reconnect
```

---

## 📊 Success Metrics

Your Xero integration is working correctly when:

- ✅ OAuth connection succeeds
- ✅ Connection status shows ACTIVE
- ✅ Manual sync completes successfully
- ✅ Invoices appear in revenue_records with `revenue_sync_status='SYNCED'`
- ✅ Expenses appear in expense_records with `expense_sync_status='SYNCED'`
- ✅ Contact mappings are created (automatic or manual)
- ✅ Sync history displays with expandable error details
- ✅ Retry button works for failed syncs
- ✅ Cron job runs daily at 2 AM UTC
- ✅ No error logs in Vercel

---

## 🎯 Next Steps

Once integration is verified:

1. **Monitor for 24 hours** to ensure cron runs successfully
2. **Review unmapped contacts** and create manual mappings
3. **Check expense categorization** accuracy
4. **Set up alerts** (optional) for failed syncs
5. **Document** any custom Xero account codes for expense mapping

---

## 📞 Support

If you encounter issues:

1. Check Vercel deployment logs
2. Check Supabase logs (Database → Logs)
3. Review error details in Sync History table
4. Verify all environment variables are set correctly
5. Ensure Xero app credentials are valid

**Database Verification Query**:
```sql
-- Run this to check overall health
SELECT
    (SELECT COUNT(*) FROM xero_connections WHERE connection_status = 'ACTIVE') as active_connections,
    (SELECT COUNT(*) FROM financial_revenue_records WHERE revenue_sync_status = 'SYNCED') as synced_invoices,
    (SELECT COUNT(*) FROM financial_expense_records WHERE expense_sync_status = 'SYNCED') as synced_expenses,
    (SELECT COUNT(*) FROM xero_sync_logs WHERE status = 'SUCCESS') as successful_syncs,
    (SELECT MAX(started_at) FROM xero_sync_logs) as last_sync;
```

---

**Ready to deploy?** Follow the steps above in order! 🚀
