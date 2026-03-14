# Data Model: Mercury Banking Integration

**Created**: 2026-02-15
**Purpose**: Database schema design for Mercury integration
**Status**: Ready for Implementation

---

## Overview

This document defines the database schema for Mercury Bank integration, including connection storage, sync logging, merchant mapping, categorization rules, and balance history tracking.

---

## Entity Relationship Diagram

```
organizations (existing)
    ↓ 1:N
mercury_connections
    ↓ 1:N
mercury_sync_logs

mercury_connections
    ↓ 1:N
merchant_mapping_cache

organizations
    ↓ 1:N
transaction_categorization_rules

mercury_connections
    ↓ 1:N
account_balance_history

expense_records (existing, updated)
    ← mercury_transaction_id (foreign key to Mercury API)
```

---

## New Entities

### 1. mercury_connections

**Purpose**: Store encrypted Mercury API keys and connection metadata

**Fields**:

| Field Name | Type | Constraints | Description |
|------------|------|-------------|-------------|
| id | UUID | PRIMARY KEY | Unique connection identifier |
| organization_id | UUID | FOREIGN KEY → organizations, NOT NULL | Organization owning connection |
| api_key_encrypted | TEXT | NOT NULL | AES-256-GCM encrypted API key |
| connection_status | ENUM | NOT NULL, DEFAULT 'ACTIVE' | ACTIVE, DISCONNECTED, API_ERROR |
| last_sync_at | TIMESTAMPTZ | NULL | Timestamp of last successful sync |
| last_sync_status | ENUM | NULL | SUCCESS, FAILED, PARTIAL |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | Connection creation timestamp |
| updated_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | Last update timestamp |
| deleted_at | TIMESTAMPTZ | NULL | Soft delete timestamp |

**Enums**:
```prisma
enum MercuryConnectionStatus {
  ACTIVE         // API key valid, ready to sync
  DISCONNECTED   // User disconnected manually
  API_ERROR      // API key invalid or revoked
}

enum SyncStatus {
  SUCCESS  // All transactions synced successfully
  FAILED   // Sync completely failed
  PARTIAL  // Some transactions synced, some failed
}
```

**Indexes**:
```sql
CREATE UNIQUE INDEX idx_mercury_org_active
  ON mercury_connections(organization_id)
  WHERE connection_status = 'ACTIVE' AND deleted_at IS NULL;

CREATE INDEX idx_mercury_last_sync
  ON mercury_connections(last_sync_at DESC);
```

**Validation Rules**:
- One ACTIVE connection per organization (unique index enforced)
- api_key_encrypted must not be empty string
- last_sync_at can only be updated when sync succeeds
- Soft delete sets connection_status to DISCONNECTED

**RLS Policy**:
```sql
-- Users can only view/manage their organization's connections
CREATE POLICY "mercury_connections_org_isolation"
  ON mercury_connections
  USING (organization_id IN (
    SELECT organization_id FROM user_organizations WHERE user_id = auth.uid()
  ));
```

---

### 2. mercury_sync_logs

**Purpose**: Audit trail of all Mercury sync operations

**Fields**:

| Field Name | Type | Constraints | Description |
|------------|------|-------------|-------------|
| id | UUID | PRIMARY KEY | Unique sync log identifier |
| connection_id | UUID | FOREIGN KEY → mercury_connections, NOT NULL | Connection that performed sync |
| sync_type | ENUM | NOT NULL | TRANSACTIONS, BALANCES, FULL |
| status | ENUM | NOT NULL, DEFAULT 'PENDING' | PENDING, RUNNING, SUCCESS, FAILED, PARTIAL |
| started_at | TIMESTAMPTZ | NOT NULL | Sync start timestamp |
| completed_at | TIMESTAMPTZ | NULL | Sync completion timestamp |
| duration_ms | INTEGER | NULL | Sync duration in milliseconds |
| transactions_processed | INTEGER | DEFAULT 0 | Count of transactions processed |
| transactions_failed | INTEGER | DEFAULT 0 | Count of transactions that failed |
| balances_updated | INTEGER | DEFAULT 0 | Count of account balances updated |
| errors | JSONB | NULL | Array of error objects with details |
| triggered_by | ENUM | NOT NULL | SYSTEM, MANUAL, RETRY |
| triggered_by_user_id | UUID | FOREIGN KEY → users, NULL | User who triggered manual sync |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | Log creation timestamp |

