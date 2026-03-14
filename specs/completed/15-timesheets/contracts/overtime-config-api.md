# Overtime Configuration API Contract

**Feature**: 15 - Timesheets & Time Tracking
**Domain**: Organization-level overtime settings
**Pattern**: Server Actions for mutations, API Route for read

---

## Server Actions (Mutations)

All server actions live in `app/actions/timesheet-admin-actions.ts`.

### SA-1: upsertOvertimeConfig

Creates or updates the overtime configuration for the current organization.

**File**: `app/actions/timesheet-admin-actions.ts`

```typescript
// Request
interface UpsertOvertimeConfigInput {
  weekly_hours_threshold: number;
  overtime_multiplier: number;
  is_enabled: boolean;
}

// Zod Schema
const upsertOvertimeConfigSchema = z.object({
  weekly_hours_threshold: z.number()
    .positive('Threshold must be greater than 0')
    .max(168, 'Threshold cannot exceed 168 hours per week'),
  overtime_multiplier: z.number()
    .min(1.0, 'Multiplier must be at least 1.0')
    .max(5.0, 'Multiplier cannot exceed 5.0'),
  is_enabled: z.boolean(),
});

// Response (success)
interface UpsertOvertimeConfigResponse {
  success: true;
  config: OvertimeConfigResponse;
}

interface OvertimeConfigResponse {
  id: string;
  organization_id: string;
  weekly_hours_threshold: number;
  overtime_multiplier: number;
  is_enabled: boolean;
  created_at: string;
  updated_at: string;
}

// Response (error)
interface ErrorResponse {
  error: string;
  code: 'VALIDATION_ERROR' | 'FORBIDDEN' | 'SERVER_ERROR';
}
```

**Authorization**: Organization admin only (UserRole: ADMIN).

**Business Rules**:
- Uses Prisma `upsert` with `organization_id` as the unique key
- If no config exists, creates with provided values
- If config exists, updates with provided values
- Changes take effect immediately for future timesheet submissions
- Does NOT retroactively recalculate already-approved timesheets

**Errors**:
| Code | Condition |
|---|---|
| `VALIDATION_ERROR` | Input fails Zod validation |
| `FORBIDDEN` | User is not an admin for this organization |

---

## API Routes (Reads)

### GET /api/overtime-config

Retrieves the overtime configuration for the current organization.

**File**: `app/api/overtime-config/route.ts`

```typescript
// Response (config exists)
interface OvertimeConfigGetResponse {
  config: OvertimeConfigResponse;
}

// Response (no config exists - returns defaults)
interface OvertimeConfigDefaultResponse {
  config: {
    id: null;
    organization_id: string;
    weekly_hours_threshold: 40;
    overtime_multiplier: 1.5;
    is_enabled: true;
    created_at: null;
    updated_at: null;
  };
  is_default: true;
}
```

**Authorization**: Any authenticated user in the organization.

**Business Rules**:
- If no `OvertimeConfig` record exists for the organization, returns default values (threshold: 40, multiplier: 1.5, enabled: true)
- The `is_default` flag indicates whether the returned config is a persisted record or default values
- Default values match the Prisma model defaults

---

## Integration with Timesheet Calculations

The overtime config is consumed by the timesheet billing calculation module:

```typescript
// lib/calculations/timesheet-billing.ts

/**
 * Resolves the overtime config for an organization.
 * Returns the persisted config or falls back to defaults.
 */
async function getEffectiveOvertimeConfig(
  organizationId: string
): Promise<{
  threshold: number;
  multiplier: number;
  enabled: boolean;
}>;

/**
 * Calculates overtime distribution for a timesheet.
 * Called during timesheet submission and billing report generation.
 *
 * @param totalHours - Total hours logged in the timesheet
 * @param config - Effective overtime config
 * @returns Regular and overtime hour breakdown
 */
function calculateOvertimeBreakdown(
  totalHours: number,
  config: { threshold: number; multiplier: number; enabled: boolean }
): {
  regularHours: number;
  overtimeHours: number;
  isOvertime: boolean;
};

/**
 * Distributes overtime hours proportionally across assignments.
 *
 * @param entries - Time entries grouped by assignment
 * @param overtimeHours - Total overtime hours to distribute
 * @returns Per-assignment regular and overtime hour breakdown
 */
function distributeOvertimeProportionally(
  entries: Map<string, { assignmentId: string; totalHours: number }>,
  overtimeHours: number
): Array<{
  assignmentId: string;
  regularHours: number;
  overtimeHours: number;
}>;
```

### Calculation Flow

```
1. Staff submits timesheet
2. System loads OvertimeConfig for org (or uses defaults)
3. If config.is_enabled:
   a. Sum all billable hours across entries
   b. calculateOvertimeBreakdown(totalBillableHours, config)
   c. distributeOvertimeProportionally(entriesByAssignment, overtimeHours)
   d. Update timesheet.overtime_hours
   e. Optionally mark individual entries as is_overtime (for display)
4. If !config.is_enabled:
   a. overtime_hours = 0
   b. All hours are regular
```

---

## Defaults & Seeding

No seed data is required. The application handles missing `OvertimeConfig` records by falling back to defaults:

| Field | Default Value | Source |
|---|---|---|
| `weekly_hours_threshold` | 40.00 | Prisma `@default(40)` and app-level fallback |
| `overtime_multiplier` | 1.50 | Prisma `@default(1.5)` and app-level fallback |
| `is_enabled` | true | Prisma `@default(true)` and app-level fallback |
