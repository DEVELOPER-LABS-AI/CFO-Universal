# Data Model: DevLabs CFO Productization Strategy

**Feature**: 1-cfo-productization
**Created**: 2026-03-13
**Purpose**: Entity definitions, relationships, and validation rules for universal small business CFO platform

---

## Entity Overview

This data model extends the existing DevLabs CFO schema (13 core tables) with new entities required for:
- Multi-business-type configuration (FR-1)
- Profit First allocation system (FR-2)
- Autonomous agent audit trails (FR-6)
- QuickBooks Online integration (FR-8)

---

## 1. Business Configuration Entities

### Entity: BusinessType

**Purpose**: Template definitions for different business types (agencies, consultancies, SaaS, professional services)

**Attributes**:
- `id`: UUID (Primary Key)
- `name`: String (unique, e.g., "Service Agency", "Consulting Firm")
- `code`: String (unique, enum-like: "SERVICE_AGENCY", "CONSULTING_FIRM", "SAAS", "PROFESSIONAL_SERVICES")
- `description`: Text
- `terminology`: JSONB - Maps entity names (client → customer, contractor → vendor)
- `defaultFeatures`: JSONB - Feature entitlements (enable_utilization_tracking, enable_profit_first)
- `calculationStrategies`: JSONB - Margin formulas, cost allocation methods
- `defaultAllocations`: JSONB - Profit First default percentages
- `createdAt`: DateTime
- `updatedAt`: DateTime

**Relationships**:
- One-to-Many with Organization

**Validation Rules**:
- `name` must be unique
- `code` must match pattern `^[A-Z_]+$`
- `terminology` must include required keys: client, vendor, invoice, project
- `defaultFeatures` must be valid JSON object
- Immutable after creation (template data)

**State Transitions**: N/A (seeded data, no lifecycle)

---

### Entity: OrganizationConfiguration

**Purpose**: Organization-specific overrides and customizations

**Attributes**:
- `organizationId`: UUID (Primary Key, FK to Organization)
- `businessTypeId`: UUID (FK to BusinessType)
- `customTerminology`: JSONB (nullable) - Overrides for terminology
- `customFeatures`: JSONB (nullable) - Feature flag overrides
- `customFormulas`: JSONB (nullable) - Custom calculation rules
- `businessTypeLockedAt`: DateTime (nullable) - When business type became immutable
- `canChangeBusinessType`: Boolean (default: true for 7 days, then false)
- `createdAt`: DateTime
- `updatedAt`: DateTime

**Relationships**:
- One-to-One with Organization
- Many-to-One with BusinessType

**Validation Rules**:
- `customTerminology` keys must match BusinessType terminology schema
- `customFeatures` must be subset of available features
- `businessTypeLockedAt` set automatically 7 days after org creation
- Cannot change `businessTypeId` if `businessTypeLockedAt` is set

**State Transitions**:
```
Initial Setup (day 0-7) → canChangeBusinessType = true
After Grace Period (day 8+) → businessTypeLockedAt set, canChangeBusinessType = false
```

---

## 2. Profit First Allocation Entities

### Entity: AllocationTarget

**Purpose**: Target allocation percentages for Profit First categories

**Attributes**:
- `id`: UUID (Primary Key)
- `organizationId`: UUID (FK to Organization)
- `profitPercent`: Decimal(5, 2) - Target % for profit account
- `ownerPayPercent`: Decimal(5, 2) - Target % for owner compensation
- `taxPercent`: Decimal(5, 2) - Target % for tax reserves
- `operatingPercent`: Decimal(5, 2) - Target % for operating expenses
- `effectiveDate`: Date - When this allocation takes effect
- `rolloutPhase`: Integer (nullable) - Graduated rollout phase (Q1=1, Q2=2, etc.)
- `notes`: Text (nullable) - Explanation for allocation changes
- `createdAt`: DateTime
- `updatedAt`: DateTime

**Relationships**:
- Many-to-One with Organization

**Validation Rules**:
- **CONSTRAINT**: `profitPercent + ownerPayPercent + taxPercent + operatingPercent = 100.00`
- All percentage fields >= 0 and <= 100
- `effectiveDate` cannot be in future beyond 30 days
- Cannot have overlapping date ranges for same organization

**State Transitions**:
```
Draft → effectiveDate in future
Active → effectiveDate <= today
Superseded → newer AllocationTarget with later effectiveDate exists
```

