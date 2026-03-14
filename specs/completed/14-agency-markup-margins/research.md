# Research: Agency Staff True Cost & Markup Transparency

**Created**: 2026-03-05
**Feature**: 14-agency-markup-margins

---

## R1: Schema Extension Strategy for Markup Fields

**Decision**: Add fields directly to existing Agency and Staff models rather than creating separate junction/config tables.

**Rationale**: The markup configuration is a 1:1 relationship with Agency (one default markup per agency) and 1:1 with Staff (one optional override per staff member). Creating separate tables would add unnecessary joins and complexity for what are effectively attribute extensions.

**Alternatives Considered**:
- Separate `AgencyMarkupConfig` table: Rejected - over-normalized for a 1:1 relationship; adds join overhead to every staff cost query
- JSONB config field on Agency: Rejected - loses type safety and indexability; Prisma doesn't validate JSONB structure at schema level
- Inline fields on Agency + Staff: **Chosen** - simple, type-safe via Prisma enums, no migration complexity

---

## R2: Markup Type Representation

**Decision**: Use a Prisma enum `MarkupType` with values `PERCENTAGE` and `FLAT_RATE`. Add a separate `MarkupBasis` enum with values `BASE_PAY` and `TOTAL_COMPENSATION`.

**Rationale**: Enums provide type safety at both the database and application level. The basis is separate from type because flat rate markup applies regardless of basis (only base rate gets the flat addition), while percentage can apply to either base pay or total compensation.

**Alternatives Considered**:
- String fields with application-level validation: Rejected - no DB-level constraint enforcement
- Single combined enum (PERCENTAGE_BASE, PERCENTAGE_TOTAL, FLAT_RATE): Rejected - conflates two orthogonal concepts; harder to extend

---

## R3: True Cost Nullability for Migration

**Decision**: `true_cost` and `true_cost_rate_type` are nullable on the Staff model. New agency staff require true cost; existing records are grandfathered.

**Rationale**: Per clarification session - graceful gap approach. Existing agency staff don't have true cost data and shouldn't block feature launch. Application-level validation enforces "required on create" while the DB allows null for migration.

**Alternatives Considered**:
- Default true_cost to 0: Rejected - misleading; would show 0 cost and infinite margin
- Backfill migration script: Rejected - no source of truth for existing staff true costs
- Non-nullable with migration prompt: Rejected - blocks deployment until all data is backfilled

---

## R4: Rate Lock Implementation

**Decision**: Add `rate_locked` boolean field to Staff model. When true, the `rate` field is treated as manually set and decoupled from the markup formula.

**Rationale**: Per clarification - hybrid approach. The lock is a simple boolean toggle. When locked, `rate` retains its current value regardless of true_cost or markup changes. Margin is still calculated (rate vs true_cost) but the effective markup shown differs from the formula-derived value.

**Alternatives Considered**:
- Separate `locked_rate` decimal field: Rejected - redundant; the existing `rate` field already stores the bill rate
- Versioned rate history: Rejected - out of scope; future enhancement for audit trail

---

## R5: Access Control for True Cost Data

**Decision**: Leverage existing RBAC pattern. True cost, markup, and margin data are restricted to ADMIN and EXECUTIVE roles. AGENCY_ADMIN users see only the bill rate (existing `rate` field).

**Rationale**: The codebase already has `requireAdmin()`, `requireAdminOrExecutive()`, and `requireAgencyAdmin()` helpers in `lib/auth/helpers.ts`. Agency portal actions in `app/actions/agency-portal-actions.ts` already filter by `user.agencyId`. No new auth infrastructure needed - just ensure new margin fields are excluded from agency portal queries and UI.

**Alternatives Considered**:
- Field-level encryption for true_cost: Rejected - over-engineered for this use case; RLS + role checks sufficient
- New "FINANCE" role: Rejected - EXECUTIVE role already covers finance/ops users per existing patterns

---

## R6: Margin Calculation Utility Placement

**Decision**: Create a new `lib/calculations/markup-calculations.ts` module alongside existing `agency-costs.ts`.

**Rationale**: Follows existing pattern where `agency-costs.ts` handles Mercury-based cost queries. New module handles markup formula calculations (true cost + markup = bill rate, margin computation, rate type conversions). Keeps concerns separated and calculations testable.

**Alternatives Considered**:
- Extend `agency-costs.ts`: Rejected - file would grow too large mixing calculation logic with database queries
- Inline in server actions: Rejected - not reusable across actions and UI components
- Database computed columns: Rejected - Prisma doesn't support computed columns; calculations need to work in both server and client contexts

---

## R7: JSONB Breakdown Enhancement

**Decision**: Add `true_cost` field to the staff breakdown item schema within the existing JSONB `breakdown` column on `AgencyMonthlyBreakdown`. No schema migration needed for this - it's a JSONB structure change enforced by Zod validation.

**Rationale**: The breakdown JSONB already stores per-staff `base_pay`, `expenses`, `reimbursements`, and `subtotal`. Adding `true_cost` as an optional field (for backward compatibility with existing breakdowns) follows the established pattern. Historical breakdowns without `true_cost` simply won't show margin data.

**Alternatives Considered**:
- Separate margin tracking table per breakdown: Rejected - breaks the single-source-of-truth design of the breakdown JSONB
- Migrating old JSONB records to add true_cost: Rejected - no source data; old records naturally display without margin info

---

## R8: Constitution Compliance Verification

**Gate Check Results**:

| Principle | Status | Notes |
|-----------|--------|-------|
| P1: Technology Stack | PASS | Next.js Server Actions, Prisma, Tailwind/shadcn - no new tech |
| P2: Data Architecture | PASS | All new fields scoped by organization_id via existing relations |
| P3: Integration Philosophy | PASS | No new external integrations |
| P4: Security Requirements | PASS | RBAC via existing helpers; no new auth flows |
| P5: Performance Standards | PASS | Margin calculations are simple arithmetic on already-fetched data |
| P6: Code Quality | PASS | TypeScript strict mode; Prisma-generated types; Zod validation |
| P7: Development Workflow | PASS | Feature branch 14-agency-markup-margins; spec-driven |
| P8: Prisma-Supabase Alignment | PASS | Will use pooler URLs; standard `prisma migrate dev` workflow |

**Design Constraints Check**:
- UUID primary keys: PASS (no new tables, only new fields)
- Soft deletes: N/A (no new entities requiring soft delete)
- created_at/updated_at: N/A (fields added to existing models that already have these)
- Server Actions for mutations: PASS
- Zod validation: PASS (extending existing schemas)
