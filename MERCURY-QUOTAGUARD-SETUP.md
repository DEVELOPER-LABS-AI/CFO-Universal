# Mercury Integration with QuotaGuard Static IP Setup

This guide walks you through setting up QuotaGuard Static to provide a static IP address for Mercury API whitelisting.

---

## Why QuotaGuard?

Mercury Bank requires IP whitelisting for API access. Vercel doesn't provide static IPs by default, so we use QuotaGuard as a proxy service to route all Mercury API requests through a static IP.

**Cost**: $9/month (Starter plan) - much cheaper than Vercel Enterprise

---

## Step 1: Sign Up for QuotaGuard Static

### 1.1 Create Account

1. Go to https://www.quotaguard.com/static-ip
2. Click "Start Free Trial" (14-day trial)
3. Create account with your email
4. Choose plan:
   - **Starter**: $9/month, 1 static IP, 10GB bandwidth (sufficient for most use cases)
   - **Small**: $39/month, 2 static IPs, 100GB bandwidth (for high-volume)

### 1.2 Get Your Credentials

After signup, you'll receive:

**Dashboard**: https://www.quotaguard.com/dashboard

**Static IP Address**:
```
Example: 54.243.123.45
```
☝️ This is what you'll whitelist with Mercury

**Proxy URL**:
```
Example: http://quotaguard12345:abc123xyz@us-east-static-01.quotaguard.com:9293
```
☝️ This goes in your QUOTAGUARD_URL environment variable

---

## Step 2: Configure Mercury API Whitelist

### 2.1 Log into Mercury Dashboard

1. Go to https://app.mercury.com
2. Navigate to: **Settings** → **Developers** → **API Keys**
3. Find your API key or create a new one

### 2.2 Add QuotaGuard Static IP

1. Click on your API key
2. Find "IP Whitelist" or "Allowed IPs" section
3. Click "Add IP Address"
4. Enter your QuotaGuard Static IP (from Step 1.2)
   - Example: `54.243.123.45`
5. Add description: "QuotaGuard Static IP for Vercel"
6. Save

**Note**: It may take 5-10 minutes for IP whitelist changes to propagate.

---

## Step 3: Add Environment Variables to Vercel

### 3.1 Add QUOTAGUARD_URL

1. Go to Vercel Dashboard: https://vercel.com/YOUR_ORG/YOUR_PROJECT/settings/environment-variables
2. Click "Add New"
3. Set:
   - **Name**: `QUOTAGUARD_URL`
   - **Value**: Your proxy URL from QuotaGuard dashboard
     ```
     http://quotaguard12345:abc123xyz@us-east-static-01.quotaguard.com:9293
     ```
   - **Environments**: Select all (Production, Preview, Development)
4. Click "Save"

### 3.2 Add to Local .env (for testing)

```bash
# Add to .env file
QUOTAGUARD_URL=http://quotaguard12345:abc123xyz@us-east-static-01.quotaguard.com:9293
```

**⚠️ Important**: Never commit `.env` to git! It's already in `.gitignore`.

---

## Step 4: Redeploy to Apply Changes

### 4.1 Trigger Redeploy

Vercel needs to redeploy to pick up the new environment variable:

**Option A - Push to main** (triggers auto-deploy):
```bash
git add .
git commit -m "chore: add QuotaGuard proxy support for Mercury static IP"
git push origin main
```

**Option B - Manual redeploy**:
1. Go to Vercel Dashboard → Deployments
2. Click "..." menu on latest deployment
3. Click "Redeploy"
4. Confirm

### 4.2 Monitor Deployment

1. Watch deployment logs in Vercel
2. Look for: `[Mercury Client] Using QuotaGuard proxy for static IP`
3. Verify deployment succeeds

---

## Step 5: Test Mercury Connection

### 5.1 Test from Dashboard

1. Navigate to: `https://YOUR_DOMAIN.vercel.app/dashboard/integrations/mercury`
2. Click "Connect Mercury Account"
3. Enter your Mercury API key: `mercury_production_rma_...` (without `secret-token:` prefix)
4. Click "Connect"

**Expected Result**:
- ✅ "Mercury connected successfully"
- Connection status shows "ACTIVE"

**If it fails**:
- Check Mercury dashboard for API call logs
- Verify the QuotaGuard IP is whitelisted
- Check Vercel deployment logs for errors

### 5.2 Test API Call (Optional)

Use curl to test from command line:

```bash
curl -x http://quotaguard12345:abc123xyz@us-east-static-01.quotaguard.com:9293 \
  -H "Authorization: secret-token:mercury_production_rma_YOUR_KEY" \
  https://api.mercury.com/api/v1/account
```

