# Data Model: Xero OAuth 2.0 Integration & Automated Data Sync

**Feature**: Xero OAuth 2.0 Integration & Automated Data Sync
**Version**: 1.0
**Created**: 2026-02-14
**Status**: Final

---

## Overview

This document defines the data structures, database schema changes, entity relationships, and migration strategy for the Xero OAuth 2.0 integration feature. The design introduces new tables for OAuth token storage, sync status tracking, contact mappings, and expense categorization rules while integrating with existing client and revenue tables.

---

## Database Schema Changes

### 1. New Table: xero_connections

**Purpose**: Store encrypted OAuth 2.0 tokens and connection metadata for Xero organizations.

**Fields**:

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `id` | UUID | Yes | uuid_generate_v4() | Primary key |
| `organization_id` | UUID | Yes | - | Foreign key to organizations table |
| `xero_tenant_id` | String | Yes | - | Xero organization identifier (from OAuth flow) |
| `access_token` | String | Yes | - | Encrypted OAuth access token (AES-256) |
| `refresh_token` | String | Yes | - | Encrypted OAuth refresh token (AES-256) |
| `token_expiry` | DateTime | Yes | - | Access token expiration timestamp (UTC) |
| `scopes_granted` | String[] | Yes | - | Array of OAuth scopes granted by user |
| `connection_status` | Enum | Yes | 'ACTIVE' | ACTIVE, DISCONNECTED, TOKEN_EXPIRED, ERROR |
| `last_sync_at` | DateTime | No | null | Timestamp of last successful sync completion |
| `last_sync_status` | Enum | No | null | SUCCESS, FAILED, PARTIAL |
| `created_at` | DateTime | Yes | now() | Connection established timestamp |
| `updated_at` | DateTime | Yes | now() | Last token refresh or update timestamp |

**Constraints**:
```sql
-- Primary key
PRIMARY KEY (id)

-- Foreign key to organizations (multi-tenancy)
FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE

-- One Xero connection per organization
UNIQUE (organization_id)

-- Unique Xero tenant mapping (prevent duplicate connections)
UNIQUE (xero_tenant_id)

-- Token expiry must be future timestamp
CHECK (token_expiry > created_at)
```

**Indexes**:
```sql
CREATE INDEX idx_xero_connections_org_id ON xero_connections(organization_id);
CREATE INDEX idx_xero_connections_status ON xero_connections(connection_status);
CREATE INDEX idx_xero_connections_tenant_id ON xero_connections(xero_tenant_id);
```

**RLS Policy** (Supabase):
```sql
-- Users can only access connections for their organization
CREATE POLICY xero_connections_org_isolation ON xero_connections
  FOR ALL USING (
    organization_id IN (
      SELECT organization_id FROM user_profiles WHERE user_id = auth.uid()
    )
  );
```

**Security**:
- `access_token` and `refresh_token` encrypted using Web Crypto API before database insert
- Encryption key stored in `XERO_TOKEN_ENCRYPTION_KEY` environment variable
- Never log tokens in plain text
- Use service role for server-side token access (never expose to client)

**Enums**:
```typescript
enum ConnectionStatus {
  ACTIVE         // Connection working, tokens valid
  DISCONNECTED   // User manually disconnected Xero
  TOKEN_EXPIRED  // Refresh token expired (60 days), requires re-auth
  ERROR          // Connection error (API failure, invalid tenant)
}

enum SyncStatus {
  SUCCESS        // All records synced successfully
  FAILED         // Sync job failed (all retries exhausted)
  PARTIAL        // Some records synced, some failed
}
```

---

### 2. New Table: xero_sync_logs

**Purpose**: Track all sync job executions with status, record counts, and errors for monitoring and troubleshooting.

