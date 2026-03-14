# DevLabs CFO - Universal Small Business Edition

**Repository**: https://github.com/DEVELOPER-LABS-AI/CFO-Universal
**Cloned From**: DevLabs CFO (Agency Edition)
**Created**: 2026-03-14
**Purpose**: Universal small business CFO platform supporting multiple business types

---

## Overview

This repository is the **universal edition** of DevLabs CFO, created as a safe environment for the productization strategy that transforms the agency-specific tool into a platform serving ALL service businesses.

### Why Separate Repository?

**Risk Mitigation**:
- Original repo contains production agency features
- Productization involves destructive schema changes (DROP TABLE agency, etc.)
- Separate repo prevents breaking existing agency customers
- Allows parallel development and testing

**Dual Product Strategy**:
- **DevLabs CFO (original)**: Agency Edition ($199-799/mo)
- **DevLabs CFO Universal (this repo)**: Business Edition ($99-399/mo)

---

## Productization Strategy

See [specs/1-cfo-productization/](specs/1-cfo-productization/) for complete specifications:

- **spec.md**: Feature requirements (8 functional requirements)
- **plan.md**: 5-phase implementation roadmap
- **tasks.md**: 182 actionable tasks
- **data-model.md**: 10+ new database entities
- **research.md**: Technical decisions and best practices
- **technical-implementation.md**: Agent architecture for Vercel/Supabase

### 5-Phase Roadmap

| Phase | Duration | Deliverable | Target |
|-------|----------|-------------|--------|
| **1. Setup & Foundation** | 2-4 weeks | Database schema + config infrastructure | Foundation ready |
| **2. Agency MVP** | 2-4 weeks | Polish existing features, launch | 10 customers, $3K-5K MRR |
| **3. Autonomous Agents** | 4-6 weeks | 3 financial agents with audit trails | 5,000+ executions |
| **4. Universal Refactor** | 6-8 weeks | Multi-business support + QuickBooks | 50 customers, $10K-15K MRR |
| **5. Profit First** | 3-4 weeks | Full Profit First implementation | CPA validated |
| **6. Run Lean Intelligence** | 4-6 weeks | Hiring forecasting + agent detection | Complete |

**Total**: 19-28 weeks (Q2 2026 - Q1 2027)

---

## Key Differences from Agency Edition

### Removed (Agency-Specific)
- ❌ `Agency` table and sub-organization model
- ❌ `BDRPayPlan`, `BDRProductivityMetric` (sales-specific)
- ❌ `AgencyMonthlyBreakdown` (agency markup tracking)
- ❌ Agency-specific calculation formulas

### Added (Universal Features)
- ✅ Multi-business-type configuration (4 business types)
- ✅ Dynamic terminology (client vs. customer, contractor vs. vendor)
- ✅ Profit First allocation system (4-category bucketing)
- ✅ Autonomous financial agents (3+ agents)
- ✅ QuickBooks Online integration
- ✅ Virtual account management
- ✅ Hiring intelligence (FTE vs. contractor vs. agent)

### Renamed
- `Contractor` → `Vendor` (more universal terminology)
- `Agency Admin` role → `Team Lead`
- `BDR` → Removed (optional sales module)

---

## Architecture

### Technology Stack
- **Frontend**: Next.js 15 + React 19 + Tailwind CSS + shadcn/ui
- **Backend**: Next.js API Routes + Supabase Edge Functions
- **Database**: Supabase PostgreSQL 15+ with Prisma ORM
- **Deployment**: Vercel (frontend/API) + Supabase (database/edge functions)
- **Integrations**: Xero, QuickBooks, Mercury, Plaid, Telegram, Claude AI

### Deployment

**Vercel Project**: `devlabs-cfo-universal` (to be created)
**Supabase Project**: Separate instance from agency edition
**Domain**: TBD (e.g., `app.devlabscfo.com` or `universal.devlabscfo.com`)

---

## Development Workflow

### Setup

