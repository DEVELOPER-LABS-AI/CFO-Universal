# Quickstart Guide: DevLabs CFO Productization Implementation

**Feature**: 1-cfo-productization
**Created**: 2026-03-13
**Branch**: `1-cfo-productization`
**Estimated Timeline**: 5-7 months (5 phases)

---

## Overview

This guide provides a step-by-step workflow for implementing the DevLabs CFO productization strategy, transforming the current agency-specific tool into a universal small business CFO platform.

---

## Prerequisites

### Development Environment
- Node.js 20+
- PostgreSQL 15+ (Supabase)
- Vercel account (Pro tier: $20/mo)
- Supabase account (Pro tier: $25/mo optional)
- Git + GitHub

### API Keys Required
- Anthropic Claude API key (for AI features)
- Telegram Bot token (for alerts)
- QuickBooks Online developer account
- Xero developer account (existing)
- Mercury API access (existing)

### Tools
```bash
npm install -g vercel
npm install -g supabase
npm install prisma
```

---

## Phase 1: Agency MVP Launch (Q2 2026)

**Duration**: 2-4 weeks | **Effort**: 80-120 hours

### Step 1: Database Schema Updates

```bash
# 1. Add business configuration tables
cd prisma

# 2. Create migration for business types
npx prisma migrate dev --name add-business-types

# Expected tables created:
# - business_types
# - organization_configurations

# 3. Seed business type templates
npx prisma db seed

# 4. Verify connection (Constitution Principle #8)
npx prisma migrate status
```

### Step 2: Complete Margin Calculation Engine

**Files to modify**:
- `lib/calculations/margin-calculations.ts` - Finalize agency margin formula
- `lib/calculations/client-costs.ts` - Complete cost aggregation logic
- `components/dashboard/margin-summary-card.tsx` - Polish UI

**Acceptance Criteria** (from spec):
- [ ] Calculate margin per client within 500ms
- [ ] Display 5-tier client classification (excellent → unprofitable)
- [ ] Identify pricing recommendations for underpriced clients

### Step 3: Polish Executive Dashboard

**Files to modify**:
- `app/dashboard/page.tsx` - Main executive dashboard
- `components/dashboard/kpi-cards.tsx` - Revenue, profit, margin KPIs
- `components/dashboard/client-profitability-table.tsx` - Client ranking

**Performance Target**: <3s page load (per spec clarification Q1)

### Step 4: Test End-to-End

```bash
# 1. Create test organization
# 2. Import 3 months historical data (Xero + Mercury)
# 3. Verify margin calculations match manual Excel model
# 4. Test recommendation engine generates valid suggestions
# 5. Verify owner pay tracking matches actual withdrawals

# Run tests
npm test

# Deploy to preview
vercel --prod
```

### Step 5: Onboard Pilot Agencies (5-10)

**Success Criteria**:
- [ ] 10 paying customers at $199-499/mo
- [ ] $3K-5K MRR by end of Q2
- [ ] 80%+ retention after 90 days

---

## Phase 2: ThePopeBot Integration (Q3 2026)

**Duration**: 4-6 weeks | **Effort**: 120-180 hours

### Step 1: Implement Audit Logging Schema

```bash
# Add agent execution log table
npx prisma migrate dev --name add-agent-execution-logs

# Tables created:
# - agent_execution_logs
# - agent_state (optional)
```

Reference: [technical-implementation.md](technical-implementation.md) Section 1

### Step 2: Build Simple Agents (Tier 1)

**Agent**: Cash Flow Monitor

```bash
# 1. Create API route
touch app/api/agents/cash-flow-monitor/route.ts

# 2. Add to vercel.json
# {
#   "crons": [
#     { "path": "/api/agents/cash-flow-monitor", "schedule": "0 9 * * *" }
#   ]
# }

# 3. Test locally
curl http://localhost:3000/api/agents/cash-flow-monitor \
  -H "Authorization: Bearer $CRON_SECRET"
```

Apply **Watcher pattern** from [automation-patterns.md](automation-patterns.md)

### Step 3: Build Medium Agents (Tier 2)

**Agent**: Expense Categorizer

