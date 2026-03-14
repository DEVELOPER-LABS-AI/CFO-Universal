# Feature Specification: Xero OAuth 2.0 Integration & Automated Data Sync

**Status**: Draft
**Created**: 2026-02-14
**Last Updated**: 2026-02-14

---

## Overview

### Feature Summary

Automated integration with Xero accounting platform enabling secure OAuth 2.0 authentication and daily synchronization of invoices and expenses to populate revenue and expense records in the DevLabs CFO system.

### Business Value

Eliminates manual data entry for financial records by automatically importing invoice and expense data from Xero. Ensures the profit margin calculations and client profitability analytics are based on real-time, accurate financial data without requiring administrative overhead. Reduces data entry errors and provides a single source of truth for financial analysis.

### Target Users

- **Finance Administrators**: Connect Xero account, monitor sync status, troubleshoot sync errors
- **Agency Owners**: Benefit from automated financial data without manual intervention
- **System Administrators**: Manage OAuth credentials, monitor integration health

---

## User Scenarios

### US1: Finance Admin Connects Xero Account

**Actor**: Finance Administrator

**Scenario**: Admin authenticates DevLabs CFO with their Xero organization to enable automated sync.

**Flow**:
1. Admin navigates to integrations settings
2. Clicks "Connect Xero" button
3. Redirected to Xero OAuth consent screen
4. Grants permissions for invoice and expense access
5. Redirected back to DevLabs CFO with success confirmation
6. System stores encrypted OAuth tokens
7. Admin sees "Connected" status with last sync timestamp

**Expected Outcome**: Xero account successfully linked, tokens stored securely, ready for automated sync.

### US2: System Performs Daily Invoice Sync

**Actor**: System (automated process)

**Scenario**: System automatically syncs new and updated invoices from Xero daily.

**Flow**:
1. System triggers daily sync job (e.g., 2 AM)
2. Retrieves stored OAuth tokens from database
3. Checks token expiry, refreshes if necessary
4. Fetches invoices modified since last sync using Xero API
5. For each invoice:
   - Maps Xero contact to internal client (by name/email)
   - Extracts invoice line items
   - Creates/updates revenue records with amounts, dates, descriptions
6. Records sync status (success/failure, record count, errors)
7. Logs any mapping failures or API errors for admin review

**Expected Outcome**: All new/updated invoices imported as revenue records, clients automatically matched, sync status logged.

### US3: System Performs Daily Expense Sync

**Actor**: System (automated process)

**Scenario**: System automatically syncs expenses from Xero daily.

**Flow**:
1. System triggers daily sync job (same schedule as invoices)
2. Retrieves OAuth tokens and validates
3. Fetches expense records (bills, bank transactions) modified since last sync
4. For each expense:
   - Categorizes expense type (contractor payment, subscription, overhead)
   - Extracts amount, date, description, category
   - Creates/updates expense records in database
5. Records sync status and any errors
6. Flags unrecognized expense categories for manual review

**Expected Outcome**: All expenses imported and categorized, unknown categories flagged, sync status logged.

### US4: System Handles Sync Errors Gracefully

**Actor**: System (error handling)

**Scenario**: API rate limit hit or network timeout occurs during sync.

**Flow**:
1. Sync job encounters API error (rate limit, timeout, 5xx error)
2. System logs error details (timestamp, error type, affected records)
3. Implements exponential backoff retry logic:
   - First retry: 1 minute wait
   - Second retry: 5 minutes wait
   - Third retry: 15 minutes wait
4. If all retries fail, marks sync as "Failed" with error details
5. Sends notification to admin (email or dashboard alert)
6. Next scheduled sync attempts full sync again

**Expected Outcome**: Temporary errors handled with retries, persistent errors logged and reported, no data loss.

### US5: Admin Monitors Sync Health

**Actor**: Finance Administrator

**Scenario**: Admin checks integration health and troubleshoots issues.

**Flow**:
1. Admin navigates to Xero integration status page
2. Views sync history table with:
   - Last sync timestamp
   - Records imported (invoices, expenses)
   - Success/failure status
   - Error messages (if any)
3. For failed syncs, sees specific error details
4. Can trigger manual sync to retry failed operations
5. Can disconnect and reconnect Xero account if needed

**Expected Outcome**: Admin has full visibility into sync operations, can troubleshoot issues, manually trigger syncs.

---

## Functional Requirements

### FR-1: OAuth 2.0 Authentication

**Description**: System must implement Xero OAuth 2.0 authorization flow for secure account connection.

