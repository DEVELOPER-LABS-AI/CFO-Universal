# Data Model: DevLabs CFO Database Schema

**Feature**: Database Schema
**Version**: 1.0.0
**Last Updated**: 2026-02-12

---

## Complete Prisma Schema

```prisma
// prisma/schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DIRECT_URL")
}

// ============================================================================
// ENUMS
// ============================================================================

enum ClientStatus {
  ACTIVE
  INACTIVE
  CHURNED
}

enum RateType {
  HOURLY
  DAILY
  MONTHLY
}

enum EngagementType {
  FULL_TIME
  PART_TIME
  PROJECT
}

enum RevenueStatus {
  INVOICED
  RECEIVED
}

enum SyncSource {
  XERO
  MERCURY
  MANUAL
  IMPORT
}

enum ExpenseCategory {
  CONTRACTOR_COST
  SUBSCRIPTION
  TOOLS
  PAYROLL
  OVERHEAD
  MARKETING
  OTHER
}

enum OAuthProvider {
  XERO
  SLACK
  MERCURY
}

enum SyncStatus {
  PENDING
  SUCCESS
  FAILED
}

enum TargetScope {
  GLOBAL
  SERVICE
  CLIENT
}

// ============================================================================
// CORE SCHEMA
// ============================================================================

model Organization {
  id                String   @id @default(uuid())
  name              String   @unique
  subscription_tier String   @default("free") // free, pro, enterprise
  created_at        DateTime @default(now())
  updated_at        DateTime @updatedAt

  // Relations
  clients           Client[]
  services          Service[]
  contractors       Contractor[]
  revenue_records   RevenueRecord[]
  expense_records   ExpenseRecord[]
  oauth_tokens      OAuthToken[]
  sync_logs         SyncLog[]
  company_metrics   CompanyMetrics[]
  financial_targets FinancialTarget[]
  growth_scenarios  GrowthScenario[]

  @@map("core_organizations")
}

model Client {
  id                    String        @id @default(uuid())
  organization_id       String
  name                  String
  status                ClientStatus  @default(ACTIVE)
  relationship_type     String?       // "Retainer", "Project", "Hourly"
  custom_margin_target  Decimal?      @db.Decimal(5, 2) // Nullable, overrides service target
  start_date            DateTime
  churn_date            DateTime?
  deleted_at            DateTime?     // Soft delete
  created_at            DateTime      @default(now())
  updated_at            DateTime      @updatedAt

  // Relations
  organization          Organization  @relation(fields: [organization_id], references: [id])
  revenue_records       RevenueRecord[]
  expense_records       ExpenseRecord[]
  contractor_assignments ContractorAssignment[]
  client_metrics        ClientMetrics[]

  @@index([organization_id])
  @@index([status])
  @@index([deleted_at])
  @@map("core_clients")
}

model Service {
  id              String       @id @default(uuid())
  organization_id String
  name            String       // "Web Development", "SEO", "Content Marketing"
  description     String?
  standard_rate   Decimal      @db.Decimal(10, 2) // Hourly or monthly rate
  target_margin   Decimal      @db.Decimal(5, 2)  // Percentage (0-100)
  is_active       Boolean      @default(true)
  deleted_at      DateTime?    // Soft delete
  created_at      DateTime     @default(now())
  updated_at      DateTime     @updatedAt

  // Relations
  organization    Organization @relation(fields: [organization_id], references: [id])
  revenue_records RevenueRecord[]

  @@index([organization_id])
  @@index([is_active])
  @@map("core_services")
}

model Contractor {
  id              String           @id @default(uuid())
  organization_id String
  name            String
  rate            Decimal          @db.Decimal(10, 2)
  rate_type       RateType
  engagement_type EngagementType
  deleted_at      DateTime?        // Soft delete
  created_at      DateTime         @default(now())
  updated_at      DateTime         @updatedAt

  // Relations
  organization    Organization     @relation(fields: [organization_id], references: [id])
  assignments     ContractorAssignment[]
  expense_records ExpenseRecord[]

  @@index([organization_id])
  @@index([deleted_at])
  @@map("core_contractors")
}

model ContractorAssignment {
  id                   String     @id @default(uuid())
  contractor_id        String
  client_id            String
  start_date           DateTime
  end_date             DateTime?
  allocation_percentage Int       @default(100) // 0-100, supports partial allocation
  created_at           DateTime   @default(now())
  updated_at           DateTime   @updatedAt

  // Relations
  contractor           Contractor @relation(fields: [contractor_id], references: [id], onDelete: Cascade)
  client               Client     @relation(fields: [client_id], references: [id], onDelete: Cascade)

  @@index([contractor_id])
  @@index([client_id])
  @@index([start_date, end_date])
  @@map("core_contractor_assignments")
}

// ============================================================================
// FINANCIAL SCHEMA
// ============================================================================

model RevenueRecord {
  id               String         @id @default(uuid())
  organization_id  String
  client_id        String
  service_id       String
  amount           Decimal        @db.Decimal(10, 2)
  transaction_date DateTime
  status           RevenueStatus
  description      String?
  external_id      String?        // ID from source system (Xero invoice ID)
  sync_source      SyncSource     @default(MANUAL)
  created_at       DateTime       @default(now())
  updated_at       DateTime       @updatedAt

  // Relations
  organization     Organization   @relation(fields: [organization_id], references: [id])
  client           Client         @relation(fields: [client_id], references: [id])
  service          Service        @relation(fields: [service_id], references: [id])

  @@index([organization_id])
  @@index([client_id])
  @@index([transaction_date])
  @@index([sync_source, external_id])
  @@map("financial_revenue_records")
}

model ExpenseRecord {
  id               String          @id @default(uuid())
  organization_id  String
  client_id        String?         // Nullable for general expenses
  contractor_id    String?         // Nullable for non-contractor expenses
  amount           Decimal         @db.Decimal(10, 2)
  transaction_date DateTime
  category         ExpenseCategory
  description      String?
  external_id      String?
  sync_source      SyncSource      @default(MANUAL)
  created_at       DateTime        @default(now())
  updated_at       DateTime        @updatedAt

  // Relations
  organization     Organization    @relation(fields: [organization_id], references: [id])
  client           Client?         @relation(fields: [client_id], references: [id])
  contractor       Contractor?     @relation(fields: [contractor_id], references: [id])

  @@index([organization_id])
  @@index([client_id])
  @@index([contractor_id])
  @@index([transaction_date])
  @@index([category])
  @@map("financial_expense_records")
}

// ============================================================================
// ANALYTICS SCHEMA
// ============================================================================

model ClientMetrics {
  id                 String   @id @default(uuid())
  client_id          String
  period_start       DateTime
  period_end         DateTime
  total_revenue      Decimal  @db.Decimal(10, 2)
  total_costs        Decimal  @db.Decimal(10, 2)
  actual_margin      Decimal  @db.Decimal(5, 2)  // Percentage
  target_margin      Decimal  @db.Decimal(5, 2)  // From hierarchical lookup
  tier_classification Int     @db.SmallInt       // 1-5
  calculated_at      DateTime @default(now())
  created_at         DateTime @default(now())
  updated_at         DateTime @updatedAt

  // Relations
  client             Client   @relation(fields: [client_id], references: [id])

  @@index([client_id])
  @@index([period_start, period_end])
  @@index([tier_classification])
  @@map("analytics_client_metrics")
}

model CompanyMetrics {
  id               String       @id @default(uuid())
  organization_id  String
  period_start     DateTime
  period_end       DateTime
  portfolio_margin Decimal      @db.Decimal(5, 2)
  total_revenue    Decimal      @db.Decimal(10, 2)
  total_expenses   Decimal      @db.Decimal(10, 2)
  client_count     Int
  calculated_at    DateTime     @default(now())
  created_at       DateTime     @default(now())
  updated_at       DateTime     @updatedAt

  // Relations
  organization     Organization @relation(fields: [organization_id], references: [id])

  @@index([organization_id])
  @@index([period_start, period_end])
  @@map("analytics_company_metrics")
}

// ============================================================================
// INTEGRATIONS SCHEMA
// ============================================================================

model OAuthToken {
  id                      String        @id @default(uuid())
  organization_id         String
  provider                OAuthProvider
  access_token_encrypted  String        @db.Text  // Encrypted with AES-256
  refresh_token_encrypted String?       @db.Text  // Nullable for non-refreshable tokens
  expires_at              DateTime
  created_at              DateTime      @default(now())
  updated_at              DateTime      @updatedAt

  // Relations
  organization            Organization  @relation(fields: [organization_id], references: [id])

  @@unique([organization_id, provider])
  @@index([expires_at])
  @@map("integrations_oauth_tokens")
}

model SyncLog {
  id                String       @id @default(uuid())
  organization_id   String
  integration_type  String       // "XERO", "MERCURY"
  sync_started_at   DateTime     @default(now())
  sync_completed_at DateTime?
  status            SyncStatus   @default(PENDING)
  records_inserted  Int          @default(0)
  records_updated   Int          @default(0)
  records_failed    Int          @default(0)
  error_message     String?      @db.Text
  created_at        DateTime     @default(now())
  updated_at        DateTime     @updatedAt

  // Relations
  organization      Organization @relation(fields: [organization_id], references: [id])

  @@index([organization_id])
  @@index([integration_type])
  @@index([sync_started_at])
  @@index([status])
  @@map("integrations_sync_logs")
}

// ============================================================================
// SYSTEM SCHEMA
// ============================================================================

model FinancialTarget {
  id              String         @id @default(uuid())
  organization_id String
  scope           TargetScope
  scope_id        String?        // service_id or client_id (nullable for GLOBAL)
  target_margin   Decimal        @db.Decimal(5, 2)
  target_revenue  Decimal?       @db.Decimal(10, 2)
  fiscal_period   String         // "Q1-2026", "FY-2026"
  created_at      DateTime       @default(now())
  updated_at      DateTime       @updatedAt

  // Relations
  organization    Organization   @relation(fields: [organization_id], references: [id])

  @@index([organization_id])
  @@index([scope, scope_id])
  @@index([fiscal_period])
  @@map("system_financial_targets")
}

model GrowthScenario {
  id                 String       @id @default(uuid())
  organization_id    String
  scenario_name      String
  assumptions        Json         // Flexible JSON for headcount, pricing assumptions
  projected_revenue  Decimal      @db.Decimal(10, 2)
  projected_margin   Decimal      @db.Decimal(5, 2)
  created_by         String       // User ID from auth.users
  created_at         DateTime     @default(now())
  updated_at         DateTime     @updatedAt

  // Relations
  organization       Organization @relation(fields: [organization_id], references: [id])

  @@index([organization_id])
  @@index([created_at])
  @@map("system_growth_scenarios")
}
```

