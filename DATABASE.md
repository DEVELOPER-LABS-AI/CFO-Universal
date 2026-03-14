# Database Documentation - DevLabs CFO

**Database**: PostgreSQL 15+ (Supabase)
**ORM**: Prisma 7.4.0
**Type Safety**: Full TypeScript support with generated Prisma Client

---

## Overview

The DevLabs CFO database schema is designed for **multi-tenant SaaS** with organization-level data isolation. It supports:

- ✅ **13 tables** across 5 logical schemas
- ✅ **9 enums** for type-safe values
- ✅ **Row Level Security (RLS)** for multi-tenancy
- ✅ **Soft deletes** for core entities (Client, Service, Contractor)
- ✅ **UUID primary keys** for all tables
- ✅ **Encrypted OAuth tokens** for integration security

---

## Schema Organization

### 1. Core Schema (5 tables)
**Purpose**: Fundamental business entities

| Table | Purpose | Key Features |
|-------|---------|--------------|
| `core_organizations` | Root tenant entity | Unique name, subscription tiers |
| `core_clients` | Agency clients | Soft delete, custom margin targets |
| `core_services` | Service offerings | Standard rates, target margins |
| `core_contractors` | Workforce profiles | Hourly/daily rates, engagement types |
| `core_contractor_assignments` | Contractor → Client links | Allocation %, date ranges |

### 2. Financial Schema (2 tables)
**Purpose**: Revenue and expense tracking

| Table | Purpose | Key Features |
|-------|---------|--------------|
| `financial_revenue_records` | All income | Status (invoiced/received), sync source |
| `financial_expense_records` | All expenses | Categories, optional client/contractor link |

### 3. Analytics Schema (2 tables)
**Purpose**: Pre-calculated metrics for fast dashboards

| Table | Purpose | Key Features |
|-------|---------|--------------|
| `analytics_client_metrics` | Client KPIs | Actual margin, target margin, tier (1-5) |
| `analytics_company_metrics` | Company-wide KPIs | Portfolio margin, client count |

### 4. Integrations Schema (2 tables)
**Purpose**: External system connections

| Table | Purpose | Key Features |
|-------|---------|--------------|
| `integrations_oauth_tokens` | API credentials | AES-256 encryption, expiry tracking |
| `integrations_sync_logs` | Sync audit trail | Status, record counts, error messages |

### 5. System Schema (2 tables)
**Purpose**: Configuration and planning

| Table | Purpose | Key Features |
|-------|---------|--------------|
| `system_financial_targets` | Margin/revenue goals | Hierarchical (global/service/client) |
| `system_growth_scenarios` | What-if simulations | JSON assumptions, projections |

---

## Entity Relationships

```
Organization (root)
├── Clients
│   ├── Revenue Records
│   ├── Expense Records
│   ├── Contractor Assignments
│   └── Client Metrics
├── Services
│   └── Revenue Records
├── Contractors
│   ├── Contractor Assignments
│   └── Expense Records
├── OAuth Tokens
├── Sync Logs
├── Company Metrics
├── Financial Targets
└── Growth Scenarios
```

---

## Common Query Patterns

### 1. Get Active Clients with Latest Metrics

```typescript
import prisma from '@/lib/prisma'

const activeClients = await prisma.client.findMany({
  where: {
    organization_id: orgId,
    deleted_at: null, // Soft delete filter (automatic via middleware)
    status: 'ACTIVE',
  },
  include: {
    client_metrics: {
      orderBy: { period_end: 'desc' },
      take: 1, // Latest metrics
    },
  },
})
```

### 2. Calculate Revenue for Period

```typescript
const revenue = await prisma.revenueRecord.aggregate({
  where: {
    client_id: clientId,
    transaction_date: {
      gte: new Date('2025-01-01'),
      lte: new Date('2025-01-31'),
    },
  },
  _sum: { amount: true },
  _count: true,
})

console.log(`Total revenue: $${revenue._sum.amount}`)
console.log(`Transaction count: ${revenue._count}`)
```

### 3. Get Contractor Utilization

