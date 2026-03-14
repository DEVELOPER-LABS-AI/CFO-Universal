# Implementation Plan: Xero OAuth 2.0 Integration & Automated Data Sync

**Feature**: Xero OAuth 2.0 Integration & Automated Data Sync
**Branch**: 4-xero-integration
**Created**: 2026-02-14
**Status**: Planning Complete

---

## Executive Summary

This plan details the implementation of automated Xero accounting integration with OAuth 2.0 authentication and daily synchronization of invoices and expenses. The system will eliminate manual data entry for financial records, ensure accurate profit margin calculations, and provide real-time visibility into sync operations.

**Key Deliverables:**
- OAuth 2.0 connection flow with encrypted token storage
- Daily automated sync of invoices → revenue records
- Daily automated sync of expenses → expense records
- Intelligent contact-to-client mapping (95% accuracy target)
- Sync status monitoring dashboard
- Error handling with exponential backoff retry logic
- Token refresh automation

**Estimated Complexity**: Medium-High (7-10 days)

**Timeline Breakdown**:
- Days 1-2: Database schema + OAuth implementation
- Days 3-4: Invoice sync service + contact mapping
- Days 5-6: Expense sync service + categorization
- Days 7-8: Scheduled job setup + monitoring UI
- Days 9-10: Testing, error handling, documentation

---

## Technical Context

### Technology Stack

**OAuth & Authentication:**
- **xero-node SDK** (v5.x): Official Xero SDK with OAuth 2.0 support, automatic token refresh
- **Web Crypto API**: Token encryption/decryption (AES-256-GCM)
- **Next.js Route Handlers**: OAuth callback endpoints (`/api/xero/oauth/*`)

**Data Synchronization:**
- **Supabase pg_cron**: Scheduled job trigger (PostgreSQL extension)
- **Next.js API Routes**: Sync execution endpoints (`/api/xero/sync`)
- **Prisma**: Database ORM for sync logging and token management
- **string-similarity**: Fuzzy name matching for contact-to-client mapping
- **bottleneck**: Rate limiting (60 requests/min for Xero API)

**Database Layer:**
- **Prisma**: Schema management for new tables (connections, sync_logs, mappings)
- **PostgreSQL (Supabase)**: Token storage with RLS policies
- **Supabase RLS**: Organization-level data isolation

**Monitoring & Logging:**
- **JSONB fields**: Flexible error logging in sync_logs table
- **Next.js UI**: Sync history dashboard with error details
- **Supabase Realtime** (optional): Live sync status updates

**Development Tools:**
- **TypeScript Strict Mode**: Type-safe integration services
- **Zod**: API response validation and schema parsing
- **Vitest**: Unit tests for mapping and categorization logic

---

## Architecture Decisions

### Decision 1: Use xero-node SDK for OAuth and API Calls

**Rationale**: Official support from Xero, handles token refresh automatically, built-in TypeScript types, rate limit management

**Implementation**:
- Install `xero-node` package (v5.6.0+)
- Initialize `XeroClient` with client ID, secret, redirect URI
- Use `oauth2.buildConsentUrl()` for authorization URL
- Use `oauth2.apiCallback()` to exchange code for tokens
- Use `oauth2.refreshToken()` for automatic token renewal

**Alternatives Considered**:
- **Custom OAuth implementation**: Rejected - Complex, error-prone, reinvents wheel
- **Simple HTTP client (axios)**: Rejected - No automatic token refresh, manual rate limiting

**Trade-offs**:
- ✅ Pros: Maintained by Xero, handles edge cases, excellent documentation
- ⚠️ Cons: 162 KB gzipped dependency, learning curve for SDK patterns

---

### Decision 2: Encrypt Tokens with Web Crypto API (Application-Level)

**Rationale**: Defense in depth - Two layers of encryption (Supabase transparent + application-level) for OAuth tokens

**Implementation**:
```typescript
// Encrypt before database insert
import { subtle } from 'crypto';

async function encryptToken(plainToken: string, key: CryptoKey): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(plainToken);
  const encrypted = await subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encoded
  );
  return btoa(JSON.stringify({
    iv: Array.from(iv),
    data: Array.from(new Uint8Array(encrypted))
  }));
}
```

**Key Management**:
- Store encryption key in `XERO_TOKEN_ENCRYPTION_KEY` environment variable
- Key rotation supported (re-encrypt tokens on rotation)
- Never log tokens in plain text (redact in error logs)

**Security Properties**:
- **Encryption**: AES-256-GCM (authenticated encryption)
- **At Rest**: Supabase transparent encryption + app-level encryption
- **In Transit**: HTTPS only (TLS 1.3)
- **In Memory**: Decrypt only when needed for API calls, clear after use

---

### Decision 3: Hybrid Scheduling - pg_cron Triggers Next.js Route Handler

**Rationale**: Reliability of database-driven cron + flexibility of Next.js code execution

**Implementation**:
```sql
-- Supabase SQL Editor: Schedule daily sync at 2 AM UTC
SELECT cron.schedule(
  'xero-daily-sync',
  '0 2 * * *',  -- Cron syntax: minute hour day month weekday
  $$
  SELECT
    net.http_post(
      url := 'https://devlabs-cfo.vercel.app/api/xero/sync',
      headers := '{"Content-Type": "application/json", "Authorization": "Bearer <CRON_SECRET>"}'::jsonb,
      body := '{"sync_type": "FULL"}'::jsonb
    ) AS request_id;
  $$
);
```

