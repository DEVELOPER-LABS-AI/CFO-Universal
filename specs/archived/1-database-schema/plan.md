# Implementation Plan: Database Schema for DevLabs CFO System

**Feature**: Database Schema
**Branch**: 1-database-schema
**Created**: 2026-02-12
**Status**: Planning Complete

---

## Executive Summary

This plan details the implementation of a comprehensive PostgreSQL database schema using Supabase and Prisma for the DevLabs CFO profit optimization system. The schema will support multi-tenant SaaS deployment with organization-level data isolation, comprehensive financial data tracking, and pre-calculated analytics for fast dashboard rendering.

**Key Deliverables:**
- Prisma schema definition with 13+ tables across 5 logical schemas
- Row Level Security (RLS) policies for multi-tenant isolation
- Database migrations with seed data for testing
- Type-safe database client with generated Prisma types

**Estimated Complexity**: Medium (3-5 days)

---

## Technical Context

### Technology Stack

**Database Layer:**
- **Supabase PostgreSQL 15+**: Managed database with built-in auth, RLS, and real-time subscriptions
- **Prisma 5.x**: Type-safe ORM with schema-first development and migration tooling
- **pg_cron**: Native PostgreSQL extension for scheduled jobs (sync triggers)

**Development Tools:**
- **Prisma Studio**: GUI for database exploration during development
- **Supabase Studio**: Web-based database management and RLS policy editor
- **Prisma Migrate**: Version-controlled database migrations

**Integration Points:**
- Next.js 16 application will access database via Prisma Client
- Supabase Edge Functions will use service role for admin operations
- External sync services (Xero, Mercury) will write via Edge Functions

### Architecture Decisions

**Decision 1: Prisma over Raw SQL**
- **Rationale**: Type-safe queries, automatic migrations, excellent DX with VS Code IntelliSense
- **Trade-off**: Slightly more verbose than raw SQL, but eliminates runtime type errors
- **Implementation**: Use Prisma schema as single source of truth, generate client after schema changes

**Decision 2: Logical Schema Separation via Naming Convention**
- **Rationale**: PostgreSQL on Supabase uses single public schema; use table prefixes for organization
- **Naming Convention**:
  - `core_*`: organizations, clients, services, contractors, contractor_assignments
  - `financial_*`: revenue_records, expense_records
  - `analytics_*`: client_metrics, company_metrics
  - `integrations_*`: oauth_tokens, sync_logs
  - `system_*`: financial_targets, growth_scenarios
- **Alternative Considered**: Separate PostgreSQL schemas (would complicate RLS policies)

**Decision 3: UUID Primary Keys**
- **Rationale**: Better for distributed systems, no sequential ID leakage, supports future sharding
- **Implementation**: Use `@default(uuid())` in Prisma schema, `cuid()` for client-generated IDs
- **Performance**: Indexed UUIDs have minimal performance impact on PostgreSQL 15+

**Decision 4: Soft Deletes for Core Entities**
- **Rationale**: Preserve historical data for margin calculations and compliance
- **Implementation**: Add `deleted_at DateTime?` to clients, contractors, services
- **Query Pattern**: Add `where: { deleted_at: null }` to default queries, use global middleware

**Decision 5: Separate Metrics Tables for Performance**
- **Rationale**: Pre-calculated metrics avoid expensive joins/aggregations on dashboard load
- **Implementation**: Edge Function triggers recalculate metrics after financial data sync
- **Consistency**: Metrics include `calculated_at` timestamp for cache invalidation

### Constitution Compliance Check

**Mandatory Requirements:**
- ✅ Using Supabase PostgreSQL 15+ (specified in constitution)
- ✅ Using Prisma ORM for schema management
- ✅ All tables include `organization_id` for multi-tenancy
- ✅ UUID primary keys for all entities
- ✅ Soft deletes with `deleted_at` field
- ✅ Timestamps (`created_at`, `updated_at`) on all tables
- ✅ OAuth tokens stored with encryption (encrypted in Prisma string field)
- ✅ 7+ years data retention supported (no automatic archival)