**Details**:
- Redirect user to Xero authorization URL with required scopes (accounting.transactions.read, accounting.contacts.read)
- Handle OAuth callback with authorization code
- Exchange code for access token and refresh token
- Store tokens encrypted at rest in database
- Associate tokens with organization/tenant ID
- Validate token on each API request

**Acceptance Criteria**:
- User can authorize DevLabs CFO to access Xero data
- Tokens stored securely with encryption
- System handles multiple Xero organizations if needed
- Token storage complies with OAuth best practices (encrypted, never logged)

### FR-2: Automatic Token Refresh

**Description**: System must automatically refresh expired access tokens using refresh tokens.

**Details**:
- Check token expiry before each API call
- If token expires within 5 minutes, trigger refresh
- Use refresh token to obtain new access token
- Update stored tokens in database
- Handle refresh failures (invalid refresh token, revoked access)
- Log token refresh events for audit

**Acceptance Criteria**:
- Expired tokens automatically refreshed without user intervention
- Sync operations never fail due to expired tokens
- Refresh failures trigger user re-authorization flow
- Token refresh events logged for security audit

### FR-3: Daily Automated Invoice Sync

**Description**: System must sync invoices from Xero daily and create/update revenue records.

**Details**:
- Run scheduled sync job daily (configurable time, default 2 AM)
- Use Xero Invoices API with ModifiedAfter parameter for incremental sync
- Filter for APPROVED and PAID invoice statuses
- Extract: invoice number, date, total, line items (description, amount, quantity)
- Map Xero contact to internal client using contact name and email
- Create revenue records linked to matched client
- Handle duplicate invoices (update existing records if invoice already synced)
- Track last successful sync timestamp for incremental updates

**Acceptance Criteria**:
- All new and updated invoices synced daily
- Revenue records created with correct amounts, dates, client associations
- Duplicate invoices handled correctly (no double-counting)
- Incremental sync only fetches changed invoices (performance)
- Failed invoice imports logged with details

### FR-4: Daily Automated Expense Sync

**Description**: System must sync expenses (bills, bank transactions) from Xero daily.

**Details**:
- Run scheduled sync job daily (same schedule as invoices)
- Fetch bills and bank transactions using Xero API
- Extract: date, amount, payee, description, category/account code
- Categorize expenses (contractor payments, subscriptions, overhead, other)
- Create expense records in database
- Link contractor payments to contractor records if payee matches contractor name
- Flag unrecognized categories for manual review
- Track last sync timestamp for incremental updates

**Acceptance Criteria**:
- All expenses synced daily from Xero
- Expenses categorized correctly (at least 90% auto-categorized)
- Contractor payments linked to contractor records when possible
- Unknown categories flagged for admin review
- Sync errors logged with actionable details

### FR-5: Contact-to-Client Mapping

**Description**: System must intelligently map Xero contacts to internal client records.

**Details**:
- Use fuzzy matching on contact name and email address
- Check for exact matches first (by email or normalized name)
- If no exact match, use similarity scoring (e.g., Levenshtein distance for names)
- Allow admin to manually map unmapped contacts
- Store mapping decisions for future sync operations
- Handle one-to-many scenarios (multiple Xero contacts for same client)
- Log mapping decisions for audit trail

**Acceptance Criteria**:
- At least 95% of Xero contacts automatically mapped to clients
- Exact matches prioritized over fuzzy matches
- Admin can manually map unmapped contacts
- Mapping decisions persisted and reused in future syncs
- Ambiguous mappings flagged for admin review

### FR-6: Sync Status Tracking & Monitoring

**Description**: System must track and display sync operation status and history.

**Details**:
- Record sync events: start time, end time, status (success/failed/partial)
- Count records processed (invoices, expenses, contacts)
- Log errors with context (API error, mapping failure, validation error)
- Store sync history for at least 90 days
- Display sync status in admin dashboard
- Provide detailed error messages for troubleshooting
- Support manual sync trigger from admin UI

**Acceptance Criteria**:
- Sync history visible in admin dashboard (last 90 days minimum)
- Each sync event shows: timestamp, status, record counts, errors
- Errors include actionable details for troubleshooting
- Admin can trigger manual sync on demand
- Sync metrics available for monitoring (success rate, average duration)

### FR-7: Error Handling & Retry Logic

**Description**: System must handle API errors gracefully with exponential backoff retry.

**Details**:
- Detect transient errors (rate limits, timeouts, 5xx errors)
- Implement exponential backoff: 1 minute, 5 minutes, 15 minutes
- Retry failed operations up to 3 times
- After 3 failures, mark sync as failed and notify admin
- Log all errors with full context (request, response, timestamp)
- Continue processing remaining records if one record fails
- Provide admin option to retry failed sync manually

