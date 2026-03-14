# API Contract: Utilization Target Configuration

**Feature**: 16 - Utilization & Bench Cost Visibility
**Created**: 2026-03-06

---

## GET /api/utilization/targets

Returns all utilization targets for the organization (default + staff type overrides).

### Authorization
- Requires authenticated session via `requireAuth()`
- Organization scoped via `getOrganizationId()`
- Roles: `ADMIN`, `EXECUTIVE`

### Response: 200 OK

```typescript
interface UtilizationTargetsResponse {
  default_target: {
    id: string;
    target_rate: number;
    warning_threshold: number;
    critical_threshold: number;
    standard_daily_hours: number;
    enabled: boolean;
    updated_at: string;
  } | null;                            // null if no default has been configured yet
  staff_type_overrides: Array<{
    id: string;
    staff_type: string;
    target_rate: number;
    warning_threshold: number;
    critical_threshold: number;
    standard_daily_hours: number;
    enabled: boolean;
    updated_at: string;
  }>;
  available_staff_types: string[];     // All staff types from StaffRole for the org (for dropdown)
}
```

### Response: 401 Unauthorized

```json
{ "error": "Authentication required" }
```

---

## POST /api/utilization/targets

Creates or updates a utilization target. Uses Server Action pattern for mutation.

**Implementation Note**: This endpoint follows the Next.js Server Action pattern. The actual implementation will be a server action in `app/actions/utilization-targets.ts`, exposed via the API route for consistency.

### Authorization
- Requires `ADMIN` role
- Organization scoped

### Request Body

```typescript
interface UpsertUtilizationTargetRequest {
  staff_type: string | null;           // null = organization default
  target_rate: number;                 // 0-100, e.g., 80
  warning_threshold: number;           // 0-100, must be < target_rate
  critical_threshold: number;          // 0-100, must be < warning_threshold
  standard_daily_hours?: number;       // 1-24, default 8
  enabled?: boolean;                   // default true
}
```

### Validation Rules (Zod)

```typescript
const upsertTargetSchema = z.object({
  staff_type: z.string().min(1).nullable(),
  target_rate: z.number().min(0).max(100),
  warning_threshold: z.number().min(0).max(100),
  critical_threshold: z.number().min(0).max(100),
  standard_daily_hours: z.number().min(1).max(24).default(8),
  enabled: z.boolean().default(true),
}).refine(
  data => data.warning_threshold < data.target_rate,
  { message: 'Warning threshold must be less than target rate', path: ['warning_threshold'] }
).refine(
  data => data.critical_threshold < data.warning_threshold,
  { message: 'Critical threshold must be less than warning threshold', path: ['critical_threshold'] }
);
```

### Response: 200 OK (Updated)

```typescript
interface UtilizationTargetResponse {
  id: string;
  organization_id: string;
  staff_type: string | null;
  target_rate: number;
  warning_threshold: number;
  critical_threshold: number;
  standard_daily_hours: number;
  enabled: boolean;
  created_at: string;
  updated_at: string;
}
```

### Response: 201 Created

Same schema as 200 OK.

### Response: 400 Bad Request

```json
{
  "error": "Validation failed",
  "details": [
    {
      "path": ["warning_threshold"],
      "message": "Warning threshold must be less than target rate"
    }
  ]
}
```

### Response: 409 Conflict

```json
{
  "error": "A target already exists for staff type 'DEVELOPER'. Use PUT to update."
}
```

**Note**: The actual implementation uses Prisma upsert on the unique constraint `(organization_id, staff_type)`, so 409 will not occur in practice. Documented for completeness.

---

## PUT /api/utilization/targets/[targetId]

Updates an existing utilization target by ID.

### Authorization
- Requires `ADMIN` role
- Organization scoped (target must belong to the user's organization)

### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `targetId` | `string` (UUID) | Yes | Target configuration ID |

### Request Body

```typescript
interface UpdateUtilizationTargetRequest {
  target_rate?: number;
  warning_threshold?: number;
  critical_threshold?: number;
  standard_daily_hours?: number;
  enabled?: boolean;
}
```

All fields are optional (partial update). Cross-field validation is applied after merging with existing values.

### Response: 200 OK

Same schema as POST 200 response.

### Response: 404 Not Found

```json
{ "error": "Utilization target not found" }
```

---

## DELETE /api/utilization/targets/[targetId]

Soft-deletes a utilization target. Only staff type overrides can be deleted; the organization default cannot be deleted (only disabled).

### Authorization
- Requires `ADMIN` role
- Organization scoped

### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `targetId` | `string` (UUID) | Yes | Target configuration ID |

### Response: 200 OK

```json
{
  "deleted": true,
  "id": "uuid-here"
}
```

### Response: 400 Bad Request

```json
{
  "error": "Cannot delete the organization default target. Disable it instead by setting enabled=false."
}
```

### Response: 404 Not Found

```json
{ "error": "Utilization target not found" }
```

---

## Helper: Resolve Effective Target

This is an internal utility function (not an API endpoint) used by the calculation engine and dashboard to determine which target applies to a given staff member.

```typescript
/**
 * Resolve the effective utilization target for a staff member.
 * Priority: staff_type-specific override > organization default > system fallback.
 *
 * @param organizationId - Organization UUID
 * @param staffType - Staff member's staff_type string
 * @returns The applicable target configuration
 */
async function resolveEffectiveTarget(
  organizationId: string,
  staffType: string
): Promise<{
  target_rate: number;
  warning_threshold: number;
  critical_threshold: number;
  standard_daily_hours: number;
  source: "staff_type_override" | "organization_default" | "system_fallback";
}>
```

**System Fallback Values** (when no UtilizationTarget exists):
```typescript
const SYSTEM_FALLBACK = {
  target_rate: 80,
  warning_threshold: 70,
  critical_threshold: 50,
  standard_daily_hours: 8,
  source: "system_fallback" as const,
};
```