**Fields**:

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `id` | UUID | Yes | uuid_generate_v4() | Primary key |
| `connection_id` | UUID | Yes | - | Foreign key to xero_connections table |
| `sync_type` | Enum | Yes | - | INVOICES, EXPENSES, CONTACTS, FULL |
| `status` | Enum | Yes | 'PENDING' | PENDING, RUNNING, SUCCESS, FAILED, PARTIAL |
| `started_at` | DateTime | Yes | now() | Sync job start timestamp |
| `completed_at` | DateTime | No | null | Sync job completion timestamp |
| `duration_ms` | Int | No | null | Total execution time in milliseconds |
| `invoices_processed` | Int | No | 0 | Count of invoices synced/attempted |
| `invoices_failed` | Int | No | 0 | Count of invoices that failed to sync |
| `expenses_processed` | Int | No | 0 | Count of expenses synced/attempted |
| `expenses_failed` | Int | No | 0 | Count of expenses that failed to sync |
| `contacts_mapped` | Int | No | 0 | Count of contacts successfully mapped to clients |
| `contacts_unmapped` | Int | No | 0 | Count of contacts requiring manual mapping |
| `errors` | JSONB | No | '[]'::jsonb | Array of error objects: `[{type, message, context, timestamp}]` |
| `triggered_by` | Enum | Yes | - | SCHEDULED, MANUAL, RETRY |
| `created_at` | DateTime | Yes | now() | Record creation timestamp |

**Constraints**:
```sql
-- Primary key
PRIMARY KEY (id)

-- Foreign key to xero_connections
FOREIGN KEY (connection_id) REFERENCES xero_connections(id) ON DELETE CASCADE

-- Completed_at must be after started_at
CHECK (completed_at IS NULL OR completed_at >= started_at)

-- Duration must be positive
CHECK (duration_ms IS NULL OR duration_ms >= 0)

-- Record counts must be non-negative
CHECK (invoices_processed >= 0 AND invoices_failed >= 0)
CHECK (expenses_processed >= 0 AND expenses_failed >= 0)
CHECK (contacts_mapped >= 0 AND contacts_unmapped >= 0)
```

**Indexes**:
```sql
CREATE INDEX idx_xero_sync_logs_connection_id ON xero_sync_logs(connection_id);
CREATE INDEX idx_xero_sync_logs_status ON xero_sync_logs(status);
CREATE INDEX idx_xero_sync_logs_started_at ON xero_sync_logs(started_at DESC);
CREATE INDEX idx_xero_sync_logs_sync_type ON xero_sync_logs(sync_type);
```

**RLS Policy**:
```sql
-- Users can only view sync logs for their organization's connection
CREATE POLICY xero_sync_logs_org_isolation ON xero_sync_logs
  FOR SELECT USING (
    connection_id IN (
      SELECT id FROM xero_connections
      WHERE organization_id IN (
        SELECT organization_id FROM user_profiles WHERE user_id = auth.uid()
      )
    )
  );
```

**Enums**:
```typescript
enum SyncType {
  INVOICES    // Invoice sync only
  EXPENSES    // Expense sync only
  CONTACTS    // Contact mapping refresh
  FULL        // Complete sync (invoices + expenses + contacts)
}

enum SyncJobStatus {
  PENDING     // Job queued, not started
  RUNNING     // Job currently executing
  SUCCESS     // All records synced successfully
  FAILED      // Job failed (all retries exhausted)
  PARTIAL     // Some records synced, some failed
}

enum SyncTrigger {
  SCHEDULED   // Triggered by cron job (pg_cron)
  MANUAL      // User-initiated from dashboard
  RETRY       // Automatic retry of failed sync
}
```

**Error Object Structure** (JSONB):
```typescript
interface SyncError {
  type: 'API_ERROR' | 'MAPPING_ERROR' | 'VALIDATION_ERROR' | 'RATE_LIMIT';
  message: string;                    // Human-readable error description
  context: {
    xero_invoice_id?: string;         // Xero record identifier
    xero_contact_id?: string;
    http_status?: number;             // HTTP status code (if API error)
    retry_count?: number;             // Number of retries attempted
    [key: string]: any;               // Additional context
  };
  timestamp: string;                  // ISO 8601 timestamp
}
```

---

### 3. New Table: xero_contact_mappings

