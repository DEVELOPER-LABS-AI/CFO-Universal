# DevLabs CFO - Profit Optimization System

A real-time profit optimization engine for agencies, featuring automated margin tracking, pricing recommendations, and executive dashboards.

---

## Features

- ✅ **Multi-Tenant SaaS** - Organization-level data isolation with Row Level Security (RLS)
- ✅ **Real-Time Financial Tracking** - Automated sync with Xero & Mercury Bank
- ✅ **Margin Intelligence** - 5-tier client classification with automated pricing recommendations
- ✅ **Secure OAuth Integration** - AES-256 encrypted token storage
- ✅ **Type-Safe Database** - Prisma ORM with full TypeScript support
- ✅ **Soft Deletes** - Preserve historical data for compliance

---

## Tech Stack

- **Database**: Supabase (PostgreSQL 15+)
- **ORM**: Prisma 7.4.0
- **Frontend**: Next.js 16 + React 19
- **Backend**: Next.js API Routes + Supabase Edge Functions
- **Deployment**: Vercel + Supabase
- **Integrations**: Xero, Mercury Bank, Slack, Claude AI

---

## Quick Start

### Prerequisites

- Node.js 20+
- Supabase account
- API keys: Xero, Mercury, Slack (optional), Claude/OpenAI (optional)

### 1. Clone & Install

```bash
git clone <repository-url>
cd "DevLabs CFO"
npm install
```

### 2. Configure Environment

Copy environment template and fill in your credentials:

```bash
cp .env.local.example .env
```

Required variables:
```env
# Supabase
DATABASE_URL="postgres://..."
DIRECT_URL="postgres://..."
NEXT_PUBLIC_SUPABASE_URL="https://..."
NEXT_PUBLIC_SUPABASE_ANON_KEY="..."
SUPABASE_SERVICE_ROLE_KEY="..."

# Security
ENCRYPTION_KEY="..." # Generate with: openssl rand -hex 32

# Integrations (see .env.setup-guide.md)
XERO_CLIENT_ID="..."
XERO_CLIENT_SECRET="..."
MERCURY_API_KEY="..."
```

See [.env.setup-guide.md](./.env.setup-guide.md) for detailed setup instructions.

### 3. Database Setup

```bash
# Generate Prisma Client
npm run db:generate

# Apply migrations to Supabase
npm run db:migrate

# Seed test data
npm run db:seed

# Open database GUI
npm run db:studio
```

### 4. Apply Manual Migration to Supabase

Since you're manually migrating the schema to Supabase, follow these steps in order:

**Step 4a: Apply Database Schema**
```bash
cat prisma/manual-migration.sql
# Copy output and run in Supabase Dashboard → SQL Editor
```

**Step 4b: Setup User-Organization Mapping**
```bash
cat prisma/rls-setup.sql
# Copy output and run in Supabase Dashboard → SQL Editor
```

**Step 4c: Apply Row Level Security Policies**
```bash
cat prisma/rls-policies.sql
# Copy output and run in Supabase Dashboard → SQL Editor
```

**Step 4d: Link Your User to an Organization**

After creating a user in Supabase Authentication, link them to an organization:

```sql
-- Get your user ID from Supabase Auth dashboard
-- Then insert mapping:
INSERT INTO public.user_organizations (user_id, organization_id, role)
VALUES (
    'your-auth-user-id',  -- From Supabase Auth dashboard
    'your-org-id',        -- From core_organizations table
    'owner'
);
```

### 5. Start Development Server

```bash
npm run dev
# Opens http://localhost:3000
```

---

## Database Schema

**13 tables** across 5 logical schemas:

### Core Schema
- `core_organizations` - Root tenant entity
- `core_clients` - Agency clients (soft delete supported)
- `core_services` - Service offerings
- `core_contractors` - Contractor workforce
- `core_contractor_assignments` - Contractor → Client links

### Financial Schema
- `financial_revenue_records` - All income transactions
- `financial_expense_records` - All expenses

### Analytics Schema
- `analytics_client_metrics` - Client KPIs (margin, tier)
- `analytics_company_metrics` - Company-wide KPIs

### Integrations Schema
- `integrations_oauth_tokens` - Encrypted API credentials
- `integrations_sync_logs` - Sync audit trails

### System Schema
- `system_financial_targets` - Margin/revenue goals
- `system_growth_scenarios` - What-if simulations