**Enums**:
```prisma
enum MercurySyncType {
  TRANSACTIONS  // Only sync transactions
  BALANCES      // Only sync account balances
  FULL          // Sync transactions + balances
}

enum MercurySyncStatus {
  PENDING   // Sync queued, not started
  RUNNING   // Sync in progress
  SUCCESS   // All operations completed successfully
  FAILED    // Sync completely failed
  PARTIAL   // Some operations succeeded, some failed
}

enum SyncTrigger {
  SYSTEM  // Scheduled cron job
  MANUAL  // User-initiated via dashboard
  RETRY   // Retry of previously failed sync
}
```

**Error Object Schema** (JSONB):
```typescript
interface SyncError {
  type: 'API_ERROR' | 'MAPPING_FAILURE' | 'CATEGORIZATION_FAILURE' | 'VALIDATION_ERROR' | 'RATE_LIMIT';
  message: string;
  context?: {
    transaction_id?: string;
    merchant_name?: string;
    http_status?: number;
    retry_count?: number;
  };
  timestamp: string;  // ISO 8601
}
```

**Indexes**:
```sql
CREATE INDEX idx_sync_logs_connection
  ON mercury_sync_logs(connection_id, started_at DESC);

CREATE INDEX idx_sync_logs_status
  ON mercury_sync_logs(status, started_at DESC);

CREATE INDEX idx_sync_logs_errors
  ON mercury_sync_logs USING GIN(errors);  -- For JSONB querying
```

**Validation Rules**:
- completed_at must be after started_at
- duration_ms = EXTRACT(EPOCH FROM (completed_at - started_at)) * 1000
- status transitions: PENDING → RUNNING → (SUCCESS | FAILED | PARTIAL)
- errors required if status is FAILED or PARTIAL

**RLS Policy**:
```sql
-- Users can only view sync logs for their organization's connections
CREATE POLICY "mercury_sync_logs_org_isolation"
  ON mercury_sync_logs
  USING (connection_id IN (
    SELECT id FROM mercury_connections
    WHERE organization_id IN (
      SELECT organization_id FROM user_organizations WHERE user_id = auth.uid()
    )
  ));
```

---

### 3. merchant_mapping_cache

**Purpose**: Cache merchant-to-contractor mappings for fast lookup and learning

**Fields**:

| Field Name | Type | Constraints | Description |
|------------|------|-------------|-------------|
| id | UUID | PRIMARY KEY | Unique mapping identifier |
| connection_id | UUID | FOREIGN KEY → mercury_connections, NOT NULL | Connection this mapping belongs to |
| mercury_merchant_name | TEXT | NOT NULL | Merchant name as appears in Mercury |
| normalized_merchant_name | TEXT | NOT NULL | Lowercased, trimmed, special chars removed |
| contractor_id | UUID | FOREIGN KEY → contractors, NULL | Mapped contractor (NULL if unmapped) |
| mapping_confidence | ENUM | NOT NULL | EXACT, FUZZY, MANUAL |
| confidence_score | DECIMAL(3,2) | NULL | Similarity score (0.00-1.00) for FUZZY |
| mapped_by | ENUM | NOT NULL | SYSTEM, ADMIN_USER |
| mapped_by_user_id | UUID | FOREIGN KEY → users, NULL | User who created manual mapping |
| mapped_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | Mapping creation timestamp |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | Record creation timestamp |

**Enums**:
```prisma
enum MappingConfidence {
  EXACT   // Exact name match (95% confidence)
  FUZZY   // Fuzzy name match >0.85 similarity (85% confidence)
  MANUAL  // Admin manually mapped (100% confidence)
}

enum MappingSource {
  SYSTEM      // Automatically mapped by system
  ADMIN_USER  // Manually mapped by admin
}
```

**Indexes**:
```sql
-- Fast lookup by merchant name
CREATE UNIQUE INDEX idx_merchant_mapping_name
  ON merchant_mapping_cache(connection_id, normalized_merchant_name);

-- Find unmapped merchants
CREATE INDEX idx_merchant_unmapped
  ON merchant_mapping_cache(connection_id)
  WHERE contractor_id IS NULL;

-- Find low-confidence mappings for review
CREATE INDEX idx_merchant_low_confidence
  ON merchant_mapping_cache(connection_id, confidence_score)
  WHERE mapping_confidence = 'FUZZY' AND confidence_score < 0.90;
```

