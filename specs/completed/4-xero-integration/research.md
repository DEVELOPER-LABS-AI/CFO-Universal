# Research: Xero OAuth 2.0 Integration & Automated Data Sync

**Feature**: Xero OAuth 2.0 Integration & Automated Data Sync
**Branch**: 4-xero-integration
**Created**: 2026-02-14
**Last Updated**: 2026-02-14

---

## Overview

This document captures research findings and technical decisions for implementing automated Xero accounting integration with OAuth 2.0 authentication and daily data synchronization for invoices and expenses.

---

## Research Areas

### 1. Xero OAuth 2.0 Implementation Strategy

**Question**: What's the best approach for implementing Xero OAuth 2.0 in a Next.js serverless environment?

**Research Findings**:

**Xero OAuth 2.0 Flow**:
- Uses standard OAuth 2.0 Authorization Code Grant flow
- Requires registered OAuth 2.0 app in Xero Developer Portal
- Access tokens expire after 30 minutes, refresh tokens valid for 60 days
- Must select tenant (organization) after initial authorization
- Required scopes: `offline_access`, `accounting.transactions.read`, `accounting.contacts.read`

**Next.js Implementation Options**:
1. **Route Handlers** (`app/api/xero/callback/route.ts`) - Recommended for App Router
2. **API Routes** (`pages/api/xero/callback.ts`) - Legacy Pages Router
3. **Third-party SDKs** - xero-node SDK (official), xero-oauth2 library

**xero-node SDK Features**:
- Official Xero SDK with OAuth 2.0 support
- Automatic token refresh handling
- Built-in TypeScript types
- API rate limit handling (60 req/min)
- Multi-tenant support (tenant switching)

**Decision**: Use xero-node SDK with Next.js Route Handlers
- **Rationale**: Official support, automatic token refresh, TypeScript types, handles rate limits
- **Implementation**:
  - Install `xero-node` package
  - Create OAuth callback Route Handler at `/api/xero/oauth/callback`
  - Store tokens encrypted in database using Prisma
  - Initialize XeroClient with stored tokens for API calls
  - Implement token refresh before expiry check

**Trade-offs**:
- ✅ Pros: Maintained by Xero, handles edge cases, good documentation
- ⚠️ Cons: Adds dependency (162 KB gzipped), learning curve

**Alternatives Considered**:
- Custom OAuth implementation - Rejected (complex, error-prone, reinvents wheel)
- Simple HTTP client - Rejected (no automatic token refresh, manual rate limiting)

---

### 2. Token Storage and Security

**Question**: How should OAuth tokens be stored securely in a serverless environment?

**Research Findings**:

**Token Security Requirements**:
- Access tokens and refresh tokens MUST be encrypted at rest
- Tokens MUST NOT be logged or exposed to client
- Tokens transmitted only over HTTPS
- Implement token rotation on refresh

**Encryption Strategies**:
1. **Database-level encryption** (Supabase): Transparent encryption at rest
2. **Application-level encryption**: Encrypt tokens before storing in database
3. **Secrets manager** (AWS Secrets Manager, Vercel Environment Variables)

**Supabase Security Features**:
- Transparent encryption at rest (AES-256)
- Row Level Security (RLS) policies
- Service role for server-side access
- SSL/TLS for data in transit

**Decision**: Database-level encryption + application-level encryption for tokens
- **Rationale**: Defense in depth - two layers of encryption for OAuth tokens
- **Implementation**:
  - Use Supabase transparent encryption (baseline)
  - Encrypt tokens using `crypto.subtle` Web Crypto API before database insert
  - Store encryption key in Vercel environment variable `XERO_TOKEN_ENCRYPTION_KEY`
  - Decrypt tokens only in memory when needed for API calls
  - Never log tokens in plain text

**Token Rotation Strategy**:
- Check token expiry before each API call
- Refresh if expiring within 5 minutes
- Update database with new tokens immediately
- Implement mutex lock to prevent concurrent refreshes

---

### 3. Scheduled Sync Strategy (Daily Job Execution)