See [DATABASE.md](./DATABASE.md) for complete schema documentation.

---

## Project Structure

```
/DevLabs CFO/
├── prisma/
│   ├── schema.prisma       # Database schema (13 tables, 9 enums)
│   ├── migrations/         # Database migrations
│   ├── seed.ts            # Test data script
│   └── rls-policies.sql   # Row Level Security policies
├── lib/
│   ├── prisma.ts          # Prisma Client singleton
│   ├── prisma-middleware.ts  # Soft delete logic
│   └── encryption.ts      # OAuth token encryption
├── specs/
│   └── 1-database-schema/ # SpecKit feature specs
├── .env                   # Environment variables (git-ignored)
├── DATABASE.md            # Database documentation
└── README.md              # This file
```

---

## Development Commands

### Database

```bash
npm run db:generate      # Generate Prisma Client
npm run db:migrate       # Create and apply migration
npm run db:push          # Push schema changes (prototyping)
npm run db:seed          # Seed test data
npm run db:studio        # Open database GUI
npm run db:reset         # Reset database (dev only - destructive!)
```

### Application

```bash
npm run dev              # Start development server
npm run build            # Build for production
npm run start            # Start production server
npm run lint             # Run ESLint
```

---

## Key Features

### Multi-Tenancy

All data is scoped by `organization_id` with Row Level Security (RLS) enforcement:

```typescript
// Users can only access their organization's data
const clients = await prisma.client.findMany({
  where: { organization_id: orgId }
})
// RLS automatically filters by logged-in user's organization
```

### Soft Deletes

Clients, Services, and Contractors support soft deletion:

```typescript
// Delete (sets deleted_at timestamp)
await prisma.client.delete({ where: { id: clientId } })

// Queries automatically exclude soft-deleted records
const activeClients = await prisma.client.findMany()
```

### Encrypted OAuth Tokens

Integration credentials are encrypted with AES-256-GCM:

```typescript
import { encryptToken, decryptToken } from '@/lib/encryption'

const encrypted = encryptToken('xero-token-abc')
await prisma.oAuthToken.create({
  data: {
    organization_id: orgId,
    provider: 'XERO',
    access_token_encrypted: encrypted,
    expires_at: new Date(Date.now() + 3600000),
  },
})
```

---

## Documentation

- **[DATABASE.md](./DATABASE.md)** - Complete database documentation
- **[ARCHITECTURE.md](./ARCHITECTURE.md)** - System architecture
- **[.env.setup-guide.md](./.env.setup-guide.md)** - API keys setup guide
- **[README-IMPLEMENTATION.md](./README-IMPLEMENTATION.md)** - SpecKit workflow

---

## Deployment

### Vercel (Frontend + API)

```bash
npm install -g vercel
vercel login
vercel link
vercel deploy --prod
```

Set environment variables in Vercel Dashboard → Settings → Environment Variables.

### Supabase (Database)

Migrations are applied automatically via `npm run db:migrate` during development.

For production:
```bash
npm run db:migrate:deploy
```

---

## Troubleshooting

### Database Connection Issues

**Error**: `Can't reach database server`

**Solution**: Verify DATABASE_URL in .env matches Supabase connection string:
```env
DATABASE_URL="postgres://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:6543/postgres?pgbouncer=true"
```

### Soft Deletes Not Working

**Check**: Are you importing Prisma from `lib/prisma.ts`?

```typescript
// ✅ Correct (includes middleware)
import prisma from '@/lib/prisma'

// ❌ Wrong (no middleware)
import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()
```

### RLS Blocking Queries

**Check**: Does `auth.users` table have `organization_id` column?

```sql
-- Verify auth structure
SELECT id, organization_id FROM auth.users LIMIT 1;
```

---

## Contributing

1. Create feature branch: `git checkout -b feature/name`
2. Follow SpecKit workflow: `/speckit.specify` → `/speckit.plan` → `/speckit.tasks` → `/speckit.implement`
3. Run tests and lint: `npm run lint`
4. Submit pull request

---

## License

Proprietary - DevLabs 2025

---

## Support

For issues or questions:
- Check [DATABASE.md](./DATABASE.md) for database-specific help
- Review [.env.setup-guide.md](./.env.setup-guide.md) for API setup
- Consult [ARCHITECTURE.md](./ARCHITECTURE.md) for system design

---

**Built with [SpecKit](https://github.com/speckit/speckit)** 🚀