```bash
# 1. Create Supabase Edge Function
supabase functions new categorize-expenses

# 2. Implement logic (see technical-implementation.md Section 2)

# 3. Deploy
supabase functions deploy categorize-expenses

# 4. Set secrets
supabase secrets set ANTHROPIC_API_KEY=sk-...
```

Apply **Filter-Fan** + **Transformer** patterns

### Step 4: Implement Rollback Mechanism

```bash
# 1. Create rollback API route
touch app/api/agents/rollback/route.ts

# 2. Add UI component
touch components/agent-audit-log-viewer.tsx
```

Reference: [technical-implementation.md](technical-implementation.md) Section 3

### Step 5: Test Autonomous Agents

```bash
# Schedule for 7 days, verify:
# - 100% of scheduled tasks execute successfully
# - Audit trail complete in agent_execution_logs
# - Rollback procedure works end-to-end
# - Telegram alerts trigger at correct thresholds
```

**Success Criteria**:
- [ ] 3 autonomous agents deployed
- [ ] 5,000+ automated tasks executed
- [ ] Zero critical errors
- [ ] 30% customer adoption

---

## Phase 3: Universal Refactor (Q3-Q4 2026)

**Duration**: 6-8 weeks | **Effort**: 240-320 hours

### Step 1: Data Model Refactor (2 weeks)

```bash
# 1. Remove agency-specific tables
npx prisma migrate dev --name remove-agency-tables
# - Drop Agency table
# - Drop AgencyMonthlyBreakdown
# - Drop BDR tables

# 2. Rename Contractor → Vendor
npx prisma migrate dev --name rename-contractor-to-vendor

# 3. Add BusinessType support
# Already done in Phase 1!

# 4. Create migration scripts for existing customers
node scripts/migrate-agency-to-universal.ts
```

### Step 2: Business Logic Refactor (2 weeks)

**Files to refactor**:
- `lib/calculations/margin-calculations.ts` - Generalize formulas
- `lib/calculations/agency-costs.ts` - Make optional module
- `lib/cfo-strategist/analyzers/staffing-analyzer.ts` - Remove BDR logic
- `lib/cfo-strategist/analyzers/overhead-analyzer.ts` - Remove agency-specific logic

**Pattern**: Use `CalculationFactory` from research.md to select formula by business type

### Step 3: UI/Portal Refactor (2 weeks)

**Renames**:
- `/app/agency-portal` → `/app/team`
- `/app/contractor-portal` → `/app/vendors`
- `/app/bdr-portal` → Remove (optional module)

**Add**:
- `/app/onboarding/business-type-selector` - New wizard component
- `/app/settings/configuration` - Business config management

### Step 4: QuickBooks Integration (2 weeks)

```bash
# 1. Create integration directory
mkdir -p lib/integrations/quickbooks

# 2. Implement OAuth flow
touch lib/integrations/quickbooks/auth.ts
touch lib/integrations/quickbooks/sync.ts

# 3. Create API routes
touch app/api/integrations/quickbooks/authorize/route.ts
touch app/api/integrations/quickbooks/callback/route.ts
touch app/api/integrations/quickbooks/sync/route.ts

# 4. Add webhook handler
touch app/api/webhooks/quickbooks/route.ts

# 5. Create database tables
npx prisma migrate dev --name add-quickbooks-integration
```

Reference: [research.md](research.md) Section 3 for OAuth implementation

**Apply patterns**:
- **Trigger-Route**: Webhook → Sync → Alert on failure
- **Collector**: Validate all entity types synced before marking complete

### Step 5: Test Universal Edition

```bash
# Create 5 test organizations (SERVICE_AGENCY, CONSULTING_FIRM, SAAS, PROFESSIONAL_SERVICES)
# Configure each with appropriate business type
# Verify terminology changes in UI
# Test QuickBooks sync end-to-end
```

**Success Criteria**:
- [ ] 50+ customers across all business types
- [ ] $10K-15K MRR by Q4 2026
- [ ] 70%+ retention

---

## Phase 4: Profit First Enhancement (Q4 2026)

**Duration**: 3-4 weeks | **Effort**: 120-160 hours

### Step 1: Allocation Engine