---

## Table Descriptions

### Core Schema

| Table | Purpose | Key Relationships |
|-------|---------|-------------------|
| `core_organizations` | Root entity for multi-tenant isolation | Parent of all other entities |
| `core_clients` | Agency clients receiving services | Has revenue, expenses, metrics, contractor assignments |
| `core_services` | Service offerings (Web Dev, SEO, etc.) | Linked to revenue records |
| `core_contractors` | Contractor workforce | Has assignments to clients, expense records |
| `core_contractor_assignments` | M:N junction for contractors ↔ clients | Links contractors to clients with allocation % |

### Financial Schema

| Table | Purpose | Key Relationships |
|-------|---------|-------------------|
| `financial_revenue_records` | All income transactions | Belongs to client, service, organization |
| `financial_expense_records` | All business expenses | Optionally linked to client/contractor |

### Analytics Schema

| Table | Purpose | Key Relationships |
|-------|---------|-------------------|
| `analytics_client_metrics` | Pre-calculated client KPIs | One record per client per period |
| `analytics_company_metrics` | Organization-wide aggregates | One record per organization per period |

### Integrations Schema

| Table | Purpose | Key Relationships |
|-------|---------|-------------------|
| `integrations_oauth_tokens` | Encrypted API credentials | One per org per provider (Xero, Slack, Mercury) |
| `integrations_sync_logs` | Audit trail of data syncs | Tracks all integration sync operations |