```typescript
const utilization = await prisma.contractorAssignment.findMany({
  where: {
    contractor_id: contractorId,
    start_date: { lte: new Date() },
    OR: [
      { end_date: null }, // Ongoing
      { end_date: { gte: new Date() } }, // Future end
    ],
  },
  include: { client: true },
})

const totalAllocation = utilization.reduce(
  (sum, a) => sum + a.allocation_percentage,
  0
)
console.log(`Current utilization: ${totalAllocation}%`)
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
        take: 1,
      },
    },
  })

  // Priority: Client → Service → Global (40% default)
  if (client.custom_margin_target) return client.custom_margin_target.toNumber()

  const service = client.revenue_records[0]?.service
  if (service?.target_margin) return service.target_margin.toNumber()

  const globalTarget = await prisma.financialTarget.findFirst({
    where: {
      organization_id: client.organization_id,
      scope: 'GLOBAL',
    },
  })

  return globalTarget?.target_margin.toNumber() ?? 40 // Fallback
}
```

### 5. Store Encrypted OAuth Token

```typescript
import { encryptToken, decryptToken } from '@/lib/encryption'
import prisma from '@/lib/prisma'

// Encrypt before storing
const encrypted = encryptToken('xero-access-token-abc123')

await prisma.oAuthToken.upsert({
  where: {
    organization_id_provider: {
      organization_id: orgId,
      provider: 'XERO',
    },
  },
  update: {
    access_token_encrypted: encrypted,
    expires_at: new Date(Date.now() + 3600000), // 1 hour
  },
  create: {
    organization_id: orgId,
    provider: 'XERO',
    access_token_encrypted: encrypted,
    expires_at: new Date(Date.now() + 3600000),
  },
})

// Decrypt when retrieving
const token = await prisma.oAuthToken.findUnique({
  where: {
    organization_id_provider: { organization_id: orgId, provider: 'XERO' },
  },
})

const decrypted = decryptToken(token.access_token_encrypted)
// Use decrypted token for API calls
```

---

## Row Level Security (RLS)

### Overview

All tables enforce **organization-level data isolation** via RLS policies. Users can only access data from their organization.

### How It Works

```sql
-- Example policy for core_clients table
CREATE POLICY "org_isolation_clients" ON core_clients
  FOR ALL
  USING (
    organization_id = (
      SELECT organization_id FROM auth.users WHERE id = auth.uid()
    )
  );
```

### Service Role Bypass

Supabase Edge Functions use the **service_role** key to bypass RLS for:
- Scheduled sync jobs (Xero, Mercury)
- Cross-organization admin operations
- Bulk data migrations

**⚠️ NEVER expose service_role key to client-side code!**

### Testing RLS

```sql
-- 1. Check RLS is enabled on all tables
SELECT schemaname, tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND (tablename LIKE 'core_%'
    OR tablename LIKE 'financial_%'
    OR tablename LIKE 'analytics_%'
    OR tablename LIKE 'integrations_%'
    OR tablename LIKE 'system_%');

-- 2. List all policies
SELECT tablename, policyname
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename;

-- 3. Test cross-org access (should return 0)
SELECT COUNT(*) FROM core_clients
WHERE organization_id = '<different-org-id>';
```

---

## Soft Delete Behavior

### Affected Models

Soft deletes apply to: **Client**, **Service**, **Contractor**

### How It Works

The `prisma-middleware.ts` automatically:
1. Converts `delete()` to `update({ deleted_at: new Date() })`
2. Filters out soft-deleted records in queries

### Examples

```typescript
// Delete (actually sets deleted_at)
await prisma.client.delete({ where: { id: clientId } })
// SQL: UPDATE core_clients SET deleted_at = NOW() WHERE id = ?

// Query (excludes soft-deleted)
const clients = await prisma.client.findMany()
// SQL: SELECT * FROM core_clients WHERE deleted_at IS NULL

// Include soft-deleted (bypass middleware)
const allClients = await prisma.client.findMany({
  where: { deleted_at: { not: null } }, // Explicitly include deleted
})
```

---

## Encryption Utilities

### OAuth Token Encryption

Located in: `lib/encryption.ts`

**Algorithm**: AES-256-GCM
**Key Source**: `process.env.ENCRYPTION_KEY` (32-byte hex string)

### Usage