**Purpose**: Cache Xero contact-to-client mappings for fast lookups and track mapping confidence/decisions.

**Fields**:

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `id` | UUID | Yes | uuid_generate_v4() | Primary key |
| `connection_id` | UUID | Yes | - | Foreign key to xero_connections table |
| `xero_contact_id` | UUID | Yes | - | Xero contact identifier |
| `xero_contact_name` | String | Yes | - | Xero contact name (for display/debugging) |
| `client_id` | UUID | Yes | - | Foreign key to clients table |
| `mapping_type` | Enum | Yes | - | EMAIL_EXACT, NAME_EXACT, NAME_FUZZY, MANUAL |
| `confidence_score` | Float | No | null | Similarity score for fuzzy matches (0.0-1.0) |
| `mapped_by_user_id` | UUID | No | null | User ID if manual mapping (null if automatic) |
| `created_at` | DateTime | Yes | now() | Initial mapping timestamp |
| `updated_at` | DateTime | Yes | now() | Last mapping update timestamp |

**Constraints**:
```sql
-- Primary key
PRIMARY KEY (id)

-- Foreign keys
FOREIGN KEY (connection_id) REFERENCES xero_connections(id) ON DELETE CASCADE
FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
FOREIGN KEY (mapped_by_user_id) REFERENCES user_profiles(user_id) ON DELETE SET NULL

-- One mapping per Xero contact (prevent duplicates)
UNIQUE (connection_id, xero_contact_id)

-- Confidence score between 0 and 1
CHECK (confidence_score IS NULL OR (confidence_score >= 0.0 AND confidence_score <= 1.0))

-- Manual mappings must have mapped_by_user_id
CHECK (
  (mapping_type = 'MANUAL' AND mapped_by_user_id IS NOT NULL) OR
  (mapping_type != 'MANUAL')
)
```

**Indexes**:
```sql
CREATE INDEX idx_xero_contact_mappings_connection_id ON xero_contact_mappings(connection_id);
CREATE INDEX idx_xero_contact_mappings_client_id ON xero_contact_mappings(client_id);
CREATE UNIQUE INDEX idx_xero_contact_mappings_xero_contact ON xero_contact_mappings(connection_id, xero_contact_id);
CREATE INDEX idx_xero_contact_mappings_type ON xero_contact_mappings(mapping_type);
```

**RLS Policy**:
```sql
CREATE POLICY xero_contact_mappings_org_isolation ON xero_contact_mappings
  FOR ALL USING (
    connection_id IN (
      SELECT id FROM xero_connections
      WHERE organization_id IN (
        SELECT organization_id FROM user_profiles WHERE user_id = auth.uid()
      )
    )
  );
```

**Enums**:
```typescript
enum MappingType {
  EMAIL_EXACT   // Exact match on contact email → client email (95% confidence)
  NAME_EXACT    // Exact match on normalized name (90% confidence)
  NAME_FUZZY    // Fuzzy match with Jaro-Winkler > 0.85 (80% confidence)
  MANUAL        // Admin manually mapped contact to client (100% confidence)
}
```

---

### 4. New Table: xero_expense_category_mappings

**Purpose**: Store configurable rules for automatically categorizing Xero expenses into DevLabs CFO expense types.

**Fields**:

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `id` | UUID | Yes | uuid_generate_v4() | Primary key |
| `connection_id` | UUID | Yes | - | Foreign key to xero_connections table |
| `account_code_pattern` | String | No | null | Xero account code pattern (e.g., "6%", "500") |
| `keyword_pattern` | String | No | null | Regex pattern for description matching |
| `expense_type` | Enum | Yes | - | CONTRACTOR, SUBSCRIPTION, OVERHEAD, OTHER |
| `priority` | Int | Yes | 100 | Matching priority (lower = higher priority) |
| `is_active` | Boolean | Yes | true | Enable/disable rule without deleting |
| `created_by_user_id` | UUID | No | null | User ID who created rule (null if system default) |
| `created_at` | DateTime | Yes | now() | Rule creation timestamp |
| `updated_at` | DateTime | Yes | now() | Last rule update timestamp |