**Validation Rules**:
- contractor_id NULL allowed (unmapped merchants)
- confidence_score required if mapping_confidence = 'FUZZY'
- confidence_score must be between 0.00 and 1.00
- Manual mappings override system mappings

**RLS Policy**:
```sql
CREATE POLICY "merchant_mapping_org_isolation"
  ON merchant_mapping_cache
  USING (connection_id IN (
    SELECT id FROM mercury_connections
    WHERE organization_id IN (
      SELECT organization_id FROM user_organizations WHERE user_id = auth.uid()
    )
  ));
```

---

### 4. transaction_categorization_rules

**Purpose**: Admin-defined patterns for auto-categorizing transactions

**Fields**:

| Field Name | Type | Constraints | Description |
|------------|------|-------------|-------------|
| id | UUID | PRIMARY KEY | Unique rule identifier |
| organization_id | UUID | FOREIGN KEY → organizations, NOT NULL | Organization owning rule |
| rule_type | ENUM | NOT NULL | MERCHANT_NAME, DESCRIPTION_KEYWORD, AMOUNT_RANGE |
| pattern | TEXT | NOT NULL | Regex or exact match string |
| category | ENUM | NOT NULL | CONTRACTOR, SUBSCRIPTION, OVERHEAD, PAYROLL, OTHER |
| priority | INTEGER | NOT NULL, DEFAULT 100 | Higher priority evaluated first |
| is_active | BOOLEAN | NOT NULL, DEFAULT TRUE | Enable/disable rule |
| created_by_user_id | UUID | FOREIGN KEY → users, NOT NULL | User who created rule |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | Rule creation timestamp |
| updated_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | Last update timestamp |

**Enums**:
```prisma
enum CategorizationRuleType {
  MERCHANT_NAME        // Match on merchant name (e.g., "AWS")
  DESCRIPTION_KEYWORD  // Match on transaction description (e.g., "rent")
  AMOUNT_RANGE         // Match on transaction amount (e.g., "$1000-$2000")
}

enum ExpenseCategory {
  CONTRACTOR    // Payment to contractor/vendor
  SUBSCRIPTION  // SaaS, software licenses
  OVERHEAD      // Rent, utilities, insurance
  PAYROLL       // Salaries, wages
  OTHER         // Uncategorized
}
```

**Example Rules**:
```sql
-- AWS charges → SUBSCRIPTION
INSERT INTO transaction_categorization_rules (organization_id, rule_type, pattern, category, priority)
VALUES ('org-123', 'MERCHANT_NAME', 'aws|amazon web services', 'SUBSCRIPTION', 100);

-- Rent payments → OVERHEAD
INSERT INTO transaction_categorization_rules (organization_id, rule_type, pattern, category, priority)
VALUES ('org-123', 'DESCRIPTION_KEYWORD', 'rent|lease', 'OVERHEAD', 90);

-- Contractor payments > $1000 → CONTRACTOR
INSERT INTO transaction_categorization_rules (organization_id, rule_type, pattern, category, priority)
VALUES ('org-123', 'AMOUNT_RANGE', '1000-999999', 'CONTRACTOR', 80);
```

**Indexes**:
```sql
-- Query by organization and priority
CREATE INDEX idx_categorization_rules_org_priority
  ON transaction_categorization_rules(organization_id, priority DESC)
  WHERE is_active = TRUE;

-- Query by category
CREATE INDEX idx_categorization_rules_category
  ON transaction_categorization_rules(organization_id, category)
  WHERE is_active = TRUE;
```

**Validation Rules**:
- pattern must be valid regex if rule_type is MERCHANT_NAME or DESCRIPTION_KEYWORD
- pattern must be format "min-max" if rule_type is AMOUNT_RANGE
- priority must be positive integer (1-1000)
- category must be valid ExpenseCategory enum value

**RLS Policy**:
```sql
CREATE POLICY "categorization_rules_org_isolation"
  ON transaction_categorization_rules
  USING (organization_id IN (
    SELECT organization_id FROM user_organizations WHERE user_id = auth.uid()
  ));
```

---

### 5. account_balance_history

**Purpose**: Daily snapshots of Mercury account balances for trend analysis

**Fields**:

| Field Name | Type | Constraints | Description |
|------------|------|-------------|-------------|
| id | UUID | PRIMARY KEY | Unique snapshot identifier |
| connection_id | UUID | FOREIGN KEY → mercury_connections, NOT NULL | Connection this account belongs to |
| mercury_account_id | TEXT | NOT NULL | Mercury's account identifier |
| account_name | TEXT | NOT NULL | Account name (e.g., "Business Checking") |
| account_type | ENUM | NOT NULL | CHECKING, SAVINGS, TREASURY |
| current_balance | DECIMAL(12,2) | NOT NULL | Balance including pending transactions |
| available_balance | DECIMAL(12,2) | NOT NULL | Balance available for withdrawal |
| snapshot_date | DATE | NOT NULL | Date of snapshot (UTC) |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | Snapshot creation timestamp |

**Enums**:
```prisma
enum MercuryAccountType {
  CHECKING  // Standard business checking
  SAVINGS   // Interest-bearing savings
  TREASURY  // High-yield treasury (>$250k)
}
```

**Indexes**:
```sql
-- One snapshot per account per day
CREATE UNIQUE INDEX idx_balance_history_account_date
  ON account_balance_history(connection_id, mercury_account_id, snapshot_date);

-- Query by connection and date range
CREATE INDEX idx_balance_history_date_range
  ON account_balance_history(connection_id, snapshot_date DESC);

-- Query by account type
CREATE INDEX idx_balance_history_account_type
  ON account_balance_history(connection_id, account_type, snapshot_date DESC);
```