---

### Entity: VirtualAccount

**Purpose**: Virtual account balances for Profit First bucketing

**Attributes**:
- `id`: UUID (Primary Key)
- `organizationId`: UUID (FK to Organization)
- `accountType`: Enum('PROFIT', 'OWNER_PAY', 'TAX', 'OPERATING')
- `balance`: Decimal(15, 2) - Current virtual balance
- `bankAccountId`: String (nullable) - If linked to physical account
- `currency`: String(3) - ISO currency code (default: 'USD')
- `lastUpdatedAt`: DateTime - Last balance update
- `createdAt`: DateTime
- `updatedAt`: DateTime

**Relationships**:
- Many-to-One with Organization
- One-to-Many with AllocationTransaction

**Validation Rules**:
- `balance` can be negative (allows overdraft tracking)
- `accountType` must be one of four Profit First categories
- Unique constraint: (organizationId, accountType) - one account per type per org
- `currency` must be valid ISO 4217 code

**State Transitions**: N/A (balances update continuously)

---

### Entity: AllocationTransaction

**Purpose**: Record of each revenue deposit allocation across Profit First categories

**Attributes**:
- `id`: UUID (Primary Key)
- `organizationId`: UUID (FK to Organization)
- `sourceDepositId`: String - External deposit reference (Mercury/bank API)
- `depositAmount`: Decimal(15, 2) - Total deposit amount
- `allocationDate`: DateTime - When allocation was calculated
- `profitAmount`: Decimal(15, 2) - Amount allocated to profit
- `ownerPayAmount`: Decimal(15, 2) - Amount allocated to owner pay
- `taxAmount`: Decimal(15, 2) - Amount allocated to tax
- `operatingAmount`: Decimal(15, 2) - Amount allocated to operating
- `allocationTargetId`: UUID (FK to AllocationTarget) - Which target was used
- `status`: Enum('PENDING', 'ALLOCATED', 'TRANSFERRED')
- `notes`: Text (nullable)
- `createdAt`: DateTime
- `updatedAt`: DateTime

**Relationships**:
- Many-to-One with Organization
- Many-to-One with AllocationTarget
- One-to-Many with AllocationTransfer

**Validation Rules**:
- `depositAmount` must equal sum of four allocation amounts (profitAmount + ownerPayAmount + taxAmount + operatingAmount)
- `depositAmount` > 0
- `allocationDate` <= current timestamp
- Soft delete via `deletedAt` field

**State Transitions**:
```
PENDING → Allocation calculated but not transferred
ALLOCATED → Virtual accounts updated, no physical transfer
TRANSFERRED → Physical bank transfers completed (if multi-account)
```

---

### Entity: CurrentAllocation

**Purpose**: Snapshot of Current Allocation Percentages (CAPs) for monitoring

**Attributes**:
- `id`: UUID (Primary Key)
- `organizationId`: UUID (FK to Organization)
- `calculationDate`: Date
- `profitCAP`: Decimal(5, 2) - Current profit allocation %
- `ownerPayCAP`: Decimal(5, 2) - Current owner pay allocation %
- `taxCAP`: Decimal(5, 2) - Current tax allocation %
- `operatingCAP`: Decimal(5, 2) - Current operating allocation %
- `totalBalance`: Decimal(15, 2) - Sum of all virtual account balances
- `profitTAP`: Decimal(5, 2) - Target profit % (from AllocationTarget)
- `ownerPayTAP`: Decimal(5, 2) - Target owner pay %
- `taxTAP`: Decimal(5, 2) - Target tax %
- `operatingTAP`: Decimal(5, 2) - Target operating %
- `variance`: JSONB - { profit: -2.5, ownerPay: 1.2, ... } (CAP - TAP)
- `createdAt`: DateTime

**Relationships**:
- Many-to-One with Organization
- Unique constraint: (organizationId, calculationDate)

**Validation Rules**:
- CAPs sum to 100% (within 0.01% rounding tolerance)
- `calculationDate` matches creation date
- Calculated daily via scheduled job
- Historical records immutable (no updates after creation)

**State Transitions**: N/A (immutable snapshots)

---

## 3. Agent Audit Entities

### Entity: AgentExecutionLog

**Purpose**: Comprehensive audit trail for autonomous agent actions (DR-5 from spec)

