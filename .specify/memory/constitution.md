# DevLabs CFO - Project Constitution

<!--
SYNC IMPACT REPORT - Constitution Amendment
============================================
Version Change: 1.0.0 → 1.1.0
Amendment Date: 2026-02-14
Bump Rationale: MINOR - Added new principle section for Prisma-Supabase database alignment

Modified Principles:
- Enhanced "Database Design" constraints with connection configuration rules

Added Sections:
- NEW Principle #8: "Prisma-Supabase Database Alignment"
  - Database Connection Configuration
  - Migration Workflow
  - Schema Synchronization
  - Pre-deployment Checklist
  - Troubleshooting Protocol
  - SpecKit Integration Requirements

Removed Sections: None

Templates Status:
- ✅ .specify/templates/spec-template.md - Reviewed, no updates needed (technology-agnostic)
- ⚠ .specify/templates/plan-template.md - NOT FOUND (will be created by future speckits)
- ⚠ .specify/templates/tasks-template.md - NOT FOUND (will be created by future speckits)

Follow-up TODOs:
- When plan-template.md is created, ensure it includes "Database Connection Verification" step
- When tasks-template.md is created, ensure it includes "Prisma Migration" task category
- Update ARCHITECTURE.md to document pooler URL configuration (if not already present)

Dependencies Affected:
- All future database-related speckits MUST follow new Principle #8 guidelines
- Existing .env configuration has been validated against new standards (✅ compliant)
-->

**Last Updated**: 2026-02-14
**Version**: 1.1.0
**Ratification Date**: 2026-02-12

This document defines the core architectural principles and constraints that all implementations must follow.

## Architectural Principles

### 1. Technology Stack

**Mandatory Stack:**
- **Database**: Supabase (PostgreSQL 15+) - Managed database service
- **ORM**: Prisma - Type-safe database access and schema management
- **Frontend**: Next.js 15 with App Router, React 19
- **Backend**: Next.js API Routes + Supabase Edge Functions (Deno runtime)
- **Deployment**: Vercel (frontend/API) + Supabase (database/edge functions)
- **Styling**: Tailwind CSS 3 + shadcn/ui components
- **Charts**: Recharts + Tremor for financial visualizations

**Rationale**: This stack provides serverless auto-scaling, zero-config deployment, generous free tiers, and excellent developer experience with end-to-end TypeScript.

### 2. Data Architecture

**Multi-Tenancy:**
- All data MUST be scoped by `organization_id`
- Row Level Security (RLS) policies enforce data isolation
- No cross-organization queries permitted at database level

**Schema Organization:**
- `core` schema: Organizations, clients, services, contractors
- `financial` schema: Revenue records, expense records
- `analytics` schema: Pre-calculated metrics (client_metrics, company_metrics)
- `integrations` schema: OAuth tokens, sync logs
- `system` schema: Financial targets, growth scenarios

**Data Integrity:**
- Soft deletes for historical preservation
- Foreign key constraints with cascade rules
- Validation at database level (CHECK constraints, NOT NULL)
- Encryption at rest for sensitive data (OAuth tokens)

### 3. Integration Philosophy

**External Systems:**
- **Xero**: OAuth 2.0 for accounting data (invoices, expenses)
- **Mercury**: API key authentication for banking transactions
- **Slack**: Bot integration for conversational AI queries
- **AI Provider**: OpenAI (GPT-4) or Anthropic (Claude) for NLP

**Sync Strategy:**
- Daily sync for accounting (Xero) via Supabase Edge Functions + pg_cron
- Hourly sync for banking (Mercury)
- Incremental updates based on last_sync_timestamp
- Comprehensive sync logging for audit trails

### 4. Security Requirements

**Authentication:**
- Supabase Auth with OAuth providers (Google, GitHub)
- JWT tokens with automatic refresh
- Session-based validation on server

**Authorization:**
- Row Level Security (RLS) enforces organization boundaries
- Service role keys NEVER exposed to client
- API keys encrypted at rest using AES-256