**Question**: How to implement reliable daily sync in a serverless Next.js environment?

**Research Findings**:

**Serverless Cron Options**:
1. **Vercel Cron Jobs**: Native support for scheduled functions
2. **Supabase pg_cron**: PostgreSQL extension for database-triggered cron
3. **External services**: AWS EventBridge, GitHub Actions, Zapier

**Vercel Cron Jobs**:
- Defined in `vercel.json` configuration
- Invokes Route Handler on schedule (cron syntax)
- Runs in serverless function (10s timeout on Hobby, 60s on Pro)
- Free tier: 100 executions/day, 10s max duration
- Protected via authorization header (CRON_SECRET)

**Supabase pg_cron**:
- PostgreSQL extension for scheduled SQL/function execution
- Calls webhook URL (Next.js Route Handler) on schedule
- Runs inside database (no timeout limits)
- More reliable for long-running tasks
- Free tier: Unlimited cron jobs

**Decision**: Hybrid approach - pg_cron triggers Next.js Route Handler
- **Rationale**: Reliability of pg_cron + flexibility of Next.js code execution
- **Implementation**:
  ```sql
  -- Schedule daily sync at 2 AM UTC
  SELECT cron.schedule(
    'xero-daily-sync',
    '0 2 * * *',  -- 2 AM daily
    $$
    SELECT http_post(
      'https://devlabs-cfo.vercel.app/api/xero/sync',
      '{"secret": "<CRON_SECRET>"}',
      'application/json'
    );
    $$
  );
  ```
  - Next.js Route Handler validates CRON_SECRET header
  - Implements queue for long-running syncs (split into batches)
  - Returns 200 quickly, processes in background with status updates

**Trade-offs**:
- ✅ Pros: Reliable scheduling, no Vercel timeout limits, runs even if app sleeping
- ⚠️ Cons: Requires pg_cron extension, slightly complex setup

**Incremental Sync Pattern**:
- Store `last_sync_timestamp` per organization
- Use Xero `ModifiedAfter` query parameter to fetch only changed records
- Update timestamp only on successful sync completion
- On failure, keep old timestamp to retry full set on next sync

---

### 4. Contact-to-Client Mapping Strategy

**Question**: How to intelligently map Xero contacts to internal client records?

**Research Findings**:

**Matching Strategies**:
1. **Exact match by email**: Highest confidence, O(1) lookup
2. **Exact match by normalized name**: Remove spaces, lowercase, special chars
3. **Fuzzy match by name**: Levenshtein distance, Jaro-Winkler similarity
4. **Manual mapping**: Admin intervention for unmapped contacts

**String Similarity Algorithms**:
- **Levenshtein distance**: Edit distance (insertions, deletions, substitutions)
- **Jaro-Winkler**: Similarity score optimized for short strings like names
- **Soundex**: Phonetic matching (useful for spelling variations)

**npm Packages**:
- `string-similarity` - Levenshtein and cosine similarity
- `fuzzysort` - Fast fuzzy search with scoring
- `natural` - NLP library with string distance algorithms

**Decision**: Tiered matching approach with caching
- **Rationale**: Start with high-confidence exact matches, fall back to fuzzy, cache results
- **Implementation**:
  1. **Tier 1 (Email)**: Exact match on contact email → client email (95% confidence)
  2. **Tier 2 (Name exact)**: Normalized name match (case-insensitive, trimmed) (90% confidence)
  3. **Tier 3 (Name fuzzy)**: Jaro-Winkler similarity > 0.85 (80% confidence)
  4. **Tier 4 (Manual)**: Flag for admin review if all tiers fail
  - Cache mapping decisions in `xero_contact_mappings` table
  - Reuse cached mappings on subsequent syncs (O(1) lookup)
  - Admin can override automatic mappings
  - Log mapping decisions with confidence scores

**Fuzzy Match Library**:
- Use `string-similarity` package (59 KB, well-maintained)
- Jaro-Winkler algorithm for name matching
- Threshold: 0.85 similarity score (tunable via config)

---

### 5. Error Handling and Retry Logic