**Attributes**:
- `id`: UUID (Primary Key)
- `organizationId`: UUID (FK to Organization)
- `agentType`: Enum('INVOICE_GENERATOR', 'EXPENSE_CATEGORIZER', 'CASH_FLOW_MONITOR', 'MARGIN_CALCULATOR', 'REVENUE_ATTRIBUTOR')
- `executionTime`: DateTime - When agent started
- `completedAt`: DateTime (nullable) - When agent finished
- `status`: Enum('RUNNING', 'SUCCESS', 'FAILED', 'PARTIAL', 'ROLLED_BACK')
- `actionsTaken`: JSONB - Array of {action, entityType, entityId, oldValue, newValue, confidence, timestamp}
- `errors`: JSONB (nullable) - Array of {message, stack, code}
- `affectedEntities`: JSONB - {EXPENSE_RECORD: 247, INVOICE: 12}
- `rollbackAvailable`: Boolean - Whether rollback is possible
- `rollbackToken`: UUID (nullable, unique) - Token for triggering rollback
- `rollbackExpiresAt`: DateTime (nullable) - 72-hour rollback window
- `rolledBackAt`: DateTime (nullable) - When rollback was performed
- `rolledBackBy`: String (nullable) - User ID who triggered rollback
- `durationMs`: Integer (nullable) - Execution duration in milliseconds
- `recordsProcessed`: Integer (nullable) - Number of records analyzed
- `triggeredBy`: Enum('CRON', 'MANUAL', 'API') - How agent was invoked
- `triggeredByUserId`: String (nullable) - If manual trigger
- `createdAt`: DateTime
- `updatedAt`: DateTime

**Relationships**:
- Many-to-One with Organization

**Validation Rules**:
- `actionsTaken` must be valid JSON array
- `rollbackToken` generated automatically on SUCCESS/PARTIAL status
- `rollbackExpiresAt` set to executionTime + 72 hours
- `durationMs` = completedAt - executionTime
- Retention: 2 years (per DR-5 validation rules)

**State Transitions**:
```
RUNNING → Agent started, no completion yet
  ↓
SUCCESS → All operations completed successfully
PARTIAL → Some operations succeeded, some failed
FAILED → Agent execution failed entirely
  ↓ (if rollback triggered within 72 hours)
ROLLED_BACK → Changes reverted
```

---

## 4. Integration Entities

### Entity: QuickBooksConnection

**Purpose**: OAuth credentials and sync status for QuickBooks Online integration

**Attributes**:
- `id`: UUID (Primary Key)
- `organizationId`: UUID (FK to Organization, unique)
- `realmId`: String - QuickBooks company ID
- `companyName`: String - QuickBooks company name
- `accessToken`: Text (encrypted) - Current access token
- `refreshToken`: Text (encrypted) - Current refresh token
- `accessTokenExpiresAt`: DateTime - Access token expiration
- `refreshTokenExpiresAt`: DateTime - Refresh token expiration (6 months)
- `environment`: Enum('SANDBOX', 'PRODUCTION')
- `scopes`: String[] - Granted OAuth scopes
- `lastSyncAt`: DateTime (nullable) - Last successful sync timestamp
- `lastSyncStatus`: Enum('SUCCESS', 'FAILED', 'PARTIAL', 'PENDING')
- `lastSyncError`: Text (nullable) - Error message from last sync
- `syncFrequency`: String - Cron expression (default: "0 2 * * *" = daily at 2 AM)
- `isActive`: Boolean - Whether sync is enabled
- `createdAt`: DateTime
- `updatedAt`: DateTime
- `deletedAt`: DateTime (nullable, soft delete)

**Relationships**:
- One-to-One with Organization
- One-to-Many with QuickBooksSyncLog

**Validation Rules**:
- `accessToken` and `refreshToken` encrypted using AES-256-GCM (constitution requirement)
- `realmId` must be unique per organization
- `accessTokenExpiresAt` typically 1 hour from token issuance
- `refreshTokenExpiresAt` typically 6 months from token issuance
- Alert user 30 days before refresh token expires

**State Transitions**:
```
Connected (isActive=true, tokens valid)
  ↓
Token Refresh Needed (accessTokenExpiresAt near)
  ↓
Re-authorization Required (refreshTokenExpiresAt < 30 days)
  ↓
Disconnected (isActive=false or deletedAt set)
```

---

### Entity: QuickBooksSyncLog