**Compliance:**
- GDPR/CCPA data retention and deletion support
- 7+ years historical data retention for tax compliance
- Audit trails for all financial data modifications

### 5. Performance Standards

**Database Queries:**
- Margin calculations: <500ms for 10K transactions
- Dashboard loading: <2s initial render
- Real-time updates: <200ms via WebSocket subscriptions

**Scalability Targets:**
- Support 1,000 organizations
- Handle 100,000 clients
- Process 10 million transactions
- Maintain performance at scale without partitioning

### 6. Code Quality

**TypeScript:**
- Strict mode enabled
- No implicit `any` types
- Prisma-generated types for database models

**Error Handling:**
- Graceful degradation for external API failures
- Exponential backoff for retry logic
- User-friendly error messages
- Comprehensive error logging (sync failures, API errors)

**Testing:**
- Unit tests for calculation engines (margin, pricing)
- Integration tests for external APIs (Xero, Mercury)
- E2E tests for critical user flows

### 7. Development Workflow

**Version Control:**
- Feature branches: `N-feature-name` format
- Spec-driven development (spec → plan → tasks → implementation)
- No direct commits to `main` without PR review

**Deployment:**
- Preview deployments on PR creation (Vercel)
- Production deployment on merge to `main`
- Supabase Edge Functions deployed separately
- Environment variables managed via Vercel/Supabase dashboards

### 8. Prisma-Supabase Database Alignment

**Connection Configuration (CRITICAL):**
- **ALWAYS** use Supabase pooler URLs (`aws-0-us-west-2.pooler.supabase.com`) for both DATABASE_URL and DIRECT_URL
- **DATABASE_URL MUST** use port 6543 with `?pgbouncer=true&connection_limit=1` for transaction pooling (fast queries)
- **DIRECT_URL MUST** use port 5432 for session pooling (migrations, schema operations)
- **NEVER** use direct `db.*.supabase.co` URLs as they timeout due to network restrictions
- Format: `postgresql://postgres.<PROJECT_REF>:<PASSWORD>@aws-0-us-west-2.pooler.supabase.com:<PORT>/postgres`

**Migration Workflow (MANDATORY):**
- **ALWAYS** test database connection with `npx prisma migrate status` before any schema changes
- **ALWAYS** use `npx prisma migrate dev` for local development schema changes
- **ALWAYS** use `npx prisma migrate deploy` for production deployments
- **NEVER** apply migrations manually via SQL unless absolutely necessary
- **IF** manual migrations are applied, IMMEDIATELY run `npx prisma migrate resolve --applied <migration_name>` to sync tracking

**Schema Synchronization (REQUIRED):**
- **ALWAYS** run `npx prisma generate` after any schema changes to update Prisma Client
- **ALWAYS** verify schema sync with `npx prisma migrate status` after deployments
- **ALWAYS** check Supabase dashboard matches Prisma schema for production databases
- **ALWAYS** commit generated Prisma Client to version control

**Pre-deployment Checklist (NON-NEGOTIABLE):**
1. Verify `.env` has correct pooler URLs (not direct db URLs)
2. Test connection: `npx prisma migrate status` returns success
3. Review migration files in `prisma/migrations/` before applying
4. Backup production data before destructive changes (ALTER TABLE DROP, etc.)
5. Run migrations in transaction mode when possible (`--create-only` then review)
6. Verify RLS policies are not affected by schema changes

**Troubleshooting Protocol:**
- **IF** connection timeouts occur → verify pooler URLs are used (not db.*.supabase.co)
- **IF** "Can't reach database" errors → check Supabase project is not paused
- **IF** authentication fails → verify database credentials are current in .env
- **IF** direct connection fails → test REST API access at `https://<PROJECT_REF>.supabase.co/rest/v1/`
- **IF** migration tracking is out of sync → use `prisma migrate resolve` to reconcile

**SpecKit Integration (ENFORCED):**
- **ALL** database-related speckits MUST include "Verify Database Connection" as first implementation task
- **ALL** speckits MUST include Prisma migration steps in `tasks.md` with specific commands
- **ALL** speckits MUST include rollback procedures for schema changes
- **ALL** speckits MUST verify `.env` pooler configuration before schema work
- **ALL** spec templates MUST reference this principle when database changes are involved