**Next.js Route Handler** (`/api/xero/sync/route.ts`):
- Validate `Authorization: Bearer <CRON_SECRET>` header
- Create sync_log record (status: PENDING)
- Execute sync job (invoices + expenses)
- Update sync_log with results (status: SUCCESS/FAILED)
- Return 200 quickly (job runs async if long-running)

**Alternatives Considered**:
- **Vercel Cron**: Rejected - 60s timeout on Pro tier, cron config in vercel.json (less flexible)
- **External scheduler (AWS EventBridge)**: Rejected - Adds complexity, separate service

**Trade-offs**:
- ✅ Pros: No timeout limits, runs even if Vercel app sleeping, free on Supabase
- ⚠️ Cons: Requires pg_cron extension, slightly more complex setup

---

### Decision 4: Tiered Contact Matching with Mapping Cache

**Rationale**: Achieve 95% auto-match accuracy target while maintaining O(1) lookup performance after initial mapping

**Implementation**:
```typescript
async function mapContactToClient(xeroContact: XeroContact): Promise<string | null> {
  // Tier 1: Check cache (O(1) lookup)
  const cached = await getCachedMapping(xeroContact.ContactID);
  if (cached) return cached.client_id;

  // Tier 2: Exact email match (95% confidence)
  if (xeroContact.EmailAddress) {
    const client = await findClientByEmail(xeroContact.EmailAddress);
    if (client) {
      await cacheMapping(xeroContact, client.id, 'EMAIL_EXACT', 0.95);
      return client.id;
    }
  }

  // Tier 3: Exact normalized name match (90% confidence)
  const normalizedName = normalizeName(xeroContact.Name);
  const exactMatch = await findClientByNormalizedName(normalizedName);
  if (exactMatch) {
    await cacheMapping(xeroContact, exactMatch.id, 'NAME_EXACT', 0.90);
    return exactMatch.id;
  }

  // Tier 4: Fuzzy name match (80% confidence if > 0.85 similarity)
  const fuzzyMatches = await findClientsByFuzzyName(xeroContact.Name);
  const bestMatch = fuzzyMatches.find(m => m.similarity > 0.85);
  if (bestMatch) {
    await cacheMapping(xeroContact, bestMatch.id, 'NAME_FUZZY', bestMatch.similarity);
    return bestMatch.id;
  }

  // Tier 5: No match - flag for manual mapping
  await flagUnmappedContact(xeroContact);
  return null;
}
```

**Fuzzy Matching**:
- Use `string-similarity` package (compareTwoStrings method)
- Jaro-Winkler algorithm optimized for short strings (names)
- Threshold: 0.85 similarity score (tunable via environment variable)

**Caching Strategy**:
- Store all mapping decisions in `xero_contact_mappings` table
- O(1) lookup on subsequent syncs (99% cache hit rate expected)
- Admin can override automatic mappings via UI
- Mapping confidence displayed in UI for audit

---

### Decision 5: Exponential Backoff with Jitter for Retry Logic

**Rationale**: Handle transient Xero API errors gracefully without causing thundering herd on retry

**Implementation**:
```typescript
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      // Only retry transient errors
      if (!isTransientError(error) || attempt === maxRetries - 1) {
        throw error;
      }

      // Exponential backoff: 2^attempt * baseDelay
      const exponentialDelay = Math.min(baseDelay * Math.pow(2, attempt), 15000);

      // Add jitter: random 0-1000ms to prevent synchronized retries
      const jitter = Math.random() * 1000;
      const totalDelay = exponentialDelay + jitter;

      console.log(`Retry attempt ${attempt + 1}/${maxRetries} after ${totalDelay}ms`);
      await sleep(totalDelay);
    }
  }
  throw new Error('Max retries exceeded');
}

function isTransientError(error: any): boolean {
  if (error.response) {
    const status = error.response.status;
    return status === 429 || status === 503 || status >= 500;
  }
  return error.code === 'ETIMEDOUT' || error.code === 'ECONNRESET';
}
```

**Retry Schedule**:
- Attempt 1: Immediate
- Attempt 2: ~1-2 seconds later (1000ms + jitter)
- Attempt 3: ~3-4 seconds later (2000ms + jitter)
- Attempt 4: ~5-6 seconds later (4000ms + jitter)
- Max delay capped at 15 seconds

**Rate Limiting**:
- Use `bottleneck` package to enforce 60 requests/min
- Respect `Retry-After` header when Xero returns 429
- Queue requests during rate limit period

---

### Decision 6: Hybrid Expense Categorization (Payee → Account Code → Keywords)

**Rationale**: Achieve 90% auto-categorization accuracy by combining multiple signals

