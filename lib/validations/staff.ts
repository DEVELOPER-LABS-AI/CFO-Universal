import { z } from 'zod';

const staffBaseSchema = z.object({
  name: z.string().min(1, 'Staff name is required').max(200, 'Name must be less than 200 characters').trim(),
  staff_type: z.string().min(1, 'Role is required').max(100),
  rate: z.number().positive('Rate must be greater than 0').min(0.01, 'Rate must be at least $0.01'),
  rate_type: z.enum(['HOURLY', 'DAILY', 'MONTHLY', 'VARIABLE'], {
    message: 'Rate type is required',
  }),
  engagement_type: z.enum(['FULL_TIME', 'PART_TIME', 'PROJECT', 'OWNER', 'AGENCY'], {
    message: 'Engagement type is required',
  }),
  agency_id: z.string().uuid('Invalid agency ID').optional().nullable(),
  contractor_id: z.string().uuid('Invalid contractor ID').optional().nullable(),
  // Feature 14: Agency true cost & markup fields
  true_cost: z.number().positive('True cost must be greater than 0').optional().nullable(),
  true_cost_rate_type: z.enum(['HOURLY', 'DAILY', 'MONTHLY', 'VARIABLE']).optional().nullable(),
  markup_override_type: z.enum(['PERCENTAGE', 'FLAT_RATE']).optional().nullable(),
  markup_override_value: z.number().min(0, 'Markup override must be non-negative').optional().nullable(),
  rate_locked: z.boolean().default(false),
});

export const createStaffSchema = staffBaseSchema.refine(
  (data) => {
    // When engagement_type is AGENCY, true_cost and true_cost_rate_type are required
    if (data.engagement_type === 'AGENCY') {
      if (data.true_cost == null || data.true_cost_rate_type == null) return false;
    }
    return true;
  },
  { message: 'True cost and rate type are required for agency staff', path: ['true_cost'] }
).refine(
  (data) => {
    // markup_override_type and markup_override_value must both be set or both be null
    const hasType = data.markup_override_type != null;
    const hasValue = data.markup_override_value != null;
    return hasType === hasValue;
  },
  { message: 'Markup override type and value must both be set or both be null', path: ['markup_override_type'] }
).refine(
  (data) => {
    // true_cost_rate_type required when true_cost is provided
    if (data.true_cost != null && data.true_cost_rate_type == null) return false;
    if (data.true_cost == null && data.true_cost_rate_type != null) return false;
    return true;
  },
  { message: 'True cost rate type is required when true cost is set', path: ['true_cost_rate_type'] }
);

export const updateStaffSchema = staffBaseSchema.partial();

// T048: CreateStaffAssignmentSchema with fields: staff_id, client_id, allocation_percentage, start_date
export const createStaffAssignmentSchema = z.object({
  staff_id: z.string().uuid('Invalid staff ID'),
  client_id: z.string().uuid('Invalid client ID'),
  assignment_type: z.enum(['PROJECT', 'RETAINER']).default('RETAINER'),
  allocation_percentage: z.number()
    .min(0, 'Allocation percentage must be at least 0')
    .max(100, 'Allocation percentage cannot exceed 100'),
  start_date: z.union([z.string(), z.date()]).pipe(z.coerce.date()).default(new Date()),
  end_date: z.union([z.string(), z.date(), z.null()]).pipe(z.coerce.date()).nullable().optional(),
});

export const upsertMonthlyAllocationSchema = z.object({
  assignment_id: z.string().uuid('Invalid assignment ID'),
  month: z.number().int().min(1).max(12),
  year: z.number().int().min(2020).max(2100),
  allocation_percentage: z.number()
    .min(0, 'Allocation percentage must be at least 0')
    .max(100, 'Allocation percentage cannot exceed 100'),
});

export const deleteMonthlyAllocationSchema = z.object({
  assignment_id: z.string().uuid('Invalid assignment ID'),
  month: z.number().int().min(1).max(12),
  year: z.number().int().min(2020).max(2100),
});

export const endStaffAssignmentSchema = z.object({
  assignment_id: z.string().uuid('Invalid assignment ID'),
  end_date: z.union([z.string(), z.date()]).pipe(z.coerce.date()).default(new Date()),
});

export const terminateStaffSchema = z.object({
  staff_id: z.string().uuid('Invalid staff ID'),
  termination_reason: z.string()
    .min(1, 'Termination reason is required')
    .max(1000, 'Reason must be less than 1000 characters')
    .trim(),
  terminated_at: z.union([z.string(), z.date()])
    .pipe(z.coerce.date())
    .default(() => new Date()),
});

export const rehireStaffSchema = z.object({
  staff_id: z.string().uuid('Invalid staff ID'),
});

export const getStaffSchema = z.object({
  page: z.number().int().positive().default(1).optional(),
  limit: z.number().int().positive().max(100).default(20).optional(),
  staff_type: z.string().optional(),
  agency_id: z.string().uuid().optional(),
  has_agency: z.boolean().optional(),
  status: z.enum(['ACTIVE', 'TERMINATED']).optional(),
  include_deleted: z.boolean().default(false).optional(),
  sort_by: z.enum(['name', 'staff_type', 'rate', 'created_at']).default('created_at').optional(),
  sort_order: z.enum(['asc', 'desc']).default('desc').optional(),
});

export type CreateStaffInput = z.infer<typeof createStaffSchema>;
export type UpdateStaffInput = z.infer<typeof updateStaffSchema>;
export type CreateStaffAssignmentInput = z.infer<typeof createStaffAssignmentSchema>;
export type EndStaffAssignmentInput = z.infer<typeof endStaffAssignmentSchema>;
export type TerminateStaffInput = z.infer<typeof terminateStaffSchema>;
export type RehireStaffInput = z.infer<typeof rehireStaffSchema>;
export type GetStaffInput = z.infer<typeof getStaffSchema>;
export type UpsertMonthlyAllocationInput = z.infer<typeof upsertMonthlyAllocationSchema>;
export type DeleteMonthlyAllocationInput = z.infer<typeof deleteMonthlyAllocationSchema>;
