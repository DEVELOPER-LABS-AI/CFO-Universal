# Implementation Tasks: Database Schema for DevLabs CFO System

**Feature**: Database Schema
**Branch**: 1-database-schema
**Created**: 2026-02-12
**Status**: Ready for Implementation

---

## Overview

This document provides an actionable, dependency-ordered task list for implementing the database schema. Each task includes specific file paths, verification criteria, and parallelization opportunities.

**Total Tasks**: 34
**Estimated Time**: 3-5 days
**Parallelization Opportunities**: 12 tasks can run in parallel

---

## Task Execution Format

Each task follows this format:
```
- [ ] [TaskID] [P?] Description with file path
```

- **[P]** = Parallelizable (can run simultaneously with other [P] tasks in same phase)
- **TaskID** = Sequential execution order (T001, T002, etc.)
- **File Path** = Exact location where changes are made

---

## Phase 1: Project Setup & Dependencies

**Goal**: Initialize Prisma in the project with proper configuration

**Prerequisites**:
- ✅ Supabase project created
- ✅ Node.js 20+ installed
- ✅ Database connection strings from Supabase

### Setup Tasks

- [ ] T001 Install Prisma dependencies: `npm install @prisma/client && npm install -D prisma`
- [ ] T002 Initialize Prisma: `npx prisma init` (creates `prisma/schema.prisma` and `.env`)
- [ ] T003 Configure environment variables in `.env` with DATABASE_URL and DIRECT_URL from Supabase
- [ ] T004 Generate encryption key: `openssl rand -hex 32` and add to `.env` as ENCRYPTION_KEY
- [ ] T005 Verify Prisma connection: `npx prisma db pull` (should connect successfully)

**Verification**:
- ✅ Prisma CLI installed and accessible
- ✅ `.env` file contains DATABASE_URL, DIRECT_URL, ENCRYPTION_KEY
- ✅ Connection to Supabase database successful

---

## Phase 2: Schema Definition

**Goal**: Define complete database schema in Prisma format

**Prerequisites**: Phase 1 complete

### Schema Definition Tasks

- [ ] T006 Copy datasource and generator config from plan.md to `prisma/schema.prisma`
- [ ] T007 [P] Define all Prisma enums in `prisma/schema.prisma` (ClientStatus, RateType, EngagementType, RevenueStatus, SyncSource, ExpenseCategory, OAuthProvider, SyncStatus, TargetScope)
- [ ] T008 [P] Define Organization model in `prisma/schema.prisma` with all relations
- [ ] T009 [P] Define Client model in `prisma/schema.prisma` with soft delete support (deleted_at field)
- [ ] T010 [P] Define Service model in `prisma/schema.prisma` with soft delete support
- [ ] T011 [P] Define Contractor model in `prisma/schema.prisma` with soft delete support
- [ ] T012 [P] Define ContractorAssignment model in `prisma/schema.prisma` with cascade deletes
- [ ] T013 [P] Define RevenueRecord model in `prisma/schema.prisma` with sync tracking fields
- [ ] T014 [P] Define ExpenseRecord model in `prisma/schema.prisma` with nullable client/contractor
- [ ] T015 [P] Define ClientMetrics model in `prisma/schema.prisma` with calculated_at timestamp
- [ ] T016 [P] Define CompanyMetrics model in `prisma/schema.prisma`
- [ ] T017 [P] Define OAuthToken model in `prisma/schema.prisma` with encrypted fields
- [ ] T018 [P] Define SyncLog model in `prisma/schema.prisma` with error tracking
- [ ] T019 [P] Define FinancialTarget model in `prisma/schema.prisma` with hierarchical scope
- [ ] T020 [P] Define GrowthScenario model in `prisma/schema.prisma` with JSON assumptions
- [ ] T021 Add all @@index directives for foreign keys and frequently queried columns
- [ ] T022 Add all @@map directives to use table naming convention (core_*, financial_*, etc.)
- [ ] T023 Validate schema: `npx prisma format && npx prisma validate`

**Verification**:
- ✅ All 13 models defined with correct field types
- ✅ All 9 enums defined
- ✅ All foreign key relationships have @relation attributes
- ✅ Indexes added for organization_id, deleted_at, transaction_date, status fields
- ✅ `npx prisma validate` passes without errors
- ✅ VS Code Prisma extension shows no errors

**Parallel Execution Example**:
Tasks T007-T020 can be executed in parallel if working with multiple developers - each can work on different model definitions simultaneously.

---

## Phase 3: Database Migration

**Goal**: Create and apply initial database migration

**Prerequisites**: Phase 2 complete

### Migration Tasks

