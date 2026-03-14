# Implementation Plan: Cap Table MVP

**Created**: 2026-03-03
**Feature**: [spec.md](spec.md)
**Research**: [research.md](research.md)
**Data Model**: [data-model.md](data-model.md)
**Contracts**: [contracts/](contracts/)
**Quickstart**: [quickstart.md](quickstart.md)

---

## Technical Context

### Existing Architecture

| Component | Current State | Impact |
|-----------|--------------|--------|
| **Prisma Schema** | Organization model with 20+ relations; no cap table tables | Add 4 new models + 1 enum + 3 relations on Organization |
| **Authentication** | `requireAuth()`, `requireAdmin()` helpers; `getOrganizationId()` for multi-tenant | Reuse for cap table access control |
| **Middleware** | Supabase session refresh; public routes list | Add `/share/cap-table` to public routes |
| **Dashboard Sidebar** | Insights group: CFO Strategist, Analytics, Projects | Add "Cap Table" item after Projects |
| **Recharts** | PieChart used in CostBreakdownChart.tsx (donut pattern) | Reuse for ownership distribution chart |
| **HMAC/crypto** | Used for Xero webhook signature verification | Reuse pattern for share token signing |
| **Server Actions** | Pattern: Zod parse → getOrganizationId → Prisma query → revalidatePath | Follow same pattern for all cap table actions |
| **RLS Policies** | `get_user_organization_id()` function exists; policies on all core tables | Add matching policies for 4 new tables |
| **Print CSS** | None exists in project | New `@media print` styles needed |

### Dependencies

| Dependency | Status | Risk |
|------------|--------|------|
| Prisma schema migration | Ready | Low — additive changes only (new tables, no modifications) |
| Supabase Auth (Feature 2) | Complete | None — reuse existing auth helpers |
| RLS Policies (Feature 8) | Complete | None — reuse existing `get_user_organization_id()` |
| Node.js `crypto` module | Built-in | None — already used in webhook verification |
| Recharts v3.7.0 | Installed | None — PieChart component already used |

### Unknowns Resolved

All unknowns resolved in [research.md](research.md):
- R-1: HMAC-SHA256 signed tokens via native `crypto` (no new deps)
- R-2: Four separate Prisma models (Stakeholder, ShareClass, Holding, Transaction)
- R-3: Point-in-time via transaction replay (no snapshots)
- R-4: Dynamic ownership percentage calculation (not stored)
- R-5: Browser print-to-PDF with `@media print` CSS
- R-6: Stakeholders are independent records (no user FK)
- R-7: EquityHolding junction table for multi-class support
- R-8: Recharts PieChart (existing donut pattern)
- R-9: Sidebar placement under Insights group
- R-10: Standard org-based RLS policies

---

## Constitution Check

| Principle | Compliance | Notes |
|-----------|-----------|-------|
| 1. Technology Stack | PASS | Next.js Server Actions, Prisma, shadcn/ui, Recharts |
| 2. Data Architecture | PASS | `organization_id` on all entities, RLS policies |
| 3. Integration Philosophy | N/A | No external system integration |
| 4. Security Requirements | PASS | RLS enforcement, HMAC-signed share tokens, audit trail via transaction ledger |
| 5. Performance Standards | PASS | Indexed queries, O(n) replay for ~20 transactions max at MVP scale |
| 6. Code Quality | PASS | TypeScript strict, Zod validation, Prisma-generated types |
| 7. Development Workflow | PASS | Feature branch `11-cap-table`, spec-driven |
| 8. Prisma-Supabase | PASS | Pooler URLs, `migrate dev` workflow, `generate` after changes |

### Constitution Gates

- [x] Multi-tenant isolation (`organization_id` on CapTableStakeholder, ShareClass, EquityTransaction)
- [x] UUID primary keys on all tables
- [x] `created_at`/`updated_at` timestamps on all entities
- [x] Soft delete with `deleted_at` on CapTableStakeholder and ShareClass
- [x] Prisma-managed schema (no raw SQL for schema)
- [x] Server Actions for all mutations
- [x] Zod validation on all inputs
- [x] Indexed foreign keys

**Deviation**: `EquityTransaction` has no `updated_at` field. Transactions are append-only by spec requirement — they are never modified, only reversed with offsetting entries. This preserves audit integrity.

---

## Implementation Phases

### Phase 1: Schema & Migration (Foundation)

**Goal**: Create the 4 cap table tables and enum in the database.

**Files**:
| File | Action |
|------|--------|
| `prisma/schema.prisma` | ADD `EquityTransactionType` enum, `CapTableStakeholder`, `ShareClass`, `EquityHolding`, `EquityTransaction` models, relations on Organization |

