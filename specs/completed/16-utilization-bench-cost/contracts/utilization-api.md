# API Contract: Utilization Queries & Snapshots

**Feature**: 16 - Utilization & Bench Cost Visibility
**Created**: 2026-03-06

---

## GET /api/utilization/current

Returns the current-period utilization summary for the organization. Calculated on-demand from live assignment data (not from snapshots).

### Authorization
- Requires authenticated session via `requireAuth()`
- Organization scoped via `getOrganizationId()`
- Roles: `ADMIN`, `EXECUTIVE`, `ANALYST`

### Query Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `period` | `string` | No | `"monthly"` | Period type: `"weekly"` or `"monthly"` |
| `month` | `number` | No | Current month | Month (1-12) for monthly period |
| `year` | `number` | No | Current year | Year (YYYY) for monthly period |
| `staff_type` | `string` | No | All types | Filter by staff type (e.g., `"DEVELOPER"`) |
| `engagement_type` | `string` | No | All eligible | Filter by engagement type |

### Response: 200 OK

```typescript
interface CurrentUtilizationResponse {
  organization: {
    utilization_rate: number;          // Weighted average across all eligible staff (0-100)
    total_available_hours: number;
    total_billable_hours: number;
    total_non_billable_hours: number;
    total_bench_hours: number;
    total_bench_cost: number;          // Sum of all individual bench costs
    active_staff_count: number;        // Eligible staff included in calculation
    bench_staff_count: number;         // Staff with utilization below target
    target_rate: number;               // Org default target (from UtilizationTarget)
    status: "on_target" | "warning" | "critical";
  };
  staff: Array<{
    id: string;
    name: string;
    staff_type: string;
    engagement_type: string;
    utilization_rate: number;
    available_hours: number;
    billable_hours: number;
    non_billable_hours: number;
    bench_hours: number;
    bench_cost: number;
    status: "on_target" | "warning" | "critical";
    data_source: "TIMESHEET" | "ALLOCATION" | "BLENDED";
    current_assignments: Array<{
      client_id: string;
      client_name: string;
      allocation_percentage: number;
    }>;
  }>;
  period: {
    start: string;                     // ISO date
    end: string;                       // ISO date
    working_days: number;
    standard_daily_hours: number;
  };
  computed_at: string;                 // ISO datetime
}
```

### Response: 401 Unauthorized

```json
{ "error": "Authentication required" }
```

### Response: 403 Forbidden

```json
{ "error": "Insufficient permissions" }
```

---

## GET /api/utilization/trends

Returns historical utilization snapshots for trend analysis. Reads from the `UtilizationSnapshot` table.

### Authorization
- Requires authenticated session
- Organization scoped
- Roles: `ADMIN`, `EXECUTIVE`, `ANALYST`

### Query Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `staff_id` | `string` | No | All staff | Filter to a single staff member |
| `months` | `number` | No | `12` | Number of months of history (max 24) |
| `granularity` | `string` | No | `"monthly"` | `"weekly"` or `"monthly"` |
| `staff_type` | `string` | No | All types | Filter by staff type |

### Response: 200 OK

```typescript
interface UtilizationTrendsResponse {
  organization_trend: Array<{
    period_start: string;
    period_end: string;
    utilization_rate: number;          // Org-wide weighted average for the period
    total_bench_cost: number;
    active_staff_count: number;
    bench_staff_count: number;
  }>;
  staff_trends?: Array<{              // Only when staff_id is specified
    period_start: string;
    period_end: string;
    utilization_rate: number;
    available_hours: number;
    billable_hours: number;
    non_billable_hours: number;
    bench_hours: number;
    bench_cost: number;
    data_source: "TIMESHEET" | "ALLOCATION" | "BLENDED";
  }>;
  trend: {
    direction: "UP" | "DOWN" | "FLAT" | "NEW";
    absolute_change: number;
    percentage_change: number;
  };
  period_range: {
    earliest: string;
    latest: string;
    total_snapshots: number;
  };
}
```

---

## GET /api/utilization/staff/[staffId]

Returns detailed utilization data for a single staff member, including current period calculation and historical snapshots.

### Authorization
- Requires authenticated session
- Organization scoped
- Roles: `ADMIN`, `EXECUTIVE`, `ANALYST`, or the staff member's own linked user
- Agency admins can view only staff linked to their agency

### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `staffId` | `string` (UUID) | Yes | Staff member ID |

### Query Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `months` | `number` | No | `6` | Months of history to include |

### Response: 200 OK

```typescript
interface StaffUtilizationDetailResponse {
  staff: {
    id: string;
    name: string;
    staff_type: string;
    engagement_type: string;
    rate: number;
    rate_type: string;
    true_cost: number | null;
    true_cost_rate_type: string | null;
  };
  current_period: {
    utilization_rate: number;
    available_hours: number;
    billable_hours: number;
    non_billable_hours: number;
    bench_hours: number;
    bench_cost: number;
    status: "on_target" | "warning" | "critical";
    data_source: "TIMESHEET" | "ALLOCATION" | "BLENDED";
    period_start: string;
    period_end: string;
  };
  target: {
    target_rate: number;
    warning_threshold: number;
    critical_threshold: number;
    source: "staff_type_override" | "organization_default";
  };
  history: Array<{
    period_start: string;
    period_end: string;
    utilization_rate: number;
    billable_hours: number;
    bench_hours: number;
    bench_cost: number;
    data_source: "TIMESHEET" | "ALLOCATION" | "BLENDED";
  }>;
  assignments: Array<{
    id: string;
    client_id: string;
    client_name: string;
    allocation_percentage: number;
    start_date: string;
    end_date: string | null;
    is_active: boolean;
  }>;
  bench_duration_days: number | null;  // Consecutive days without billable assignment (null if currently assigned)
  last_assignment_end: string | null;  // ISO date of most recent ended assignment
}
```

### Response: 404 Not Found

```json
{ "error": "Staff member not found" }
```

---

## POST /api/utilization/snapshots/generate

Triggers snapshot generation for all eligible staff in the organization. Used by the weekly cron job and by admins for manual triggers.

### Authorization
- Cron: Verified via `CRON_SECRET` header (matching existing pattern in `cfo-strategist/nightly/route.ts`)
- Manual: Requires `ADMIN` or `EXECUTIVE` role

### Request Body

```typescript
interface GenerateSnapshotsRequest {
  period_type: "weekly" | "monthly";   // Which period to snapshot
  period_start?: string;               // ISO date, defaults to current period start
  period_end?: string;                 // ISO date, defaults to current period end
  force?: boolean;                     // Re-generate even if snapshots exist for this period (default false)
}
```

### Response: 200 OK

```typescript
interface GenerateSnapshotsResponse {
  generated: number;                   // Snapshots created or updated
  skipped: number;                     // Staff skipped (OWNER, TERMINATED, already exists)
  errors: number;                      // Staff where calculation failed
  alerts_created: number;              // New notifications generated
  period: {
    start: string;
    end: string;
  };
  duration_ms: number;                 // Processing time
  details?: Array<{                    // Only included when errors > 0
    staff_id: string;
    staff_name: string;
    error: string;
  }>;
}
```

### Response: 409 Conflict

```json
{
  "error": "Snapshots already exist for this period. Use force=true to regenerate.",
  "existing_count": 45
}
```

---

## GET /api/utilization/snapshots

Returns raw snapshot data with filtering. Used for data export and advanced analytics.

### Authorization
- Requires `ADMIN` or `EXECUTIVE` role

### Query Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `period_start` | `string` | No | 12 months ago | ISO date filter (>=) |
| `period_end` | `string` | No | Now | ISO date filter (<=) |
| `staff_id` | `string` | No | All | Filter by staff member |
| `data_source` | `string` | No | All | Filter by data source |
| `alert_level` | `string` | No | All | Filter by alert level |
| `limit` | `number` | No | `100` | Max results (max 1000) |
| `offset` | `number` | No | `0` | Pagination offset |

### Response: 200 OK

```typescript
interface SnapshotsListResponse {
  snapshots: Array<{
    id: string;
    staff_id: string;
    staff_name: string;
    staff_type: string;
    period_start: string;
    period_end: string;
    available_hours: number;
    billable_hours: number;
    non_billable_hours: number;
    bench_hours: number;
    utilization_rate: number;
    bench_cost: number;
    data_source: "TIMESHEET" | "ALLOCATION" | "BLENDED";
    alert_level: "WARNING" | "CRITICAL" | null;
    generated_at: string;
  }>;
  pagination: {
    total: number;
    limit: number;
    offset: number;
    has_more: boolean;
  };
}
```
