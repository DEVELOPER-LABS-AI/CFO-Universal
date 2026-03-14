# Quickstart: Database Schema Implementation

**Feature**: Database Schema for DevLabs CFO
**Time to Complete**: ~30 minutes (setup) + 3-5 days (full implementation)

---

## Prerequisites

- ✅ Supabase project created ([app.supabase.com](https://app.supabase.com))
- ✅ Node.js 20+ installed
- ✅ Database connection string from Supabase dashboard
- ✅ Encryption key generated (`openssl rand -hex 32`)

---

## Quick Setup (5 Steps)

### Step 1: Install Prisma

```bash
npm install @prisma/client
npm install -D prisma
npx prisma init
```

**Output**: Creates `prisma/schema.prisma` and `.env` files

### Step 2: Configure Database Connection

Add to `.env`:

```env
# Supabase Connection Strings
DATABASE_URL="postgres://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:6543/postgres?pgbouncer=true"
DIRECT_URL="postgres://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres"

# Encryption Key (generate with: openssl rand -hex 32)
ENCRYPTION_KEY="your-32-byte-hex-key-here"
```

**Replace**:
- `[PASSWORD]` with your Supabase database password
- `[PROJECT-REF]` with your Supabase project reference ID

### Step 3: Copy Prisma Schema

Copy the complete schema from [data-model.md](./data-model.md) into `prisma/schema.prisma`.

**Verify**:
```bash
npx prisma format
npx prisma validate
```

### Step 4: Run Initial Migration

```bash
npx prisma migrate dev --name init_database_schema
```

**What happens**:
- ✅ Generates SQL migration file
- ✅ Creates all 13 tables in Supabase
- ✅ Creates indexes and constraints
- ✅ Applies migration to database

**Verify in Supabase Studio**:
- Go to Table Editor
- Confirm all tables created:
  - `core_organizations`
  - `core_clients`
  - `core_services`
  - `core_contractors`
  - `core_contractor_assignments`
  - `financial_revenue_records`
  - `financial_expense_records`
  - `analytics_client_metrics`
  - `analytics_company_metrics`
  - `integrations_oauth_tokens`
  - `integrations_sync_logs`
  - `system_financial_targets`
  - `system_growth_scenarios`

### Step 5: Generate Prisma Client

```bash
npx prisma generate
```

**What happens**:
- ✅ Generates TypeScript types for all models
- ✅ Creates type-safe Prisma Client in `node_modules/@prisma/client`

**Test TypeScript autocomplete**:
```typescript
import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

// Should show autocomplete for all models
const clients = await prisma.client.findMany()
```

---

## Create Prisma Client Singleton

Create `lib/prisma.ts`:

```typescript
import { PrismaClient } from '@prisma/client'

const globalForPrisma = global as unknown as { prisma: PrismaClient }

export const prisma = globalForPrisma.prisma || new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
})

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma

export default prisma
```

**Usage in Next.js**:
```typescript
import prisma from '@/lib/prisma'

export async function GET() {
  const clients = await prisma.client.findMany({
    where: { deleted_at: null }
  })
  return Response.json(clients)
}
```

---

## Add Row Level Security (RLS)

Create `prisma/rls-policies.sql`:

```sql
-- Enable RLS on all core tables
ALTER TABLE core_organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE core_clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE core_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE core_contractors ENABLE ROW LEVEL SECURITY;
ALTER TABLE financial_revenue_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE financial_expense_records ENABLE ROW LEVEL SECURITY;

-- Example: Organization isolation for clients
CREATE POLICY "org_isolation_clients" ON core_clients
  FOR ALL
  USING (
    organization_id = (
      SELECT organization_id FROM auth.users WHERE id = auth.uid()
    )
  );

-- Repeat for all tables (see plan.md for complete policies)
```

**Apply in Supabase**:
1. Go to SQL Editor in Supabase Dashboard
2. Paste and run the SQL script
3. Verify policies in Table Editor → Policies tab

---

## Create Seed Data (Optional)

Create `prisma/seed.ts`:

```typescript
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Seeding database...')

  // Create test organization
  const org = await prisma.organization.upsert({
    where: { name: 'Test Agency' },
    update: {},
    create: {
      name: 'Test Agency',
      subscription_tier: 'pro',
    },
  })
  console.log('✅ Organization created:', org.name)

  // Create test service
  const service = await prisma.service.upsert({
    where: { id: 'web-dev-service-id' }, // Use deterministic ID
    update: {},
    create: {
      id: 'web-dev-service-id',
      organization_id: org.id,
      name: 'Web Development',
      description: 'Full-stack web development services',
      standard_rate: 150.00,
      target_margin: 40.00,
    },
  })
  console.log('✅ Service created:', service.name)

  // Create test client
  const client = await prisma.client.upsert({
    where: { id: 'acme-client-id' },
    update: {},
    create: {
      id: 'acme-client-id',
      organization_id: org.id,
      name: 'Acme Corporation',
      status: 'ACTIVE',
      relationship_type: 'Retainer',
      start_date: new Date('2025-01-01'),
    },
  })
  console.log('✅ Client created:', client.name)

  // Create test contractor
  const contractor = await prisma.contractor.create({
    data: {
      organization_id: org.id,
      name: 'John Developer',
      rate: 75.00,
      rate_type: 'HOURLY',
      engagement_type: 'FULL_TIME',
    },
  })
  console.log('✅ Contractor created:', contractor.name)

  // Create contractor assignment
  await prisma.contractorAssignment.create({
    data: {
      contractor_id: contractor.id,
      client_id: client.id,
      start_date: new Date('2025-01-01'),
      allocation_percentage: 100,
    },
  })
  console.log('✅ Contractor assigned to client')

  // Create revenue record
  await prisma.revenueRecord.create({
    data: {
      organization_id: org.id,
      client_id: client.id,
      service_id: service.id,
      amount: 15000.00,
      transaction_date: new Date('2025-01-15'),
      status: 'RECEIVED',
      description: 'January retainer payment',
      sync_source: 'MANUAL',
    },
  })
  console.log('✅ Revenue record created')

  // Create expense record
  await prisma.expenseRecord.create({
    data: {
      organization_id: org.id,
      client_id: client.id,
      contractor_id: contractor.id,
      amount: 6000.00,
      transaction_date: new Date('2025-01-31'),
      category: 'CONTRACTOR_COST',
      description: 'January contractor hours',
      sync_source: 'MANUAL',
    },
  })
  console.log('✅ Expense record created')

  console.log('🎉 Seed data complete!')
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
```

Add to `package.json`:

```json
{
  "prisma": {
    "seed": "ts-node --compiler-options {\"module\":\"CommonJS\"} prisma/seed.ts"
  }
}
```

**Run seed**:
```bash
npx prisma db seed
```

**Verify**:
```bash
npx prisma studio
# Opens GUI at http://localhost:5555
# Browse tables and verify seed data
```

---

## Implement Soft Delete Middleware

Create `lib/prisma-middleware.ts`:

```typescript
import { Prisma } from '@prisma/client'

export const softDeleteMiddleware: Prisma.Middleware = async (params, next) => {
  const softDeleteModels = ['Client', 'Service', 'Contractor']

  if (params.model && softDeleteModels.includes(params.model)) {
    // Convert delete to update with deleted_at timestamp
    if (params.action === 'delete') {
      params.action = 'update'
      params.args.data = { deleted_at: new Date() }
    }

    if (params.action === 'deleteMany') {
      params.action = 'updateMany'
      if (params.args.data != undefined) {
        params.args.data.deleted_at = new Date()
      } else {
        params.args.data = { deleted_at: new Date() }
      }
    }

    // Exclude soft-deleted records from queries
    if (params.action === 'findUnique' || params.action === 'findFirst') {
      params.action = 'findFirst'
      params.args.where = { ...params.args.where, deleted_at: null }
    }

    if (params.action === 'findMany') {
      if (params.args.where) {
        if (params.args.where.deleted_at === undefined) {
          params.args.where.deleted_at = null
        }
      } else {
        params.args.where = { deleted_at: null }
      }
    }
  }

  return next(params)
}
```

Apply in `lib/prisma.ts`:

```typescript
import { PrismaClient } from '@prisma/client'
import { softDeleteMiddleware } from './prisma-middleware'

const prisma = new PrismaClient()
prisma.$use(softDeleteMiddleware)

export default prisma
```

**Test**:
```typescript
// This will set deleted_at instead of hard delete
await prisma.client.delete({ where: { id: clientId } })

// This query won't return soft-deleted clients
const activeClients = await prisma.client.findMany()
```

---

## Create Encryption Utilities

Create `lib/encryption.ts`:

```typescript
import crypto from 'crypto'

const ALGORITHM = 'aes-256-gcm'
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY!

if (!ENCRYPTION_KEY || ENCRYPTION_KEY.length !== 64) {
  throw new Error('ENCRYPTION_KEY must be a 32-byte hex string (64 characters)')
}

export function encryptToken(token: string): string {
  const iv = crypto.randomBytes(16)
  const cipher = crypto.createCipheriv(
    ALGORITHM,
    Buffer.from(ENCRYPTION_KEY, 'hex'),
    iv
  )

  let encrypted = cipher.update(token, 'utf8', 'hex')
  encrypted += cipher.final('hex')

  const authTag = cipher.getAuthTag()

  // Format: iv:authTag:encrypted
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`
}

export function decryptToken(encryptedToken: string): string {
  const [ivHex, authTagHex, encrypted] = encryptedToken.split(':')

  if (!ivHex || !authTagHex || !encrypted) {
    throw new Error('Invalid encrypted token format')
  }

  const iv = Buffer.from(ivHex, 'hex')
  const authTag = Buffer.from(authTagHex, 'hex')
  const decipher = crypto.createDecipheriv(
    ALGORITHM,
    Buffer.from(ENCRYPTION_KEY, 'hex'),
    iv
  )

  decipher.setAuthTag(authTag)

  let decrypted = decipher.update(encrypted, 'hex', 'utf8')
  decrypted += decipher.final('utf8')

  return decrypted
}
```

**Usage**:
```typescript
import { encryptToken, decryptToken } from '@/lib/encryption'

// Encrypt before storing
const encrypted = encryptToken('xero-access-token-abc123')
await prisma.oAuthToken.create({
  data: {
    organization_id: orgId,
    provider: 'XERO',
    access_token_encrypted: encrypted,
    expires_at: new Date(Date.now() + 3600000), // 1 hour
  },
})

// Decrypt when retrieving
const token = await prisma.oAuthToken.findUnique({
  where: { organization_id_provider: { organization_id: orgId, provider: 'XERO' } },
})
const decrypted = decryptToken(token.access_token_encrypted)
```

---

## Common Tasks

### View Database in GUI

```bash
npx prisma studio
# Opens http://localhost:5555
```

### Reset Database (Dev Only)

```bash
npx prisma migrate reset
# Drops all tables, re-runs migrations, re-seeds
```

### Add New Field to Existing Table

1. Edit `prisma/schema.prisma`
2. Run migration:
   ```bash
   npx prisma migrate dev --name add_field_name
   ```
3. Regenerate client:
   ```bash
   npx prisma generate
   ```

### Query Examples

```typescript
// Get active clients with latest metrics
const clients = await prisma.client.findMany({
  where: {
    organization_id: orgId,
    deleted_at: null,
    status: 'ACTIVE',
  },
  include: {
    client_metrics: {
      orderBy: { period_end: 'desc' },
      take: 1,
    },
  },
})

// Get revenue for last 30 days
const revenue = await prisma.revenueRecord.aggregate({
  where: {
    organization_id: orgId,
    transaction_date: {
      gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
    },
  },
  _sum: { amount: true },
})
```

---

## Troubleshooting

### Error: "P1001: Can't reach database server"

**Solution**: Check DATABASE_URL in `.env` is correct and Supabase project is running

### Error: "P3014: Prisma Migrate could not create the shadow database"

**Solution**: Use DIRECT_URL for migrations:
```env
DIRECT_URL="postgres://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres"
```

### Error: "Invalid encryption key"

**Solution**: Generate new 32-byte hex key:
```bash
openssl rand -hex 32
```

### Slow Queries

**Solution**: Add indexes in schema:
```prisma
@@index([field_name])
```
Then run: `npx prisma migrate dev --name add_index`

---

## Next Steps

1. ✅ **Schema Complete** → Ready for API development
2. ⏭️ **Build API Routes** → Use `/speckit.specify` for "Xero OAuth Integration"
3. ⏭️ **Create Sync Services** → Use `/speckit.specify` for "Mercury Sync Service"
4. ⏭️ **Build Dashboard** → Use `/speckit.specify` for "Executive Dashboard UI"

**Ready to proceed?** Run `/speckit.tasks` to generate implementation checklist!

---

## Resources

- [Prisma Docs](https://www.prisma.io/docs)
- [Supabase + Prisma Guide](https://supabase.com/docs/guides/integrations/prisma)
- [Complete Data Model](./data-model.md)
- [Full Implementation Plan](./plan.md)
- [Feature Spec](./spec.md)
