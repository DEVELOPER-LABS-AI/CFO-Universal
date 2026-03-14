# Research: Project Resource Allocation & Cost Tracking

**Created**: 2026-03-03
**Feature**: [spec.md](spec.md)

---

## Research Questions & Findings

### RQ-1: How should Project relate to existing Client model?

**Decision**: Project is a separate first-class entity with an optional `client_id` association.

**Rationale**: Projects are distinct from Clients. A Client is an external entity that pays the agency; a Project is an internal initiative that consumes resources. Some projects serve a specific client (client-facing work), others are internal (R&D, tooling). Making them separate entities avoids polluting the Client model and allows internal projects with no client association.

**Alternatives Considered**:
- Extend Client with `is_project` flag — rejected because it conflates two concepts and breaks existing client-level calculations
- Nest Project under Client — rejected because internal/R&D projects have no client

---

### RQ-2: How to handle cost allocations across both Client and Project levels?

**Decision**: ProjectCostAllocation is a new junction model independent of existing client-level allocations (StaffAssignment, ContractorAssignment, SubscriptionAllocation).

**Rationale**: The existing allocation models (StaffAssignment → Client, SubscriptionAllocation → Client) serve the client profitability use case. Project allocations answer a different question: "How much are we investing in this initiative?" A single staff member could be 60% allocated to Client A for billing purposes, but their time is split across 2 projects within that client's work. Keeping the two allocation layers separate preserves existing client ROI calculations while adding the project cost tracking dimension.

**Alternatives Considered**:
- Extend existing allocation models with optional `project_id` — rejected because it couples two independent tracking dimensions and complicates existing queries
- Use a polymorphic junction table — rejected as overcomplicated; a single `cost_source_type` discriminator with `cost_source_id` is sufficient

---

### RQ-3: How to resolve cost for each allocation type?

**Decision**: Use existing compensation/rate data to derive costs, with the allocation percentage applied.

**Cost Resolution by Source Type**:
| Source Type | Cost Derivation |
|-------------|----------------|
| STAFF | `Staff.rate` normalized to monthly (using `lib/calculations/` patterns) × allocation % |
| CONTRACTOR | `Contractor.rate` normalized to monthly × allocation % |
| SUBSCRIPTION | `Subscription.monthly_cost` × allocation % |
| OTHER | Fixed amount entered directly on the allocation record |

**Rationale**: Reuses the rate normalization logic already in `lib/calculations/client-roi.ts` (lines 47-279). Avoids duplicating cost data. The `OTHER` category handles ad-hoc expenses not captured elsewhere (e.g., one-time purchases for a project).

---

### RQ-4: How to handle proration for mid-month allocation changes?

**Decision**: Allocation changes take effect on the `effective_start_date`. Monthly cost snapshots use the allocation that was active for the majority of the month (>15 days). For the initial version, no daily proration — allocations are treated as full-month when active for majority of the period.

**Rationale**: Daily proration adds significant complexity for marginal accuracy gain. Most allocation changes happen at month boundaries anyway. The spec lists proration as an edge case, and the simplification aligns with how existing client ROI calculations work (monthly granularity). Can be enhanced later.

**Alternatives Considered**:
- Daily proration — rejected for V1 complexity; can be a future enhancement
- Always full-month regardless of start date — rejected as too inaccurate for short allocations

---

### RQ-5: Revenue data source for project ROI?

**Decision**: Revenue is manually entered per project per period, with optional future auto-attribution from Xero invoices.

**Rationale**: The spec explicitly states "Revenue data for projects will initially be manually entered or derived from client invoices via Xero." There is no existing mechanism to tag revenue to a specific project (only to a client). Manual entry is the pragmatic V1 approach. The `ProjectCostSnapshot` model includes a `revenue` field for this purpose.

---

### RQ-6: Allocation validation — can total allocation exceed 100%?

**Decision**: Total allocation for a single cost source across all projects cannot exceed 100%. Enforced at the server action level (not database constraint).

**Rationale**: The spec explicitly states "Total allocation for a single subscription across all projects cannot exceed 100%." This applies to all source types. Server-side validation provides better error messages than a database trigger, and aligns with the constitution's "no database triggers for business logic" constraint.

---

### RQ-7: Dashboard chart library and patterns?

**Decision**: Use Recharts with shadcn/ui Card wrappers, consistent with existing strategist dashboard.

**Rationale**: The constitution mandates "Recharts + Tremor for financial visualizations." The CFO Strategist feature (Feature 7) established Recharts patterns with AreaChart, BarChart, and PieChart in `/components/cfo-strategist/MarginTrendChart.tsx`. Follow the same patterns for consistency.

---

### RQ-8: Sidebar navigation placement?

**Decision**: Add "Projects" as a new section in the dashboard sidebar under the existing navigation structure.

**Rationale**: The sidebar component (`components/dashboard/Sidebar.tsx`) uses an accordion navigation pattern. Projects is a top-level financial concept that deserves its own nav section, similar to Clients, Contractors, and Subscriptions.

---

## Technology Decisions Summary

| Decision | Choice | Confidence |
|----------|--------|------------|
| Data model approach | Separate Project entity + junction table | High |
| Cost resolution | Derive from existing rates × allocation % | High |
| Revenue tracking | Manual entry per project per period | High |
| Proration strategy | Majority-of-month (no daily proration) | Medium |
| Allocation validation | Server-side, max 100% per source | High |
| Chart library | Recharts (existing patterns) | High |
| Snapshot generation | On-demand calculation with caching | High |