**Constraints**:
```sql
-- Primary key
PRIMARY KEY (id)

-- Foreign keys
FOREIGN KEY (connection_id) REFERENCES xero_connections(id) ON DELETE CASCADE
FOREIGN KEY (created_by_user_id) REFERENCES user_profiles(user_id) ON DELETE SET NULL

-- Must have at least one pattern (account code OR keyword)
CHECK (account_code_pattern IS NOT NULL OR keyword_pattern IS NOT NULL)

-- Priority must be positive
CHECK (priority > 0)
```

**Indexes**:
```sql
CREATE INDEX idx_xero_expense_mappings_connection_id ON xero_expense_category_mappings(connection_id);
CREATE INDEX idx_xero_expense_mappings_priority ON xero_expense_category_mappings(priority);
CREATE INDEX idx_xero_expense_mappings_type ON xero_expense_category_mappings(expense_type);
CREATE INDEX idx_xero_expense_mappings_active ON xero_expense_category_mappings(is_active) WHERE is_active = true;
```

**RLS Policy**:
```sql
CREATE POLICY xero_expense_mappings_org_isolation ON xero_expense_category_mappings
  FOR ALL USING (
    connection_id IN (
      SELECT id FROM xero_connections
      WHERE organization_id IN (
        SELECT organization_id FROM user_profiles WHERE user_id = auth.uid()
      )
    )
  );
```

**Enums**:
```typescript
enum ExpenseType {
  CONTRACTOR     // Contractor payment (link to contractor record)
  SUBSCRIPTION   // SaaS, software licenses, recurring tools
  OVERHEAD       // Rent, utilities, office expenses
  OTHER          // Uncategorized (requires manual review)
}
```

**Default Mapping Rules** (seeded on first connection):
```sql
-- Contractor payments (Xero account codes 6000-6999 typically wages/contractors)
INSERT INTO xero_expense_category_mappings (connection_id, account_code_pattern, expense_type, priority)
VALUES (?, '6%', 'CONTRACTOR', 10);

-- Subscription patterns
INSERT INTO xero_expense_category_mappings (connection_id, keyword_pattern, expense_type, priority)
VALUES (?, '(?i)(subscription|license|saas|software)', 'SUBSCRIPTION', 20);

-- Overhead patterns
INSERT INTO xero_expense_category_mappings (connection_id, keyword_pattern, expense_type, priority)
VALUES (?, '(?i)(rent|utilities|office|insurance)', 'OVERHEAD', 30);

-- Default fallback
INSERT INTO xero_expense_category_mappings (connection_id, account_code_pattern, expense_type, priority)
VALUES (?, '%', 'OTHER', 1000);
```

---

### 5. Updates to Existing Tables

#### 5.1. revenue_records Table (Add Xero Reference)

**New Fields**:

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `xero_invoice_id` | String | No | null | Xero invoice identifier (external reference) |
| `xero_invoice_number` | String | No | null | Xero invoice number (for display) |
| `sync_status` | Enum | No | null | SYNCED, MAPPING_FAILED, VALIDATION_FAILED, MANUAL |
| `last_synced_at` | DateTime | No | null | Last sync timestamp from Xero |

**Constraints**:
```sql
-- Unique Xero invoice per organization (prevent duplicate sync)
CREATE UNIQUE INDEX idx_revenue_records_xero_invoice
  ON revenue_records(organization_id, xero_invoice_id)
  WHERE xero_invoice_id IS NOT NULL;
```

**Enums**:
```typescript
enum RevenueSyncStatus {
  SYNCED             // Successfully synced from Xero
  MAPPING_FAILED     // Couldn't map Xero contact to client
  VALIDATION_FAILED  // Data validation error
  MANUAL             // Manually entered (not from Xero)
}
```

#### 5.2. expense_records Table (Add Xero Reference)