### System Schema

| Table | Purpose | Key Relationships |
|-------|---------|-------------------|
| `system_financial_targets` | Hierarchical margin/revenue goals | Scoped to global/service/client levels |
| `system_growth_scenarios` | Simulation results | Stores headcount/pricing "what-if" projections |

---

## Indexes Strategy

**Performance Optimizations:**

1. **Foreign Key Indexes**: All FK columns indexed for JOIN performance
2. **Organization ID**: Indexed on all tables for multi-tenant queries
3. **Transaction Dates**: Indexed for time-range queries (revenue, expenses)
4. **Status Fields**: Indexed for filtering (client_status, sync_status)
5. **Composite Indexes**: Period ranges (period_start, period_end)
6. **Soft Delete**: `deleted_at` indexed for exclusion queries

**Expected Query Patterns:**
- "Show revenue for client X in last 30 days" → `client_id + transaction_date` index
- "List active clients for org Y" → `organization_id + status + deleted_at` index
- "Get latest sync status for Xero" → `integration_type + sync_started_at` index

---

## Validation Rules

### Database-Level Constraints

```sql
-- Decimal precision
ALTER TABLE core_services ADD CONSTRAINT check_target_margin
  CHECK (target_margin >= 0 AND target_margin <= 100);

-- Tier classification range
ALTER TABLE analytics_client_metrics ADD CONSTRAINT check_tier
  CHECK (tier_classification >= 1 AND tier_classification <= 5);

-- Allocation percentage range
ALTER TABLE core_contractor_assignments ADD CONSTRAINT check_allocation
  CHECK (allocation_percentage >= 0 AND allocation_percentage <= 100);

-- Date logic
ALTER TABLE core_contractor_assignments ADD CONSTRAINT check_dates
  CHECK (end_date IS NULL OR end_date >= start_date);
```