**Purpose**: Detailed sync history for auditing and troubleshooting

**Attributes**:
- `id`: UUID (Primary Key)
- `connectionId`: UUID (FK to QuickBooksConnection)
- `syncType`: Enum('FULL', 'INCREMENTAL', 'WEBHOOK')
- `startedAt`: DateTime
- `completedAt`: DateTime (nullable)
- `status`: Enum('RUNNING', 'SUCCESS', 'FAILED', 'PARTIAL')
- `entitiesSynced`: JSONB - {Invoice: 45, Expense: 123, Customer: 12}
- `errors`: JSONB (nullable) - Array of error details
- `retryAttempt`: Integer - Retry count (for exponential backoff tracking)
- `triggeredBy`: Enum('CRON', 'MANUAL', 'WEBHOOK')
- `createdAt`: DateTime

**Relationships**:
- Many-to-One with QuickBooksConnection

**Validation Rules**:
- `retryAttempt` max 3 (per spec clarification Q3)
- Retention: 90 days for operational logs, purge older
- `completedAt` must be >= `startedAt`

---

## 5. Existing Entities (Modifications Required)

### Entity: Organization (Modifications)

**New Attributes**:
- `businessTypeId`: UUID (nullable initially, FK to BusinessType)
- `businessTypeLockedAt`: DateTime (nullable) - Set after 7-day grace period
- `subscriptionTier`: Enum('SOLO', 'SMALL_TEAM', 'GROWING_BUSINESS') - Maps to pricing ($99, $199, $399)
- `enableProfitFirst`: Boolean (default: false) - Whether Profit First is activated
- `profitFirstActivatedAt`: DateTime (nullable)

**Relationships** (NEW):
- Many-to-One with BusinessType
- One-to-One with OrganizationConfiguration
- One-to-Many with AllocationTarget
- One-to-Many with VirtualAccount
- One-to-Many with AgentExecutionLog
- One-to-One with QuickBooksConnection

---

### Entity: ExpenseRecord (Modifications)

**New Attributes**:
- `categorizedByAgent`: Boolean (default: false) - Whether AI categorized this expense
- `categorizedAt`: DateTime (nullable) - When categorization occurred
- `categorizationConfidence`: Decimal(3, 2) (nullable) - AI confidence score (0.0-1.0)
- `allocationCategory`: Enum('PROFIT', 'OWNER_PAY', 'TAX', 'OPERATING', 'UNALLOCATED') - Which Profit First bucket
- `agentExecutionLogId`: UUID (nullable, FK to AgentExecutionLog) - Audit trail reference

---

### Entity: RevenueRecord (Modifications)

**New Attributes**:
- `profitFirstAllocated`: Boolean (default: false) - Whether Profit First allocation applied
- `allocationTransactionId`: UUID (nullable, FK to AllocationTransaction) - Reference to allocation

---

## 6. Entity Relationship Diagram

```
BusinessType (Template)
    ↓ (1:N)
Organization
    ├── (1:1) OrganizationConfiguration
    ├── (1:N) AllocationTarget
    ├── (1:N) VirtualAccount
    │       ├── (1:N) AllocationTransaction
    │       └── (1:N) AllocationTransfer
    ├── (1:1) QuickBooksConnection
    │       └── (1:N) QuickBooksSyncLog
    ├── (1:N) AgentExecutionLog
    ├── (1:N) Client (existing)
    ├── (1:N) Staff (existing)
    ├── (1:N) RevenueRecord (modified)
    └── (1:N) ExpenseRecord (modified)
```

---

## 7. Data Volume Estimates

### Initial Launch (Q2 2026 - Agency Edition)

| Entity | Count | Growth Rate |
|--------|-------|-------------|
| Organization | 10 | +5/month |
| BusinessType | 1 (SERVICE_AGENCY) | +1/quarter (as new types added) |
| AllocationTarget | 40 (4 per org avg) | +1 per org per quarter |
| VirtualAccount | 40 (4 per org) | +4 per new org |
| AllocationTransaction | 500 (50 per org) | +50 per org per month |
| AgentExecutionLog | 300 (1 per org per day × 30 days) | +10 per org per month |
| QuickBooksConnection | 3 (30% of orgs) | +30% of new orgs |

### Scale Targets (Q4 2026 - Universal Edition)