**Question**: How to handle Xero API errors gracefully with exponential backoff?

**Research Findings**:

**Xero API Error Types**:
- **Transient errors**: 429 (Rate limit), 503 (Service unavailable), timeouts
- **Permanent errors**: 401 (Unauthorized - token expired), 404 (Not found)
- **Validation errors**: 400 (Bad request - malformed data)

**Retry Strategies**:
1. **Exponential backoff**: Wait 2^n seconds between retries (1s, 2s, 4s, 8s)
2. **Exponential backoff with jitter**: Add randomness to prevent thundering herd
3. **Fixed delays**: Simple but can cause congestion

**npm Retry Libraries**:
- `axios-retry` - Automatic retries for axios HTTP client
- `p-retry` - Promise-based retry with exponential backoff
- `retry` - Classic retry library with extensive options

**Decision**: Custom retry logic with exponential backoff + jitter
- **Rationale**: Fine-grained control, avoid library bloat for simple use case
- **Implementation**:
  ```typescript
  async function retryWithBackoff(fn, maxRetries = 3) {
    for (let i = 0; i < maxRetries; i++) {
      try {
        return await fn();
      } catch (error) {
        if (!isTransientError(error) || i === maxRetries - 1) throw error;
        const delay = Math.min(1000 * 2**i + Math.random() * 1000, 15000);
        await sleep(delay);
      }
    }
  }
  ```
  - Retry only transient errors (429, 503, timeout)
  - Max 3 retries with delays: ~1s, ~2s, ~4s (capped at 15s)
  - Jitter prevents simultaneous retries across multiple requests
  - Log all retry attempts with error context

**Rate Limit Handling**:
- Xero rate limit: 60 requests/minute per organization
- Respect `Retry-After` header when 429 received
- Implement request queue with rate limiter (60 req/min)
- Use `bottleneck` package for rate limiting (23 KB)

---

### 6. Data Categorization for Expenses

**Question**: How to automatically categorize Xero expenses into DevLabs CFO expense types?

**Research Findings**:

**Xero Expense Structure**:
- Bills and bank transactions have `AccountCode` field
- Account codes map to Chart of Accounts (CoA)
- Typical CoA categories: Wages, Software, Rent, Marketing, etc.
- Contact name on bills can identify contractor payments

**Categorization Strategies**:
1. **Account code mapping**: Map Xero account codes to expense types
2. **Description pattern matching**: Regex/keywords in expense description
3. **Contact name matching**: Identify contractors by payee name
4. **Machine learning**: Train classifier on historical categorized expenses (future)

**DevLabs CFO Expense Types** (from spec):
- Contractor payments (link to contractor record)
- Subscriptions (SaaS, tools)
- Overhead (rent, utilities)
- Other (uncategorized)

**Decision**: Hybrid mapping with fallback hierarchy
- **Rationale**: Combine multiple signals for highest accuracy
- **Implementation**:
  1. **Check payee name**: If matches contractor name → "Contractor Payment" + link to contractor
  2. **Check account code**: Map via configuration table (e.g., 6000-6999 = "Contractor Payments")
  3. **Check description keywords**: Regex patterns (e.g., "subscription", "license" → "Subscriptions")
  4. **Default to "Other"**: Flag for manual categorization if no match
  - Store mapping rules in `xero_expense_category_mappings` table
  - Admin can configure custom mappings in UI
  - Log categorization decisions with confidence scores
  - Target: 90% auto-categorization accuracy

**Configuration Table Structure**:
```typescript
xero_expense_category_mappings {
  id: UUID
  account_code_pattern: String  // e.g., "6%", "500"
  keyword_pattern: String        // e.g., "subscription", "AWS"
  expense_type: Enum             // CONTRACTOR, SUBSCRIPTION, OVERHEAD, OTHER
  priority: Int                  // Lower number = higher priority
}
```

---

### 7. Sync Status Tracking and Monitoring

**Question**: How to provide visibility into sync operations and troubleshoot failures?

**Research Findings**:

