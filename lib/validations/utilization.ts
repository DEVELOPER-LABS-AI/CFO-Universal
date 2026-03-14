import { z } from 'zod';

/**
 * Zod validation schemas for Utilization & Bench Cost (Feature 16)
 */

// ============================================================================
// Utilization Snapshot Schema
// ============================================================================

/** Schema for creating utilization snapshots during generation. */
export const utilizationSnapshotCreateSchema = z.object({
  organization_id: z.string().uuid('Invalid organization ID'),
  staff_id: z.string().uuid('Invalid staff ID'),
  period_start: z.coerce.date(),
  period_end: z.coerce.date(),
  available_hours: z.number().min(0, 'Available hours cannot be negative'),
  billable_hours: z.number().min(0, 'Billable hours cannot be negative'),
  non_billable_hours: z.number().min(0, 'Non-billable hours cannot be negative'),
  bench_hours: z.number().min(0, 'Bench hours cannot be negative'),
  utilization_rate: z.number().min(0, 'Utilization rate cannot be negative').max(100, 'Utilization rate cannot exceed 100'),
  bench_cost: z.number().min(0, 'Bench cost cannot be negative'),
  cost_rate_hourly: z.number().min(0, 'Cost rate cannot be negative'),
  cost_rate_source: z.enum(['true_cost', 'rate'], { message: 'Cost rate source must be true_cost or rate' }),
  data_source: z.enum(['TIMESHEET', 'ALLOCATION', 'BLENDED'], { message: 'Data source must be TIMESHEET, ALLOCATION, or BLENDED' }),
  alert_level: z.enum(['WARNING', 'CRITICAL']).nullable(),
}).refine(
  (d) => d.period_end > d.period_start,
  { message: 'period_end must be after period_start', path: ['period_end'] }
);

// ============================================================================
// Utilization Target Schemas
// ============================================================================

/** Full target schema including organization_id (used internally). */
export const utilizationTargetSchema = z.object({
  organization_id: z.string().uuid('Invalid organization ID'),
  staff_type: z.string().min(1, 'Staff type cannot be empty').nullable(),
  target_rate: z.number().min(0, 'Target rate cannot be negative').max(100, 'Target rate cannot exceed 100'),
  warning_threshold: z.number().min(0, 'Warning threshold cannot be negative').max(100, 'Warning threshold cannot exceed 100'),
  critical_threshold: z.number().min(0, 'Critical threshold cannot be negative').max(100, 'Critical threshold cannot exceed 100'),
  standard_daily_hours: z.number().min(1, 'Minimum 1 hour per day').max(24, 'Maximum 24 hours per day').default(8),
  enabled: z.boolean().default(true),
}).refine(
  (d) => d.warning_threshold < d.target_rate,
  { message: 'Warning threshold must be less than target rate', path: ['warning_threshold'] }
).refine(
  (d) => d.critical_threshold < d.warning_threshold,
  { message: 'Critical threshold must be less than warning threshold', path: ['critical_threshold'] }
);

/** API upsert schema (organization_id comes from auth context). */
export const upsertTargetSchema = z.object({
  staff_type: z.string().min(1, 'Staff type cannot be empty').nullable(),
  target_rate: z.number().min(0, 'Target rate cannot be negative').max(100, 'Target rate cannot exceed 100'),
  warning_threshold: z.number().min(0, 'Warning threshold cannot be negative').max(100, 'Warning threshold cannot exceed 100'),
  critical_threshold: z.number().min(0, 'Critical threshold cannot be negative').max(100, 'Critical threshold cannot exceed 100'),
  standard_daily_hours: z.number().min(1, 'Minimum 1 hour per day').max(24, 'Maximum 24 hours per day').default(8),
  enabled: z.boolean().default(true),
}).refine(
  (d) => d.warning_threshold < d.target_rate,
  { message: 'Warning threshold must be less than target rate', path: ['warning_threshold'] }
).refine(
  (d) => d.critical_threshold < d.warning_threshold,
  { message: 'Critical threshold must be less than warning threshold', path: ['critical_threshold'] }
);