```typescript
import { encryptToken, decryptToken, testEncryption } from '@/lib/encryption'

// Encrypt
const encrypted = encryptToken('secret-token-12345')
// Returns: 'iv:authTag:encrypted' (e.g., '1a2b...:3c4d...:5e6f...')

// Decrypt
const decrypted = decryptToken(encrypted)
// Returns: 'secret-token-12345'

// Test
testEncryption() // Throws error if encryption is broken
```

### Generating Encryption Key

```bash
openssl rand -hex 32
# Output: 3c8f2013371c9b6d0e6fbc21f989d84130d423a3d299946307a290c30e2e339a

# Add to .env
ENCRYPTION_KEY="3c8f2013371c9b6d0e6fbc21f989d84130d423a3d299946307a290c30e2e339a"
```

---

## Performance Considerations

### Indexes

All foreign keys and frequently queried columns are indexed:

```prisma
@@index([organization_id])   // Multi-tenancy queries
@@index([deleted_at])         // Soft delete filtering
@@index([status])             // Status-based filtering
@@index([transaction_date])   // Date range queries
@@index([sync_source, external_id])  // Integration deduplication
```

### Query Performance Targets

| Operation | Target | Notes |
|-----------|--------|-------|
| Client margin calculation | <500ms | Up to 10K transactions |
| Dashboard loading | <2s | Includes all KPIs |
| Soft delete filter | <50ms | Automatic via middleware |

### Optimization Tips

1. **Use Pre-Calculated Metrics**: Query `analytics_client_metrics` instead of aggregating `financial_revenue_records`
2. **Leverage Indexes**: Include `organization_id` in all multi-tenant queries
3. **Connection Pooling**: Use `DATABASE_URL` with pgBouncer (port 6543) for pooling
4. **Direct Connections**: Use `DIRECT_URL` (port 5432) for migrations only

---

## Prisma Commands

### Development

```bash
# Format schema
npx prisma format

# Validate schema
npx prisma validate

# Generate Prisma Client
npx prisma generate

# Create migration
npx prisma migrate dev --name description

# Open database GUI
npx prisma studio

# Seed database
npx prisma db seed
```

### Production

```bash
# Apply migrations
npx prisma migrate deploy

# Reset database (dev only - destructive!)
npx prisma migrate reset
```

---

## Troubleshooting

### Connection Issues

**Error**: `Can't reach database server`

**Solution**: Check DATABASE_URL in .env:
```env
DATABASE_URL="postgres://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:6543/postgres?pgbouncer=true"
```

### Migration Conflicts

**Error**: `Migration conflicts detected`

**Solution**: Reset migrations (dev only):
```bash
npx prisma migrate reset
npx prisma migrate dev
```

### Soft Delete Not Working

**Issue**: Deleted records still appear

**Check**:
1. Middleware applied in `lib/prisma.ts`?
2. Using Prisma Client from `lib/prisma.ts` (not raw `new PrismaClient()`)?

### RLS Blocking Queries

**Issue**: Queries return empty results

**Check**:
1. User's `organization_id` set correctly in `auth.users`?
2. Using correct Supabase client (anon key for users, service role for admin)?
3. RLS policies match your auth structure?

---

## Next Steps

1. **Manual Migration**: Apply Prisma schema to Supabase
   ```bash
   # Option 1: Let Prisma handle it
   npx prisma migrate dev --name init

   # Option 2: Manual SQL
   # Copy generated SQL from prisma/migrations/ to Supabase SQL Editor
   ```

2. **Apply RLS Policies**: Execute `prisma/rls-policies.sql` in Supabase

3. **Seed Test Data**: Run `npx prisma db seed`

4. **Verify**: Open Prisma Studio `npx prisma studio`

---

## Resources

- **Prisma Docs**: https://www.prisma.io/docs
- **Supabase RLS Guide**: https://supabase.com/docs/guides/auth/row-level-security
- **Schema File**: [`prisma/schema.prisma`](./prisma/schema.prisma)
- **RLS Policies**: [`prisma/rls-policies.sql`](./prisma/rls-policies.sql)
- **Seed Script**: [`prisma/seed.ts`](./prisma/seed.ts)
- **Encryption Utils**: [`lib/encryption.ts`](./lib/encryption.ts)
- **Soft Delete Middleware**: [`lib/prisma-middleware.ts`](./lib/prisma-middleware.ts)