**Security Requirements:**
- ✅ Row Level Security (RLS) policies enforce organization isolation
- ✅ Service role access only in Edge Functions (never client-side)
- ✅ Encrypted fields for sensitive data (OAuth tokens)

**Performance Standards:**
- ✅ Indexed foreign keys for sub-500ms query performance
- ✅ Separate metrics tables for <2s dashboard rendering
- ✅ Support for 1K orgs, 100K clients, 10M transactions

**No Constitution Violations**: All requirements satisfied.

---

## Phase 0: Research & Decisions

### Research Tasks Completed

**1. Prisma Schema Best Practices for Multi-Tenancy**
- **Finding**: Use `@@index([organization_id])` on all tenant-scoped tables
- **Finding**: Combine with Supabase RLS for defense-in-depth
- **Source**: Prisma Multi-Tenancy Guide, Supabase RLS Documentation

**2. Encryption Strategy for OAuth Tokens**
- **Finding**: Store encrypted string in Prisma field, decrypt in Edge Functions only
- **Finding**: Use Supabase Vault (future) or environment variable for encryption key
- **Implementation**: Create utility functions `encryptToken()` / `decryptToken()` using Node crypto

**3. JSON Field Support in Prisma**
- **Finding**: Prisma supports `Json` type for PostgreSQL JSONB columns
- **Use Case**: `growth_scenarios.assumptions` field for flexible simulation data
- **Validation**: Use Zod schema validation before storing JSON

**4. Enum Types vs String Constraints**
- **Decision**: Use Prisma enums for fixed values (status, engagement_type, provider)
- **Rationale**: Type-safe in TypeScript, generates proper PostgreSQL ENUMs
- **Example**: `enum ClientStatus { ACTIVE, INACTIVE, CHURNED }`

**5. Cascading Deletes vs Soft Deletes**
- **Decision**: Soft deletes for core entities, cascading deletes for junction tables only
- **Implementation**:
  - Core tables: `deleted_at DateTime?`
  - Junction tables: `onDelete: Cascade` for foreign keys
  - Orphan prevention: Prevent hard delete if related records exist

### Resolved Unknowns

**Q: How to handle contractor assignments to multiple clients?**
- **A**: Create `core_contractor_assignments` junction table with allocation_percentage
- **Schema**: contractor_id, client_id, start_date, end_date, allocation (0-100)

**Q: How to track which integration synced each record?**
- **A**: Add `sync_source` enum (XERO, MERCURY, MANUAL, IMPORT) to revenue/expense tables
- **A**: Add `external_id` string field to link back to source system record

**Q: How to support client-specific margin targets that override service defaults?**
- **A**: Add `custom_margin_target Decimal?` to clients table (nullable)
- **Logic**: Margin calculation checks client target → service target → global target (hierarchical)

**Q: How to store tier classification (1-5) efficiently?**
- **A**: Use `tier_classification Int` with CHECK constraint (1-5)
- **Alternative**: Could use enum (TIER_1, TIER_2...) but integer is more flexible for calculations

---

## Phase 1: Data Model Design

### Entity-Relationship Overview

```
┌─────────────────┐
│ Organization    │
└────────┬────────┘
         │ 1:N
         ├─────────────────────────────────────┐
         │                                     │
         ↓                                     ↓
┌─────────────────┐                  ┌─────────────────┐
│ Client          │                  │ Service         │
└────────┬────────┘                  └────────┬────────┘
         │ 1:N                                │ 1:N
         ↓                                    ↓
┌─────────────────┐                  ┌─────────────────┐
│ Revenue Record  │──────────────────│ Expense Record  │
└─────────────────┘       N:1        └─────────────────┘
         │ 1:1                                │ N:1
         ↓                                    ↓
┌─────────────────┐                  ┌─────────────────┐
│ Client Metrics  │                  │ Contractor      │
└─────────────────┘                  └────────┬────────┘
                                              │ N:M
         ┌────────────────────────────────────┘
         ↓
┌─────────────────────────┐
│ Contractor Assignment   │
└─────────────────────────┘
```

### Complete Prisma Schema

See [data-model.md](./data-model.md) for the complete Prisma schema with all 13 tables.