**Implementation**:
```typescript
async function categorizeExpense(xeroExpense: XeroExpense): Promise<ExpenseType> {
  // Priority 1: Check if payee matches contractor name (highest confidence)
  if (xeroExpense.Contact?.Name) {
    const contractor = await findContractorByName(xeroExpense.Contact.Name);
    if (contractor) {
      return {
        type: 'CONTRACTOR',
        contractor_id: contractor.id,
        confidence: 0.95
      };
    }
  }

  // Priority 2: Check account code mapping rules (configurable)
  if (xeroExpense.AccountCode) {
    const mappingRule = await findExpenseMappingByAccountCode(xeroExpense.AccountCode);
    if (mappingRule) {
      return {
        type: mappingRule.expense_type,
        confidence: 0.90
      };
    }
  }

  // Priority 3: Check description keywords (regex patterns)
  const description = xeroExpense.Description || '';
  const keywordRule = await findExpenseMappingByKeywords(description);
  if (keywordRule) {
    return {
      type: keywordRule.expense_type,
      confidence: 0.80
    };
  }

  // Default: Flag as OTHER for manual categorization
  return {
    type: 'OTHER',
    confidence: 0.0,
    requires_review: true
  };
}
```

**Default Mapping Rules** (seeded on first connection):
- Account codes `6%` (6000-6999) → CONTRACTOR (wages/contractor payments)
- Keywords: `/(subscription|license|saas)/i` → SUBSCRIPTION
- Keywords: `/(rent|utilities|office)/i` → OVERHEAD
- Fallback: `*` → OTHER

**Admin Configuration**:
- UI to add/edit/delete mapping rules
- Priority ordering (lower number = higher priority)
- Enable/disable rules without deletion
- Test rule against historical expenses

---

### Decision 7: JSONB for Flexible Sync Error Logging

**Rationale**: Capture rich error context without rigid schema, enable complex querying

**Implementation**:
```typescript
interface SyncError {
  type: 'API_ERROR' | 'MAPPING_ERROR' | 'VALIDATION_ERROR' | 'RATE_LIMIT';
  message: string;
  context: {
    xero_invoice_id?: string;
    xero_contact_id?: string;
    http_status?: number;
    retry_count?: number;
    [key: string]: any;
  };
  timestamp: string; // ISO 8601
}

// Store errors in sync_logs.errors (JSONB array)
await prisma.xeroSyncLog.update({
  where: { id: syncLogId },
  data: {
    errors: {
      push: {
        type: 'MAPPING_ERROR',
        message: 'Could not map Xero contact to client',
        context: {
          xero_contact_id: contact.ContactID,
          xero_contact_name: contact.Name,
          attempted_strategies: ['email', 'name_exact', 'name_fuzzy'],
          similarity_scores: [0.0, 0.0, 0.72]
        },
        timestamp: new Date().toISOString()
      }
    }
  }
});
```

**JSONB Querying**:
```sql
-- Find all sync logs with mapping errors
SELECT * FROM xero_sync_logs
WHERE errors @> '[{"type": "MAPPING_ERROR"}]'::jsonb;

-- Count error types
SELECT
  error->>'type' AS error_type,
  COUNT(*)
FROM xero_sync_logs,
  jsonb_array_elements(errors) AS error
GROUP BY error->>'type';
```

**Benefits**:
- Flexible schema (add context fields without migration)
- Rich querying via JSONB operators
- Actionable error details for debugging
- Preserves full error context for support

---

## Integration Points

### Xero API Integration

**OAuth 2.0 Endpoints**:
- `https://login.xero.com/identity/connect/authorize` - Authorization URL
- `https://identity.xero.com/connect/token` - Token exchange endpoint

**Accounting API Endpoints**:
- `GET /Invoices?ModifiedAfter={timestamp}` - Fetch invoices (incremental sync)
- `GET /Invoices/{InvoiceID}` - Fetch single invoice details
- `GET /Contacts` - Fetch contacts list
- `GET /BankTransactions?ModifiedAfter={timestamp}` - Fetch bank transactions
- `GET /Bills?ModifiedAfter={timestamp}` - Fetch bills (expenses)

**Rate Limits**:
- 60 requests per minute per organization
- 5,000 requests per day per organization
- Implement `bottleneck` queue to stay under limits

**Required OAuth Scopes**:
- `offline_access` - Obtain refresh token for daily sync
- `accounting.transactions.read` - Read invoices, bills, bank transactions
- `accounting.contacts.read` - Read contacts for client mapping

### Next.js App Integration

**OAuth Flow Routes**:
- `GET /api/xero/oauth/authorize` - Redirect user to Xero authorization
- `GET /api/xero/oauth/callback` - Handle OAuth callback, exchange code for tokens
- `POST /api/xero/oauth/disconnect` - Disconnect Xero, revoke tokens

**Sync Job Routes**:
- `POST /api/xero/sync` - Trigger manual or scheduled sync (validates CRON_SECRET)
- `GET /api/xero/sync/status` - Get sync status for organization
- `POST /api/xero/sync/retry` - Retry failed sync

**Admin UI Routes**:
- `GET /dashboard/integrations` - Integration management page
- `GET /dashboard/integrations/xero` - Xero connection status, sync history
- `POST /dashboard/integrations/xero/mappings` - Manage contact mappings

### Supabase Integration

**pg_cron Scheduled Jobs**:
- `xero-daily-sync` - Daily full sync at 2 AM UTC
- `xero-token-check` - Hourly token expiry check (refresh if < 5 min to expiry)

