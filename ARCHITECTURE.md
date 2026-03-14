# DevLabs CFO - Technical Architecture

## Updated Stack: Vercel + Supabase + Next.js 16

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                        User Browser                         │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ↓
┌─────────────────────────────────────────────────────────────┐
│                    Vercel Edge Network                      │
│  ┌───────────────────────────────────────────────────────┐  │
│  │        Next.js 16 Application (React 19)              │  │
│  │  ┌─────────────────────────────────────────────────┐  │  │
│  │  │  App Router (Server Components + Client)        │  │  │
│  │  │  - /dashboard (Portfolio overview)              │  │  │
│  │  │  - /clients (Client management)                 │  │  │
│  │  │  - /margins (Margin tracking)                   │  │  │
│  │  │  - /pricing (Recommendations)                   │  │  │
│  │  └─────────────────────────────────────────────────┘  │  │
│  │                                                         │  │
│  │  ┌─────────────────────────────────────────────────┐  │  │
│  │  │  API Routes                                     │  │  │
│  │  │  - /api/integrations/xero/auth                  │  │  │
│  │  │  - /api/integrations/xero/callback              │  │  │
│  │  │  - /api/integrations/slack/events               │  │  │
│  │  │  - /api/webhooks/xero                           │  │  │
│  │  └─────────────────────────────────────────────────┘  │  │
│  │                                                         │  │
│  │  ┌─────────────────────────────────────────────────┐  │  │
│  │  │  Server Actions (app/actions/)                  │  │  │
│  │  │  - sync-actions.ts (Trigger Xero/Mercury sync)  │  │  │
│  │  │  - client-actions.ts (CRUD operations)          │  │  │
│  │  │  - pricing-actions.ts (Generate recs)           │  │  │
│  │  └─────────────────────────────────────────────────┘  │  │
│  └───────────────────────────────────────────────────────┘  │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ↓
┌─────────────────────────────────────────────────────────────┐
│                  Supabase Platform                          │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  PostgreSQL Database (15+)                           │   │
│  │  - core.clients, core.services, core.contractors     │   │
│  │  - financial.revenue_records, expense_records        │   │
│  │  - analytics.client_metrics, company_metrics         │   │
│  │  - integrations.xero_sync_log, oauth_tokens          │   │
│  │  - system.financial_targets, growth_scenarios        │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Supabase Auth                                       │   │
│  │  - OAuth providers (Google, GitHub, Email)           │   │
│  │  - Row Level Security (RLS) policies                 │   │
│  │  - JWT token management                              │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Supabase Realtime                                   │   │
│  │  - WebSocket connections                             │   │
│  │  - Database change subscriptions                     │   │
│  │  - Live margin updates to dashboard                  │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Supabase Edge Functions (Deno runtime)              │   │
│  │  - sync-xero-invoices (Daily at 2 AM via pg_cron)    │   │
│  │  - sync-mercury-transactions (Hourly via pg_cron)    │   │
│  │  - calculate-margins (Triggered after data sync)     │   │
│  │  - slack-bot-handler (Handle Slack messages)         │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Supabase Storage                                    │   │
│  │  - PDF reports, exported CSVs                        │   │
│  └──────────────────────────────────────────────────────┘   │
└────────────────────────┬─────────────────────────────────────┘
                         │
            ┌────────────┴─────────────┐
            ↓                          ↓
┌──────────────────────┐    ┌──────────────────────┐
│   Xero Accounting    │    │   Mercury Bank API   │
│   - OAuth 2.0        │    │   - API Key Auth     │
│   - Invoices         │    │   - Transactions     │
│   - Expenses         │    │   - Balance checks   │
└──────────────────────┘    └──────────────────────┘
            │                          │
            └────────────┬─────────────┘
                         ↓
            ┌──────────────────────────┐
            │   Slack API              │
            │   - Bot User OAuth       │
            │   - #cfo channel         │
            │   - Message posting      │
            └──────────────────────────┘
                         ↓
            ┌──────────────────────────┐
            │   OpenAI / Claude API    │
            │   - GPT-4 Turbo          │
            │   - Claude 3.5 Sonnet    │
            │   - NLP for Slack bot    │
            └──────────────────────────┘