**New Fields**:

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `xero_expense_id` | String | No | null | Xero bill/transaction identifier |
| `xero_account_code` | String | No | null | Xero account code (for categorization) |
| `sync_status` | Enum | No | null | SYNCED, CATEGORIZATION_FAILED, VALIDATION_FAILED, MANUAL |
| `last_synced_at` | DateTime | No | null | Last sync timestamp from Xero |

**Constraints**:
```sql
-- Unique Xero expense per organization
CREATE UNIQUE INDEX idx_expense_records_xero_expense
  ON expense_records(organization_id, xero_expense_id)
  WHERE xero_expense_id IS NOT NULL;
```

**Enums**:
```typescript
enum ExpenseSyncStatus {
  SYNCED                  // Successfully synced from Xero
  CATEGORIZATION_FAILED   // Couldn't auto-categorize expense type
  VALIDATION_FAILED       // Data validation error
  MANUAL                  // Manually entered (not from Xero)
}
```

---

## Entity Relationships

```
┌─────────────────┐
│  organizations  │
└────────┬────────┘
         │ 1:1
         ▼
┌─────────────────────┐       ┌──────────────────┐
│ xero_connections    │◄──────│ xero_sync_logs   │
│ (OAuth tokens)      │ 1:N   │ (sync history)   │
└─────────┬───────────┘       └──────────────────┘
          │ 1:N
          ▼
┌─────────────────────────────┐
│ xero_contact_mappings       │
│ (Xero contact → client)     │
└─────────────┬───────────────┘
              │ N:1
              ▼
         ┌─────────┐
         │ clients │
         └────┬────┘
              │ 1:N
              ▼
     ┌─────────────────┐         ┌──────────────────┐
     │ revenue_records │         │ expense_records  │
     │ + xero_invoice_id│         │ + xero_expense_id│
     └─────────────────┘         └──────────────────┘

┌─────────────────────────────────┐
│ xero_expense_category_mappings  │
│ (categorization rules)          │
└─────────────────────────────────┘
```

**Key Relationships**:
- `xero_connections.organization_id` → `organizations.id` (1:1) - One Xero connection per org
- `xero_sync_logs.connection_id` → `xero_connections.id` (N:1) - Many sync jobs per connection
- `xero_contact_mappings.connection_id` → `xero_connections.id` (N:1) - Many contact mappings
- `xero_contact_mappings.client_id` → `clients.id` (N:1) - Multiple Xero contacts can map to same client
- `revenue_records.client_id` → `clients.id` (N:1) - Revenue linked to client
- `expense_records.contractor_id` → `contractors.id` (N:1) - Expense linked to contractor (if applicable)

---

## Data Flow Diagrams

### OAuth Connection Flow

```
[User] → [Next.js UI]
           ↓ (1) Click "Connect Xero"
         [/api/xero/oauth/authorize]
           ↓ (2) Redirect to Xero
         [Xero Authorization]
           ↓ (3) User grants permissions
         [/api/xero/oauth/callback]
           ↓ (4) Exchange code for tokens
           ↓ (5) Encrypt tokens
         [xero_connections] ← INSERT encrypted tokens
           ↓ (6) Return success
         [UI: "Connected" status]
```

### Daily Invoice Sync Flow

```
[pg_cron] → (2 AM UTC)
  ↓ (1) HTTP POST with CRON_SECRET
[/api/xero/sync] ← Validate secret
  ↓ (2) Create sync_log (PENDING)
  ↓ (3) Fetch OAuth tokens
[xero_connections] → Decrypt tokens
  ↓ (4) Initialize Xero client
  ↓ (5) API: GET /Invoices?ModifiedAfter=last_sync_at
[Xero API] → Return invoices
  ↓ (6) For each invoice:
  ↓     - Check xero_contact_mappings cache
  ↓     - If not cached: tiered matching (email → name → fuzzy)
  ↓     - Create/update revenue_record
[revenue_records] ← INSERT/UPDATE with xero_invoice_id
[xero_contact_mappings] ← INSERT if new mapping
  ↓ (7) Update sync_log (SUCCESS/FAILED)
[xero_sync_logs] ← UPDATE status, counts, errors
  ↓ (8) Update last_sync_at
[xero_connections] ← UPDATE last_sync_at
```