### Application-Level Validation (Zod Example)

```typescript
import { z } from 'zod'

export const ClientSchema = z.object({
  name: z.string().min(1, 'Name required'),
  status: z.enum(['ACTIVE', 'INACTIVE', 'CHURNED']),
  custom_margin_target: z.number().min(0).max(100).optional(),
  start_date: z.date(),
  churn_date: z.date().optional(),
})

export const RevenueRecordSchema = z.object({
  amount: z.number().positive('Amount must be > 0'),
  transaction_date: z.date(),
  status: z.enum(['INVOICED', 'RECEIVED']),
  client_id: z.string().uuid(),
  service_id: z.string().uuid(),
})
```

---

## Common Query Patterns

### 1. Get All Active Clients for Organization

```typescript
const activeClients = await prisma.client.findMany({
  where: {
    organization_id: orgId,
    deleted_at: null,
    status: 'ACTIVE'
  },
  include: {
    client_metrics: {
      orderBy: { period_end: 'desc' },
      take: 1 // Latest metrics
    }
  }
})
```

### 2. Calculate Client Revenue for Period

```typescript
const revenue = await prisma.revenueRecord.aggregate({
  where: {
    client_id: clientId,
    transaction_date: {
      gte: periodStart,
      lte: periodEnd
    }
  },
  _sum: { amount: true },
  _count: true
})
```

### 3. Get Contractor Utilization

```typescript
const utilization = await prisma.contractorAssignment.findMany({
  where: {
    contractor_id: contractorId,
    start_date: { lte: new Date() },
    OR: [
      { end_date: null },
      { end_date: { gte: new Date() } }
    ]
  },
  include: { client: true }
})

const totalAllocation = utilization.reduce(
  (sum, a) => sum + a.allocation_percentage, 0
)
```

### 4. Hierarchical Margin Target Lookup

```typescript
async function getTargetMargin(clientId: string): Promise<number> {
  const client = await prisma.client.findUnique({
    where: { id: clientId },
    include: {
      organization: true,
      revenue_records: {
        include: { service: true },
        take: 1
      }
    }
  })

  // Priority: Client → Service → Global
  if (client.custom_margin_target) return client.custom_margin_target

  const service = client.revenue_records[0]?.service
  if (service?.target_margin) return service.target_margin

  const globalTarget = await prisma.financialTarget.findFirst({
    where: {
      organization_id: client.organization_id,
      scope: 'GLOBAL'
    }
  })

  return globalTarget?.target_margin ?? 30 // Default fallback
}
```

---

## Migration Commands

```bash
# Create migration
npx prisma migrate dev --name init_database_schema

# Apply to production
npx prisma migrate deploy

# Reset database (dev only)
npx prisma migrate reset

# Generate Prisma Client
npx prisma generate

# Open database GUI
npx prisma studio
```

---

## Next Steps

1. **Apply Schema**: Run `npx prisma migrate dev`
2. **Generate Client**: Run `npx prisma generate`
3. **Create Seed Data**: Implement `prisma/seed.ts`
4. **Add RLS Policies**: Apply `prisma/rls-policies.sql`
5. **Build API Layer**: Create CRUD operations in Next.js

**Dependencies Unlocked:**
- ✅ Ready for Xero integration (uses oauth_tokens, revenue_records)
- ✅ Ready for Mercury integration (uses expense_records, sync_logs)
- ✅ Ready for analytics engine (uses metrics tables)
- ✅ Ready for dashboard UI (queries all tables)