```

---

## Technology Stack Details

### Frontend Layer (Vercel)

**Next.js 16 with App Router**
- **Server Components:** Default rendering, reduces client JS bundle
- **Client Components:** Interactive UI (charts, forms, real-time updates)
- **Server Actions:** Direct database mutations from server components
- **Streaming SSR:** Progressive rendering for fast initial page loads
- **React 19:** Latest concurrent features, improved performance

**UI Framework**
- **Tailwind CSS 3:** Utility-first styling, JIT compiler
- **shadcn/ui:** Accessible, customizable components built on Radix UI
- **Recharts:** Declarative charts for financial visualizations
- **Tremor:** Pre-built financial dashboard components

**State Management**
- **Zustand:** Lightweight client state (filters, UI preferences)
- **TanStack Query:** Server state caching, optimistic updates
- **Supabase Client:** Real-time subscriptions for live data

### Backend Layer (Supabase)

**Database: PostgreSQL 15+**
- **Managed by Supabase:** Auto-scaling, backups, point-in-time recovery
- **Prisma ORM:** Type-safe queries, migrations, schema management
- **Row Level Security (RLS):** User-based data access policies
- **pg_cron:** Native PostgreSQL job scheduling

**Authentication: Supabase Auth**
- **OAuth Providers:** Google, GitHub, email/password
- **JWT Tokens:** Automatic token refresh, secure cookie storage
- **Session Management:** Server-side session validation
- **RLS Integration:** Database-level access control

**Real-Time: Supabase Realtime**
- **WebSocket Subscriptions:** Live updates on table changes
- **Broadcast:** Custom event broadcasting
- **Presence:** Track online users (future: multi-user dashboard)

**Edge Functions: Deno Runtime**
- **Serverless:** Auto-scaling, pay-per-invocation
- **Fast Cold Starts:** <50ms startup time
- **TypeScript Native:** No build step needed
- **Database Access:** Direct connection to PostgreSQL

### Deployment (Vercel)

**Zero-Config Deployment**
```bash
# Development
npm run dev

# Production deployment
vercel deploy --prod

# Preview deployments (automatic on PR)
vercel deploy
```

**Features:**
- **Edge Network:** Global CDN with 100+ edge locations
- **Serverless Functions:** Auto-scaling API routes
- **Environment Variables:** Secure secret management
- **Preview Deployments:** Automatic PR previews
- **Analytics:** Built-in performance monitoring
- **Logs:** Real-time function logs

### External Integrations

**Xero Accounting**
- OAuth 2.0 flow handled by Next.js API routes
- Tokens stored encrypted in Supabase
- Daily sync via Supabase Edge Function + pg_cron

**Mercury Bank**
- API key authentication
- Hourly transaction sync via Edge Function
- Pattern matching for subscription categorization

**Slack Bot**
- Bolt SDK running in Supabase Edge Function
- OpenAI/Claude API for natural language processing
- Daily/weekly reports posted via pg_cron triggers

---

## Data Flow Diagrams

### 1. User Authentication Flow

```
User visits dashboard
  ↓
Vercel serves Next.js app
  ↓
User clicks "Sign In with Google"
  ↓
Redirected to Supabase Auth
  ↓
Google OAuth consent
  ↓
Callback to /auth/callback
  ↓
Supabase validates token
  ↓
Session created, JWT cookie set
  ↓
Redirected to /dashboard
  ↓
RLS policies enforce data access
```

### 2. Xero Invoice Sync Flow

```
pg_cron triggers daily at 2 AM
  ↓
Calls Supabase Edge Function: sync-xero-invoices
  ↓
Edge Function:
  1. Retrieves encrypted Xero tokens from database
  2. Refreshes tokens if needed
  3. Calls Xero API: GET /Invoices?since=yesterday
  4. Transforms invoice data
  5. Upserts to financial.revenue_records
  6. Logs sync status to integrations.xero_sync_log
  ↓
Triggers calculate-margins Edge Function
  ↓
Calculation Engine:
  1. Aggregates revenue + costs per client
  2. Calculates actual margin
  3. Gets target margin (client → service → global)
  4. Classifies tier (1-5)
  5. Generates pricing recommendation
  6. Writes to analytics.client_metrics
  ↓
Supabase Realtime broadcasts change
  ↓
Dashboard auto-updates (no refresh needed)
```

### 3. Slack CFO Bot Query Flow

```
User in #cfo channel: "@CFO What's our margin?"
  ↓
Slack sends event to /api/integrations/slack/events
  ↓
Next.js API route validates Slack signature
  ↓
Calls Supabase Edge Function: slack-bot-handler
  ↓
Edge Function:
  1. Parses user message
  2. Calls OpenAI/Claude API to determine intent
  3. Queries Supabase: SELECT * FROM analytics.company_metrics
  4. Formats response using Slack Block Kit
  5. Posts message to #cfo channel via Slack API
  ↓
User sees response in Slack within 2 seconds
```

### 4. Real-Time Dashboard Update Flow

```
Margin calculation completes
  ↓
Supabase Edge Function writes to analytics.client_metrics
  ↓
PostgreSQL trigger fires on INSERT/UPDATE
  ↓
Supabase Realtime broadcasts change event
  ↓