**Validation Rules**:
- snapshot_date must not be in future
- current_balance >= 0 (accounts can't have negative balance)
- available_balance <= current_balance (available can't exceed current)
- One snapshot per account per day (unique index enforced)

**RLS Policy**:
```sql
CREATE POLICY "balance_history_org_isolation"
  ON account_balance_history
  USING (connection_id IN (
    SELECT id FROM mercury_connections
    WHERE organization_id IN (
      SELECT organization_id FROM user_organizations WHERE user_id = auth.uid()
    )
  ));
```

---

## Updated Entities

### expense_records (existing table, new fields)

**New Fields**:

| Field Name | Type | Constraints | Description |
|------------|------|-------------|-------------|
| mercury_transaction_id | TEXT | NULL, UNIQUE | Mercury transaction ID (for deduplication) |
| merchant_name | TEXT | NULL | Merchant/counterparty name from Mercury |
| categorization_confidence | DECIMAL(3,2) | NULL | Confidence score (0.00-1.00) |
| sync_status | ENUM | NULL | SYNCED, CATEGORIZATION_FAILED, MAPPING_FAILED |

**Enums** (add to existing ExpenseRecordSyncStatus):
```prisma
enum ExpenseRecordSyncStatus {
  MANUAL                  // Manually entered (not synced)
  SYNCED                  // Successfully synced from Mercury
  CATEGORIZATION_FAILED   // Synced but couldn't categorize
  MAPPING_FAILED          // Synced but couldn't map merchant to contractor
}
```

**Indexes**:
```sql
-- Unique constraint on Mercury transaction ID
CREATE UNIQUE INDEX idx_expense_mercury_tx
  ON expense_records(mercury_transaction_id)
  WHERE mercury_transaction_id IS NOT NULL;

-- Query by sync status
CREATE INDEX idx_expense_sync_status
  ON expense_records(sync_status)
  WHERE sync_status IN ('CATEGORIZATION_FAILED', 'MAPPING_FAILED');
```

**Validation Rules**:
- If mercury_transaction_id NOT NULL, must be synced from Mercury
- If sync_status = 'CATEGORIZATION_FAILED', category should be 'OTHER'
- If sync_status = 'MAPPING_FAILED', contractor_id should be NULL
- categorization_confidence between 0.00 and 1.00

---

## Prisma Schema Additions

```prisma
// ============================================================================
// Mercury Banking Integration
// ============================================================================

model MercuryConnection {
  id                  String   @id @default(uuid())
  organization_id     String
  organization        Organization @relation(fields: [organization_id], references: [id], onDelete: Cascade)

  api_key_encrypted   String   @db.Text
  connection_status   MercuryConnectionStatus @default(ACTIVE)
  last_sync_at        DateTime?
  last_sync_status    SyncStatus?

  created_at          DateTime @default(now())
  updated_at          DateTime @updatedAt
  deleted_at          DateTime?

  // Relationships
  sync_logs           MercurySyncLog[]
  merchant_mappings   MerchantMappingCache[]
  balance_history     AccountBalanceHistory[]

  @@unique([organization_id], where: { connection_status: ACTIVE, deleted_at: null })
  @@index([last_sync_at(sort: Desc)])
  @@map("mercury_connections")
}

model MercurySyncLog {
  id                      String   @id @default(uuid())
  connection_id           String
  connection              MercuryConnection @relation(fields: [connection_id], references: [id], onDelete: Cascade)

  sync_type               MercurySyncType
  status                  MercurySyncStatus @default(PENDING)
  started_at              DateTime
  completed_at            DateTime?
  duration_ms             Int?
  transactions_processed  Int      @default(0)
  transactions_failed     Int      @default(0)
  balances_updated        Int      @default(0)
  errors                  Json?    // Array of SyncError objects
  triggered_by            SyncTrigger
  triggered_by_user_id    String?

  created_at              DateTime @default(now())

  @@index([connection_id, started_at(sort: Desc)])
  @@index([status, started_at(sort: Desc)])
  @@map("mercury_sync_logs")
}

model MerchantMappingCache {
  id                        String   @id @default(uuid())
  connection_id             String
  connection                MercuryConnection @relation(fields: [connection_id], references: [id], onDelete: Cascade)

  mercury_merchant_name     String
  normalized_merchant_name  String
  contractor_id             String?
  contractor                Contractor? @relation(fields: [contractor_id], references: [id], onDelete: SetNull)

  mapping_confidence        MappingConfidence
  confidence_score          Decimal? @db.Decimal(3, 2)
  mapped_by                 MappingSource
  mapped_by_user_id         String?
  mapped_at                 DateTime @default(now())

  created_at                DateTime @default(now())

  @@unique([connection_id, normalized_merchant_name])
  @@index([connection_id], where: { contractor_id: null })
  @@map("merchant_mapping_cache")
}

model TransactionCategorizationRule {
  id                  String   @id @default(uuid())
  organization_id     String
  organization        Organization @relation(fields: [organization_id], references: [id], onDelete: Cascade)

  rule_type           CategorizationRuleType
  pattern             String
  category            ExpenseCategory
  priority            Int      @default(100)
  is_active           Boolean  @default(true)

  created_by_user_id  String
  created_at          DateTime @default(now())
  updated_at          DateTime @updatedAt

  @@index([organization_id, priority(sort: Desc)], where: { is_active: true })
  @@map("transaction_categorization_rules")
}

model AccountBalanceHistory {
  id                   String   @id @default(uuid())
  connection_id        String
  connection           MercuryConnection @relation(fields: [connection_id], references: [id], onDelete: Cascade)

  mercury_account_id   String
  account_name         String
  account_type         MercuryAccountType
  current_balance      Decimal  @db.Decimal(12, 2)
  available_balance    Decimal  @db.Decimal(12, 2)
  snapshot_date        DateTime @db.Date

  created_at           DateTime @default(now())

  @@unique([connection_id, mercury_account_id, snapshot_date])
  @@index([connection_id, snapshot_date(sort: Desc)])
  @@map("account_balance_history")
}

// ============================================================================
// Enums
// ============================================================================

enum MercuryConnectionStatus {
  ACTIVE
  DISCONNECTED
  API_ERROR
}

enum MercurySyncType {
  TRANSACTIONS
  BALANCES
  FULL
}

enum MercurySyncStatus {
  PENDING
  RUNNING
  SUCCESS
  FAILED
  PARTIAL
}

enum SyncTrigger {
  SYSTEM
  MANUAL
  RETRY
}

enum MappingConfidence {
  EXACT
  FUZZY
  MANUAL
}

enum MappingSource {
  SYSTEM
  ADMIN_USER
}

enum CategorizationRuleType {
  MERCHANT_NAME
  DESCRIPTION_KEYWORD
  AMOUNT_RANGE
}

enum MercuryAccountType {
  CHECKING
  SAVINGS
  TREASURY
}

// Update existing ExpenseRecord model
model ExpenseRecord {
  // ... existing fields ...

  // Mercury-specific fields
  mercury_transaction_id       String?  @unique
  merchant_name                String?
  categorization_confidence    Decimal? @db.Decimal(3, 2)
  sync_status                  ExpenseRecordSyncStatus?

  @@index([sync_status], where: { sync_status: IN [CATEGORIZATION_FAILED, MAPPING_FAILED] })
}

enum ExpenseRecordSyncStatus {
  MANUAL
  SYNCED
  CATEGORIZATION_FAILED
  MAPPING_FAILED
}
```

---

## Migration Strategy

### Step 1: Create Enums
```sql
CREATE TYPE mercury_connection_status AS ENUM ('ACTIVE', 'DISCONNECTED', 'API_ERROR');
CREATE TYPE mercury_sync_type AS ENUM ('TRANSACTIONS', 'BALANCES', 'FULL');
CREATE TYPE mercury_sync_status AS ENUM ('PENDING', 'RUNNING', 'SUCCESS', 'FAILED', 'PARTIAL');
CREATE TYPE sync_trigger AS ENUM ('SYSTEM', 'MANUAL', 'RETRY');
CREATE TYPE mapping_confidence AS ENUM ('EXACT', 'FUZZY', 'MANUAL');
CREATE TYPE mapping_source AS ENUM ('SYSTEM', 'ADMIN_USER');
CREATE TYPE categorization_rule_type AS ENUM ('MERCHANT_NAME', 'DESCRIPTION_KEYWORD', 'AMOUNT_RANGE');
CREATE TYPE mercury_account_type AS ENUM ('CHECKING', 'SAVINGS', 'TREASURY');
CREATE TYPE expense_record_sync_status AS ENUM ('MANUAL', 'SYNCED', 'CATEGORIZATION_FAILED', 'MAPPING_FAILED');
```

### Step 2: Create Tables (order matters for foreign keys)
1. mercury_connections
2. mercury_sync_logs
3. merchant_mapping_cache
4. transaction_categorization_rules
5. account_balance_history

### Step 3: Update Existing Tables
```sql
ALTER TABLE expense_records
ADD COLUMN mercury_transaction_id TEXT,
ADD COLUMN merchant_name TEXT,
ADD COLUMN categorization_confidence DECIMAL(3,2),
ADD COLUMN sync_status expense_record_sync_status;

CREATE UNIQUE INDEX idx_expense_mercury_tx
  ON expense_records(mercury_transaction_id)
  WHERE mercury_transaction_id IS NOT NULL;
```

### Step 4: Apply RLS Policies
See RLS policy definitions above for each table.

### Step 5: Seed Default Categorization Rules
```sql
-- Default rules for common expense patterns
INSERT INTO transaction_categorization_rules (organization_id, rule_type, pattern, category, priority)
SELECT id, 'MERCHANT_NAME', 'aws|amazon web services|vercel|netlify|heroku', 'SUBSCRIPTION', 100
FROM organizations;

INSERT INTO transaction_categorization_rules (organization_id, rule_type, pattern, category, priority)
SELECT id, 'DESCRIPTION_KEYWORD', 'rent|lease', 'OVERHEAD', 90
FROM organizations;

-- Add more default rules as needed
```

---

## Data Integrity Constraints

### Foreign Key Cascades

- **mercury_connections → organizations**: CASCADE (delete connection if org deleted)
- **mercury_sync_logs → mercury_connections**: CASCADE (delete logs if connection deleted)
- **merchant_mapping_cache → mercury_connections**: CASCADE
- **merchant_mapping_cache → contractors**: SET NULL (preserve mapping if contractor deleted)
- **transaction_categorization_rules → organizations**: CASCADE
- **account_balance_history → mercury_connections**: CASCADE

### Soft Deletes

- **mercury_connections**: Soft delete supported (deleted_at timestamp)
- **Other tables**: Hard delete (sync logs are immutable audit trail)

### Data Retention

- **mercury_sync_logs**: Retain for 90 days minimum (configurable up to 7 years for compliance)
- **merchant_mapping_cache**: Retain indefinitely (learning improves over time)
- **account_balance_history**: Retain for 7 years (tax compliance)

---

## Next Steps

1. Generate Prisma migration: `npx prisma migrate dev --name add_mercury_integration`
2. Apply migration to Supabase: `npx prisma migrate deploy`
3. Verify RLS policies in Supabase dashboard
4. Seed default categorization rules
5. Generate Prisma client: `npx prisma generate`

**Data model complete** ✅