**Acceptance Criteria**:
- Transient errors automatically retried with exponential backoff
- Persistent errors logged and reported to admin
- Partial failures don't block entire sync (process remaining records)
- Error logs include enough detail for debugging
- Admin notified of failed syncs via dashboard alert

---

## Success Criteria

### Automation Efficiency
- **Metric**: 95% of invoices and expenses imported automatically without manual intervention
- **Measurement**: (Auto-imported records / Total records) × 100
- **Target**: ≥ 95% automation rate

### Data Accuracy
- **Metric**: 99% of synced records match Xero source data (amounts, dates, descriptions)
- **Measurement**: Sample audit of 100 random records per month
- **Target**: ≤ 1% discrepancy rate

### Sync Reliability
- **Metric**: 95% of scheduled syncs complete successfully
- **Measurement**: (Successful syncs / Total sync attempts) × 100
- **Target**: ≥ 95% success rate

### Contact Mapping Accuracy
- **Metric**: 95% of Xero contacts correctly matched to internal clients
- **Measurement**: (Correct auto-matches / Total contacts) × 100
- **Target**: ≥ 95% auto-match rate

### Error Recovery
- **Metric**: 90% of transient errors resolved via automatic retry
- **Measurement**: (Errors resolved by retry / Total transient errors) × 100
- **Target**: ≥ 90% automatic recovery rate

### Time to Sync
- **Metric**: Daily sync completes within 15 minutes
- **Measurement**: Sync duration from start to completion
- **Target**: ≤ 15 minutes for typical sync (500 invoices, 200 expenses)

---

## Data Requirements

### OAuth Token Storage

**Fields**:
- `organization_id` (foreign key to organization)
- `access_token` (encrypted)
- `refresh_token` (encrypted)
- `token_expiry` (timestamp)
- `xero_tenant_id` (Xero organization identifier)
- `scopes_granted` (array of permission scopes)
- `created_at`, `updated_at`

**Security**:
- Tokens encrypted at rest using application-level encryption
- Never log tokens in plain text
- Tokens transmitted only over HTTPS

### Sync Status Records

**Fields**:
- `sync_id` (unique identifier)
- `sync_type` (invoice, expense, contact)
- `started_at`, `completed_at`
- `status` (pending, running, success, failed, partial)
- `records_processed` (count of synced records)
- `records_failed` (count of failed records)
- `error_details` (JSON array of error messages)
- `triggered_by` (system, manual)

### Revenue Records (from invoices)

**Fields**:
- `xero_invoice_id` (external reference)
- `client_id` (foreign key, nullable if unmapped)
- `invoice_number`, `invoice_date`
- `amount`, `currency`
- `description` (line item details)
- `sync_status` (synced, mapping_failed, validation_failed)
- `last_synced_at`

### Contact Mapping Cache

**Fields**:
- `xero_contact_id` (Xero contact identifier)
- `client_id` (foreign key to internal client)
- `mapping_confidence` (exact, fuzzy, manual)
- `mapped_by` (system, admin user)
- `mapped_at` (timestamp)

---

## Dependencies

### External Services
- **Xero API**: Invoices API, Bills API, Contacts API
- **Xero OAuth 2.0**: Authorization server for token management

### Internal Systems
- **Client Management**: Existing client records for contact mapping
- **Revenue Tracking**: Database tables for storing revenue records
- **Expense Tracking**: Database tables for storing expense records
- **Contractor Management**: Contractor records for expense linking

### Technical Prerequisites
- OAuth 2.0 client credentials registered with Xero Developer Portal
- Secure token storage mechanism (encrypted database fields or secrets manager)
- Background job scheduler for daily sync (cron, queue system)
- HTTPS endpoints for OAuth callbacks

---

## Assumptions

