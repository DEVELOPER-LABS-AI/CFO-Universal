# Research: CFO Strategist

**Created**: 2026-02-27
**Feature**: [spec.md](spec.md)

---

## Decision 1: Recommendation Engine Data Sources

**Decision**: Reuse existing calculation engines as the primary data sources for all recommendation logic.

**Rationale**: The codebase already has mature calculation functions in `lib/calculations/` that compute exactly the metrics the recommendation engine needs: client revenue, cost breakdowns by category, overhead allocation, subscription trends, contractor trends, and BDR ROI. Building on top of these avoids duplicating logic and ensures consistency with the Portfolio and Analytics pages.

**Data Source Mapping**:
| Recommendation Category | Primary Data Source | Key Functions |
|------------------------|---------------------|---------------|
| Subscription Optimization | `subscription-cost-calculator.ts`, `trend-reporter.ts` | `computeSubscriptionPeriodCost()`, `getSubscriptionTrend()`, `detectCostChangeAndNotify()` |
| Staffing Efficiency | `client-roi.ts`, `bdr-roi.ts`, `agency-costs.ts` | `calculateClientCosts()`, `calculateAttributedRevenue()`, `calculateBDRTotalCost()` |
| Revenue Opportunities | `client-roi.ts`, `trend-reporter.ts` | `getClientRevenue()`, `computeTrend()` |
| Overhead Reduction | `overhead-allocation.ts`, `agency-costs.ts` | `calculateOverheadAllocation()`, `getAllAgencyAvgMonthlySpend()` |

**Alternatives Considered**:
- Raw Prisma queries directly: Rejected because it would duplicate logic already encoded in the calculation engines
- Pre-aggregated materialized views: Overkill for current scale; can be added later if performance demands

---

## Decision 2: Margin Goal Storage

**Decision**: Use the existing `FinancialTarget` model for company-wide margin goals (scope=GLOBAL) and the existing `custom_margin_target` field on the `Client` model for per-client overrides.

**Rationale**: The `FinancialTarget` model already exists with `scope` (GLOBAL/SERVICE/CLIENT), `target_margin`, and `fiscal_period` fields. The `Client` model already has `custom_margin_target`. Reusing these avoids schema bloat and aligns with the existing data architecture.

**Alternatives Considered**:
- New `MarginGoal` model: Rejected - duplicates existing `FinancialTarget` purpose
- Organization-level field: Rejected - `FinancialTarget` with scope=GLOBAL is more flexible (supports fiscal periods)

---

## Decision 3: Recommendation Storage

**Decision**: Create a new `CfoRecommendation` Prisma model with identity-based deduplication via a composite unique constraint on `(organization_id, category, target_entity_type, target_entity_id)`.

**Rationale**: No existing model fits. The recommendation lifecycle (active/dismissed/deferred/acted_on) with metric snapshots and impact tracking requires dedicated storage. The identity constraint ensures nightly recomputation preserves user actions on existing recommendations.

**Alternatives Considered**:
- JSON blob in Organization: Rejected - no queryability, no history
- Notification model reuse: Rejected - different lifecycle (notifications are read/archived, recommendations are acted on/dismissed/deferred with impact tracking)

---

## Decision 4: Report Storage

**Decision**: Create a new `CfoReport` Prisma model storing structured JSON report content with a unique constraint on `(organization_id, report_type, period_start)`.

**Rationale**: Reports need historical access and comparison across periods. Storing as structured JSON in a dedicated model allows rendering historical reports without recomputation while keeping the schema simple.

**Alternatives Considered**:
- Re-compute on demand: Rejected - historical data may change (e.g., late Mercury syncs), so snapshots preserve point-in-time accuracy
- Separate tables per report type: Rejected - unnecessary complexity for 3 report types

---

## Decision 5: Nightly Computation Trigger

**Decision**: Add a new Vercel cron endpoint at `/api/cron/cfo-strategist` scheduled to run after the existing Mercury/Xero sync jobs (at 3 AM UTC, since syncs run at 2 AM UTC).

**Rationale**: The existing cron pattern uses Vercel cron with `CRON_SECRET` auth headers. Running 1 hour after data sync ensures fresh data is available. The cron handler will: refresh all client ROI calculations, run the recommendation engine, generate daily/weekly/monthly reports as applicable, and create alerts.

**Alternatives Considered**:
- Webhook triggered by sync completion: More complex, requires modifying existing sync code
- On-demand only: Doesn't meet the "daily briefing available by start of business day" requirement

---

## Decision 6: Dashboard UI Pattern

**Decision**: Follow the existing Analytics page pattern - a `'use client'` component fetching data via Server Actions, using Recharts for charts and shadcn/ui Card components for KPI summaries.

**Rationale**: The codebase consistently uses this pattern. No TanStack Query is used. Server Actions with direct Prisma queries are the standard data-fetching mechanism. Recharts is the only charting library in use.

**Alternatives Considered**:
- Server Component with streaming: More complex, not the established pattern in this codebase
- TanStack Query: Not used anywhere in the codebase, would introduce inconsistency

---

## Decision 7: Navigation Placement

**Decision**: Add "CFO Strategist" under the existing "Insights" navGroup in `Sidebar.tsx`, alongside Analytics. Use `Target` icon from lucide-react.

**Rationale**: Per clarification session, the user chose to place it under Insights. The sidebar uses a `navGroups` array - adding a new item requires only inserting into the existing array.

**Alternatives Considered**:
- New top-level "Strategy" group: User chose Option B (under Insights)
- Replace main dashboard: Too disruptive

---

## Decision 8: Recommendation Confidence Scoring

**Decision**: Use a simple rule-based confidence scoring system with 3 tiers: High (0.8-1.0) when based on 3+ months of data with clear trends, Medium (0.5-0.79) when based on 2 months or partial data, Low (0.2-0.49) when based on 1 month or inferred data.

**Rationale**: The spec explicitly excludes ML models. Rule-based confidence tied to data completeness is transparent, debuggable, and aligns with the linear trend analysis approach.

**Alternatives Considered**:
- Statistical confidence intervals: Overkill for rule-based engine
- Binary (confident/not): Too coarse for prioritization