---

## Phase 2: Implementation Steps

### Step 1: Initialize Prisma in Project

**Tasks:**
1. Install dependencies:
   ```bash
   npm install @prisma/client
   npm install -D prisma
   ```

2. Initialize Prisma:
   ```bash
   npx prisma init
   ```

3. Configure `.env` with Supabase connection:
   ```env
   DATABASE_URL="postgres://postgres:[password]@db.[project-ref].supabase.co:6543/postgres?pgbouncer=true"
   DIRECT_URL="postgres://postgres:[password]@db.[project-ref].supabase.co:5432/postgres"
   ```

**Verification:**
- ✅ `npx prisma db pull` connects successfully
- ✅ No Prisma schema validation errors

### Step 2: Define Prisma Schema

**File:** `prisma/schema.prisma`

Copy complete schema from data-model.md into schema file.

**Verification:**
- ✅ `npx prisma format` reformats correctly
- ✅ `npx prisma validate` passes
- ✅ VS Code Prisma extension shows no errors

### Step 3: Create Initial Migration

```bash
npx prisma migrate dev --name init_database_schema
```

**Verification:**
- ✅ Migration generates ~800-1000 lines of SQL
- ✅ All 13 tables created
- ✅ All enums and indexes created
- ✅ Supabase Studio shows tables

### Step 4: Generate Prisma Client

```bash
npx prisma generate
```

Create singleton client in `lib/prisma.ts`:

```typescript
import { PrismaClient } from '@prisma/client'

const globalForPrisma = global as unknown as { prisma: PrismaClient }

export const prisma = globalForPrisma.prisma || new PrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
```

**Verification:**
- ✅ TypeScript autocomplete works
- ✅ All model types available

### Step 5: Implement Row Level Security

Create `prisma/rls-policies.sql` and apply RLS policies for all tables.

Example policy:
```sql
ALTER TABLE core_clients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_isolation" ON core_clients
  FOR ALL
  USING (
    organization_id = (
      SELECT organization_id FROM auth.users WHERE id = auth.uid()
    )
  );
```

**Verification:**
- ✅ Cross-org queries return empty results
- ✅ Service role bypasses RLS

### Step 6: Create Seed Data

File: `prisma/seed.ts`

```bash
npx prisma db seed
```

**Verification:**
- ✅ Test data appears in Prisma Studio
- ✅ No constraint violations

### Step 7: Add Soft Delete Middleware

File: `lib/prisma-middleware.ts`

Apply middleware to handle soft deletes automatically.

**Verification:**
- ✅ Delete operations set `deleted_at`
- ✅ Queries exclude soft-deleted records

### Step 8: Create Encryption Utilities

File: `lib/encryption.ts`

Implement `encryptToken()` and `decryptToken()` functions.

**Verification:**
- ✅ Round-trip encryption test passes
- ✅ Can store/retrieve encrypted tokens

### Step 9: Documentation

Generate:
- ERD diagram (`npx prisma-erd-generator`)
- DATABASE.md with schema documentation
- Update README.md

---

## Testing Strategy

### Unit Tests
- Soft delete functionality
- Token encryption/decryption
- Enum value validation

### Integration Tests
- Multi-tenancy isolation
- Cascading deletes
- Foreign key constraints

### Performance Tests
- Query performance <500ms for 10K records
- Index effectiveness
- Bulk insert operations

---

## Success Criteria

- [ ] All 13 tables created successfully
- [ ] Prisma Client generates TypeScript types
- [ ] RLS policies enforce organization isolation
- [ ] Soft deletes work correctly
- [ ] OAuth token encryption functional
- [ ] Seed data populates without errors
- [ ] Query performance meets standards
- [ ] All tests pass
- [ ] Documentation complete

---

## Next Steps

Ready for `/speckit.tasks` to generate actionable implementation checklist.

Subsequent features will build on this foundation:
- Xero OAuth integration (uses oauth_tokens table)
- Mercury sync service (uses revenue/expense tables)
- Margin calculation engine (uses metrics tables)
- Dashboard UI (queries all tables)