| Entity | Count | Growth Rate |
|--------|-------|-------------|
| Organization | 50 | +10/month |
| BusinessType | 4 (AGENCY, CONSULTING, SAAS, PROF_SERVICES) | +1/6 months |
| AllocationTarget | 200 (4 per org avg) | +4 per new org |
| VirtualAccount | 200 (4 per org) | +4 per new org |
| AllocationTransaction | 5,000 (100 per org avg) | +100 per org per month |
| AgentExecutionLog | 3,000 (2 per org per day × 30 days) | +60 per org per month |
| QuickBooksConnection | 25 (50% of orgs) | +50% of new orgs |

### Constitution Compliance (Scalability Target: 1,000 orgs)

At target scale:
- Organizations: 1,000
- AllocationTransactions: 100,000+ (100 per org per month × 12 months)
- AgentExecutionLogs: 720,000+ (2 per org per day × 365 days)
- Performance requirement: <500ms calculations (per spec NFR)

**Optimization Strategy**:
- Partition `allocation_transactions` by year
- Partition `agent_execution_logs` by month
- Archive logs older than 3 years (per spec clarification Q2)
- Use materialized views for CAP calculations

---

## 8. Validation Rules Summary

### Cross-Entity Validation

**Profit First Allocation Integrity**:
```sql
-- Ensure allocation percentages always sum to 100%
ALTER TABLE allocation_targets
  ADD CONSTRAINT allocation_total_check
  CHECK (profit_percent + owner_pay_percent + tax_percent + operating_percent = 100.00);

-- Ensure allocation transaction amounts match
ALTER TABLE allocation_transactions
  ADD CONSTRAINT allocation_amount_check
  CHECK (deposit_amount = profit_amount + owner_pay_amount + tax_amount + operating_amount);
```

**Business Type Configuration Consistency**:
```sql
-- Enforce immutability after grace period
CREATE OR REPLACE FUNCTION check_business_type_lock()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.business_type_locked_at IS NOT NULL AND NEW.business_type_id != OLD.business_type_id THEN
    RAISE EXCEPTION 'Business type is locked after grace period';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER business_type_lock_trigger
  BEFORE UPDATE ON organizations
  FOR EACH ROW
  EXECUTE FUNCTION check_business_type_lock();
```

**Agent Rollback Window**:
```sql
-- Automatically invalidate rollback tokens after 72 hours
CREATE OR REPLACE FUNCTION invalidate_expired_rollbacks()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.rollback_expires_at < NOW() THEN
    NEW.rollback_available := false;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

---

## 9. Index Strategy

```sql
-- Business configuration queries
CREATE INDEX idx_org_business_type ON organizations(business_type_id);
CREATE INDEX idx_org_subscription_tier ON organizations(subscription_tier);

-- Profit First queries
CREATE INDEX idx_allocation_org_date ON allocation_transactions(organization_id, allocation_date DESC);
CREATE INDEX idx_virtual_accounts_org_type ON virtual_accounts(organization_id, account_type);
CREATE INDEX idx_current_allocations_org_date ON current_allocations(organization_id, calculation_date DESC);

-- Agent audit queries
CREATE INDEX idx_agent_logs_org_time ON agent_execution_logs(organization_id, execution_time DESC);
CREATE INDEX idx_agent_logs_status_time ON agent_execution_logs(status, execution_time DESC);
CREATE INDEX idx_agent_logs_rollback ON agent_execution_logs(rollback_token) WHERE rollback_token IS NOT NULL;

-- Integration queries
CREATE INDEX idx_qb_connection_org ON quickbooks_connections(organization_id);
CREATE INDEX idx_qb_connection_realm ON quickbooks_connections(realm_id);
CREATE INDEX idx_qb_sync_logs_conn_time ON quickbooks_sync_logs(connection_id, started_at DESC);
```

---

## 10. Migration Strategy

### Phase 1: Core Configuration (Week 1)
```sql
-- Add to existing schema
ALTER TABLE organizations
  ADD COLUMN business_type_id UUID REFERENCES business_types(id),
  ADD COLUMN business_type_locked_at TIMESTAMP,
  ADD COLUMN subscription_tier VARCHAR(50) DEFAULT 'small_team',
  ADD COLUMN enable_profit_first BOOLEAN DEFAULT false;