/** Partial update schema (all fields optional, cross-validation when both present). */
export const updateTargetSchema = z.object({
  staff_type: z.string().min(1, 'Staff type cannot be empty').nullable().optional(),
  target_rate: z.number().min(0).max(100).optional(),
  warning_threshold: z.number().min(0).max(100).optional(),
  critical_threshold: z.number().min(0).max(100).optional(),
  standard_daily_hours: z.number().min(1).max(24).optional(),
  enabled: z.boolean().optional(),
}).refine(
  (d) => {
    if (d.warning_threshold !== undefined && d.target_rate !== undefined) {
      return d.warning_threshold < d.target_rate;
    }
    return true;
  },
  { message: 'Warning threshold must be less than target rate', path: ['warning_threshold'] }
).refine(
  (d) => {
    if (d.critical_threshold !== undefined && d.warning_threshold !== undefined) {
      return d.critical_threshold < d.warning_threshold;
    }
    return true;
  },
  { message: 'Critical threshold must be less than warning threshold', path: ['critical_threshold'] }
);

// ============================================================================
// Query Parameter Schemas
// ============================================================================

/** Query params for the current utilization endpoint. */
export const currentUtilizationQuerySchema = z.object({
  period: z.enum(['weekly', 'monthly']).optional(),
  month: z.coerce.number().int().min(1).max(12).optional(),
  year: z.coerce.number().int().optional(),
  staff_type: z.string().optional(),
  engagement_type: z.string().optional(),
});

/** Query params for utilization trends endpoint. */
export const trendsQuerySchema = z.object({
  staff_id: z.string().uuid().optional(),
  months: z.coerce.number().int().min(1).max(24).default(12),
  granularity: z.enum(['weekly', 'monthly']).optional(),
  staff_type: z.string().optional(),
});

/** Query params for bench report endpoint. */
export const benchQuerySchema = z.object({
  month: z.coerce.number().int().min(1).max(12).optional(),
  year: z.coerce.number().int().optional(),
  staff_type: z.string().optional(),
  engagement_type: z.string().optional(),
  sort_by: z.enum(['bench_cost', 'utilization_rate', 'bench_days', 'name']).optional(),
  sort_order: z.enum(['asc', 'desc']).optional(),
  include_all: z.coerce.boolean().optional(),
});

/** Query params for listing utilization snapshots. */
export const snapshotsQuerySchema = z.object({
  period_start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD format').optional(),
  period_end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD format').optional(),
  staff_id: z.string().uuid().optional(),
  data_source: z.enum(['TIMESHEET', 'ALLOCATION', 'BLENDED']).optional(),
  alert_level: z.enum(['WARNING', 'CRITICAL']).optional(),
  limit: z.coerce.number().int().min(1).max(1000).default(100),
  offset: z.coerce.number().int().min(0).default(0),
});

/** Schema for triggering snapshot generation. */
export const generateSnapshotsSchema = z.object({
  period_type: z.enum(['weekly', 'monthly'], { message: 'Period type must be weekly or monthly' }),
  period_start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD format').optional(),
  period_end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD format').optional(),
  force: z.boolean().default(false),
});

// ============================================================================
// Type Exports
// ============================================================================

export type UtilizationSnapshotCreateInput = z.infer<typeof utilizationSnapshotCreateSchema>;
export type UtilizationTargetInput = z.infer<typeof utilizationTargetSchema>;
export type UpsertTargetInput = z.infer<typeof upsertTargetSchema>;
export type UpdateTargetInput = z.infer<typeof updateTargetSchema>;
export type CurrentUtilizationQuery = z.infer<typeof currentUtilizationQuerySchema>;
export type TrendsQuery = z.infer<typeof trendsQuerySchema>;
export type BenchQuery = z.infer<typeof benchQuerySchema>;
export type SnapshotsQuery = z.infer<typeof snapshotsQuerySchema>;
export type GenerateSnapshotsInput = z.infer<typeof generateSnapshotsSchema>;