**Steps**:
1. Verify DB connection: `npx prisma migrate status`
2. Add `EquityTransactionType` enum (GRANT, TRANSFER, PURCHASE, CANCELLATION)
3. Add all 4 models per [data-model.md](data-model.md)
4. Add relations to Organization model
5. Run: `npx prisma migrate dev --name add-cap-table`
6. Run: `npx prisma generate`
7. Verify: `npx prisma migrate status`

**Acceptance**: Tables created, Prisma Client generated, build passes.

---

### Phase 2: RLS Policies

**Goal**: Secure all cap table tables with organization-scoped RLS policies.

**Files**:
| File | Action |
|------|--------|
| `supabase/sql/011_cap_table_rls_policies.sql` | NEW — RLS policies for 4 cap table tables |

**Steps**:
1. Enable RLS on all 4 tables
2. Create SELECT/INSERT/UPDATE/DELETE policies using `get_user_organization_id()`
3. EquityHolding: policy via subquery on stakeholder's `organization_id`
4. Apply via Supabase dashboard or migration

**Acceptance**: Queries without valid session return empty results. Cross-org data inaccessible.

---

### Phase 3: Validation Schemas & Calculation Logic

**Goal**: Define input validation and core calculation functions.

**Files**:
| File | Action |
|------|--------|
| `lib/validations/cap-table.ts` | NEW — Zod schemas for all cap table inputs |
| `lib/calculations/cap-table.ts` | NEW — Ownership calculation, point-in-time replay |
| `lib/cap-table/share-token.ts` | NEW — HMAC token generation and validation |

**Validation schemas** per [contracts/server-actions.md](contracts/server-actions.md):
- `createShareClassSchema`, `updateShareClassSchema`
- `createStakeholderSchema`, `updateStakeholderSchema`, `removeStakeholderSchema`
- `recordTransactionSchema` (with `superRefine` for type-specific stakeholder requirements)
- `generateShareLinkSchema`, `asOfDateSchema`

**Calculation functions**:
- `calculateOwnershipPercentages(holdings, totalIssued)` — derive percentages from share counts
- `replayTransactionsAsOfDate(transactions, date)` — reconstruct holdings at a point in time
- `validateShareAvailability(shareClassId, sharesRequested)` — check available shares

**Share token functions**:
- `generateShareToken(orgId, expiresInDays)` — create signed URL token
- `validateShareToken(token)` — verify signature and expiry, return orgId

**Acceptance**: All schemas validate correctly. Calculation functions handle edge cases (zero shares, 100% single owner, fractional percentages).

---

### Phase 4: Server Actions (CRUD)

**Goal**: Implement all cap table mutations and queries as server actions.

**Files**:
| File | Action |
|------|--------|
| `app/actions/cap-table.ts` | NEW — All cap table server actions |

**Actions** per [contracts/server-actions.md](contracts/server-actions.md):
- `createShareClass`, `updateShareClass`
- `createStakeholder`, `updateStakeholder`, `removeStakeholder`
- `recordEquityTransaction` (Prisma `$transaction` for atomicity)
- `getCapTableSummary`, `getTransactionHistory`, `getCapTableAsOfDate`
- `generateShareLink`

**Key patterns**:
- All mutations wrapped in `getOrganizationId()` scope
- `recordEquityTransaction` uses Prisma interactive transaction to atomically create transaction + update holdings
- All Decimal fields serialized to `Number()` before returning
- `revalidatePath('/dashboard/cap-table')` after mutations

**Acceptance**: Full CRUD lifecycle works. Transaction recording correctly updates holdings. Share limits enforced.

---

### Phase 5: Shared View API & Page

**Goal**: Implement the public shareable cap table view.

**Files**:
| File | Action |
|------|--------|
| `app/api/share/cap-table/[token]/route.ts` | NEW — Public API route for token validation + data |
| `app/share/cap-table/[token]/page.tsx` | NEW — Public read-only cap table page |
| `middleware.ts` | MODIFY — Add `/share/cap-table` to public routes |

**API route logic**:
1. Extract token from params
2. Validate with `validateShareToken()` — returns orgId or throws
3. Query cap table using Prisma with explicit `organization_id` filter (service-level, not session-based)
4. Return cap table summary JSON

**Public page**:
- Server Component fetching data from the API route
- Clean, branded layout with company name and date
- Ownership table + pie chart
- "Print / Save as PDF" button (`window.print()`)
- No navigation, no edit controls

**Middleware update**:
- Add `/share/cap-table` prefix to the public routes list

**Acceptance**: Shareable link opens a clean, read-only view. Invalid/expired tokens show appropriate error. Print produces clean output.

---

### Phase 6: Dashboard UI

**Goal**: Build the main cap table management interface.

