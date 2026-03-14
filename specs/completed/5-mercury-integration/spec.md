# Feature Specification: Mercury Banking Integration with OAuth 2.0 and Automated Transaction Sync

**Status**: Draft
**Created**: 2026-02-15
**Last Updated**: 2026-02-15

---

## Overview

### Feature Summary

Automated integration with Mercury Bank enabling secure OAuth 2.0 authentication and daily synchronization of banking transactions to populate expense records in the DevLabs CFO system. This integration provides real-time cash flow visibility and eliminates manual bank reconciliation.

### Business Value

Automates expense tracking by importing banking transactions directly from Mercury, eliminating manual bank statement reconciliation. Provides real-time cash flow visibility and automated expense categorization, ensuring accurate financial analysis and profit margin calculations. Reduces data entry errors and provides a single source of truth for cash flow and expense data.

### Target Users

- **Finance Administrators**: Connect Mercury account, monitor sync status, categorize transactions, troubleshoot sync errors
- **Agency Owners**: View real-time cash flow and expense data without manual intervention, make data-driven financial decisions
- **System Administrators**: Manage OAuth credentials, monitor integration health, configure sync schedules

---

## User Scenarios

### Primary Use Cases

**Scenario 1: Finance Admin Connects Mercury Account**
- **Actor**: Finance Administrator
- **Goal**: Authenticate DevLabs CFO with Mercury Bank to enable automated transaction sync
- **Steps**:
  1. Admin navigates to integrations settings
  2. Clicks "Connect Mercury" button
  3. Redirected to Mercury OAuth consent screen
  4. Grants permissions for banking data access
  5. Redirected back to DevLabs CFO with success confirmation
  6. System stores encrypted OAuth tokens
  7. Admin sees "Connected" status with account information
- **Expected Outcome**: Mercury account successfully linked, tokens stored securely, ready for automated sync

**Scenario 2: System Performs Daily Transaction Sync**
- **Actor**: System (automated process)
- **Goal**: Automatically sync new and updated banking transactions from Mercury daily
- **Steps**:
  1. System triggers daily sync job (2 AM UTC by default)
  2. Retrieves stored OAuth tokens from database
  3. Checks token expiry, refreshes if necessary
  4. Fetches transactions modified since last sync using Mercury API
  5. For each transaction:
     - Extracts transaction details (ID, date, amount, merchant, description)
     - Auto-categorizes transaction type (contractor, subscription, overhead, payroll, other)
     - Maps merchant to existing contractor/vendor if possible
     - Creates/updates expense records in database
  6. Updates account balance information
  7. Records sync status (success/failure, record count, errors)
  8. Logs any mapping failures or API errors for admin review
- **Expected Outcome**: All new/updated transactions imported as expense records, auto-categorized with high accuracy, sync status logged

**Scenario 3: Admin Monitors Sync Health**
- **Actor**: Finance Administrator
- **Goal**: Check integration health, review transaction categorization, troubleshoot issues
- **Steps**:
  1. Admin navigates to Mercury integration status page
  2. Views sync history table with timestamps, status, record counts, errors
  3. Reviews auto-categorized transactions and accuracy
  4. For failed syncs or miscategorized transactions, sees specific error details
  5. Can manually recategorize transactions as needed
  6. Can trigger manual sync to retry failed operations
  7. Can disconnect and reconnect Mercury account if needed
- **Expected Outcome**: Admin has full visibility into sync operations, can correct categorization errors, manually trigger syncs, troubleshoot issues