- [ ] T024 Create initial migration: `npx prisma migrate dev --name init_database_schema`
- [ ] T025 Review generated migration SQL in `prisma/migrations/[timestamp]_init_database_schema/migration.sql`
- [ ] T026 Verify migration created all 13 tables in Supabase Studio
- [ ] T027 Verify all PostgreSQL enums created (9 enums total)
- [ ] T028 Verify all indexes created (check pg_indexes in Supabase)
- [ ] T029 Verify foreign key constraints created (check pg_constraint in Supabase)

**Verification**:
- ✅ Migration file generated (~800-1000 lines of SQL)
- ✅ Migration applied without errors
- ✅ All 13 tables visible in Supabase Table Editor
- ✅ All enums visible in Supabase Database → Enumerations
- ✅ Indexes present on organization_id, deleted_at, foreign keys

---

## Phase 4: Prisma Client Generation & Utilities

**Goal**: Generate type-safe Prisma Client and create helper utilities

**Prerequisites**: Phase 3 complete

### Client & Utilities Tasks

- [ ] T030 Generate Prisma Client: `npx prisma generate`
- [ ] T031 [P] Create Prisma Client singleton in `lib/prisma.ts` with connection pooling
- [ ] T032 [P] Create soft delete middleware in `lib/prisma-middleware.ts` for Client, Service, Contractor models
- [ ] T033 [P] Create encryption utilities in `lib/encryption.ts` with encryptToken() and decryptToken() functions
- [ ] T034 Apply soft delete middleware to Prisma Client in `lib/prisma.ts`

**File: `lib/prisma.ts`**
```typescript
import { PrismaClient } from '@prisma/client'
import { softDeleteMiddleware } from './prisma-middleware'

const globalForPrisma = global as unknown as { prisma: PrismaClient }

export const prisma = globalForPrisma.prisma || new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
})

prisma.$use(softDeleteMiddleware)

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma

export default prisma
```

**File: `lib/prisma-middleware.ts`**
- Intercept delete operations on Client, Service, Contractor models
- Convert hard delete to soft delete (set deleted_at = new Date())
- Automatically filter out soft-deleted records in findMany/findFirst queries

**File: `lib/encryption.ts`**
- Implement AES-256-GCM encryption for OAuth tokens
- encryptToken(plaintext: string): string
- decryptToken(ciphertext: string): string
- Use ENCRYPTION_KEY from environment variable

**Verification**:
- ✅ TypeScript autocomplete works for all Prisma models
- ✅ `prisma.client.findMany()` shows type hints in VS Code
- ✅ Soft delete: `await prisma.client.delete()` sets deleted_at instead of hard delete
- ✅ Encryption: `decryptToken(encryptToken('test'))` returns 'test'

**Parallel Execution Example**:
Tasks T031, T032, T033 can be worked on in parallel - different files with no dependencies.

---

## Phase 5: Row Level Security (RLS)

**Goal**: Implement multi-tenant data isolation via RLS policies

**Prerequisites**: Phase 4 complete

### RLS Policy Tasks

- [ ] T035 Create RLS policy SQL file: `prisma/rls-policies.sql`
- [ ] T036 [P] Add RLS policy for core_organizations table (enable RLS + SELECT/INSERT/UPDATE/DELETE policies)
- [ ] T037 [P] Add RLS policy for core_clients table with organization_id isolation
- [ ] T038 [P] Add RLS policy for core_services table with organization_id isolation
- [ ] T039 [P] Add RLS policy for core_contractors table with organization_id isolation
- [ ] T040 [P] Add RLS policy for core_contractor_assignments table (via client/contractor relations)
- [ ] T041 [P] Add RLS policy for financial_revenue_records table with organization_id isolation
- [ ] T042 [P] Add RLS policy for financial_expense_records table with organization_id isolation
- [ ] T043 [P] Add RLS policy for analytics_client_metrics table (via client relation)
- [ ] T044 [P] Add RLS policy for analytics_company_metrics table with organization_id isolation
- [ ] T045 [P] Add RLS policy for integrations_oauth_tokens table with organization_id isolation
- [ ] T046 [P] Add RLS policy for integrations_sync_logs table with organization_id isolation
- [ ] T047 [P] Add RLS policy for system_financial_targets table with organization_id isolation
- [ ] T048 [P] Add RLS policy for system_growth_scenarios table with organization_id isolation
- [ ] T049 Execute RLS policies in Supabase SQL Editor (copy/paste `prisma/rls-policies.sql`)
- [ ] T050 Verify RLS enabled on all tables in Supabase Studio → Table Editor → Policies tab