Dashboard subscribed to changes:
  supabase
    .channel('client-metrics')
    .on('postgres_changes', { table: 'client_metrics' }, handleUpdate)
  ↓
React component state updates
  ↓
Chart re-renders with new data (no page refresh)
```

---

## Security Architecture

### Row Level Security (RLS) Policies

```sql
-- Example: Users can only see their own organization's clients
CREATE POLICY "Users can view own org clients"
  ON core.clients
  FOR SELECT
  USING (
    organization_id = (
      SELECT organization_id
      FROM auth.users
      WHERE id = auth.uid()
    )
  );

-- Users can update clients in their organization
CREATE POLICY "Users can update own org clients"
  ON core.clients
  FOR UPDATE
  USING (
    organization_id = (
      SELECT organization_id
      FROM auth.users
      WHERE id = auth.uid()
    )
  );
```

### API Security

**Supabase Service Role Key:**
- Used only in Edge Functions, NEVER exposed to client
- Has admin privileges to bypass RLS when needed
- Stored as environment variable in Supabase dashboard

**Encryption at Rest:**
- OAuth tokens encrypted with AES-256 before storage
- Encryption key stored in Vercel environment variables
- Decryption only in Edge Functions (server-side)

**Rate Limiting:**
- Vercel Edge Functions: 100,000 requests/day on free tier
- Supabase: Rate limiting on API endpoints
- Optional: Upstash Redis for custom rate limiting

---

## Advantages of Vercel + Supabase Stack

### Cost Efficiency
- **Free Tiers:** Both Vercel and Supabase have generous free tiers
- **No Server Management:** No EC2 instances, no ECS clusters
- **Pay-per-Use:** Only pay for what you use beyond free tier

### Developer Experience
- **Single Codebase:** No separate backend/frontend repos
- **Type Safety:** End-to-end TypeScript with Prisma + Supabase
- **Hot Reload:** Instant feedback during development
- **Preview Deployments:** Test changes before production

### Performance
- **Edge Network:** <50ms latency globally via Vercel Edge
- **Connection Pooling:** Supabase handles PostgreSQL connections
- **Real-Time:** Native WebSocket support, no Socket.io setup

### Scalability
- **Auto-Scaling:** Both platforms scale automatically
- **No Cold Starts:** Vercel Edge Functions are instant
- **Database:** Supabase handles up to 50GB free tier

---

## Deployment Strategy

### Development Environment

```bash
# 1. Clone repository
git clone https://github.com/your-org/devlabs-cfo.git
cd devlabs-cfo

# 2. Install dependencies
npm install

# 3. Set up Supabase locally (optional)
npx supabase init
npx supabase start

# 4. Copy environment variables
cp .env.local.example .env.local
# Fill in Supabase keys, Xero credentials, etc.

# 5. Run Prisma migrations
npx prisma migrate dev
npx prisma generate

# 6. Start development server
npm run dev
# Opens http://localhost:3000
```

### Production Deployment

```bash
# 1. Connect to Vercel
vercel link

# 2. Set environment variables in Vercel dashboard
# - NEXT_PUBLIC_SUPABASE_URL
# - NEXT_PUBLIC_SUPABASE_ANON_KEY
# - SUPABASE_SERVICE_ROLE_KEY
# - XERO_CLIENT_ID, XERO_CLIENT_SECRET
# - MERCURY_API_KEY
# - SLACK_BOT_TOKEN
# - OPENAI_API_KEY or ANTHROPIC_API_KEY

# 3. Deploy to production
vercel deploy --prod

# 4. Set up Supabase Edge Functions
cd supabase/functions
supabase functions deploy sync-xero-invoices
supabase functions deploy sync-mercury-transactions
supabase functions deploy calculate-margins
supabase functions deploy slack-bot-handler

# 5. Configure pg_cron jobs
# Run SQL scripts in Supabase SQL Editor
```

### CI/CD Pipeline (GitHub Actions)

```yaml
# .github/workflows/deploy.yml
name: Deploy to Vercel

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: 20
      - run: npm ci
      - run: npx prisma generate
      - run: npm run build
      - uses: amondnet/vercel-action@v25
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
          vercel-args: '--prod'
```

---

## Next Steps

1. **Create Supabase Project:** [https://app.supabase.com/](https://app.supabase.com/)
2. **Initialize Next.js 16:** `npx create-next-app@latest --typescript`
3. **Set up Prisma:** `npx prisma init`
4. **Configure Supabase Auth:** Enable OAuth providers in Supabase dashboard
5. **Deploy to Vercel:** `vercel deploy --prod`

See [README-IMPLEMENTATION.md](./README-IMPLEMENTATION.md) for detailed setup instructions.