### Expense Categorization Flow

```
[Sync Job] → Process Xero expense
  ↓ (1) Extract expense data
  {
    amount: 5000,
    payee: "John Doe Consulting",
    account_code: "6100",
    description: "Monthly dev work"
  }
  ↓ (2) Check if payee matches contractor
[contractors] → Search by name similarity
  ↓ (3) If match found → expense_type = CONTRACTOR
  ↓ (4) Else: Check category mappings
[xero_expense_category_mappings] → ORDER BY priority
  ↓ (5) Match account_code_pattern = "6%"
  ↓ (6) Result: expense_type = CONTRACTOR
  ↓ (7) Create expense record
[expense_records] ← INSERT with category + xero_expense_id
```

---

## Migration Strategy

### Migration Files (Prisma)

**Migration 1**: Create xero_connections table
```bash
npx prisma migrate dev --name add_xero_connections
```

**Migration 2**: Create xero_sync_logs table
```bash
npx prisma migrate dev --name add_xero_sync_logs
```

**Migration 3**: Create xero_contact_mappings table
```bash
npx prisma migrate dev --name add_xero_contact_mappings
```

**Migration 4**: Create xero_expense_category_mappings table
```bash
npx prisma migrate dev --name add_xero_expense_category_mappings
```

**Migration 5**: Update revenue_records with Xero fields
```bash
npx prisma migrate dev --name add_xero_fields_to_revenue
```

**Migration 6**: Update expense_records with Xero fields
```bash
npx prisma migrate dev --name add_xero_fields_to_expenses
```

### Rollback Strategy

Each migration is reversible:
- Drop new tables: `DROP TABLE IF EXISTS xero_connections CASCADE;`
- Drop new columns: `ALTER TABLE revenue_records DROP COLUMN xero_invoice_id;`
- All foreign keys use `ON DELETE CASCADE` for clean removal

### Data Seeding

**Seed default expense category mappings** (run after first Xero connection):
```sql
-- See section 4: Default Mapping Rules
```

---

## Validation Rules

### xero_connections Validation

- ✅ `xero_tenant_id` must be valid UUID format
- ✅ `access_token` and `refresh_token` encrypted before storage
- ✅ `token_expiry` must be future timestamp (validated on insert/update)
- ✅ `scopes_granted` must include minimum required scopes: `offline_access`, `accounting.transactions.read`

### xero_sync_logs Validation

- ✅ `completed_at` must be after `started_at` (validated via CHECK constraint)
- ✅ `duration_ms` calculated as `(completed_at - started_at)` in milliseconds
- ✅ `errors` JSONB array must contain valid SyncError objects

### xero_contact_mappings Validation

- ✅ `confidence_score` between 0.0 and 1.0 (validated via CHECK constraint)
- ✅ Manual mappings (`mapping_type = MANUAL`) require `mapped_by_user_id`
- ✅ Automatic mappings must have `confidence_score` populated

### revenue_records & expense_records Validation

- ✅ `xero_invoice_id` unique per organization (prevent duplicate sync)
- ✅ `sync_status` set to `SYNCED` only if successfully imported from Xero
- ✅ `last_synced_at` updated on every sync (even if data unchanged)

---

## Performance Considerations

### Query Optimization

**Contact mapping lookups** (most frequent):
```sql
-- O(1) lookup using unique index
SELECT client_id FROM xero_contact_mappings
WHERE connection_id = ? AND xero_contact_id = ?;
```

**Sync history pagination**:
```sql
-- Use index on started_at DESC
SELECT * FROM xero_sync_logs
WHERE connection_id = ?
ORDER BY started_at DESC
LIMIT 50 OFFSET 0;
```

**Expense categorization**:
```sql
-- Ordered by priority, uses active index
SELECT * FROM xero_expense_category_mappings
WHERE connection_id = ? AND is_active = true
ORDER BY priority ASC;
```

### Index Strategy

