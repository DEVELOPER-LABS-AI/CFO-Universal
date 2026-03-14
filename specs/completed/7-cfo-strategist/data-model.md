# Data Model: CFO Strategist

**Created**: 2026-02-27
**Feature**: [spec.md](spec.md)

---

## New Models

### CfoRecommendation

Stores generated recommendations with lifecycle tracking and impact measurement.

```prisma
model CfoRecommendation {
  id                      String                    @id @default(uuid()) @db.Uuid
  organization_id         String                    @db.Uuid

  // Identity (composite unique for deduplication)
  category                CfoRecommendationCategory
  target_entity_type      String                    @db.VarChar(50)  // 'subscription', 'contractor', 'client', 'staff', 'agency', 'service'
  target_entity_id        String                    @db.Uuid

  // Content
  title                   String                    @db.VarChar(255)
  description             String
  estimated_monthly_impact Decimal                  @db.Decimal(10, 2)
  confidence_level        Decimal                   @db.Decimal(3, 2) // 0.00 - 1.00
  supporting_data         Json                      @default("{}")

  // Lifecycle
  status                  CfoRecommendationStatus   @default(ACTIVE)
  dismissed_reason        String?
  dismissed_metric_snapshot Decimal?                 @db.Decimal(10, 2)
  deferred_until          DateTime?
  acted_on_at             DateTime?
  acted_on_expected_savings Decimal?                 @db.Decimal(10, 2)

  // Impact tracking
  baseline_metric_value   Decimal?                  @db.Decimal(10, 2)
  realized_savings        Decimal?                  @db.Decimal(10, 2)

  // Timestamps
  created_at              DateTime                  @default(now())
  updated_at              DateTime                  @updatedAt
  deleted_at              DateTime?

  organization Organization @relation(fields: [organization_id], references: [id], onDelete: Cascade)

  @@unique([organization_id, category, target_entity_type, target_entity_id])
  @@index([organization_id, status])
  @@index([organization_id, category])
  @@index([deferred_until])
}

enum CfoRecommendationCategory {
  SUBSCRIPTION_OPTIMIZATION
  STAFFING_EFFICIENCY
  REVENUE_OPPORTUNITY
  OVERHEAD_REDUCTION
}

enum CfoRecommendationStatus {
  ACTIVE
  ACTED_ON
  DISMISSED
  DEFERRED
}
```

**State Transitions**:
- `ACTIVE` -> `ACTED_ON` | `DISMISSED` | `DEFERRED`
- `DEFERRED` -> `ACTIVE` (auto-reactivate when `deferred_until` date arrives)
- `DISMISSED` -> `ACTIVE` (when underlying metric changes by 15%+ from `dismissed_metric_snapshot`)

**Identity Rule**: `(organization_id, category, target_entity_type, target_entity_id)` is the composite unique key. During nightly recomputation, existing records matching this key preserve their status rather than being recreated.

---

### CfoReport

Stores periodic report snapshots for historical access.

```prisma
model CfoReport {
  id                         String        @id @default(uuid()) @db.Uuid
  organization_id            String        @db.Uuid

  report_type                CfoReportType
  period_start               DateTime
  period_end                 DateTime

  // Summary metrics
  margin_actual              Decimal       @db.Decimal(5, 2)
  margin_target              Decimal       @db.Decimal(5, 2)
  total_revenue              Decimal       @db.Decimal(10, 2)
  total_expenses             Decimal       @db.Decimal(10, 2)
  recommendations_count      Int           @default(0)
  recommendations_acted_count Int          @default(0)
  total_potential_savings     Decimal       @db.Decimal(10, 2) @default(0)

  // Full report content (structured JSON)
  report_content             Json          @default("{}")

  // Timestamps
  created_at                 DateTime      @default(now())
  updated_at                 DateTime      @updatedAt
  deleted_at                 DateTime?

  organization Organization @relation(fields: [organization_id], references: [id], onDelete: Cascade)

  @@unique([organization_id, report_type, period_start])
  @@index([organization_id, report_type])
}

enum CfoReportType {
  DAILY
  WEEKLY
  MONTHLY
}
```

---

## Reused/Extended Models

### FinancialTarget (existing - no schema changes)

Used for company-wide margin goals with `scope = GLOBAL`.

```prisma
// Already exists - no changes needed
model FinancialTarget {
  id              String      @id @default(uuid())
  organization_id String
  scope           TargetScope  // GLOBAL, SERVICE, CLIENT
  scope_id        String?
  target_margin   Decimal     @db.Decimal(5, 2)
  target_revenue  Decimal?    @db.Decimal(10, 2)
  fiscal_period   String      // "Q1-2026", "FY-2026"
  created_at      DateTime    @default(now())
  updated_at      DateTime    @updatedAt
  organization    Organization @relation(...)
}
```

**Usage**: Query `FinancialTarget` where `scope = GLOBAL` for company-wide margin target. Default to 25% if none exists.

### Client (existing - no schema changes)

The existing `custom_margin_target` field is used for per-client margin overrides.

```prisma
// Already exists - relevant field only
model Client {
  // ...
  custom_margin_target Decimal? @db.Decimal(5, 2)
  // ...
}
```

**Usage**: When evaluating a client's margin against target, check `client.custom_margin_target` first; if null, fall back to the `FinancialTarget` global target; if that's also missing, default to 25%.

### Organization (existing - add relations)

Add relations to the new models.

```prisma
model Organization {
  // ... existing fields and relations
  cfo_recommendations CfoRecommendation[]
  cfo_reports         CfoReport[]
}
```

---

## Entity Relationship Summary

```
Organization (1) ──── (N) CfoRecommendation
Organization (1) ──── (N) CfoReport
Organization (1) ──── (N) FinancialTarget (existing)
Organization (1) ──── (N) Client (existing)

CfoRecommendation.target_entity_id ──── polymorphic ref to:
  - Subscription.id
  - Contractor.id
  - Client.id
  - Staff.id
  - Agency.id
  - Service.id
```

Note: `target_entity_id` is a polymorphic reference (not a foreign key constraint) since it can point to different entity types based on `target_entity_type`. This is intentional to support cross-category recommendations without complex join tables.