Should return your Mercury account details.

---

## Step 6: Verify Static IP is Working

### 6.1 Check QuotaGuard Dashboard

1. Go to https://www.quotaguard.com/dashboard
2. View "Recent Connections" or "Usage" tab
3. You should see API calls to `api.mercury.com`
4. Verify the source IP matches your static IP

### 6.2 Check Mercury API Logs

1. In Mercury dashboard, go to API logs
2. Verify incoming requests show your QuotaGuard static IP
3. Confirm no 401/403 errors (IP whitelist rejections)

---

## Troubleshooting

### Issue: "Invalid API Key" Error

**Cause**: Mercury API whitelist may not include QuotaGuard IP yet

**Fix**:
1. Double-check QuotaGuard static IP is added to Mercury whitelist
2. Wait 5-10 minutes for changes to propagate
3. Try again

### Issue: "Proxy Authentication Failed"

**Cause**: QUOTAGUARD_URL is incorrect or malformed

**Fix**:
1. Verify the proxy URL in Vercel environment variables
2. Ensure format: `http://user:pass@proxy-host:port`
3. No trailing slash
4. Copy directly from QuotaGuard dashboard

### Issue: Connection Times Out

**Cause**: Proxy server unreachable or Mercury API down

**Fix**:
1. Check QuotaGuard status: https://status.quotaguard.com
2. Check Mercury API status: https://status.mercury.com
3. Verify `QUOTAGUARD_URL` is set in Vercel (not just locally)

### Issue: "QUOTAGUARD_URL is undefined"

**Cause**: Environment variable not set in deployment environment

**Fix**:
1. Add `QUOTAGUARD_URL` to Vercel environment variables
2. Ensure it's enabled for "Production" environment
3. Redeploy the application

### Issue: High Latency

**Cause**: Proxy adds network hop, increasing latency

**Fix**:
- Choose QuotaGuard region closest to your users
- Upgrade to QuotaGuard Pro for dedicated proxy
- Consider Vercel Enterprise static IPs for production

---

## Monitoring & Maintenance

### Monitor QuotaGuard Usage

1. **Bandwidth**: Check QuotaGuard dashboard for monthly usage
2. **Requests**: Monitor request count to avoid overages
3. **Alerts**: Set up alerts for 80% bandwidth threshold

### Estimated Bandwidth Usage

- **Connection test**: ~1 KB
- **Transaction sync** (500 transactions): ~500 KB - 1 MB
- **Daily sync**: ~1-2 MB/day
- **Monthly estimate**: 30-60 MB/month

**Starter plan (10 GB)** is more than sufficient for typical usage.

### Rotate Static IP (if needed)

If you need to change your static IP:

1. Contact QuotaGuard support to rotate IP
2. Update Mercury whitelist with new IP
3. No code changes needed (proxy URL stays the same)

---

## Cost Breakdown

| Service | Plan | Cost | Purpose |
|---------|------|------|---------|
| QuotaGuard Static | Starter | $9/month | Static IP proxy |
| Vercel | Hobby/Pro | $0-20/month | Hosting |
| **Total** | | **$9-29/month** | Full stack with static IP |

**Compare to**:
- Vercel Enterprise (static IP): $500+/month
- AWS NAT Gateway: ~$45/month + EC2 costs

---

## Security Notes

1. **QUOTAGUARD_URL contains credentials**: Treat it like a password
2. **Never log the full URL**: Only log that proxy is being used
3. **Rotate credentials**: QuotaGuard allows credential rotation
4. **Use different proxies**: For dev/staging/prod if needed

---

## Alternative Proxy Services

If QuotaGuard doesn't work for you:

| Service | Cost | Features |
|---------|------|----------|
| **Fixie Socks** | $5-20/month | SOCKS5 proxy, static IP |
| **ProxyMesh** | $10-50/month | Multiple IPs, rotating options |
| **Bright Data** | $50+/month | Enterprise-grade, many IPs |

All work with the same integration pattern (set proxy URL, use `https-proxy-agent`).

---

## Next Steps

After setup is complete:

1. ✅ Test Mercury connection from dashboard
2. ✅ Run manual sync to verify transaction import
3. ✅ Check QuotaGuard bandwidth usage
4. ✅ Set up monitoring/alerts for failed syncs
5. ✅ Configure daily cron job (already set up in `vercel.json`)

**QuotaGuard Support**: support@quotaguard.com

**Mercury API Support**: developers@mercury.com