1. **Xero Account Access**: User has an active Xero subscription with invoice and expense data
2. **Single Organization**: Each DevLabs CFO account connects to one Xero organization (multi-org support is out of scope)
3. **Client Pre-creation**: Clients are created in DevLabs CFO before syncing (Xero contacts won't auto-create clients, only map to existing ones)
4. **Invoice Status**: Only APPROVED and PAID invoices are synced (DRAFT and VOIDED ignored)
5. **Expense Categories**: Xero expense categories reasonably map to DevLabs CFO expense types
6. **Sync Frequency**: Daily sync is sufficient (real-time sync is out of scope)
7. **Data Retention**: Xero retains historical data accessible via API (no data expiry concerns)
8. **Network Reliability**: Sufficient network connectivity for API calls (retries handle transient failures)

---

## Out of Scope

### Future Enhancements (not included in this feature)
- **Real-time Sync**: Instant sync via webhooks (daily batch sync only)
- **Multi-Organization Support**: Connecting multiple Xero orgs to one DevLabs CFO account
- **Bi-directional Sync**: Writing data back to Xero (read-only integration)
- **Custom Sync Schedules**: User-configurable sync times (fixed daily schedule)
- **Advanced Categorization**: Machine learning for expense categorization (rule-based only)
- **Historical Data Import**: Bulk import of years of historical data (last 12 months only)
- **Xero Report Sync**: Importing Xero reports (P&L, balance sheet) - only raw transactions
- **Multi-currency Support**: Currency conversion and exchange rates (single currency assumed)

### Explicitly Excluded
- **Manual CSV Import**: No fallback to manual CSV upload (OAuth only)
- **Other Accounting Platforms**: QuickBooks, FreshBooks integration (Xero only)
- **Invoice Creation**: Creating invoices in DevLabs CFO to send to Xero
- **Payment Processing**: Handling payments or payment reconciliation
- **Tax Calculations**: Syncing or calculating tax amounts

---

## Security & Privacy

### Data Protection
- OAuth tokens encrypted at rest and in transit
- No storage of Xero user passwords (OAuth only)
- API credentials stored in secure environment variables or secrets manager
- Audit logging for all OAuth authorization and token refresh events

### Access Control
- Only users with "Finance Admin" or "Admin" role can connect Xero
- OAuth tokens scoped to minimum required permissions (read-only access)
- Token revocation supported if user disconnects Xero

### Compliance
- HTTPS required for all OAuth callbacks and API requests
- Token storage complies with OAuth 2.0 security best practices (RFC 6749)
- No sensitive financial data logged in plain text
- Sync error logs redact sensitive information (amounts, client names)

### Rate Limiting
- Respect Xero API rate limits (60 requests per minute)
- Implement request throttling to stay under limits
- Handle 429 (Too Many Requests) responses with retry-after delays

---

## Future Enhancements

### Phase 2 (Post-MVP)
- **Webhook Integration**: Real-time sync via Xero webhooks for instant updates
- **Multi-Organization**: Support multiple Xero orgs per DevLabs CFO account
- **Advanced Mapping**: Machine learning for contact-to-client matching
- **Custom Sync Rules**: User-defined filters (sync only specific invoice types, expense categories)

### Phase 3 (Long-term)
- **Bi-directional Sync**: Write revenue targets back to Xero as quotes
- **Reconciliation Dashboard**: Compare Xero data with DevLabs CFO records, highlight discrepancies
- **Historical Import**: Bulk import wizard for importing years of past data
- **Multi-currency**: Currency conversion for international clients

---

## Acceptance Scenarios

### Scenario 1: Successful OAuth Connection
**Given**: Finance admin has valid Xero credentials
**When**: Admin clicks "Connect Xero" and completes OAuth flow
**Then**: System stores tokens, shows "Connected" status, sync can begin

### Scenario 2: Daily Invoice Sync
**Given**: Xero account connected, new invoices exist in Xero
**When**: Daily sync job runs at 2 AM
**Then**: All new invoices imported as revenue records, clients matched, sync status = success

### Scenario 3: Contact Mapping
**Given**: Xero invoice for contact "Acme Corp" (acme@example.com)
**When**: Sync encounters invoice
**Then**: System matches to existing client "ACME Corporation" by email, creates revenue record linked to client

### Scenario 4: Sync Error with Retry
**Given**: Xero API returns 503 error during sync
**When**: Error occurs
**Then**: System waits 1 minute and retries, if still fails waits 5 minutes, then 15 minutes, logs error if all fail

### Scenario 5: Token Refresh
**Given**: OAuth access token expires in 3 minutes
**When**: Sync job starts
**Then**: System uses refresh token to get new access token before making API calls

### Scenario 6: Unmapped Contact
**Given**: Invoice for Xero contact "New Client XYZ" with no matching internal client
**When**: Sync processes invoice
**Then**: Revenue record created but flagged as "unmapped", admin notified to manually map contact

---

## Notes

- Xero API documentation: https://developer.xero.com/documentation/api/accounting/overview
- OAuth 2.0 scopes required: `accounting.transactions.read`, `accounting.contacts.read`
- Xero rate limits: 60 requests/minute, 5000 requests/day (check current limits)
- Test environment: Use Xero Demo Company for development and testing