```bash
# 1. Create Profit First tables (already done in Phase 1 if following migration order)
npx prisma migrate dev --name add-profit-first-allocations

# Tables:
# - allocation_targets
# - virtual_accounts
# - allocation_transactions
# - current_allocations

# 2. Implement allocation calculator
touch lib/profit-first/allocation-calculator.ts
touch lib/profit-first/cap-calculator.ts

# 3. Create dashboard
touch app/dashboard/profit-first/page.tsx
```

Reference: [research.md](research.md) Section 2 for Profit First formulas

### Step 2: Bank Account Recommendations

```bash
# UI for recommending separate accounts
touch components/profit-first/bank-account-recommendations.tsx

# Integration with Mercury (creating sub-accounts)
touch lib/integrations/mercury/create-allocation-accounts.ts
```

### Step 3: Automated Distributions

```bash
# Quarterly profit distribution calculator
touch lib/profit-first/distribution-calculator.ts

# Alert system for distribution timing
touch lib/profit-first/distribution-alerts.ts

# Add to Vercel crons
# { "path": "/api/profit-first/check-distributions", "schedule": "0 9 1 */3 *" }
# Runs: 9 AM on 1st day of Jan, Apr, Jul, Oct (quarterly)
```

**Success Criteria**:
- [ ] Users can set Profit First allocations
- [ ] CAP/TAP monitoring dashboard functional
- [ ] Automated quarterly distribution calculations
- [ ] Tax reserve tracking operational

---

## Phase 5: "Run Lean" Intelligence (Q1 2027)

**Duration**: 4-6 weeks | **Effort**: 160-240 hours

### Step 1: Hiring Forecasting

```bash
# Revenue-based hiring recommendations
touch lib/hiring/revenue-thresholds.ts
touch lib/hiring/fte-vs-contractor-calculator.ts

# Dashboard
touch app/dashboard/hiring-forecast/page.tsx
```

**Formulas**:
```typescript
// Hiring threshold examples
const HIRING_THRESHOLDS = {
  'operations_manager': { minARR: 500_000, costRange: [60_000, 90_000] },
  'accountant': { minARR: 250_000, costRange: [50_000, 70_000] },
  'marketing_manager': { minARR: 750_000, costRange: [70_000, 100_000] }
};
```

### Step 2: AI Agent Opportunity Detection

```bash
# Identify repetitive tasks suitable for automation
touch lib/hiring/agent-opportunity-detector.ts

# Agent vs. human cost-benefit calculator
touch lib/hiring/agent-roi-calculator.ts
```

**Logic**: Analyze time spent on repeatable tasks → recommend agent automation before hiring

### Step 3: Deploy & Validate

```bash
# Deploy all components
vercel --prod

# Validate success criteria:
# - [ ] Hiring forecast dashboard functional
# - [ ] Agent opportunity detection generates recommendations
# - [ ] FTE vs. contractor calculator returns accurate TCO
```

---

## Development Workflow

### Daily Development

```bash
# 1. Pull latest
git pull origin main

# 2. Switch to feature branch
git checkout 1-cfo-productization

# 3. Install dependencies
npm install

# 4. Start dev server
npm run dev

# 5. Open http://localhost:3000

# 6. Make changes

# 7. Test
npm test

# 8. Commit
git add .
git commit -m "feat(phase-1): complete margin calculation engine"

# 9. Push
git push origin 1-cfo-productization
```

### Database Changes

```bash
# 1. Modify prisma/schema.prisma

# 2. Create migration
npx prisma migrate dev --name descriptive-name

# 3. Generate Prisma client
npx prisma generate

# 4. Test migration locally
npm run dev

# 5. Apply to production
npx prisma migrate deploy
```

### Deploying Supabase Edge Functions

```bash
# 1. Develop function locally
supabase functions serve <function-name> --env-file .env.local

# 2. Test
curl -i http://localhost:54321/functions/v1/<function-name> \
  -H "Authorization: Bearer <anon-key>" \
  --data '{"test":"data"}'

# 3. Deploy to production
supabase functions deploy <function-name>

# 4. Set secrets
supabase secrets set API_KEY=value
```

---

## Testing Strategy

### Unit Tests

```bash
# Calculation engines
npm test lib/calculations/margin-calculations.test.ts
npm test lib/profit-first/allocation-calculator.test.ts

# Business logic
npm test lib/cfo-strategist/analyzers/*.test.ts
```