```bash
# 1. Clone repository
git clone git@github.com:DEVELOPER-LABS-AI/CFO-Universal.git
cd CFO-Universal

# 2. Install dependencies
npm install

# 3. Set up environment variables
cp .env.example .env.local
# Edit .env.local with your credentials

# 4. Set up database
npx prisma generate
npx prisma migrate dev

# 5. Seed business types
npx prisma db seed

# 6. Start development server
npm run dev
```

### Working on Productization

```bash
# Switch to productization branch
git checkout 1-cfo-productization

# View tasks
cat specs/1-cfo-productization/tasks.md

# View GitHub issues
gh issue list --milestone "Phase 1: Setup & Foundation"

# Implement features per task breakdown
```

---

## Repository Structure

```
CFO-Universal/
├── specs/
│   └── 1-cfo-productization/       # Complete productization specs
│       ├── spec.md                  # Feature requirements
│       ├── plan.md                  # Implementation plan
│       ├── tasks.md                 # 182 actionable tasks
│       ├── data-model.md            # Entity definitions
│       ├── research.md              # Technical decisions
│       ├── technical-implementation.md  # Agent architecture
│       ├── automation-patterns.md   # 6 bulletproof patterns
│       ├── quickstart.md            # Developer guide
│       └── contracts/
│           └── api-spec.yaml        # OpenAPI 3.1 spec
├── app/                             # Next.js app router
├── components/                      # React components
├── lib/                             # Business logic
├── prisma/                          # Database schema
└── supabase/                        # Edge functions

Total: 870 files, ~190K lines of code
```

---

## Business Type Support

### Supported Types (Post-Refactor)

1. **Service Agency** (original focus)
   - Contractor management, utilization tracking
   - Agency-specific margin calculations

2. **Consulting Firm**
   - Project-based billing
   - Professional services terminology

3. **SaaS Company**
   - Subscription revenue tracking
   - MRR/ARR metrics

4. **Professional Services**
   - Lawyers, accountants, architects
   - Hourly billing, case management

---

## Migration from Agency Edition

### For Existing Agency Customers

**Migration Path** (Phase 4):
1. Data exported from Agency Edition
2. Import into Universal Edition with `business_type = 'SERVICE_AGENCY'`
3. Feature parity maintained
4. Terminology preserved (contractor, not vendor)

**Timeline**: Q3-Q4 2026

---

## Autonomous Agents

### 3 Core Agents (Phase 3)

1. **Cash Flow Monitor**
   - Pattern: Trigger-Route (Watcher)
   - Schedule: Daily at 9 AM
   - Action: Telegram alert if balance below threshold

2. **Expense Categorizer**
   - Pattern: Filter-Fan + Transformer
   - Schedule: Daily at 3 AM
   - Action: AI-powered categorization with confidence scoring

3. **Invoice Generator**
   - Pattern: Loop (with retry)
   - Schedule: Monthly on 1st
   - Action: Generate invoices from service contracts

**Architecture**: Vercel Cron + Supabase Edge Functions (no Docker required)

---

## Profit First Implementation

### Four Allocation Categories

- **Profit**: 5-15% (business reinvestment/distributions)
- **Owner Pay**: 30-50% (owner salary/compensation)
- **Tax**: 15-20% (tax obligation reserves)
- **Operating**: 20-60% (business operations)

### Virtual Account System

- Single master bank account
- Database-tracked allocation percentages
- CAP (Current) vs. TAP (Target) variance monitoring
- Quarterly distribution calculator

---

## Links

- **GitHub Issues**: https://github.com/DEVELOPER-LABS-AI/CFO-Universal/issues
- **Milestones**: https://github.com/DEVELOPER-LABS-AI/CFO-Universal/milestones
- **Original Repo**: https://github.com/DEVELOPER-LABS-AI/CFO
- **Specifications**: [specs/1-cfo-productization/](specs/1-cfo-productization/)

---

## Contributing

See [specs/1-cfo-productization/quickstart.md](specs/1-cfo-productization/quickstart.md) for developer onboarding and contribution guidelines.

---

## License

[Your license here]

---

## Contact

For questions about the productization strategy, see planning artifacts in `specs/1-cfo-productization/` or create a GitHub issue.