**Files**:
| File | Action |
|------|--------|
| `app/dashboard/cap-table/page.tsx` | NEW — Main cap table dashboard page |
| `components/cap-table/OwnershipTable.tsx` | NEW — Stakeholder summary table |
| `components/cap-table/OwnershipChart.tsx` | NEW — Donut chart (Recharts PieChart) |
| `components/cap-table/TransactionLedger.tsx` | NEW — Transaction history table |
| `components/cap-table/AddStakeholderModal.tsx` | NEW — Create/edit stakeholder form |
| `components/cap-table/RecordTransactionModal.tsx` | NEW — Record equity transaction form |
| `components/cap-table/ShareClassConfig.tsx` | NEW — Share class management panel |
| `components/cap-table/ShareLinkDialog.tsx` | NEW — Generate shareable link dialog |
| `components/cap-table/PointInTimeSelector.tsx` | NEW — Date picker for historical view |
| `components/dashboard/Sidebar.tsx` | MODIFY — Add Cap Table nav item under Insights |

**Page layout**:
- Top: Share class summary cards (authorized, issued, reserved, available)
- Middle-left: Ownership table with stakeholder names, roles, shares, percentages
- Middle-right: Donut chart showing ownership distribution
- Bottom: Transaction history ledger (chronological)
- Actions: Add Stakeholder, Record Transaction, Configure Share Classes, Share/Export, View as of Date

**Sidebar update**:
- Add `{ name: 'Cap Table', href: '/dashboard/cap-table', icon: PieChart }` under Insights group, after Projects

**Acceptance**: Full management UI works. All CRUD operations accessible. Chart renders correctly. Point-in-time view shows historical state.

---

### Phase 7: Print CSS & Polish

**Goal**: Add print-optimized styles and final UX polish.

**Files**:
| File | Action |
|------|--------|
| `app/globals.css` | MODIFY — Add `@media print` styles |
| `app/share/cap-table/[token]/page.tsx` | MODIFY — Print-specific layout adjustments |

**Print styles**:
- Hide navigation, footer, interactive buttons
- Full-width table layout
- Chart renders as static SVG (Recharts default)
- Page title with company name and date
- Clean margins and font sizing

**Acceptance**: Browser print produces a professional, single-page PDF suitable for investor sharing.

---

## Risk Mitigation

| Risk | Mitigation |
|------|-----------|
| `CAP_TABLE_SHARE_SECRET` not set | Fail gracefully with clear error message; sharing feature unavailable without it |
| Transaction replay performance | MVP has ~20 max transactions; if scale grows, add snapshot caching later |
| HMAC token brute-force | 256-bit HMAC is computationally infeasible to brute-force; rate limit share API route |
| Concurrent transaction recording | Prisma `$transaction` ensures atomicity; database constraints prevent over-issuance |
| Print CSS browser inconsistencies | Test on Chrome (primary) and Safari; both handle `@media print` well |
| Recharts chart not printing | Recharts renders SVG which prints natively; verified in existing CostBreakdownChart |

---

## Files Summary

### New Files (16)
| File | Purpose |
|------|---------|
| `lib/validations/cap-table.ts` | Zod schemas for all cap table inputs |
| `lib/calculations/cap-table.ts` | Ownership calculation, point-in-time replay |
| `lib/cap-table/share-token.ts` | HMAC token generation and validation |
| `app/actions/cap-table.ts` | Server actions for all cap table CRUD |
| `app/dashboard/cap-table/page.tsx` | Main cap table dashboard page |
| `app/api/share/cap-table/[token]/route.ts` | Public API for token validation + data |
| `app/share/cap-table/[token]/page.tsx` | Public shared view page |
| `components/cap-table/OwnershipTable.tsx` | Stakeholder summary table |
| `components/cap-table/OwnershipChart.tsx` | Donut chart (Recharts PieChart) |
| `components/cap-table/TransactionLedger.tsx` | Transaction history table |
| `components/cap-table/AddStakeholderModal.tsx` | Create/edit stakeholder form |
| `components/cap-table/RecordTransactionModal.tsx` | Record equity transaction form |
| `components/cap-table/ShareClassConfig.tsx` | Share class management panel |
| `components/cap-table/ShareLinkDialog.tsx` | Generate shareable link dialog |
| `components/cap-table/PointInTimeSelector.tsx` | Date picker for historical view |
| `supabase/sql/011_cap_table_rls_policies.sql` | RLS policies for cap table tables |

### Modified Files (4)
| File | Changes |
|------|---------|
| `prisma/schema.prisma` | Add EquityTransactionType enum + 4 models + Organization relations |
| `components/dashboard/Sidebar.tsx` | Add Cap Table nav item under Insights |
| `middleware.ts` | Add `/share/cap-table` to public routes |
| `app/globals.css` | Add `@media print` styles |
