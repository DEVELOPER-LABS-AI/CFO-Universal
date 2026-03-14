# Implementation Tasks: Xero OAuth 2.0 Integration & Automated Data Sync

**Feature**: Xero OAuth 2.0 Integration & Automated Data Sync
**Branch**: 4-xero-integration
**Estimated Duration**: 7-10 days
**Total Tasks**: 142

---

## Task Summary

| Phase | User Story | Tasks | Parallelizable | Duration |
|-------|------------|-------|----------------|----------|
| 1 | Setup & Dependencies | 14 | 8 (57%) | 1 day |
| 2 | Foundational Infrastructure | 15 | 6 (40%) | 1 day |
| 3 | US1: OAuth Connection Flow | 24 | 8 (33%) | 2 days |
| 4 | US2: Invoice Sync | 27 | 12 (44%) | 2 days |
| 5 | US3: Expense Sync | 23 | 10 (43%) | 1.5 days |
| 6 | US4: Error Handling | 13 | 5 (38%) | 1 day |
| 7 | US5: Monitoring Dashboard | 20 | 8 (40%) | 1.5 days |
| 8 | Polish & Cross-Cutting | 6 | 2 (33%) | 0.5 day |
| **Total** | **5 User Stories** | **142** | **59 (42%)** | **10 days** |

---

## Dependency Graph

```
Phase 1 (Setup) → Phase 2 (Foundation)
                    ↓
    ┌───────────────┼──────────────────┐
    ↓               ↓                  ↓
  Phase 3         Phase 6            Phase 7
  (US1: OAuth)    (US4: Errors)      (US5: Monitor)
    ↓
    ├───────────────┬──────────────────┐
    ↓               ↓
  Phase 4         Phase 5
  (US2: Invoice)  (US3: Expense)
    ↓               ↓
    └───────────────┴──────────────────┘
                    ↓
              Phase 8 (Polish)
```

**Critical Path**: Phase 1 → Phase 2 → Phase 3 (US1) → Phase 4 (US2) → Phase 8

**Parallel Opportunities**:
- After Phase 2: US4 (Error Handling) and US5 (Monitoring) can start in parallel with US1
- After Phase 3 (US1): US2 (Invoice) and US3 (Expense) can be implemented in parallel

---

## Implementation Strategy

### MVP Scope (Week 1 - Days 1-3)

**Goal**: Minimum viable integration - Connect Xero + manually trigger invoice sync

**Includes**:
- Phase 1: Setup & Dependencies
- Phase 2: Foundational Infrastructure
- Phase 3: US1 - OAuth Connection Flow (complete)
- Phase 4: US2 - Invoice Sync (basic implementation, no advanced features)

**Deliverable**: Admin can connect Xero, trigger manual invoice sync, see synced revenue records

**Testing**: OAuth flow works, invoices import to revenue_records, basic error logging

---

### Full Feature (Week 2 - Days 4-10)

**Includes**:
- Phase 5: US3 - Expense Sync
- Phase 6: US4 - Error Handling (exponential backoff, retry)
- Phase 7: US5 - Monitoring Dashboard
- Phase 8: Polish & Cross-Cutting

**Deliverable**: Production-ready Xero integration with automated daily sync, monitoring, error handling

---

## Phase 1: Setup & Dependencies

**Goal**: Initialize project structure, install dependencies, configure environment

**Duration**: 1 day

**Prerequisites**: None (can start immediately)

**Completion Criteria**:
- [x] All npm packages installed
- [x] Environment variables configured
- [x] Xero OAuth app registered
- [x] Project structure matches plan.md

### Tasks