### Integration Tests

```bash
# External API integrations
npm test lib/integrations/quickbooks/sync.test.ts
npm test lib/integrations/mercury/transactions.test.ts

# Agent execution
npm test lib/agents/expense-categorizer.test.ts
```

### End-to-End Tests

```bash
# Critical user flows (using Playwright or Cypress)
npm run test:e2e

# Tests:
# - Onboarding flow (business type selection → integration setup)
# - Profit First setup (allocations → first deposit → CAP calculation)
# - Agent execution (enable → schedule → verify execution → rollback)
# - QuickBooks sync (authorize → sync → verify data)
```

---

## Verification Checkpoints

### After Phase 1 (Agency MVP)
- [ ] 3 test orgs created with different client counts (5, 10, 25)
- [ ] 3 months Xero/Mercury data imported
- [ ] Margin calculations verified against Excel models (±0.1% accuracy)
- [ ] Recommendation engine generates 5+ valid suggestions per org
- [ ] Owner pay tracking matches actual withdrawals from Mercury

### After Phase 2 (ThePopeBot Integration)
- [ ] 3 agents deployed (cash flow, expense categorizer, one custom)
- [ ] 7-day execution test: 100% completion rate
- [ ] Audit trail verified in `agent_execution_logs` table
- [ ] Rollback tested on 10+ sample executions
- [ ] Telegram alerts received within 5 minutes of trigger

### After Phase 3 (Universal Refactor)
- [ ] 5 test orgs with different business types configured
- [ ] Terminology changes verified in UI (contractor→vendor for consulting)
- [ ] QuickBooks sync tested with sandbox account
- [ ] Agency customers migrated without data loss
- [ ] No performance degradation (<3s dashboard load maintained)

### After Phase 4 (Profit First)
- [ ] Allocation targets set for 3 test orgs
- [ ] CAP/TAP variance calculated correctly
- [ ] Virtual account balances tracked accurately
- [ ] Quarterly distribution alerts triggered on schedule
- [ ] CPA partner reviewed allocation formulas

### After Phase 5 (Run Lean Intelligence)
- [ ] Hiring forecast dashboard shows recommendations at $250K, $500K, $750K ARR thresholds
- [ ] Agent opportunity detector identifies 3+ automation candidates
- [ ] FTE vs contractor calculator returns accurate TCO with tax implications
- [ ] Seasonal staffing patterns detected for tax preparer test org

---

## Configuration Management

### Environment Variables

```bash
# .env.local (development)
DATABASE_URL="postgresql://postgres.<PROJECT_REF>:<PASSWORD>@aws-0-us-west-2.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1"
DIRECT_URL="postgresql://postgres.<PROJECT_REF>:<PASSWORD>@aws-0-us-west-2.pooler.supabase.com:5432/postgres"

NEXT_PUBLIC_SUPABASE_URL="https://<PROJECT_REF>.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="<anon-key>"
SUPABASE_SERVICE_ROLE_KEY="<service-role-key>"

ANTHROPIC_API_KEY="sk-ant-..."
TELEGRAM_BOT_TOKEN="<bot-token>"
CRON_SECRET="<random-secure-token>"

# QuickBooks (add in Phase 3)
QUICKBOOKS_CLIENT_ID="<client-id>"
QUICKBOOKS_CLIENT_SECRET="<client-secret>"
QUICKBOOKS_REDIRECT_URI="https://yourdomain.com/api/integrations/quickbooks/callback"
```

### Vercel Configuration

```bash
# Add environment variables to Vercel dashboard
vercel env add DATABASE_URL
vercel env add ANTHROPIC_API_KEY
# ... etc

# Link project
vercel link

# Deploy
vercel --prod
```

---

## Monitoring & Observability

### Dashboard Monitoring

```bash
# Vercel logs (real-time)
vercel logs --follow

# Supabase Edge Function logs
supabase functions logs <function-name> --follow

# Database query performance
# Access Supabase dashboard → Database → Query Performance
```

### Health Checks

