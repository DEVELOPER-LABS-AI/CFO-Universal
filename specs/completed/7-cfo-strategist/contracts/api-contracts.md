# API Contracts: CFO Strategist

**Created**: 2026-02-27
**Feature**: [spec.md](../spec.md)

---

## Server Actions

All data mutations and queries follow the existing pattern of Next.js Server Actions in `app/actions/`.

### `app/actions/cfo-strategist.ts`

#### `getStrategistDashboard()`

Fetches all data needed to render the CFO Strategist dashboard.

```typescript
'use server';

export async function getStrategistDashboard(): Promise<{
  // Current margin vs target
  currentMargin: number;
  targetMargin: number;
  marginTrend: 'UP' | 'DOWN' | 'FLAT' | 'NEW';
  marginChangePercent: number;

  // Projected next month
  projectedMargin: number;

  // Margin history (6 months)
  marginHistory: Array<{
    month: number;
    year: number;
    label: string;        // "Jan 2026"
    margin: number;
    target: number;
    revenue: number;
    expenses: number;
  }>;

  // Recommendation summary
  recommendationCounts: {
    subscription: number;
    staffing: number;
    revenue: number;
    overhead: number;
    total: number;
  };

  // Top 3 recommendations
  topRecommendations: Array<{
    id: string;
    title: string;
    category: string;
    estimatedMonthlyImpact: number;
    confidenceLevel: number;
  }>;

  // Per-client breakdown
  clientMargins: Array<{
    clientId: string;
    clientName: string;
    margin: number;
    target: number;
    status: 'above' | 'near' | 'below';  // above: >target, near: within 5pts, below: >5pts under
    revenue: number;
    costs: number;
  }>;

  // Recommendation accuracy
  accuracyScore: number | null;  // null if no acted-on recommendations yet

  // Alerts
  activeAlerts: number;
}>
```

---

#### `getRecommendations(filters?)`

Fetches all recommendations with optional filtering.

```typescript
export async function getRecommendations(filters?: {
  category?: CfoRecommendationCategory;
  status?: CfoRecommendationStatus;
}): Promise<Array<{
  id: string;
  category: string;
  targetEntityType: string;
  targetEntityId: string;
  targetEntityName: string;       // resolved name (e.g., subscription name, contractor name)
  title: string;
  description: string;
  estimatedMonthlyImpact: number;
  confidenceLevel: number;
  status: string;
  supportingData: Record<string, unknown>;
  dismissedReason: string | null;
  deferredUntil: string | null;   // ISO date
  actedOnAt: string | null;       // ISO date
  createdAt: string;              // ISO date
}>>
```

---

#### `updateRecommendationStatus(id, action)`

Updates a recommendation's lifecycle status.

```typescript
export async function updateRecommendationStatus(
  id: string,
  action:
    | { type: 'act'; expectedSavings: number }
    | { type: 'dismiss'; reason: string }
    | { type: 'defer'; until: string }  // ISO date
): Promise<{ success: boolean; error?: string }>
```

**Validation**:
- `act`: Records `acted_on_at`, `acted_on_expected_savings`, captures current `baseline_metric_value`
- `dismiss`: Records `dismissed_reason`, captures `dismissed_metric_snapshot` from current metric value
- `defer`: Records `deferred_until` date (must be in the future)
- Status must be `ACTIVE` to transition (except DEFERRED -> ACTIVE which is automatic)

---

#### `refreshRecommendations()`

Triggers on-demand recomputation of all recommendations.

```typescript
export async function refreshRecommendations(): Promise<{
  success: boolean;
  newCount: number;
  updatedCount: number;
  removedCount: number;
  error?: string;
}>
```

---

#### `getMarginGoals()`

Fetches current margin goal configuration.

```typescript
export async function getMarginGoals(): Promise<{
  companyTarget: number;          // percentage (0-100)
  companyTargetId: string | null; // FinancialTarget id, null if using default
  clientOverrides: Array<{
    clientId: string;
    clientName: string;
    target: number;
  }>;
}>
```

---

#### `updateMarginGoal(data)`

Creates or updates margin goals.

```typescript
export async function updateMarginGoal(data:
  | { scope: 'GLOBAL'; targetMargin: number }
  | { scope: 'CLIENT'; clientId: string; targetMargin: number | null }  // null removes override
): Promise<{ success: boolean; error?: string }>
```

**Validation**:
- `targetMargin` must be between 0 and 100
- For CLIENT scope, `clientId` must exist
- Setting CLIENT targetMargin to `null` removes the override (deletes `custom_margin_target`)

---

#### `getCfoReports(type?, limit?)`

Fetches historical reports.

```typescript
export async function getCfoReports(
  type?: CfoReportType,
  limit?: number        // default: 10
): Promise<Array<{
  id: string;
  reportType: string;
  periodStart: string;  // ISO date
  periodEnd: string;    // ISO date
  marginActual: number;
  marginTarget: number;
  totalRevenue: number;
  totalExpenses: number;
  recommendationsCount: number;
  recommendationsActedCount: number;
  totalPotentialSavings: number;
  createdAt: string;    // ISO date
}>>
```

---

#### `getCfoReportDetail(id)`

Fetches a single report with full content.

```typescript
export async function getCfoReportDetail(id: string): Promise<{
  id: string;
  reportType: string;
  periodStart: string;
  periodEnd: string;
  marginActual: number;
  marginTarget: number;
  totalRevenue: number;
  totalExpenses: number;
  reportContent: {
    // Daily
    alerts: Array<{ title: string; message: string; severity: string }>;
    topActions: Array<{ title: string; impact: number; category: string }>;

    // Weekly (includes daily fields plus)
    marginTrend: Array<{ date: string; margin: number }>;
    actedRecommendations: Array<{ title: string; expectedImpact: number }>;
    newRecommendations: number;
    costBreakdownChanges: Record<string, { current: number; prior: number; change: number }>;

    // Monthly (includes weekly fields plus)
    monthOverMonth: { revenue: number; expenses: number; margin: number; profit: number };
    impactReview: Array<{ title: string; expectedSavings: number; realizedSavings: number | null }>;
    forecast: { projectedMargin: number; projectedRevenue: number; projectedExpenses: number };
    categoryDeepDive: Record<string, {
      totalCost: number;
      percentOfTotal: number;
      change: number;
      recommendations: Array<{ title: string; impact: number }>;
    }>;
  };
  createdAt: string;
} | null>
```

---

## Cron Endpoint

### `GET /api/cron/cfo-strategist`

Nightly computation endpoint triggered by Vercel cron at 3 AM UTC.

**Authentication**: `Authorization: Bearer ${CRON_SECRET}`

**Response**:
```typescript
{
  success: boolean;
  recommendations: {
    generated: number;
    updated: number;
    reactivated: number;  // deferred items past their date
  };
  reports: {
    daily: boolean;       // always generated
    weekly: boolean;      // generated on Mondays
    monthly: boolean;     // generated on 1st of month
  };
  alerts: {
    created: number;
  };
  duration_ms: number;
}
```

**Processing Steps**:
1. Verify CRON_SECRET auth
2. Fetch all organizations with active Mercury or Xero connections
3. For each organization:
   a. Refresh all client ROI calculations
   b. Run recommendation engine (subscription, staffing, revenue, overhead analyzers)
   c. Deduplicate against existing recommendations (upsert by identity key)
   d. Reactivate deferred recommendations past their date
   e. Check dismissed recommendations for 15%+ metric changes
   f. Generate daily report
   g. Generate weekly report (if Monday)
   h. Generate monthly report (if 1st of month)
   i. Create margin alerts if thresholds breached
4. Return summary