**Database Tables** (via Prisma):
- `xero_connections` - OAuth tokens and connection metadata
- `xero_sync_logs` - Sync execution history and errors
- `xero_contact_mappings` - Cached contact-to-client mappings
- `xero_expense_category_mappings` - Expense categorization rules

**RLS Policies**:
All Xero tables enforce organization-level isolation via RLS policies

---

## Constitution Compliance Check

### Mandatory Requirements

✅ **Technology Stack**:
- ✅ Using Next.js 16 Route Handlers for OAuth callbacks and sync endpoints
- ✅ Using Prisma for schema management (new Xero tables)
- ✅ Using Supabase PostgreSQL for data storage
- ✅ Using Supabase pg_cron for scheduled jobs
- ✅ TypeScript strict mode enabled for all integration code

✅ **Data Architecture**:
- ✅ Multi-tenancy: All Xero data scoped by `organization_id`
- ✅ Row Level Security (RLS) policies enforce data isolation
- ✅ No cross-organization queries permitted

✅ **Schema Organization**:
- ✅ New `integrations` schema tables: xero_connections, xero_sync_logs
- ✅ UUID primary keys for all new tables
- ✅ `created_at`, `updated_at` timestamps on all entities
- ✅ Foreign key constraints with `ON DELETE CASCADE`

✅ **Security Requirements**:
- ✅ OAuth tokens encrypted at rest (AES-256-GCM)
- ✅ Tokens never exposed to client (server-side only)
- ✅ Service role access only in Route Handlers
- ✅ RLS policies enforce organization boundaries
- ✅ HTTPS required for OAuth callbacks

✅ **Performance Standards**:
- ✅ Sync completion within 15 minutes (target per spec)
- ✅ Contact mapping O(1) lookup after initial cache
- ✅ Dashboard loading <2s (sync history pagination)

✅ **Code Quality**:
- ✅ TypeScript strict mode enabled
- ✅ Prisma-generated types for database models
- ✅ Zod validation for Xero API responses
- ✅ Unit tests for mapping and categorization logic