```sql
-- Agent execution health (last 24 hours)
SELECT
  agent_type,
  COUNT(*) as executions,
  COUNT(*) FILTER (WHERE status = 'SUCCESS') as successes,
  ROUND(AVG(duration_ms) / 1000.0, 2) as avg_seconds
FROM agent_execution_logs
WHERE execution_time > NOW() - INTERVAL '24 hours'
GROUP BY agent_type;

-- Allocation integrity check
SELECT organization_id, COUNT(*)
FROM allocation_transactions
WHERE ABS((profit_amount + owner_pay_amount + tax_amount + operating_amount) - deposit_amount) > 0.01
GROUP BY organization_id;
-- Should return 0 rows (all allocations sum correctly)

-- Integration sync health
SELECT
  organization_id,
  last_sync_at,
  last_sync_status,
  AGE(NOW(), last_sync_at) as time_since_sync
FROM quickbooks_connections
WHERE is_active = true AND last_sync_status = 'FAILED';
```

---

## Troubleshooting

### Common Issues

**Database connection timeout**:
```bash
# Verify using pooler URLs (not db.*.supabase.co)
# Check .env has port 6543 for DATABASE_URL

npx prisma migrate status
# Should connect successfully
```

**Agent execution failures**:
```sql
-- Check recent failures
SELECT * FROM agent_execution_logs
WHERE status = 'FAILED'
ORDER BY execution_time DESC
LIMIT 10;

-- Common causes:
-- - API key expired (Anthropic, Telegram)
-- - Rate limit hit (QuickBooks 500 req/min)
-- - Timeout (>900s in Supabase Edge Function)
```

**QuickBooks sync issues**:
```bash
# Check token expiration
# Access tokens expire every 1 hour
# Refresh tokens expire after 6 months

# Manual token refresh
curl -X POST https://your-domain.com/api/integrations/quickbooks/refresh \
  -H "Authorization: Bearer $JWT_TOKEN"
```

---

## Deployment Checklist

### Pre-Deployment

- [ ] All tests passing (`npm test`)
- [ ] Database migrations applied (`npx prisma migrate deploy`)
- [ ] Environment variables set in Vercel
- [ ] Supabase Edge Functions deployed
- [ ] Constitution compliance verified (Principle #8: Prisma-Supabase alignment)

### Post-Deployment

- [ ] Smoke test critical paths (login, dashboard load, sync trigger)
- [ ] Verify cron jobs scheduled in Vercel dashboard
- [ ] Check Supabase Edge Function logs for errors
- [ ] Monitor first 24 hours for errors
- [ ] Validate performance (<3s dashboard, <500ms calculations)

---

## Success Metrics Dashboard

Track these KPIs weekly:

| Metric | Target | Current | Status |
|--------|--------|---------|--------|
| **MRR** | $10K-15K (Q4) | $0 | 🔴 Pre-launch |
| **Active Customers** | 50 (Q4) | 0 | 🔴 Pre-launch |
| **Customer Retention** | 70%+ | N/A | ⚪ N/A |
| **Agent Adoption** | 30%+ | N/A | ⚪ N/A |
| **Agent Reliability** | 5,000+ tasks, 0 critical errors | N/A | ⚪ N/A |
| **Dashboard Load Time** | <3s | TBD | 🟡 Pending |
| **Calculation Speed** | <500ms | TBD | 🟡 Pending |

---

## Next Steps

1. **Review this quickstart** with technical lead
2. **Run `/speckit.tasks`** to generate detailed task breakdown
3. **Assign team members** to phases
4. **Set up project tracking** (GitHub Projects, Linear, etc.)
5. **Schedule kickoff meeting** for Phase 1

---

## Resources

- **Spec**: [spec.md](spec.md) - Feature requirements
- **Research**: [research.md](research.md) - Technical decisions
- **Data Model**: [data-model.md](data-model.md) - Entity definitions
- **API Contracts**: [contracts/api-spec.yaml](contracts/api-spec.yaml) - OpenAPI spec
- **Technical Guide**: [technical-implementation.md](technical-implementation.md) - Agent architecture
- **Automation Patterns**: [automation-patterns.md](automation-patterns.md) - Design patterns
- **Constitution**: [../../.specify/memory/constitution.md](../../.specify/memory/constitution.md) - Architectural principles