CREATE TABLE business_types (...);
CREATE TABLE organization_configurations (...);
```

### Phase 2: Profit First (Week 2-3)
```sql
CREATE TABLE allocation_targets (...);
CREATE TABLE virtual_accounts (...);
CREATE TABLE allocation_transactions (...);
CREATE TABLE current_allocations (...);
```

### Phase 3: Agents (Week 4-5)
```sql
CREATE TABLE agent_execution_logs (...);
ALTER TABLE expense_records
  ADD COLUMN categorized_by_agent BOOLEAN DEFAULT false,
  ADD COLUMN categorization_confidence DECIMAL(3, 2);
```

### Phase 4: QuickBooks (Week 6-8)
```sql
CREATE TABLE quickbooks_connections (...);
CREATE TABLE quickbooks_sync_logs (...);
```

**Rollback Plan**: Each phase is independent, can be rolled back without affecting prior phases.

---

## 11. Soft Delete Pattern

All core entities use soft delete:

```sql
-- Standard soft delete column
ALTER TABLE <table_name> ADD COLUMN deleted_at TIMESTAMP NULL;

-- Queries always filter deleted records
SELECT * FROM allocation_transactions
WHERE organization_id = $1 AND deleted_at IS NULL;

-- Archive old records (>3 years per spec clarification Q2)
UPDATE allocation_transactions
SET deleted_at = NOW()
WHERE allocation_date < NOW() - INTERVAL '3 years';
```

---

## 12. Seed Data

### Business Type Templates (Initial)

```typescript
const businessTypeSeeds = [
  {
    name: 'Service Agency',
    code: 'SERVICE_AGENCY',
    terminology: {
      client: 'Client',
      vendor: 'Contractor',
      invoice: 'Invoice',
      project: 'Project'
    },
    defaultFeatures: {
      enableUtilizationTracking: true,
      enableContractorManagement: true,
      enableProjectCosting: true
    },
    calculationStrategies: {
      marginMethod: 'CONTRIBUTION',
      costAllocationMethod: 'WEIGHTED'
    },
    defaultAllocations: {
      profit: 10,
      ownerPay: 40,
      tax: 20,
      operating: 30
    }
  },
  {
    name: 'Consulting Firm',
    code: 'CONSULTING_FIRM',
    terminology: {
      client: 'Client',
      vendor: 'Vendor',
      invoice: 'Invoice',
      project: 'Engagement'
    },
    defaultFeatures: {
      enableUtilizationTracking: true,
      enableContractorManagement: false,
      enableProjectCosting: true
    },
    calculationStrategies: {
      marginMethod: 'GROSS',
      costAllocationMethod: 'DIRECT'
    },
    defaultAllocations: {
      profit: 15,
      ownerPay: 45,
      tax: 20,
      operating: 20
    }
  },
  {
    name: 'SaaS Company',
    code: 'SAAS',
    terminology: {
      client: 'Customer',
      vendor: 'Vendor',
      invoice: 'Invoice',
      project: 'Feature'
    },
    defaultFeatures: {
      enableUtilizationTracking: false,
      enableContractorManagement: true,
      enableProjectCosting: false
    },
    calculationStrategies: {
      marginMethod: 'NET',
      costAllocationMethod: 'DIRECT'
    },
    defaultAllocations: {
      profit: 5,
      ownerPay: 35,
      tax: 20,
      operating: 40
    }
  },
  {
    name: 'Professional Services',
    code: 'PROFESSIONAL_SERVICES',
    terminology: {
      client: 'Client',
      vendor: 'Vendor',
      invoice: 'Bill',
      project: 'Case'
    },
    defaultFeatures: {
      enableUtilizationTracking: true,
      enableContractorManagement: false,
      enableProjectCosting: true
    },
    calculationStrategies: {
      marginMethod: 'GROSS',
      costAllocationMethod: 'DIRECT'
    },
    defaultAllocations: {
      profit: 10,
      ownerPay: 50,
      tax: 15,
      operating: 25
    }
  }
];
```

---

## Conclusion

Data model provides:
- ✅ Multi-business-type support via templates + org overrides
- ✅ Full Profit First implementation (4 categories, TAP/CAP tracking)
- ✅ Comprehensive agent audit trail with rollback capability
- ✅ QuickBooks Online integration foundation
- ✅ Constitution compliance (Prisma schema, RLS policies, soft deletes)
- ✅ Scalability to 1,000 orgs (per constitution targets)

**Next Step**: Generate API contracts from functional requirements