✅ **Database Connection Configuration** (Principle #8):
- ✅ Using Supabase pooler URLs (not direct db.*.supabase.co)
- ✅ DATABASE_URL uses port 6543 with `?pgbouncer=true`
- ✅ DIRECT_URL uses port 5432 for migrations
- ✅ Pre-deployment checklist: Verify connection with `npx prisma migrate status`
- ✅ Migration workflow: `npx prisma migrate dev` for schema changes

### No Constitution Violations

All requirements satisfied. OAuth integration follows serverless best practices with encrypted token storage, automated refresh, and organization-level isolation.

---

## Phase 0: Research & Decisions (COMPLETED)

See [research.md](./research.md) for complete findings.

**Key Decisions Resolved**:
1. ✅ Use xero-node SDK for OAuth and API calls
2. ✅ Encrypt tokens with Web Crypto API (defense in depth)
3. ✅ pg_cron triggers Next.js Route Handler for scheduled sync
4. ✅ Tiered contact matching (email → name → fuzzy) + caching
5. ✅ Exponential backoff with jitter for retry logic
6. ✅ Hybrid expense categorization (payee → account code → keywords)
7. ✅ JSONB for flexible sync error logging

**All Research Questions Resolved** - Ready for implementation.

---

## Phase 1: Database Schema & OAuth Implementation (Days 1-2)

### Tasks

**1.1 Database Migrations** (Day 1):
- [ ] Create `xero_connections` table (Prisma schema + migration)
- [ ] Create `xero_sync_logs` table
- [ ] Create `xero_contact_mappings` table
- [ ] Create `xero_expense_category_mappings` table
- [ ] Add Xero fields to `revenue_records` (xero_invoice_id, sync_status)
- [ ] Add Xero fields to `expense_records` (xero_expense_id, xero_account_code, sync_status)
- [ ] Create RLS policies for all Xero tables
- [ ] Create indexes for foreign keys and frequently queried columns
- [ ] Seed default expense category mappings (contractor, subscription, overhead)
- [ ] Verify database connection: `npx prisma migrate status`
- [ ] Run migrations: `npx prisma migrate dev --name add_xero_integration`
- [ ] Generate Prisma client: `npx prisma generate`

**1.2 OAuth Implementation** (Day 2):
- [ ] Install `xero-node` SDK (v5.6.0+)
- [ ] Create Xero OAuth app in Xero Developer Portal (get client ID, secret)
- [ ] Add environment variables: `XERO_CLIENT_ID`, `XERO_CLIENT_SECRET`, `XERO_REDIRECT_URI`, `XERO_TOKEN_ENCRYPTION_KEY`
- [ ] Implement token encryption/decryption utilities (Web Crypto API)
- [ ] Create Route Handler: `GET /api/xero/oauth/authorize` (build consent URL)
- [ ] Create Route Handler: `GET /api/xero/oauth/callback` (exchange code for tokens, encrypt, store)
- [ ] Create Route Handler: `POST /api/xero/oauth/disconnect` (revoke tokens, delete connection)
- [ ] Create utility: `getXeroClient(organizationId)` (fetch tokens, decrypt, initialize XeroClient)
- [ ] Implement token refresh logic (check expiry, refresh if < 5 min, update database)
- [ ] Unit test: Token encryption/decryption roundtrip
- [ ] Integration test: OAuth flow with mock Xero API

**Deliverables**:
- Database schema for Xero integration (4 new tables, 2 table updates)
- OAuth connection flow (authorize, callback, disconnect)
- Encrypted token storage and automatic refresh

---

## Phase 2: Invoice Sync Service (Days 3-4)

### Tasks

**2.1 Contact Mapping Service** (Day 3):
- [ ] Implement `mapContactToClient()` with tiered matching:
  - Tier 1: Cache lookup (O(1))
  - Tier 2: Exact email match (95% confidence)
  - Tier 3: Exact normalized name match (90% confidence)
  - Tier 4: Fuzzy name match using `string-similarity` (80% confidence if > 0.85)
  - Tier 5: Flag unmapped contacts
- [ ] Install `string-similarity` package (v4.0.4+)
- [ ] Implement `normalizeName()` utility (lowercase, trim, remove special chars)
- [ ] Implement mapping cache (CRUD operations on `xero_contact_mappings` table)
- [ ] Create admin UI for manual contact mapping (unmapped contacts list)
- [ ] Unit tests: Tiered matching logic, fuzzy matching threshold
- [ ] Integration test: Map 100 contacts, verify 95% accuracy

**2.2 Invoice Sync Service** (Day 4):
- [ ] Create `syncInvoices(organizationId, connectionId)` service
- [ ] Fetch invoices from Xero API: `GET /Invoices?ModifiedAfter={last_sync_at}`
- [ ] Filter for APPROVED and PAID invoices only
- [ ] For each invoice:
  - Map Xero contact to client using `mapContactToClient()`
  - Extract invoice line items (description, amount, quantity)
  - Create/update revenue record with `xero_invoice_id`
  - Set `sync_status = SYNCED` or `MAPPING_FAILED`
- [ ] Implement duplicate prevention (unique index on `xero_invoice_id`)
- [ ] Update `last_sync_at` timestamp on xero_connections
- [ ] Create sync_log record with counts and errors
- [ ] Implement error handling with retry logic (exponential backoff)
- [ ] Respect Xero rate limits (60 req/min) using `bottleneck`
- [ ] Unit test: Invoice parsing, revenue record creation
- [ ] Integration test: Sync 50 invoices, verify data accuracy

**Deliverables**:
- Contact-to-client mapping service with 95% accuracy
- Invoice sync service with incremental updates
- Admin UI for manual contact mapping

---

## Phase 3: Expense Sync Service (Days 5-6)

### Tasks

**3.1 Expense Categorization Service** (Day 5):
- [ ] Create `categorizeExpense(xeroExpense)` service
- [ ] Priority 1: Check if payee matches contractor name
- [ ] Priority 2: Match account code against mapping rules
- [ ] Priority 3: Match description keywords against regex patterns
- [ ] Default: Flag as OTHER for manual review
- [ ] Query `xero_expense_category_mappings` ordered by priority
- [ ] Unit tests: Categorization logic, rule priority ordering
- [ ] Integration test: Categorize 100 expenses, verify 90% auto-categorization

**3.2 Expense Sync Service** (Day 6):
- [ ] Create `syncExpenses(organizationId, connectionId)` service
- [ ] Fetch bills from Xero API: `GET /Bills?ModifiedAfter={last_sync_at}`
- [ ] Fetch bank transactions: `GET /BankTransactions?ModifiedAfter={last_sync_at}&Type=SPEND`
- [ ] For each expense:
  - Categorize using `categorizeExpense()`
  - Extract: date, amount, payee, description, account code
  - Create/update expense record with `xero_expense_id`
  - Link to contractor if categorized as CONTRACTOR
  - Set `sync_status = SYNCED` or `CATEGORIZATION_FAILED`
- [ ] Implement duplicate prevention (unique index on `xero_expense_id`)
- [ ] Create sync_log record with counts and errors
- [ ] Implement error handling with retry logic
- [ ] Unit test: Expense parsing, categorization, contractor linking
- [ ] Integration test: Sync 50 expenses, verify 90% categorization accuracy

**Deliverables**:
- Expense categorization service with 90% accuracy
- Expense sync service with bill and transaction support
- Automated contractor linking for contractor payments

---

## Phase 4: Scheduled Jobs & Monitoring (Days 7-8)

### Tasks

**4.1 Scheduled Sync Job** (Day 7):
- [ ] Create Route Handler: `POST /api/xero/sync` (validates CRON_SECRET)
- [ ] Implement full sync logic:
  - Create sync_log (status: RUNNING)
  - Call `syncInvoices()`
  - Call `syncExpenses()`
  - Update sync_log (status: SUCCESS/FAILED)
  - Log errors in JSONB array
  - Calculate duration_ms
- [ ] Add environment variable: `CRON_SECRET` (secure random token)
- [ ] Create Supabase pg_cron job (SQL script):
  ```sql
  SELECT cron.schedule(
    'xero-daily-sync',
    '0 2 * * *',
    $$SELECT net.http_post(...)$$
  );
  ```
- [ ] Implement manual sync trigger from admin UI
- [ ] Implement sync retry logic for failed syncs
- [ ] Unit test: Sync job orchestration, error aggregation
- [ ] Integration test: End-to-end sync with mock Xero API

**4.2 Monitoring Dashboard** (Day 8):
- [ ] Create UI: `/dashboard/integrations/xero`
- [ ] Display connection status (ACTIVE, DISCONNECTED, TOKEN_EXPIRED)
- [ ] Display sync history table:
  - Timestamp, sync type, status, record counts, duration
  - Expandable error details (from JSONB errors array)
- [ ] Display unmapped contacts count (requires manual mapping)
- [ ] Display uncategorized expenses count (requires manual review)
- [ ] Add "Retry Failed Sync" button
- [ ] Add "Connect Xero" / "Disconnect Xero" buttons
- [ ] Add "Manual Sync" button (triggers immediate sync)
- [ ] Display last sync timestamp and next scheduled sync time
- [ ] Add alert banner for failed syncs (last sync status = FAILED)
- [ ] Unit test: UI component rendering, button interactions
- [ ] E2E test: Complete OAuth flow and view sync history

**Deliverables**:
- Daily scheduled sync job via pg_cron
- Manual sync trigger from admin UI
- Comprehensive monitoring dashboard with error details

---

## Phase 5: Testing, Error Handling & Documentation (Days 9-10)

### Tasks

**5.1 Testing** (Day 9):
- [ ] Unit tests:
  - Token encryption/decryption
  - Tiered contact matching (email, name exact, fuzzy)
  - Expense categorization rules
  - Retry logic with exponential backoff
  - Error object serialization (JSONB)
- [ ] Integration tests:
  - OAuth flow with mock Xero API
  - Invoice sync with 100 test invoices
  - Expense sync with 50 test expenses
  - Contact mapping accuracy (95% target)
  - Expense categorization accuracy (90% target)
- [ ] E2E tests:
  - Connect Xero account
  - Trigger manual sync
  - View sync history
  - Manually map unmapped contact
  - Disconnect Xero account
- [ ] Performance tests:
  - Sync 500 invoices + 200 expenses within 15 minutes
  - Contact mapping lookup < 10ms (cached)
- [ ] Error handling tests:
  - Xero API 429 (rate limit) → respect Retry-After
  - Xero API 503 (service unavailable) → exponential backoff
  - Token expiry → automatic refresh
  - Invalid tenant → error logging, connection status = ERROR

**5.2 Documentation** (Day 10):
- [ ] Create `quickstart.md` - Getting started guide for Xero integration
- [ ] Update README-IMPLEMENTATION.md with Feature 4 completion status
- [ ] Document environment variables (`.env.example`):
  - `XERO_CLIENT_ID`, `XERO_CLIENT_SECRET`, `XERO_REDIRECT_URI`
  - `XERO_TOKEN_ENCRYPTION_KEY`, `CRON_SECRET`
- [ ] Document admin workflows:
  - How to connect Xero account
  - How to manually map unmapped contacts
  - How to configure expense categorization rules
  - How to troubleshoot sync failures
- [ ] Create troubleshooting guide:
  - Connection status = TOKEN_EXPIRED → Re-authorize Xero
  - Sync failures → Check sync_logs.errors for details
  - Rate limit errors → Automatic retry, check Xero rate limits
- [ ] Code comments for complex logic (fuzzy matching, retry backoff)

**Deliverables**:
- Comprehensive test coverage (unit, integration, E2E)
- Documentation for admin users and developers
- Troubleshooting guide for common errors

---

## File Structure

```
📁 DevLabs CFO/
├── 📁 prisma/
│   ├── schema.prisma                                # ✨ Add Xero models
│   └── 📁 migrations/
│       ├── YYYYMMDDHHMMSS_add_xero_connections/
│       ├── YYYYMMDDHHMMSS_add_xero_sync_logs/
│       ├── YYYYMMDDHHMMSS_add_xero_contact_mappings/
│       ├── YYYYMMDDHHMMSS_add_xero_expense_mappings/
│       ├── YYYYMMDDHHMMSS_add_xero_fields_to_revenue/
│       └── YYYYMMDDHHMMSS_add_xero_fields_to_expenses/
│
├── 📁 lib/
│   ├── 📁 xero/
│   │   ├── client.ts                               # XeroClient initialization, token refresh
│   │   ├── crypto.ts                               # Token encryption/decryption utilities
│   │   ├── contact-mapper.ts                       # Tiered contact-to-client mapping
│   │   ├── expense-categorizer.ts                  # Expense categorization service
│   │   ├── invoice-sync.ts                         # Invoice sync service
│   │   ├── expense-sync.ts                         # Expense sync service
│   │   ├── retry.ts                                # Exponential backoff retry logic
│   │   ├── rate-limiter.ts                         # Bottleneck rate limiter wrapper
│   │   └── types.ts                                # TypeScript types for Xero API responses
│   └── 📁 validations/
│       └── xero.ts                                 # Zod schemas for Xero API validation
│
├── 📁 app/
│   ├── 📁 api/
│   │   └── 📁 xero/
│   │       ├── 📁 oauth/
│   │       │   ├── authorize/route.ts              # GET - Redirect to Xero authorization
│   │       │   ├── callback/route.ts               # GET - OAuth callback handler
│   │       │   └── disconnect/route.ts             # POST - Disconnect Xero
│   │       └── 📁 sync/
│   │           ├── route.ts                        # POST - Trigger sync job
│   │           ├── status/route.ts                 # GET - Sync status
│   │           └── retry/route.ts                  # POST - Retry failed sync
│   │
│   └── 📁 dashboard/
│       └── 📁 integrations/
│           ├── page.tsx                            # Integrations overview (list all integrations)
│           └── 📁 xero/
│               ├── page.tsx                        # Xero connection status + sync history
│               ├── mappings/page.tsx               # Manual contact mapping UI
│               └── rules/page.tsx                  # Expense categorization rules UI
│
├── 📁 components/
│   └── 📁 xero/
│       ├── ConnectionStatus.tsx                    # Xero connection status badge
│       ├── SyncHistoryTable.tsx                    # Sync logs table with errors
│       ├── UnmappedContactsList.tsx                # Contacts requiring manual mapping
│       ├── ExpenseCategoryRules.tsx                # Expense mapping rules CRUD
│       └── ManualSyncButton.tsx                    # Trigger manual sync
│
├── 📁 supabase/
│   └── 📁 sql/
│       ├── setup-pg-cron.sql                       # pg_cron job for daily sync
│       └── rls-policies-xero.sql                   # RLS policies for Xero tables
│
├── 📁 tests/
│   ├── 📁 unit/
│   │   ├── token-crypto.test.ts
│   │   ├── contact-mapper.test.ts
│   │   ├── expense-categorizer.test.ts
│   │   └── retry-logic.test.ts
│   ├── 📁 integration/
│   │   ├── oauth-flow.test.ts
│   │   ├── invoice-sync.test.ts
│   │   └── expense-sync.test.ts
│   └── 📁 e2e/
│       └── xero-integration.test.ts
│
└── 📁 specs/
    └── 📁 4-xero-integration/
        ├── spec.md                                 # ✅ Feature specification
        ├── plan.md                                 # ✅ This file
        ├── research.md                             # ✅ Research findings
        ├── data-model.md                           # ✅ Database schema
        ├── quickstart.md                           # ⏳ Getting started guide
        ├── 📁 contracts/
        │   ├── oauth.md                            # OAuth API contract
        │   ├── sync.md                             # Sync job API contract
        │   └── admin.md                            # Admin UI API contract
        └── 📁 checklists/
            └── requirements.md                     # ✅ Specification quality checklist
```

---

## Testing Strategy

### Unit Tests

**Token Encryption/Decryption**:
- Test encryption roundtrip (encrypt → decrypt → match original)
- Test invalid encryption key (should throw error)
- Test decryption with wrong key (should throw error)

**Contact Mapping**:
- Test exact email match (95% confidence)
- Test exact normalized name match (90% confidence)
- Test fuzzy name match > 0.85 (80% confidence)
- Test fuzzy match < 0.85 (should fail to tier 4)
- Test cache hit (O(1) lookup)

**Expense Categorization**:
- Test contractor payee match
- Test account code pattern matching
- Test keyword pattern matching
- Test rule priority ordering
- Test default fallback to OTHER

**Retry Logic**:
- Test transient error retry (429, 503)
- Test permanent error no retry (401, 404)
- Test exponential backoff delays (1s, 2s, 4s)
- Test jitter randomness
- Test max retries exceeded

### Integration Tests

**OAuth Flow**:
- Mock Xero authorization endpoint
- Test code exchange for tokens
- Test token encryption and storage
- Test connection status update

**Invoice Sync**:
- Mock Xero `/Invoices` API
- Sync 100 test invoices
- Verify revenue records created
- Verify contact mapping accuracy (95%)
- Verify duplicate prevention

**Expense Sync**:
- Mock Xero `/Bills` and `/BankTransactions` APIs
- Sync 50 test expenses
- Verify expense records created
- Verify categorization accuracy (90%)
- Verify contractor linking

### E2E Tests

**Complete Integration Flow**:
1. Navigate to `/dashboard/integrations/xero`
2. Click "Connect Xero"
3. Complete OAuth flow (mock Xero)
4. Verify connection status = ACTIVE
5. Trigger manual sync
6. Wait for sync completion
7. Verify sync history table shows SUCCESS
8. View revenue records (verify invoices imported)
9. View expense records (verify expenses imported)
10. Disconnect Xero
11. Verify connection status = DISCONNECTED

### Performance Tests

**Sync Performance**:
- Sync 500 invoices + 200 expenses
- Target: <15 minutes total duration
- Measure: API request count, database query time

**Contact Mapping Performance**:
- Map 1000 contacts (first time)
- Target: <30 seconds total
- Measure: Cache hit rate (should be 0% first time, 99%+ after)

**Dashboard Loading**:
- Load sync history with 100 sync logs
- Target: <2 seconds initial render
- Measure: Time to interactive (TTI)

---

## Error Handling

### API Errors

**Rate Limit (429)**:
- Respect `Retry-After` header
- Queue requests using `bottleneck`
- Log rate limit events

**Service Unavailable (503)**:
- Retry with exponential backoff (1s, 2s, 4s)
- Max 3 retries
- Log error and continue with next record

**Unauthorized (401)**:
- Check if token expired → refresh token
- If refresh fails → set connection status = TOKEN_EXPIRED
- Notify admin to re-authorize

**Not Found (404)**:
- Log error (invoice/expense deleted in Xero)
- Skip record, continue sync

### Data Errors

**Mapping Failure**:
- Set revenue record `sync_status = MAPPING_FAILED`
- Add contact to unmapped contacts list
- Flag for manual admin mapping

**Categorization Failure**:
- Set expense record `sync_status = CATEGORIZATION_FAILED`
- Default expense type to OTHER
- Flag for manual admin review

**Validation Failure**:
- Log error with Zod validation details
- Skip record, continue sync
- Add to sync_log errors array

### System Errors

**Database Connection Failure**:
- Retry database query (max 3 attempts)
- If all retries fail, mark sync as FAILED
- Send email alert to admin

**Network Timeout**:
- Retry with exponential backoff
- If all retries fail, log error and continue

**Encryption Key Missing**:
- Throw error on app startup (fail fast)
- Prevent OAuth connections without encryption key

---

## Security Considerations

### Token Security

- ✅ Tokens encrypted with AES-256-GCM before database insert
- ✅ Encryption key stored in environment variable (never in code)
- ✅ Tokens never logged in plain text (redacted in error logs)
- ✅ Tokens decrypted only in memory when needed for API calls
- ✅ Service role access only (never exposed to client)

### API Security

- ✅ CRON_SECRET validates scheduled sync requests
- ✅ RLS policies enforce organization isolation
- ✅ OAuth redirect URI validated (prevent open redirect)
- ✅ HTTPS required for all OAuth callbacks

### Data Privacy

- ✅ Financial data (invoices, expenses) scoped to organization
- ✅ No cross-organization data access
- ✅ Audit logging for admin actions
- ✅ Token revocation on disconnect

---

## Rollback Plan

### Database Rollback

**If migration fails**:
```bash
# Revert to previous migration
npx prisma migrate resolve --rolled-back <migration_name>

# Drop new tables manually if needed
DROP TABLE IF EXISTS xero_connections CASCADE;
DROP TABLE IF EXISTS xero_sync_logs CASCADE;
DROP TABLE IF EXISTS xero_contact_mappings CASCADE;
DROP TABLE IF EXISTS xero_expense_category_mappings CASCADE;

# Remove Xero fields from existing tables
ALTER TABLE revenue_records DROP COLUMN IF EXISTS xero_invoice_id;
ALTER TABLE expense_records DROP COLUMN IF EXISTS xero_expense_id;
```

### Code Rollback

**If OAuth or sync fails in production**:
1. Revert git branch to previous commit
2. Redeploy to Vercel (automatic on main branch push)
3. Disable pg_cron job: `SELECT cron.unschedule('xero-daily-sync');`
4. Notify users of integration downtime

### Data Cleanup

**If corrupt data synced**:
1. Identify affected records: `SELECT * FROM revenue_records WHERE xero_invoice_id IS NOT NULL AND sync_status = 'SYNCED' AND created_at > '2026-02-14';`
2. Delete or mark as invalid: `UPDATE revenue_records SET sync_status = 'VALIDATION_FAILED' WHERE ...`
3. Clear last_sync_at: `UPDATE xero_connections SET last_sync_at = NULL;`
4. Re-run sync to import clean data

---

## Success Metrics

### Feature Completion Criteria

- ✅ OAuth connection flow working (authorize, callback, disconnect)
- ✅ Daily scheduled sync running automatically (pg_cron)
- ✅ Invoice sync: 95% automation rate (per spec success criteria)
- ✅ Expense sync: 90% categorization accuracy (per spec)
- ✅ Contact mapping: 95% auto-match rate (per spec)
- ✅ Sync reliability: 95% success rate (per spec)
- ✅ Sync duration: ≤15 minutes for 500 invoices + 200 expenses (per spec)
- ✅ Error recovery: 90% transient errors resolved via retry (per spec)
- ✅ Admin dashboard showing sync history and errors
- ✅ Manual sync and retry functionality working
- ✅ All unit, integration, and E2E tests passing

### Deployment Criteria

- ✅ Database migrations applied to production
- ✅ pg_cron job scheduled in production Supabase
- ✅ Environment variables configured (Xero client ID, secret, encryption key)
- ✅ OAuth app approved in Xero Developer Portal (production settings)
- ✅ Monitoring dashboard accessible at `/dashboard/integrations/xero`
- ✅ Documentation updated (README, quickstart guide)

---

## Next Steps After Completion

1. ✅ Mark Feature 4 as COMPLETE in README-IMPLEMENTATION.md
2. ⏭️ User acceptance testing with real Xero account
3. ⏭️ Production deployment to Vercel
4. ⏭️ Monitor first week of daily syncs (check for errors)
5. ⏭️ Plan Feature 5: Mercury Integration (banking data sync)
6. ⏭️ Plan Feature 6: Margin Calculation Engine (uses Xero revenue/expense data)

---

**Plan Status**: ✅ Complete - Ready for task generation (`/speckit.tasks`)