- All foreign keys indexed for JOIN performance
- Partial indexes on `is_active = true` for category mappings
- Descending index on `started_at` for sync history pagination
- Unique indexes enforce data integrity (one connection per org)

### Estimated Storage

Per organization with 100 clients, 1000 invoices/month, daily sync:
- `xero_connections`: 1 row × ~500 bytes = 500 bytes
- `xero_sync_logs`: 365 rows/year × ~1 KB = 365 KB/year
- `xero_contact_mappings`: 100 rows × ~200 bytes = 20 KB
- `xero_expense_category_mappings`: 10 rows × ~300 bytes = 3 KB
- `revenue_records` extra fields: 12,000 rows × ~100 bytes = 1.2 MB/year

**Total per org**: ~1.6 MB/year (minimal storage impact)

---

## Security Considerations

### Token Encryption

**Encryption Algorithm**: AES-256-GCM (Web Crypto API)
**Key Storage**: Environment variable `XERO_TOKEN_ENCRYPTION_KEY` (32-byte base64-encoded key)
**Encryption Flow**:
```typescript
// Encrypt before database insert
const encryptedToken = await encryptToken(plainToken, encryptionKey);

// Decrypt only when needed for API calls
const plainToken = await decryptToken(encryptedToken, encryptionKey);
```

### Row Level Security (RLS)

All Xero integration tables enforce organization isolation via RLS policies:
- Users can only access data for their organization
- Service role bypasses RLS for server-side operations
- RLS policies use `auth.uid()` to filter by user's organization

### Audit Trail

All admin actions logged in existing `audit_logs` table:
- Connect/disconnect Xero: `action_type = 'XERO_CONNECT'`
- Manual contact mapping: `action_type = 'XERO_MANUAL_MAPPING'`
- Sync job triggers: Logged in `xero_sync_logs.triggered_by`

---

## Testing Strategy

### Unit Tests

- Token encryption/decryption roundtrip
- Contact mapping tiered matching logic (email → name → fuzzy)
- Expense categorization rule matching
- Error object serialization/deserialization (JSONB)

### Integration Tests

- OAuth flow end-to-end (mock Xero API)
- Sync job execution with error handling
- Database constraints validation (unique indexes, CHECK constraints)
- RLS policy enforcement

### Data Validation Tests

- Token expiry validation (reject past timestamps)
- Sync status transitions (PENDING → RUNNING → SUCCESS/FAILED)
- Duplicate invoice prevention (unique xero_invoice_id constraint)
- Mapping confidence score bounds (0.0-1.0)

---

## Appendix

### Prisma Schema Definitions