**Rationale**: Supabase paid instances use connection pooling for security and performance. Direct connections (port 5432) to `db.*.supabase.co` are often blocked, causing timeout errors. Using pooler URLs ensures reliable connections while maintaining Prisma's migration capabilities. Strict workflow enforcement prevents schema drift and data loss.

## Design Constraints

### Database Design

**MUST:**
- Use Supabase pooler URLs exclusively (see Principle #8)
- Use Prisma schema definitions (no raw SQL for schema)
- Include `created_at`, `updated_at` timestamps on all entities
- Use UUID primary keys for all tables
- Implement soft deletes with `deleted_at` nullable field
- Add indexes for foreign keys and frequently queried columns
- Test database connection before any schema modifications
- Run `npx prisma generate` after schema changes

**MUST NOT:**
- Use direct `db.*.supabase.co` connection URLs (causes timeouts)
- Use database triggers for business logic (use Edge Functions)
- Store unencrypted OAuth tokens or API keys
- Allow hard deletes on core entities (clients, contractors, services)
- Use SERIAL integers for primary keys (use UUID)
- Apply migrations without verifying connection first
- Skip `prisma migrate resolve` after manual SQL migrations

### API Design

**MUST:**
- Use Next.js Server Actions for data mutations
- Use Supabase Edge Functions for scheduled tasks and integrations
- Return typed responses (Zod validation)
- Include rate limiting on public endpoints

**MUST NOT:**
- Expose Supabase service role key to client
- Use client-side direct database access for mutations
- Return sensitive data (OAuth tokens, API keys) to client

### Frontend Design

**MUST:**
- Use Server Components by default (Client Components only when needed)
- Implement loading states for async operations
- Use TanStack Query for server state caching
- Follow shadcn/ui component patterns

**MUST NOT:**
- Store sensitive data in localStorage/sessionStorage
- Make direct database queries from client components
- Use inline styles (use Tailwind classes)

## Decision Framework

When making implementation decisions, prioritize in this order:

1. **Security**: Data isolation, encryption, access control
2. **Correctness**: Accurate margin calculations, financial integrity
3. **Performance**: Sub-second dashboard loading, real-time updates
4. **Maintainability**: Type safety, clear code structure, documentation
5. **User Experience**: Intuitive UI, helpful error messages, fast feedback

## Governance

### Amendment Procedure

1. **Proposal**: Document proposed change with rationale and impact analysis
2. **Review**: Evaluate against existing principles and project constraints
3. **Approval**: Technical lead approval required for MAJOR/MINOR changes
4. **Update**: Amend constitution with version bump and sync impact report
5. **Propagation**: Update all dependent templates and documentation

### Versioning Policy

- **MAJOR** (X.0.0): Backward-incompatible governance changes, principle removals, or redefinitions
- **MINOR** (0.X.0): New principles added, materially expanded guidance, new constraint categories
- **PATCH** (0.0.X): Clarifications, wording improvements, typo fixes, non-semantic refinements

### Compliance Review

- Constitution compliance MUST be verified during:
  - Spec review (before plan creation)
  - Plan approval (before implementation)
  - Pull request review (before merge)
  - Production deployment (final check)

## Exceptions

Deviations from this constitution require:
1. **Documented justification** in implementation plan with specific reasoning
2. **Alternative approach** that maintains equivalent security/correctness guarantees
3. **Explicit approval** from technical lead before implementation begins
4. **Amendment proposal** if deviation should become permanent

## References

- [Architecture Documentation](../../ARCHITECTURE.md)
- [Environment Setup Guide](../../.env.setup-guide.md)
- [Implementation Roadmap](../../README-IMPLEMENTATION.md)
- [Prisma Documentation](https://www.prisma.io/docs)
- [Supabase Connection Pooling](https://supabase.com/docs/guides/database/connecting-to-postgres#connection-pooler)