**Sync Monitoring Requirements**:
- Track sync execution (start, end, duration)
- Count records processed (invoices, expenses, contacts)
- Log errors with actionable context
- Provide dashboard UI for sync history
- Alert on failures

**Status Tracking Patterns**:
1. **Single sync_logs table**: One record per sync execution
2. **Separate error_logs table**: Dedicated error tracking
3. **Hybrid**: sync_logs + embedded errors array

**Decision**: Single `xero_sync_logs` table with embedded errors
- **Rationale**: Simple queries, errors contextually linked to sync execution
- **Implementation**:
  - Create sync log record on job start (status: "RUNNING")
  - Update with counts as processing progresses
  - Add errors to `errors` JSONB array as they occur
  - Mark status "SUCCESS" or "FAILED" on completion
  - Store last_sync_timestamp on success for incremental sync
  - Retain logs for 90 days minimum (compliance)

**Dashboard UI**:
- Display recent sync history (table with timestamp, status, counts)
- Show error details in expandable rows
- Provide "Retry Failed Sync" button
- Graph sync duration over time
- Alert badge for failed syncs

**Notification Strategy**:
- Email admin on sync failure (after all retries exhausted)
- Dashboard alert banner for failed syncs
- Optional: Slack webhook notification (future enhancement)

---

## Summary of Technical Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| OAuth Library | xero-node SDK | Official support, auto token refresh, TypeScript types |
| Token Storage | Database encryption + app-level encryption | Defense in depth, Supabase + Web Crypto API |
| Scheduled Sync | pg_cron → Next.js Route Handler | Reliable scheduling, no timeout limits |
| Incremental Sync | `ModifiedAfter` with last_sync_timestamp | Performance optimization, reduced API calls |
| Contact Mapping | Tiered matching (email → name → fuzzy) + caching | High accuracy (95% target), fast lookups |
| Error Handling | Exponential backoff + jitter (custom) | Handles transient errors, avoids library bloat |
| Rate Limiting | `bottleneck` package (60 req/min) | Respect Xero limits, prevents 429 errors |
| Expense Categorization | Hybrid (payee → account code → keywords) | 90% auto-categorization target |
| Sync Monitoring | Single sync_logs table + JSONB errors | Simple queries, contextual error tracking |

---

## Resolved Unknowns

✅ **How to handle token refresh in serverless environment?**
- Check expiry before each API call, refresh if within 5 minutes of expiry
- Use xero-node SDK's built-in `refreshToken()` method
- Implement mutex lock to prevent concurrent refreshes

✅ **How to trigger daily sync reliably?**
- Use Supabase pg_cron to call Next.js Route Handler webhook
- Validate CRON_SECRET header to prevent unauthorized execution
- Split long syncs into batches to avoid timeout

✅ **How to map Xero contacts to clients with high accuracy?**
- Tiered matching: exact email (95%) → exact name (90%) → fuzzy (80%)
- Cache mappings in `xero_contact_mappings` table for O(1) lookups
- Admin manual override for edge cases

✅ **How to categorize expenses automatically?**
- Check payee name for contractors, then account codes, then description keywords
- 90% auto-categorization target via hybrid approach
- Flag remaining 10% for manual review

✅ **How to track and troubleshoot sync failures?**
- Single sync_logs table with embedded errors (JSONB array)
- Dashboard UI showing sync history, error details, retry option
- Email/dashboard alerts on failures

✅ **How to handle Xero API rate limits?**
- Implement request queue with `bottleneck` (60 req/min limit)
- Respect `Retry-After` header on 429 responses
- Exponential backoff for retries

✅ **What data to sync (invoices, expenses, reports)?**
- Sync APPROVED and PAID invoices only (no DRAFT/VOIDED)
- Sync bills and bank transactions for expenses
- No report sync (P&L, balance sheet) - only raw transactions

---

## Next Steps

1. ✅ All research questions resolved
2. ⏭️ Proceed to data model design (`data-model.md`)
3. ⏭️ Define API contracts (`contracts/`)
4. ⏭️ Create implementation plan (`plan.md`)
5. ⏭️ Generate tasks (`tasks.md`)