**Scenario 4: System Handles Sync Errors Gracefully**
- **Actor**: System (error handling)
- **Goal**: Recover from transient API errors without data loss
- **Steps**:
  1. Sync job encounters API error (rate limit, timeout, 5xx error)
  2. System logs error details (timestamp, error type, affected records)
  3. Implements exponential backoff retry logic (1 min, 5 min, 15 min)
  4. If all retries fail, marks sync as "Failed" with error details
  5. Continues processing remaining transactions (doesn't stop entire sync)
  6. Admin notified via dashboard alert
  7. Next scheduled sync attempts to sync failed records again
- **Expected Outcome**: Temporary errors handled with retries, persistent errors logged and reported, no data loss, partial sync success possible

### Edge Cases

**Multiple Bank Accounts**
- User has multiple Mercury accounts (checking, savings)
- System should sync all accounts separately with distinct account identifiers
- Expense records must be linked to specific account for reconciliation

**Duplicate Transactions**
- Same transaction appears multiple times due to API issues or manual retries
- System must use transaction ID to prevent duplicate expense records
- Update existing records if transaction details change (e.g., pending → cleared)

**Foreign Currency Transactions**
- Transactions in non-USD currencies (if supported by Mercury)
- System converts all foreign currency transactions to USD automatically using Mercury's conversion rate at time of transaction
- Both original amount (with currency code) and USD equivalent stored in expense record
- Conversion rate captured from Mercury API for audit trail
- All reporting and analytics use USD amounts for consistency

**Uncategorized Transactions**
- Transactions that don't match any categorization rules
- Must be flagged for manual review without blocking sync
- Admin should be able to create new categorization rules from these transactions

**Token Expiry During Sync**
- OAuth token expires while sync is in progress
- System must refresh token mid-sync and continue processing
- No partial data loss or duplicate records

**Contractor/Vendor Name Variations**
- Same contractor appears with different merchant names (e.g., "Acme Inc", "ACME INC.", "Acme Corporation")
- System should use fuzzy matching with configurable similarity threshold
- Admin can manually confirm or reject suggested matches

---

## Functional Requirements

### Core Requirements

**FR-1: OAuth 2.0 Authentication**
- **Description**: System must implement Mercury OAuth 2.0 authorization flow for secure account connection
- **Acceptance Criteria**:
  - [ ] User can authorize DevLabs CFO to access Mercury banking data
  - [ ] System redirects to Mercury authorization URL with required scopes (banking.read, transactions.read)
  - [ ] OAuth callback handler exchanges authorization code for access token and refresh token
  - [ ] Tokens stored encrypted at rest in database using AES-256-GCM encryption
  - [ ] Tokens associated with organization and Mercury account ID
  - [ ] Multiple organizations can connect different Mercury accounts independently
  - [ ] Connection status displays "ACTIVE" after successful authorization
  - [ ] User can disconnect Mercury account (tokens deleted, status = DISCONNECTED)

**FR-2: Automatic Token Refresh**
- **Description**: System must automatically refresh expired access tokens using refresh tokens
- **Acceptance Criteria**:
  - [ ] System checks token expiry before each API call
  - [ ] If token expires within 5 minutes, automatic refresh is triggered
  - [ ] Refresh token used to obtain new access token from Mercury
  - [ ] New tokens stored encrypted in database, replacing old tokens
  - [ ] Token refresh failures trigger user re-authorization flow
  - [ ] Token refresh events logged for security audit
  - [ ] Sync operations never fail due to expired tokens (auto-refresh prevents this)

**FR-3: Daily Automated Transaction Sync**
- **Description**: System must sync banking transactions from Mercury daily and create/update expense records
- **Acceptance Criteria**:
  - [ ] Scheduled sync job runs daily at configurable time (default 2 AM UTC)
  - [ ] Uses Mercury Transactions API with incremental sync (fetch only new/modified transactions)
  - [ ] Extracts transaction details: ID, date, amount, merchant name, description, category, account info
  - [ ] For foreign currency transactions, captures original currency code, original amount, USD equivalent, and conversion rate
  - [ ] Creates expense records in financial_expense_records table with all transaction details
  - [ ] Links expense records to organization and Mercury account
  - [ ] Handles duplicate transactions using idempotent updates (based on mercury_transaction_id)
  - [ ] Updates existing expense records if transaction status changes (pending → cleared)
  - [ ] Tracks last successful sync timestamp for incremental updates
  - [ ] All new and updated transactions synced daily without manual intervention

**FR-4: Intelligent Transaction Categorization**
- **Description**: System must auto-categorize transactions using pattern matching and machine learning
- **Acceptance Criteria**:
  - [ ] Transactions categorized into types: CONTRACTOR, SUBSCRIPTION, OVERHEAD, PAYROLL, OTHER
  - [ ] Merchant names matched to existing contractors/vendors using fuzzy string matching
  - [ ] Description keywords used for categorization (e.g., "AWS" → SUBSCRIPTION, "Rent" → OVERHEAD)
  - [ ] Categorization rules stored in database and applied to all transactions
  - [ ] Admin can manually override auto-categorization for specific transactions
  - [ ] Admin can create new categorization rules from uncategorized transactions
  - [ ] Categorization confidence score stored with each expense record
  - [ ] At least 90% of transactions auto-categorized correctly (measured against manual review)
  - [ ] Uncategorized transactions flagged for manual review without blocking sync

**FR-5: Account and Balance Tracking**
- **Description**: System must sync multiple bank accounts and track balances over time
- **Acceptance Criteria**:
  - [ ] System syncs all Mercury accounts (checking, savings) for connected organization
  - [ ] Each account tracked separately with unique account ID
  - [ ] Account balance fetched and updated daily during sync
  - [ ] Balance history recorded for trend analysis (daily snapshots)
  - [ ] Low balance alerts triggered when account falls below configurable threshold
  - [ ] Account information displayed in dashboard (account name, type, current balance, last updated)

**FR-6: Sync Status Tracking & Monitoring**
- **Description**: System must track and display sync operation status and history
- **Acceptance Criteria**:
  - [ ] Sync events recorded: start time, end time, status (success/failed/partial), sync type
  - [ ] Transaction counts logged: processed, created, updated, failed
  - [ ] Errors logged with full context (API error, categorization failure, validation error)
  - [ ] Sync history stored for at least 90 days
  - [ ] Sync status displayed in admin dashboard with last 90 days of history
  - [ ] Each sync event shows: timestamp, status, record counts, duration, error messages
  - [ ] Errors include actionable details for troubleshooting
  - [ ] Admin can trigger manual sync on demand from dashboard
  - [ ] Manual sync creates audit log entry with triggering user

**FR-7: Error Handling & Retry Logic**
- **Description**: System must handle API errors gracefully with exponential backoff retry
- **Acceptance Criteria**:
  - [ ] Transient errors detected (rate limits, timeouts, 5xx server errors)
  - [ ] Exponential backoff retry implemented: 1 minute, 5 minutes, 15 minutes delays
  - [ ] Failed operations retried up to 3 times before marking as failed
  - [ ] After 3 failures, sync marked as failed and admin notified via dashboard
  - [ ] All errors logged with full context (request, response, timestamp, retry count)
  - [ ] Partial failures don't block entire sync (remaining transactions processed)
  - [ ] Admin can manually retry failed syncs from dashboard
  - [ ] At least 90% of transient errors resolved automatically via retry logic

**FR-8: Transaction-to-Expense Mapping**
- **Description**: System must link Mercury transactions to expense records with intelligent merchant matching
- **Acceptance Criteria**:
  - [ ] Each expense record linked to Mercury transaction via mercury_transaction_id
  - [ ] Merchants mapped to contractors/vendors where name similarity exceeds threshold (85%)
  - [ ] Manual merchant-to-contractor mappings stored and reused for future transactions
  - [ ] Unmapped transactions flagged for manual review
  - [ ] Admin can bulk categorize similar transactions (e.g., all "Acme Inc" → Contractor X)
  - [ ] Mapping decisions cached for O(1) lookup on subsequent syncs
  - [ ] Merchant-to-contractor matching accuracy at least 85% (measured against manual review)

### Data Requirements

**DR-1: Mercury Connection**
- **Description**: OAuth token and connection metadata storage
- **Key Attributes**:
  - organization_id (foreign key)
  - mercury_account_id (Mercury account identifier)
  - access_token_encrypted (AES-256-GCM encrypted)
  - refresh_token_encrypted (AES-256-GCM encrypted)
  - token_expiry (timestamp)
  - scopes_granted (array of permission scopes)
  - connection_status (ACTIVE, DISCONNECTED, TOKEN_EXPIRED)
  - last_sync_at (timestamp of last successful sync)
  - created_at, updated_at
- **Validation Rules**:
  - Tokens encrypted at rest, never logged in plain text
  - One active connection per organization
  - Token expiry must be future timestamp

**DR-2: Mercury Sync Log**
- **Description**: Audit trail of all sync operations
- **Key Attributes**:
  - sync_id (unique identifier)
  - connection_id (foreign key to mercury_connection)
  - sync_type (TRANSACTIONS, ACCOUNTS, FULL)
  - started_at, completed_at (timestamps)
  - status (PENDING, RUNNING, SUCCESS, FAILED, PARTIAL)
  - transactions_processed, transactions_failed (counts)
  - error_details (JSON array of error messages)
  - triggered_by (SYSTEM, MANUAL, RETRY)
  - triggered_by_user_id (nullable, if manual trigger)
- **Validation Rules**:
  - status transitions: PENDING → RUNNING → (SUCCESS|FAILED|PARTIAL)
  - completed_at must be after started_at
  - error_details required if status is FAILED or PARTIAL

**DR-3: Merchant Mapping Cache**
- **Description**: Cached mappings between Mercury merchants and contractors/vendors
- **Key Attributes**:
  - mercury_merchant_id (Mercury merchant identifier)
  - mercury_merchant_name (as appears in transactions)
  - contractor_id (foreign key to contractor, nullable)
  - vendor_id (foreign key to vendor, nullable if not using separate vendors table)
  - mapping_confidence (EXACT, FUZZY, MANUAL)
  - confidence_score (0.0-1.0 for fuzzy matches)
  - mapped_by (SYSTEM, ADMIN_USER)
  - mapped_by_user_id (nullable)
  - mapped_at (timestamp)
- **Validation Rules**:
  - Either contractor_id or vendor_id must be set (not both null)
  - confidence_score required if mapping_confidence is FUZZY
  - Manual mappings override automatic matches

**DR-4: Transaction Categorization Rules**
- **Description**: Pattern-based rules for auto-categorizing transactions
- **Key Attributes**:
  - rule_id (unique identifier)
  - organization_id (foreign key)
  - rule_type (MERCHANT_NAME, DESCRIPTION_KEYWORD, AMOUNT_RANGE)
  - pattern (regex or exact match string)
  - category (CONTRACTOR, SUBSCRIPTION, OVERHEAD, PAYROLL, OTHER)
  - priority (integer, higher priority rules evaluated first)
  - is_active (boolean)
  - created_by_user_id
  - created_at, updated_at
- **Validation Rules**:
  - pattern must be valid regex if rule_type is pattern-based
  - priority must be positive integer
  - category must be valid expense type

**DR-5: Account Balance History**
- **Description**: Daily snapshots of account balances for trend analysis
- **Key Attributes**:
  - snapshot_id (unique identifier)
  - mercury_account_id (Mercury account identifier)
  - organization_id (foreign key)
  - account_name (e.g., "Business Checking")
  - account_type (CHECKING, SAVINGS)
  - balance (decimal)
  - currency (default USD)
  - snapshot_date (date)
  - created_at (timestamp)
- **Validation Rules**:
  - One snapshot per account per day
  - balance must be decimal with 2 decimal places
  - snapshot_date must not be in future

---

## Success Criteria

### Measurable Outcomes

- [ ] **Automation Efficiency**: 95% of banking transactions imported automatically without manual intervention
  - Measurement: (Auto-imported transactions / Total Mercury transactions) × 100

- [ ] **Categorization Accuracy**: 90% of transactions correctly auto-categorized
  - Measurement: Sample audit of 100 random transactions per month, compare system categorization vs manual review

- [ ] **Sync Reliability**: 95% of scheduled syncs complete successfully
  - Measurement: (Successful syncs / Total sync attempts) × 100

- [ ] **Merchant Matching Accuracy**: 85% of merchants correctly matched to contractors/vendors
  - Measurement: (Correct auto-matches / Total merchant transactions) × 100

- [ ] **Error Recovery**: 90% of transient errors resolved via automatic retry
  - Measurement: (Errors resolved by retry / Total transient errors) × 100

- [ ] **Performance**: Daily sync completes within 10 minutes
  - Measurement: Sync duration from start to completion for typical sync (500 transactions)

- [ ] **Data Accuracy**: 99% of synced transactions match Mercury source data (amounts, dates, merchants)
  - Measurement: Sample audit of 100 random transactions per month

- [ ] **User Efficiency**: Finance admin can review and correct categorization for 100 transactions in under 15 minutes
  - Measurement: Time study with actual users performing categorization review

---

## Dependencies

### External Dependencies

- **Mercury Bank API**: Banking transactions API, accounts API, OAuth 2.0 authorization server
- **Mercury Developer Account**: API credentials (client ID, client secret) registered with Mercury

### Internal Dependencies

- **Financial Expense Records**: Existing expense_records table in database for storing synced transactions
- **Contractor Management**: Existing contractors table for merchant-to-contractor mapping
- **OAuth Token Encryption**: Existing encryption utilities from Xero integration (AES-256-GCM)
- **Sync Infrastructure**: Background job scheduler from Xero integration (Vercel Cron or similar)
- **Error Handling**: Existing retry logic and error logging from Xero integration

---

## Assumptions

- **Mercury Account Access**: User has an active Mercury business bank account with transaction history
- **Single Account Per Organization**: Each DevLabs CFO organization connects to one Mercury account (multi-account support is out of scope for MVP)
- **Currency Conversion**: Foreign currency transactions automatically converted to USD using Mercury's conversion rate; all reporting done in USD
- **Expense Pre-creation**: Contractors/vendors are already created in DevLabs CFO before syncing (transactions won't auto-create contractors, only map to existing ones)
- **Transaction Availability**: Mercury API provides historical transaction data with no retention limits
- **Sync Frequency**: Daily sync is sufficient for business needs (real-time sync is out of scope)
- **Network Reliability**: Sufficient network connectivity for API calls (retries handle transient failures)
- **Data Retention**: Mercury retains historical transaction data accessible via API
- **API Stability**: Mercury API follows standard OAuth 2.0 practices and provides stable endpoints
- **Categorization Rules**: Default categorization rules are sufficient for 80% of transactions, with manual overrides for edge cases

---

## Out of Scope

### Future Enhancements (not included in this feature)

- **Real-time Sync**: Instant sync via Mercury webhooks (daily batch sync only)
- **Multi-Account Support**: Connecting multiple Mercury accounts to one DevLabs CFO organization
- **Bill Payment**: Initiating payments from DevLabs CFO to Mercury (read-only integration)
- **Budget Forecasting**: Predictive cash flow modeling (expense tracking only)
- **Advanced Categorization**: Machine learning models for categorization (rule-based only)
- **Historical Data Import**: Bulk import of years of historical data (last 12 months only)
- **Custom Sync Schedules**: User-configurable sync times (fixed daily schedule)
- **Reconciliation Tools**: Bank reconciliation workflow (sync only)

### Explicitly Excluded

- **Manual CSV Import**: No fallback to manual CSV upload (OAuth only)
- **Other Banking Platforms**: Chase, Wells Fargo, Bank of America integration (Mercury only)
- **Transaction Creation**: Creating transactions in DevLabs CFO to send to Mercury
- **Payment Processing**: Handling payments or payment approvals
- **Tax Calculations**: Syncing or calculating tax amounts
- **Payroll Processing**: Payroll calculations or payments (categorization only)

---

## Security & Privacy Considerations

### Data Protection

- OAuth tokens encrypted at rest using AES-256-GCM encryption
- No storage of Mercury user passwords (OAuth only)
- API credentials stored in secure environment variables or secrets manager
- Audit logging for all OAuth authorization and token refresh events
- Banking data transmitted only over HTTPS
- Transaction data stored with organization-level isolation (RLS policies)

### Access Control

- Only users with "Finance Admin" or "Admin" role can connect Mercury account
- OAuth tokens scoped to minimum required permissions (read-only banking data)
- Token revocation supported if user disconnects Mercury account
- Row-level security (RLS) ensures users only access their organization's banking data

### Compliance

- HTTPS required for all OAuth callbacks and API requests
- Token storage complies with OAuth 2.0 security best practices (RFC 6749)
- No sensitive financial data logged in plain text
- Sync error logs redact account numbers and balances
- Banking data handling complies with financial data privacy regulations

### Rate Limiting

- Respect Mercury API rate limits (specific limits TBD based on Mercury documentation)
- Implement request throttling to stay under limits
- Handle 429 (Too Many Requests) responses with retry-after delays
- Circuit breaker pattern to prevent API abuse during outages

---

## Future Enhancements

### Phase 2 (Post-MVP)

- **Webhook Integration**: Real-time sync via Mercury webhooks for instant transaction updates
- **Multi-Account Support**: Connect and sync multiple Mercury accounts per organization
- **Advanced Categorization**: Machine learning for transaction categorization based on historical patterns
- **Custom Sync Rules**: User-defined filters (sync only specific account types, exclude certain merchants)
- **Budget Alerts**: Proactive alerts when spending exceeds budget thresholds

### Phase 3 (Long-term)

- **Reconciliation Dashboard**: Compare Mercury transactions with expense records, highlight discrepancies
- **Cash Flow Forecasting**: Predictive modeling based on transaction history
- **Bill Payment**: Initiate payments from DevLabs CFO interface
- **Advanced Multi-Currency**: Manual exchange rate overrides, currency-specific reporting, historical rate tracking
- **Cross-Platform**: Integration with other banking platforms beyond Mercury
