# Xero Integration Quickstart Guide

**Feature**: Xero OAuth 2.0 Integration & Automated Data Sync
**Version**: 1.0
**Created**: 2026-02-14

---

## Overview

This guide will help you set up and use the Xero integration to automatically sync invoices and expenses into DevLabs CFO. The integration uses OAuth 2.0 for secure authentication and runs daily automated syncs to keep your financial data up-to-date.

**What you'll achieve:**
- Connect your Xero account to DevLabs CFO
- Automatically sync invoices to revenue records
- Automatically sync expenses with categorization
- Monitor sync status and troubleshoot errors
- Configure expense categorization rules

**Time to complete:** 15-20 minutes

---

## Prerequisites

### For Developers (Initial Setup)

Before users can connect Xero, you need to:

1. **Create a Xero OAuth 2.0 App**:
   - Go to [Xero Developer Portal](https://developer.xero.com/app/manage)
   - Click "New App"
   - Fill in details:
     - **App name**: DevLabs CFO
     - **Company or application URL**: https://devlabs-cfo.vercel.app
     - **Redirect URI**: https://devlabs-cfo.vercel.app/api/xero/oauth/callback
     - **OAuth 2.0 grant type**: Authorization Code
   - Save and note down:
     - **Client ID**: `ABC123...`
     - **Client Secret**: `XYZ789...`

2. **Generate Encryption Key**:
   ```bash
   # Generate 32-byte random key for token encryption
   node -e "console.log('base64:' + require('crypto').randomBytes(32).toString('base64'))"
   ```
   Example output: `base64:J3Xq7M9...`

3. **Generate CRON Secret**:
   ```bash
   # Generate secure random token for cron job authentication
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```
   Example output: `a1b2c3d4e5f6...`

4. **Configure Environment Variables** (Vercel):
   - Go to Vercel Project Settings → Environment Variables
   - Add production variables:
     ```env
     XERO_CLIENT_ID=<your_client_id>
     XERO_CLIENT_SECRET=<your_client_secret>
     XERO_REDIRECT_URI=https://devlabs-cfo.vercel.app/api/xero/oauth/callback
     XERO_TOKEN_ENCRYPTION_KEY=base64:J3Xq7M9...
     CRON_SECRET=a1b2c3d4e5f6...
     ```

5. **Set Up Scheduled Sync** (Supabase):
   - Go to Supabase Dashboard → SQL Editor
   - Run the following SQL to schedule daily sync at 2 AM UTC:
     ```sql
     SELECT cron.schedule(
       'xero-daily-sync',
       '0 2 * * *',  -- 2 AM UTC daily
       $$
       SELECT
         net.http_post(
           url := 'https://devlabs-cfo.vercel.app/api/xero/sync',
           headers := jsonb_build_object(
             'Content-Type', 'application/json',
             'Authorization', 'Bearer YOUR_CRON_SECRET_HERE'
           ),
           body := jsonb_build_object('sync_type', 'FULL')
         ) AS request_id;
       $$
     );
     ```
   - Replace `YOUR_CRON_SECRET_HERE` with the actual CRON_SECRET value

6. **Deploy Database Migrations**:
   ```bash
   # Ensure database connection is configured correctly
   npx prisma migrate status

   # Apply migrations to production
   npx prisma migrate deploy
   ```

---

## For End Users (Connecting Xero)

### Step 1: Navigate to Integrations

1. Log in to DevLabs CFO
2. Go to **Dashboard** → **Integrations**
3. Find the **Xero** integration card

### Step 2: Connect Your Xero Account

1. Click **"Connect Xero"** button
2. You'll be redirected to Xero's authorization page
3. Sign in with your Xero credentials
4. Review the permissions requested:
   - **Read invoices and transactions** (for revenue data)
   - **Read contacts** (for client mapping)
   - **Offline access** (for daily automated sync)
5. Click **"Allow access"** to authorize
6. You'll be redirected back to DevLabs CFO
7. Success! You should see **"Connected"** status with your Xero organization name

### Step 3: Trigger Initial Sync

1. On the Xero integration page, click **"Sync Now"**
2. The first sync will import:
   - All APPROVED and PAID invoices from last 12 months
   - All expenses (bills and bank transactions) from last 12 months
   - Map Xero contacts to existing clients
3. Sync progress will be displayed in the **Sync History** table
4. **Estimated time**: 2-5 minutes for typical small business (50-200 invoices)

### Step 4: Review Sync Results

After the initial sync completes, review:

**Synced Data**:
- Go to **Dashboard** → **Clients** to see revenue data populated
- Go to **Dashboard** → **Expenses** to see imported expenses

**Unmapped Contacts** (if any):
- On the Xero integration page, check the **"Unmapped Contacts"** section
- These are Xero contacts that couldn't be automatically matched to existing clients
- Click **"Map Contacts"** to manually link them to clients

**Uncategorized Expenses** (if any):
- Check the **"Uncategorized Expenses"** section
- These expenses couldn't be auto-categorized
- Click **"Review Expenses"** to manually categorize them

---

## Daily Automated Sync

### How It Works

- **Schedule**: Every day at 2 AM UTC
- **Sync Type**: Full sync (invoices + expenses)
- **Incremental**: Only fetches records modified since last sync (fast and efficient)
- **Duration**: Typically 30 seconds - 2 minutes (depending on changes)
- **No Action Needed**: Syncs run automatically in the background

### Monitoring Sync Status

1. Go to **Dashboard** → **Integrations** → **Xero**
2. View the **Sync History** table showing:
   - Timestamp of each sync
   - Status (Success, Failed, Partial)
   - Record counts (invoices, expenses processed)
   - Duration (how long sync took)
3. Click on a row to expand and see error details (if any)

### Success Criteria

A sync is considered **successful** if:
- All invoices and expenses processed without errors
- Contact mapping accuracy ≥ 95%
- Expense categorization accuracy ≥ 90%
- Sync completed within 15 minutes

A sync is **partial** if:
- Some records succeeded, but some failed (check errors for details)

A sync **failed** if:
- All retry attempts exhausted (3 retries with exponential backoff)
- Critical error (e.g., Xero API unavailable, token expired)

---

## Common Tasks

### Manually Trigger Sync

**When to use**: After creating new invoices in Xero and want immediate sync

1. Go to **Dashboard** → **Integrations** → **Xero**
2. Click **"Sync Now"** button
3. Sync will run immediately (ignoring daily schedule)

### Retry Failed Sync

**When to use**: After resolving issues that caused a sync failure

1. Go to **Dashboard** → **Integrations** → **Xero**
2. Find the failed sync in **Sync History**
3. Click **"Retry"** button
4. A new sync will be triggered for the same records

### Manually Map Unmapped Contacts

**When to use**: Xero contact couldn't be auto-matched to a client

1. Go to **Dashboard** → **Integrations** → **Xero** → **Unmapped Contacts**
2. You'll see a list of Xero contacts with no client match
3. For each contact:
   - View Xero contact name and email
   - Select matching client from dropdown
   - Click **"Map"**
4. Future invoices from this contact will automatically link to the mapped client

### Configure Expense Categorization Rules

**When to use**: Customize how Xero expenses are categorized

1. Go to **Dashboard** → **Integrations** → **Xero** → **Categorization Rules**
2. View existing rules (priority-ordered)
3. To add a new rule:
   - Click **"Add Rule"**
   - Choose matching strategy:
     - **Account Code Pattern**: Match by Xero account code (e.g., `6%` for 6000-6999)
     - **Keyword Pattern**: Match by description keywords (e.g., `subscription`, `AWS`)
   - Select expense type: Contractor, Subscription, Overhead, Other
   - Set priority (lower number = higher priority)
   - Click **"Save"**
4. Rules are applied in priority order during next sync

**Default Rules** (auto-created on first connection):
- Account codes `6%` → Contractor
- Keywords `subscription|license|saas` → Subscription
- Keywords `rent|utilities|office` → Overhead
- Fallback `*` → Other (manual review)

### Disconnect Xero

**When to use**: Switching Xero accounts or removing integration

1. Go to **Dashboard** → **Integrations** → **Xero**
2. Click **"Disconnect"** button
3. Confirm disconnection
4. Effects:
   - OAuth tokens are deleted (Xero access revoked)
   - Sync jobs are disabled
   - Previously synced data remains (but marked as MANUAL)
   - Contact mappings and categorization rules are deleted
5. To reconnect, click **"Connect Xero"** and complete OAuth flow again

---

## Troubleshooting

### Issue: Connection Status = "Token Expired"

**Cause**: OAuth refresh token expired (60-day expiry)

**Solution**:
1. Click **"Reconnect Xero"** button
2. Complete OAuth authorization again
3. New tokens will be stored

### Issue: Sync Status = "Failed"

**Cause**: Various (API error, network issue, invalid data)

**Solution**:
1. Click on the failed sync to expand error details
2. Review error messages:
   - **"Rate limit exceeded"**: Wait 1 minute, then retry
   - **"Xero API unavailable"**: Retry in 5-10 minutes (Xero service issue)
   - **"Token refresh failed"**: Reconnect Xero (see "Token Expired" above)
   - **"Invalid invoice data"**: Contact support with error details
3. Click **"Retry"** button to re-run sync

### Issue: Many Unmapped Contacts (>5%)

**Cause**: Xero contact names/emails don't match existing clients

**Solution** (choose one):
1. **Manual Mapping**: Map each contact individually (see "Manually Map Unmapped Contacts" above)
2. **Update Client Data**: Ensure client emails in DevLabs CFO match Xero contact emails (highest matching confidence)
3. **Standardize Names**: Use consistent naming (e.g., "ACME Corp" vs "Acme Corporation")

### Issue: Many Uncategorized Expenses (>10%)

**Cause**: Xero account codes or descriptions don't match categorization rules

**Solution**:
1. Review uncategorized expenses
2. Identify patterns (e.g., account code `8200` is always software subscriptions)
3. Add new categorization rule:
   - Go to **Categorization Rules**
   - Add rule: Account code `8200` → Subscription
   - Priority: `15` (lower than default rules)
4. Next sync will auto-categorize using new rule

### Issue: Sync Takes Too Long (>15 minutes)

**Cause**: Large volume of records or slow Xero API response

**Solution**:
1. Check sync log for record counts (invoices_processed, expenses_processed)
2. If >1000 records:
   - This is expected for initial sync with years of historical data
   - Subsequent incremental syncs will be faster (<2 minutes)
3. If recurring:
   - Contact support (may need batch processing optimization)

### Issue: Duplicate Revenue Records

**Cause**: Sync ran multiple times before completion

**Solution**:
1. This shouldn't happen (unique constraint on `xero_invoice_id` prevents duplicates)
2. If you see duplicates, contact support with:
   - Affected invoice numbers
   - Sync log IDs
   - Screenshot of duplicate records

---

## Best Practices

### Initial Setup

1. **Clean Up Client Data First**:
   - Ensure all active clients exist in DevLabs CFO before connecting Xero
   - Use email addresses that match Xero contacts (for automatic mapping)
   - Standardize client names (avoid "ACME Corp" vs "Acme Corporation")

2. **Review Default Categorization Rules**:
   - After first connection, review auto-created expense rules
   - Customize based on your Xero chart of accounts
   - Higher priority for more specific rules (lower number)

3. **Test with Manual Sync First**:
   - Before relying on daily automated sync, test with "Sync Now"
   - Review results (unmapped contacts, uncategorized expenses)
   - Adjust rules and mappings as needed

### Ongoing Maintenance

1. **Monitor Sync History Weekly**:
   - Check for failed syncs
   - Review unmapped contacts (map manually)
   - Review uncategorized expenses (add rules if patterns emerge)

2. **Update Client Emails**:
   - When adding new clients in DevLabs CFO, match email to Xero contact
   - This ensures automatic mapping on first invoice sync

3. **Keep Categorization Rules Updated**:
   - As your business evolves, update expense categorization rules
   - Disable outdated rules instead of deleting (preserves history)

4. **Reconcile Monthly**:
   - Once a month, spot-check:
     - Revenue totals (DevLabs CFO vs Xero invoices report)
     - Expense totals (DevLabs CFO vs Xero P&L)
   - Report discrepancies to support

---

## Security & Privacy

### What Data is Accessed?

The Xero integration only reads data (no writing to Xero):
- **Invoices**: Invoice number, date, amounts, line items, contact
- **Expenses**: Bills and bank transactions (payee, amount, date, category)
- **Contacts**: Name and email address (for client mapping)

**Not accessed**:
- Employee data, payroll information
- Bank account numbers or balances
- Tax returns or compliance documents

### How are Tokens Stored?

- OAuth access and refresh tokens are **encrypted** using AES-256-GCM
- Encryption key stored securely in environment variables (never in code)
- Tokens stored in database with Row Level Security (RLS) policies
- Only your organization can access your Xero connection

### Can Xero Access be Revoked?

Yes, you can disconnect Xero anytime:
1. In DevLabs CFO: Click **"Disconnect"** (deletes tokens from our database)
2. In Xero: Go to **Settings** → **Connected Apps** → **Revoke access for DevLabs CFO**

---

## FAQ

**Q: How often does sync run?**
A: Daily at 2 AM UTC. You can also trigger manual sync anytime.

**Q: Does sync overwrite manual edits?**
A: No, manually entered revenue/expense records are never overwritten. Only records with `xero_invoice_id` are updated during sync.

**Q: What happens if I edit an invoice in Xero after it's synced?**
A: The next sync will detect the change (via `ModifiedAfter` timestamp) and update the revenue record in DevLabs CFO.

**Q: Can I sync historical data from multiple years?**
A: Yes, the initial sync imports last 12 months by default. To import older data, contact support (may require manual batch import).

**Q: Will syncing slow down my Xero account?**
A: No, Xero API calls are rate-limited to 60 requests/minute. Sync respects Xero's limits and won't impact your Xero performance.

**Q: What if I have multiple Xero organizations?**
A: Currently, one Xero organization per DevLabs CFO account. Multi-org support is planned for future release.

**Q: Does this work with Xero Demo Company?**
A: Yes, great for testing! Connect your Xero Demo Company to try the integration risk-free.

**Q: Can I exclude certain invoices or expenses from sync?**
A: Not currently. All APPROVED and PAID invoices are synced. DRAFT and VOIDED invoices are ignored. Custom filters planned for future release.

---

## Support

### Getting Help

- **In-App**: Click **"Help"** button on Xero integration page
- **Email**: support@devlabscfo.com
- **Documentation**: [Full Xero Integration Docs](https://docs.devlabscfo.com/integrations/xero)

### Reporting Issues

When contacting support, please include:
1. Your organization name
2. Xero integration page screenshot
3. Sync log ID (if sync failed)
4. Error message (expand sync log to see errors)
5. Steps to reproduce (if applicable)

---

## Next Steps

After successfully connecting Xero:

1. **Set Up Mercury Integration** (optional):
   - Sync banking data for complete financial picture
   - Auto-categorize bank transactions

2. **Configure Margin Targets**:
   - Go to **Dashboard** → **Settings** → **Margin Targets**
   - Set global margin target (default: 40%)
   - Set per-client or per-service targets (optional)

3. **View Margin Analytics**:
   - Go to **Dashboard** → **Analytics**
   - See client profitability calculated from Xero revenue/expense data
   - Identify low-margin clients (tier 4-5)

4. **Generate Pricing Recommendations**:
   - Go to **Dashboard** → **Clients** → **[Client Name]**
   - Click **"Pricing Recommendations"**
   - Get AI-powered pricing strategies based on actual margins

---

## Changelog

### Version 1.0 (2026-02-14)
- Initial release
- OAuth 2.0 connection flow
- Daily automated sync (invoices + expenses)
- Tiered contact-to-client mapping (95% accuracy)
- Hybrid expense categorization (90% accuracy)
- Sync status monitoring dashboard
- Manual contact mapping UI
- Expense categorization rules UI
- Error handling with exponential backoff retry
- Token refresh automation

---

**Enjoy automated financial data sync with Xero! 🎉**