```prisma
model XeroConnection {
  id                 String   @id @default(uuid()) @db.Uuid
  organization_id    String   @db.Uuid
  xero_tenant_id     String   @unique
  access_token       String   // Encrypted
  refresh_token      String   // Encrypted
  token_expiry       DateTime
  scopes_granted     String[]
  connection_status  ConnectionStatus @default(ACTIVE)
  last_sync_at       DateTime?
  last_sync_status   SyncStatus?
  created_at         DateTime @default(now())
  updated_at         DateTime @updatedAt

  organization       Organization @relation(fields: [organization_id], references: [id], onDelete: Cascade)
  sync_logs          XeroSyncLog[]
  contact_mappings   XeroContactMapping[]
  expense_mappings   XeroExpenseCategoryMapping[]

  @@unique([organization_id])
  @@index([organization_id])
  @@index([connection_status])
  @@map("xero_connections")
}

model XeroSyncLog {
  id                   String      @id @default(uuid()) @db.Uuid
  connection_id        String      @db.Uuid
  sync_type            SyncType
  status               SyncJobStatus @default(PENDING)
  started_at           DateTime    @default(now())
  completed_at         DateTime?
  duration_ms          Int?
  invoices_processed   Int         @default(0)
  invoices_failed      Int         @default(0)
  expenses_processed   Int         @default(0)
  expenses_failed      Int         @default(0)
  contacts_mapped      Int         @default(0)
  contacts_unmapped    Int         @default(0)
  errors               Json        @default("[]") // Array of SyncError objects
  triggered_by         SyncTrigger
  created_at           DateTime    @default(now())

  connection           XeroConnection @relation(fields: [connection_id], references: [id], onDelete: Cascade)

  @@index([connection_id])
  @@index([status])
  @@index([started_at(sort: Desc)])
  @@index([sync_type])
  @@map("xero_sync_logs")
}

model XeroContactMapping {
  id                 String      @id @default(uuid()) @db.Uuid
  connection_id      String      @db.Uuid
  xero_contact_id    String      @db.Uuid
  xero_contact_name  String
  client_id          String      @db.Uuid
  mapping_type       MappingType
  confidence_score   Float?
  mapped_by_user_id  String?     @db.Uuid
  created_at         DateTime    @default(now())
  updated_at         DateTime    @updatedAt

  connection         XeroConnection @relation(fields: [connection_id], references: [id], onDelete: Cascade)
  client             Client @relation(fields: [client_id], references: [id], onDelete: Cascade)

  @@unique([connection_id, xero_contact_id])
  @@index([connection_id])
  @@index([client_id])
  @@index([mapping_type])
  @@map("xero_contact_mappings")
}

model XeroExpenseCategoryMapping {
  id                    String      @id @default(uuid()) @db.Uuid
  connection_id         String      @db.Uuid
  account_code_pattern  String?
  keyword_pattern       String?
  expense_type          ExpenseType
  priority              Int         @default(100)
  is_active             Boolean     @default(true)
  created_by_user_id    String?     @db.Uuid
  created_at            DateTime    @default(now())
  updated_at            DateTime    @updatedAt

  connection            XeroConnection @relation(fields: [connection_id], references: [id], onDelete: Cascade)

  @@index([connection_id])
  @@index([priority])
  @@index([expense_type])
  @@index([is_active], map: "idx_active_mappings") @where(is_active = true)
  @@map("xero_expense_category_mappings")
}

enum ConnectionStatus {
  ACTIVE
  DISCONNECTED
  TOKEN_EXPIRED
  ERROR
}

enum SyncStatus {
  SUCCESS
  FAILED
  PARTIAL
}

enum SyncType {
  INVOICES
  EXPENSES
  CONTACTS
  FULL
}

enum SyncJobStatus {
  PENDING
  RUNNING
  SUCCESS
  FAILED
  PARTIAL
}

enum SyncTrigger {
  SCHEDULED
  MANUAL
  RETRY
}

enum MappingType {
  EMAIL_EXACT
  NAME_EXACT
  NAME_FUZZY
  MANUAL
}

enum ExpenseType {
  CONTRACTOR
  SUBSCRIPTION
  OVERHEAD
  OTHER
}

enum RevenueSyncStatus {
  SYNCED
  MAPPING_FAILED
  VALIDATION_FAILED
  MANUAL
}

enum ExpenseSyncStatus {
  SYNCED
  CATEGORIZATION_FAILED
  VALIDATION_FAILED
  MANUAL
}
```

### SQL Migration Example

```sql
-- Migration: 001_add_xero_connections.sql
CREATE TABLE xero_connections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  xero_tenant_id VARCHAR(255) NOT NULL UNIQUE,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  token_expiry TIMESTAMP NOT NULL,
  scopes_granted TEXT[] NOT NULL,
  connection_status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE',
  last_sync_at TIMESTAMP,
  last_sync_status VARCHAR(50),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE(organization_id),
  CHECK (token_expiry > created_at)
);

CREATE INDEX idx_xero_connections_org_id ON xero_connections(organization_id);
CREATE INDEX idx_xero_connections_status ON xero_connections(connection_status);
CREATE INDEX idx_xero_connections_tenant_id ON xero_connections(xero_tenant_id);

-- RLS Policy
ALTER TABLE xero_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY xero_connections_org_isolation ON xero_connections
  FOR ALL USING (
    organization_id IN (
      SELECT organization_id FROM user_profiles WHERE user_id = auth.uid()
    )
  );
```

---

**End of Data Model Document**