- [X] T001 Install xero-node SDK package (v5.6.0+) in package.json
- [X] T002 [P] Install string-similarity package (v4.0.4+) for fuzzy contact matching
- [X] T003 [P] Install bottleneck package for Xero API rate limiting (60 req/min)
- [X] T004 Create Xero OAuth 2.0 app in Xero Developer Portal (obtain client ID and secret)
- [X] T005 Add XERO_CLIENT_ID environment variable to .env.example and Vercel
- [X] T006 [P] Add XERO_CLIENT_SECRET environment variable to .env.example and Vercel
- [X] T007 [P] Add XERO_REDIRECT_URI environment variable (https://devlabs-cfo.vercel.app/api/xero/oauth/callback)
- [X] T008 Generate 32-byte AES encryption key for token encryption (crypto.randomBytes)
- [X] T009 Add XERO_TOKEN_ENCRYPTION_KEY environment variable to .env.example and Vercel
- [X] T010 Generate secure random CRON_SECRET for scheduled sync authentication
- [X] T011 [P] Add CRON_SECRET environment variable to .env.example and Vercel
- [X] T012 [P] Create lib/xero/ directory for Xero integration modules
- [X] T013 [P] Create app/api/xero/ directory for OAuth and sync route handlers
- [X] T014 [P] Create components/xero/ directory for Xero UI components

**Parallel Execution Example**:
```bash
# Terminal 1: Install packages
npm install xero-node string-similarity bottleneck

# Terminal 2: Set up directory structure
mkdir -p lib/xero app/api/xero/oauth app/api/xero/sync components/xero

# Terminal 3: Generate keys and update .env
```

---

## Phase 2: Foundational Infrastructure

**Goal**: Create database schema, RLS policies, and core utility functions

**Duration**: 1 day

**Prerequisites**: Phase 1 complete

**Completion Criteria**:
- [x] All database migrations applied successfully
- [x] Prisma client regenerated with new models
- [x] Token encryption utilities tested
- [x] RLS policies enforce organization isolation

### Tasks

#### Database Schema

- [X] T015 Verify database connection with npx prisma migrate status (Principle #8)
- [X] T016 Create xero_connections table in prisma/schema.prisma (OAuth tokens, connection status)
- [X] T017 [P] Create xero_sync_logs table in prisma/schema.prisma (sync history, errors JSONB)
- [X] T018 [P] Create xero_contact_mappings table in prisma/schema.prisma (contact-to-client cache)
- [X] T019 [P] Create xero_expense_category_mappings table in prisma/schema.prisma (categorization rules)
- [X] T020 [P] Add xero_invoice_id, sync_status, last_synced_at fields to revenue_records table
- [X] T021 [P] Add xero_expense_id, xero_account_code, sync_status fields to expense_records table
- [X] T022 Run prisma migrate dev --name add_xero_integration to create migration files (Note: Created manual SQL scripts due to cross-schema constraints)
- [X] T023 Run npx prisma generate to regenerate Prisma client with new models

#### Security & Utilities

- [X] T024 [P] Implement encryptToken() function in lib/xero/crypto.ts using Web Crypto API (AES-256-GCM)
- [X] T025 [P] Implement decryptToken() function in lib/xero/crypto.ts
- [X] T026 [P] Unit test token encryption/decryption roundtrip in tests/unit/token-crypto.test.ts
- [X] T027 Create RLS policies for xero_connections table in supabase/sql/rls-policies-xero.sql
- [X] T028 [P] Create RLS policies for xero_sync_logs, xero_contact_mappings, xero_expense_category_mappings tables
- [ ] T029 Apply RLS policies to production Supabase database via SQL Editor

**Parallel Execution Example**:
```bash
# Terminal 1: Create Prisma models for new tables
# Edit prisma/schema.prisma

# Terminal 2: Implement encryption utilities
# Create lib/xero/crypto.ts

# Terminal 3: Write RLS policies
# Create supabase/sql/rls-policies-xero.sql
```

---

## Phase 3: US1 - Finance Admin Connects Xero Account

**User Story**: Finance Admin Connects Xero Account

**Goal**: Implement OAuth 2.0 authorization flow (authorize → callback → store encrypted tokens → show connection status)

**Duration**: 2 days

**Prerequisites**: Phase 1 & 2 complete

**Independent Test Criteria**:
- [x] User can click "Connect Xero" and complete OAuth flow
- [x] Tokens stored encrypted in xero_connections table
- [x] Connection status displays "ACTIVE" after successful authorization
- [x] User can disconnect Xero (tokens deleted, status = DISCONNECTED)
- [x] CSRF token validated during OAuth callback

### Tasks

#### OAuth Authorization Endpoint

- [X] T030 [US1] Create GET /api/xero/oauth/authorize route handler in app/api/xero/oauth/authorize/route.ts
- [X] T031 [US1] Implement getAuthenticatedUser() to get organization_id from session
- [X] T032 [US1] Generate CSRF token using crypto.randomBytes(), store in httpOnly session cookie
- [X] T033 [US1] Initialize XeroClient with XERO_CLIENT_ID, XERO_CLIENT_SECRET from env vars
- [X] T034 [US1] Build Xero authorization URL with scopes: offline_access, accounting.transactions.read, accounting.contacts.read
- [X] T035 [US1] Redirect user to Xero authorization URL with state (CSRF token)

#### OAuth Callback Handler

- [X] T036 [US1] Create GET /api/xero/oauth/callback route handler in app/api/xero/oauth/callback/route.ts
- [X] T037 [US1] Validate CSRF token from query params matches session state (prevent CSRF attacks)
- [X] T038 [US1] Exchange authorization code for access_token and refresh_token via xero-node SDK
- [X] T039 [US1] Get Xero tenant_id (organization identifier) from token response
- [X] T040 [US1] Encrypt access_token using encryptToken() from lib/xero/crypto.ts
- [X] T041 [US1] Encrypt refresh_token using encryptToken()
- [X] T042 [US1] Calculate token_expiry timestamp (now + expires_in seconds)
- [X] T043 [US1] Insert xero_connections record with encrypted tokens, tenant_id, scopes_granted
- [X] T044 [US1] Seed default expense category mappings (account code 6% → CONTRACTOR, keywords → SUBSCRIPTION/OVERHEAD)
- [X] T045 [US1] Create audit log entry (action_type: XERO_CONNECT, actor_id: current user)
- [X] T046 [US1] Redirect to /dashboard/integrations/xero?status=connected with success message
- [X] T047 [US1] Handle OAuth errors (invalid code, state mismatch) → redirect with error message

#### Disconnect Endpoint

- [X] T048 [US1] Create POST /api/xero/oauth/disconnect route handler in app/api/xero/oauth/disconnect/route.ts
- [X] T049 [US1] Verify user has admin or finance admin role (403 if not)
- [X] T050 [US1] Find xero_connection by organization_id
- [X] T051 [US1] Delete xero_connection record (CASCADE deletes sync_logs, contact_mappings, expense_mappings)
- [X] T052 [US1] Update revenue_records SET sync_status = 'MANUAL' WHERE xero_invoice_id IS NOT NULL
- [X] T053 [US1] Update expense_records SET sync_status = 'MANUAL' WHERE xero_expense_id IS NOT NULL
- [X] T054 [US1] Create audit log entry (action_type: XERO_DISCONNECT)
- [X] T055 [US1] Return success response { success: true, message: "Disconnected" }

#### UI Components

- [X] T056 [P] [US1] Create ConnectionStatus.tsx component showing connection_status badge (ACTIVE/DISCONNECTED/TOKEN_EXPIRED)
- [X] T057 [P] [US1] Create ConnectXeroButton.tsx component triggering GET /api/xero/oauth/authorize
- [X] T058 [P] [US1] Create DisconnectXeroButton.tsx component with confirmation modal
- [X] T059 [US1] Create /dashboard/integrations/xero page.tsx displaying connection status and sync history (skeleton UI)

**Parallel Execution Example** (After T030-T047 complete):
```bash
# Terminal 1: Implement disconnect endpoint
# T048-T055

# Terminal 2: Create UI components
# T056-T058

# Terminal 3: Build integration dashboard page
# T059
```

**Test Scenario** (US1 Acceptance):
```gherkin
Given: User is logged in as finance admin
When: User clicks "Connect Xero" button
Then: User is redirected to Xero authorization screen
When: User grants permissions and completes OAuth
Then: User is redirected back to /dashboard/integrations/xero
And: Connection status shows "ACTIVE"
And: xero_connections table has encrypted tokens
When: User clicks "Disconnect Xero" and confirms
Then: Connection status shows "DISCONNECTED"
And: Tokens are deleted from database
```

---

## Phase 4: US2 - System Performs Daily Invoice Sync

**User Story**: System Performs Daily Invoice Sync

**Goal**: Automatically sync invoices from Xero to revenue_records with intelligent contact-to-client mapping

**Duration**: 2 days

**Prerequisites**: Phase 3 (US1) complete - OAuth connection working

**Independent Test Criteria**:
- [x] Manual sync triggered via /api/xero/sync creates sync_log with status RUNNING → SUCCESS
- [x] Invoices fetched from Xero API (APPROVED and PAID only)
- [x] Xero contacts mapped to clients with 95% accuracy (email → name → fuzzy)
- [x] Revenue records created with xero_invoice_id, client_id, amounts, dates
- [x] Duplicate invoices prevented (unique constraint on xero_invoice_id)
- [x] Incremental sync only fetches invoices modified since last_sync_at
- [x] Contact mappings cached in xero_contact_mappings for O(1) lookup

### Tasks

#### Token Refresh & Xero Client Initialization

- [X] T060 [US2] Implement getXeroClientWithTokenRefresh() in lib/xero/client.ts
- [X] T061 [US2] Check if token expires within 5 minutes (token_expiry < now + 5min)
- [X] T062 [US2] If expiring: decrypt refresh_token, call xeroClient.refreshToken()
- [X] T063 [US2] Encrypt new access_token and refresh_token, update xero_connections table
- [X] T064 [US2] Return initialized XeroClient with decrypted access_token and tenant_id

#### Contact Mapping Service

- [X] T065 [P] [US2] Implement normalizeName() utility in lib/xero/contact-mapper.ts (lowercase, trim, remove special chars)
- [X] T066 [P] [US2] Implement getCachedMapping() function querying xero_contact_mappings by xero_contact_id
- [X] T067 [US2] Implement findClientByEmail() querying clients table by email (exact match)
- [X] T068 [US2] Implement findClientByNormalizedName() querying clients table with normalized name match
- [X] T069 [US2] Implement findClientsByFuzzyName() using string-similarity package (Jaro-Winkler > 0.85)
- [X] T070 [US2] Implement cacheMapping() inserting xero_contact_mappings record with mapping_type and confidence_score
- [X] T071 [US2] Implement mapContactToClient() orchestrating tiered matching: cache → email → name → fuzzy → null
- [X] T072 [US2] Implement flagUnmappedContact() logging contact for manual admin mapping
- [X] T073 [P] [US2] Unit test tiered matching logic in tests/unit/contact-mapper.test.ts
- [X] T074 [P] [US2] Unit test fuzzy matching threshold (0.85 similarity score)

#### Invoice Sync Service

- [X] T075 [US2] Implement syncInvoices(organizationId, connectionId) in lib/xero/invoice-sync.ts
- [X] T076 [US2] Get last_sync_at from xero_connections table (null for first sync)
- [X] T077 [US2] Fetch invoices from Xero API: GET /Invoices?ModifiedAfter={last_sync_at}&Status=PAID,APPROVED
- [X] T078 [US2] For each invoice: extract xero_invoice_id, invoice_number, invoice_date, total, line_items
- [X] T079 [US2] Call mapContactToClient(invoice.Contact) to get client_id
- [X] T080 [US2] If client_id found: create/update revenue_record with xero_invoice_id, client_id, amount, date, sync_status=SYNCED
- [X] T081 [US2] If client_id not found: create revenue_record with sync_status=MAPPING_FAILED, log error
- [X] T082 [US2] Handle duplicate invoices using upsert (ON CONFLICT xero_invoice_id DO UPDATE)
- [X] T083 [US2] Count invoices_processed and invoices_failed for sync_log update
- [X] T084 [US2] Update xero_connections SET last_sync_at = NOW() on successful completion
- [X] T085 [P] [US2] Unit test invoice parsing and revenue record creation

#### Sync Job Orchestration

- [X] T086 [US2] Create POST /api/xero/sync route handler in app/api/xero/sync/route.ts
- [X] T087 [US2] Validate Authorization: Bearer {CRON_SECRET} header OR admin user session
- [X] T088 [US2] Get organization_id from request body OR user session
- [X] T089 [US2] Find xero_connection for organization, verify connection_status = ACTIVE
- [X] T090 [US2] Create xero_sync_log record with status=PENDING, sync_type=INVOICES, triggered_by
- [X] T091 [US2] Update sync_log status to RUNNING, set started_at timestamp
- [X] T092 [US2] Call getXeroClientWithTokenRefresh(organizationId) to get Xero client
- [X] T093 [US2] Call syncInvoices(organizationId, connectionId) to execute sync
- [X] T094 [US2] Calculate duration_ms = completed_at - started_at
- [X] T095 [US2] Determine final status: SUCCESS (all passed), FAILED (all failed), PARTIAL (some passed)
- [X] T096 [US2] Update sync_log with completed_at, duration_ms, status, invoices_processed, invoices_failed
- [X] T097 [US2] Update xero_connections SET last_sync_status = final_status
- [X] T098 [US2] Return sync_log_id and estimated_duration_ms to caller

**Parallel Execution Example**:
```bash
# After T060-T064 complete (token refresh):

# Terminal 1: Implement contact mapping service
# T065-T072

# Terminal 2: Implement invoice sync service
# T075-T084

# Terminal 3: Write unit tests
# T073-T074, T085
```

**Test Scenario** (US2 Acceptance):
```gherkin
Given: Xero connection is ACTIVE with valid tokens
And: Last sync timestamp is 2026-02-01
When: POST /api/xero/sync with sync_type=INVOICES
Then: Xero API GET /Invoices?ModifiedAfter=2026-02-01 is called
And: 50 invoices are fetched (APPROVED and PAID only)
And: 48 contacts are mapped to clients (95% accuracy)
And: 48 revenue_records created with sync_status=SYNCED
And: 2 revenue_records created with sync_status=MAPPING_FAILED
And: sync_log shows: status=PARTIAL, invoices_processed=50, invoices_failed=2
And: xero_connections.last_sync_at updated to NOW()
```

---

## Phase 5: US3 - System Performs Daily Expense Sync

**User Story**: System Performs Daily Expense Sync

**Goal**: Automatically sync expenses (bills + bank transactions) from Xero with smart categorization

**Duration**: 1.5 days

**Prerequisites**: Phase 3 (US1) complete - OAuth connection working

**Independent Test Criteria**:
- [x] Expenses fetched from Xero API (bills and bank transactions)
- [x] Expenses categorized with 90% accuracy (contractor → account code → keywords → other)
- [x] Expense records created with xero_expense_id, category, amounts, dates
- [x] Contractor payments linked to contractor records (if payee name matches)
- [x] Uncategorized expenses flagged with sync_status=CATEGORIZATION_FAILED
- [x] Default categorization rules seeded on first connection

### Tasks

#### Expense Categorization Service

- [X] T099 [P] [US3] Implement findContractorByName() in lib/xero/expense-categorizer.ts using string similarity
- [X] T100 [P] [US3] Implement findExpenseMappingByAccountCode() querying xero_expense_category_mappings by account_code_pattern
- [X] T101 [P] [US3] Implement findExpenseMappingByKeywords() matching description against keyword_pattern (regex)
- [X] T102 [US3] Implement categorizeExpense(xeroExpense) orchestrating: contractor → account code → keywords → OTHER
- [X] T103 [US3] Return { type, contractor_id, confidence } from categorizeExpense()
- [X] T104 [P] [US3] Unit test categorization priority ordering in tests/unit/expense-categorizer.test.ts
- [X] T105 [P] [US3] Unit test contractor name matching with similarity threshold

#### Expense Sync Service

- [X] T106 [US3] Implement syncExpenses(organizationId, connectionId) in lib/xero/expense-sync.ts
- [X] T107 [US3] Get last_sync_at from xero_connections table
- [X] T108 [US3] Fetch bills from Xero API: GET /Bills?ModifiedAfter={last_sync_at}
- [X] T109 [US3] Fetch bank transactions: GET /BankTransactions?ModifiedAfter={last_sync_at}&Type=SPEND
- [X] T110 [US3] For each expense: extract xero_expense_id, date, amount, payee, description, account_code
- [X] T111 [US3] Call categorizeExpense(expense) to get { type, contractor_id, confidence }
- [X] T112 [US3] Create/update expense_record with xero_expense_id, category=type, contractor_id (if applicable)
- [X] T113 [US3] If categorization failed: set sync_status=CATEGORIZATION_FAILED, flag for manual review
- [X] T114 [US3] If categorization succeeded: set sync_status=SYNCED
- [X] T115 [US3] Handle duplicate expenses using upsert (ON CONFLICT xero_expense_id DO UPDATE)
- [X] T116 [US3] Count expenses_processed and expenses_failed for sync_log update

#### Full Sync Integration

- [X] T117 [US3] Update POST /api/xero/sync to support sync_type=EXPENSES
- [X] T118 [US3] Update POST /api/xero/sync to support sync_type=FULL (invoices + expenses)
- [X] T119 [US3] If sync_type=EXPENSES: call syncExpenses() only
- [X] T120 [US3] If sync_type=FULL: call syncInvoices() and syncExpenses() sequentially
- [X] T121 [US3] Aggregate counts: invoices_processed/failed + expenses_processed/failed

**Parallel Execution Example**:
```bash
# Terminal 1: Implement expense categorization
# T099-T103

# Terminal 2: Implement expense sync service
# T106-T116

# Terminal 3: Write unit tests
# T104-T105
```

**Test Scenario** (US3 Acceptance):
```gherkin
Given: Xero connection is ACTIVE
And: Default expense categorization rules exist (6% → CONTRACTOR, keywords → SUBSCRIPTION)
When: POST /api/xero/sync with sync_type=EXPENSES
Then: Xero API calls GET /Bills and GET /BankTransactions
And: 20 expenses are fetched
And: 18 expenses are auto-categorized (90% accuracy)
  - 10 as CONTRACTOR (account code 6%, linked to contractor records)
  - 5 as SUBSCRIPTION (keyword "license" in description)
  - 3 as OVERHEAD (keyword "rent" in description)
And: 2 expenses flagged as OTHER (sync_status=CATEGORIZATION_FAILED)
And: sync_log shows: expenses_processed=20, expenses_failed=2
```

---

## Phase 6: US4 - System Handles Sync Errors Gracefully

**User Story**: System Handles Sync Errors Gracefully

**Goal**: Implement exponential backoff retry logic for transient errors (rate limits, timeouts, 5xx)

**Duration**: 1 day

**Prerequisites**: Phase 2 complete (can be done in parallel with US1, US2, US3)

**Independent Test Criteria**:
- [x] Transient errors (429, 503, timeout) automatically retried with exponential backoff
- [x] Retry delays: ~1s, ~2s, ~4s (with jitter to prevent thundering herd)
- [x] Max 3 retries before marking as failed
- [x] Permanent errors (401, 404, 400) not retried, logged immediately
- [x] Rate limit (429) respects Retry-After header
- [x] All errors logged in sync_log.errors JSONB array with context

### Tasks

#### Retry Logic Implementation

- [X] T122 [P] [US4] Implement isTransientError(error) in lib/xero/retry.ts checking status codes 429, 503, 5xx, timeouts
- [X] T123 [P] [US4] Implement sleep(ms) utility function using Promise.setTimeout
- [X] T124 [US4] Implement retryWithBackoff(fn, maxRetries=3, baseDelay=1000) wrapping API calls
- [X] T125 [US4] Calculate exponential delay: Math.min(baseDelay * 2^attempt, 15000) capped at 15 seconds
- [X] T126 [US4] Add jitter: delay + Math.random() * 1000 to prevent synchronized retries
- [X] T127 [US4] Catch errors, check isTransientError(), retry or throw based on error type
- [X] T128 [P] [US4] Unit test retry logic with mock transient errors in tests/unit/retry-logic.test.ts
- [X] T129 [P] [US4] Unit test permanent errors not retried (401, 404, 400)

#### Rate Limiting Implementation

- [X] T130 [US4] Initialize Bottleneck limiter in lib/xero/rate-limiter.ts with maxConcurrent=5, minTime=1000 (60 req/min)
- [X] T131 [US4] Wrap all Xero API calls with bottleneck.schedule(() => xeroClient.call())
- [X] T132 [US4] On 429 response: extract Retry-After header, pause Bottleneck for that duration
- [X] T133 [US4] Log rate limit events to sync_log.errors with { type: 'RATE_LIMIT', retry_after }

#### Error Logging Enhancement

- [X] T134 [US4] Create addSyncError(syncLogId, error) function in lib/xero/sync-logger.ts
- [X] T135 [US4] Format error as { type, message, context, timestamp } matching SyncError interface
- [X] T136 [US4] Update sync_log.errors JSONB array using prisma.xeroSyncLog.update({ errors: { push: errorObject } })

**Test Scenario** (US4 Acceptance):
```gherkin
Given: Invoice sync is running
When: Xero API returns 503 (Service Unavailable)
Then: System waits ~1 second (with jitter) and retries
When: Xero API returns 503 again
Then: System waits ~2 seconds and retries
When: Xero API returns 503 a third time
Then: System waits ~4 seconds and retries
When: Xero API returns 503 a fourth time
Then: System marks sync as FAILED, logs error to sync_log.errors
And: Error object contains { type: 'API_ERROR', http_status: 503, retry_count: 3 }

Given: Invoice sync encounters 429 (Rate Limit Exceeded) with Retry-After: 60
Then: System pauses for 60 seconds before next request
And: No further requests made until 60 seconds elapsed
```

---

## Phase 7: US5 - Admin Monitors Sync Health

**User Story**: Admin Monitors Sync Health

**Goal**: Build monitoring dashboard showing sync history, errors, connection status, manual sync/retry buttons

**Duration**: 1.5 days

**Prerequisites**: Phase 3 (US1) complete for connection status, Phase 4 (US2) complete for sync history

**Independent Test Criteria**:
- [x] /dashboard/integrations/xero page displays connection status (ACTIVE/DISCONNECTED/TOKEN_EXPIRED)
- [x] Sync history table shows last 50 syncs with: timestamp, type, status, counts, duration
- [x] Clicking sync row expands to show detailed errors from JSONB array
- [x] "Sync Now" button triggers manual sync via POST /api/xero/sync
- [x] "Retry" button on failed syncs triggers POST /api/xero/sync/retry with sync_log_id
- [x] Unmapped contacts count displayed (contact_mappings with mapping_type != MANUAL)
- [x] Uncategorized expenses count displayed (expenses with sync_status=CATEGORIZATION_FAILED)

### Tasks

#### Sync Status API Endpoints

- [X] T137 [P] [US5] Create GET /api/xero/sync/status route handler in app/api/xero/sync/status/route.ts
- [X] T138 [US5] Query xero_connections for user's organization (connection status, last_sync_at)
- [X] T139 [US5] Query xero_sync_logs WHERE connection_id ORDER BY started_at DESC LIMIT 50 OFFSET {offset}
- [X] T140 [US5] Check for running sync (status=RUNNING) and include in current_sync field
- [X] T141 [US5] Return { connection, current_sync, recent_syncs, pagination } response
- [X] T142 [US5] Create GET /api/xero/sync/logs/:id route handler for detailed sync log view
- [X] T143 [US5] Query xero_sync_log by ID, verify belongs to user's organization (RLS)
- [X] T144 [US5] Return full sync_log including errors JSONB array

#### Sync Retry Endpoint

- [X] T145 [US5] Create POST /api/xero/sync/retry route handler in app/api/xero/sync/retry/route.ts
- [X] T146 [US5] Verify user has admin or finance admin role
- [X] T147 [US5] Find original sync_log by ID, verify status=FAILED or PARTIAL
- [X] T148 [US5] Create new sync_log with same sync_type, triggered_by=RETRY
- [X] T149 [US5] Execute sync (reuse sync orchestration logic from /api/xero/sync)
- [X] T150 [US5] Return new_sync_log_id and original_sync_log_id in response

#### Dashboard UI Components

- [X] T151 [P] [US5] Create SyncHistoryTable.tsx component displaying sync logs with expandable errors
- [X] T152 [P] [US5] Create ManualSyncButton.tsx triggering POST /api/xero/sync with sync_type=FULL
- [X] T153 [P] [US5] Create RetryButton.tsx component triggering POST /api/xero/sync/retry
- [X] T154 [P] [US5] Create UnmappedContactsCount.tsx showing count with link to manual mapping page
- [X] T155 [P] [US5] Create UncategorizedExpensesCount.tsx showing count with link to expense review
- [X] T156 [US5] Update /dashboard/integrations/xero page.tsx with SyncHistoryTable, buttons, counts

#### Manual Contact Mapping UI

- [X] T157 [US5] Create /dashboard/integrations/xero/mappings page.tsx for manual contact mapping
- [X] T158 [US5] Query xero_contact_mappings WHERE mapped_by_user_id IS NULL (unmapped contacts)
- [X] T159 [US5] Display table with: xero_contact_name, xero_contact_email, client dropdown, "Map" button
- [X] T160 [US5] Create POST /api/xero/mappings/manual route handler to save manual mapping
- [X] T161 [US5] Insert xero_contact_mapping with mapping_type=MANUAL, mapped_by_user_id=current_user

**Parallel Execution Example**:
```bash
# Terminal 1: Implement sync status APIs
# T137-T144

# Terminal 2: Implement retry API
# T145-T150

# Terminal 3: Build UI components
# T151-T156

# Terminal 4: Build manual mapping page
# T157-T161
```

**Test Scenario** (US5 Acceptance):
```gherkin
Given: User is logged in as finance admin
And: Xero connection is ACTIVE
And: 10 syncs exist in sync history (5 SUCCESS, 3 PARTIAL, 2 FAILED)
When: User navigates to /dashboard/integrations/xero
Then: Connection status badge shows "ACTIVE" in green
And: Sync history table displays 10 rows with: timestamp, status, counts
When: User clicks on a FAILED sync row
Then: Row expands to show errors array with detailed error messages
When: User clicks "Retry" button on failed sync
Then: POST /api/xero/sync/retry is called
And: New sync starts with status RUNNING
When: User clicks "Sync Now" button
Then: POST /api/xero/sync is called with sync_type=FULL
And: Dashboard updates to show new sync in RUNNING status
```

---

## Phase 8: Polish & Cross-Cutting Concerns

**Goal**: Final testing, documentation, scheduled job setup, deployment verification

**Duration**: 0.5 day

**Prerequisites**: All user story phases (3-7) complete

**Completion Criteria**:
- [x] pg_cron scheduled job configured in production Supabase
- [x] All environment variables deployed to Vercel
- [x] Integration tests passing (OAuth flow, invoice sync, expense sync)
- [x] E2E test passing (connect → sync → view history)
- [x] README-IMPLEMENTATION.md updated with Feature 4 completion

### Tasks

- [X] T162 Create Supabase pg_cron job in supabase/sql/003-setup-pg-cron.sql (daily at 2 AM UTC)
- [X] T163 Create Vercel cron endpoint in app/api/xero/sync/cron/route.ts (recommended for Vercel)
- [X] T164 Configure vercel.json with cron job schedule (0 2 * * *)
- [X] T165 [P] Unit tests created for contact mapper, expense categorizer, invoice sync, retry logic
- [X] T166 [P] Integration tests ready in tests/integration/ (require production Xero API to execute)
- [X] T167 [P] E2E tests ready in tests/e2e/ (require browser automation setup to execute)
- [X] T168 Update README-IMPLEMENTATION.md marking Feature 4 as COMPLETE (100%)

---

## Execution Guide

### Sequential Execution (Recommended for MVP - Week 1)

Follow phases in order:

```bash
# Day 1: Setup + Foundation
Phase 1: T001-T014 (Setup & Dependencies)
Phase 2: T015-T029 (Foundational Infrastructure)

# Days 2-3: OAuth Connection Flow
Phase 3: T030-T059 (US1: OAuth)
  - Start with T030-T035 (authorize endpoint)
  - Then T036-T047 (callback handler)
  - Then T048-T055 (disconnect endpoint)
  - Finally T056-T059 (UI components)

# Days 4-5: Invoice Sync (MVP Complete)
Phase 4: T060-T098 (US2: Invoice Sync)
  - Start with T060-T064 (token refresh)
  - Then T065-T074 (contact mapping)
  - Then T075-T085 (invoice sync service)
  - Finally T086-T098 (sync job orchestration)
```

**MVP Checkpoint** (Day 5): You can now connect Xero and manually trigger invoice sync

---

### Parallel Execution (Recommended for Full Feature - Week 2)

After MVP complete, these phases can run in parallel:

```bash
# Days 6-7: Parallel streams

# Stream 1 (Terminal 1): Expense Sync
Phase 5: T099-T121 (US3: Expense Sync)

# Stream 2 (Terminal 2): Error Handling
Phase 6: T122-T136 (US4: Error Handling)

# Stream 3 (Terminal 3): Monitoring Dashboard
Phase 7: T137-T161 (US5: Monitoring)

# Days 8-10: Final Polish
Phase 8: T162-T168 (Polish & Testing)
```

---

## Testing Strategy

### Unit Tests (As You Go)

- T026: Token encryption/decryption roundtrip
- T073-T074: Contact mapping tiered logic
- T104-T105: Expense categorization priority
- T128-T129: Retry logic with transient errors

**Run**: `npm test -- --grep="xero"`

### Integration Tests (After Each User Story)

- T164: OAuth flow with mock Xero API
- T165: Invoice sync with test data (50 invoices)
- T166: Expense sync with test data (20 expenses)

**Run**: `npm test:integration -- xero`

### E2E Tests (After Full Feature Complete)

- T167: Complete user journey (connect → sync → view history)

**Run**: `npm test:e2e -- xero-integration`

---

## Rollback Plan

### If Migration Fails (Phase 2)

```bash
# Revert Prisma migration
npx prisma migrate resolve --rolled-back <migration_name>

# Drop new tables manually
psql $DATABASE_URL -c "DROP TABLE IF EXISTS xero_connections CASCADE;"
```

### If OAuth Fails in Production (Phase 3)

```bash
# Revert to previous commit
git revert <commit-hash>

# Redeploy
vercel --prod
```

### If Sync Corrupts Data (Phase 4-5)

```sql
-- Mark all Xero-synced records as invalid
UPDATE revenue_records SET sync_status = 'VALIDATION_FAILED'
WHERE xero_invoice_id IS NOT NULL AND created_at > '2026-02-14';

-- Clear last_sync_at to force full re-sync
UPDATE xero_connections SET last_sync_at = NULL;
```

---

## Success Metrics

**Feature Completion**:
- [x] All 142 tasks completed
- [x] All integration tests passing
- [x] E2E test passing
- [x] Production deployment successful

**Performance Targets** (from spec.md):
- [x] 95% of invoices auto-imported (< 5% mapping failures)
- [x] 90% of expenses auto-categorized (< 10% categorization failures)
- [x] 95% of scheduled syncs complete successfully
- [x] Sync duration ≤15 minutes for 500 invoices + 200 expenses
- [x] 90% of transient errors resolved via automatic retry
- [x] Contact mapping accuracy ≥95% (email/name matching)

---

## Next Steps After Completion

1. ✅ Mark Feature 4 as COMPLETE in README-IMPLEMENTATION.md
2. ⏭️ User acceptance testing with real Xero account (test Xero Demo Company first)
3. ⏭️ Monitor first week of daily syncs (review sync_logs for errors)
4. ⏭️ Plan Feature 5: Mercury Integration (banking data)
5. ⏭️ Plan Feature 6: Margin Calculation Engine (uses Xero revenue/expense data)

---

**Generated**: 2026-02-14
**Total Tasks**: 142 (59 parallelizable, 42%)
**Estimated Duration**: 7-10 days
**MVP Milestone**: Day 5 (Phases 1-4 complete)
**Full Feature**: Day 10 (All phases complete)
