# API Contract: Bench Cost Reporting

**Feature**: 16 - Utilization & Bench Cost Visibility
**Created**: 2026-03-06

---

## GET /api/utilization/bench

Returns the bench report: all staff currently below the utilization target with cost impact details. Calculated on-demand from live data.

### Authorization
- Requires authenticated session via `requireAuth()`
- Organization scoped via `getOrganizationId()`
- Roles: `ADMIN`, `EXECUTIVE`

### Query Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `month` | `number` | No | Current month | Month (1-12) |
| `year` | `number` | No | Current year | Year (YYYY) |
| `staff_type` | `string` | No | All types | Filter by staff type |
| `engagement_type` | `string` | No | All eligible | Filter by engagement type |
| `sort_by` | `string` | No | `"bench_cost"` | Sort field: `"bench_cost"`, `"utilization_rate"`, `"bench_days"`, `"name"` |
| `sort_order` | `string` | No | `"desc"` | `"asc"` or `"desc"` |
| `include_all` | `boolean` | No | `false` | If true, include all staff (not just below target) |

### Response: 200 OK

```typescript
interface BenchReportResponse {
  summary: {
    total_bench_headcount: number;       // Staff below target
    total_active_staff: number;          // All eligible staff
    total_bench_cost: number;            // Sum of bench costs for staff below target
    average_bench_duration_days: number; // Average consecutive days on bench
    bench_cost_as_pct_of_payroll: number; // Bench cost / total payroll cost * 100
    total_payroll_cost: number;          // Total cost of all eligible staff for the period
    org_utilization_rate: number;        // Organization-wide weighted average
    target_rate: number;                 // Organization default target
  };
  bench_staff: Array<{
    staff: {
      id: string;
      name: string;
      staff_type: string;
      engagement_type: string;
      agency_id: string | null;
      agency_name: string | null;
    };
    utilization: {
      rate: number;                      // Current utilization percentage
      status: "on_target" | "warning" | "critical";
      available_hours: number;
      billable_hours: number;
      non_billable_hours: number;
      bench_hours: number;
      data_source: "TIMESHEET" | "ALLOCATION" | "BLENDED";
    };
    cost: {
      bench_cost: number;               // Monetary cost of idle time this period
      hourly_cost_rate: number;          // Hourly equivalent used for calculation
      cost_rate_source: "true_cost" | "rate";
      monthly_full_cost: number;         // Full monthly cost (for context)
    };
    bench_info: {
      days_on_bench: number | null;      // Consecutive days without billable assignment
      last_assignment_end: string | null; // ISO date
      last_client_name: string | null;
    };
    current_assignments: Array<{
      client_id: string;
      client_name: string;
      allocation_percentage: number;
    }>;
  }>;
  period: {
    start: string;
    end: string;
    working_days: number;
  };
  computed_at: string;
}
```

### Response: 401 Unauthorized

```json
{ "error": "Authentication required" }
```

### Response: 403 Forbidden

```json
{ "error": "Insufficient permissions. Bench report requires ADMIN or EXECUTIVE role." }
```

---

## GET /api/utilization/bench/trends

Returns bench cost trends over time, sourced from `UtilizationSnapshot` aggregate data.

### Authorization
- Requires `ADMIN` or `EXECUTIVE` role

### Query Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `months` | `number` | No | `12` | Number of months of history (max 24) |
| `granularity` | `string` | No | `"monthly"` | `"weekly"` or `"monthly"` |

### Response: 200 OK

```typescript
interface BenchTrendsResponse {
  trends: Array<{
    period_start: string;
    period_end: string;
    total_bench_cost: number;
    bench_headcount: number;
    average_utilization_rate: number;   // Org-wide average for the period
    bench_cost_as_pct_of_payroll: number;
  }>;
  trend: {
    direction: "UP" | "DOWN" | "FLAT" | "NEW";
    absolute_change: number;            // Bench cost change (current vs prior period)
    percentage_change: number;
  };
  average_bench_duration: {
    current_period_days: number;
    prior_period_days: number;
    change_days: number;
  };
}
```

---

## GET /api/utilization/bench/export

Exports bench report data as CSV for download.

### Authorization
- Requires `ADMIN` or `EXECUTIVE` role

### Query Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `month` | `number` | No | Current month | Month (1-12) |
| `year` | `number` | No | Current year | Year (YYYY) |
| `format` | `string` | No | `"csv"` | Export format (only `"csv"` supported initially) |

### Response: 200 OK

**Headers**:
```
Content-Type: text/csv
Content-Disposition: attachment; filename="bench-report-2026-03.csv"
```

**CSV Columns**:
```
Name, Staff Type, Engagement Type, Agency, Utilization Rate (%), Available Hours, Billable Hours, Bench Hours, Bench Cost ($), Days on Bench, Last Assignment End, Data Source
```

### Response: 403 Forbidden

```json
{ "error": "Insufficient permissions" }
```