**RLS Policy Template** (for each table):
```sql
-- Enable RLS
ALTER TABLE [table_name] ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only access their organization's data
CREATE POLICY "org_isolation_[table_name]" ON [table_name]
  FOR ALL
  USING (
    organization_id = (
      SELECT organization_id FROM auth.users WHERE id = auth.uid()
    )
  );
```

**Verification**:
- ✅ All 13 tables have RLS enabled
- ✅ All tables have organization isolation policy
- ✅ Test: Cross-organization query returns empty results
- ✅ Test: Service role key bypasses RLS (for Edge Functions)

**Parallel Execution Example**:
Tasks T036-T048 can be executed in parallel - each policy is independent SQL.

---

## Phase 6: Seed Data & Testing

**Goal**: Create test data for development and verify schema functionality

**Prerequisites**: Phase 5 complete

### Seed Data Tasks

- [ ] T051 Create seed script file: `prisma/seed.ts`
- [ ] T052 Add seed configuration to `package.json` with prisma.seed property
- [ ] T053 [P] Implement Organization seed data in `prisma/seed.ts` (create "Test Agency")
- [ ] T054 [P] Implement Service seed data in `prisma/seed.ts` (create "Web Development" service)
- [ ] T055 [P] Implement Client seed data in `prisma/seed.ts` (create "Acme Corp" client)
- [ ] T056 [P] Implement Contractor seed data in `prisma/seed.ts` (create test contractor)
- [ ] T057 [P] Implement ContractorAssignment seed data in `prisma/seed.ts`
- [ ] T058 [P] Implement RevenueRecord seed data in `prisma/seed.ts` (sample revenue)
- [ ] T059 [P] Implement ExpenseRecord seed data in `prisma/seed.ts` (contractor cost)
- [ ] T060 Execute seed: `npx prisma db seed`
- [ ] T061 Verify seed data in Prisma Studio: `npx prisma studio`
- [ ] T062 Test soft delete: Delete a client and verify deleted_at is set
- [ ] T063 Test encryption: Store encrypted OAuth token and verify decryption
- [ ] T064 Test query performance: Seed 1000+ records and measure query time (<500ms)

**Verification**:
- ✅ Seed creates organization, clients, services, contractors, assignments, revenue, expenses
- ✅ All foreign key relationships are correct
- ✅ No constraint violations during seed
- ✅ Soft delete works: deleted records have deleted_at timestamp
- ✅ Queries exclude soft-deleted records by default
- ✅ OAuth token encryption/decryption round-trip succeeds

**Parallel Execution Example**:
Tasks T053-T059 can be worked on in parallel if creating modular seed functions.

---

## Phase 7: Documentation & Polish

**Goal**: Complete documentation for schema and usage patterns

**Prerequisites**: Phase 6 complete

### Documentation Tasks

- [ ] T065 [P] Generate ERD diagram: `npx prisma-erd-generator` (if package installed)
- [ ] T066 [P] Create DATABASE.md with schema overview, table descriptions, and common query patterns
- [ ] T067 [P] Document RLS policies in DATABASE.md with explanation of multi-tenancy
- [ ] T068 [P] Document soft delete behavior in DATABASE.md with query examples
- [ ] T069 [P] Document encryption utilities in DATABASE.md with usage examples
- [ ] T070 Update project README.md with database setup instructions
- [ ] T071 Create example queries file: `docs/example-queries.ts` with common patterns
- [ ] T072 Add database connection troubleshooting to DATABASE.md

**File: `DATABASE.md`** (outline)
- Schema Overview
- Table Descriptions (all 13 tables)
- Entity Relationships
- Common Query Patterns
- RLS Policy Explanations
- Soft Delete Behavior
- Encryption Utilities
- Performance Considerations
- Troubleshooting

**File: `docs/example-queries.ts`**
- Get active clients with metrics
- Calculate revenue for period
- Get contractor utilization
- Hierarchical margin target lookup
- Create revenue record with encryption

**Verification**:
- ✅ DATABASE.md covers all tables and relationships
- ✅ Common query patterns documented with TypeScript examples
- ✅ RLS policies explained clearly
- ✅ README.md updated with setup instructions
- ✅ ERD diagram generated (if applicable)

**Parallel Execution Example**:
Tasks T065-T072 can be executed in parallel - independent documentation tasks.

---

## Dependencies & Execution Order

### Critical Path (Sequential)
```
Phase 1 (Setup) → Phase 2 (Schema) → Phase 3 (Migration) → Phase 4 (Client) → Phase 5 (RLS) → Phase 6 (Seed) → Phase 7 (Docs)
```

### Within-Phase Parallelization

