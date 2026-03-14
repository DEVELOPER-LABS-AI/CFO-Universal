# Research: Cap Table MVP

**Created**: 2026-03-03
**Feature**: [spec.md](spec.md)

---

## R-1: Shareable Link Token Strategy

**Decision**: Use HMAC-SHA256 signed tokens via Node.js native `crypto` module.

**Rationale**: The codebase already uses `crypto.createHmac('sha256', key)` for Xero webhook signature verification (`app/api/webhooks/xero/route.ts`). Reusing the same pattern avoids adding a new dependency (like `jose` or `jsonwebtoken`). The token payload is simple (org ID + expiry timestamp), so a full JWT library is unnecessary overhead.

**Token Format**:
- Payload: `{orgId}:{expiryTimestamp}` (Unix seconds)
- Signature: HMAC-SHA256 of payload using `CAP_TABLE_SHARE_SECRET` env var
- URL token: `base64url(payload).base64url(signature)`
- Validation: recompute HMAC, compare signatures, check expiry < now

**Alternatives Considered**:
- `jose` library (JWT): Overkill for a single-purpose signed URL; adds dependency
- `jsonwebtoken`: Same concern; also not Edge-compatible without polyfills
- Database-stored tokens: Adds a table and lookup; signed tokens are stateless

**Revocation Strategy**: Maintain an in-memory or small DB denylist of revoked token prefixes. For MVP, rotating the `CAP_TABLE_SHARE_SECRET` env var revokes all outstanding links (acceptable given low volume of ~3 owners).

---

## R-2: Data Model Design (Separate Tables vs. Embedded)

**Decision**: Four separate Prisma models: `CapTableStakeholder`, `ShareClass`, `EquityHolding`, `EquityTransaction`. All scoped by `organization_id`.

**Rationale**: The spec defines four distinct data requirements (DR-1 through DR-4) with clear relationships. Separate tables allow:
- Transaction-based audit history (append-only ledger)
- Point-in-time view reconstruction from transaction ledger
- Multiple share classes per stakeholder (future-proof for Preferred shares)
- Clean separation of concerns for CRUD operations

**Alternatives Considered**:
- Single `cap_table_entries` table with JSON fields: Loses referential integrity, makes querying share classes difficult
- Embedding holdings in stakeholder: Breaks when a stakeholder holds multiple share classes

---

## R-3: Point-in-Time View Implementation

**Decision**: Derive historical cap table state by replaying transactions from the `EquityTransaction` ledger up to the requested date.

**Rationale**: The spec requires that "cap table state can be reconstructed from the transaction history" (FR-4). Rather than storing snapshots for every state change, we replay the transaction log:
1. Query all transactions where `transaction_date <= requested_date` ordered by date
2. For each transaction, apply the share delta to the running stakeholder balances
3. Return the computed ownership table

**Performance**: With ~3 owners and low transaction volume (maybe 10-20 lifetime for an MVP), replay is O(n) where n is tiny. No caching needed.

**Alternatives Considered**:
- Snapshot table per state change: Duplicates data; overkill for 3 owners
- Event sourcing framework: Extreme overhead for this scale

---

## R-4: Ownership Percentage Calculation

**Decision**: Calculate ownership percentages dynamically from `shares_held / total_issued_shares * 100`, not stored.

**Rationale**: Percentages are a derived value that must always be consistent with share counts. Storing them creates a cache-invalidation problem. The calculation is trivial arithmetic.

**Precision**: Use `Decimal(8, 4)` for percentage display (supports 4 decimal places per spec edge case). Total issued shares derived as `SUM(shares_held)` across all EquityHolding records for the organization.

**Alternatives Considered**:
- Stored percentage column: Creates sync risk; needs recalculation on every transaction anyway

---

## R-5: PDF Export Approach

**Decision**: Browser print-to-PDF with dedicated print CSS on the shared view page.

**Rationale**: Per clarification, the shared view page already needs a clean, professional layout. Adding `@media print` styles to hide navigation, adjust margins, and optimize typography is zero-dependency. Users trigger the browser print dialog and save as PDF.

**Implementation**:
- Add print-specific Tailwind classes or `@media print` block in global CSS
- Hide interactive elements (share button, navigation) in print
- Optimize chart rendering (static SVG chart renders well in print)
- Add page title with company name and date

**Alternatives Considered**:
- Server-side Puppeteer: Adds heavy dependency, requires headless Chrome
- react-pdf: Different rendering engine than web; would need duplicate layout

---

## R-6: Stakeholder Independence (No User FK)

**Decision**: `CapTableStakeholder` has no foreign key to `UserProfile` or Supabase auth. Stakeholders are standalone records.

**Rationale**: Per clarification, not all equity holders will have application accounts. Investors, advisors, and future stakeholders may never log in. Coupling stakeholders to users would block adding external parties.

**Alternatives Considered**:
- Optional `user_id` FK: Adds complexity for linking; deferred to future "Investor portal" enhancement

---

## R-7: Equity Holding vs. Direct Shares on Stakeholder

**Decision**: Use a separate `EquityHolding` junction table between `CapTableStakeholder` and `ShareClass`.

**Rationale**: Although MVP only has Common shares, the spec explicitly states "the data model should accommodate" Preferred shares. A junction table allows a stakeholder to hold shares across multiple classes without restructuring.

**Alternatives Considered**:
- Direct `shares_held` column on stakeholder: Breaks for multiple share classes

---

## R-8: Chart Library for Ownership Visualization

**Decision**: Use Recharts `PieChart` component (already installed, v3.7.0).

**Rationale**: The codebase already uses Recharts PieChart in `components/analytics/CostBreakdownChart.tsx` with a donut chart pattern. The ownership distribution pie chart follows the identical pattern — donut chart with percentage labels and custom center text showing total shares.

**Alternatives Considered**:
- Tremor: Also available in the project but Recharts is already used for pie charts
- Custom SVG: Unnecessary when Recharts handles it

---

## R-9: Navigation Placement

**Decision**: Add "Cap Table" as a new item under the "Insights" group in the dashboard sidebar, after "Projects".

**Rationale**: The cap table is a strategic/analytical tool for owners and admins, not a transactional feature. It fits naturally alongside CFO Strategist, Analytics, and Projects in the Insights group. Access control will restrict visibility to Admin and Executive roles.

**Alternatives Considered**:
- New top-level group "Equity": Over-engineering for a single page
- Under "Admin": Too hidden; owners (Executives) need easy access

---

## R-10: RLS Policy Design

**Decision**: Standard `organization_id`-based RLS policies on all four cap table tables, matching the existing pattern.

**Rationale**: The constitution requires all data scoped by `organization_id` with RLS enforcement. The cap table follows the same pattern as every other feature. The shared view route bypasses RLS by using a service-role client (since the viewer has no session), with the organization scoped by the signed token.

**Implementation**:
- `SELECT/INSERT/UPDATE/DELETE` policies with `organization_id = get_user_organization_id()`
- Shared view API route uses Supabase service role client with explicit org filter from token
