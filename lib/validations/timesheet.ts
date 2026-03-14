import { z } from 'zod';

/**
 * Zod validation schemas for Timesheets & Time Tracking (Feature 15)
 */

// ============================================================================
// Draft Timesheet Schema
// ============================================================================

export const getOrCreateDraftTimesheetSchema = z.object({
  period_start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD format'),
});

// ============================================================================
// Time Entry Schemas
// ============================================================================

/** Shared entry fields reused by both single upsert and batch upsert. */
const timeEntryInputSchema = z.object({
  entry_id: z.string().uuid('Invalid entry ID').optional(),
  assignment_id: z.string().uuid('Invalid assignment ID').optional().nullable(),
  project_id: z.string().uuid('Invalid project ID').optional().nullable(),
  entry_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD format'),
  hours: z
    .number()
    .min(0.25, 'Minimum 0.25 hours')
    .max(24, 'Maximum 24 hours per entry')
    .refine((v) => v % 0.25 === 0, 'Hours must be in 0.25 increments'),
  description: z.string().max(2000).trim().optional().nullable(),
  is_billable: z.boolean().optional().default(true),
});

export const upsertTimeEntrySchema = z.object({
  timesheet_id: z.string().uuid('Invalid timesheet ID'),
}).merge(timeEntryInputSchema);

export const batchUpsertTimeEntriesSchema = z.object({
  timesheet_id: z.string().uuid(),
  entries: z.array(timeEntryInputSchema).min(1).max(70),
});

export const deleteTimeEntrySchema = z.object({
  entry_id: z.string().uuid('Invalid entry ID'),
});

// ============================================================================
// Timesheet Submission & Review Schemas
// ============================================================================

export const submitTimesheetSchema = z.object({
  timesheet_id: z.string().uuid('Invalid timesheet ID'),
});

export const reviewTimesheetSchema = z.object({
  timesheet_id: z.string().uuid('Invalid timesheet ID'),
  action: z.enum(['approve', 'reject'], { message: 'Action must be approve or reject' }),
  rejection_reason: z.string().min(10, 'Rejection reason must be at least 10 characters').max(1000).trim().optional(),
}).refine(
  (d) => d.action !== 'reject' || d.rejection_reason,
  { message: 'Rejection reason is required when rejecting', path: ['rejection_reason'] }
);

export const bulkApproveTimesheetsSchema = z.object({
  timesheet_ids: z.array(z.string().uuid()).min(1).max(50),
});

// ============================================================================
// Overtime Configuration Schema
// ============================================================================

export const upsertOvertimeConfigSchema = z.object({
  weekly_hours_threshold: z.number().positive('Threshold must be greater than 0').max(168, 'Threshold cannot exceed 168 hours per week'),
  overtime_multiplier: z.number().min(1.0, 'Multiplier must be at least 1.0').max(5.0, 'Multiplier cannot exceed 5.0'),
  is_enabled: z.boolean(),
  agency_id: z.string().uuid('Invalid agency ID').optional().nullable(),
});

// ============================================================================
// List & Filter Schemas
// ============================================================================

export const timesheetListFilterSchema = z.object({
  status: z.enum(['DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED']).optional(),
  staff_id: z.string().uuid().optional(),
  client_id: z.string().uuid().optional(),
  agency_id: z.string().uuid().optional(),
  period_start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  period_end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  page: z.coerce.number().int().positive().default(1),
  per_page: z.coerce.number().int().min(1).max(100).default(20),
});

// ============================================================================
// Summary & Export Schemas
// ============================================================================

export const timesheetSummaryFilterSchema = z.object({
  period_start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD format'),
  period_end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD format'),
  group_by: z.enum(['staff', 'client', 'project']).optional().default('staff'),
  status: z.enum(['APPROVED']).optional(),
});

export const timesheetExportFilterSchema = z.object({
  period_start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  period_end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  status: z.enum(['APPROVED', 'SUBMITTED']).optional(),
  staff_id: z.string().uuid().optional(),
  client_id: z.string().uuid().optional(),
  agency_id: z.string().uuid().optional(),
});

// ============================================================================
// Type Exports
// ============================================================================

export type GetOrCreateDraftTimesheetInput = z.infer<typeof getOrCreateDraftTimesheetSchema>;
export type TimeEntryInput = z.infer<typeof timeEntryInputSchema>;
export type UpsertTimeEntryInput = z.infer<typeof upsertTimeEntrySchema>;
export type BatchUpsertTimeEntriesInput = z.infer<typeof batchUpsertTimeEntriesSchema>;
export type DeleteTimeEntryInput = z.infer<typeof deleteTimeEntrySchema>;
export type SubmitTimesheetInput = z.infer<typeof submitTimesheetSchema>;
export type ReviewTimesheetInput = z.infer<typeof reviewTimesheetSchema>;
export type BulkApproveTimesheetsInput = z.infer<typeof bulkApproveTimesheetsSchema>;
export type UpsertOvertimeConfigInput = z.infer<typeof upsertOvertimeConfigSchema>;
export type TimesheetListFilterInput = z.infer<typeof timesheetListFilterSchema>;
export type TimesheetSummaryFilterInput = z.infer<typeof timesheetSummaryFilterSchema>;
export type TimesheetExportFilterInput = z.infer<typeof timesheetExportFilterSchema>;