**Phase 2 (Schema Definition)**: Tasks T007-T020 parallelizable (14 parallel tasks)
**Phase 4 (Utilities)**: Tasks T031-T033 parallelizable (3 parallel tasks)
**Phase 5 (RLS)**: Tasks T036-T048 parallelizable (13 parallel tasks)
**Phase 6 (Seed)**: Tasks T053-T059 parallelizable (7 parallel tasks)
**Phase 7 (Docs)**: Tasks T065-T072 parallelizable (8 parallel tasks)

**Total Parallelization Opportunities**: 45 tasks can be parallelized across phases

---

## Success Criteria

### Schema Completeness
- [ ] All 13 tables created with correct column types
- [ ] All 9 enums defined
- [ ] All foreign key relationships established
- [ ] All indexes created on high-traffic columns

### Security & Isolation
- [ ] RLS policies enforce organization-level data isolation
- [ ] Cross-organization queries return empty results
- [ ] Service role can bypass RLS for admin operations
- [ ] OAuth tokens encrypted at rest

### Functionality
- [ ] Soft deletes work for Client, Service, Contractor models
- [ ] Prisma Client provides full TypeScript autocomplete
- [ ] Seed data populates successfully
- [ ] No constraint violations

### Performance
- [ ] Queries return results in <500ms for 10K records
- [ ] Indexes improve query performance measurably
- [ ] Connection pooling configured correctly

### Documentation
- [ ] DATABASE.md documents all tables and relationships
- [ ] Common query patterns provided
- [ ] Setup instructions in README.md
- [ ] Troubleshooting guide available

---

## MVP Scope

**Minimum Viable Product** (for first integration):
- Phase 1: Setup ✅
- Phase 2: Schema Definition ✅
- Phase 3: Migration ✅
- Phase 4: Client Generation ✅ (skip middleware/encryption initially)
- Phase 5: RLS (skip - add later)
- Phase 6: Basic seed data only
- Phase 7: Minimal README updates

**Can be added incrementally**:
- Soft delete middleware (Phase 4)
- Encryption utilities (Phase 4)
- Complete RLS policies (Phase 5)
- Full seed dataset (Phase 6)
- Complete documentation (Phase 7)

---

## Implementation Strategy

### Day 1: Core Schema
- Complete Phase 1 (Setup)
- Complete Phase 2 (Schema Definition)
- Complete Phase 3 (Migration)
- **Goal**: Database tables created and ready

### Day 2: Client & Utilities
- Complete Phase 4 (Client & Utilities)
- Start Phase 5 (RLS) - at least core tables
- **Goal**: Type-safe client working, basic security in place

### Day 3: Security & Data
- Complete Phase 5 (RLS)
- Complete Phase 6 (Seed Data)
- **Goal**: Multi-tenancy enforced, test data available

### Day 4: Testing & Documentation
- Complete Phase 6 testing tasks
- Complete Phase 7 (Documentation)
- **Goal**: Schema validated, documented, ready for integration

### Day 5: Buffer & Integration Testing
- Address any issues from Days 1-4
- Integration testing with Next.js application
- **Goal**: Schema integrated and working in application

---

## Next Steps After Completion

1. **Xero OAuth Integration** - Uses `integrations_oauth_tokens`, `financial_revenue_records`
2. **Mercury Sync Service** - Uses `financial_expense_records`, `integrations_sync_logs`
3. **Margin Calculation Engine** - Uses `analytics_client_metrics`, `analytics_company_metrics`
4. **Dashboard UI** - Queries all tables via Prisma Client

**Ready to implement?** Start with Task T001!

---

## Quick Reference

### Essential Commands
```bash
# Prisma Workflow
npx prisma format          # Format schema
npx prisma validate        # Validate schema
npx prisma migrate dev     # Create and apply migration
npx prisma generate        # Generate Prisma Client
npx prisma studio          # Open database GUI
npx prisma db seed         # Run seed script

# Development
npx prisma migrate reset   # Reset DB (dev only)
npx prisma db push         # Push schema changes (prototyping)
npx prisma db pull         # Introspect existing DB

# Production
npx prisma migrate deploy  # Apply migrations to prod
```

### Key Files
- `prisma/schema.prisma` - Schema definition
- `prisma/migrations/` - Migration history
- `prisma/seed.ts` - Seed data script
- `prisma/rls-policies.sql` - Row Level Security policies
- `lib/prisma.ts` - Prisma Client singleton
- `lib/prisma-middleware.ts` - Soft delete logic
- `lib/encryption.ts` - OAuth token encryption
- `.env` - Database connection strings

---

**Total Implementation Time**: 3-5 days (40-64 tasks depending on parallelization)
**Parallelization Factor**: Up to 45 tasks can be parallelized
**Critical Path**: 7 sequential phases
